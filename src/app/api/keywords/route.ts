import { NextRequest, NextResponse } from "next/server";

const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

const DEFAULT_GROUPS = {
  folder_mat: {
    label: "폴더매트",
    brands: [
      { name: "꿈비", keywords: ["더블원피스매트","꿈비더블원피스매트","트리플원피스매트","꿈비트리플원피스매트","자이언트매트","꿈비자이언트매트","클린롤매트","리코코클린롤매트","꿈비클린롤매트","꿈비폴더매트","꿈비복도매트","꿈비매트","리코코매트","리코코폴더매트","꿈비원피스매트"] },
      { name: "알집매트", keywords: ["알집폴더매트","알집더블제로매트","알집트리플제로매트","알집트윈매트","알집더블플립매트","알집에코실리온","알집매트더블제로매트","알집복도제로매트","에코실리온","알집매트커버"] },
      { name: "크림하우스", keywords: ["크림하우스폴더매트","크림하우스프리2","크림하우스프리2폴더매트","크림하우스프리2s","크림하우스프리2베이비룸","슬라이드프리","크림하우스슬라이드프리","크림하우스슬라이드프리와이드","프리그라운드2","크림하우스프리그라운드2","크림하우스맞춤매트"] },
      { name: "파크론", keywords: ["빅베어베베","파크론빅베어베베","베어베베","파크론베어베베","파크론베어베베논슬립","파크론베어베베클린","파크론폴더매트","파크론접이식매트"] },
      { name: "모노맷", keywords: ["모노맷매트","모노맷폴더매트","모노맷한판매트","모노맷클린매트","모노맷2단매트","모노맷모노핏","모노맷맞춤폴더매트","모노맷맞춤매트"] },
    ],
  },
  construction_mat: {
    label: "시공매트",
    brands: [
      { name: "꿈비", keywords: ["꿈비시공매트","꿈비매트시공","꿈비퍼즐매트","리코코퍼즐매트","꿈비시공퍼즐매트","리코코황변방지","리코코디자인tpu클립매트"] },
      { name: "알집매트", keywords: ["알집시공매트","알집거실시공","알집노블시공","알집tpu시공매트","알집tpu매트","알집tpu시공","알집매트시공비용"] },
      { name: "크림하우스", keywords: ["크림하우스시공매트","크림하우스시공","크림하우스퍼즐매트","크림하우스셀프시공"] },
      { name: "파크론", keywords: ["파크론시공","파크론매트시공","파크론시공매트","파크론제로블럭","파크론퍼즐매트","파크론셀프시공","파크론tpu","파크론tpu매트","제로블럭"] },
      { name: "봄봄매트", keywords: ["봄봄매트시공","봄봄시공매트","봄봄스킨텍스처","시공매트봄봄매트"] },
    ],
  },
  bumper_bed: {
    label: "범퍼침대/아기침대",
    brands: [
      { name: "꿈비", keywords: ["꿈비범퍼침대","꿈비아기침대","꿈비하이가드범퍼침대","꿈비범퍼침대대형","꿈비범퍼침대특대형","꿈비범퍼침대슈퍼특대형","꿈비범퍼침대매트","꿈비트윈스타","꿈비월드스타","꿈비럭키스타","꿈비럭키스타범퍼침대"] },
      { name: "도노도노", keywords: ["도노도노아기침대","도노도노범퍼침대","도노도노하이가드범퍼침대","도노도노패밀리범퍼침대","도노도노하이가드","도노도노범퍼침대가드","도노도노범퍼침대매트"] },
      { name: "코지스토리", keywords: ["코지스토리아기침대","코지스토리범퍼침대"] },
      { name: "바치", keywords: ["바치조이범퍼침대","바치포칠드런범퍼침대","바치범퍼침대특대형","바치범퍼침대가드","바치범퍼침대매트","바치물결범퍼침대"] },
      { name: "쥬다르", keywords: ["쥬다르범퍼침대","주다르범퍼침대","쥬다르범퍼침대밀크","쥬다르누보범퍼침대","주다르누보범퍼침대","쥬다르밀크티브라운범퍼침대","쥬다르크림범퍼침대","쥬다르점보범퍼침대"] },
    ],
  },
  bottle_washer: {
    label: "젖병세척기",
    brands: [
      { name: "꿈비", keywords: ["꿈비젖병세척기","꿈비세척기","꿈비젖병소독기","꿈비젖병세척소독기","uvpro"] },
      { name: "베이비브레짜", keywords: ["베이비브레짜젖병세척기","브레짜젖병세척기","베이비브레짜젖병세척소독기","브레짜젖병세척소독기","베이비브레짜세척기","브레짜세척기"] },
      { name: "소베맘", keywords: ["소베맘젖병세척기","소베맘세척기","소베맘젖병소독기","소베맘젖병세척소독기"] },
      { name: "오르테", keywords: ["오르테젖병세척기","오르테세척기","오르테젖병소독기","오르테젖병세척소독기"] },
      { name: "버들아이", keywords: ["버들아이젖병세척기","버들젖병세척기","버들젖병소독기","버들아이젖병소독기","버들아이세척기","버들세척기"] },
    ],
  },
  formula_pot: {
    label: "분유포트",
    brands: [
      { name: "꿈비", keywords: ["꿈비휴대용분유포트","꿈비보온병","꿈비외출용분유포트","꿈비휴대용포트","꿈비분유포트","꿈비무선분유포트","꿈비분리형휴대용분유포트","꿈비분리형분유포트","꿈비배터리분리형분유포트"] },
      { name: "나리몽", keywords: ["나리몽휴대용분유포트","나리몽분리형분유포트","나리몽보온병","나리몽외출용분유포트","나리몽휴대용포트","나리몽무선분유포트","나리몽분리형휴대용분유포트","나리몽분유포트","나리몽배터리분리형분유포트"] },
      { name: "보아르", keywords: ["보아르휴대용분유포트","보아르보온병","보아르외출용분유포트","보아르휴대용포트","보아르무선분유포트"] },
      { name: "해님", keywords: ["해님휴대용분유포트","해님보온병","해님외출용분유포트","해님휴대용포트","해님무선분유포트","해님분리형분유포트","해님분리형휴대용분유포트","해님분유포트"] },
      { name: "마베비", keywords: ["마베비휴대용분유포트","마베비분리형분유포트","마베비보온병","마베비외출용분유포트","마베비분유포트","마베비휴대용포트","마베비무선분유포트","마베비똑딱포트"] },
    ],
  },
  formula_shaker: {
    label: "분유쉐이커",
    brands: [
      { name: "꿈비", keywords: ["꿈비분유쉐이커","꿈비쉐이커","꿈비젖병쉐이커","꿈비분유제조기","꿈비분유믹서기"] },
      { name: "나리몽", keywords: ["나리몽분유쉐이커","나리몽쉐이커","나리몽젖병쉐이커","나리몽분유제조기","나리몽분유믹서기"] },
      { name: "보아르", keywords: ["보아르분유쉐이커","보아르쉐이커","보아르젖병쉐이커","보아르분유제조기","보아르분유믹서기"] },
      { name: "해님", keywords: ["해님분유쉐이커","해님쉐이커","해님젖병쉐이커","해님분유제조기","해님분유믹서기"] },
      { name: "워너홈", keywords: ["워너홈분유쉐이커","워너홈쉐이커","워너홈젖병쉐이커","워너홈분유제조기","워너홈분유믹서기"] },
    ],
  },
};

async function kvGet(key: string) {
  const res = await fetch(`${KV_REST_API_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` },
  });
  const data = await res.json();
  const raw = data.result ?? data.value ?? null;
  if (!raw) return null;
  // 이중 JSON 문자열인 경우 한 번 더 파싱
  if (typeof raw === "string") {
    try {
      const inner = JSON.parse(raw);
      if (typeof inner === "string") return inner;
      return raw;
    } catch {
      return raw;
    }
  }
  return JSON.stringify(raw);
}

async function kvSet(key: string, value: string) {
  await fetch(`${KV_REST_API_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_REST_API_TOKEN}`,
    },
  });
}

export async function GET() {
  try {
    const stored = await kvGet("keyword_groups");
    if (stored) {
      try {
        return NextResponse.json(JSON.parse(stored));
      } catch {
        // 파싱 실패시 기본값 반환
      }
    }
    await kvSet("keyword_groups", JSON.stringify(DEFAULT_GROUPS));
    return NextResponse.json(DEFAULT_GROUPS);
  } catch {
    return NextResponse.json(DEFAULT_GROUPS);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, groupId, brandName, keyword } = body;

    const stored = await kvGet("keyword_groups");
    const groups = stored ? JSON.parse(stored) : { ...DEFAULT_GROUPS };

    if (!groups[groupId]) {
      return NextResponse.json({ error: "그룹을 찾을 수 없습니다." }, { status: 400 });
    }

    const brand = groups[groupId].brands.find((b: { name: string }) => b.name === brandName);
    if (!brand) {
      return NextResponse.json({ error: "브랜드를 찾을 수 없습니다." }, { status: 400 });
    }

    if (action === "add") {
      const trimmed = keyword.trim();
      if (!trimmed) return NextResponse.json({ error: "키워드를 입력해 주세요." }, { status: 400 });
      if (brand.keywords.includes(trimmed)) {
        return NextResponse.json({ error: "이미 존재하는 키워드입니다." }, { status: 400 });
      }
      if (brand.keywords.length >= 20) {
        return NextResponse.json({ error: "키워드는 최대 20개까지 등록 가능합니다." }, { status: 400 });
      }
      brand.keywords.push(trimmed);
    } else if (action === "delete") {
      brand.keywords = brand.keywords.filter((k: string) => k !== keyword);
    } else {
      return NextResponse.json({ error: "올바르지 않은 action입니다." }, { status: 400 });
    }

    await kvSet("keyword_groups", JSON.stringify(groups));
    return NextResponse.json(groups);
  } catch {
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
