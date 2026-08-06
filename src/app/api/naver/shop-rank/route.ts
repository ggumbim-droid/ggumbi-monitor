// app/api/naver/shop-rank/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface NaverShopItem {
  title: string;
  mallName: string;
  lprice: string;
  link: string;
  category1: string;
  category2: string;
  category3: string;
  category4: string;
}

function cleanTitle(title: string) {
  return title.replace(/<\/?b>/g, '').replace(/&amp;/g, '&');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query');
  const count = searchParams.get('count') || '20';

  if (!query) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET not configured' }, { status: 500 });
  }

  try {
    const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=${count}&sort=sim`;
    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `naver api error: ${res.status}`, detail: text }, { status: 502 });
    }

    const data: { items?: NaverShopItem[]; total?: number } = await res.json();
    const rawItems = data.items || [];

    const titles: string[] = rawItems.map((item) => cleanTitle(item.title));

    const items = rawItems.map((item) => ({
      title: cleanTitle(item.title),
      mallName: item.mallName,
      lprice: item.lprice,
      link: item.link,
      category1: item.category1,
      category2: item.category2,
      category3: item.category3,
      category4: item.category4,
    }));

    return NextResponse.json({ query, titles, items, total: data.total });
  } catch (e) {
    return NextResponse.json({ error: 'fetch failed', detail: String(e) }, { status: 500 });
  }
}
