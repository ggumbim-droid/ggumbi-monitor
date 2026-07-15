"use client";

import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import { NaverTrendEmbed } from "./NaverTrendEmbed";
import { parseNarrative } from "@/lib/narrative";

type Status = "good" | "warn" | "bad" | "unk";

interface ReportItem {
  id: string; title: string; metric: string; badge: string; badgeStatus: Status;
  cause: string; action: string; due: string; gap: string;
  brand?: string; midTarget?: number | string | null; midActual?: number | string | null; midRate?: string;
}
interface BudgetRow { brand: string; budget: number; revenue: number | null; cost: number | null; }
interface ReportCategory {
  id: string; title: string; target: string; actual: string; rateLabel: string; rateNum: number | null;
  status: Status; note: string; items: ReportItem[]; actualNum?: number | null; budgetRows?: BudgetRow[];
  alternative?: string; autoCalculated?: boolean;
}
interface WeeklyReportData { categories: ReportCategory[]; }

interface Brand { brand: string; cumTarget: number | null; cumActual: number | null; rate: number | null; }
interface WeeklyInsight { week: string; label: string; result: string; insight: string; action: string; }
interface SeriesPt { week: string; label: string; cumActual: number | null; cumProgress: number | null; }
interface MonthlyCat {
  id: string; title: string; unit: string;
  cumulativeActual: number | null; cumulativeRate: number | null; monthTarget: number | null;
  projectedActual: number | null; projectedRate: number | null;
  weeksCounted: number; weeklyInsights: WeeklyInsight[]; weeklySeries: SeriesPt[]; brands: Brand[];
}
interface MonthlySummary { month: string; daysElapsed: number; daysInMonth: number; categories: MonthlyCat[]; }

function statusOf(rate: number | null): Status {
  if (rate === null) return "unk";
  if (rate >= 95) return "good";
  if (rate >= 70) return "warn";
  return "bad";
}
const BAR_HEX: Record<Status, string> = { good: "#10b981", warn: "#f59e0b", bad: "#f43f5e", unk: "#a8a29e" };
const RATE_TEXT: Record<Status, string> = { good: "text-emerald-600", warn: "text-amber-600", bad: "text-rose-600", unk: "text-stone-400" };
const RATE_TEXT2: Record<Status, string> = { good: "text-emerald-700", warn: "text-amber-700", bad: "text-rose-700", unk: "text-stone-500" };
const CHIP: Record<Status, string> = {
  good: "bg-emerald-50 text-emerald-700", warn: "bg-amber-50 text-amber-700",
  bad: "bg-rose-50 text-rose-700", unk: "bg-stone-100 text-stone-500",
};
const PROJ_LABEL: Record<Status, string> = { good: "달성 예상", warn: "주의", bad: "미달 예상", unk: "산출중" };

function fmt(n: number | null | undefined, unit = ""): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString() + unit;
}
function shortLabel(label: string): string {
  const m = label.match(/(\d+)주/);
  return m ? `${m[1]}주` : label;
}
function progressOf(c: MonthlyCat): number | null {
  if (c.monthTarget && c.monthTarget > 0 && c.cumulativeActual !== null) return Math.round((c.cumulativeActual / c.monthTarget) * 1000) / 10;
  return null;
}

function BudgetTable({ rows }: { rows: BudgetRow[] }) {
  const tb = rows.reduce((s, r) => s + r.budget, 0);
  const tr = rows.reduce((s, r) => s + (r.revenue ?? 0), 0);
  const tc = rows.reduce((s, r) => s + (r.cost ?? 0), 0);
  const ratio = tr > 0 ? Math.round((tc / tr) * 1000) / 10 : null;
  return (
    <table className="w-full text-xs mt-1">
      <thead><tr className="border-b border-stone-200 text-stone-500">
        <th className="text-left py-1.5 font-semibold">브랜드</th>
        <th className="text-right py-1.5 font-semibold">예산</th>
        <th className="text-right py-1.5 font-semibold">매출</th>
        <th className="text-right py-1.5 font-semibold">비용</th>
        <th className="text-right py-1.5 font-semibold">비중</th>
      </tr></thead>
      <tbody>
        {rows.map((r) => {
          const rr = r.revenue && r.revenue > 0 ? Math.round(((r.cost ?? 0) / r.revenue) * 1000) / 10 : null;
          return (
            <tr key={r.brand} className="border-b border-stone-100">
              <td className="py-1.5 font-medium text-stone-700">{r.brand}</td>
              <td className="py-1.5 text-right text-stone-500">{fmt(r.budget)}</td>
              <td className="py-1.5 text-right text-emerald-700">{fmt(r.revenue)}</td>
              <td className="py-1.5 text-right text-stone-600">{fmt(r.cost)}</td>
              <td className="py-1.5 text-right font-semibold text-stone-700">{rr !== null ? `${rr}%` : "—"}</td>
            </tr>
          );
        })}
        <tr className="font-bold text-stone-800">
          <td className="py-1.5">합계</td>
          <td className="py-1.5 text-right">{fmt(tb)}</td>
          <td className="py-1.5 text-right text-emerald-700">{fmt(tr)}</td>
          <td className="py-1.5 text-right">{fmt(tc)}</td>
          <td className="py-1.5 text-right">{ratio !== null ? `${ratio}%` : "—"}</td>
        </tr>
      </tbody>
    </table>
  );
}

function Gauge({ rate }: { rate: number | null }) {
  const st = statusOf(rate);
  const pct = rate !== null ? Math.min(rate, 100) : 0;
  const dash = (pct / 100) * 283;
  return (
    <svg width="52" height="52" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="45" fill="none" stroke="#f5f5f4" strokeWidth="9" />
      <circle cx="50" cy="50" r="45" fill="none" stroke={BAR_HEX[st]} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${dash} 283`} transform="rotate(-90 50 50)" />
      <text x="50" y="56" textAnchor="middle" fontSize="23" fill="#292524">{rate !== null ? rate : "—"}</text>
    </svg>
  );
}

function scrollToKpi(id: string) {
  const el = document.getElementById(`kpi-${id}`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// 주차별 서사 원문을 브랜드 소제목 · 번호항목 · 하위목표로 구조화해 렌더
function Narrative({ text, accent }: { text: string; accent: "insight" | "action" }) {
  const blocks = parseNarrative(text);
  if (blocks.length === 0) return null;
  // 파싱 결과가 사실상 원문 한 덩어리면(구조 없음) 그냥 원문 표시
  const structured = blocks.some((b) => b.brand || b.lines.length > 1 || b.lines.some((l) => l.marker));
  if (!structured) {
    return <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-wrap">{text}</p>;
  }
  const dotColor = accent === "action" ? "bg-kkumbi-400" : "bg-stone-300";
  const subColor = accent === "action" ? "text-kkumbi-600" : "text-stone-400";
  return (
    <div className="space-y-2.5">
      {blocks.map((b, bi) => (
        <div key={bi} className={b.brand ? "rounded-md bg-stone-50/70 px-2.5 py-2" : ""}>
          {b.brand && <p className="text-[11px] font-bold text-stone-700 mb-1.5">{b.brand}</p>}
          <ul className="space-y-1.5">
            {b.lines.map((l, li) => {
              if (l.kind === "sub") {
                return (
                  <li key={li} className="ml-4 flex gap-1.5 text-[11px] text-stone-600 leading-relaxed">
                    <span className={`shrink-0 font-bold ${subColor}`}>{l.marker === "=>" ? "→" : `└ ${l.marker}`}</span>
                    <span>{l.text}</span>
                  </li>
                );
              }
              return (
                <li key={li} className="flex gap-1.5 text-xs text-stone-700 leading-relaxed">
                  {l.marker ? (
                    <span className="shrink-0 font-bold text-stone-500 tabular-nums">{l.marker}</span>
                  ) : (
                    <span className={`mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full ${dotColor}`} />
                  )}
                  <span>{l.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function WeeklyDashboard({ monthly, report, currentWeek }: { monthly: MonthlySummary | null; report: WeeklyReportData | null; currentWeek?: string }) {
  const cats = report?.categories ?? [];
  const monthlyById = new Map<string, MonthlyCat>();
  (monthly?.categories ?? []).forEach((m) => monthlyById.set(m.id, m));
  const pace = monthly && monthly.daysInMonth > 0 ? Math.round((monthly.daysElapsed / monthly.daysInMonth) * 1000) / 10 : 0;

  // KPI 요약 카드: 기본 펼침 / 접으면 얇은 바만 남고, 마우스 올리면 임시로 펼쳐짐
  const [collapsed, setCollapsed] = useState(false);
  const [peek, setPeek] = useState(false);
  const showCards = !collapsed || peek;
  const monthNum = monthly?.month ? Number(monthly.month.split("-")[1]) : null;
  const monthLabel = monthNum ? `${monthNum}월` : "이번 달";

  function goKpi(id: string) {
    scrollToKpi(id);
    // 접힌 상태에서 카드를 눌러 이동하면, 이동 후 다시 접힘 유지
    if (collapsed) setPeek(false);
  }

  if (cats.length === 0) {
    return <div className="bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500">표시할 KPI 데이터가 없습니다.</div>;
  }

  return (
    <div className="space-y-4">
      <div
        className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-stone-50/95 backdrop-blur border-b border-stone-200"
        onMouseEnter={() => collapsed && setPeek(true)}
        onMouseLeave={() => setPeek(false)}
      >
        <div className="flex items-center justify-between mb-2 gap-2">
          <p className="text-[11px] text-stone-400">
            월 목표 대비 <b className="text-stone-600">누적</b> · 막대 안 세로선 = 지금쯤 있어야 할 위치(경과 {pace}%) · 카드를 누르면 아래 상세로 이동
          </p>
          <button
            onClick={() => { setCollapsed((v) => !v); setPeek(false); }}
            className="shrink-0 text-[11px] font-semibold text-stone-500 hover:text-kkumbi-600 border border-stone-200 rounded-full px-2.5 py-1 bg-white transition"
          >
            {collapsed ? "▼ 목표 카드 펼치기" : "▲ 목표 카드 접기"}
          </button>
        </div>

        {collapsed && !peek && (
          <div className="flex items-center gap-2 text-[11px] text-stone-400 px-1 pb-0.5">
            <span className="font-semibold text-stone-500">KPI 요약 접힘</span>
            <span>— 이 줄 위에 마우스를 올리면 카드가 다시 나타납니다</span>
          </div>
        )}

        <div className={`grid grid-cols-2 md:grid-cols-4 gap-2.5 transition-all ${showCards ? "opacity-100" : "max-h-0 opacity-0 overflow-hidden pointer-events-none"}`}>
          {cats.map((c) => {
            const m = monthlyById.get(c.id);
            if (m) {
              const prog = progressOf(m);
              const st = statusOf(m.projectedRate);
              return (
                <button key={c.id} onClick={() => goKpi(c.id)} className="text-left bg-white border border-stone-200 rounded-xl p-3 hover:border-kkumbi-300 transition">
                  <div className="text-[11px] font-mono text-stone-400">KPI {c.id}</div>
                  <div className="text-xs font-bold text-stone-700 leading-snug min-h-[2.4em] mt-0.5 mb-1">{c.title}</div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-extrabold text-stone-800">{prog !== null ? `${prog}%` : "—"}</span>
                    <span className="text-[10px] text-stone-400">누적</span>
                  </div>
                  <div className="relative h-2 bg-stone-100 rounded-full overflow-hidden mt-1.5">
                    <div className="h-full rounded-full" style={{ width: `${prog !== null ? Math.min(prog, 100) : 0}%`, background: BAR_HEX[st] }} />
                    <div className="absolute top-0 bottom-0 w-px bg-stone-500" style={{ left: `${Math.min(pace, 100)}%` }} />
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-stone-100 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-stone-400">월 목표</span>
                      <span className="text-[11px] font-bold text-stone-700">{fmt(m.monthTarget, m.unit)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-stone-400">누적 실적</span>
                      <span className="text-[11px] font-semibold text-emerald-700">{fmt(m.cumulativeActual, m.unit)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-stone-400">예상 달성률</span>
                      <span className={`text-[11px] font-semibold ${RATE_TEXT[st]}`}>{m.projectedRate !== null ? `${m.projectedRate}%` : "—"}</span>
                    </div>
                  </div>
                </button>
              );
            }
            return (
              <button key={c.id} onClick={() => goKpi(c.id)} className="text-left bg-white border border-stone-200 rounded-xl p-3 hover:border-kkumbi-300 transition">
                <div className="text-[11px] font-mono text-stone-400">KPI {c.id}</div>
                <div className="text-xs font-bold text-stone-700 leading-snug min-h-[2.4em] mt-0.5 mb-1">{c.title}</div>
                <div className={`text-base font-extrabold ${RATE_TEXT2[c.status]}`}>{c.rateLabel || PROJ_LABEL[c.status]}</div>
                {c.target && <div className="text-[10px] text-stone-400 mt-1.5">목표 {c.target}</div>}
                <div className="text-[10px] text-stone-400 mt-0.5 truncate">{c.actual || "—"}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        {cats.map((c) => {
          const m = monthlyById.get(c.id);
          const chartData = m ? m.weeklySeries.map((w) => ({ name: shortLabel(w.label), 누적진행률: w.cumProgress })) : [];
          const st = m ? statusOf(m.projectedRate) : c.status;
          return (
            <div key={c.id} id={`kpi-${c.id}`} className="scroll-mt-56 bg-white border border-stone-200 rounded-xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div className="text-sm font-bold text-stone-800">{c.id} {c.title}</div>
                {m ? (
                  <div className="flex items-center gap-3">
                    <Gauge rate={m.projectedRate} />
                    <div className="text-[11px] text-stone-400 leading-relaxed">예상 달성률<br /><span className={`font-bold ${RATE_TEXT[st]}`}>{PROJ_LABEL[st]}</span></div>
                  </div>
                ) : (
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${CHIP[c.status]}`}>{c.rateLabel || PROJ_LABEL[c.status]}</span>
                )}
              </div>

              {m && (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="bg-stone-50 rounded-lg p-2.5"><p className="text-[10px] text-stone-400">월 목표 ({monthLabel} 전체)</p><p className="text-sm font-bold text-stone-700">{fmt(m.monthTarget, m.unit)}</p></div>
                    <div className="bg-stone-50 rounded-lg p-2.5"><p className="text-[10px] text-stone-400">누적 실적 (현재까지)</p><p className="text-sm font-bold text-emerald-700">{fmt(m.cumulativeActual, m.unit)}</p></div>
                    <div className="bg-stone-50 rounded-lg p-2.5"><p className="text-[10px] text-stone-400">예상 실적 (월말)</p><p className="text-sm font-bold text-stone-700">{fmt(m.projectedActual, m.unit)}</p></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="rounded-lg p-2.5 border border-stone-200">
                      <p className="text-[10px] text-stone-400">누적 달성률 <span className="text-stone-300">(누적÷월목표)</span></p>
                      <p className={`text-sm font-bold ${RATE_TEXT[statusOf(progressOf(m))]}`}>{progressOf(m) !== null ? `${progressOf(m)}%` : "—"}</p>
                    </div>
                    <div className="rounded-lg p-2.5 border border-stone-200">
                      <p className="text-[10px] text-stone-400">예상 달성률 <span className="text-stone-300">(현 페이스 월말)</span></p>
                      <p className={`text-sm font-bold ${RATE_TEXT[st]}`}>{m.projectedRate !== null ? `${m.projectedRate}%` : "—"} <span className="text-[10px] font-semibold">· {PROJ_LABEL[st]}</span></p>
                    </div>
                  </div>
                  <div style={{ width: "100%", height: 190 }}>
                    <ResponsiveContainer>
                      <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
                        <CartesianGrid stroke="#f0efe9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={{ stroke: "#e7e5e4" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#a8a29e" }} tickLine={false} axisLine={false} domain={[0, (dm: number) => Math.max(100, Math.ceil(dm / 20) * 20)]} tickFormatter={(v: number) => `${v}%`} width={40} />
                        <Tooltip formatter={(value) => { const v = typeof value === "number" ? value : Number(value); return [isNaN(v) ? "—" : `${v}%`, "누적 진행률"]; }} labelStyle={{ fontSize: 12 }} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7e5e4" }} />
                        <ReferenceLine y={100} stroke="#f59e0b" strokeDasharray="5 4" strokeWidth={1.5} label={{ value: "월 목표 100%", position: "insideTopRight", fontSize: 10, fill: "#b45309" }} />
                        <Line dataKey="누적진행률" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: "#6366f1" }} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {m.brands.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-bold text-stone-600 mb-1">브랜드별 누적 ({monthLabel})</p>
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-stone-200 text-stone-500">
                          <th className="text-left py-1.5 font-semibold">브랜드</th>
                          <th className="text-right py-1.5 font-semibold">누적 목표 <span className="text-stone-300 font-normal">(경과분)</span></th>
                          <th className="text-right py-1.5 font-semibold">누적 실적</th>
                          <th className="text-right py-1.5 font-semibold">달성률</th>
                        </tr></thead>
                        <tbody>
                          {m.brands.map((b) => {
                            const bst = statusOf(b.rate);
                            return (
                              <tr key={b.brand} className="border-b border-stone-100">
                                <td className="py-1.5 font-medium text-stone-700">{b.brand}</td>
                                <td className="py-1.5 text-right text-stone-500">{fmt(b.cumTarget, m.unit)}</td>
                                <td className="py-1.5 text-right text-emerald-700 font-semibold">{fmt(b.cumActual, m.unit)}</td>
                                <td className={`py-1.5 text-right font-semibold ${RATE_TEXT[bst]}`}>{b.rate !== null ? `${b.rate}%` : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {c.id === "07" && c.budgetRows && c.budgetRows.length > 0 && <BudgetTable rows={c.budgetRows} />}

              {m && m.weeklyInsights.length > 0 && (() => {
                const shown = currentWeek ? m.weeklyInsights.filter((w) => w.week === currentWeek) : m.weeklyInsights;
                const selLabel = shown[0]?.label ? shortLabel(shown[0].label) : "선택 주차";
                return (
                  <div className="mt-3">
                    <p className="text-xs font-bold text-stone-600 mb-1.5">
                      활동 · 원인 · 실행계획 {currentWeek && <span className="text-[10px] font-normal text-stone-400">· {selLabel} 기준</span>}
                    </p>
                    {shown.length === 0 ? (
                      <p className="text-xs text-stone-400 border border-stone-200 rounded-lg px-3 py-2.5">선택한 주차에 등록된 원인·실행계획이 없습니다.</p>
                    ) : (
                      <div className="space-y-2">
                        {shown.map((w) => (
                          <div key={w.week} className="border border-stone-200 rounded-lg px-3 py-2.5 space-y-2">
                            <p className="text-xs text-stone-700"><span className="text-stone-400 mr-2 font-semibold">{shortLabel(w.label)}</span>{w.result || "(결과 미기재)"}</p>
                            {w.insight && (
                              <div>
                                <p className="text-[10px] font-bold text-stone-400 mb-1">원인</p>
                                <Narrative text={w.insight} accent="insight" />
                              </div>
                            )}
                            {w.action && (
                              <div>
                                <p className="text-[10px] font-bold text-kkumbi-600 mb-1">실행계획</p>
                                <Narrative text={w.action} accent="action" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {!m && (c.note || c.alternative) && (
                <div className="space-y-2 mt-1">
                  {c.note && <div className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2"><p className="text-[11px] font-bold text-stone-500 mb-1">인사이트 (So What)</p><Narrative text={c.note} accent="insight" /></div>}
                  {c.alternative && <div className="bg-kkumbi-50 border border-kkumbi-100 rounded-lg px-3 py-2"><p className="text-[11px] font-bold text-kkumbi-600 mb-1">실행 계획 (Now What)</p><Narrative text={c.alternative} accent="action" /></div>}
                </div>
              )}

              {c.items.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs font-bold text-stone-600 cursor-pointer">이번 주 상세 항목 ({c.items.length})</summary>
                  <div className="mt-2 space-y-2">
                    {c.items.map((it) => (
                      <div key={it.id} className="border-b border-stone-100 pb-2 last:border-b-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-stone-700">{it.title || "(제목없음)"}</span>
                          {it.badge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CHIP[it.badgeStatus]}`}>{it.badge}</span>}
                        </div>
                        {it.brand && <p className="text-[11px] text-stone-500 mt-0.5"><span className="font-semibold text-stone-600">{it.brand}</span>{" · 중목표 "}{it.midTarget || "—"}{" · 중실적 "}{it.midActual || "—"}</p>}
                        {(it.cause || it.action) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                            {it.cause && <p className="text-[11px] text-stone-600"><span className="font-bold text-stone-400">원인</span> {it.cause}</p>}
                            {it.action && <p className="text-[11px] text-stone-600"><span className="font-bold text-stone-400">실행</span> {it.action}{it.due ? ` (마감 ${it.due})` : ""}</p>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {c.id === "01" && <NaverTrendEmbed />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
