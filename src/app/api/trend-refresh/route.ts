import { NextRequest, NextResponse } from "next/server";
import { putDatedFacts } from "@/lib/daily-store";
import { isKvConfigured, kvSet } from "@/lib/kv";
import { collectTrend } from "@/lib/collect-trend";

// ══════════════════════════════════════════════════
//  시트에서 다시 불러오기
//
//  팀에서 구글시트(경쟁사트랜드키워드 탭)의 키워드를 고친 뒤,
//  다음 날 새벽 크론을 기다리지 않고 그 자리에서 반영하기 위한 통로입니다.
//
//  ▶ 하는 일 (순서대로)
//   1) 저장된 키워드 목록을 비웁니다 → 다음 조회 때 시트를 새로 읽습니다
//   2) 새 키워드로 네이버 데이터랩을 다시 조회합니다
//   3) 결과를 저장소에 덮어씁니다
//
//  ▶ 키워드 목록과 그래프 숫자를 "함께" 갱신하는 게 핵심입니다.
//    목록만 바꾸면 화면에는 새 키워드가 뜨는데 숫자는 옛 키워드로 계산된 값이라,
//    맞지 않는 근거를 보여주게 됩니다.
//
//  ▶ 시트에 쓰지 않습니다. 읽기만 합니다.
// ══════════════════════════════════════════════════

export const maxDuration = 60;
export const preferredRegion = ["icn1"];

const KEYWORD_CACHE_KEY = "trend_keywords";

export async function POST(request: NextRequest) {
  if (!isKvConfigured()) {
    return NextResponse.json({ error: "저장소(KV)가 설정되지 않았습니다." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  // 카테고리 수를 제한해 부분 갱신할 수 있습니다 (기본은 전체)
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;

  const started = Date.now();

  try {
    // 1) 저장된 키워드 목록 비우기 — 다음 조회가 시트를 새로 읽게 합니다
    await kvSet(KEYWORD_CACHE_KEY, {});

    // 2) 새 키워드로 데이터랩 재조회 (3개월 일별)
    //    3년치는 무거워서 여기서 하지 않습니다. 일요일 크론이 처리합니다.
    const r = await collectTrend({ budgetMs: 40_000 });

    if (r.dated.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "시트에서 키워드를 읽지 못했거나 조회 결과가 비어 있습니다.",
        ms: Date.now() - started,
      });
    }

    // 3) 저장소에 덮어쓰기
    const saved = await putDatedFacts(r.dated, 40);

    return NextResponse.json({
      ok: true,
      categories: r.categories.length,
      collected: r.dated.length,
      written: saved.written,
      replaced: saved.replaced,
      // 조회에 실패했거나 시간이 모자라 남은 카테고리를 화면에 알려줍니다
      failed: r.skipped,
      remaining: r.remaining ?? [],
      unmapped: r.unmappedCategories,
      ms: Date.now() - started,
      limit,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "갱신 중 오류가 발생했습니다.",
      ms: Date.now() - started,
    });
  }
}
