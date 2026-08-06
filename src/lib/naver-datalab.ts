// ══════════════════════════════════════════════════
//  네이버 데이터랩 (검색어트렌드) 호출
//
//  지금까지 트렌드 지수는 Apps Script 안에서만 계산됐습니다.
//  화면에서 키워드를 고친 뒤 "그 자리에서 다시 조회"하려면
//  앱이 데이터랩을 직접 부를 수 있어야 해서 이 파일을 만듭니다.
//
//  ▶ 자격증명은 기존 검색 API와 동일합니다 (NAVER_CLIENT_ID / SECRET).
//    단, 네이버 개발자센터에서 해당 애플리케이션에
//    "데이터랩(검색어트렌드)" API 사용이 켜져 있어야 합니다.
//
//  ▶ 반환되는 ratio(지수)는 조회 기간 내 최대값을 100으로 둔 상대값입니다.
//    기간을 바꾸면 같은 날짜라도 숫자가 달라집니다. 절대 검색량이 아닙니다.
// ══════════════════════════════════════════════════

const DATALAB_URL = "https://openapi.naver.com/v1/datalab/search";

// 네이버가 정한 상한 — 넘기면 요청 자체가 거절됩니다.
export const MAX_GROUPS = 5;
export const MAX_KEYWORDS_PER_GROUP = 20;

export type TimeUnit = "date" | "week" | "month";

export interface KeywordGroup {
  /** 화면에 표시될 이름 (보통 브랜드명) */
  groupName: string;
  keywords: string[];
}

export interface DatalabPoint {
  period: string;
  ratio: number;
}

export interface DatalabSeries {
  title: string;
  data: DatalabPoint[];
}

/** 차트에 바로 꽂는 형태: { date, 브랜드A: 12.3, 브랜드B: 45.6 } */
export type ChartRow = Record<string, string | number>;

export interface DatalabResult {
  rows: ChartRow[];
  series: string[];
}

export class DatalabError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "DatalabError";
  }
}

/**
 * 요청 전에 걸러냅니다.
 * 네이버는 상한을 넘기면 이유를 알기 어려운 오류를 주기 때문에,
 * 화면에 그대로 보여줄 수 있는 한국어 메시지로 먼저 잡습니다.
 */
export function validateGroups(groups: KeywordGroup[]): string | null {
  const cleaned = groups.filter((g) => g.keywords.length > 0);

  if (cleaned.length === 0) {
    return "키워드가 하나도 없습니다.";
  }
  if (cleaned.length > MAX_GROUPS) {
    return `브랜드는 최대 ${MAX_GROUPS}개까지 비교할 수 있습니다. (현재 ${cleaned.length}개)`;
  }
  for (const g of cleaned) {
    if (g.keywords.length > MAX_KEYWORDS_PER_GROUP) {
      return `'${g.groupName}'의 키워드가 ${g.keywords.length}개입니다. 최대 ${MAX_KEYWORDS_PER_GROUP}개까지만 됩니다.`;
    }
  }
  return null;
}

/** 키워드 정리 — 공백 제거, 빈 값·중복 삭제 */
export function normalizeGroups(groups: KeywordGroup[]): KeywordGroup[] {
  return groups.map((g) => ({
    groupName: String(g.groupName ?? "").trim(),
    keywords: Array.from(
      new Set(
        (g.keywords ?? [])
          .map((k) => String(k ?? "").trim())
          .filter((k) => k.length > 0)
      )
    ),
  }));
}

export async function fetchDatalab(opts: {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  timeUnit: TimeUnit;
  groups: KeywordGroup[];
}): Promise<DatalabResult> {
  const clientId = process.env.NAVER_CLIENT_ID?.trim();
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new DatalabError(
      "NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 환경변수가 설정되지 않았습니다."
    );
  }

  const groups = normalizeGroups(opts.groups).filter((g) => g.keywords.length > 0);
  const invalid = validateGroups(groups);
  if (invalid) throw new DatalabError(invalid);

  const res = await fetch(DATALAB_URL, {
    method: "POST",
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate: opts.startDate,
      endDate: opts.endDate,
      timeUnit: opts.timeUnit,
      keywordGroups: groups.map((g) => ({
        groupName: g.groupName,
        keywords: g.keywords,
      })),
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // 데이터랩 API가 애플리케이션에 열려 있지 않으면 여기서 걸립니다.
    // 그냥 "실패"라고만 하면 원인을 찾기 어려워서 안내를 붙입니다.
    if (res.status === 401 || res.status === 403) {
      throw new DatalabError(
        "데이터랩 호출이 거부됐습니다. 네이버 개발자센터에서 해당 애플리케이션에 '데이터랩(검색어트렌드)' API 사용이 켜져 있는지 확인해주세요.",
        res.status
      );
    }
    throw new DatalabError(
      `데이터랩 응답 실패 (HTTP ${res.status}) ${body.slice(0, 200)}`,
      res.status
    );
  }

  const data = (await res.json()) as { results?: DatalabSeries[] };
  const results = Array.isArray(data.results) ? data.results : [];

  // 날짜별로 브랜드 값을 한 줄에 모읍니다 (차트가 기대하는 형태)
  const byDate = new Map<string, ChartRow>();
  const series: string[] = [];

  for (const r of results) {
    const title = String(r.title ?? "");
    if (title && !series.includes(title)) series.push(title);
    for (const p of r.data ?? []) {
      const date = String(p.period ?? "");
      if (!date) continue;
      if (!byDate.has(date)) byDate.set(date, { date });
      byDate.get(date)![title] = p.ratio;
    }
  }

  const rows = Array.from(byDate.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );

  return { rows, series };
}
