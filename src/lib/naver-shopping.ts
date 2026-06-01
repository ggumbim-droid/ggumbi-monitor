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

export interface NaverShoppingItem {
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

async function saveShoppingHistory(items: NaverShoppingItem[]) {
  try {
    const products = items
      .filter((item) => item.productId && item.lprice)
      .map((item) => ({
        productId: item.productId,
        title: stripHtml(item.title),
        mallName: stripHtml(item.mallName ?? ""),
        link: item.link ?? "",
        price: parseInt(item.lprice) || 0,
        reviewCount: parseInt(item.reviewCount ?? "0") || 0,
      }));

    if (products.length === 0) return;

    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/shopping-history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ products }),
    });
  } catch {
    // 히스토리 저장 실패해도 메인 결과에 영향 없음
  }
}

async function getShoppingHistory(): Promise<Record<string, { records: { date: string; price: number; reviewCount: number }[] }>> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/shopping-history`);
    return await res.json();
  } catch {
    return {};
  }
}

function formatPriceChange(current: number, previous: number): string {
  if (!previous || previous === current) return "";
  const diff = current - previous;
  const pct = ((diff / previous) * 100).toFixed(1);
  if (diff < 0) return ` ↓ (전주 ${previous.toLocaleString()}원, ${pct}%)`;
  return ` ↑ (전주 ${previous.toLocaleString()}원, +${pct}%)`;
}

function formatReviewChange(current: number, previous: number): string {
  if (!previous) return "";
  const diff = current - previous;
  if (diff === 0) return "";
  if (diff > 0) return ` (+${diff.toLocaleString()}개)`;
  return ` (${diff.toLocaleString()}개)`;
}

function isNewProduct(item: NaverShoppingItem): boolean {
  return item.productType === "2";
}

function mapShoppingItem(
  raw: NaverShoppingItem,
  history: Record<string, { records: { date: string; price: number; reviewCount: number }[] }>,
  rank: number
): ChannelItem {
  const key = `${stripHtml(raw.mallName ?? "")}:${raw.productId}`;
  const hist = history[key];
  const prevRecord = hist && hist.records.length >= 2
    ? hist.records[hist.records.length - 2]
    : null;

  const currentPrice = parseInt(raw.lprice) || 0;
  const currentReviews = parseInt(raw.reviewCount ?? "0") || 0;
  const priceChange = prevRecord ? formatPriceChange(currentPrice, prevRecord.price) : " (첫 수집)";
  const reviewChange = prevRecord ? formatReviewChange(currentReviews, prevRecord.reviewCount) : "";
  const isNew = isNewProduct(raw);

  const priceText = currentPrice ? `${currentPrice.toLocaleString()}원${priceChange}` : "가격 정보 없음";
  const reviewText = currentReviews ? `리뷰 ${currentReviews.toLocaleString()}개${reviewChange}` : "";
  const newBadge = isNew ? "[신제품] " : "";

  return {
    source: stripHtml(raw.mallName ?? "네이버 쇼핑"),
    title: `${newBadge}${stripHtml(raw.title ?? "상품명 없음")}`,
    preview: [priceText, reviewText].filter(Boolean).join(" · "),
    link: raw.link ?? "",
    publishedAt: toISODate(new Date()),
    tag: isNew ? "신제품" : rank <= 10 ? `리뷰 TOP ${rank}` : undefined,
  };
}

function dedupeByProductId(items: NaverShoppingItem[]): NaverShoppingItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.mallName}:${item.productId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function searchSmartstore(
  keywords: string[],
  sortOrder: SortOrder,
  _period: MonitorDateRange
): Promise<ChannelResult> {
  const sort = sortOrder === "latest" ? "date" : "sim";
  const collected: NaverShoppingItem[] = [];

  for (const keyword of keywords) {
    const items = await fetchNaverShopping(keyword, sort);
    collected.push(...items);
  }

  const deduped = dedupeByProductId(collected);

  // 히스토리 저장 및 조회 병렬 처리
  const [history] = await Promise.all([
    getShoppingHistory(),
    saveShoppingHistory(deduped),
  ]);

  // 리뷰 수 기준 TOP 10 정렬
  const sortedByReview = [...deduped].sort((a, b) => {
    return (parseInt(b.reviewCount ?? "0") || 0) - (parseInt(a.reviewCount ?? "0") || 0);
  });

  // 신제품 먼저, 그 다음 리뷰 TOP 10, 나머지
  const newProducts = deduped.filter(isNewProduct);
  const top10 = sortedByReview.slice(0, 10);
  const top10Ids = new Set(top10.map((i) => i.productId));
  const newIds = new Set(newProducts.map((i) => i.productId));
  const rest = deduped.filter((i) => !top10Ids.has(i.productId) && !newIds.has(i.productId));

  const ordered = [
    ...newProducts,
    ...top10,
    ...rest,
  ];

  const publicItems = ordered.slice(0, SHOPPING_DISPLAY).map((item, idx) => {
    const reviewRank = sortedByReview.findIndex((i) => i.productId === item.productId) + 1;
    return mapShoppingItem(item, history, reviewRank);
  });

  return {
    channel: "smartstore" as ChannelId,
    publicItems,
    loginRequired: [],
  };
}

export function isSmartstoreChannel(id: ChannelId): boolean {
  return id === "smartstore";
}
