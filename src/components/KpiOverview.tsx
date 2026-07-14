"use client";

import { useEffect, useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type Status = "good" | "warn" | "bad" | "unk";

interface KpiTrendWeek {
  week: string;
  label: string;
  target: number | null;
  actual: number | null;
  note: string;
  alternative: string;
}
interface KpiTrend {
  id: string;
  title: string;
  unit: string;
  monthTarget: number | null;
  weeks: KpiTrendWeek[];
}

function statusOf(rate: number | null): Status {
  if (rate === null) return "unk";
  if (rate >= 95) return "good";
  if (rate >= 70) return "warn";
  return "bad";
}
const BAR_HEX: Record<Status, string> = { good: "#10b981", warn: "#f59e0b", bad: "#f43f5e", unk: "#a8a29e" };
const RATE_TEXT: Record<Status, string> = { good: "text-emerald-600", warn: "text-amber-600", bad: "text-rose-600", unk: "text-stone-400" };
const STATUS_LABEL: Record<Status, string> = { good: "달성", warn: "주의", bad: "미달", unk: "산출중" };

function fmt(n: number | null, unit: string): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString() + unit;
}
function shortLabel(label: string): string {
  const m = label.match(/(\d+)주/);
  return m ? `${m[1]}주` : label;
}
function lastIdx(weeks: KpiTrendWeek[]): number {
  for (let i = weeks.length - 1; i >= 0; i--) if (weeks[i].actual !== null) return i;
  return -1;
}
function kpiMetrics(k: KpiTrend) {
  const i = lastIdx(k.weeks);
  const cur = i >= 0 ? k.weeks[i].actual : null;
  const tgt = i >= 0 ? k.weeks[i].target : null;
  const rate = cur !== null && tgt && tgt > 0 ? Math.round((cur / tgt) * 1000) / 10 : null;
  let prev: number | null = null;
  for (let j = i - 1; j >= 0; j--) { if (k.weeks[j].actual !== null) { prev = k.weeks[j].actual; break; } }
  const delta = prev !== null && prev !== 0 && cur !== null ? Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10 : null;
  return { cur, tgt, rate, delta };
}

function Sparkline({ k }: { k: KpiTrend }) {
  const vals = k.weeks.map((w) => w.actual).filter((v): v is number => v !== null);
  const tgts = k.weeks.map((w) => w.target).filter((v): v is number => v !== null);
  const max = Math.max(1, ...vals, ...tgts);
  const n = k.weeks.length;
  const w = 100, h = 26;
  const line = (arr: (number | null)[]) => {
    let d = "", started = false;
    arr.forEach((v, idx) => {
      if (v === null) return;
      const x = n > 1 ? (idx / (n - 1)) * w : 0;
      const y = h - (v / max) * h;
      d += (started ? " L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
      started = true;
    });
    return d;
  };
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="26" preserveAspectRatio="none" aria-hidden="true">
      <path d={line(k.weeks.map((x) => x.target))} fill="none" stroke="#d6d3d1" strokeWidth="1" strokeDasharray="3 2" />
      <path d={line(k.weeks.map((x) => x.actual))} fill="none" stroke="#6366f1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Gauge({ rate }: { rate: number | null }) {
  const st = statusOf(rate);
  const pct = rate !== null ? Math.min(rate, 100) : 0;
  const dash = (pct / 100) * 283;
  return (
    <svg width="56" height="56" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="45" fill="none" stroke="#f5f5f4" strokeWidth="9" />
      <circle cx="50" cy="50" r="45" fill="none" stroke={BAR_HEX[st]} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${dash} 283`} transform="rotate(-90 50 50)" />
      <text x="50" y="56" textAnchor="middle" fontSize="24" fill="#292524">{rate !== null ? rate : "—"}</text>
    </svg>
  );
}

export function KpiOverview({ week }: { week: string }) {
  const [trends, setTrends] = useState<KpiTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>("");
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!week) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/weekly-report?trends=1&week=${encodeURIComponent(week)}`);
        const data = await res.json();
        if (cancelled) return;
        const t: KpiTrend[] = data.trends ?? [];
        setTrends(t);
        setSelected((prev) => (t.some((x) => x.id === prev) ? prev : t[0]?.id ?? ""));
      } catch {
        if (!cancelled) setTrends([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [week]);

  if (loading && trends.length === 0) {
    return <p className="text-sm text-stone-400 text-center py-10">불러오는 중...</p>;
  }
  if (trends.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-10 text-center">
        <p className="text-sm text-stone-500">표시할 KPI 데이터가 없습니다.</p>
        <p className="text-xs text-stone-400 mt-1">구글시트에 해당 월의 주차별 실적이 입력되면 여기에 표시됩니다.</p>
      </div>
    );
  }

  const cur = trends.find((t) => t.id === selected) ?? trends[0];
  const m = kpiMetrics(cur);
  const st = statusOf(m.rate);
  const chartData = cur.weeks.map((w) => ({ name: shortLabel(w.label), 실적: w.actual, 목표: w.target }));
  const noteRows = cur.weeks.filter((w) => w.note || w.alternative || w.actual !== null);

  function toggleWeek(key: string) {
    setOpenWeeks((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
        {trends.map((k) => {
          const km = kpiMetrics(k);
          const kst = statusOf(km.rate);
          const on = k.id === cur.id;
          const up = km.delta !== null && km.delta > 0;
          const down = km.delta !== null && km.delta < 0;
          const arrow = km.delta === null ? "" : up ? "▲" : down ? "▼" : "—";
          const dcol = km.delta === null ? "text-stone-300" : up ? "text-emerald-600" : down ? "text-rose-600" : "text-stone-400";
          return (
            <button
              key={k.id}
              onClick={() => setSelected(k.id)}
              className={`text-left bg-white rounded-xl p-3 transition ${on ? "border-2 border-kkumbi-400" : "border border-stone-200 hover:border-kkumbi-300"}`}
            >
              <div className="text-[11px] font-mono text-stone-400">KPI {k.id}</div>
              <div className="text-xs font-bold text-stone-700 leading-snug min-h-[2.4em] mt-0.5 mb-1.5">{k.title}</div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-extrabold text-stone-800">{km.rate !== null ? `${km.rate}%` : "—"}</span>
                <span className={`text-[11px] ${dcol}`}>{arrow} {km.delta === null ? "" : `${Math.abs(km.delta)}%`}</span>
              </div>
              <div className="my-1"><Sparkline k={k} /></div>
              <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${km.rate !== null ? Math.min(km.rate, 100) : 0}%`, background: BAR_HEX[kst] }} />
              </div>
              <div className="text-[10px] text-stone-400 mt-1">실적 {fmt(km.cur, k.unit)} / 목표 {fmt(km.tgt, k.unit)}</div>
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="text-sm font-bold text-stone-800">{cur.id} {cur.title} · 주차별 추이</div>
          <div className="flex items-center gap-3">
            <Gauge rate={m.rate} />
            <div className="text-[11px] text-stone-400 leading-relaxed">
              달성률<br />
              <span className={`font-bold ${RATE_TEXT[st]}`}>{STATUS_LABEL[st]}</span>
            </div>
          </div>
        </div>

        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="#f0efe9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={{ stroke: "#e7e5e4" }} />
              <YAxis tick={{ fontSize: 10, fill: "#a8a29e" }} tickLine={false} axisLine={false}
                tickFormatter={(v: number) => (v >= 100000 ? `${Math.round(v / 10000)}만` : v.toLocaleString())} width={44} />
              <Tooltip
                formatter={(value, name) => {
                  const v = typeof value === "number" ? value : Number(value);
                  return [isNaN(v) ? "—" : `${v.toLocaleString()}${cur.unit}`, name as string];
                }}
                labelStyle={{ fontSize: 12 }} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7e5e4" }} />
              <Bar dataKey="실적" fill="#93c5fd" radius={[4, 4, 0, 0]} maxBarSize={38} />
              <Line dataKey="목표" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-2 text-[11px] text-stone-500">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm" style={{ background: "#93c5fd" }} />실적</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 border-t-2 border-dashed" style={{ borderColor: "#f59e0b" }} />목표</span>
        </div>

        <div className="text-xs font-bold text-stone-600 mt-4 mb-2">주차별 원인 · 실행계획</div>
        <div className="space-y-1.5">
          {noteRows.map((w) => {
            const key = w.week;
            const open = openWeeks.has(key);
            return (
              <div key={key} className="border border-stone-200 rounded-lg overflow-hidden">
                <button onClick={() => toggleWeek(key)} className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-stone-50 hover:bg-stone-100 transition">
                  <span className="text-xs text-stone-700"><span className="text-stone-400 mr-2">{shortLabel(w.label)}</span>실적 {fmt(w.actual, cur.unit)}</span>
                  <span className="text-xs text-stone-400">{open ? "▲" : "▼"}</span>
                </button>
                {open && (
                  <div className="px-3 py-2.5 border-t border-stone-100 space-y-2">
                    <div>
                      <span className="text-[10px] font-bold text-stone-400 uppercase">원인 (Why)</span>
                      <p className="text-xs text-stone-700 leading-relaxed mt-0.5 whitespace-pre-wrap">{w.note || "—"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-kkumbi-600 uppercase">실행 계획 (Now What)</span>
                      <p className="text-xs text-stone-700 leading-relaxed mt-0.5 whitespace-pre-wrap">{w.alternative || "—"}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
