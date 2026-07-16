import { NextResponse } from "next/server";

const SHEET_WEBAPP_URL = process.env.GOOGLE_SHEET_WEBAPP_URL;
const SHEET_WEBAPP_TOKEN = process.env.GOOGLE_SHEET_WEBAPP_TOKEN;

// Apps Script(kpi1insight)가 내려주는 원본
interface Kpi1Payload {
  main?: Record<string, unknown>[];   // 주차|브랜드ID|구분|카테고리|진행업무|결과|달성률|잘된점|아쉬운점
  ig?: Record<string, unknown>[];      // 주차|브랜드ID|구분|콘텐츠명|조회|도달|팔로우|공유|댓글
  comp?: Record<string, unknown>[];    // 경쟁사 순위(자동연동) — 주차 없음(항상 최신)
}

// 화면(BrandInsights)이 기대하는 브랜드별 구조
interface CompRow { name: string; mine: boolean; period: string; idx: string; delta: string; pkDate: string; pk: string; state: string; }
interface CompBlock { cat: string; rows: CompRow[]; note: string; comment: string; }
interface IgContent { name: string; views: string; reach: string; follows: string; shares: string; comments: string; }
interface BrandData {
  comp: CompBlock[];
  rankNote: string; improvement: string;
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
// 주차 정규화: 공백 제거 후 비교 (예: "7월 2주차" == "7월2주차")
function normWeek(v: unknown): string {
  return s(v).replace(/\s+/g, "");
}
function rowsFor(arr: Record<string, unknown>[] | undefined, brandId: string, week: string): Record<string, unknown>[] {
  if (!Array.isArray(arr)) return [];
  const wk = normWeek(week);
  return arr.filter((r) => {
    if (s(r["브랜드ID"]) !== brandId) return false;
    if (!wk) return true;                    // week 미지정이면 전체
    return normWeek(r["주차"]) === wk;         // 주차 매칭
  });
}

function buildBrand(payload: Kpi1Payload, brandId: string, week: string): BrandData {
  const main = rowsFor(payload.main, brandId, week);
  const byGubun = (g: string) => main.filter((r) => s(r["구분"]) === g);

  // 경쟁사 순위(자동연동, comp): 주차 없음 → 브랜드만 필터, 카테고리별 묶기
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
  // 경쟁사코멘트(구분=경쟁사코멘트, 카테고리별): 주차 반영됨
  for (const r of byGubun("경쟁사코멘트")) {
    const cat = s(r["카테고리"]);
    const comment = s(r["진행업무"]); // 경쟁사코멘트는 진행업무 칸에 코멘트
    if (!cat || !comment) continue;
    if (!compMap.has(cat)) { compMap.set(cat, { cat, rows: [], note: "", comment: "" }); compOrder.push(cat); }
    compMap.get(cat)!.comment = comment;
  }
  const comp = compOrder.map((c) => compMap.get(c)!);

  // 자사코멘트(구분=자사코멘트): 진행업무=순위관리코멘트, 결과=해결방안
  const selfRow = byGubun("자사코멘트")[0] ?? {};
  const rankNote = s(selfRow["진행업무"]);
  const improvement = s(selfRow["결과"]);

  // 지난주업무(구분=지난주업무): [진행업무, 결과, 달성률, 잘된점, 아쉬운점]
  const lastWork = byGubun("지난주업무").map((r) => [
    s(r["진행업무"]), s(r["결과"]), s(r["달성률"]), s(r["잘된점"]), s(r["아쉬운점"]),
  ]);

  // 금주업무(구분=금주업무): 진행업무=내용, 결과=목표, 달성률=세부내용
  const thisWeek = byGubun("금주업무").map((r) => [
    s(r["진행업무"]), s(r["결과"]), s(r["달성률"]),
  ]);

  // 인스타 요약(구분=요약): 콘텐츠명=업로드수, 조회=팔로우증감, 도달=잘된점, 팔로우=아쉬운점
  const igRows = rowsFor(payload.ig, brandId, week);
  const igSummary = igRows.filter((r) => s(r["구분"]) === "요약")[0] ?? {};
  const ig = {
    upload: s(igSummary["콘텐츠명"]),
    follow: s(igSummary["조회"]),
    good: s(igSummary["도달"]),
    bad: s(igSummary["팔로우"]),
  };
  // 인스타 콘텐츠(구분=콘텐츠)
  const igContents = igRows.filter((r) => s(r["구분"]) === "콘텐츠").map((r) => ({
    name: s(r["콘텐츠명"]), views: s(r["조회"]), reach: s(r["도달"]),
    follows: s(r["팔로우"]), shares: s(r["공유"]), comments: s(r["댓글"]),
  }));

  return { comp, rankNote, improvement, lastWork, thisWeek, ig, igContents };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get("week") || "";

  if (!SHEET_WEBAPP_URL || !SHEET_WEBAPP_TOKEN) {
    return NextResponse.json({ error: "구글시트 연동이 설정되지 않았습니다.", brands: {} }, { status: 200 });
  }
  try {
    const url = `${SHEET_WEBAPP_URL}?token=${encodeURIComponent(SHEET_WEBAPP_TOKEN)}&action=kpi1insight`;
    const res = await fetch(url, { cache: "no-store" });
    const payload = (await res.json()) as Kpi1Payload & { error?: string };
    if (payload.error) {
      return NextResponse.json({ error: `구글시트 오류: ${payload.error}`, brands: {} }, { status: 200 });
    }
    const brands: Record<string, BrandData> = {};
    for (const bid of BRAND_IDS) {
      brands[bid] = buildBrand(payload, bid, week);
    }
    return NextResponse.json({ brands, week }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "조회 오류";
    return NextResponse.json({ error: msg, brands: {} }, { status: 200 });
  }
}
