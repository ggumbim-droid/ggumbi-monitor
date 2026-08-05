import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";

// ══════════════════════════════════════════════════
//  연관키워드 조회
//
//  그래프의 트렌드 지수가 "어떤 키워드들을 합쳐 나온 값인지"를 보여주기 위한 통로입니다.
//  경쟁사트랜드키워드 탭을 웹앱(?type=keywords)에서 읽어옵니다.
//
//  키워드 목록은 거의 바뀌지 않으므로 저장소에 넣어두고 그걸 먼저 씁니다.
//  → 그래프를 볼 때마다 시트를 부르지 않아 화면이 느려지지 않습니다.
//  → 목록을 수정했다면 ?refresh=1 로 한 번 새로 받으면 됩니다.
// ══════════════════════════════════════════════════

export const maxDuration = 60;

const TREND_WEBAPP_URL = process.env.GOOGLE_TREND_WEBAPP_URL;
const CACHE_KEY = "trend_keywords";

type KeywordMap = Record<string, Record<string, string[]>>;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get("refresh") === "1";

  // 저장된 목록이 있으면 그대로 사용
  if (!refresh) {
    const cached = await kvGet<KeywordMap>(CACHE_KEY);
    if (cached && Object.keys(cached).length > 0) {
      return NextResponse.json({ keywords: cached, cached: true });
    }
  }

  if (!TREND_WEBAPP_URL) {
    return NextResponse.json({ keywords: {}, error: "웹앱 URL이 설정되지 않았습니다." });
  }

  try {
    const res = await fetch(`${TREND_WEBAPP_URL}?type=keywords`, {
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ keywords: {}, error: `웹앱 응답 실패 (HTTP ${res.status})` });
    }
    const data = await res.json();
    const keywords = (data?.keywords ?? {}) as KeywordMap;

    // Apps Script에 아직 keywords 응답이 추가되지 않았으면 빈 객체가 옵니다.
    // 그 경우 화면은 키워드 없이 정상 동작하고, 나중에 추가하면 자동으로 표시됩니다.
    if (Object.keys(keywords).length > 0) {
      await kvSet(CACHE_KEY, keywords);
    }
    return NextResponse.json({ keywords, cached: false });
  } catch (e) {
    return NextResponse.json({
      keywords: {},
      error: e instanceof Error ? e.message : "조회 중 오류가 발생했습니다.",
    });
  }
}
