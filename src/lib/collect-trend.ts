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

/** 웹앱에서 전체 카테고리의 일별 트렌드를 한 번에 가져옵니다 */
export async function fetchTrendChart(): Promise<ChartCategory[]> {
  if (!TREND_WEBAPP_URL) {
    throw new Error("GOOGLE_TREND_WEBAPP_URL 환경변수가 설정되지 않았습니다.");
  }
  // cat 을 비우면 모든 카테고리 탭이 한 번에 돌아옵니다 (호출 1회로 끝)
  const url = `${TREND_WEBAPP_URL}?type=chart&period=3months`;
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
export function chartToFacts(chart: ChartCategory[]): TrendCollectResult {
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

        // 이 카테고리의 자사 브랜드인지 판단
        const asOwn = normalizeBrand(name);
        const isOwn = asOwn === brand;

        const meta: Record<string, string | number> = { category: catName };
        if (!isOwn) meta.competitor = name;

        dated.push({
          date,
          brand: brand as Brand,
          line,
          metric: METRICS.TREND_INDEX,
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

/** 수집 전체 실행 — 가져오기 + 변환 */
export async function collectTrend(): Promise<TrendCollectResult> {
  const chart = await fetchTrendChart();
  return chartToFacts(chart);
}
