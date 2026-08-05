import { NextRequest, NextResponse } from "next/server";
import { putDatedFacts, todayKST, type DailyFact } from "@/lib/daily-store";
import { isKvConfigured } from "@/lib/kv";
import { collectTrend } from "@/lib/collect-trend";

// ══════════════════════════════════════════════════
//  매일 자동 수집 (Vercel Cron 진입점)
//
//  vercel.json 스케줄에 따라 매일 새벽 자동 호출됩니다.
//  수집한 값을 일단위 저장소에 넣어두면 화면은 클릭 없이 읽기만 합니다.
//
//  ▶ 등록된 수집기
//   · 검색 트렌드 — 경쟁사트렌드분석 시트에서 일별 지수 (자사 + 경쟁사)
//
//  ▶ 수동 실행
//   /api/cron/collect?token=<CRON_SECRET>&dry=1   저장 없이 미리보기
//   /api/cron/collect?token=<CRON_SECRET>         실제 저장
//   /api/cron/collect?token=<CRON_SECRET>&days=7  최근 7일치만 저장
// ══════════════════════════════════════════════════

export const maxDuration = 60; // Hobby 플랜 상한

const CRON_SECRET = process.env.CRON_SECRET;

// 한 번에 저장할 최대 일수. 3개월치를 통째로 쓰면 시간 제한에 걸릴 수 있어 기본을 둡니다.
const DEFAULT_MAX_DAYS = 40;

interface CollectorReport {
  name: string;
  ok: boolean;
  collected: number;
  ms: number;
  note?: string;
  error?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dry = searchParams.get("dry") === "1";
  const daysParam = Number(searchParams.get("days"));
  const maxDays =
    Number.isFinite(daysParam) && daysParam > 0 ? daysParam : DEFAULT_MAX_DAYS;

  // Vercel Cron은 Authorization 헤더로, 수동 실행은 ?token= 으로 호출합니다.
  if (CRON_SECRET) {
    const auth = request.headers.get("authorization");
    const token = searchParams.get("token");
    if (auth !== `Bearer ${CRON_SECRET}` && token !== CRON_SECRET) {
      return NextResponse.json({ error: "인증 실패" }, { status: 401 });
    }
  }

  if (!isKvConfigured()) {
    return NextResponse.json(
      { error: "저장소(KV)가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const reports: CollectorReport[] = [];
  const allDated: DailyFact[] = [];

  // ── 수집기 ①: 검색 트렌드 ──
  {
    const started = Date.now();
    try {
      const r = await collectTrend();
      allDated.push(...r.dated);
      const notes: string[] = [];
      notes.push(`카테고리 ${r.categories.length}개`);
      if (r.dateRange) notes.push(`${r.dateRange.from} ~ ${r.dateRange.to}`);
      if (r.unmappedCategories.length) {
        notes.push(`매핑없음: ${r.unmappedCategories.join(", ")}`);
      }
      reports.push({
        name: "검색 트렌드",
        ok: true,
        collected: r.dated.length,
        ms: Date.now() - started,
        note: notes.join(" / "),
      });
    } catch (e) {
      // 수집기 하나가 실패해도 나머지는 계속 돌립니다.
      reports.push({
        name: "검색 트렌드",
        ok: false,
        collected: 0,
        ms: Date.now() - started,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (dry) {
    const dates = [...new Set(allDated.map((f) => f.date))].sort();
    return NextResponse.json({
      dryRun: true,
      today: todayKST(),
      collectors: reports,
      wouldWrite: allDated.length,
      dayCount: dates.length,
      firstDate: dates[0] ?? null,
      lastDate: dates[dates.length - 1] ?? null,
      sample: allDated.slice(0, 5),
    });
  }

  if (allDated.length === 0) {
    return NextResponse.json({
      today: todayKST(),
      collectors: reports,
      written: 0,
      note: "수집된 데이터가 없습니다.",
    });
  }

  const result = await putDatedFacts(allDated, maxDays);
  return NextResponse.json({ today: todayKST(), collectors: reports, result });
}
