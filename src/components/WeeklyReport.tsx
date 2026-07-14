"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MonthlyReport } from "./MonthlyReport";
import { KpiOverview } from "./KpiOverview";

type Status = "good" | "warn" | "bad" | "unk";

interface ReportItem {
  id: string;
  title: string;
  metric: string;
  badge: string;
  badgeStatus: Status;
  cause: string;
  action: string;
  due: string;
  gap: string;
  brand?: string;
  midTarget?: number | string | null;
  midActual?: number | string | null;
  midRate?: string;
}

interface BudgetRow {
  brand: string;
  budget: number;
  revenue: number | null;
  cost: number | null;
}

interface ReportCategory {
  id: string;
  title: string;
  target: string;
  actual: string;
  rateLabel: string;
  rateNum: number | null;
  status: Status;
  note: string;
  items: ReportItem[];
  actualNum?: number | null;
  budgetRows?: BudgetRow[];
  alternative?: string;
  autoCalculated?: boolean;
  updatedBy?: string;
  updatedAt?: string;
}

interface WeeklyReportData {
  week: string;
  label: string;
  startDate: string;
  endDate: string;
  prevFeedback: string;
  categories: ReportCategory[];
}

interface WeekListEntry {
  week: string;
  label: string;
  startDate: string;
  endDate: string;
}

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

const STATUS_LABEL: Record<Status, string> = { good: "달성", warn: "주의", bad: "미달", unk: "산출중" };
const STATUS_CLASS: Record<Status, string> = {
  good: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  bad: "bg-rose-50 text-rose-700",
  unk: "bg-stone-100 text-stone-500",
};
const STATUS_TEXT: Record<Status, string> = {
  good: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-rose-700",
  unk: "text-stone-500",
};
const STATUS_BAR: Record<Status, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-rose-500",
  unk: "bg-stone-300",
};

function fmtMD(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString();
}

function ratioColor(ratio: number | null): string {
  if (ratio === null) return "text-stone-400";
  if (ratio <= 6.5) return "text-emerald-600";
  if (ratio <= 8) return "text-amber-600";
  return "text-rose-600";
}

// ── 예산효율 표 (읽기 전용) ──
function BudgetTable({ rows }: { rows: BudgetRow[] }) {
  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totalRevenue = rows.reduce((s, r) => s + (r.revenue ?? 0), 0);
  const totalCost = rows.reduce((s, r) => s + (r.cost ?? 0), 0);
  const totalRatio = totalRevenue > 0 ? Math.round((totalCost / totalRevenue) * 1000) / 10 : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-stone-50 rounded-lg p-3">
          <p className="text-[11px] text-stone-400 mb-1">총 예산</p>
          <p className="text-base font-bold text-stone-700">{fmtNum(totalBudget)}</p>
        </div>
        <div className="bg-stone-50 rounded-lg p-3">
          <p className="text-[11px] text-stone-400 mb-1">사업팀매출</p>
          <p className="text-base font-bold text-emerald-700">{fmtNum(totalRevenue)}</p>
        </div>
        <div className="bg-stone-50 rounded-lg p-3">
          <p className="text-[11px] text-stone-400 mb-1">총 비용</p>
          <p className="text-base font-bold text-amber-700">{fmtNum(totalCost)}</p>
        </div>
        <div className="bg-stone-50 rounded-lg p-3">
          <p className="text-[11px] text-stone-400 mb-1">사용비중</p>
          <p className={`text-base font-bold ${ratioColor(totalRatio)}`}>{totalRatio !== null ? `${totalRatio}%` : "—"}</p>
          <p className="text-[10px] text-stone-400">목표 6.5%</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-stone-200">
              <th className="text-left py-1.5 font-semibold text-stone-500">브랜드</th>
              <th className="text-right py-1.5 font-semibold text-stone-500">예산</th>
              <th className="text-right py-1.5 font-semibold text-stone-500">사업팀매출</th>
              <th className="text-right py-1.5 font-semibold text-stone-500">비용</th>
              <th className="text-right py-1.5 font-semibold text-stone-500">사용비중</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const ratio = r.revenue && r.revenue > 0 ? Math.round(((r.cost ?? 0) / r.revenue) * 1000) / 10 : null;
              return (
                <tr key={r.brand} className="border-b border-stone-100">
                  <td className="py-1.5 font-medium text-stone-700">{r.brand}</td>
                  <td className="py-1.5 text-right text-stone-500">{fmtNum(r.budget)}</td>
                  <td className="py-1.5 text-right"><span className="font-semibold text-emerald-700">{fmtNum(r.revenue)}</span></td>
                  <td className="py-1.5 text-right"><span className="text-stone-600">{fmtNum(r.cost)}</span></td>
                  <td className={`py-1.5 text-right font-semibold ${ratioColor(ratio)}`}>{ratio !== null ? `${ratio}%` : "—"}</td>
                </tr>
              );
            })}
            <tr className="font-bold text-stone-800">
              <td className="py-1.5">합계</td>
              <td className="py-1.5 text-right">{fmtNum(totalBudget)}</td>
              <td className="py-1.5 text-right text-emerald-700">{fmtNum(totalRevenue)}</td>
              <td className="py-1.5 text-right text-stone-700">{fmtNum(totalCost)}</td>
              <td className={`py-1.5 text-right ${ratioColor(totalRatio)}`}>{totalRatio !== null ? `${totalRatio}%` : "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function WeeklyReport() {
  const [weeks, setWeeks] = useState<WeekListEntry[]>([]);
  const [week, setWeek] = useState("");
  const [report, setReport] = useState<WeeklyReportData | null>(null);
  const [monthly, setMonthly] = useState<MonthlySummary | null>(null);
  const [viewMode, setViewMode] = useState<"weekly" | "monthly" | "overview">("weekly");
  const [loading, setLoading] = useState(true);

  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [highlightId, setHighlightId] = useState("");
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const loadWeek = useCallback(async (w?: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/weekly-report${w ? `?week=${encodeURIComponent(w)}` : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류 발생");
      setWeeks(data.weeks ?? []);
      setWeek(data.week ?? "");
      setReport(data.report ?? null);
      setMonthly(data.monthly ?? null);
    } catch (e) {
      console.error("주간보고 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWeek(); }, [loadWeek]);

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  // 상단 KPI 카드 클릭 → 해당 블록 열고 + 부드럽게 스크롤 + 잠깐 강조
  function scrollToBlock(id: string) {
    setOpenIds((prev) => new Set(prev).add(id));
    setHighlightId(id);
    setTimeout(() => {
      const el = blockRefs.current[id];
      if (!el) return;
      const STICKY_OFFSET = 240;
      const y = el.getBoundingClientRect().top + window.scrollY - STICKY_OFFSET;
      window.scrollTo({ top: y, behavior: "smooth" });
    }, 60);
    setTimeout(() => setHighlightId((cur) => (cur === id ? "" : cur)), 1600);
  }

  const categories = report?.categories ?? [];
  const tally: Record<Status, number> = { good: 0, warn: 0, bad: 0, unk: 0 };
  categories.forEach((c) => tally[c.status]++);

  const actionRows: { catId: string; text: string; due: string }[] = [];
  const gapRows: { catTitle: string; itemTitle: string; text: string }[] = [];
  categories.forEach((c) => {
    c.items.forEach((it) => {
      if (it.action) actionRows.push({ catId: c.id, text: it.action, due: it.due });
      if (it.gap) gapRows.push({ catTitle: c.title, itemTitle: it.title || "(제목없음)", text: it.gap });
    });
  });

  if (loading && !report) {
    return <p className="text-sm text-stone-400 text-center py-12">불러오는 중...</p>;
  }

  if (!loading && !week) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-10 text-center space-y-2">
        <p className="text-sm text-stone-500">아직 등록된 주차가 없습니다.</p>
        <p className="text-xs text-stone-400">구글시트에서 주차를 생성하면 여기에 자동으로 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="inline-flex rounded-lg border border-stone-200 p-0.5 mb-2">
            <button
              onClick={() => setViewMode("weekly")}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${viewMode === "weekly" ? "bg-kkumbi-500 text-white" : "text-stone-500 hover:text-stone-700"}`}
            >
              주간보고
            </button>
            <button
              onClick={() => setViewMode("monthly")}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${viewMode === "monthly" ? "bg-kkumbi-500 text-white" : "text-stone-500 hover:text-stone-700"}`}
            >
              월간보고
            </button>
            <button
              onClick={() => setViewMode("overview")}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${viewMode === "overview" ? "bg-kkumbi-500 text-white" : "text-stone-500 hover:text-stone-700"}`}
            >
              KPI 현황
            </button>
          </div>
          <h2 className="text-base font-bold text-stone-800">{viewMode === "weekly" ? "주간보고 대시보드" : viewMode === "monthly" ? "월간보고 대시보드" : "KPI 현황 한눈에 보기"}</h2>
          <p className="text-xs text-stone-500">
            팬슈머마케팅팀 · {report?.label || week}{report?.startDate && report?.endDate ? ` (${fmtMD(report.startDate)}~${fmtMD(report.endDate)})` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={week} onChange={(e) => loadWeek(e.target.value)} className="border border-stone-200 rounded-lg px-3 py-2 text-sm">
            {weeks.slice().reverse().map((w) => (
              <option key={w.week} value={w.week}>
                {w.label || w.week}{w.startDate && w.endDate ? ` (${fmtMD(w.startDate)}~${fmtMD(w.endDate)})` : ""}
              </option>
            ))}
          </select>
          <button onClick={() => loadWeek(week)} disabled={loading} className="px-3 py-2 border border-stone-200 rounded-lg text-xs text-stone-600 hover:border-kkumbi-300 disabled:opacity-50">
            {loading ? "새로고침 중…" : "↻ 새로고침"}
          </button>
          <button onClick={() => window.print()} className="px-3 py-2 border border-stone-200 rounded-lg text-xs text-stone-600 hover:border-kkumbi-300">인쇄</button>
        </div>
      </div>

      {viewMode === "monthly" ? (
        <MonthlyReport monthly={monthly} />
      ) : viewMode === "overview" ? (
        <KpiOverview week={week} />
      ) : (
      <>
      <div className="bg-white border border-stone-200 rounded-xl px-4 py-3 text-xs text-stone-500 flex flex-wrap gap-4">
        <span><b className="text-stone-700">데이터 입력은 구글시트에서</b> · 이 화면은 시트 데이터를 보여주는 조회 전용입니다</span>
        <span><b className="text-stone-700">4단계 관점</b> 결과(달성률) · 원인 · 인사이트 · 실행 계획</span>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
        <div className="mb-1">
          <span className="text-xs font-bold text-amber-800">전주 회장님 피드백</span>
        </div>
        <p className="text-sm text-stone-700 whitespace-pre-wrap">{report?.prevFeedback || "(미기재)"}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["good", "warn", "bad", "unk"] as Status[]).map((s) => (
          <div key={s} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${STATUS_CLASS[s]}`}>
            <span>{tally[s]}</span><span>{STATUS_LABEL[s]}</span>
          </div>
        ))}
      </div>

      <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-stone-50/95 backdrop-blur border-b border-stone-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {categories.map((c) => (
            <button key={c.id} onClick={() => scrollToBlock(c.id)} className="text-left bg-white border border-stone-200 rounded-xl p-3 hover:border-kkumbi-300 transition">
              <div className="text-xs font-mono text-stone-400 mb-1">KPI {c.id}</div>
              <div className="text-xs font-bold text-stone-700 mb-1.5 leading-snug min-h-[2.2em]">{c.title}</div>
              <div className={`text-lg font-extrabold ${STATUS_TEXT[c.status]}`}>{c.rateLabel || STATUS_LABEL[c.status]}</div>
              <div className="mt-1.5 space-y-0.5 text-[11px] leading-tight">
                <div className="flex justify-between gap-1">
                  <span className="text-stone-400 shrink-0">목표</span>
                  <span className="text-stone-600 font-medium text-right truncate">{c.target || "—"}</span>
                </div>
                <div className="flex justify-between gap-1">
                  <span className="text-stone-400 shrink-0">실적</span>
                  <span className="text-emerald-700 font-semibold text-right truncate">{c.actual || "—"}</span>
                </div>
              </div>
              <div className="h-1.5 bg-stone-100 rounded-full mt-2 overflow-hidden">
                <div className={`h-full rounded-full ${STATUS_BAR[c.status]}`} style={{ width: `${Math.min(c.rateNum ?? 0, 100)}%` }} />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {categories.map((c) => {
          const isOpen = openIds.has(c.id);
          const isHighlighted = highlightId === c.id;
          return (
            <div
              key={c.id}
              ref={(el) => { blockRefs.current[c.id] = el; }}
              className={`bg-white border rounded-xl overflow-hidden transition-all duration-500 ${isHighlighted ? "border-kkumbi-400 ring-2 ring-kkumbi-200 shadow-md" : "border-stone-200"}`}
            >
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => toggleOpen(c.id)}>
                <span className="text-xs font-mono text-stone-400 w-6 shrink-0">{c.id}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-stone-800">{c.title}</h3>
                  <p className="text-xs text-stone-500 mt-0.5 truncate">
                    목표 {c.target || "—"} · 실적 {c.actual || "—"}{c.note ? ` · ${c.note}` : ""}
                  </p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${STATUS_CLASS[c.status]}`}>{c.rateLabel || STATUS_LABEL[c.status]}</span>
              </div>
              {isOpen && (
                <div className="border-t border-stone-100 px-4 py-3 space-y-3">
                  {c.id === "07" && c.autoCalculated && c.budgetRows && (
                    <BudgetTable rows={c.budgetRows} />
                  )}
                  {c.note && (
                    <div className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
                      <p className="text-[11px] font-bold text-stone-500 uppercase mb-1">인사이트 (So What)</p>
                      <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-wrap">{c.note}</p>
                    </div>
                  )}
                  {c.alternative && (
                    <div className="bg-kkumbi-50 border border-kkumbi-100 rounded-lg px-3 py-2">
                      <p className="text-[11px] font-bold text-kkumbi-600 uppercase mb-1">실행 계획 (Now What)</p>
                      <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-wrap">{c.alternative}</p>
                    </div>
                  )}
                  {c.items.length === 0 ? (
                    <p className="text-xs text-stone-400">등록된 항목이 없습니다.</p>
                  ) : (
                    c.items.map((it) => (
                      <div key={it.id} className="border-b border-stone-100 pb-3 last:border-b-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-semibold text-stone-700">{it.title || "(제목없음)"}</span>
                          {it.badge && <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_CLASS[it.badgeStatus]}`}>{it.badge}</span>}
                        </div>
                        {it.metric && <p className="text-xs text-stone-500 mb-2">{it.metric}</p>}
                        {it.brand && (
                          <p className="text-xs text-stone-500 mb-2">
                            <span className="font-semibold text-stone-600">{it.brand}</span>
                            {" · 중목표 "}{it.midTarget || "—"}{" · 중실적 "}{it.midActual || "—"}
                            {it.midRate ? ` · ${it.midRate}` : ""}
                          </p>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div><p className="text-[11px] font-bold text-stone-400 uppercase mb-1">원인 (Why)</p><p className="text-xs text-stone-700 leading-relaxed">{it.cause || "—"}</p></div>
                          <div><p className="text-[11px] font-bold text-stone-400 uppercase mb-1">실행 계획 (Now What)</p><p className="text-xs text-stone-700 leading-relaxed">{it.action || "—"}{it.due ? ` (마감 ${it.due})` : ""}</p></div>
                        </div>
                        {it.gap && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1 mt-2">⚠ {it.gap}</p>}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-4">
        <h4 className="text-sm font-bold text-stone-800 mb-3">차주 핵심 실행 체크리스트</h4>
        {actionRows.length === 0 ? (
          <p className="text-xs text-stone-400">등록된 실행 항목이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {actionRows.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <input type="checkbox" className="mt-0.5" />
                <span className="font-mono text-stone-400 shrink-0">{r.catId}</span>
                <span className="text-stone-700 flex-1">{r.text}</span>
                {r.due && <span className="text-kkumbi-600 font-semibold shrink-0">마감 {r.due}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-4">
        <h4 className="text-sm font-bold text-stone-800 mb-3">업로드 전 보완 필요 항목</h4>
        {report?.prevFeedback && gapRows.length === 0 ? (
          <p className="text-xs text-stone-400">보완할 항목이 없습니다.</p>
        ) : (
          <ul className="space-y-1.5">
            {!report?.prevFeedback && <li className="text-xs text-stone-500"><b className="text-stone-700">전주 회장님 피드백</b> — 내용 미기재</li>}
            {gapRows.map((r, i) => (
              <li key={i} className="text-xs text-stone-500"><b className="text-stone-700">{r.catTitle} · {r.itemTitle}</b> — {r.text}</li>
            ))}
          </ul>
        )}
      </div>
      </>
      )}
    </div>
  );
}
