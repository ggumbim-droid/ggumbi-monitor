// app/api/naver/shop-rank/route.ts
//
// ⚠️ 제공 중단 — 네이버 쇼핑 검색 오픈API 종료 (2026-08 확인)
//
// 이 라우트는 openapi.naver.com/v1/search/shop.json 을 호출했으나
// 해당 엔드포인트가 404(SE05, "존재하지 않는 검색 api")를 돌려줍니다.
// 같은 자격증명으로 블로그 검색은 정상 응답하므로 권한 문제가 아니라
// 엔드포인트 자체가 종료된 것입니다.
//
// 원래 코드를 그대로 두면 나중에 "왜 SE05가 나오지" 하고 같은 곳을
// 다시 파게 되므로, 원인을 명시한 응답으로 바꿔 둡니다.
//
// ▶ 대체 소스를 확보하면 이 파일에서 새 소스를 호출하도록 바꾸고
//   src/lib/naver-shopping.ts, src/lib/naver-ranking.ts 의
//   SHOP_SEARCH_AVAILABLE 플래그도 함께 true 로 되돌리면 됩니다.

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      error: 'shop search api discontinued',
      detail:
        '네이버 쇼핑 검색 오픈API(openapi.naver.com/v1/search/shop.json)가 종료되어 상위노출 자동 조회를 제공하지 않습니다.',
      checkedAt: '2026-08-06',
      workaround: '네이버쇼핑에서 직접 검색한 상품명을 원부사전 화면에 붙여넣어 분석하세요.',
    },
    { status: 503 }
  );
}
