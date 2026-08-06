// app/api/wonbu/ai/route.ts
//
// 원부사전 Claude 호출 — 서버 경유
//
// ▶ 왜 서버로 옮겼나
//   프로토타입은 브라우저에서 api.anthropic.com 을 직접 불렀습니다.
//   그건 클로드 아티팩트 안에서만 통하는 방식이고, 일반 웹페이지에서
//   같은 짓을 하려면 API 키를 브라우저로 내려보내야 합니다 —
//   즉 방문자 누구나 키를 꺼내 쓸 수 있게 됩니다.
//   그래서 호출은 서버에서만 일어나고, 화면은 이 라우트만 부릅니다.
//
// ▶ 프롬프트는 프로토타입 원문 그대로입니다.
//   네이버 공식 가이드 규칙을 담아 다듬어 놓은 자산이라 손대지 않았습니다.
//   문구를 바꾸면 생성 품질이 조용히 달라지므로, 수정은 의도적으로만 하세요.
//
//     POST /api/wonbu/ai
//       { mode: "analyze"  | "insight" | "generate", ... }

import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, createTextMessage, extractTextFromMessage } from "@/lib/anthropic";

interface AnalyzeBody {
  mode: "analyze";
  brand: string;
  lines: string[];
  ourKeywords: string[];
}

interface InsightBody {
  mode: "insight";
  brand: string;
  allRawNames: string[];
  allPatterns: string;
  allGapKeywords: string[];
  ourKeywords: string[];
}

interface GenerateBody {
  mode: "generate";
  brand: string;
  count: number;
  keywords: { term: string; volume: number }[];
  categories: string[];
  repOptions: string[];
  certs: string[];
  banned: string[];
  gapKeywords?: string[];
  benchPattern?: string;
}

type Body = AnalyzeBody | InsightBody | GenerateBody;

function buildAnalyzePrompt(b: AnalyzeBody): string {
  return `네이버쇼핑 SEO 관점에서 아래 경쟁사 상품명 목록을 분석해주세요.

경쟁사 상품명 목록:
${b.lines.map((l, i) => `${i + 1}. ${l}`).join("\n")}

우리 브랜드(${b.brand})가 이미 키워드 사전에 등록해둔 키워드:
${b.ourKeywords.join(", ") || "(등록된 키워드 없음)"}

분석 요청:
1. 경쟁사들이 상품명에 공통적으로 사용하는 핵심 키워드를 빈도순으로 추출
2. 상품명 구조 패턴 한 줄 요약 (예: "브랜드명 생략, 핵심키워드+소재+사이즈 순서로 평균 18자 내외 구성")
3. 위 공통 키워드 중 우리 브랜드 등록 키워드 목록에는 없는 "갭 키워드"만 추출 (경쟁사는 쓰는데 우리는 안 쓰는 키워드)

반드시 아래 JSON 형식으로만 응답하세요:
{"topKeywords":["키워드1","키워드2"],"pattern":"구조 패턴 한 줄 요약","gapKeywords":["갭키워드1","갭키워드2"]}`;
}

function buildInsightPrompt(b: InsightBody): string {
  return `당신은 네이버쇼핑 공식 SEO 가이드(join.shopping.naver.com 상품검색SEO가이드)를 정확히 아는 전문가입니다.
아래는 브랜드 "${b.brand}"에 대해 여러 차례 수집한 경쟁사 상품명 벤치마킹 원본 데이터와, 회차별 분석에서 이미 도출된 패턴 요약입니다.

경쟁사 상품명 전체 원본 (누적, 총 ${b.allRawNames.length}건):
${b.allRawNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}

회차별 이미 도출된 패턴 요약:
${b.allPatterns}

지금까지 누적된 갭 키워드 (경쟁사는 쓰지만 우리 사전엔 없음):
${b.allGapKeywords.join(", ") || "없음"}

우리 브랜드가 이미 키워드 사전에 등록한 키워드:
${b.ourKeywords.join(", ") || "없음"}

네이버 공식 상품명 가이드 핵심 원칙: 브랜드는 맨 앞 배치 금지, 동의어 반복 금지(자동처리됨), 가격/혜택/홍보성 수식어 금지(가성비·최저가·사은품·MD추천·공식 등), 특수문자·전화번호·셀러코드·명품단어 금지, 대표옵션 1개만 포함, 최하위 카테고리 기준 적합도 판단.

요청:
1. 위 경쟁사 상품명 전체를 관통하는 규칙성을 2~4개 문장으로 종합하세요 (개별 회차 요약의 단순 나열이 아니라, 누적 데이터 전체를 다시 본 종합 인사이트여야 합니다).
2. 그 규칙성 각각이 네이버 공식 가이드의 어떤 원칙과 부합하거나 상충하는지 짚어주세요 (예: 경쟁사들이 실제로는 브랜드를 거의 안 쓴다 → 가이드 원칙 4번과 일치).
3. 위 종합을 바탕으로 우리 브랜드가 따라야 할 "상품명 작성 템플릿"을 하나의 구조 문자열로 제시하세요 (예: [핵심키워드1] [소재/기능] [대표옵션] [인증표기]).
4. 실제 적용 예시 상품명을 1개 만들어 템플릿이 어떻게 적용되는지 보여주세요.

반드시 아래 JSON 형식으로만 응답하세요:
{"summary":"규칙성 종합 2~4문장","guideLinks":[{"finding":"발견한 규칙","principle":"연결되는 가이드 원칙"}],"template":"[핵심키워드] [소재/기능] [대표옵션] [인증]","example":"템플릿을 적용한 실제 예시 상품명"}`;
}

function buildGeneratePrompt(b: GenerateBody): string {
  const gapLine =
    b.gapKeywords && b.gapKeywords.length
      ? `\n경쟁사는 사용하지만 우리 사전에는 없는 갭 키워드 (검색량 정보가 없으므로 참고용으로만 활용, 무리하게 끼워넣지 말 것): ${b.gapKeywords.join(", ")}\n경쟁사 상품명 구조 패턴 참고: ${b.benchPattern ?? ""}\n`
      : "";

  return `당신은 네이버쇼핑 공식 SEO 가이드(join.shopping.naver.com 상품검색SEO가이드)를 정확히 숙지한 전문가입니다. 아래 키워드 목록(브랜드: ${b.brand})을 바탕으로 상품명 후보 ${b.count}개를 만들어주세요. ${b.count}개는 서로 뚜렷하게 다른 키워드 조합/구조를 시도해서 다양성을 확보해주세요 (같은 키워드를 순서만 바꾼 후보를 반복해서 만들지 말 것).

키워드 목록 (키워드: 월검색량):
${b.keywords.map((k) => `- ${k.term}: ${k.volume}`).join("\n")}
${gapLine}
등록카테고리: ${b.categories.join(", ") || "미등록 (반드시 최하위 카테고리 기준으로 판단할 것)"}
대표옵션 후보 (색상/사이즈/용량 등, 상품명에 1개만 포함 권장): ${b.repOptions.join(", ") || "없음"}
필수 표기 (반드시 하나 이상 포함): ${b.certs.join(", ") || "없음"}
사용 금지 수식어/단어: ${b.banned.join(", ") || "없음"}

네이버쇼핑 공식 상품명 가이드 규칙 (반드시 전부 준수):
1. 상품명에는 브랜드/카테고리를 포함하되 간결하게. 브랜드·제조사·카테고리·모델명 등 상품에 적합한 정보만 기입하고, 관련 없는 브랜드명이나 다른 상품의 키워드는 절대 넣지 않는다.
2. 의미가 같거나 겹치는 동의어/유의어는 하나로 그룹핑하고, 그룹 내 검색량이 가장 높은 대표 키워드만 채택한다. 네이버는 동의어를 검색 시 자동으로 처리하므로 상품명에 동의어를 반복 기재하면 어뷰징으로 판정되어 오히려 불이익을 받는다 (예: "스마트폰 핸드폰 폰스트랩 분실방지 소매치기방지"는 금지, "스마트폰 스트랩 여행 도난방지"가 올바른 예).
3. 채택된 키워드는 검색량이 높은 순서대로 앞쪽에 배치한다.
4. 브랜드명은 상품명 맨 앞에 절대 배치하지 않는다. 브랜드는 별도 브랜드 필드에 정확히 등록되므로 상품명에 반드시 넣어야 하는 것은 아니며, 넣더라도 핵심 키워드보다 뒤쪽(중간 또는 끝)에 배치한다. "브랜드명 + 상품명" 순서로 시작하는 상품명은 이 가이드 위반이므로 절대 생성하지 않는다.
5. 가격/혜택/배송 관련 홍보문구는 절대 포함하지 않는다 (예: 최저가, 즉시할인, 특가, 가성비, 사은품, 증정, 품절임박, MD추천, 선착순, 신상품, A급, st, 공식, 모음, 정품 등 — 이런 단어는 모두 별도 필드에 넣는 것이지 상품명이 아니다).
6. 상품과 무관한 수식어·홍보성 표현(타겟 연령/성별 과다 표기, 이벤트성 표현 등)은 넣지 않는다.
7. 특수문자(★, !, ♥, ~ 등)는 사용하지 않는다. 전화번호, 셀러 고유 식별코드(예: IP01, ST, _ES)도 금지한다.
8. "명품", "고급" 등의 단어는 사용하지 않는다 (단, 실제 상품 모델명에 포함된 경우만 예외).
9. 대표옵션 후보가 있다면 그 중 가장 대표적인 옵션 1개만 상품명에 자연스럽게 포함한다 (여러 개를 나열하지 않는다).
10. 지나치게 길게 나열하지 말고 간결하게 작성한다 (정확한 글자수 제한은 없으나, 명확하고 충분한 정보를 담되 불필요한 키워드 반복은 피한다).
11. 상품이 고객에게 잘 보여지도록 정확하게 띄어쓰기를 한다 (띄어쓰기가 너무 없거나 불필요하게 많지 않도록).
12. 각 후보 상품명 옆에 왜 이 순서로 배치했는지, 어떤 가이드 원칙을 따랐는지 한 줄로 근거 설명을 추가한다.
13. 응답하기 전에 반드시 셀프 검증할 것: 생성한 3개 후보 중 브랜드명으로 시작하는 것이 하나라도 있다면 전부 다시 작성해서 브랜드가 맨 앞에 오지 않도록 고친다.

반드시 아래 JSON 형식으로만 응답하고, 다른 텍스트는 포함하지 마세요. candidates 배열에는 정확히 ${b.count}개의 항목이 있어야 합니다:
{"candidates":[{"name":"상품명1","reason":"근거"}, ... 총 ${b.count}개]}`;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 본문을 읽을 수 없습니다." }, { status: 400 });
  }

  let prompt: string;
  switch (body.mode) {
    case "analyze":
      if (!body.lines?.length) {
        return NextResponse.json({ error: "분석할 상품명이 없습니다." }, { status: 400 });
      }
      prompt = buildAnalyzePrompt(body);
      break;
    case "insight":
      prompt = buildInsightPrompt(body);
      break;
    case "generate":
      if (!body.keywords?.length) {
        return NextResponse.json({ error: "등록된 키워드가 없습니다." }, { status: 400 });
      }
      prompt = buildGeneratePrompt(body);
      break;
    default:
      return NextResponse.json({ error: "알 수 없는 mode 입니다." }, { status: 400 });
  }

  try {
    const client = getAnthropicClient();
    const message = await createTextMessage(client, prompt);
    const raw = extractTextFromMessage(message);

    // 모델이 ```json 펜스를 붙이는 경우가 있어 벗겨냅니다.
    const clean = raw.replace(/```json|```/g, "").trim();

    try {
      return NextResponse.json({ result: JSON.parse(clean) });
    } catch {
      // JSON이 아니면 원문을 돌려줘 화면에서 원인을 볼 수 있게 합니다.
      return NextResponse.json(
        { error: "응답을 JSON으로 해석하지 못했습니다.", raw: clean.slice(0, 500) },
        { status: 502 }
      );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
