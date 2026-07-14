"use client";

import { useState } from "react";

type Status = "good" | "warn" | "bad" | "unk";

interface ReportItem {
  brand?: string;
  midTarget?: number | string | null;
  midActual?: number | string | null;
  midRate?: string;
}
interface ReportCategory {
  id: string;
  title: string;
  items: { brand?: string; midTarget?: number | string | null; midActual?: number | string | null; midRate?: string }[];
}
interface WeeklyReportData {
  categories: ReportCategory[];
}

const CAT_UNIT: Record<string, string> = {
  "01": "건", "02": "원", "03": "원", "05": "명", "06": "명", "08": "시간",
};

function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

function fmt(n: number | null, unit: string): string {
  if (n === null) return "—";
  return n.toLocaleString() + unit;
}

function statusOf(rate: number | null): Status {
  if (rate === null) return "unk";
  if (rate >= 95) return "good";
  if (rate >= 70) return "warn";
  return "bad";
}

const BAR_CLASS: Record<Status, string> = {
  good: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-rose-500", unk: "bg-stone-300",
};
const RATE_TEXT: Record<Status, string> = {
  good: "text-emerald-700", warn: "text-amber-700", bad: "text-rose-700", unk: "text-stone-400",
};

interface Row {
  brand: string;
  target: number | null;
  actual: number | null;
  rate: number | null;
  delta: number | null; // 전주 대비 증감률(%)
}

export function BrandRanking({
  report,
  prevReport,
}: {
  report: WeeklyReportData | null;
  prevReport: WeeklyReportData | null;
}) {
  const categories = report?.categories ?? [];
  // 브랜드 로우데이터가 있는 KPI만 (04·07 제외)
  const kpiCats = categories.filter((c) => c.items.some((it) => it.brand));

  const [selected, setSelected] = useState<string>(kpiCats[0]?.id ?? "");
  const activeId = kpiCats.some((c) => c.id === selected) ? selected : kpiCats[0]?.id ?? "";

  if (kpiCats.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-10 text-center">
        <p className="text-sm text-stone-500">브랜드별 데이터가 있는 KPI가 없습니다.</p>
        <p className="text-xs text-stone-400 mt-1">구글시트 세부항목 탭에 브랜드별 중목표·중실적이 입력되면 여기에 표시됩니다.</p>
      </div>
    );
  }

  const cat = kpiCats.find((c) => c.id === activeId)!;
  const unit = CAT_UNIT[cat.id] ?? "";

  // 직전 주차의 같은 KPI 브랜드별 실적 맵 (전주 대비용)
  const prevCat = prevReport?.categories.find((c) => c.id === cat.id);
  const prevActualByBrand = new Map<string, number>();
  (prevCat?.items ?? []).forEach((it) => {
    if (!it.brand) return;
    const a = toNum(it.midActual);
    if (a !== null) prevActualByBrand.set(it.brand, a);
  });

  const rows: Row[] = cat.items
    .filter((it) => it.brand)
    .map((it) => {
      const brand = it.brand as string;
      const target = toNum(it.midTarget);
      const actual = toNum(it.midActual);
      const rate = target && target > 0 && actual !== null ? Math.round((actual / target) * 1000) / 10 : null;
      const prev = prevActualByBrand.get(brand);
      const delta =
        prev !== undefined && prev !== 0 && actual !== null
          ? Math.round(((actual - prev) / Math.abs(prev)) * 1000) / 10
          : null;
      return { brand, target, actual, rate, delta };
    })
    .sort((a, b) => (b.actual ?? -Infinity) - (a.actual ?? -Infinity));

  const totalActual = rows.reduce((s, r) => s + (r.actual ?? 0), 0);
  const withRate = rows.filter((r) => r.rate !== null);
  const avgRate = withRate.length
    ? Math.round((withRate.reduce((s, r) => s + (r.rate ?? 0), 0) / withRate.length) * 10) / 10
    : null;
  const top = rows[0];

  const cards = [
    { label: "전체 실적 합계", value: fmt(totalActual, unit) },
    { label: "1위 브랜드", value: top?.brand ?? "—", sub: top ? fmt(top.actual, unit) : "" },
    { label: "평균 달성률", value: avgRate !== null ? `${avgRate}%` : "—" },
    { label: "브랜드 수", value: `${rows.length}개` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {kpiCats.map((c) => {
          const on = c.id === activeId;
          return (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                on
                  ? "bg-kkumbi-500 text-white border-kkumbi-500"
                  : "bg-white text-stone-600 border-stone-200 hover:border-kkumbi-300"
              }`}
            >
              {c.id} {c.title}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {cards.map((c) => (
          <div key={c.label} className="bg-stone-50 rounded-lg p-3">
            <p className="text-[11px] text-stone-400 mb-1">{c.label}</p>
            <p className="text-lg font-bold text-stone-800">{c.value}</p>
            {c.sub && <p className="text-[11px] text-stone-500 mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </div>

      <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100">
        {rows.map((r, idx) => {
          const st = statusOf(r.rate);
          const w = r.rate !== null ? Math.min(r.rate, 100) : 0;
          const up = r.delta !== null && r.delta > 0;
          const down = r.delta !== null && r.delta < 0;
          const arrow = r.delta === null ? "" : up ? "▲" : down ? "▼" : "—";
          const dcol = r.delta === null ? "text-stone-300" : up ? "text-emerald-600" : down ? "text-rose-600" : "text-stone-400";
          return (
            <div key={r.brand} className="grid grid-cols-[22px_84px_1fr_66px_110px] items-center gap-2.5 px-3 py-2.5">
              <span className="text-xs text-stone-400 text-center">{idx + 1}</span>
              <span className="text-[13px] font-semibold text-stone-800 truncate">{r.brand}</span>
              <span className="text-[13px] text-stone-600 text-right tabular-nums">{fmt(r.actual, unit)}</span>
              <span className={`text-xs text-right tabular-nums ${dcol}`}>
                {r.delta === null ? "—" : `${arrow} ${Math.abs(r.delta)}%`}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <span className={`block h-full rounded-full ${BAR_CLASS[st]}`} style={{ width: `${w}%` }} />
                </span>
                <span className={`text-[11px] font-semibold min-w-[38px] text-right ${RATE_TEXT[st]}`}>
                  {r.rate !== null ? `${r.rate}%` : "—"}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-stone-400">
        달성률 색: 달성 ≥95%(초록) · 주의 70~94.9%(주황) · 미달 &lt;70%(빨강). 전주 대비는 직전 주차 중실적과 비교한 증감률입니다.
      </p>
    </div>
  );
}
