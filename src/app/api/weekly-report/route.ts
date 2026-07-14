import { NextRequest, NextResponse } from "next/server";

const SHEET_WEBAPP_URL = process.env.GOOGLE_SHEET_WEBAPP_URL;
const SHEET_WEBAPP_TOKEN = process.env.GOOGLE_SHEET_WEBAPP_TOKEN;

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

// ── 월 누적 요약 타입 ──────────────────────────────────
interface MonthlyCategorySummary {
  id: string;
  title: string;
  unit: string;
  cumulativeTarget: number | null;   // 1주차~현재주차 누적 목표 (일할 배분)
  cumulativeActual: number | null;   // 1주차~현재주차 누적 실적 (일할 배분)
  cumulativeRate: number | null;     // 누적 달성률(%)
  monthTarget: number | null;        // 그 달 전체 목표
  projectedActual: number | null;    // 현재 페이스로 월말까지 갔을 때 예상 실적
  projectedRate: number | null;      // 예상(착지) 달성률(%)
  weeksCounted: number;              // 합산에 포함된 주차 수
  weeklyInsights: { week: string; label: string; result: string; insight: string; action: string }[]; // 4주치 인사이트 모음
  weeklySeries: { week: string; label: string; cumActual: number | null; cumProgress: number | null }[]; // 주차별 누적 진행(월목표 대비)
}

interface MonthlySummary {
  month: string;                     // "2026-07"
  daysElapsed: number;               // 월초~현재주차 종료일까지 경과 일수
  daysInMonth: number;               // 그 달 전체 일수
  categories: MonthlyCategorySummary[];
}

// ── 구글시트 연동용 타입 ──────────────────────────────────

interface SheetWeekInfo {
  주차명?: string;
  시작일?: string;
  종료일?: string;
  회장님피드백?: string;
}

interface SheetPerformanceRow {
  KPI항목: string;
  주간목표?: string;
  실적내용?: string;
  실적숫자?: number | string;
  달성상태?: string;
  비고?: string;
  대안?: string;
}

interface SheetItemRow {
  KPI항목: string;
  순서?: number | string;
  이슈제목?: string;
  수치지표?: string;
  배지?: string;
  배지상태?: string;
  원인?: string;
  액션?: string;
  마감일?: string;
  미흡사항?: string;
  브랜드?: string;
  중목표?: number | string;
  중실적?: number | string;
  달성률?: string;
}

interface SheetBudgetRow {
  브랜드: string;
  달성매출?: number | string;
  사용비용?: number | string;
}

interface SheetWeekResponse {
  weekInfo: SheetWeekInfo | null;
  performance: SheetPerformanceRow[];
  items: SheetItemRow[];
  budgetRows: SheetBudgetRow[];
}

const CATEGORY_DEFS: { id: string; title: string }[] = [
  { id: "01", title: "키워드 검색량" },
  { id: "02", title: "퍼포먼스 마케팅" },
  { id: "03", title: "주력제품 광고매출" },
  { id: "04", title: "키워드 1페이지 노출" },
  { id: "05", title: "신규유입" },
  { id: "06", title: "계열사 시너지" },
  { id: "07", title: "예산 효율" },
  { id: "08", title: "AI 업무 절감" },
];

// ══════════════════════════════════════════════════════
//  2026년 7월~12월 월간 목표 (2026년_목표_요약본.xlsx 기준)
// ══════════════════════════════════════════════════════
const KEYWORD_VOLUME_MONTHLY: Record<string, number> = {
  "2026-07": 137397, "2026-08": 134674, "2026-09": 137986,
  "2026-10": 161734, "2026-11": 172826, "2026-12": 158355,
};
const PERFORMANCE_REVENUE_MONTHLY: Record<string, number> = {
  "2026-07": 305395000, "2026-08": 305987000, "2026-09": 187042000,
  "2026-10": 219140000, "2026-11": 227620000, "2026-12": 253520000,
};
const MAIN_AD_REVENUE_MONTHLY: Record<string, number> = {
  "2026-07": 378868127, "2026-08": 353459807, "2026-09": 384203346,
  "2026-10": 402445393, "2026-11": 427383751, "2026-12": 410655648,
};
const NEW_USER_MONTHLY: Record<string, number> = {
  "2026-07": 88944, "2026-08": 79677, "2026-09": 110723,
  "2026-10": 115956, "2026-11": 120042, "2026-12": 118699,
};

const SYNERGY_FLAT_MONTHLY = Math.round(50000 / 12);
const SYNERGY_MONTHLY: Record<string, number> = {
  "2026-07": SYNERGY_FLAT_MONTHLY, "2026-08": SYNERGY_FLAT_MONTHLY, "2026-09": SYNERGY_FLAT_MONTHLY,
  "2026-10": SYNERGY_FLAT_MONTHLY, "2026-11": SYNERGY_FLAT_MONTHLY, "2026-12": SYNERGY_FLAT_MONTHLY,
};
const AI_SAVING_FLAT_MONTHLY = Math.round(300 / 12);
const AI_SAVING_MONTHLY: Record<string, number> = {
  "2026-07": AI_SAVING_FLAT_MONTHLY, "2026-08": AI_SAVING_FLAT_MONTHLY, "2026-09": AI_SAVING_FLAT_MONTHLY,
  "2026-10": AI_SAVING_FLAT_MONTHLY, "2026-11": AI_SAVING_FLAT_MONTHLY, "2026-12": AI_SAVING_FLAT_MONTHLY,
};

const BUDGET_BRANDS = ["꿈비", "파미야", "뉴어스", "소브", "오가닉그라운드", "바바디토", "G7커피", "신선미가"];
const BUDGET_MONTHLY: Record<string, Record<string, number>> = {
  "꿈비":        { "2026-07": 113915178, "2026-08": 103630158, "2026-09": 94435278,  "2026-10": 103241708, "2026-11": 115622369, "2026-12": 109280210 },
  "파미야":      { "2026-07": 10721429,  "2026-08": 9753427,   "2026-09": 8888026,   "2026-10": 9716867,   "2026-11": 10882105,  "2026-12": 10285196 },
  "뉴어스":      { "2026-07": 9381250,   "2026-08": 8534248,   "2026-09": 7777023,   "2026-10": 8502258,   "2026-11": 9521842,   "2026-12": 8999547 },
  "소브":        { "2026-07": 0,         "2026-08": 0,         "2026-09": 0,         "2026-10": 0,         "2026-11": 0,         "2026-12": 0 },
  "오가닉그라운드": { "2026-07": 15939000, "2026-08": 14868000, "2026-09": 27153000, "2026-10": 27342000, "2026-11": 23625000, "2026-12": 27090000 },
  "바바디토":    { "2026-07": 6831000,    "2026-08": 6372000,   "2026-09": 11637000,  "2026-10": 11718000,  "2026-11": 10125000,  "2026-12": 11610000 },
  "G7커피":      { "2026-07": 0,         "2026-08": 0,         "2026-09": 0,         "2026-10": 0,         "2026-11": 0,         "2026-12": 0 },
  "신선미가":    { "2026-07": 0,         "2026-08": 0,         "2026-09": 0,         "2026-10": 0,         "2026-11": 0,         "2026-12": 0 },
};

const AUTO_CALC_CONFIG: Record<string, { monthly: Record<string, number>; unit: string }> = {
  "01": { monthly: KEYWORD_VOLUME_MONTHLY, unit: "건" },
  "02": { monthly: PERFORMANCE_REVENUE_MONTHLY, unit: "원" },
  "03": { monthly: MAIN_AD_REVENUE_MONTHLY, unit: "원" },
  "05": { monthly: NEW_USER_MONTHLY, unit: "명" },
  "06": { monthly: SYNERGY_MONTHLY, unit: "명" },
  "08": { monthly: AI_SAVING_MONTHLY, unit: "시간" },
};

function blankCategory(def: { id: string; title: string }): ReportCategory {
  return {
    id: def.id, title: def.title,
    target: "", actual: "", rateLabel: "", rateNum: null,
    status: "unk", note: "", items: [], actualNum: null, alternative: "",
  };
}

function blankReport(week: string): WeeklyReportData {
  return { week, label: "", startDate: "", endDate: "", prevFeedback: "", categories: CATEGORY_DEFS.map(blankCategory) };
}

// 데이터는 구글시트가 유일한 원본(Single Source of Truth)입니다.
// 이 라우트는 시트를 읽어 대시보드에 보여주기만 하며, 시트에 쓰지 않습니다.

const DEFAULT_TEAM_NAMES = ["방승현 팀장", "김혜림SM", "신동은SM", "김소원JM", "조혜림JM", "이수현AM"];

function fillMissingCategories(report: WeeklyReportData): WeeklyReportData {
  const existingIds = new Set(report.categories.map((c) => c.id));
  CATEGORY_DEFS.forEach((def) => {
    if (!existingIds.has(def.id)) report.categories.push(blankCategory(def));
  });
  report.categories.sort((a, b) => a.id.localeCompare(b.id));
  return report;
}

// ── 월목표 → 주간 환산 ──────────────────────────────────

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getMonthDayCounts(startDate: string, endDate: string): Record<string, number> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const counts: Record<string, number> = {};
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return counts;
  const cur = new Date(start);
  let guard = 0;
  while (cur <= end && guard < 400) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
    counts[key] = (counts[key] || 0) + 1;
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return counts;
}

function hasMonthlyConfig(monthly: Record<string, number>, dayCounts: Record<string, number>): boolean {
  return Object.keys(dayCounts).some((k) => monthly[k] !== undefined);
}

function prorateMonthly(monthly: Record<string, number>, dayCounts: Record<string, number>): number {
  const entries = Object.entries(dayCounts);
  const configuredEntries = entries.filter(([key]) => monthly[key] !== undefined);
  if (configuredEntries.length === 0) return 0;

  if (configuredEntries.length === 1) {
    const [key, ] = configuredEntries[0];
    const totalDays = entries.reduce((sum, [, days]) => sum + days, 0);
    const [y, m] = key.split("-").map(Number);
    return Math.round(monthly[key] * (totalDays / daysInMonth(y, m)));
  }

  let total = 0;
  for (const [key, days] of configuredEntries) {
    const val = monthly[key];
    const [y, m] = key.split("-").map(Number);
    total += val * (days / daysInMonth(y, m));
  }
  return Math.round(total);
}

function rateStatus(rate: number): Status {
  if (rate >= 95) return "good";
  if (rate >= 70) return "warn";
  return "bad";
}

function applyAutoCalc(cat: ReportCategory, dayCounts: Record<string, number>): ReportCategory {
  const cfg = AUTO_CALC_CONFIG[cat.id];
  if (!cfg || !hasMonthlyConfig(cfg.monthly, dayCounts)) return cat;
  const targetNum = prorateMonthly(cfg.monthly, dayCounts);
  cat.target = `${targetNum.toLocaleString()}${cfg.unit}`;
  cat.autoCalculated = true;
  if (cat.actualNum !== null && cat.actualNum !== undefined && targetNum > 0) {
    cat.actual = `${cat.actualNum.toLocaleString()}${cfg.unit}`;
    const rate = Math.round((cat.actualNum / targetNum) * 1000) / 10;
    cat.rateNum = rate;
    cat.rateLabel = `${rate}%`;
    cat.status = rateStatus(rate);
  } else {
    cat.actual = "";
    cat.rateNum = null;
    cat.rateLabel = "";
    cat.status = "unk";
  }
  return cat;
}

function applyBudgetCalc(cat: ReportCategory, dayCounts: Record<string, number>): ReportCategory {
  if (cat.id !== "07" || !hasMonthlyConfig(BUDGET_MONTHLY["꿈비"], dayCounts)) return cat;
  const existing = cat.budgetRows ?? [];
  const rows: BudgetRow[] = BUDGET_BRANDS.map((brand) => {
    const found = existing.find((r) => r.brand === brand);
    const budget = prorateMonthly(BUDGET_MONTHLY[brand], dayCounts);
    return { brand, budget, revenue: found?.revenue ?? null, cost: found?.cost ?? null };
  });
  cat.budgetRows = rows;
  cat.autoCalculated = true;
  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totalRevenue = rows.reduce((s, r) => s + (r.revenue ?? 0), 0);
  const totalCost = rows.reduce((s, r) => s + (r.cost ?? 0), 0);
  cat.target = "6.5% 이내";
  cat.note = `총예산 ${totalBudget.toLocaleString()}원`;
  if (totalRevenue > 0) {
    const ratio = Math.round((totalCost / totalRevenue) * 1000) / 10;
    cat.rateNum = ratio;
    cat.rateLabel = `${ratio}%`;
    cat.actual = `매출 ${totalRevenue.toLocaleString()}원 · 비용 ${totalCost.toLocaleString()}원`;
    cat.status = ratio <= 6.5 ? "good" : ratio <= 8 ? "warn" : "bad";
  } else {
    cat.rateNum = null;
    cat.rateLabel = "";
    cat.actual = "";
    cat.status = "unk";
  }
  return cat;
}

function decorateReport(report: WeeklyReportData): WeeklyReportData {
  if (!report.startDate || !report.endDate) return report;
  const dayCounts = getMonthDayCounts(report.startDate, report.endDate);
  report.categories = report.categories.map((cat) => {
    cat.autoCalculated = false;
    if (AUTO_CALC_CONFIG[cat.id]) return applyAutoCalc(cat, dayCounts);
    if (cat.id === "07") return applyBudgetCalc(cat, dayCounts);
    return cat;
  });
  return report;
}

// ══════════════════════════════════════════════════════
//  월 누적 요약 계산
//  · 현재 주차가 속한 달의 1주차~현재주차까지 실적을 합산
//  · 목표는 각 주차를 prorateMonthly로 환산해 누적
//  · 예상(착지) = (누적실적 / 경과일수) × 월 전체 일수
// ══════════════════════════════════════════════════════
function monthKeyOf(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function numericActualOf(cat: ReportCategory | undefined): number | null {
  if (!cat) return null;
  if (cat.actualNum !== null && cat.actualNum !== undefined) return cat.actualNum;
  return null;
}

async function buildMonthlySummary(currentReport: WeeklyReportData): Promise<MonthlySummary | null> {
  if (!currentReport.endDate) return null;
  const month = monthKeyOf(currentReport.endDate);
  if (!month) return null;

  // 이 달에 속하고, 현재 주차 종료일 이하인 주차들만 모음
  const allWeeks = await getWeekListFromSheet();
  const currentEnd = currentReport.endDate;
  const relevant = allWeeks
    .filter((w) => w.endDate && monthKeyOf(w.endDate) === month && w.endDate <= currentEnd)
    .sort((a, b) => a.endDate.localeCompare(b.endDate));

  // 현재 주차가 목록에 없을 수도 있으니 보강
  if (!relevant.find((w) => w.week === currentReport.week)) {
    relevant.push({ week: currentReport.week, label: currentReport.label, startDate: currentReport.startDate, endDate: currentReport.endDate });
    relevant.sort((a, b) => a.endDate.localeCompare(b.endDate));
  }

  // 각 주차 리포트를 시트에서 병렬 로드 (현재 주차는 이미 있는 걸 재사용)
  const reports: WeeklyReportData[] = await Promise.all(
    relevant.map((w) =>
      w.week === currentReport.week
        ? Promise.resolve(currentReport)
        : sheetReadReport(w.week)
    )
  );

  const [y, m] = month.split("-").map(Number);
  const totalDaysInMonth = daysInMonth(y, m);
  // 경과 일수 = 월 1일 ~ 현재 주차 종료일
  const monthStart = new Date(`${month}-01`);
  const curEndD = new Date(currentEnd);
  const daysElapsed = Math.min(
    totalDaysInMonth,
    Math.max(0, Math.round((curEndD.getTime() - monthStart.getTime()) / 86400000) + 1)
  );

  const catSummaries: MonthlyCategorySummary[] = [];
  for (const def of CATEGORY_DEFS) {
    const cfg = AUTO_CALC_CONFIG[def.id];
    if (!cfg) continue; // 자동계산(숫자) 카테고리만 누적 대상 (04·07 제외)

    const monthTarget = cfg.monthly[month] ?? null;

    let cumTarget = 0;
    let cumActual = 0;
    let actualHasAny = false;
    let weeksCounted = 0;
    const weeklyInsights: { week: string; label: string; result: string; insight: string; action: string }[] = [];
    const weeklySeries: { week: string; label: string; cumActual: number | null; cumProgress: number | null }[] = [];

    for (const r of reports) {
      if (!r.startDate || !r.endDate) continue;
      // 이 주가 각 달에 며칠씩 걸치는지
      const dc = getMonthDayCounts(r.startDate, r.endDate);
      const daysThisMonth = dc[month] ?? 0;
      const totalWeekDays = Object.values(dc).reduce((s, n) => s + n, 0);
      if (daysThisMonth === 0 || totalWeekDays === 0) continue; // 이 달에 안 걸친 주는 건너뜀

      // 목표: 월목표를 이 달 걸친 날수만큼 환산해 누적
      const monthOnly: Record<string, number> = { [month]: daysThisMonth };
      cumTarget += prorateMonthly(cfg.monthly, monthOnly);

      // 방식 B(일할 배분): 그 주 실적 × (이 달 걸친 날수 / 주 전체 날수)
      const cat = r.categories.find((c) => c.id === def.id);
      const a = numericActualOf(cat);
      if (a !== null) {
        cumActual += a * (daysThisMonth / totalWeekDays);
        actualHasAny = true;
      }

      // 인사이트 수집: 결과요약(actual)·인사이트(note)·실행계획(alternative)
      if (cat && (cat.actual || cat.note || cat.alternative)) {
        weeklyInsights.push({
          week: r.week,
          label: r.label || r.week,
          result: cat.actual || "",
          insight: cat.note || "",
          action: cat.alternative || "",
        });
      }
      const cumProg = monthTarget && monthTarget > 0 ? Math.round((cumActual / monthTarget) * 1000) / 10 : null;
      weeklySeries.push({
        week: r.week,
        label: r.label || r.week,
        cumActual: actualHasAny ? Math.round(cumActual) : null,
        cumProgress: actualHasAny ? cumProg : null,
      });
      weeksCounted++;
    }

    cumActual = Math.round(cumActual);
    const cumulativeTarget = cumTarget > 0 ? cumTarget : null;
    const cumulativeActual = actualHasAny ? cumActual : null;
    const cumulativeRate =
      cumulativeTarget && cumulativeActual !== null && cumulativeTarget > 0
        ? Math.round((cumulativeActual / cumulativeTarget) * 1000) / 10
        : null;

    // 예상(착지): 현재 페이스 유지 시 월말 실적
    let projectedActual: number | null = null;
    let projectedRate: number | null = null;
    if (cumulativeActual !== null && daysElapsed > 0) {
      projectedActual = Math.round((cumulativeActual / daysElapsed) * totalDaysInMonth);
      if (monthTarget && monthTarget > 0) {
        projectedRate = Math.round((projectedActual / monthTarget) * 1000) / 10;
      }
    }

    catSummaries.push({
      id: def.id, title: def.title, unit: cfg.unit,
      cumulativeTarget, cumulativeActual, cumulativeRate,
      monthTarget, projectedActual, projectedRate, weeksCounted, weeklyInsights, weeklySeries,
    });
  }

  return { month, daysElapsed, daysInMonth: totalDaysInMonth, categories: catSummaries };
}

// ── 구글시트 연동 ──────────────────────────────────────

function toNumOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function resolveCategoryId(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (CATEGORY_DEFS.some((d) => d.id === s)) return s;
  const m = s.match(/^(\d{2})/);
  if (m && CATEGORY_DEFS.some((d) => d.id === m[1])) return m[1];
  const found = CATEGORY_DEFS.find((d) => s.includes(d.title));
  return found ? found.id : null;
}

const STATUS_KO_LABEL: Record<Status, string> = { good: "달성", warn: "주의", bad: "미달", unk: "산출중" };
const BADGE_KO_LABEL: Record<Status, string> = { good: "긍정", warn: "주의", bad: "부정", unk: "중립" };

function parseStatusLenient(v: unknown, koMap: Record<Status, string>): Status | null {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).trim();
  if (s === "good" || s === "warn" || s === "bad" || s === "unk") return s as Status;
  const found = (Object.entries(koMap) as [Status, string][]).find(([, label]) => label === s);
  return found ? found[0] : null;
}

async function sheetFetchWeek(week: string): Promise<SheetWeekResponse> {
  if (!SHEET_WEBAPP_URL || !SHEET_WEBAPP_TOKEN) {
    throw new Error("구글시트 연동이 설정되지 않았습니다. (Vercel 환경변수 확인 필요)");
  }
  const url = `${SHEET_WEBAPP_URL}?token=${encodeURIComponent(SHEET_WEBAPP_TOKEN)}&week=${encodeURIComponent(week)}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (data.error) throw new Error(`구글시트 오류: ${data.error}`);
  return {
    weekInfo: data.weekInfo ?? null,
    performance: Array.isArray(data.performance) ? data.performance : [],
    items: Array.isArray(data.items) ? data.items : [],
    budgetRows: Array.isArray(data.budgetRows) ? data.budgetRows : [],
  };
}

function applySheetData(report: WeeklyReportData, sheet: SheetWeekResponse): WeeklyReportData {
  if (sheet.weekInfo) {
    const wi = sheet.weekInfo as SheetWeekInfo;
    if (wi.주차명) report.label = wi.주차명;
    if (wi.시작일) report.startDate = wi.시작일;
    if (wi.종료일) report.endDate = wi.종료일;
    if (wi.회장님피드백 !== undefined) report.prevFeedback = wi.회장님피드백;
  }

  const perfMap = new Map<string, SheetPerformanceRow>();
  (sheet.performance as SheetPerformanceRow[]).forEach((r) => {
    const id = resolveCategoryId(r.KPI항목);
    if (id) perfMap.set(id, r);
  });

  const itemsByCategory = new Map<string, SheetItemRow[]>();
  (sheet.items as SheetItemRow[]).forEach((it) => {
    const id = resolveCategoryId(it.KPI항목);
    if (!id) return;
    const arr = itemsByCategory.get(id) ?? [];
    arr.push(it);
    itemsByCategory.set(id, arr);
  });

  report.categories = report.categories.map((cat) => {
    const perf = perfMap.get(cat.id);
    if (perf && cat.id !== "07") {
      if (perf.주간목표) cat.target = perf.주간목표;
      if (perf.실적내용 !== undefined) cat.actual = perf.실적내용;
      if (perf.실적숫자 !== undefined && perf.실적숫자 !== "") cat.actualNum = toNumOrNull(perf.실적숫자);
      const parsedStatus = parseStatusLenient(perf.달성상태, STATUS_KO_LABEL);
      if (parsedStatus) cat.status = parsedStatus;
      if (perf.비고 !== undefined) cat.note = perf.비고;
      if (perf.대안 !== undefined) cat.alternative = perf.대안;
    }

    const rawItems = itemsByCategory.get(cat.id);
    if (rawItems && rawItems.length > 0) {
      cat.items = rawItems
        .slice()
        .sort((a, b) => Number(a.순서 ?? 0) - Number(b.순서 ?? 0))
        .map((it, idx) => ({
          id: `sheet-${cat.id}-${idx}`,
          title: it.이슈제목 ?? "",
          metric: it.수치지표 ?? "",
          badge: it.배지 ?? "",
          badgeStatus: parseStatusLenient(it.배지상태, BADGE_KO_LABEL) ?? "warn",
          cause: it.원인 ?? "",
          action: it.액션 ?? "",
          due: it.마감일 ?? "",
          gap: it.미흡사항 ?? "",
          brand: it.브랜드 ?? "",
          midTarget: it.중목표 ?? "",
          midActual: it.중실적 ?? "",
          midRate: it.달성률 ?? "",
        }));
    }

    if (cat.id === "07" && sheet.budgetRows.length > 0) {
      const existing = cat.budgetRows ?? [];
      cat.budgetRows = BUDGET_BRANDS.map((brand) => {
        const found = (sheet.budgetRows as SheetBudgetRow[]).find((r) => r.브랜드 === brand);
        const prevRow = existing.find((r) => r.brand === brand);
        return {
          brand,
          budget: prevRow?.budget ?? 0,
          revenue: found ? toNumOrNull(found.달성매출) : (prevRow?.revenue ?? null),
          cost: found ? toNumOrNull(found.사용비용) : (prevRow?.cost ?? null),
        };
      });
    }

    return cat;
  });

  return report;
}

// ── 시트에서 한 주차를 읽어 대시보드용 리포트로 변환 (읽기 전용의 핵심) ──
async function sheetReadReport(week: string): Promise<WeeklyReportData> {
  let report = fillMissingCategories(blankReport(week));
  try {
    const sheetData = await sheetFetchWeek(week);
    report = applySheetData(report, sheetData);
  } catch (e) {
    console.error("구글시트 읽기 실패:", e);
  }
  // 주차정보에 시작일·종료일이 비어 있어도 월 계산이 되도록 보정 (주차ID = 종료일)
  if (!report.endDate && /^\d{4}-\d{2}-\d{2}$/.test(week)) report.endDate = week;
  if (!report.startDate && report.endDate) {
    const d = new Date(report.endDate);
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() - 6);
      report.startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  }
  return decorateReport(report);
}

// ── 시트(주차정보 탭)에서 주차 목록을 읽음. 주차ID = 종료일(일요일) ──
async function getWeekListFromSheet(): Promise<WeekListEntry[]> {
  if (!SHEET_WEBAPP_URL || !SHEET_WEBAPP_TOKEN) return [];
  try {
    const url = `${SHEET_WEBAPP_URL}?token=${encodeURIComponent(SHEET_WEBAPP_TOKEN)}&action=weeks`;
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (!Array.isArray(data.weeks)) return [];
    return (data.weeks as { week?: string; label?: string }[])
      .map((w) => ({
        week: String(w.week ?? ""),
        label: String(w.label ?? ""),
        startDate: "",
        endDate: String(w.week ?? ""),
      }))
      .filter((w) => w.week)
      .sort((a, b) => a.week.localeCompare(b.week));
  } catch (e) {
    console.error("구글시트 주차목록 읽기 실패:", e);
    return [];
  }
}

// ══════════════════════════════════════════════════════


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const weeks = await getWeekListFromSheet();
    let week = searchParams.get("week") || "";
    if (!week) week = weeks.length ? weeks[weeks.length - 1].week : "";

    if (!week) {
      return NextResponse.json({ week: "", report: null, weeks: [], teamNames: DEFAULT_TEAM_NAMES, monthly: null });
    }

    // 구글시트에서 직접 읽어옴 (원본은 시트 한 곳)
    const report = await sheetReadReport(week);
    const monthly = await buildMonthlySummary(report);

    return NextResponse.json({ week, report, weeks, teamNames: DEFAULT_TEAM_NAMES, monthly });
  } catch {
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

// 읽기 전용 대시보드 — 시트에 쓰지 않습니다.
// 데이터 입력·수정·주차 생성은 모두 구글시트에서 진행합니다.
export async function POST() {
  return NextResponse.json(
    { error: "이 대시보드는 읽기 전용입니다. 데이터 입력·수정·새 주차 생성은 구글시트에서 진행해주세요." },
    { status: 405 }
  );
}
