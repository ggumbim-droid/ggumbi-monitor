import { NextRequest, NextResponse } from "next/server";

const BRAND_SCRIPT_URL = process.env.GOOGLE_BRAND_SCRIPT_URL;

export async function GET(request: NextRequest) {
  try {
    if (!BRAND_SCRIPT_URL) {
      return NextResponse.json({ error: "브랜드 모니터링 URL이 설정되지 않았습니다." }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all";

    const res = await fetch(`${BRAND_SCRIPT_URL}?type=${type}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "데이터를 가져오는데 실패했습니다." }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "오류 발생";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
