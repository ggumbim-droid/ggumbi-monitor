import { NextRequest, NextResponse } from "next/server";
import { putDatedFacts, todayKST, getIndex, type DailyFact } from "@/lib/daily-store";
import { isKvConfigured, kvGet, kvSet } from "@/lib/kv";
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
  // 분할 수집용 — 한 번에 몇 개(limit), 몇 번째부터(offset)
  const limitParam = Number(searchParams.get("limit"));
  const offsetParam = Number(searchParams.get("offset"));
  const slice = {
    limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined,
    offset: Number.isFinite(offsetParam) && offsetParam > 0 ? offsetParam : 0,
    // 함수 상한 60초 안에서 여유를 두고 멈춥니다.
    budgetMs: 40_000,
  };
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

  //
  //  ▶ 자동 갱신 규칙
  //   Hobby 플랜은 cron을 하루 한 번만 등록할 수 있어서, 요일로 나눕니다.
  //   · 월~토 → 3개월(일별)만
  //   · 일요일 → 3년(주간)만  ← 주간 데이터라 주 1회면 충분합니다
  //   수동 실행은 ?weekly=1 / ?weekly=0 으로 언제든 덮어쓸 수 있습니다.
  const weeklyParam = searchParams.get("weekly");
  // 한국 시간 기준 요일 (0=일요일). cron은 UTC 20시 = KST 새벽 5시에 돕니다.
  const kstDay = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCDay();
  const isSunday = kstDay === 0;

  const weeklyOnly =
    weeklyParam === "1" ? true : weeklyParam === "0" ? false : isSunday;
  const runWeekly = weeklyOnly || searchParams.get("skipWeekly") === "0";

  const reports: CollectorReport[] = [];
  const allDated: DailyFact[] = [];
  let trendRaw: unknown = null;

  // ── 수집기 ①: 검색 트렌드 ──
  // 3년치만 돌리는 날(일요일 또는 weekly=1)에는 건너뜁니다.
  if (!weeklyOnly) {
    const started = Date.now();
    try {
      const r = await collectTrend(slice);
      allDated.push(...r.dated);
      trendRaw = r.rawSample;
      const notes: string[] = [];
      notes.push(`카테고리 ${r.categories.length}개`);
      if (r.dateRange) notes.push(`${r.dateRange.from} ~ ${r.dateRange.to}`);
      if (r.unmappedCategories.length) {
        notes.push(`매핑없음: ${r.unmappedCategories.join(", ")}`);
      }
      if (r.remaining?.length) notes.push(`남음 ${r.remaining.length}개: ${r.remaining.join(", ")}`);
      if (r.timings?.length) {
        const slow = r.timings.slice(0, 5).map((t) => `${t.cat} ${(t.ms / 1000).toFixed(1)}s(${t.rows}행)`);
        notes.push(`느린순: ${slow.join(" · ")}`);
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
  // 주간보고의 "3년 추이" 그래프용 데이터입니다.
  // 3년(주간) 데이터는 매일 갱신할 이유가 없고, 3개월과 같이 돌리면
  // 60초 상한을 넘깁니다. 그래서 기본은 건너뛰고 필요할 때만 돌립니다.
  //   ?weekly=1        3년치만 돌림 (3개월 건너뜀)
  //   ?skipWeekly=0    둘 다 (시간이 모자라면 남은 건 다음 실행으로)
  if (runWeekly) {
    const started = Date.now();
    try {
      const r = await collectTrendWeekly({ ...slice, budgetMs: 35_000 });
      allDated.push(...r.dated);
      const notes: string[] = [`카테고리 ${r.categories.length}개`];
      if (r.dateRange) notes.push(`${r.dateRange.from} ~ ${r.dateRange.to}`);
      if (r.remaining?.length) notes.push(`남음 ${r.remaining.length}개: ${r.remaining.join(", ")}`);
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

  let refillDone = false;
  let refillCursor = 0;

  if (weeklyFacts.length) {
    const allWeekDates = [...new Set(weeklyFacts.map((f) => f.date))].sort();
    const budget = Number(searchParams.get("weeklyDays") ?? 25);

    // ── refill=1 : 이미 저장된 값을 새 데이터로 덮어씁니다 ──
    // 기본 로직은 "없는 날짜만 채우기"라, 예전 경로로 저장된 3년치가
    // 이미 전부 존재하면 아무것도 갱신되지 않습니다.
    // 어디까지 덮었는지는 저장소에 기록해 다음 실행이 이어받습니다.
    if (searchParams.get("refill") === "1") {
      const CURSOR_KEY = "trend_weekly_refill_cursor";
      const saved = await kvGet<number>(CURSOR_KEY);
      const from = typeof saved === "number" && saved > 0 ? saved : 0;

      const slice = allWeekDates.slice(from, from + budget);
      if (slice.length === 0) {
        // 한 바퀴 다 돌았습니다 — 커서를 되돌려 다음에 다시 시작할 수 있게 합니다.
        await kvSet(CURSOR_KEY, 0);
        refillDone = true;
        weeklyRemaining = 0;
      } else {
        const targets = new Set(slice);
        const pick = weeklyFacts.filter((f) => targets.has(f.date));
        weeklyResult = await putDatedFacts(pick, budget);
        refillCursor = from + slice.length;
        await kvSet(CURSOR_KEY, refillCursor);
        weeklyRemaining = Math.max(allWeekDates.length - refillCursor, 0);
        refillDone = weeklyRemaining === 0;
      }
    } else {
      const already = new Set(await getIndex());

      // 이미 저장된 날짜는 건너뛰고, 없는 것부터(최근 순) 채웁니다
      const missing = allWeekDates.filter((d) => !already.has(d)).reverse();
      const targets = new Set(missing.slice(0, budget));
      weeklyRemaining = Math.max(missing.length - targets.size, 0);

      // 채울 게 없으면 최신 주차만 갱신해 최근 값을 최신 상태로 유지합니다
      const pick = targets.size > 0
        ? weeklyFacts.filter((f) => targets.has(f.date))
        : weeklyFacts.filter((f) => f.date >= allWeekDates[allWeekDates.length - 4]);

      weeklyResult = await putDatedFacts(pick, budget);
    }
  }
  return NextResponse.json({
    today: todayKST(),
    collectors: reports,
    result,
    weeklyResult,
    weeklyRemaining,
    ...(searchParams.get("refill") === "1"
      ? { refillCursor, refillDone, refillNote: refillDone ? "3년치 덮어쓰기 완료" : "이어서 한 번 더 실행하세요" }
      : {}),
  });
}
