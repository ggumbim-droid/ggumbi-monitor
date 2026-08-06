// ══════════════════════════════════════════════════
//  검색 트렌드 수집기
//
//  경쟁사트렌드분석 시트의 Apps Script 웹앱에서 일별 트렌드 지수를 가져와
//  일단위 저장소에 넣습니다.
//
//  ▶ 웹앱 응답 형태 (?type=chart&period=3months)
//   { chart: [
//       { name: "폴더매트",
//         brands: ["꿈비", "알집매트", "크림하우스", ...],
//         data: [ { period: "2026-05-08", 꿈비: 14.2, 알집매트: 3.1 }, ... ] }
//   ] }
//
//  ▶ 중요한 성질
//   · 3개월 블록은 "일별", 3년 블록은 "주간"입니다. 여기선 일별만 씁니다.
//   · 지수는 절대값이 아니라 네이버 데이터랩이 0~100으로 정규화한 상대값입니다.
//     같은 카테고리 안에서 브랜드끼리 비교하는 용도이며,
//     카테고리가 다르면 숫자를 직접 비교하면 안 됩니다.
//   · 시트가 갱신되면 과거 값도 재정규화될 수 있어, 매번 덮어써서 최신 상태를 유지합니다.
// ══════════════════════════════════════════════════

import { METRICS, type DailyFact } from "@/lib/daily-store";
import { normalizeBrand, type Brand } from "@/lib/brands";
import {
  fetchDatalab,
  resolvePeriodRange,
  MAX_GROUPS,
  MAX_KEYWORDS_PER_GROUP,
} from "@/lib/naver-datalab";

const TREND_WEBAPP_URL = process.env.GOOGLE_TREND_WEBAPP_URL;

/**
 * 경쟁사 시트의 카테고리(제품군) → 우리 제품라인
 * 대시보드의 CATEGORY_TO_TREND_GID / BRAND_TREND_GROUPS 와 같은 기준으로 맞췄습니다.
 *
 * ※ "시공매트(1)"은 시트상 자사 브랜드가 꿈비지만, 대시보드에서는 봄봄슈슈비 카드에
 *   묶여 있어 기존 관행을 따랐습니다. 매출 귀속을 바꿔야 하면 여기만 수정하면 됩니다.
 */
export const CATEGORY_TO_LINE: Record<string, string> = {
  폴더매트: "꿈비리코코",
  범퍼침대: "꿈비리코코",
  매트: "꿈비리코코",

  "시공매트(1)": "봄봄슈슈비",
  "시공매트(2)": "봄봄슈슈비",
  클립매트: "봄봄슈슈비",

  젖병세척기: "꿈비육아",
  휴대용분유포트: "꿈비육아",
  분유쉐이커: "꿈비육아",
  이유식포트: "꿈비육아",
  유모차쿨시트: "꿈비육아",
  아기띠커버: "꿈비육아",
  쿨링커버: "꿈비육아",

  오가닉그라운드: "오가닉그라운드",
  "오가닉그라운드 시즌 제품": "오가닉그라운드",
  "오가닉그라운드 보습 제품": "오가닉그라운드",

  바바디토: "바바디토",

  강아지쿨매트: "파미야",
  고양이캣타워: "파미야",
  캣타워: "파미야",
};

interface ChartEntry {
  period: string;
  [brandName: string]: string | number;
}

interface ChartCategory {
  name: string;
  brands: string[];
  data: ChartEntry[];
}

export interface TrendCollectResult {
  facts: Omit<DailyFact, "date">[];
  /** 실제로는 fact마다 날짜가 달라 date를 포함한 별도 목록도 함께 반환 */
  dated: DailyFact[];
  categories: string[];
  skipped: string[];
  unmappedCategories: string[];
  dateRange: { from: string; to: string } | null;
  /** 문제 추적용 — 웹앱이 실제로 보낸 첫 행 원본 */
  rawSample: unknown;
  /** 카테고리별 소요 시간 (직접 수집일 때만) */
  timings?: { cat: string; ms: number; rows: number }[];
  /** 시간이 모자라 남긴 카테고리 */
  remaining?: string[];
}

/**
 * period 값을 YYYY-MM-DD 로 정규화합니다.
 *
 * 시트의 period 열은 텍스트가 아니라 "날짜 값"으로 저장돼 있어,
 * Apps Script가 String()으로 감싸면 아래처럼 긴 형태로 옵니다.
 *   "Thu May 08 2026 00:00:00 GMT+0900 (Korean Standard Time)"
 * 이미 "2026-05-08" 형태로 오는 경우도 있어 둘 다 받습니다.
 */
function toDateKey(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  // 한국 시간 기준 날짜로 맞춥니다 (UTC 변환 시 하루 밀리는 것 방지)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split("T")[0];
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * 웹앱에서 전체 카테고리의 트렌드를 한 번에 가져옵니다.
 *
 * period="3months" → 일별 (최근 3개월)
 * period="3years"  → 주간 (최근 3년)
 *
 * 두 구간은 각각 따로 정규화된 값이라 섞어 저장하면 안 됩니다.
 * 그래서 지표를 나눠서(trend_index / trend_index_weekly) 저장합니다.
 */
export async function fetchTrendChart(
  period: "3months" | "3years" = "3months"
): Promise<ChartCategory[]> {
  if (!TREND_WEBAPP_URL) {
    throw new Error("GOOGLE_TREND_WEBAPP_URL 환경변수가 설정되지 않았습니다.");
  }
  // cat 을 비우면 모든 카테고리 탭이 한 번에 돌아옵니다 (호출 1회로 끝)
  const url = `${TREND_WEBAPP_URL}?type=chart&period=${period}`;
  const res = await fetch(url, { redirect: "follow", cache: "no-store" });
  if (!res.ok) {
    throw new Error(`트렌드 웹앱 응답 실패 (HTTP ${res.status})`);
  }
  const data = await res.json();
  return Array.isArray(data?.chart) ? (data.chart as ChartCategory[]) : [];
}

/**
 * 차트 응답을 일단위 fact 목록으로 변환합니다.
 *
 * 자사 브랜드 행  → { brand, line, metric: trend_index, meta: { category } }
 * 경쟁사 행       → 같은 형태에 meta.competitor 가 추가됨
 *   → "우리 카테고리 안에서 경쟁사가 어떻게 움직였나"를 같은 축에서 조회할 수 있습니다.
 */
export function chartToFacts(
  chart: ChartCategory[],
  metric: string = METRICS.TREND_INDEX
): TrendCollectResult {
  const dated: DailyFact[] = [];
  const categories: string[] = [];
  const skipped: string[] = [];
  const unmappedCategories: string[] = [];
  let minDate = "";
  let maxDate = "";
  const rawSample =
    chart[0] && Array.isArray(chart[0].data)
      ? { name: chart[0].name, brands: chart[0].brands, firstRow: chart[0].data[0] }
      : null;

  for (const cat of chart) {
    const catName = String(cat?.name ?? "").trim();
    if (!catName || !Array.isArray(cat.data) || cat.data.length === 0) {
      if (catName) skipped.push(catName);
      continue;
    }

    const line = CATEGORY_TO_LINE[catName];
    if (!line) {
      // 매핑에 없는 카테고리는 버리지 않고 이름만 보고합니다 (매핑표 보강용)
      unmappedCategories.push(catName);
      continue;
    }
    const brand = normalizeBrand(line);
    if (!brand) {
      unmappedCategories.push(`${catName} → ${line}`);
      continue;
    }

    categories.push(catName);
    const brandNames = Array.isArray(cat.brands) ? cat.brands : [];

    for (const entry of cat.data) {
      const date = toDateKey(entry?.period);
      if (!date) continue;
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;

      for (const name of brandNames) {
        const value = toNumber(entry[name]);
        if (value === null) continue;

        // 시트의 계열(series) 이름은 카테고리에 따라 성격이 다릅니다.
        //  · "폴더매트" 탭 → 계열이 경쟁사 브랜드 (꿈비 / 알집매트 / 크림하우스…)
        //  · "매트" 탭     → 계열이 제품 유형 (폴더매트 / 롤매트 / 시공매트…)
        // 둘을 "경쟁사"로 뭉뚱그리면 잘못된 꼬리표가 붙으므로
        // 중립적으로 series 로 저장하고, 자사 브랜드로 인식되는 것만 own 표시를 답니다.
        const meta: Record<string, string | number> = {
          category: catName,
          series: name,
        };
        if (normalizeBrand(name) === brand) meta.own = 1;

        dated.push({
          date,
          brand: brand as Brand,
          line,
          metric,
          value,
          source: "trend_webapp",
          meta,
        });
      }
    }
  }

  return {
    facts: dated.map(({ date: _date, ...rest }) => rest),
    dated,
    categories,
    skipped,
    unmappedCategories,
    dateRange: minDate && maxDate ? { from: minDate, to: maxDate } : null,
    rawSample,
  };
}

// ══════════════════════════════════════════════════
//  ▶ 시트를 거치지 않는 직접 수집
//
//  기존 경로:  시트 → Apps Script(지수 계산) → 수집기 → 저장소 → 화면
//  새 경로:    시트(키워드만) → 수집기 → 네이버 데이터랩 → 저장소 → 화면
//
//  Apps Script가 지수를 계산해 시트에 적어두고 그걸 다시 읽어오던 왕복이
//  통째로 빠집니다. 키워드 목록은 팀에서 시트로 함께 관리하므로 시트가 원본으로 남습니다.
//
//  ※ 변환 로직(chartToFacts)은 건드리지 않았습니다.
//    같은 ChartCategory 형태로 맞춰 돌려주므로 저장 결과는 동일합니다.
// ══════════════════════════════════════════════════

/** 시트의 연관키워드 목록: 카테고리 → 브랜드 → 키워드[] */
type KeywordMap = Record<string, Record<string, string[]>>;

async function fetchKeywordMap(): Promise<KeywordMap> {
  if (!TREND_WEBAPP_URL) return {};
  try {
    // 키워드 목록만 읽는 가벼운 호출입니다 (지수 계산 없음).
    const res = await fetch(`${TREND_WEBAPP_URL}?type=keywords`, {
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) return {};
    const data = await res.json();
    const kw = data?.keywords;
    return kw && typeof kw === "object" ? (kw as KeywordMap) : {};
  } catch {
    return {};
  }
}

/** 동시 요청 수를 제한해 순차 실행합니다 (데이터랩 호출 제한 회피) */
async function pooled<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

export interface DirectFetchReport {
  chart: ChartCategory[];
  /** 브랜드가 5개를 넘어 잘린 카테고리 */
  truncated: string[];
  /** 조회에 실패한 카테고리 */
  failed: { cat: string; error: string }[];
  /** 카테고리별 소요 시간(ms) — 어디가 느린지 찾기 위한 것 */
  timings: { cat: string; ms: number; rows: number }[];
  /** 시간이 모자라 이번에 처리하지 못한 카테고리 */
  remaining: string[];
}

/**
 * 시트의 키워드로 데이터랩을 직접 조회합니다.
 *
 * 카테고리 하나당 호출 1회입니다. 카테고리가 18개면 하루 36회(3개월+3년)로,
 * 데이터랩 일일 한도(1,000회) 안에서 여유가 큽니다.
 */
export async function fetchTrendChartDirect(
  period: "3months" | "3years" = "3months",
  opts: { limit?: number; offset?: number; budgetMs?: number } = {}
): Promise<DirectFetchReport> {
  const map = await fetchKeywordMap();
  let cats = Object.keys(map);
  if (cats.length === 0) {
    throw new Error("시트에서 연관키워드를 읽지 못했습니다.");
  }

  // offset/limit으로 잘라서 나눠 처리할 수 있습니다.
  const offset = opts.offset ?? 0;
  const all = cats;
  cats = cats.slice(offset, opts.limit ? offset + opts.limit : undefined);

  // 남은 시간을 넘기면 더 시작하지 않고 중단합니다.
  // 통째로 실패해 아무것도 저장 못 하는 것보다, 일부라도 확실히 쌓는 게 낫습니다.
  const budgetMs = opts.budgetMs ?? 40_000;
  const startedAt = Date.now();

  const { startDate, endDate, timeUnit } = resolvePeriodRange(period);
  const truncated: string[] = [];
  const failed: { cat: string; error: string }[] = [];
  const timings: { cat: string; ms: number; rows: number }[] = [];
  const done = new Set<string>();

  const results = await pooled(cats, 3, async (cat) => {
    if (Date.now() - startedAt > budgetMs) return null; // 예산 초과 — 시작하지 않음

    const byBrand = map[cat] ?? {};
    let groups = Object.entries(byBrand)
      .map(([groupName, keywords]) => ({
        groupName,
        keywords: (keywords ?? []).slice(0, MAX_KEYWORDS_PER_GROUP),
      }))
      .filter((g) => g.keywords.length > 0);

    if (groups.length === 0) { done.add(cat); return null; }

    // 데이터랩은 한 번에 5개 그룹까지만 비교합니다.
    if (groups.length > MAX_GROUPS) {
      truncated.push(`${cat}(${groups.length}→${MAX_GROUPS})`);
      groups = groups.slice(0, MAX_GROUPS);
    }

    const t0 = Date.now();
    try {
      const { rows, series } = await fetchDatalab({ startDate, endDate, timeUnit, groups });
      timings.push({ cat, ms: Date.now() - t0, rows: rows.length });
      done.add(cat);
      if (rows.length === 0) return null;
      return {
        name: cat,
        brands: series,
        data: rows.map((r) => {
          const { date, ...rest } = r;
          return { period: String(date), ...rest } as ChartEntry;
        }),
      } as ChartCategory;
    } catch (e) {
      timings.push({ cat, ms: Date.now() - t0, rows: -1 });
      failed.push({ cat, error: e instanceof Error ? e.message : String(e) });
      done.add(cat);
      return null;
    }
  });

  return {
    chart: results.filter((r): r is ChartCategory => r !== null),
    truncated,
    failed,
    timings: timings.sort((a, b) => b.ms - a.ms),
    remaining: all.filter((c) => !done.has(c)),
  };
}

/** 일별(3개월) 트렌드 수집 */
export async function collectTrend(
  opts: { limit?: number; offset?: number; budgetMs?: number } = {}
): Promise<TrendCollectResult> {
  return collectWith("3months", METRICS.TREND_INDEX, opts);
}

/**
 * 직접 수집을 먼저 시도하고, 실패하면 기존 웹앱 경로로 되돌립니다.
 * 새 경로에 문제가 생겨도 수집이 통째로 멈추지는 않게 하기 위한 안전장치입니다.
 */
async function collectWith(
  period: "3months" | "3years",
  metric: string,
  opts: { limit?: number; offset?: number; budgetMs?: number } = {}
): Promise<TrendCollectResult> {
  try {
    const r = await fetchTrendChartDirect(period, opts);
    if (r.chart.length > 0) {
      const out = chartToFacts(r.chart, metric);
      if (r.truncated.length) out.unmappedCategories.push(`5개 초과로 잘림: ${r.truncated.join(", ")}`);
      if (r.failed.length) {
        out.skipped.push(...r.failed.map((f) => `${f.cat}(${f.error})`));
      }
      out.timings = r.timings;
      out.remaining = r.remaining;
      return out;
    }
  } catch (e) {
    // 아래 웹앱 경로로 계속 진행합니다.
    console.error("직접 수집 실패 — 기존 웹앱 경로로 전환:", e);
  }
  const chart = await fetchTrendChart(period);
  return chartToFacts(chart, metric);
}

/**
 * 주간(3년) 트렌드 수집.
 * 화면에서 "3년 추이"를 저장소에서 바로 읽기 위한 것으로,
 * 일별 지표와 기준점이 달라 별도 지표로 저장합니다.
 */
export async function collectTrendWeekly(
  opts: { limit?: number; offset?: number; budgetMs?: number } = {}
): Promise<TrendCollectResult> {
  return collectWith("3years", METRICS.TREND_INDEX_WEEKLY, opts);
}
