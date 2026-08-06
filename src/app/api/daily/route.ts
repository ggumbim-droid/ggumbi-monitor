import { NextRequest, NextResponse } from "next/server";
import {
  getRange,
  getRecent,
  getIndex,
  putFacts,
  todayKST,
  toSeries,
  toChartRows,
  buildCatalog,
  type DailyFact,
} from "@/lib/daily-store";
import { isKvConfigured } from "@/lib/kv";

// 저장소 값은 새벽 수집 때 하루 한 번만 바뀝니다.
// 같은 차트를 다시 열 때 KV를 또 훑지 않도록 응답을 캐시합니다.
export const maxDuration = 60;
export const preferredRegion = ["icn1"];
const CDN_CACHE = "public, s-maxage=1800, stale-while-revalidate=86400";

// ══════════════════════════════════════════════════
//  일단위 데이터 조회 / 적재 API
//
//  ▶ 조회 (GET)  — 화면이 클릭 없이 바로 읽는 곳
//   /api/daily?days=30                      최근 30일 전체
//   /api/daily?start=2026-08-01&end=2026-08-05
//   /api/daily?days=30&metric=revenue&brand=꿈비   시계열 형태로
//   /api/daily?index=1                      데이터가 있는 날짜 목록
//
//  ▶ 적재 (POST) — 사업팀 매출·Apps Script가 밀어넣는 곳
//   { "date": "2026-08-05",
//     "facts": [
//       { "brand": "꿈비", "channel": "스마트스토어",
//         "metric": "revenue", "value": 12340000, "source": "business_team" }
//     ] }
//
//   같은 날짜에 다시 보내면 같은 항목만 덮어쓰고 나머지는 보존합니다.
//   → 취소·반품으로 어제 매출이 바뀌어도 그 줄만 갱신하면 됩니다.
// ══════════════════════════════════════════════════

const INGEST_TOKEN = process.env.DAILY_INGEST_TOKEN;

export async function GET(request: NextRequest) {
  if (!isKvConfigured()) {
    return NextResponse.json(
      { error: "저장소(KV)가 설정되지 않았습니다. Vercel 환경변수를 확인해주세요." },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    if (searchParams.get("index")) {
      const dates = await getIndex();
      return NextResponse.json({ dates, count: dates.length });
    }

    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const days = Number(searchParams.get("days") ?? 30);

    let facts: DailyFact[];
    if (start && end) {
      facts = await getRange(start, end);
    } else {
      facts = await getRecent(Number.isFinite(days) && days > 0 ? days : 30);
    }

    const metric = searchParams.get("metric");
    const brand = searchParams.get("brand");
    const line = searchParams.get("line");
    const channel = searchParams.get("channel");
    const view = searchParams.get("view");
    const category = searchParams.get("category");

    // 화면의 선택 버튼을 만들기 위한 목록 (카테고리 · 계열)
    if (view === "catalog") {
      const catalog = buildCatalog(facts);
      const dates = [...new Set(facts.map((f) => f.date))].sort();
      return NextResponse.json({
        catalog,
        firstDate: dates[0] ?? null,
        lastDate: dates[dates.length - 1] ?? null,
        dayCount: dates.length,
      });
    }

    // 차트에 바로 꽂을 수 있는 행 배열
    if (view === "chart" && metric) {
      const { rows, series } = toChartRows(facts, {
        metric,
        category: category ?? undefined,
        brand: (brand as never) ?? undefined,
        line: line ?? undefined,
      });
      return NextResponse.json(
        {
          metric,
          category: category ?? null,
          rows,
          series,
          count: rows.length,
          lastDate: rows.length ? rows[rows.length - 1].date : null,
        },
        { headers: { "Cache-Control": CDN_CACHE } }
      );
    }

    // 지표를 지정하면 차트에 바로 꽂을 수 있는 시계열로 변환해서 반환
    if (metric) {
      const series = toSeries(facts, {
        metric,
        brand: (brand as never) ?? undefined,
        line: line ?? undefined,
        channel: channel ?? undefined,
      });
      return NextResponse.json({
        metric,
        brand: brand ?? null,
        series,
        count: series.length,
        updatedAt: todayKST(),
      });
    }

    return NextResponse.json({
      facts,
      count: facts.length,
      updatedAt: todayKST(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isKvConfigured()) {
    return NextResponse.json({ error: "저장소(KV)가 설정되지 않았습니다." }, { status: 500 });
  }

  // 외부에서 데이터를 밀어넣는 통로이므로 토큰을 확인합니다.
  // (토큰 미설정 시에는 검증을 건너뛰되, 운영에서는 반드시 설정하세요)
  if (INGEST_TOKEN) {
    const provided =
      request.headers.get("x-ingest-token") ??
      new URL(request.url).searchParams.get("token");
    if (provided !== INGEST_TOKEN) {
      return NextResponse.json({ error: "인증 실패" }, { status: 401 });
    }
  }

  try {
    const body = await request.json();
    const date = String(body?.date ?? todayKST());
    const facts = body?.facts;

    if (!Array.isArray(facts) || facts.length === 0) {
      return NextResponse.json(
        { error: "facts 배열이 필요합니다." },
        { status: 400 }
      );
    }

    const result = await putFacts(date, facts);
    if (!result.ok) {
      return NextResponse.json(
        { error: "저장에 실패했습니다.", detail: result },
        { status: 500 }
      );
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
