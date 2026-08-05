import { NextRequest, NextResponse } from "next/server";
import { putFacts, todayKST, type DailyFact } from "@/lib/daily-store";
import { isKvConfigured } from "@/lib/kv";

// ══════════════════════════════════════════════════
//  매일 자동 수집 (Vercel Cron 진입점)
//
//  vercel.json 의 스케줄에 따라 매일 새벽 자동 호출됩니다.
//  수집한 값을 일단위 저장소에 넣어두면 화면은 클릭 없이 읽기만 합니다.
//
//  ▶ 지금 단계 (Stage 1)
//   저장소·스케줄이 제대로 도는지 확인하는 골격만 있습니다.
//   실제 지표 수집기는 Stage 2에서 collectors 에 하나씩 붙입니다.
//   지표를 한 번에 다 켜면 어디서 실패했는지 알 수 없어 순차로 갑니다.
//
//  ▶ 수동 실행
//   /api/cron/collect?token=<CRON_SECRET>&dry=1
//   dry=1 이면 저장하지 않고 무엇이 수집될지만 보여줍니다.
// ══════════════════════════════════════════════════

export const maxDuration = 60; // Hobby 플랜 상한. 초과 시 수집이 중간에 끊깁니다.

const CRON_SECRET = process.env.CRON_SECRET;

/** 수집기 하나의 계약 — Stage 2에서 이 형태로 추가합니다 */
interface Collector {
  name: string;
  enabled: boolean;
  run: (date: string) => Promise<Omit<DailyFact, "date">[]>;
}

const COLLECTORS: Collector[] = [
  // Stage 2에서 아래 형태로 추가합니다.
  //
  // {
  //   name: "네이버 검색 트렌드",
  //   enabled: true,
  //   run: async () => {
  //     const rows = await fetchTrendRows();
  //     return rows.map((r) => ({
  //       brand: r.brand, line: r.line,
  //       metric: METRICS.TREND_INDEX, value: r.index,
  //       source: "trend_webapp",
  //     }));
  //   },
  // },
];

interface CollectorReport {
  name: string;
  ok: boolean;
  collected: number;
  ms: number;
  error?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dry = searchParams.get("dry") === "1";

  // Vercel Cron은 Authorization 헤더로 호출합니다.
  // 브라우저에서 수동 실행할 때는 ?token= 으로 넣습니다.
  if (CRON_SECRET) {
    const auth = request.headers.get("authorization");
    const token = searchParams.get("token");
    const authorized =
      auth === `Bearer ${CRON_SECRET}` || token === CRON_SECRET;
    if (!authorized) {
      return NextResponse.json({ error: "인증 실패" }, { status: 401 });
    }
  }

  if (!isKvConfigured()) {
    return NextResponse.json(
      { error: "저장소(KV)가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const date = searchParams.get("date") ?? todayKST();
  const reports: CollectorReport[] = [];
  const allFacts: Omit<DailyFact, "date">[] = [];

  for (const c of COLLECTORS) {
    if (!c.enabled) continue;
    const started = Date.now();
    try {
      const facts = await c.run(date);
      allFacts.push(...facts);
      reports.push({
        name: c.name,
        ok: true,
        collected: facts.length,
        ms: Date.now() - started,
      });
    } catch (e) {
      // 수집기 하나가 실패해도 나머지는 계속 돌립니다.
      reports.push({
        name: c.name,
        ok: false,
        collected: 0,
        ms: Date.now() - started,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (dry) {
    return NextResponse.json({
      dryRun: true,
      date,
      collectors: reports,
      wouldWrite: allFacts.length,
      sample: allFacts.slice(0, 5),
    });
  }

  if (allFacts.length === 0) {
    return NextResponse.json({
      date,
      collectors: reports,
      written: 0,
      note:
        COLLECTORS.length === 0
          ? "등록된 수집기가 없습니다. Stage 2에서 지표를 추가하세요."
          : "수집된 데이터가 없습니다.",
    });
  }

  const result = await putFacts(date, allFacts);
  return NextResponse.json({ date, collectors: reports, result });
}
