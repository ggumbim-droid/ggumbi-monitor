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

  const history = await getShoppingHistory();

  // 리뷰 수 많은 순으로 정렬
  const sorted = [...deduped].sort((a, b) =>
    (parseInt(b.reviewCount ?? "0") || 0) - (parseInt(a.reviewCount ?? "0") || 0)
  );

  // reviewData 형식으로 변환
  const topProducts = sorted.slice(0, 5);

  const reviewDataList = topProducts.map((item) => {
    const key = `${stripHtml(item.mallName ?? "")}:${item.productId}`;
    const hist = history[key];
    const records = hist?.records ?? [];
    const currentReviews = parseInt(item.reviewCount ?? "0") || 0;
    const lastRecord = records.length >= 2 ? records[records.length - 2] : null;
    const lastWeekReviews = lastRecord?.reviewCount ?? currentReviews;
    const thisWeekNew = currentReviews - lastWeekReviews;
    const changeRate = lastWeekReviews
      ? ((thisWeekNew / lastWeekReviews) * 100).toFixed(1)
      : "0";

    // 트렌드 데이터 (최근 8주)
    const trend = records.slice(-8).map((r, idx) => ({
      date: r.date,
      reviewCount: r.reviewCount,
      label: idx === records.length - 1 ? "이번 주" : `${records.length - idx - 1}주 전`,
    }));

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
      interpretation: thisWeekNew > 0
        ? `이번 주 ${thisWeekNew.toLocaleString()}개 리뷰 증가 (+${changeRate}%)`
        : records.length < 2
        ? "첫 수집 — 다음 주부터 변화 추이를 확인할 수 있습니다."
        : "이번 주 리뷰 변화 없음",
    };
  });

  return {
    channel: "smartstore_reviews" as ChannelId,
    publicItems: [],
    loginRequired: [],
    reviewData: reviewDataList[0] ?? {
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
    },
    reviewDataList,
  };
}

export function isSmartstoreReviewsChannel(id: ChannelId): boolean {
  return id === "smartstore_reviews";
}
