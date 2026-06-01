import type { ChannelId, ChannelItem, ChannelResult, MonitorDateRange, SortOrder } from "@/types/monitor";

const NAVER_SHOPPING_ENDPOINT = "https://openapi.naver.com/v1/search/shop.json";
const RANKING_DISPLAY = 20;

function getNaverCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.NAVER_CLIENT_ID?.trim();
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 환경변수가 설정되지 않았습니다.");
  }
  return { clientId, clientSecret };
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

interface NaverShoppingItem {
  title: string;
  link: string;
  lprice: string;
  mallName: string;
  productId: string;
}

interface NaverShoppingResponse {
  items?: NaverShoppingItem[];
}

interface RankingRecord {
  date: string;
  rank: number;
  price: number;
}

interface RankingHistory {
  [key: string]: { records: RankingRecord[] };
}

async function fetchNaverShopping(query: string): Promise<NaverShoppingItem[]> {
  const { clientId, clientSecret } = getNaverCredentials();
  const url = new URL(NAVER_SHOPPING_ENDPOINT);
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(RANKING_DISPLAY));
  url.searchParams.set("sort", "sim");

  const res = await fetch(url.toString(), {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) return [];
  const data = (await res.json()) as NaverShoppingResponse;
  return data.items ?? [];
}

async function getRankingHistory(): Promise<RankingHistory> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/ranking-history`
    );
    return await res.json();
  } catch {
    return {};
  }
}

async function saveRankingHistory(
  keyword: string,
  items: NaverShoppingItem[]
) {
  try {
    const rankings = items.map((item, idx) => ({
      productId: item.productId,
      title: stripHtml(item.title),
      mallName: stripHtml(item.mallName ?? ""),
      link: item.link ?? "",
      keyword,
      rank: idx + 1,
      price: parseInt(item.lprice) || 0,
    }));

    await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/ranking-history`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rankings }),
      }
    );
  } catch {}
}

function formatRankChange(current: number, previous: number): string {
  const diff = previous - current;
  if (diff > 0) return ` ↑ ${diff}`;
  if (diff < 0) return ` ↓ ${Math.abs(diff)}`;
  return " →";
}

function formatPriceChange(current: number, previous: number): string {
  if (!previous || previous === current) return "";
  const diff = current - previous;
  const pct = ((diff / previous) * 100).toFixed(1);
  if (diff < 0) return ` ↓ (전주 ${previous.toLocaleString()}원, ${pct}%)`;
  return ` ↑ (전주 ${previous.toLocaleString()}원, +${pct}%)`;
}

export async function searchNaverRanking(
  keywords: string[],
  _sortOrder: SortOrder,
  _period: MonitorDateRange
): Promise<ChannelResult> {
  const allItems: { keyword: string; item: NaverShoppingItem; rank: number }[] = [];

  for (const keyword of keywords) {
    const items = await fetchNaverShopping(keyword);
    await saveRankingHistory(keyword, items);
    items.forEach((item, idx) => {
      allItems.push({ keyword, item, rank: idx + 1 });
    });
  }

  const history = await getRankingHistory();

  const publicItems: ChannelItem[] = allItems.map(({ keyword, item, rank }) => {
    const key = `${keyword}:${stripHtml(item.mallName ?? "")}:${item.productId}`;
    const hist = history[key];
    const records = hist?.records ?? [];
    const prevRecord = records.length >= 2 ? records[records.length - 2] : null;

    const currentPrice = parseInt(item.lprice) || 0;
    const rankChange = prevRecord ? formatRankChange(rank, prevRecord.rank) : " (첫 수집)";
    const priceChange = prevRecord ? formatPriceChange(currentPrice, prevRecord.price) : "";

    const rankText = `[${keyword}] ${rank}위${rankChange}`;
    const priceText = currentPrice
      ? `${currentPrice.toLocaleString()}원${priceChange}`
      : "";

    return {
      source: stripHtml(item.mallName ?? "네이버 쇼핑"),
      title: stripHtml(item.title ?? "상품명 없음"),
      preview: [rankText, priceText].filter(Boolean).join(" · "),
      link: item.link ?? "",
      publishedAt: new Date().toISOString().split("T")[0],
      tag: rank <= 3 ? `TOP ${rank}` : undefined,
    };
  });

  return {
    channel: "naver_ranking" as ChannelId,
    publicItems,
    loginRequired: [],
  };
}

export function isNaverRankingChannel(id: ChannelId): boolean {
  return id === "naver_ranking";
}
