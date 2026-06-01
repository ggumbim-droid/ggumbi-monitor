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
  } catch {}
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

function dedupeByProductId(items: NaverShoppingItem[]): NaverShoppingItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.mallName}:${item.productId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeMallName(mallName: string, link: string): string {
  const name = mallName.toLowerCase();
  const url = link.toLowerCase();
  if (url.includes("smartstore.naver.com")) return "스마트스토어";
  if (name.includes("쿠팡") || url.includes("coupang.com")) return "쿠팡";
  if (name.includes("11번가") || url.includes("11st.co.kr")) return "11번가";
  if (name.includes("롯데") || url.includes("lotteon.com")) return "롯데ON";
  if (name.includes("gmarket") || url.includes("gmarket.co.kr") || name.includes("지마켓")) return "지마켓";
  if (name.includes("auction") || url.includes("auction.co.kr") || name.includes("옥션")) return "옥션";
  if (url.includes("wemakeprice.com") || name.includes("위메프")) return "위메프";
  if (url.includes("tmon.co.kr") || name.includes("티몬")) return "티몬";
  return mallName;
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

  const [history] = await Promise.all([
    getShoppingHistory(),
    saveShoppingHistory(deduped),
  ]);

  // 플랫폼별 그룹화
  const platformGroups: Record<string, NaverShoppingItem[]> = {};
  for (const item of deduped) {
    const platform = normalizeMallName(stripHtml(item.mallName ?? "기타"), item.link ?? "");
    if (!platformGroups[platform]) platformGroups[platform] = [];
    platformGroups[platform].push(item);
  }

  // 각 플랫폼별 리뷰 TOP 5 정렬 후 합치기
  const ordered: { item: NaverShoppingItem; platform: string; rank: number }[] = [];

  // 스마트스토어 먼저, 나머지는 리뷰 수 많은 플랫폼 순
  const platformOrder = ["스마트스토어", ...Object.keys(platformGroups).filter((p) => p !== "스마트스토어")];

  for (const platform of platformOrder) {
    const items = platformGroups[platform];
    if (!items) continue;
    const sorted = [...items].sort((a, b) =>
      (parseInt(b.reviewCount ?? "0") || 0) - (parseInt(a.reviewCount ?? "0") || 0)
    );
    sorted.slice(0, 5).forEach((item, idx) => {
      ordered.push({ item, platform, rank: idx + 1 });
    });
  }

  const publicItems: ChannelItem[] = ordered.map(({ item, platform, rank }) => {
    const key = `${stripHtml(item.mallName ?? "")}:${item.productId}`;
    const hist = history[key];
    const prevRecord = hist && hist.records.length >= 2
      ? hist.records[hist.records.length - 2]
      : null;

    const currentPrice = parseInt(item.lprice) || 0;
    const currentReviews = parseInt(item.reviewCount ?? "0") || 0;
    const priceChange = prevRecord
      ? formatPriceChange(currentPrice, prevRecord.price)
      : " (첫 수집)";
    const reviewChange = prevRecord
      ? formatReviewChange(currentReviews, prevRecord.reviewCount)
      : "";

    const priceText = currentPrice
      ? `${currentPrice.toLocaleString()}원${priceChange}`
      : "가격 정보 없음";
    const reviewText = currentReviews
      ? `리뷰 ${currentReviews.toLocaleString()}개${reviewChange}`
      : "";

    return {
      source: `${platform} TOP ${rank}`,
      title: stripHtml(item.title ?? "상품명 없음"),
      preview: [priceText, reviewText].filter(Boolean).join(" · "),
      link: item.link ?? "",
      publishedAt: toISODate(new Date()),
      tag: platform,
    } as ChannelItem;
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
