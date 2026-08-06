import { NextResponse } from "next/server";

const SHEET_WEBAPP_URL = process.env.GOOGLE_SHEET_WEBAPP_URL;
const SHEET_WEBAPP_TOKEN = process.env.GOOGLE_SHEET_WEBAPP_TOKEN;

// ── 성능 설정 ─────────────────────────────────────────
// 이 라우트가 화면 전체에서 가장 느립니다(실측 9.2초).
// Apps Script(kpi1insight) 응답을 기다리는 시간이 그대로 대기 시간이 됩니다.
export const maxDuration = 60;
export const preferredRegion = ["icn1"];

// 중요: 아래 웹앱 호출 URL에는 week가 들어가지 않습니다.
// 주차 필터링은 받아온 뒤 buildBrand에서 로컬로 하므로,
// 어느 주차를 보든 원본 요청은 완전히 동일합니다.
// → 한 번만 받아두면 모든 주차가 그 값을 재사용합니다.
const SHEET_TTL = 300;
const CDN_CACHE = "public, s-maxage=300, stale-while-revalidate=1800";
// ──────────────────────────────────────────────────────

// Apps Script(kpi1insight)가 내려주는 원본 — 4탭 + 경쟁사순위(자동)
interface Kpi1Payload {
  comp2?: Record<string, unknown>[];   // KPI1_경쟁사: 주차|브랜드ID|카테고리|코멘트
  self?: Record<string, unknown>[];    // KPI1_자사: 주차|브랜드ID|순위관리코멘트|해결방안
  work?: Record<string, unknown>[];    // KPI1_업무: 주차|브랜드ID|구분|진행업무|세부내용|목표|진행률|결과
  ig?: Record<string, unknown>[];      // KPI1_인스타: 주차|브랜드ID|구분|콘텐츠명|조회|도달|팔로우|공유|댓글
  comp?: Record<string, unknown>[];    // 경쟁사 순위(자동, 주차 없음)
}

// 화면(BrandInsights)이 기대하는 브랜드별 구조
interface CompRow { name: string; mine: boolean; period: string; idx: string; delta: string; pkDate: string; pk: string; state: string; }
interface CompBlock { cat: string; rows: CompRow[]; note: string; comment: string; }
interface IgContent { name: string; views: string; reach: string; follows: string; shares: string; comments: string; }
// 지난주업무: [진행업무, 세부내용, 진행률, 결과]  / 금주업무: [진행업무, 목표, 세부내용]
interface BrandData {
  comp: CompBlock[];
  rankNote: string; improvement: string;
  selfRows: { status: string; solution: string }[];
  lastWork: string[][]; thisWeek: string[][];
  ig: { upload: string; follow: string; good: string; bad: string };
  igContents: IgContent[];
}

const BRAND_IDS = ["꿈비리코코", "봄봄슈슈비", "꿈비육아", "오가닉그라운드", "바바디토", "파미야"];

function s(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}
function truthy(v: unknown): boolean {
  const t = s(v).toUpperCase();
  return t === "TRUE" || t === "Y" || t === "1" || t === "O";
}
// 주차 정규화: 날짜형이면 앞 10자(YYYY-MM-DD)만, 아니면 공백 제거
function normWeek(v: unknown): string {
  const raw = s(v);
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return raw.replace(/\s+/g, "");
}
function rowsFor(arr: Record<string, unknown>[] | undefined, brandId: string, week: string): Record<string, unknown>[] {
  if (!Array.isArray(arr)) return [];
  const wk = normWeek(week);
  return arr.filter((r) => {
    if (s(r["브랜드ID"]) !== brandId) return false;
    if (!wk) return true;
    return normWeek(r["주차"]) === wk;
  });
}

function buildBrand(payload: Kpi1Payload, brandId: string, week: string): BrandData {
  // 경쟁사 순위(자동, comp): 주차 없음 → 브랜드만 필터, 카테고리별 묶기
  const compMap = new Map<string, CompBlock>();
  const compOrder: string[] = [];
  const compRows = Array.isArray(payload.comp) ? payload.comp.filter((r) => s(r["브랜드ID"]) === brandId) : [];
  for (const r of compRows) {
    const cat = s(r["카테고리"]);
    if (!cat) continue;
    if (!compMap.has(cat)) { compMap.set(cat, { cat, rows: [], note: "", comment: "" }); compOrder.push(cat); }
    compMap.get(cat)!.rows.push({
      name: s(r["이름"]), mine: truthy(r["자사여부"]),
      period: s(r["기간"]), idx: s(r["7일평균"]), delta: s(r["증감"]),
      pkDate: s(r["최고점날짜"]), pk: s(r["최고점"]), state: s(r["상태"]) || "flat",
    });
  }
  // 경쟁사 코멘트(KPI1_경쟁사, 주차 반영): 카테고리별
  for (const r of rowsFor(payload.comp2, brandId, week)) {
    const cat = s(r["카테고리"]);
    const comment = s(r["코멘트"]);
    if (!cat || !comment) continue;
    if (!compMap.has(cat)) { compMap.set(cat, { cat, rows: [], note: "", comment: "" }); compOrder.push(cat); }
    compMap.get(cat)!.comment = comment;
  }
  const comp = compOrder.map((c) => compMap.get(c)!);

  // 자사(KPI1_자사): 현황/해결방안 여러 행 (1:1 매칭)
  const selfRowsRaw = rowsFor(payload.self, brandId, week);
  const selfRows = selfRowsRaw
    .map((r) => ({ status: s(r["현황"]), solution: s(r["해결방안"]) }))
    .filter((x) => x.status || x.solution);
  // 하위호환: 기존 rankNote/improvement는 첫 행 값으로 채움
  const rankNote = selfRows[0]?.status ?? "";
  const improvement = selfRows[0]?.solution ?? "";

  // 업무(KPI1_업무): 구분=지난주/금주
  const workRows = rowsFor(payload.work, brandId, week);
  // 지난주: [진행업무, 세부내용, 진행률, 결과]
  const lastWork = workRows.filter((r) => s(r["구분"]) === "지난주").map((r) => [
    s(r["진행업무"]), s(r["세부내용"]), s(r["진행률"]), s(r["결과"]),
  ]);
  // 금주: [진행업무, 목표, 세부내용]
  const thisWeek = workRows.filter((r) => s(r["구분"]) === "금주").map((r) => [
    s(r["진행업무"]), s(r["목표"]), s(r["세부내용"]),
  ]);

  // 인스타(KPI1_인스타): 구분=요약/콘텐츠
  const igRows = rowsFor(payload.ig, brandId, week);
  const igSummary = igRows.filter((r) => s(r["구분"]) === "요약")[0] ?? {};
  const ig = {
    upload: s(igSummary["콘텐츠명(요약시:업로드수)"]),  // 업로드수
    follow: s(igSummary["조회(요약시:팔로우증감)"]),     // 팔로우증감
    good: s(igSummary["도달(요약시:인사이트)"]),         // 인사이트
    bad: "",
  };
  const igContents = igRows.filter((r) => s(r["구분"]) === "콘텐츠").map((r) => ({
    name: s(r["콘텐츠명(요약시:업로드수)"]), views: s(r["조회(요약시:팔로우증감)"]), reach: s(r["도달(요약시:인사이트)"]),
    follows: s(r["팔로우"]), shares: s(r["공유"]), comments: s(r["댓글"]),
  }));

  return { comp, rankNote, improvement, selfRows, lastWork, thisWeek, ig, igContents };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get("week") || "";
  // 시트를 방금 고쳤을 때 즉시 반영하려면 ?fresh=1
  const fresh = searchParams.get("fresh") === "1";

  if (!SHEET_WEBAPP_URL || !SHEET_WEBAPP_TOKEN) {
    return NextResponse.json({ error: "구글시트 연동이 설정되지 않았습니다.", brands: {} }, { status: 200 });
  }
  try {
    const url = `${SHEET_WEBAPP_URL}?token=${encodeURIComponent(SHEET_WEBAPP_TOKEN)}&action=kpi1insight`;
    const res = await fetch(url, fresh ? { cache: "no-store" } : { next: { revalidate: SHEET_TTL } });
    const payload = (await res.json()) as Kpi1Payload & { error?: string };
    if (payload.error) {
      // 오류 응답은 캐시하지 않습니다 — 시트를 고쳐도 5분간 오류가 남으면 곤란합니다.
      return NextResponse.json({ error: `구글시트 오류: ${payload.error}`, brands: {} }, { status: 200 });
    }
    const brands: Record<string, BrandData> = {};
    for (const bid of BRAND_IDS) {
      brands[bid] = buildBrand(payload, bid, week);
    }
    return NextResponse.json(
      { brands, week },
      { status: 200, headers: { "Cache-Control": fresh ? "no-store" : CDN_CACHE } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "조회 오류";
    return NextResponse.json({ error: msg, brands: {} }, { status: 200 });
  }
}
