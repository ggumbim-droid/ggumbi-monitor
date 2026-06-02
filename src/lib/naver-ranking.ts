import type { ChannelId, ChannelItem, ChannelResult, MonitorDateRange, SortOrder } from "@/types/monitor";

const NAVER_SHOPPING_ENDPOINT = "https://openapi.naver.com/v1/search/shop.json";
const RANKING_DISPLAY = 30;

const KKUMBI_BRANDS = ["꿈비", "리코코", "미미루", "뉴어스", "파미야", "소브", "오가닉그라운드", "바바디토", "봄봄매트", "슈슈비", "ggumbi", "GGUMBI"];

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
  brand: string;
  maker: string;
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

function isKkumbiBrand(title: string, brand: string, mallName: string): string | null {
  const text = `${title} ${brand} ${mallName}`.toLowerCase();
  for (const b of KKUMBI_BRANDS) {
    if (text.includes(b.toLowerCase())) return b;
  }
  return null;
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

async function saveRankingHistory(keyword: string, items: { item: NaverShoppingItem; rank: number }[]) {
  try {
    const rankings = items.map(({ item, rank }) => ({
      productId: item.productId,
      title: stripHtml(item.title),
      mallName: stripHtml(item.mallName ?? ""),
      link: item.link ?? "",
      keyword,
      rank,
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
  if (diff > 0) return `↑${diff}`;
  if (diff < 0) return `↓${Math.abs(diff)}`;
  return "→ 유지";
}

function formatPriceChange(current: number, previous: number): string {
  if (!previous || previous === current) return "";
  const diff = current - previous;
  const pct = ((diff / previous) * 100).toFixed(1);
  if (diff < 0) return ` (전주比 ${pct}%)`;
  return ` (전주比 +${pct}%)`;
}

function getMallType(link: string, mallName: string): string {
  const url = link.toLowerCase();
  const name = mallName.toLowerCase();
  if (url.includes("smartstore.naver.com") || url.includes("brand.naver.com")) return "스마트스토어";
  if (url.includes("coupang.com") || name.includes("쿠팡")) return "쿠팡";
  if (url.includes("11st.co.kr") || name.includes("11번가")) return "11번가";
  if (url.includes("gmarket.co.kr") || name.includes("지마켓")) return "지마켓";
  if (url.includes("auction.co.kr") || name.includes("옥션")) return "옥션";
  if (url.includes("lotteon.com") || name.includes("롯데")) return "롯데ON";
  return mallName;
}

export async function searchNaverRanking(
  keywords: string[],
  _sortOrder: SortOrder,
  _period: MonitorDateRange
): Promise<ChannelResult> {
  const history = await getRankingHistory();
  const publicItems: ChannelItem[] = [];

  for (const keyword of keywords) {
    // 띄어쓰기 버전 둘 다 검색 후 합치기
    const keyword2 = keyword.replace(/\s+/g, "");
    const [items1, items2] = await Promise.all([
      fetchNaverShopping(keyword),
      keyword !== keyword2 ? fetchNaverShopping(keyword2) : Promise.resolve([]),
    ]);

    // 중복 제거 (productId 기준)
    const seen = new Set<string>();
    const merged = [...items1, ...items2].filter((item) => {
      if (seen.has(item.productId)) return false;
      seen.add(item.productId);
      return true;
    });

    const items = merged;
    const ranked = items.map((item, idx) => ({ item, rank: idx + 1 }));
    await saveRankingHistory(keyword, ranked);

    // 꿈비 브랜드 순위 찾기
    const kkumbiRanked = ranked.filter(({ item }) =>
      isKkumbiBrand(
        stripHtml(item.title),
        stripHtml(item.brand ?? ""),
        stripHtml(item.mallName ?? "")
      )
    );

    // 꿈비 브랜드 순위 요약 카드 (맨 앞에 추가)
    if (kkumbiRanked.length > 0) {
      const best = kkumbiRanked[0];
      const brandName = isKkumbiBrand(
        stripHtml(best.item.title),
        stripHtml(best.item.brand ?? ""),
        stripHtml(best.item.mallName ?? "")
      );
      publicItems.push({
        source: "🟢 자사 브랜드 노출 현황",
        title: `[${keyword}] ${brandName} 최상위 노출: ${best.rank}위`,
        preview: `${RANKING_DISPLAY}위 내 자사 상품 ${kkumbiRanked.length}개 노출 · 최고 순위 ${best.rank}위 (${stripHtml(best.item.title).slice(0, 30)}...)`,
        link: best.item.link ?? "",
        publishedAt: new Date().toISOString().split("T")[0],
        tag: "자사브랜드",
      });
    } else {
      publicItems.push({
        source: "🔴 자사 브랜드 노출 현황",
        title: `[${keyword}] 자사 브랜드 ${RANKING_DISPLAY}위권 밖`,
        preview: `검색 상위 ${RANKING_DISPLAY}위 내 자사 브랜드(꿈비·리코코 등) 상품이 노출되지 않고 있습니다. SEO 점검이 필요합니다.`,
        link: "",
        publishedAt: new Date().toISOString().split("T")[0],
        tag: "자사브랜드",
      });
    }

    // 전체 순위 목록
    ranked.forEach(({ item, rank }) => {
      const key = `${keyword}:${stripHtml(item.mallName ?? "")}:${item.productId}`;
      const hist = history[key];
      const records = hist?.records ?? [];
      const prevRecord = records.length >= 2 ? records[records.length - 2] : null;

      const currentPrice = parseInt(item.lprice) || 0;
      const rankChange = prevRecord ? formatRankChange(rank, prevRecord.rank) : "첫 수집";
      const priceChange = prevRecord ? formatPriceChange(currentPrice, prevRecord.price) : "";
      const mallType = getMallType(item.link ?? "", stripHtml(item.mallName ?? ""));
      const brandName = stripHtml(item.brand || item.maker || "");
      const isKkumbi = isKkumbiBrand(
        stripHtml(item.title),
        stripHtml(item.brand ?? ""),
        stripHtml(item.mallName ?? "")
      );

      publicItems.push({
        source: mallType,
        title: `${isKkumbi ? "⭐ " : ""}${stripHtml(item.title ?? "상품명 없음")}`,
        preview: `[${keyword}] ${rank}위 · ${rankChange}${currentPrice ? ` · ${currentPrice.toLocaleString()}원${priceChange}` : ""}`,
        link: item.link ?? "",
        publishedAt: new Date().toISOString().split("T")[0],
        tag: brandName || undefined,
      });
    });
  }

  return {
    channel: "naver_ranking" as ChannelId,
    publicItems,
    loginRequired: [],
  };
}

export function isNaverRankingChannel(id: ChannelId): boolean {
  return id === "naver_ranking";
}
