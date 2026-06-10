import { NextRequest, NextResponse } from "next/server";

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, rows } = body;

    if (!APPS_SCRIPT_URL) {
      return NextResponse.json({ error: "Google Apps Script URL이 설정되지 않았습니다." }, { status: 500 });
    }

    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, rows }),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "오류 발생";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
