import { NextRequest, NextResponse } from "next/server";

// 검색 트렌드 데이터는 Apps Script 웹앱(경쟁사트랜드키워드 탭 기반)에서 가져온다.
// 각 카테고리 탭(폴더매트, 오가닉그라운드 등)에 매주 자동 저장되는 트렌드 값을 읽어옴.
const TREND_WEBAPP_URL = process.env.GOOGLE_TREND_WEBAPP_URL;
// 경쟁사트렌드분석 시트 웹앱(code.txt)은 token 검증 없이 type/cat/period만 사용

export async function POST(request: NextRequest) {
  try {
    const { groupId, period, customStart, customEnd } = await request.json();

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
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      return NextResponse.json({ error: "트렌드 데이터 조회 실패" }, { status: 502 });
    }

    const data = await res.json();
    const chart = Array.isArray(data.chart) ? data.chart : [];
    // cat으로 필터했으니 해당 카테고리 하나가 옴 (이름 매칭 우선, 없으면 첫 번째)
    const match =
      chart.find((c: { name: string }) => c.name === groupId) ?? chart[0] ?? null;

    if (!match) {
      return NextResponse.json({ results: [], brands: [] });
    }

    return NextResponse.json({
      results: match.data ?? [],
      brands: match.brands ?? [],
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
