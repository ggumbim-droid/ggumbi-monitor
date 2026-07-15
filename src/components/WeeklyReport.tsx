"use client";

import { useState, useEffect, useCallback } from "react";
import { MonthlyReport } from "./MonthlyReport";
import { WeeklyDashboard } from "./WeeklyDashboard";

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
interface WeeklyReportData {
  week: string; label: string; startDate: string; endDate: string; prevFeedback: string; categories: ReportCategory[];
}
interface WeekListEntry { week: string; label: string; startDate: string; endDate: string; }

interface MonthlyCat {
  id: string; title: string; unit: string;
  cumulativeTarget: number | null; cumulativeActual: number | null; cumulativeRate: number | null; monthTarget: number | null;
  projectedActual: number | null; projectedRate: number | null; weeksCounted: number;
  weeklyInsights: { week: string; label: string; result: string; insight: string; action: string }[];
  weeklySeries: { week: string; label: string; cumActual: number | null; cumProgress: number | null }[];
  brands: { brand: string; monthTarget: number | null; cumTarget: number | null; cumActual: number | null; rate: number | null; excluded?: boolean }[];
}
interface MonthlySummary { month: string; daysElapsed: number; daysInMonth: number; categories: MonthlyCat[]; }

function fmtMD(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

const FONT_STEPS: { key: string; label: string; scale: number }[] = [
  { key: "base", label: "기본", scale: 1.2 },
  { key: "large", label: "크게", scale: 1.35 },
  { key: "xlarge", label: "아주 크게", scale: 1.5 },
];

export function WeeklyReport() {
  const [weeks, setWeeks] = useState<WeekListEntry[]>([]);
  const [week, setWeek] = useState("");
  const [report, setReport] = useState<WeeklyReportData | null>(null);
  const [monthly, setMonthly] = useState<MonthlySummary | null>(null);
  const [viewMode, setViewMode] = useState<"weekly" | "monthly">("weekly");
  const [loading, setLoading] = useState(true);
  const [fontScale, setFontScale] = useState(1.2);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("ggumbi_font_scale") : null;
    if (saved) { const n = Number(saved); if (!isNaN(n)) setFontScale(n); }
  }, []);
  function pickFont(scale: number) {
    setFontScale(scale);
    try { localStorage.setItem("ggumbi_font_scale", String(scale)); } catch {}
  }

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
    <div style={{ zoom: fontScale }} className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="inline-flex rounded-lg border border-stone-200 p-0.5 mb-2">
            <button onClick={() => setViewMode("weekly")} className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${viewMode === "weekly" ? "bg-kkumbi-500 text-white" : "text-stone-500 hover:text-stone-700"}`}>주간보고</button>
            <button onClick={() => setViewMode("monthly")} className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${viewMode === "monthly" ? "bg-kkumbi-500 text-white" : "text-stone-500 hover:text-stone-700"}`}>월간보고</button>
          </div>
          <h2 className="text-base font-bold text-stone-800">{viewMode === "weekly" ? "주간보고 대시보드" : "월간보고 대시보드"}</h2>
          <p className="text-xs text-stone-500">
            팬슈머마케팅팀 · {report?.label || week}{report?.startDate && report?.endDate ? ` (${fmtMD(report.startDate)}~${fmtMD(report.endDate)})` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center rounded-lg border border-stone-200 p-0.5">
            <span className="text-[11px] text-stone-400 px-2">글자</span>
            {FONT_STEPS.map((f) => (
              <button key={f.key} onClick={() => pickFont(f.scale)} className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition ${fontScale === f.scale ? "bg-kkumbi-500 text-white" : "text-stone-500 hover:text-stone-700"}`}>{f.label}</button>
            ))}
          </div>
          <select value={week} onChange={(e) => loadWeek(e.target.value)} className="border border-stone-200 rounded-lg px-3 py-2 text-sm">
            {weeks.slice().reverse().map((w) => (
              <option key={w.week} value={w.week}>{w.label || w.week}{w.startDate && w.endDate ? ` (${fmtMD(w.startDate)}~${fmtMD(w.endDate)})` : ""}</option>
            ))}
          </select>
          <button onClick={() => loadWeek(week)} disabled={loading} className="px-3 py-2 border border-stone-200 rounded-lg text-xs text-stone-600 hover:border-kkumbi-300 disabled:opacity-50">{loading ? "새로고침 중…" : "↻ 새로고침"}</button>
          <button onClick={() => window.print()} className="px-3 py-2 border border-stone-200 rounded-lg text-xs text-stone-600 hover:border-kkumbi-300">인쇄</button>
        </div>
      </div>

      {viewMode === "monthly" ? (
        <MonthlyReport monthly={monthly} />
      ) : (
        <>
          <div className="bg-white border border-stone-200 rounded-xl px-4 py-3 text-xs text-stone-500 flex flex-wrap gap-4">
            <span><b className="text-stone-700">월 목표 기준 · 누적 관점</b> — 주차 목표가 아니라 이번 달 전체 목표 대비 지금까지의 누적으로 봅니다</span>
            <span><b className="text-stone-700">입력은 구글시트에서</b> · 이 화면은 조회 전용</span>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <span className="text-xs font-bold text-amber-800">전주 회장님 피드백</span>
            <p className="text-sm text-stone-700 whitespace-pre-wrap mt-1">{report?.prevFeedback || "(미기재)"}</p>
          </div>

          <WeeklyDashboard monthly={monthly} report={report} currentWeek={week} />
        </>
      )}
    </div>
  );
}
