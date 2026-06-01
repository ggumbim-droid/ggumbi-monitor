import { toISODate } from "@/lib/date-range";
import type { ChannelId, ChannelItem, ChannelResult, MonitorDateRange, SortOrder } from "@/types/monitor";

const NAVER_SHOPPING_ENDPOINT = "https://openapi.naver.com/v1/search/shop.json";
const SHOPPING_DISPLAY = 50;

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
  image: string;
  lprice: string;
  hprice: string;
  mallName: string;
  productId: string;
  productType: string;
  brand: string;
  maker: string;
  category1: string;
  category2: string;
  category3: string;
  category4: string;
  reviewCount?: string;
}

interface NaverShoppingResponse {
  items?: NaverShoppingItem[];
}

async function fetchNaverShopping(
  query: string,
  sort: "sim" | "date" | "asc" | "dsc"
): Promise<NaverShoppingItem[]> {
  const { clientId, clientSecret } = getNaverCredentials();
  const url = new URL(NAVER_SHOPPING_ENDPOINT);
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(SHOPPING_DISPLAY));
  url.searchParams.set("sort", sort);

  const res = await fetch(url.toString(), {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`네이버 쇼핑 API 오류 (${res.status}): ${body.slice(0, 200) || res.statusText}`);
  }

  const data = (await res.json()) as NaverShoppingResponse;
  return data.items ?? [];
}

function mapShoppingItem(raw: NaverShoppingItem): ChannelItem {
  const price = raw.lprice
    ? `${parseInt(raw.lprice).toLocaleString()}원`
    : "";
  const reviewInfo = raw.reviewCount
    ? ` · 리뷰 ${parseInt(raw.reviewCount).toLocaleString()}개`
    : "";

  return {
    source: stripHtml(raw.mallName ?? "네이버 쇼핑"),
    title: stripHtml(raw.title ?? "상품명 없음"),
    preview: `${raw.brand ? `브랜드: ${raw.brand} · ` : ""}${price}${reviewInfo}`,
    link: raw.link ?? "",
    publishedAt: toISODate(new Date()),
    tag: raw.category2 || raw.category1 || undefined,
  };
}

function dedupeByLink(items: ChannelItem[]): ChannelItem[] {
  const seen = new Set<string>();
  const result: ChannelItem[] = [];
  for (const item of items) {
    const key = item.link || `${item.source}:${item.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export async function searchSmartstore(
  keywords: string[],
  sortOrder: SortOrder,
  _period: MonitorDateRange
): Promise<ChannelResult> {
  const sort = sortOrder === "latest" ? "date" : "sim";
  const collected: ChannelItem[] = [];

  for (const keyword of keywords) {
    const items = await fetchNaverShopping(keyword, sort);
    for (const raw of items) {
      collected.push(mapShoppingItem(raw));
    }
  }

  const publicItems = dedupeByLink(collected).slice(0, SHOPPING_DISPLAY);

  return {
    channel: "smartstore" as ChannelId,
    publicItems,
    loginRequired: [],
  };
}

export function isSmartstoreChannel(id: ChannelId): boolean {
  return id === "smartstore";
}
