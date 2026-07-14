"use client";

import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";

type Status = "good" | "warn" | "bad" | "unk";

interface WeeklyInsight { week: string; label: string; result: string; insight: string; action: string; }
interface WeeklySeriesPoint { week: string; label: string; cumActual: number | null; cumProgress: number | null; }
interface MonthlyCategorySummary {
  id: string;
  title: string;
  unit: string;
  cumulativeActual: number | null;
  cumulativeRate: number | null;
  monthTarget: number | null;
  projectedActual: number | null;
  projectedRate: number | null;
  weeksCounted: number;
  weeklyInsights: WeeklyInsight[];
  weeklySeries: WeeklySeriesPoint[];
}
interface MonthlySummary {
  month: string;
  daysElapsed: number;
  daysInMonth: number;
  categories: MonthlyCategorySummary[];
}

function statusOf(rate: number | null): Status {
  if (rate === null) return "unk";
  if (rate >= 95) return "good";
  if (rate >= 70) return "warn";
  return "bad";
}
const BAR_HEX: Record<Status, string> = { good: "#10b981", warn: "#f59e0b", bad: "#f43f5e", unk: "#a8a29e" };
const RATE_TEXT: Record<Status, string> = { good: "text-emerald-600", warn: "text-amber-600", bad: "text-rose-600", unk: "text-stone-400" };
const STATUS_LABEL: Record<Status, string> = { good: "달성 예상", warn: "주의", bad: "미달 예상", unk: "산출중" };

function fmt(n: number | null | undefined, unit: string): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString() + unit;
}
function shortLabel(label: string): string {
  const m = label.match(/(\d+)주/);
  return m ? `${m[1]}주` : label;
}
function progressOf(c: MonthlyCategorySummary): number | null {
  if (c.monthTarget && c.monthTarget > 0 && c.cumulativeActual !== null) {
    return Math.round((c.cumulativeActual / c.monthTarget) * 1000) / 10;
  }
  return null;
}

function Gauge({ rate }: { rate: number | null }) {
  const st = statusOf(rate);
  const pct = rate !== null ? Math.min(rate, 100) : 0;
  const dash = (pct / 100) * 283;
  return (
    <svg width="54" height="54" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="45" fill="none" stroke="#f5f5f4" strokeWidth="9" />
      <circle cx="50" cy="50" r="45" fill="none" stroke={BAR_HEX[st]} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${dash} 283`} transform="rotate(-90 50 50)" />
      <text x="50" y="56" textAnchor="middle" fontSize="23" fill="#292524">{rate !== null ? rate : "—"}</text>
    </svg>
  );
}

export function CumulativeSummary({ monthly }: { monthly: MonthlySummary | null }) {
  const cats = monthly?.categories ?? [];
  const [selected, setSelected] = useState<string>("");
  const activeId = cats.some((c) => c.id === selected) ? selected : cats[0]?.id ?? "";
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set());

  if (!monthly || cats.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-8 text-center">
        <p className="text-sm text-stone-500">이번 달 누적 데이터가 아직 없습니다.</p>
        <p className="text-xs text-stone-400 mt-1">주차별 실적이 시트에 입력되면 월 목표 대비 누적 현황이 표시됩니다.</p>
      </div>
    );
  }

  const pace = monthly.daysInMonth > 0 ? Math.round((monthly.daysElapsed / monthly.daysInMonth) * 1000) / 10 : 0;
  const cur = cats.find((c) => c.id === activeId)!;

  function toggleWeek(key: string) {
    setOpenWeeks((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  }

  const chartData = cur.weeklySeries.map((w) => ({ name: shortLabel(w.label), 누적진행률: w.cumProgress }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-stone-500">
          월 목표 대비 <b className="text-stone-700">누적</b> 기준 · 경과 {pace}% 시점 (기준선)
        </p>
        <p className="text-[11px] text-stone-400">막대 안 세로선 = 지금쯤 있어야 할 위치(경과율)</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
        {cats.map((c) => {
          const prog = progressOf(c);
          const st = statusOf(c.projectedRate);
          const on = c.id === activeId;
          const barW = prog !== null ? Math.min(prog, 100) : 0;
          return (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`text-left bg-white rounded-xl p-3 transition ${on ? "border-2 border-kkumbi-400" : "border border-stone-200 hover:border-kkumbi-300"}`}
            >
              <div className="text-[11px] font-mono text-stone-400">KPI {c.id}</div>
              <div className="text-xs font-bold text-stone-700 leading-snug min-h-[2.4em] mt-0.5 mb-1">{c.title}</div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-extrabold text-stone-800">{prog !== null ? `${prog}%` : "—"}</span>
                <span className="text-[11px] text-stone-400">월목표 대비 누적</span>
              </div>
              <div className="relative h-2 bg-stone-100 rounded-full overflow-hidden mt-1.5">
                <div className="h-full rounded-full" style={{ width: `${barW}%`, background: BAR_HEX[st] }} />
                <div className="absolute top-0 bottom-0 w-px bg-stone-500" style={{ left: `${Math.min(pace, 100)}%` }} />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-stone-400">누적 {fmt(c.cumulativeActual, c.unit)}</span>
                <span className={`text-[11px] font-semibold ${RATE_TEXT[st]}`}>
                  착지 {c.projectedRate !== null ? `${c.projectedRate}%` : "—"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <div className="text-sm font-bold text-stone-800">{cur.id} {cur.title} · 월 목표 대비 누적 추이</div>
          <div className="flex items-center gap-3">
            <Gauge rate={cur.projectedRate} />
            <div className="text-[11px] text-stone-400 leading-relaxed">
              착지 예상<br />
              <span className={`font-bold ${RATE_TEXT[statusOf(cur.projectedRate)]}`}>{STATUS_LABEL[statusOf(cur.projectedRate)]}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 my-3">
          <div className="bg-stone-50 rounded-lg p-2.5">
            <p className="text-[10px] text-stone-400">월 목표</p>
            <p className="text-sm font-bold text-stone-700">{fmt(cur.monthTarget, cur.unit)}</p>
          </div>
          <div className="bg-stone-50 rounded-lg p-2.5">
            <p className="text-[10px] text-stone-400">누적 실적</p>
            <p className="text-sm font-bold text-emerald-700">{fmt(cur.cumulativeActual, cur.unit)}</p>
          </div>
          <div className="bg-stone-50 rounded-lg p-2.5">
            <p className="text-[10px] text-stone-400">착지 예상</p>
            <p className="text-sm font-bold text-stone-700">{fmt(cur.projectedActual, cur.unit)}</p>
          </div>
        </div>

        <div style={{ width: "100%", height: 200 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="#f0efe9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={{ stroke: "#e7e5e4" }} />
              <YAxis tick={{ fontSize: 10, fill: "#a8a29e" }} tickLine={false} axisLine={false}
                domain={[0, (dataMax: number) => Math.max(100, Math.ceil(dataMax / 20) * 20)]}
                tickFormatter={(v: number) => `${v}%`} width={40} />
              <Tooltip
                formatter={(value) => {
                  const v = typeof value === "number" ? value : Number(value);
                  return [isNaN(v) ? "—" : `${v}%`, "누적 진행률"];
                }}
                labelStyle={{ fontSize: 12 }} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7e5e4" }} />
              <ReferenceLine y={100} stroke="#f59e0b" strokeDasharray="5 4" strokeWidth={1.5}
                label={{ value: "월 목표 100%", position: "insideTopRight", fontSize: 10, fill: "#b45309" }} />
              <Line dataKey="누적진행률" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: "#6366f1" }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="text-xs font-bold text-stone-600 mt-4 mb-2">주차별 활동 · 원인 · 실행계획</div>
        {cur.weeklyInsights.length === 0 ? (
          <p className="text-xs text-stone-400">아직 입력된 주차별 인사이트가 없습니다.</p>
        ) : (
          <div className="space-y-1.5">
            {cur.weeklyInsights.map((w) => {
              const key = w.week;
              const open = openWeeks.has(key);
              return (
                <div key={key} className="border border-stone-200 rounded-lg overflow-hidden">
                  <button onClick={() => toggleWeek(key)} className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-stone-50 hover:bg-stone-100 transition">
                    <span className="text-xs text-stone-700"><span className="text-stone-400 mr-2">{shortLabel(w.label)}</span>{w.result || "(결과 미기재)"}</span>
                    <span className="text-xs text-stone-400">{open ? "▲" : "▼"}</span>
                  </button>
                  {open && (
                    <div className="px-3 py-2.5 border-t border-stone-100 space-y-2">
                      <div>
                        <span className="text-[10px] font-bold text-stone-400 uppercase">원인 · 인사이트 (Why)</span>
                        <p className="text-xs text-stone-700 leading-relaxed mt-0.5 whitespace-pre-wrap">{w.insight || "—"}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-kkumbi-600 uppercase">실행 계획 (Now What)</span>
                        <p className="text-xs text-stone-700 leading-relaxed mt-0.5 whitespace-pre-wrap">{w.action || "—"}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
