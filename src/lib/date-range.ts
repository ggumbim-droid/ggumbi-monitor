import type { DateRangePreset, MonitorDateRange } from "@/types/monitor";

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** ISO 요일: 월=1 … 일=7 */
function isoDayOfWeek(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

/** 이번 주 월요일 00:00 */
function getThisWeekMonday(ref: Date): Date {
  const d = startOfDay(ref);
  d.setDate(d.getDate() - (isoDayOfWeek(d) - 1));
  return d;
}

/** 지난주 월요일~일요일 */
export function getLastWeekRange(ref: Date = new Date()): MonitorDateRange {
  const thisMonday = getThisWeekMonday(ref);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  return {
    startDate: toISODate(lastMonday),
    endDate: toISODate(lastSunday),
    preset: "last_week",
  };
}

/** 최근 14일 (어제 기준) */
export function getRecent2WeeksRange(ref: Date = new Date()): MonitorDateRange {
  const end = startOfDay(ref);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(end.getDate() - 13);
  return {
    startDate: toISODate(start),
    endDate: toISODate(end),
    preset: "recent_2_weeks",
  };
}

/** 이번 달 1일 ~ 오늘 */
export function getThisMonthRange(ref: Date = new Date()): MonitorDateRange {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  return {
    startDate: toISODate(start),
    endDate: toISODate(startOfDay(ref)),
    preset: "this_month",
  };
}

export function formatDateWithWeekday(iso: string): string {
  const date = parseISODate(iso);
  const weekday = WEEKDAY_KO[date.getDay()];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일(${weekday})`;
}

/** 예: 2026년 5월 11일(월) ~ 5월 17일(일) */
export function formatMonitorPeriodLabel(
  startDate: string,
  endDate: string
): string {
  const start = parseISODate(startDate);
  const end = parseISODate(endDate);
  const startWeekday = WEEKDAY_KO[start.getDay()];
  const endWeekday = WEEKDAY_KO[end.getDay()];

  const sameYear = start.getFullYear() === end.getFullYear();
  const startPart = `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일(${startWeekday})`;

  if (sameYear && start.getMonth() === end.getMonth()) {
    return `${startPart} ~ ${end.getDate()}일(${endWeekday})`;
  }

  const endPart = sameYear
    ? `${end.getMonth() + 1}월 ${end.getDate()}일(${endWeekday})`
    : `${end.getFullYear()}년 ${end.getMonth() + 1}월 ${end.getDate()}일(${endWeekday})`;

  return `${startPart} ~ ${endPart}`;
}

export function formatPeriodForPrompt(
  startDate: string,
  endDate: string
): string {
  const start = parseISODate(startDate);
  const end = parseISODate(endDate);
  return `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일 ~ ${end.getFullYear()}년 ${end.getMonth() + 1}월 ${end.getDate()}일`;
}

export function isValidDateRange(startDate: string, endDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return false;
  return parseISODate(startDate) <= parseISODate(endDate);
}

export function normalizeDateRange(raw: unknown): MonitorDateRange {
  if (
    raw &&
    typeof raw === "object" &&
    "startDate" in raw &&
    "endDate" in raw
  ) {
    const row = raw as Record<string, unknown>;
    const startDate =
      typeof row.startDate === "string" ? row.startDate.trim() : "";
    const endDate = typeof row.endDate === "string" ? row.endDate.trim() : "";
    if (isValidDateRange(startDate, endDate)) {
      const preset = normalizePreset(row.preset);
      return { startDate, endDate, preset };
    }
  }
  return getLastWeekRange();
}

function normalizePreset(raw: unknown): DateRangePreset | undefined {
  const valid: DateRangePreset[] = [
    "last_week",
    "recent_2_weeks",
    "this_month",
    "custom",
  ];
  return valid.includes(raw as DateRangePreset)
    ? (raw as DateRangePreset)
    : undefined;
}

export function getRangeForPreset(preset: DateRangePreset): MonitorDateRange {
  switch (preset) {
    case "last_week":
      return getLastWeekRange();
    case "recent_2_weeks":
      return getRecent2WeeksRange();
    case "this_month":
      return getThisMonthRange();
    case "custom":
    default:
      return { ...getLastWeekRange(), preset: "custom" };
  }
}
