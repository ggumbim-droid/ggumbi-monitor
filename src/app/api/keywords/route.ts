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
  organic_ground: {
    label: "오가닉그라운드",
    brands: [
      {
        name: "오가닉그라운드",
        keywords: ["오가닉그라운드","오가닉그라운드선크림","오가닉그라운드선쿠션","오가닉그라운드고보습크림","오가닉그라운드크림","오가닉그라운드워시","오가닉그라운드탑투토워시","스쿠스쿠오일","오가닉그라운드오일","오가닉그라운드스쿠스쿠오일","캐터스수딩크림","오가닉그라운드수딩크림","오가닉그라운드수딩젤","스쿠스쿠로션","오가닉그라운드스쿠스쿠로션","오가닉그라운드로션","오가닉그라운드스틱밤","오가닉그라운드힙클렌저","오가닉그라운드엉덩이클렌저","오가닉그라운드트래블키트"],
      },
      {
        name: "오가본",
        keywords: ["오가본","오가본수분로션","오가본크림","오가본보습크림","오가본아기보습크림","오가본엉덩이클렌저","오가본샴푸앤바쓰","오가본샴푸앤바스","오가본워시","오가본멀티밤","오가본오일","오가본영양오일","오가본아기오일","오가본립밤","오가본샴푸","오가본선크림","오가본선쿠션","오가본수딩젤","오가본핸드크림"],
      },
      {
        name: "쁘리마쥬",
        keywords: ["쁘리마쥬","쁘리마쥬로션","쁘리마쥬크림","쁘리마쥬태열키트","쁘리마쥬태열세럼","쁘리마쥬보습크림","쁘리마쥬오일","쁘리마쥬태열","쁘리마쥬비누","쁘리마쥬세럼"],
      },
      {
        name: "몽디에스",
        keywords: ["몽디에스","몽디에스로션","몽디에스크림","몽디에스아토크림","몽디에스오일","몽디에스수딩젤","몽디에스스틱밤","몽디에스아토로션","몽디에스밤","몽디에스베이비로션"],
      },
    ],
  },
  babadito: {
    label: "바바디토",
    brands: [
      {
        name: "바바디토",
        keywords: ["바바디토","바바디토아기세제","바바디토젖병세제","바바디토젖병세정제","바바디토주방세제","바바디토식기세척기세제","바바디토식세기세제","바바디토건조기시트"],
      },
      {
        name: "프랭클린",
        keywords: ["프랭클린","프랭클린아기세제","프랭클린세탁세제","프랭클린섬유유연제","프랭클린젖병세제","프랭클린젖병세정제","프랭클린주방세제"],
      },
      {
        name: "레드루트",
        keywords: ["레드루트","레드루트아기세제","레드루트젖병세정제","레드루트주방세제","레드루트세탁세제","레드루트섬유유연제","레드루트비누","레드루트세탁비누","레드루트건조기시트","레드루트캡슐세제"],
      },
      {
        name: "아토팜",
        keywords: ["아토팜","아토팜아기세제","아토팜세탁세제","아토팜섬유유연제","아토팜주방세제","아토팜젖병세제","아토팜세탁세제리필","아토팜섬유유연제리필"],
      },
      {
        name: "블랑101",
        keywords: ["블랑101","블랑아기세제","블랑101아기세제","블랑젖병세제","블랑101젖병세제","블랑주방세제","블랑101주방세제","블랑101세탁세제","블랑101섬유유연제","블랑101식기세척기세제","블랑101캡슐세제","블랑섬유유연제","블랑세탁세제","블랑101건조기시트"],
      },
    ],
  },
  dog_coolmat: {
    label: "강아지쿨매트",
    brands: [
      {
        name: "파미야",
        keywords: ["파미야","파미야쿨매트","파미야강아지쿨매트","파미야아이스쿨매트","파미야고양이쿨매트"],
      },
      {
        name: "대리석아빠",
        keywords: ["대리석아빠","대리석아빠쿨매트","대리석아빠강아지쿨매트","대리석아빠고양이쿨매트"],
      },
      {
        name: "아르르",
        keywords: ["아르르쿨매트","아르르강아지쿨매트","아르르고양이쿨매트"],
      },
      {
        name: "페스룸",
        keywords: ["페스룸","페스룸쿨매트","페스룸강아지쿨매트","페스룸고양이쿨매트"],
      },
      {
        name: "디팡",
        keywords: ["디팡","디팡쿨매트","디팡강아지쿨매트","디팡고양이쿨매트"],
      },
    ],
  },
  cat_tower: {
    label: "고양이캣타워",
    brands: [
      {
        name: "캣타워",
        keywords: [],
      },
    ],
  },
  g7_coffee: {
    label: "G7커피",
    brands: [
      {
        name: "G7커피",
        keywords: ["베트남커피G7","G7믹스커피","G7블랙커피","커피G7","G7블랙커피","G7커피내수용","G73in1","G7퓨어블랙"],
      },
      {
        name: "맥심커피",
        keywords: ["맥심커피","맥심","맥심모카골드","맥심커피믹스","맥심모카골드마일드","맥심믹스커피"],
      },
      {
        name: "루카스나인",
        keywords: ["루카스나인","루카스나인라떼","루카스나인더블샷라떼","루카스나인아메리카노","루카스나인바닐라라떼"],
      },
      {
        name: "프렌치카페",
        keywords: ["프렌치카페","프렌치카페커피믹스","남양프렌치카페","남양프렌치카페커피믹스","프렌치까페","프렌치카페카페믹스"],
      },
      {
        name: "네스카페",
        keywords: ["네스카페","네스카페커피믹스","네스카페수프리모","돌체앤구스토"],
      },
      {
        name: "카누",
        keywords: ["카누","카누커피","카누아메리카노","카누다크로스트","카누다크로스트미니","카누미니마일드","카누라떼","카누마일드로스트"],
      },
    ],
  },
};

async function kvGet(key: string) {
  const res = await fetch(`${KV_REST_API_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` },
  });
  const data = await res.json();
  // Upstash REST API wraps value in { value: "..." }
  const raw = data.result ?? data.value ?? null;
  if (!raw) return null;
  // 이중 JSON 문자열 처리
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reset = searchParams.get("reset");
    if (reset === "true") {
      await kvSet("keyword_groups", DEFAULT_GROUPS);
      return NextResponse.json(DEFAULT_GROUPS);
    }
    const stored = await kvGet("keyword_groups");
    if (stored) return NextResponse.json(stored);
    await kvSet("keyword_groups", DEFAULT_GROUPS);
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
    const groups = stored ?? { ...DEFAULT_GROUPS };

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
      if (brand.keywords.includes(trimmed)) return NextResponse.json({ error: "이미 존재하는 키워드입니다." }, { status: 400 });
      if (brand.keywords.length >= 20) return NextResponse.json({ error: "키워드는 최대 20개까지 등록 가능합니다." }, { status: 400 });
      brand.keywords.push(trimmed);
    } else if (action === "delete") {
      brand.keywords = brand.keywords.filter((k: string) => k !== keyword);
    } else {
      return NextResponse.json({ error: "올바르지 않은 action입니다." }, { status: 400 });
    }

    await kvSet("keyword_groups", groups);
    return NextResponse.json(groups);
  } catch {
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
