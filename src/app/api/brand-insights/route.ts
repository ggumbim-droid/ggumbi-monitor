import { NextResponse } from "next/server";

const SHEET_WEBAPP_URL = process.env.GOOGLE_SHEET_WEBAPP_URL;
const SHEET_WEBAPP_TOKEN = process.env.GOOGLE_SHEET_WEBAPP_TOKEN;

// Apps Script가 내려주는 원본(시트 행 객체 배열)
interface SheetPayload {
  comp?: Record<string, unknown>[];
  comment?: Record<string, unknown>[];
  supporters?: Record<string, unknown>[];
  lastwork?: Record<string, unknown>[];
  thisweek?: Record<string, unknown>[];
  igSummary?: Record<string, unknown>[];
  igContents?: Record<string, unknown>[];
}

// 화면(BrandInsights)이 기대하는 브랜드별 구조
interface CompRow { name: string; mine: boolean; period: string; idx: string; delta: string; pkDate: string; pk: string; state: string; }
interface CompBlock { cat: string; rows: CompRow[]; note: string; }
interface IgContent { name: string; views: string; reach: string; follows: string; shares: string; comments: string; }
interface BrandData {
  comp: CompBlock[];
  rankNote: string; improvement: string;
  supporters: string;
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
function rowsFor(arr: Record<string, unknown>[] | undefined, brandId: string): Record<string, unknown>[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter((r) => s(r["브랜드ID"]) === brandId);
}

function buildBrand(payload: SheetPayload, brandId: string): BrandData {
  // 경쟁사트렌드: 카테고리별로 묶기
  const compRows = rowsFor(payload.comp, brandId);
  const compMap = new Map<string, CompBlock>();
  const compOrder: string[] = [];
  for (const r of compRows) {
    const cat = s(r["카테고리"]);
    if (!cat) continue;
    if (!compMap.has(cat)) { compMap.set(cat, { cat, rows: [], note: "" }); compOrder.push(cat); }
    const block = compMap.get(cat)!;
    block.rows.push({
      name: s(r["이름"]),
      mine: truthy(r["자사여부"]),
      period: s(r["기간"]),
      idx: s(r["7일평균"]),
      delta: s(r["증감"]),
      pkDate: s(r["최고점날짜"]),
      pk: s(r["최고점"]),
      state: s(r["상태"]) || "flat",
    });
    if (!block.note && s(r["특이사항"])) block.note = s(r["특이사항"]);
  }
  const comp = compOrder.map((c) => compMap.get(c)!);

  // 자사코멘트: 브랜드당 1행
  const commentRow = rowsFor(payload.comment, brandId)[0] ?? {};
  const rankNote = s(commentRow["순위관리코멘트"]);
  const improvement = s(commentRow["해결방안"]);

  // 서포터즈: 브랜드당 1행
  const supRow = rowsFor(payload.supporters, brandId)[0] ?? {};
  const supporters = s(supRow["내용"]);

  // 지난주업무: [진행업무, 업무결과, 달성률, 잘된점, 아쉬운점]
  const lastWork = rowsFor(payload.lastwork, brandId).map((r) => [
    s(r["진행업무"]), s(r["업무결과"]), s(r["달성률"]), s(r["잘된점"]), s(r["아쉬운점"]),
  ]);

  // 금주업무: [내용, 목표, 세부내용]
  const thisWeek = rowsFor(payload.thisweek, brandId).map((r) => [
    s(r["내용"]), s(r["목표"]), s(r["세부내용"]),
  ]);

  // 인스타요약: 브랜드당 1행
  const igRow = rowsFor(payload.igSummary, brandId)[0] ?? {};
  const ig = {
    upload: s(igRow["업로드수"]),
    follow: s(igRow["팔로우증감"]),
    good: s(igRow["잘된점"]),
    bad: s(igRow["아쉬운점"]),
  };

  // 인스타콘텐츠
  const igContents = rowsFor(payload.igContents, brandId).map((r) => ({
    name: s(r["콘텐츠명"]), views: s(r["조회"]), reach: s(r["도달"]),
    follows: s(r["팔로우"]), shares: s(r["공유"]), comments: s(r["댓글"]),
  }));

  return { comp, rankNote, improvement, supporters, lastWork, thisWeek, ig, igContents };
}

export async function GET() {
  if (!SHEET_WEBAPP_URL || !SHEET_WEBAPP_TOKEN) {
    return NextResponse.json({ error: "구글시트 연동이 설정되지 않았습니다.", brands: {} }, { status: 200 });
  }
  try {
    const url = `${SHEET_WEBAPP_URL}?token=${encodeURIComponent(SHEET_WEBAPP_TOKEN)}&action=brandinsight`;
    const res = await fetch(url, { cache: "no-store" });
    const payload = (await res.json()) as SheetPayload & { error?: string };
    if (payload.error) {
      return NextResponse.json({ error: `구글시트 오류: ${payload.error}`, brands: {} }, { status: 200 });
    }
    const brands: Record<string, BrandData> = {};
    for (const bid of BRAND_IDS) {
      brands[bid] = buildBrand(payload, bid);
    }
    return NextResponse.json({ brands }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "조회 오류";
    return NextResponse.json({ error: msg, brands: {} }, { status: 200 });
  }
}
