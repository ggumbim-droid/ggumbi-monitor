"use client";

// 월간보고 뷰 — 주간 데이터를 자동 집계한 월간 현황
// 데이터는 /api/weekly-report GET 응답의 monthly 필드에서 옴 (route.ts buildMonthlySummary)

interface MonthlyCategorySummary {
  id: string;
  title: string;
  unit: string;
  cumulativeTarget: number | null;
  cumulativeActual: number | null;
  cumulativeRate: number | null;
  monthTarget: number | null;
  projectedActual: number | null;
  projectedRate: number | null;
  weeksCounted: number;
  weeklyInsights: { week: string; label: string; result: string; insight: string; action: string }[];
}

interface MonthlySummary {
  month: string;
  daysElapsed: number;
  daysInMonth: number;
  categories: MonthlyCategorySummary[];
}

function fmtCompact(n: number | null | undefined, unit: string): string {
  if (n === null || n === undefined) return "—";
  if (unit === "원") {
    if (Math.abs(n) >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
    if (Math.abs(n) >= 10000) return `${Math.round(n / 10000).toLocaleString()}만`;
    return n.toLocaleString();
  }
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}만${unit === "%" ? "" : unit}`;
  return `${n.toLocaleString()}${unit === "%" ? "" : unit}`;
}

// 진도율 → 색상 (마누스 벤치마킹: 100%+ 초록 / 70~99 주황 / 70 미만 빨강)
function rateColorSet(rate: number | null) {
  if (rate === null) return { bar: "bg-stone-300", text: "text-stone-400", chip: "bg-stone-100 text-stone-500" };
  if (rate >= 100) return { bar: "bg-emerald-500", text: "text-emerald-600", chip: "bg-emerald-50 text-emerald-700" };
  if (rate >= 70) return { bar: "bg-amber-500", text: "text-amber-600", chip: "bg-amber-50 text-amber-700" };
  return { bar: "bg-rose-500", text: "text-rose-600", chip: "bg-rose-50 text-rose-700" };
}

interface MonthlyReportProps {
  monthly: MonthlySummary | null;
  onOpenSheet?: () => void;
}

export function MonthlyReport({ monthly }: MonthlyReportProps) {
  if (!monthly || monthly.categories.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-10 text-center space-y-2">
        <p className="text-sm text-stone-500">아직 이번 달 집계할 주간 데이터가 없어요.</p>
        <p className="text-xs text-stone-400">주간보고에 주차별 실적이 쌓이면 여기서 자동으로 월간 현황이 만들어집니다.</p>
      </div>
    );
  }

  const monthNum = monthly.month.split("-")[1];
  const progressPct = Math.round((monthly.daysElapsed / monthly.daysInMonth) * 100);

  return (
    <div className="space-y-4">
      {/* 헤더 — 이번 달 진행 상황 */}
      <div className="bg-white border border-stone-200 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-stone-800">{monthly.month.replace("-", "년 ")}월 누적 현황</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              주간 데이터를 자동 집계했어요 · 월이 걸친 주는 일수 비율로 나눠 반영
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-stone-400">{monthNum}월 진행</p>
            <p className="text-sm font-bold text-stone-700">{monthly.daysElapsed}일 / {monthly.daysInMonth}일 ({progressPct}%)</p>
          </div>
        </div>
        <div className="h-1.5 bg-stone-100 rounded-full mt-3 overflow-hidden">
          <div className="h-full rounded-full bg-kkumbi-400" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* KPI 진도율 카드 (마누스 스타일) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {monthly.categories.map((m) => {
          const cset = rateColorSet(m.cumulativeRate);
          const pset = rateColorSet(m.projectedRate);
          const barPct = m.cumulativeRate !== null ? Math.min(m.cumulativeRate, 100) : 0;
          return (
            <div key={m.id} className="bg-white border border-stone-200 rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-xs font-mono text-stone-400 mr-1">{m.id}</span>
                  <span className="text-sm font-bold text-stone-700">{m.title}</span>
                  <p className="text-[11px] text-stone-400 mt-0.5">월 목표 {fmtCompact(m.monthTarget, m.unit)}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${cset.chip}`}>
                  누적 {m.cumulativeRate !== null ? `${m.cumulativeRate}%` : "—"}
                </span>
              </div>

              {/* 누적 목표 vs 실적 */}
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className={`text-xl font-extrabold ${cset.text}`}>{fmtCompact(m.cumulativeActual, m.unit)}</span>
                <span className="text-xs text-stone-400">/ 누적 목표 {fmtCompact(m.cumulativeTarget, m.unit)}</span>
              </div>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${cset.bar}`} style={{ width: `${barPct}%` }} />
              </div>

              {/* 예상 착지 (우리만의 강점) */}
              <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between">
                <span className="text-xs text-stone-500">이 페이스면 월말 예상</span>
                <span className="text-right">
                  <span className={`text-sm font-bold ${pset.text}`}>{fmtCompact(m.projectedActual, m.unit)}</span>
                  {m.projectedRate !== null && (
                    <span className={`text-xs font-semibold ml-1.5 ${pset.text}`}>({m.projectedRate}%)</span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 진도율 막대 요약 (마누스의 브랜드별 비교 바 벤치마킹) */}
      <div className="bg-white border border-stone-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-stone-800">KPI별 월 목표 진도율</h3>
          <div className="flex gap-2 text-[11px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />100%+</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />70~99%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />70% 미만</span>
          </div>
        </div>
        <div className="space-y-2.5">
          {monthly.categories.map((m) => {
            const cset = rateColorSet(m.projectedRate ?? m.cumulativeRate);
            const rate = m.projectedRate ?? m.cumulativeRate;
            const barPct = rate !== null ? Math.min(rate, 130) / 130 * 100 : 0;
            return (
              <div key={m.id} className="flex items-center gap-3">
                <span className="text-xs text-stone-600 w-28 shrink-0 truncate">{m.title}</span>
                <div className="flex-1 h-5 bg-stone-100 rounded-md overflow-hidden relative">
                  <div className={`h-full rounded-md ${cset.bar}`} style={{ width: `${barPct}%` }} />
                </div>
                <span className={`text-xs font-bold w-14 text-right shrink-0 ${cset.text}`}>
                  {rate !== null ? `${rate}%` : "—"}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-stone-400 mt-2">막대는 예상 착지 기준(예상 없으면 누적)이에요. 130%에서 최대로 표시됩니다.</p>
      </div>

      {/* 주간 인사이트 모음 (월간 코멘트 작성 참고자료) */}
      <div className="bg-white border border-stone-200 rounded-xl p-4">
        <h3 className="text-sm font-bold text-stone-800 mb-1">주간 인사이트 모음</h3>
        <p className="text-xs text-stone-500 mb-3">이번 달 주차별로 쌓인 원인·인사이트·실행이에요. 월간 코멘트 쓸 때 참고하세요.</p>
        <div className="space-y-4">
          {monthly.categories.filter((m) => m.weeklyInsights.length > 0).map((m) => (
            <div key={m.id}>
              <p className="text-xs font-bold text-stone-700 mb-1.5">
                <span className="font-mono text-stone-400 mr-1">{m.id}</span>{m.title}
              </p>
              <div className="space-y-1.5 pl-2 border-l-2 border-stone-100">
                {m.weeklyInsights.map((ins, i) => (
                  <div key={i} className="text-xs">
                    <span className="text-stone-400 font-medium mr-1.5">{ins.label}</span>
                    {ins.result && <span className="text-stone-700">{ins.result}</span>}
                    {ins.insight && <span className="text-stone-500"> · {ins.insight}</span>}
                    {ins.action && <span className="text-kkumbi-600"> → {ins.action}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {monthly.categories.every((m) => m.weeklyInsights.length === 0) && (
            <p className="text-xs text-stone-400">아직 쌓인 인사이트가 없어요. 주간보고에 결과요약·인사이트·실행계획을 입력하면 여기 모입니다.</p>
          )}
        </div>
      </div>

      <p className="text-[11px] text-stone-400 leading-relaxed px-1">
        · 04(1페이지 노출)·07(예산 효율)은 숫자 누적이 어려워 이 화면에서 제외했어요.
        · 여기 숫자는 주간에서 자동 집계한 <b>초안</b>이에요. 월간보고 확정 전 검토·보정하세요.
      </p>
    </div>
  );
}
