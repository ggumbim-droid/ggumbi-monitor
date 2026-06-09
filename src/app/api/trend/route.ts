import { NextRequest, NextResponse } from "next/server";

const NAVER_DATALAB_URL = "https://openapi.naver.com/v1/datalab/search";
const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

async function kvGet(key: string) {
  const res = await fetch(`${KV_REST_API_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` },
  });
  const data = await res.json();
  const raw = data.result ?? data.value ?? null;
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object") return parsed;
      if (typeof parsed === "string") return JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  return raw;
}

function getPeriodDates(period: string, customStart?: string, customEnd?: string): { startDate: string; endDate: string; timeUnit: string } {
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  if (period === "custom" && customStart && customEnd) {
    const diffMs = new Date(customEnd).getTime() - new Date(customStart).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    let timeUnit = "month";
    if (diffDays <= 31) timeUnit = "date";
    else if (diffDays <= 180) timeUnit = "week";
    return { startDate: customStart, endDate: customEnd, timeUnit };
  }

  const end = new Date();
  const start = new Date();
  let timeUnit = "date";

  if (period === "1week") {
    start.setDate(end.getDate() - 7);
    timeUnit = "date";
  } else if (period === "3months") {
    start.setMonth(end.getMonth() - 3);
    timeUnit = "week";
  } else if (period === "1year") {
    start.setFullYear(end.getFullYear() - 1);
    timeUnit = "month";
  } else if (period === "3years") {
    start.setFullYear(end.getFullYear() - 3);
    timeUnit = "month";
  }

  return { startDate: fmt(start), endDate: fmt(end), timeUnit };
}

export async function POST(request: NextRequest) {
  try {
    const { groupId, period, customStart, customEnd } = await request.json();

    // Redis에서 키워드 그룹 가져오기
    const stored = await kvGet("keyword_groups");
    const KEYWORD_GROUPS = stored ?? {};

    const group = KEYWORD_GROUPS[groupId];
    if (!group) return NextResponse.json({ error: "그룹을 찾을 수 없습니다." }, { status: 400 });

    const clientId = process.env.NAVER_CLIENT_ID?.trim();
    const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: "네이버 API 키가 설정되지 않았습니다." }, { status: 500 });
    }

    const { startDate, endDate, timeUnit } = getPeriodDates(period, customStart, customEnd);

    const keywordGroups = group.brands.slice(0, 5).map((brand: { name: string; keywords: string[] }) => ({
      groupName: brand.name,
      keywords: brand.keywords.slice(0, 20),
    }));

    const body = { startDate, endDate, timeUnit, keywordGroups };

    const res = await fetch(NAVER_DATALAB_URL, {
      method: "POST",
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.errorMessage || "네이버 API 오류" }, { status: 502 });
    }

    const periodMap: Record<string, Record<string, number>> = {};
    for (const result of data.results ?? []) {
      for (const point of result.data ?? []) {
        if (!periodMap[point.period]) periodMap[point.period] = {};
        periodMap[point.period][result.title] = point.ratio;
      }
    }

    const results = Object.entries(periodMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, values]) => ({ period, ...values }));

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
