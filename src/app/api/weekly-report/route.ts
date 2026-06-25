import { NextRequest, NextResponse } from "next/server";

const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

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
//  · 01/02/03/05는 "합계"행 그대로 (01은 G7커피 제외 합계, 03은 뉴어스·신선미가 포함 45억 유지)
//  · 07은 브랜드별 월 예산
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

// 계열사 시너지(연 5만 명)·AI 업무절감(연 300시간)은 월별 데이터가 따로 없어
// 대목표를 12개월로 균등 분할한 값을 월 목표로 사용합니다.
const SYNERGY_FLAT_MONTHLY = Math.round(50000 / 12); // 4,167명/월
const SYNERGY_MONTHLY: Record<string, number> = {
  "2026-07": SYNERGY_FLAT_MONTHLY, "2026-08": SYNERGY_FLAT_MONTHLY, "2026-09": SYNERGY_FLAT_MONTHLY,
  "2026-10": SYNERGY_FLAT_MONTHLY, "2026-11": SYNERGY_FLAT_MONTHLY, "2026-12": SYNERGY_FLAT_MONTHLY,
};
const AI_SAVING_FLAT_MONTHLY = Math.round(300 / 12); // 25시간/월
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
    status: "unk", note: "", items: [], actualNum: null,
  };
}

function blankReport(week: string): WeeklyReportData {
  return { week, label: "", startDate: "", endDate: "", prevFeedback: "", categories: CATEGORY_DEFS.map(blankCategory) };
}

async function kvGet(key: string) {
  const res = await fetch(`${KV_REST_API_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` },
  });
  const data = await res.json();
  const raw = data.result ?? data.value ?? null;
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object") return parsed;
      if (typeof parsed === "string") return JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  return raw;
}

async function kvSet(key: string, value: object) {
  const jsonStr = JSON.stringify(value);
  await fetch(`${KV_REST_API_URL}/set/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_REST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(jsonStr),
  });
}

function reportKey(week: string) {
  return `weekly_report:${week}`;
}

async function getWeekList(): Promise<WeekListEntry[]> {
  const raw = (await kvGet("weekly_report_weeks")) as unknown;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) =>
    typeof item === "string"
      ? { week: item, label: "", startDate: "", endDate: "" }
      : (item as WeekListEntry)
  );
}

async function addWeekToList(entry: WeekListEntry) {
  const list = await getWeekList();
  const idx = list.findIndex((w) => w.week === entry.week);
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  list.sort((a, b) => a.week.localeCompare(b.week));
  await kvSet("weekly_report_weeks", list);
}

const DEFAULT_TEAM_NAMES = ["방승현 팀장", "김혜림SM", "신동은SM", "김소원JM", "조혜림JM", "이수현AM"];

async function getTeamNames(): Promise<string[]> {
  const raw = (await kvGet("weekly_report_team_names")) as unknown;
  if (Array.isArray(raw) && raw.length) return raw as string[];
  return DEFAULT_TEAM_NAMES;
}

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
  let total = 0;
  for (const [key, days] of Object.entries(dayCounts)) {
    const val = monthly[key];
    if (val === undefined) continue;
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

// ── 시드(예시) 데이터 ──────────────────────────────────

function seedItems(catId: string, raw: { title: string; metric: string; badge: string; badgeStatus: Status; cause: string; action: string; due?: string; gap?: string }[]): ReportItem[] {
  return raw.map((it, idx) => ({
    id: `${catId}-seed-${idx}`,
    title: it.title, metric: it.metric, badge: it.badge, badgeStatus: it.badgeStatus,
    cause: it.cause, action: it.action, due: it.due ?? "", gap: it.gap ?? "",
  }));
}

function buildSeedReport(): WeeklyReportData {
  return {
    week: "2026-06-22",
    label: "6월 3주차",
    startDate: "2026-06-16",
    endDate: "2026-06-22",
    prevFeedback: "",
    categories: [
      {
        id: "01", title: "키워드 검색량", target: "170만 건", actual: "151만 건 (70+60+14+7)",
        rateLabel: "88.8%", rateNum: 88.8, status: "warn", note: "", actualNum: null,
        items: seedItems("01", [
          { title: "꿈비/리코코 — 시공매트", metric: "자사 7일평균지수 4.9 · 8개 브랜드 중 최하위", badge: "최하위권", badgeStatus: "bad",
            cause: "경쟁사(봄봄매트 54.6·알집 51)는 오프라인 베페·라이브를 상시 연계해 트래픽을 만드는데, 자사는 시공매트 전용 오프라인 행사·라이브가 없어 채널 자체가 부족(채널)",
            action: "매트군 침투 바이럴 착수, 매트 관련 콘텐츠 정기 포스팅 일정 확정" },
          { title: "꿈비/리코코 — 폴더매트", metric: "자사 7일평균지수 4.0 · 1위 알집매트(48.7)와 격차 큼", badge: "유지", badgeStatus: "warn",
            cause: "경쟁사는 베페·라이브를 주 단위로 반복 운영, 자사는 인플루언서 후기 콘텐츠 위주라 이벤트성 트래픽 스파이크가 없음(콘텐츠)",
            action: "", gap: "폴더매트 전용 차주 실행안 미정" },
          { title: "꿈비/리코코 — 범퍼침대", metric: "자사 7일평균지수 56.3 · 2위(1위 도노도노 79, 격차 22.7)", badge: "하락 -6.6", badgeStatus: "warn",
            cause: "단순 검색량 확보형이 아닌 전환 효율 중심 광고로 운영 전환 중이라 검색량 지표 자체는 정체(광고)",
            action: "전환 효율 중심 광고 운영 지속, 격차 축소 위한 전환 캠페인 강화" },
          { title: "꿈비/리코코 — 매트 키워드 비교(폴더/롤/퍼즐/시공)", metric: "폴더매트만 84.6 유지, 롤·퍼즐매트는 한 자릿수", badge: "유지", badgeStatus: "warn",
            cause: "롤매트·퍼즐매트는 체험단·바이럴 콘텐츠 배정이 적어 검색 유입 자체가 낮음(콘텐츠)",
            action: "롤매트·퍼즐매트 체험단·바이럴 콘텐츠 강화로 상위노출 목표" },
          { title: "꿈비 소싱 — 젖병세척기", metric: "자사 7일평균지수 9.9 · 5개 브랜드 중 최하위", badge: "최하위", badgeStatus: "bad",
            cause: "6월 메인 행사·홍보 부재, 체험단·바이럴도 신제품(맘마존) 중심으로 이동하며 작업량 감소(콘텐츠)",
            action: "맘마존 홍보 시 젖병세척기 내용 필수 포함, 7월부터 바이럴 작업량 기존 수준 복원" },
          { title: "꿈비 소싱 — 분유포트 / 분유쉐이커", metric: "분유포트 71.1(1위,-6.7) · 분유쉐이커 42.5(1위,-8)", badge: "하락", badgeStatus: "warn",
            cause: "더에르고X링크맘 핫딜·메타광고 행사 종료 및 재고 소진에 따른 자연 하락(광고)",
            action: "토요일 카카오 쟁쟁한특가에 분유쉐이커 메인 노출 예정 → 분유쉐이커 홍보 집중", due: "6/28" },
          { title: "꿈비 소싱 — 시즌제품(쿨시트/쿨링커버)", metric: "쿨링커버 41.8(+20.3) · 쿨시트 6.9(유지)", badge: "쿨링커버 상승", badgeStatus: "good",
            cause: "쿨링커버는 최근 프로모션 영향으로 상승, 쿨시트는 폴레드(40.5)·다이치(12.4) 대비 정체(상품)",
            action: "쿨시트 가격정책 변경에 따른 베이지 재고 소진 지속, 카카오 쟁쟁한특가 1+1 행사로 트래픽 견인", due: "6/30" },
          { title: "오가닉그라운드 — 경쟁사 트렌드", metric: "프랭클린에 검색량 역전당함 · 몽디에스가 30% 수준까지 추격", badge: "역전당함", badgeStatus: "bad",
            cause: "한여름 핵심 수요 상품(워시·수딩크림) 재고 부족으로 기획전 미끼상품·광고 셋팅 불가(상품)",
            action: "로션 검색 인증 이벤트(6/22) / 재고부족 역이용 카피 적용 / 무예산 정보성 콘텐츠 제작", due: "7/6" },
          { title: "바바디토 — 경쟁사 트렌드", metric: "자사 7일평균지수 3.2(-1.4) · 5개 브랜드 중 최하위", badge: "유지", badgeStatus: "warn",
            cause: "건조기시트 체험단 이후 검색량은 회복(2.3→3.2)했지만 위드바바 26기 콘텐츠가 상위노출로 전환되지 못함(콘텐츠)",
            action: "7월 시크릿링크·다음세일 바이럴로 평균 5 목표, 도비약사 공동구매 추이 점검", due: "8/3" },
          { title: "파미야 — 키워드 노출", metric: "캣타워·강아지쿨매트 등 핵심 키워드 상위20 미노출/하위권", badge: "미노출", badgeStatus: "bad",
            cause: "체험단·바이럴 콘텐츠 자체가 부족해 노출 경쟁에서 밀림(콘텐츠)",
            action: "캣타워 펫바우처 메타 소재 기획 · 무브스테이 7월 계획 · 쿨매트 광고 재개", due: "6/24" },
        ]),
      },
      {
        id: "02", title: "퍼포먼스 마케팅", target: "102,520,000원", actual: "23,328,580원 (사업팀매출)",
        rateLabel: "23.6%", rateNum: 23.6, status: "bad", note: "", actualNum: null,
        items: seedItems("02", [
          { title: "전체", metric: "ROAS 3,285% · 유입 7,426건 · 광고비 3,000,366원", badge: "미달", badgeStatus: "bad",
            cause: "침대가드·샤워필터 등 저단가 상품 위주로 트래픽은 확보했지만 객단가가 낮아 매출 볼륨이 목표에 못 미침(상품)",
            action: "임산부 손목보호대(9,900원 USP) 숏폼 소재 신규 집행, 고단가 제품으로 광고 예산 재배분" },
        ]),
      },
      {
        id: "03", title: "주력제품 광고매출", target: "45억", actual: "국내 24억 · 스킨케어 5.6억",
        rateLabel: "", rateNum: null, status: "warn", note: "세부 ROAS 항목별 상이 (71~82%, 일부 미산출)", actualNum: null,
        items: seedItems("03", [
          { title: "국내사업", metric: "목표 ROAS 850% · 실적 603%", badge: "71%", badgeStatus: "warn",
            cause: "더에르고X링크맘 트래픽 캠페인 위주로 전환 + 광고비 축소 → ROAS 산식상 낮게 잡힘. 효율 저하가 아닌 운영 전략 변화(비용구조)",
            action: "준데이 기획전에서 확인된 '예산축소→고의도유저 재편→CVR개선' 패턴을 타 캠페인에 적용" },
          { title: "오가닉그라운드", metric: "목표 ROAS 400% · 메타 327%(+41%) · 쇼핑검색 289%(-12%)", badge: "82%", badgeStatus: "warn",
            cause: "트래픽 캠페인(더에르고X링크맘) 중심 운영으로 메타는 개선, 네이버 쇼핑검색(선케어)은 시즌 하락(채널)",
            action: "7월 건조기시트/분유포트클리너 시크릿링크(7/1~31, 목표 1,500만) 메타소재 3개 신규", due: "7/1" },
          { title: "바바디토", metric: "목표 ROAS 300% · SAVE&GIFT 전환 18건(1,106,580원)", badge: "측정중", badgeStatus: "unk",
            cause: "", action: "", gap: "ROAS 목표 대비 비교수치 미기재" },
        ]),
      },
      {
        id: "04", title: "키워드 1페이지 노출", target: "핵심 키워드 1페이지 노출 3건 고정", actual: "브랜드별 혼재",
        rateLabel: "", rateNum: null, status: "warn", note: "14%~80% 혼재, 오가닉그라운드 데이터 누락", actualNum: null,
        items: seedItems("04", [
          { title: "꿈비-개발", metric: "핵심 키워드 7개 중 안정적 노출 1개(폴더매트)", badge: "14%", badgeStatus: "bad",
            cause: "메가인플루언서·서포터즈 콘텐츠가 폴더매트류에만 집중 배정되어 나머지 키워드는 체험단 자체가 없음(콘텐츠)",
            action: "미노출 5개 키워드(층간소음매트·아기매트·거실매트·유아매트·범퍼침대) 체험단 신규 배정, 범퍼침대 10위권 진입 작업" },
          { title: "꿈비-소싱&시즌제품", metric: "5개 핵심 키워드 중 4개 블로그·카페 상단 유지", badge: "80%", badgeStatus: "good",
            cause: "유모차통풍시트만 가이드라인 보강 전까지 블로그 콘텐츠 배정이 0건이었음(콘텐츠)",
            action: "썸머크루 가이드라인 보강 배포·실행 중 (지난주 0건→1건, 순차 증가 모니터링)" },
          { title: "오가닉그라운드", metric: "노출 데이터 공란", badge: "데이터없음", badgeStatus: "unk",
            cause: "", action: "오그맘 36기 선크림 선택 체험단 기획 → 노출 데이터 확보 예정", gap: "노출현황 데이터 미수집" },
          { title: "바바디토", metric: "건조기시트만 노출(6건), 나머지 대부분 미노출/하위", badge: "부분노출", badgeStatus: "warn",
            cause: "세제·세탁세제·섬유유연제군은 체험단이 7~8월 시즌에 맞춰 기획 중이라 현재 콘텐츠 공급이 없음(콘텐츠)",
            action: "7월 아기주방 50인 체험단, 8월 세탁세제&섬유유연제 체험단, 건조기시트 100인 체험단 노출 확인", due: "7/1" },
        ]),
      },
      {
        id: "05", title: "신규유입", target: "120만 (누적)", actual: "이주 25,251명 (꿈비 22,037 + 오가닉 3,214)",
        rateLabel: "", rateNum: null, status: "warn", note: "양 브랜드 전주대비 동반 하락", actualNum: null,
        items: seedItems("05", [
          { title: "꿈비", metric: "자사몰 -18.4% · 스토어 -3.6%", badge: "하락", badgeStatus: "bad",
            cause: "광고비 축소 및 6월 행사 종료로 트래픽 감소(비용구조)",
            action: "7월 기획전 광고(메타·바이럴) 7/1부터 재개해 전체 유입 반등", due: "7/1" },
          { title: "오가닉그라운드", metric: "자사몰 -40.3% · 스토어 -24.3%", badge: "하락", badgeStatus: "bad",
            cause: "플친 이벤트 진행에도 '추가 구매 부담' 심리로 오히려 감소(상품)",
            action: "7월 한 달 회원가입 15%쿠폰·전구매 7%쿠폰·가입특가 SNS 홍보 (메타광고는 예산 이슈로 미집행)", due: "7/1" },
        ]),
      },
      {
        id: "06", title: "계열사 시너지", target: "5만 명", actual: "0명",
        rateLabel: "0%", rateNum: 0, status: "bad", note: "", actualNum: null,
        items: seedItems("06", [
          { title: "에르모어 / 가이아 → 꿈비", metric: "이번 주 신규 0명 · 누적 0명", badge: "미달", badgeStatus: "bad",
            cause: "실질적으로 작동하는 업무 협업 방식(트래킹·전환 경로)이 설계되지 않음 — 캠페인명만 있고 유입 측정 체계 부재(채널)",
            action: "", gap: "시너지 경로별 트래킹 방법 설계 — 차주 실행안 미정" },
        ]),
      },
      {
        id: "07", title: "예산 효율", target: "매출 대비 6.5% 이내", actual: "7천만원 중반대 마감 예상",
        rateLabel: "", rateNum: null, status: "unk", note: "매출 대비 % 산출 필요", actualNum: null,
        items: seedItems("07", [
          { title: "전체", metric: "3주차 후반부터 감액 시작, 4주차 대폭 감액", badge: "산출필요", badgeStatus: "unk",
            cause: "월 누적 비율 관리 중이나 매출 대비 % 환산값 미기재(비용구조)",
            action: "", gap: "정확한 매출 대비 % 계산 후 다음 보고에 반영" },
        ]),
      },
      {
        id: "08", title: "AI 업무 절감", target: "연 300시간 (주당 약 5.8시간)", actual: "이번 주 약 4.5시간",
        rateLabel: "78%", rateNum: 78, status: "warn", note: "", actualNum: null,
        items: seedItems("08", [
          { title: "전체", metric: "오가닉콘텐츠기획·보도자료·주피미작성·체험단운영·트렌드분석 5건", badge: "유지", badgeStatus: "warn",
            cause: "클로드코워크 체험단 운영(3h→30m)이 절감 대부분을 견인, 나머지는 소규모 반복 업무(콘텐츠)",
            action: "절감 사례를 팀 전체 공유해 반복 가능한 업무(보도자료·트렌드분석)에 확대 적용" },
        ]),
      },
    ],
  };
}

// ══════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    if (searchParams.get("seed") === "true") {
      const seedReport = buildSeedReport();
      await kvSet(reportKey(seedReport.week), seedReport);
      await addWeekToList({ week: seedReport.week, label: seedReport.label, startDate: seedReport.startDate, endDate: seedReport.endDate });
      return NextResponse.json({ seeded: true, report: decorateReport(seedReport) });
    }

    const weeks = await getWeekList();
    const teamNames = await getTeamNames();
    let week = searchParams.get("week") || "";
    if (!week) week = weeks.length ? weeks[weeks.length - 1].week : "";

    if (!week) {
      return NextResponse.json({ week: "", report: null, weeks: [], teamNames });
    }

    let report = (await kvGet(reportKey(week))) as WeeklyReportData | null;
    if (!report) report = blankReport(week);
    report = fillMissingCategories(report);
    report = decorateReport(report);

    return NextResponse.json({ week, report, weeks, teamNames });
  } catch {
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "add_team_name") {
      const name = (body.name || "").trim();
      if (!name) return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
      const names = await getTeamNames();
      if (!names.includes(name)) names.push(name);
      await kvSet("weekly_report_team_names", names);
      return NextResponse.json({ success: true, teamNames: names });
    }

    if (action === "remove_team_name") {
      const name = body.name;
      const names = (await getTeamNames()).filter((n) => n !== name);
      await kvSet("weekly_report_team_names", names);
      return NextResponse.json({ success: true, teamNames: names });
    }

    const { week } = body;
    if (!week) return NextResponse.json({ error: "week가 필요합니다." }, { status: 400 });

    if (action === "new_week") {
      const { copyFrom, startDate, endDate, label } = body;
      let base: WeeklyReportData | null = null;
      if (copyFrom) base = (await kvGet(reportKey(copyFrom))) as WeeklyReportData | null;
      const categories: ReportCategory[] = CATEGORY_DEFS.map((def) => {
        const prev = base?.categories.find((c) => c.id === def.id);
        return {
          id: def.id, title: def.title,
          target: prev?.target ?? "", actual: "", rateLabel: "", rateNum: null,
          status: "unk", note: "", items: [], actualNum: null,
        };
      });
      const report: WeeklyReportData = {
        week, label: label ?? "", startDate: startDate ?? "", endDate: endDate ?? "",
        prevFeedback: "", categories,
      };
      await kvSet(reportKey(week), report);
      await addWeekToList({ week, label: report.label, startDate: report.startDate, endDate: report.endDate });
      const weeks = await getWeekList();
      return NextResponse.json({ success: true, report: decorateReport(report), weeks });
    }

    let report = (await kvGet(reportKey(week))) as WeeklyReportData | null;
    if (!report) report = blankReport(week);
    report = fillMissingCategories(report);

    if (action === "update_feedback") {
      report.prevFeedback = body.prevFeedback ?? "";
      await kvSet(reportKey(week), report);
      await addWeekToList({ week, label: report.label, startDate: report.startDate, endDate: report.endDate });
      return NextResponse.json({ success: true, report: decorateReport(report) });
    }

    if (action === "update_category") {
      const { categoryId, target, actual, rateLabel, rateNum, status, note, actualNum, updatedBy } = body;
      const cat = report.categories.find((c) => c.id === categoryId);
      if (!cat) return NextResponse.json({ error: "카테고리를 찾을 수 없습니다." }, { status: 400 });
      if (actualNum !== undefined) cat.actualNum = actualNum === null || actualNum === "" ? null : Number(actualNum);
      if (target !== undefined) cat.target = target;
      if (actual !== undefined) cat.actual = actual;
      if (rateLabel !== undefined) cat.rateLabel = rateLabel;
      if (rateNum !== undefined) cat.rateNum = rateNum === null || rateNum === "" ? null : Number(rateNum);
      if (status !== undefined) cat.status = status;
      if (note !== undefined) cat.note = note;
      cat.updatedBy = updatedBy ?? cat.updatedBy;
      cat.updatedAt = new Date().toISOString();
      await kvSet(reportKey(week), report);
      await addWeekToList({ week, label: report.label, startDate: report.startDate, endDate: report.endDate });
      return NextResponse.json({ success: true, report: decorateReport(report) });
    }

    if (action === "save_budget_rows") {
      const { categoryId, rows, updatedBy } = body;
      const cat = report.categories.find((c) => c.id === categoryId);
      if (!cat) return NextResponse.json({ error: "카테고리를 찾을 수 없습니다." }, { status: 400 });
      cat.budgetRows = (rows ?? []).map((r: { brand: string; revenue: number | null; cost: number | null }) => ({
        brand: r.brand, budget: 0, revenue: r.revenue, cost: r.cost,
      }));
      cat.updatedBy = updatedBy ?? cat.updatedBy;
      cat.updatedAt = new Date().toISOString();
      await kvSet(reportKey(week), report);
      await addWeekToList({ week, label: report.label, startDate: report.startDate, endDate: report.endDate });
      return NextResponse.json({ success: true, report: decorateReport(report) });
    }

    if (action === "save_items") {
      const { categoryId, items, updatedBy } = body;
      const cat = report.categories.find((c) => c.id === categoryId);
      if (!cat) return NextResponse.json({ error: "카테고리를 찾을 수 없습니다." }, { status: 400 });
      cat.items = items ?? [];
      cat.updatedBy = updatedBy ?? cat.updatedBy;
      cat.updatedAt = new Date().toISOString();
      await kvSet(reportKey(week), report);
      await addWeekToList({ week, label: report.label, startDate: report.startDate, endDate: report.endDate });
      return NextResponse.json({ success: true, report: decorateReport(report) });
    }

    if (action === "delete_week") {
      const list = await getWeekList();
      await kvSet("weekly_report_weeks", list.filter((w) => w.week !== week));
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "올바르지 않은 action입니다." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
