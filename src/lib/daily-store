// ══════════════════════════════════════════════════
//  일단위 통합 저장소 (Daily Fact Store)
//
//  ▶ 왜 이 구조인가
//   지금까지는 "조회 버튼을 누른 그 순간의 값"만 화면에 떴다가 사라졌습니다.
//   여기서는 매일 수집한 값을 하루 단위로 쌓아두고, 화면은 저장된 걸 읽기만 합니다.
//   그 결과 ① 클릭 없이 바로 보이고 ② 시계열이 자동으로 쌓입니다.
//
//  ▶ 스키마 — 모든 지표를 한 줄짜리 사실(fact)로 통일
//     날짜 | 브랜드 | 채널 | 지표 | 값
//   마케팅 지표든 사업팀 매출이든 전부 이 한 형태로 들어옵니다.
//   같은 형태이기 때문에 "트렌드가 오른 날 매출도 올랐나"를 겹쳐볼 수 있습니다.
//
//  ▶ 저장 방식
//   KV에 `daily:YYYY-MM-DD` 키 하나당 그날의 fact 배열을 통째로 넣습니다.
//   30일치 조회 = 키 30개 읽기. 하루치 갱신 = 키 1개 쓰기.
// ══════════════════════════════════════════════════

import { kvGet, kvGetMany, kvSet } from "@/lib/kv";
import { normalizeBrand, type Brand } from "@/lib/brands";

/** 지표 종류. 새 지표를 추가할 때 여기에 등록합니다. */
export const METRICS = {
  SEARCH_VOLUME: "search_volume", // 네이버 검색량
  TREND_INDEX: "trend_index", // 검색 트렌드 지수 (0~100)
  SHOP_RANK: "shop_rank", // 쇼핑 노출 순위 (낮을수록 좋음)
  AD_SPEND: "ad_spend", // 광고 집행비
  AD_REVENUE: "ad_revenue", // 광고 매출
  ROAS: "roas", // 광고 수익률
  REVENUE: "revenue", // 사업팀 매출 ★ 연계 축
  ORDERS: "orders", // 주문 건수
  MENTIONS: "mentions", // 카페·블로그 언급량
} as const;

export type MetricKey = (typeof METRICS)[keyof typeof METRICS];

/** 값이 클수록 좋은 지표인지 (순위는 반대) */
export function isHigherBetter(metric: string): boolean {
  return metric !== METRICS.SHOP_RANK;
}

/** 저장 단위 — 한 줄짜리 사실 */
export interface DailyFact {
  date: string; // "2026-08-05"
  brand: Brand; // 기준 브랜드 (brands.ts 기준)
  line?: string; // 제품라인 (꿈비리코코 등). 없으면 브랜드 전체
  channel?: string; // 스마트스토어 / 쿠팡 / 메타 등
  metric: MetricKey | string;
  value: number | null;
  source: string; // naver_api / meta_api / sheet / business_team
  meta?: Record<string, string | number>; // 키워드명, 상품명 등 부가정보
}

const DAY_KEY = (date: string) => `daily:${date}`;
const INDEX_KEY = "daily:index"; // 데이터가 존재하는 날짜 목록

// ── 날짜 유틸 ─────────────────────────────────────

/** 한국 시간 기준 오늘 (Vercel은 UTC로 돌기 때문에 반드시 보정이 필요) */
export function todayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split("T")[0];
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

/** start~end 사이의 모든 날짜 (양끝 포함) */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard < 1000) {
    out.push(cur);
    cur = shiftDate(cur, 1);
    guard++;
  }
  return out;
}

function isValidDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

// ── 읽기 ─────────────────────────────────────────

export async function getDay(date: string): Promise<DailyFact[]> {
  const facts = await kvGet<DailyFact[]>(DAY_KEY(date));
  return Array.isArray(facts) ? facts : [];
}

export async function getRange(
  start: string,
  end: string
): Promise<DailyFact[]> {
  const dates = dateRange(start, end);
  const keys = dates.map(DAY_KEY);
  const map = await kvGetMany<DailyFact[]>(keys);
  const out: DailyFact[] = [];
  for (const key of keys) {
    const facts = map[key];
    if (Array.isArray(facts)) out.push(...facts);
  }
  return out;
}

/** 최근 N일치 */
export async function getRecent(days: number): Promise<DailyFact[]> {
  const end = todayKST();
  const start = shiftDate(end, -(days - 1));
  return getRange(start, end);
}

/** 데이터가 존재하는 날짜 목록 */
export async function getIndex(): Promise<string[]> {
  const idx = await kvGet<string[]>(INDEX_KEY);
  return Array.isArray(idx) ? idx.sort() : [];
}

// ── 쓰기 ─────────────────────────────────────────

export interface WriteResult {
  ok: boolean;
  date: string;
  written: number; // 저장된 fact 수
  replaced: number; // 같은 키로 덮어쓴 수
  rejected: string[]; // 브랜드 정규화 실패 등으로 버려진 항목
}

/** 같은 (브랜드·라인·채널·지표·부가키)면 같은 사실로 보고 덮어씁니다 */
function factKey(f: DailyFact): string {
  const metaKey = f.meta ? JSON.stringify(f.meta) : "";
  return [f.brand, f.line ?? "", f.channel ?? "", f.metric, metaKey].join("|");
}

/**
 * 하루치 데이터를 저장합니다.
 * 이미 있는 날짜면 같은 키를 덮어쓰고 나머지는 보존합니다 (부분 갱신 가능).
 * → 취소·반품으로 어제 매출이 바뀌어도 그 항목만 갱신됩니다.
 */
export async function putFacts(
  date: string,
  incoming: Omit<DailyFact, "date">[]
): Promise<WriteResult> {
  const result: WriteResult = {
    ok: false,
    date,
    written: 0,
    replaced: 0,
    rejected: [],
  };
  if (!isValidDate(date)) {
    result.rejected.push(`잘못된 날짜 형식: ${date}`);
    return result;
  }

  const existing = await getDay(date);
  const byKey = new Map<string, DailyFact>();
  for (const f of existing) byKey.set(factKey(f), f);

  for (const raw of incoming) {
    const brand = normalizeBrand(String(raw.brand ?? ""));
    if (!brand) {
      result.rejected.push(`알 수 없는 브랜드: ${raw.brand}`);
      continue;
    }
    const fact: DailyFact = {
      ...raw,
      brand,
      date,
      value:
        raw.value === null || raw.value === undefined || Number.isNaN(Number(raw.value))
          ? null
          : Number(raw.value),
    };
    const key = factKey(fact);
    if (byKey.has(key)) result.replaced++;
    byKey.set(key, fact);
    result.written++;
  }

  const merged = [...byKey.values()];
  const saved = await kvSet(DAY_KEY(date), merged);
  if (!saved) return result;

  // 날짜 인덱스 갱신
  const idx = await getIndex();
  if (!idx.includes(date)) {
    await kvSet(INDEX_KEY, [...idx, date].sort());
  }

  result.ok = true;
  return result;
}

// ── 집계 ─────────────────────────────────────────

export interface SeriesPoint {
  date: string;
  value: number | null;
}

/** 특정 브랜드·지표의 일별 시계열. 같은 날 여러 건이면 합산(순위는 평균) */
export function toSeries(
  facts: DailyFact[],
  opts: { brand?: Brand; line?: string; metric: string; channel?: string }
): SeriesPoint[] {
  const buckets = new Map<string, number[]>();
  for (const f of facts) {
    if (f.metric !== opts.metric) continue;
    if (opts.brand && f.brand !== opts.brand) continue;
    if (opts.line && f.line !== opts.line) continue;
    if (opts.channel && f.channel !== opts.channel) continue;
    if (f.value === null) continue;
    const arr = buckets.get(f.date) ?? [];
    arr.push(f.value);
    buckets.set(f.date, arr);
  }
  const aggregate = opts.metric === METRICS.SHOP_RANK
    ? (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
    : (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  return [...buckets.entries()]
    .map(([date, arr]) => ({ date, value: Math.round(aggregate(arr) * 10) / 10 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** 두 지표를 같은 날짜축에 나란히 놓기 — 트렌드 vs 매출 비교용 */
export interface PairedPoint {
  date: string;
  a: number | null;
  b: number | null;
}

export function pairSeries(
  seriesA: SeriesPoint[],
  seriesB: SeriesPoint[]
): PairedPoint[] {
  const dates = new Set([
    ...seriesA.map((p) => p.date),
    ...seriesB.map((p) => p.date),
  ]);
  const mapA = new Map(seriesA.map((p) => [p.date, p.value]));
  const mapB = new Map(seriesB.map((p) => [p.date, p.value]));
  return [...dates]
    .sort()
    .map((date) => ({
      date,
      a: mapA.get(date) ?? null,
      b: mapB.get(date) ?? null,
    }));
}
