// app/api/naver/diag/route.ts
//
// 진단 전용 라우트 — 같은 자격증명(NAVER_CLIENT_ID/SECRET)으로
// 블로그 검색과 쇼핑 검색을 각각 한 번씩 호출해 응답을 나란히 보여줍니다.
//
// 판정 방법
//   blog ok:true  +  shop ok:false(SE05)  → 자격증명은 정상, 쇼핑 엔드포인트만 응답 안 함
//   blog ok:false +  shop ok:false        → 자격증명/앱 권한 문제
//   둘 다 ok:true                          → 정상 (shop-rank 재확인)
//
// 확인이 끝나면 이 파일은 삭제해도 됩니다. 비밀값은 응답에 포함하지 않습니다.

import { NextResponse } from 'next/server';

const TARGETS: Record<string, string> = {
  blog: 'https://openapi.naver.com/v1/search/blog.json',
  shop: 'https://openapi.naver.com/v1/search/shop.json',
};

interface ProbeResult {
  ok: boolean;
  status: number | null;
  errorCode?: string;
  errorMessage?: string;
  itemCount?: number;
  raw?: string;
}

async function probe(url: string, clientId: string, clientSecret: string): Promise<ProbeResult> {
  try {
    const res = await fetch(`${url}?query=${encodeURIComponent('아기베개')}&display=1`, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
      cache: 'no-store',
    });

    const text = await res.text();

    if (!res.ok) {
      let errorCode: string | undefined;
      let errorMessage: string | undefined;
      try {
        const parsed: { errorCode?: string; errorMessage?: string } = JSON.parse(text);
        errorCode = parsed.errorCode;
        errorMessage = parsed.errorMessage;
      } catch {
        // JSON이 아니면 원문 일부만 남깁니다.
      }
      return {
        ok: false,
        status: res.status,
        errorCode,
        errorMessage,
        raw: errorCode ? undefined : text.slice(0, 200),
      };
    }

    const data: { items?: unknown[] } = JSON.parse(text);
    return { ok: true, status: res.status, itemCount: (data.items ?? []).length };
  } catch (e) {
    return { ok: false, status: null, errorMessage: String(e) };
  }
}

export async function GET() {
  const clientId = process.env.NAVER_CLIENT_ID?.trim();
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET not configured' },
      { status: 500 }
    );
  }

  const entries = await Promise.all(
    Object.entries(TARGETS).map(async ([name, url]) => [name, await probe(url, clientId, clientSecret)] as const)
  );

  const results = Object.fromEntries(entries);

  let verdict: string;
  if (results.blog?.ok && results.shop?.ok) {
    verdict = '둘 다 정상 — shop-rank 라우트를 다시 확인하세요.';
  } else if (results.blog?.ok && !results.shop?.ok) {
    verdict = '자격증명은 정상. 쇼핑 검색 엔드포인트만 응답하지 않습니다.';
  } else if (!results.blog?.ok && !results.shop?.ok) {
    verdict = '검색 API 전체가 실패 — 자격증명 또는 앱 권한 문제입니다.';
  } else {
    verdict = '블로그만 실패 — 예상 밖 조합입니다.';
  }

  return NextResponse.json({
    clientIdTail: `...${clientId.slice(-4)}`,
    verdict,
    results,
  });
}
