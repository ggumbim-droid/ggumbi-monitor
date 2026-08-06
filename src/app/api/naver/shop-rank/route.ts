// app/api/naver/keyword-volume/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const BASE_URL = 'https://api.searchad.naver.com';
const URI = '/keywordstool';
const METHOD = 'GET';

function buildSignature(timestamp: string, method: string, uri: string, secretKey: string) {
  const message = `${timestamp}.${method}.${uri}`;
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get('keyword');

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
    const res = await fetch(`${BASE_URL}${URI}?hintKeywords=${encodeURIComponent(hintKeywords)}&showDetail=1`, {
      method: METHOD,
      headers: {
        'X-Timestamp': timestamp,
        'X-API-KEY': apiKey,
        'X-Customer': customerId,
        'X-Signature': signature,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `naver ad api error: ${res.status}`, detail: text }, { status: 502 });
    }

    const data = await res.json();
    const list = data.keywordList || [];
    const match = list.find((k: any) => String(k.relKeyword).replace(/\s/g, '') === hintKeywords) || list[0];

    if (!match) {
      return NextResponse.json({ keyword, monthlyTotal: null, note: 'no data found' });
    }

    const toNum = (v: any) => {
      if (typeof v === 'number') return v;
      const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
      return isNaN(n) ? 0 : n;
    };

    const pc = toNum(match.monthlyPcQcCnt);
    const mobile = toNum(match.monthlyMobileQcCnt);

    return NextResponse.json({
      keyword,
      relKeyword: match.relKeyword,
      monthlyPc: pc,
      monthlyMobile: mobile,
      monthlyTotal: pc + mobile,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'fetch failed', detail: String(e) }, { status: 500 });
  }
}
