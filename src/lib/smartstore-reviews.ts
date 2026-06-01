import type { ChannelId, ChannelResult } from "@/types/monitor";

const NAVER_SHOPPING_ENDPOINT = "https://openapi.naver.com/v1/search/shop.json";

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
  reviewCount?: string;
}

interface NaverShoppingResponse {
  items?: NaverShoppingItem[];
}

interface HistoryRecord {
  date: string;
  price: number;
  reviewCount: number;
}

interface ShoppingHistory {
  [key: string]: { records: HistoryRecord[] };
}

async function fetchNaverShopping(query: string): Promise<NaverShoppingItem[]> {
  const { clientId, clientSecret } = getNaverCredentials();
  const url = new URL(NAVER_SHOPPING_ENDPOINT);
  url.searchParams.set("query", query);
  url.searchParams.set("display", "20");
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

async function getShoppingHistory(): Promise<ShoppingHistory> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/shopping-history`
    );
    return await res.json();
  } catch {
    return {};
  }
}

function isSmartstore(link: string): boolean {
  return link.toLowerCase().includes("smartstore.naver.com");
}

export async function searchSmartstoreReviews(
  keywords: string[]
): Promise<ChannelResult> {
  const allItems: NaverShoppingItem[] = [];

  for (const keyword of keywords) {
    const items = await fetchNaverShopping(keyword);
    allItems.push(...items.filter((item) => isSmartstore(item.link ?? "")));
  }

  // 중복 제거
  const seen = new Set<string>();
  const deduped = allItems.filter((item) => {
    const key = `${item.mallName}:${item.productId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 리뷰 수 많은 순 정렬 (reviewCount 없으면 0)
  const sorted = [...deduped].sort((a, b) =>
    (parseInt(b.reviewCount ?? "0") || 0) - (parseInt(a.reviewCount ?? "0") || 0)
  );

  const history = await getShoppingHistory();
  const topProducts = sorted.slice(0, 10);

  const reviewDataList = topProducts.map((item) => {
    const key = `${stripHtml(item.mallName ?? "")}:${item.productId}`;
    const hist = history[key];
    const records = hist?.records ?? [];
    const currentReviews = parseInt(item.reviewCount ?? "0") || 0;
    const lastRecord = records.length >= 2 ? records[records.length - 2] : null;
    const lastWeekReviews = lastRecord?.reviewCount ?? 0;
    const thisWeekNew = lastWeekReviews > 0 ? currentReviews - lastWeekReviews : 0;
    const changeRate = lastWeekReviews > 0
      ? ((thisWeekNew / lastWeekReviews) * 100).toFixed(1)
      : "0";

    const trend = records.slice(-8).map((r, idx) => ({
      date: r.date,
      reviewCount: r.reviewCount,
      label: idx === records.length - 1 ? "이번 주" : `${records.length - idx - 1}주 전`,
    }));

    let interpretation = "";
    if (records.length < 2) {
      interpretation = currentReviews > 0
        ? `현재 리뷰 ${currentReviews.toLocaleString()}개 · 다음 주부터 증감 추이를 확인할 수 있습니다.`
        : "첫 수집 — 다음 주부터 변화 추이를 확인할 수 있습니다.";
    } else if (thisWeekNew > 0) {
      interpretation = `이번 주 ${thisWeekNew.toLocaleString()}개 리뷰 증가 (+${changeRate}%)`;
    } else {
      interpretation = "이번 주 리뷰 변화 없음";
    }

    return {
      productName: stripHtml(item.title),
      brandName: stripHtml(item.mallName ?? ""),
      storeUrl: item.link ?? "",
      currentTotalReviews: currentReviews,
      lastWeekTotalReviews: lastWeekReviews,
      thisWeekNewReviews: Math.max(0, thisWeekNew),
      lastWeekNewReviews: 0,
      changeRatePercent: parseFloat(changeRate),
      trend,
      interpretation,
    };
  });

  const defaultReviewData = {
    productName: keywords.join(", "),
    brandName: "",
    storeUrl: "",
    currentTotalReviews: 0,
    lastWeekTotalReviews: 0,
    thisWeekNewReviews: 0,
    lastWeekNewReviews: 0,
    changeRatePercent: 0,
    trend: [],
    interpretation: "스마트스토어 상품을 찾을 수 없습니다.",
  };

  return {
    channel: "smartstore_reviews" as ChannelId,
    publicItems: [],
    loginRequired: [],
    reviewData: reviewDataList[0] ?? defaultReviewData,
    ...(reviewDataList.length > 0 ? { reviewDataList } : {}),
  } as ChannelResult & { reviewDataList: typeof reviewDataList };
}

export function isSmartstoreReviewsChannel(id: ChannelId): boolean {
  return id === "smartstore_reviews";
}
