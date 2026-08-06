// app/api/naver/keyword-volume/route.ts
//
// 네이버 검색광고 API(keywordstool)로 월간 검색량을 조회합니다.
//
// ▶ 필요한 환경변수 (Vercel):
//     NAVER_AD_API_KEY / NAVER_AD_SECRET_KEY / NAVER_AD_CUSTOMER_ID
//   searchad.naver.com → 도구 > API 사용 관리 에서 발급합니다.
//   (검색 API의 NAVER_CLIENT_ID/SECRET 과는 완전히 다른 계정 체계입니다.)
//
// ▶ 사용법
//     /api/naver/keyword-volume?keyword=아기베개              → 해당 키워드만
//     /api/naver/keyword-volume?keyword=아기베개&related=20   → 유사검색어 20개까지 함께
//
// ▶ 주의: 네이버는 검색량이 아주 적을 때 숫자 대신 "< 10" 문자열을 돌려줍니다.
//   그대로 숫자로 바꾸면 10으로 부풀려지므로 별도 표시(lowVolume)로 구분합니다.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const BASE_URL = 'https://api.searchad.naver.com';
const URI = '/keywordstool';
const METHOD = 'GET';

interface KeywordToolItem {
  relKeyword?: string;
  monthlyPcQcCnt?: string | number;
  monthlyMobileQcCnt?: string | number;
  compIdx?: string;
}

function buildSignature(timestamp: string, method: string, uri: string, secretKey: string) {
  const message = `${timestamp}.${method}.${uri}`;
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
}

/** 비교용 정규화 — 공백 제거 + 대문자 통일 (네이버는 영문을 대문자로 돌려줍니다) */
function normalize(v: string) {
  return v.replace(/\s/g, '').toUpperCase();
}

/** "< 10" 같은 값을 구분해서 숫자로 변환 */
function parseCount(v: unknown): { value: number; lowVolume: boolean } {
  if (typeof v === 'number') return { value: v, lowVolume: false };
  const raw = String(v ?? '');
  const lowVolume = raw.includes('<');
  const n = parseInt(raw.replace(/[^0-9]/g, ''), 10);
  if (isNaN(n)) return { value: 0, lowVolume };
  return { value: lowVolume ? 0 : n, lowVolume };
}

function shape(item: KeywordToolItem) {
  const pc = parseCount(item.monthlyPcQcCnt);
  const mobile = parseCount(item.monthlyMobileQcCnt);
  return {
    keyword: String(item.relKeyword ?? ''),
    monthlyPc: pc.value,
    monthlyMobile: mobile.value,
    monthlyTotal: pc.value + mobile.value,
    lowVolume: pc.lowVolume || mobile.lowVolume,
    compIdx: item.compIdx ?? null,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get('keyword');
  const relatedParam = searchParams.get('related');
  const relatedLimit = relatedParam ? Math.min(Math.max(parseInt(relatedParam, 10) || 0, 0), 100) : 0;

  if (!keyword) {
    return NextResponse.json({ error: 'keyword is required' }, { status: 400 });
  }

  const apiKey = process.env.NAVER_AD_API_KEY;
  const secretKey = process.env.NAVER_AD_SECRET_KEY;
  const customerId = process.env.NAVER_AD_CUSTOMER_ID;

  if (!apiKey || !secretKey || !customerId) {
    return NextResponse.json(
      { error: 'NAVER_AD_API_KEY / NAVER_AD_SECRET_KEY / NAVER_AD_CUSTOMER_ID not configured' },
      { status: 500 }
    );
  }

  const timestamp = Date.now().toString();
  const signature = buildSignature(timestamp, METHOD, URI, secretKey);
  const hintKeywords = keyword.replace(/\s/g, '');

  try {
    const res = await fetch(
      `${BASE_URL}${URI}?hintKeywords=${encodeURIComponent(hintKeywords)}&showDetail=1`,
      {
        method: METHOD,
        headers: {
          'X-Timestamp': timestamp,
          'X-API-KEY': apiKey,
          'X-Customer': customerId,
          'X-Signature': signature,
        },
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `naver ad api error: ${res.status}`, detail: text },
        { status: 502 }
      );
    }

    const data: { keywordList?: KeywordToolItem[] } = await res.json();
    const list = data.keywordList ?? [];

    const target = normalize(hintKeywords);
    const match = list.find((k) => normalize(String(k.relKeyword ?? '')) === target) ?? list[0];

    if (!match) {
      return NextResponse.json({ keyword, monthlyTotal: null, note: 'no data found' });
    }

    const main = shape(match);

    const related = relatedLimit
      ? list
          .filter((k) => normalize(String(k.relKeyword ?? '')) !== target)
          .map(shape)
          .sort((a, b) => b.monthlyTotal - a.monthlyTotal)
          .slice(0, relatedLimit)
      : [];

    return NextResponse.json({
      keyword,
      relKeyword: main.keyword,
      monthlyPc: main.monthlyPc,
      monthlyMobile: main.monthlyMobile,
      monthlyTotal: main.monthlyTotal,
      lowVolume: main.lowVolume,
      compIdx: main.compIdx,
      relatedCount: list.length,
      related,
    });
  } catch (e) {
    return NextResponse.json({ error: 'fetch failed', detail: String(e) }, { status: 500 });
  }
}
