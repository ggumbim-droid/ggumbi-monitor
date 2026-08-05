import { NextRequest, NextResponse } from "next/server";
import { putDatedFacts, todayKST, getIndex, type DailyFact } from "@/lib/daily-store";
import { isKvConfigured } from "@/lib/kv";
import { collectTrend, collectTrendWeekly } from "@/lib/collect-trend";

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
  let trendRaw: unknown = null;

  // ── 수집기 ①: 검색 트렌드 ──
  {
    const started = Date.now();
    try {
      const r = await collectTrend();
      allDated.push(...r.dated);
      trendRaw = r.rawSample;
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

  // ── 수집기 ②: 검색 트렌드 (3년 주간) ──
  // 주간보고의 "3년 추이" 그래프가 저장소에서 바로 읽을 수 있도록 함께 저장합니다.
  // skipWeekly=1 로 건너뛸 수 있습니다 (시간 초과가 날 때).
  if (searchParams.get("skipWeekly") !== "1") {
    const started = Date.now();
    try {
      const r = await collectTrendWeekly();
      allDated.push(...r.dated);
      const notes: string[] = [`카테고리 ${r.categories.length}개`];
      if (r.dateRange) notes.push(`${r.dateRange.from} ~ ${r.dateRange.to}`);
      reports.push({
        name: "검색 트렌드(3년 주간)",
        ok: true,
        collected: r.dated.length,
        ms: Date.now() - started,
        note: notes.join(" / "),
      });
    } catch (e) {
      reports.push({
        name: "검색 트렌드(3년 주간)",
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
      rawSample: trendRaw,
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

  // 일별(최근 구간)과 주간(3년) 데이터는 날짜 분포가 달라 따로 저장합니다.
  // 함께 넣으면 maxDays 자르기에서 주간 과거분이 통째로 날아갑니다.
  const dailyFacts = allDated.filter((f) => f.metric !== "trend_index_weekly");
  const weeklyFacts = allDated.filter((f) => f.metric === "trend_index_weekly");

  const result = await putDatedFacts(dailyFacts, maxDays);

  // ── 3년 주간은 156주라 한 번에 다 저장하면 시간 제한에 걸립니다 ──
  // 그래서 아직 저장되지 않은 주차만 골라, 남은 시간만큼만 채우고 다음 실행에 넘깁니다.
  // 매일 새벽 크론이 반복되면 며칠 안에 3년치가 전부 채워집니다.
  let weeklyResult: Awaited<ReturnType<typeof putDatedFacts>> | null = null;
  let weeklyRemaining = 0;

  if (weeklyFacts.length) {
    const already = new Set(await getIndex());
    const allWeekDates = [...new Set(weeklyFacts.map((f) => f.date))].sort();

    // 이미 저장된 날짜는 건너뛰고, 없는 것부터(최근 순) 채웁니다
    const missing = allWeekDates.filter((d) => !already.has(d)).reverse();
    const budget = Number(searchParams.get("weeklyDays") ?? 25);
    const targets = new Set(missing.slice(0, budget));
    weeklyRemaining = Math.max(missing.length - targets.size, 0);

    // 채울 게 없으면 최신 주차만 갱신해 최근 값을 최신 상태로 유지합니다
    const pick = targets.size > 0
      ? weeklyFacts.filter((f) => targets.has(f.date))
      : weeklyFacts.filter((f) => f.date >= allWeekDates[allWeekDates.length - 4]);

    weeklyResult = await putDatedFacts(pick, budget);
  }
  return NextResponse.json({ today: todayKST(), collectors: reports, result, weeklyResult, weeklyRemaining });
}
