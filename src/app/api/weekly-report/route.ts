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

function blankCategory(def: { id: string; title: string }): ReportCategory {
  return {
    id: def.id, title: def.title,
    target: "", actual: "", rateLabel: "", rateNum: null,
    status: "unk", note: "", items: [],
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
  // 과거 버전(문자열 배열) 호환 처리
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
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
          status: "unk", note: "", items: [],
        };
      });
      const report: WeeklyReportData = {
        week, label: label ?? "", startDate: startDate ?? "", endDate: endDate ?? "",
        prevFeedback: "", categories,
      };
      await kvSet(reportKey(week), report);
      await addWeekToList({ week, label: report.label, startDate: report.startDate, endDate: report.endDate });
      const weeks = await getWeekList();
      return NextResponse.json({ success: true, report, weeks });
    }

    let report = (await kvGet(reportKey(week))) as WeeklyReportData | null;
    if (!report) report = blankReport(week);
    report = fillMissingCategories(report);

    if (action === "update_feedback") {
      report.prevFeedback = body.prevFeedback ?? "";
      await kvSet(reportKey(week), report);
      await addWeekToList({ week, label: report.label, startDate: report.startDate, endDate: report.endDate });
      return NextResponse.json({ success: true, report });
    }

    if (action === "update_category") {
      const { categoryId, target, actual, rateLabel, rateNum, status, note, updatedBy } = body;
      const cat = report.categories.find((c) => c.id === categoryId);
      if (!cat) return NextResponse.json({ error: "카테고리를 찾을 수 없습니다." }, { status: 400 });
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
      return NextResponse.json({ success: true, report });
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
      return NextResponse.json({ success: true, report });
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
