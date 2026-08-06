import { NextRequest, NextResponse } from "next/server";

// 검색 트렌드 데이터는 Apps Script 웹앱(경쟁사트랜드키워드 탭 기반)에서 가져온다.
// 각 카테고리 탭(폴더매트, 오가닉그라운드 등)에 매주 자동 저장되는 트렌드 값을 읽어옴.
const TREND_WEBAPP_URL = process.env.GOOGLE_TREND_WEBAPP_URL;
// 경쟁사트렌드분석 시트 웹앱(code.txt)은 token 검증 없이 type/cat/period만 사용

// Apps Script 웹앱이 요청마다 시트 18개를 전부 훑기 때문에 응답이 느립니다.
// Vercel 기본 상한(10초)에 걸려 조용히 실패하는 일이 있어 상한을 올립니다.
export const maxDuration = 60;
// 사용자가 국내에 있으므로 서울 리전에서 실행
export const preferredRegion = ["icn1"];

// 트렌드 원본은 주 1회 갱신 → 10분 캐시로 충분합니다.
const TREND_TTL = 600;
const CDN_CACHE = "public, s-maxage=600, stale-while-revalidate=3600";

interface TrendQuery {
  groupId?: string;
  period?: string;
  customStart?: string;
  customEnd?: string;
  fresh?: boolean;
}

async function loadTrend(q: TrendQuery) {
  const { groupId, period, customStart, customEnd, fresh } = q;

  if (!groupId) {
    return NextResponse.json({ error: "groupId(카테고리)가 필요합니다." }, { status: 400 });
  }
  if (!TREND_WEBAPP_URL) {
    return NextResponse.json({ error: "웹앱 URL이 설정되지 않았습니다." }, { status: 500 });
  }

  // Apps Script 웹앱 호출: ?type=chart&cat=<카테고리>&period=<기간>
  const params = new URLSearchParams({
    type: "chart",
    cat: String(groupId),
    period: String(period || "3months"),
  });

  if (period === "custom" && customStart) params.set("customStart", String(customStart));
  if (period === "custom" && customEnd) params.set("customEnd", String(customEnd));

  const url = `${TREND_WEBAPP_URL}?${params.toString()}`;

  try {
    // 같은 카테고리·기간 조합은 Vercel Data Cache에서 즉시 반환됩니다.
    const res = await fetch(url, {
      redirect: "follow",
      ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: TREND_TTL } }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: "트렌드 데이터 조회 실패" }, { status: 502 });
    }

    const data = await res.json();
    const chart = Array.isArray(data.chart) ? data.chart : [];
    // cat으로 필터했으니 해당 카테고리 하나가 옴 (이름 매칭 우선, 없으면 첫 번째)
    const match =
      chart.find((c: { name: string }) => c.name === groupId) ?? chart[0] ?? null;

    if (!match) {
      return NextResponse.json({ results: [], brands: [] }, { headers: { "Cache-Control": CDN_CACHE } });
    }

    return NextResponse.json(
      { results: match.data ?? [], brands: match.brands ?? [] },
      { headers: { "Cache-Control": fresh ? "no-store" : CDN_CACHE } }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// GET을 기본 경로로 둡니다.
// POST는 CDN이 절대 캐시하지 않기 때문에, 같은 그래프를 다시 봐도
// 매번 Apps Script를 새로 호출해 매번 느렸습니다.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  return loadTrend({
    groupId: sp.get("groupId") ?? undefined,
    period: sp.get("period") ?? undefined,
    customStart: sp.get("customStart") ?? undefined,
    customEnd: sp.get("customEnd") ?? undefined,
    fresh: sp.get("fresh") === "1",
  });
}

// 기존 호출부 호환용 (캐시는 적용되지 않습니다)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return loadTrend(body as TrendQuery);
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
}
