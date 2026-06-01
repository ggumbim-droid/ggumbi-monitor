import { toISODate } from "@/lib/date-range";
import type {
  ChannelId,
  ChannelItem,
  ChannelResult,
  MonitorDateRange,
  SortOrder,
} from "@/types/monitor";

const NAVER_API_CALL_DELAY_MS = 300;
const NAVER_SEARCH_DISPLAY = 20;

const NAVER_ENDPOINTS: Record<
  "naver_cafe" | "naver_blog" | "naver_news",
  string
> = {
  naver_cafe: "https://openapi.naver.com/v1/search/cafearticle.json",
  naver_blog: "https://openapi.naver.com/v1/search/blog.json",
  naver_news: "https://openapi.naver.com/v1/search/news.json",
};

type NaverApiChannelId = keyof typeof NAVER_ENDPOINTS;

interface NaverApiCallContext {
  priorCalls: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface NaverSearchResponse {
  items?: Record<string, string>[];
}

function getNaverCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.NAVER_CLIENT_ID?.trim();
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      "NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 환경변수가 설정되지 않았습니다."
    );
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

function naverSortParam(sortOrder: SortOrder): "date" | "sim" {
  return sortOrder === "latest" ? "date" : "sim";
}

function parseRelativeDate(text: string): string | undefined {
  const now = new Date();
  const t = text.trim();
  const numMatch = t.match(/(\d+)/);
  const num = numMatch ? parseInt(numMatch[1]) : 1;
  if (t.includes("분 전") || t.includes("시간 전")) {
    return toISODate(now);
  }
  if (t.includes("일 전")) {
    const d = new Date(now); d.setDate(d.getDate() - num);
    return toISODate(d);
  }
  if (t.includes("주 전")) {
    const d = new Date(now); d.setDate(d.getDate() - num * 7);
    return toISODate(d);
  }
  if (t.includes("개월 전") || t.includes("달 전")) {
    const d = new Date(now); d.setMonth(d.getMonth() - num);
    return toISODate(d);
  }
  if (t.includes("년 전")) {
    const d = new Date(now); d.setFullYear(d.getFullYear() - num);
    return toISODate(d);
  }
  return undefined;
}
  const raw = postdate.trim();
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return undefined;
}

function parseNewsPubDate(pubDate: string): string | undefined {
  const parsed = new Date(pubDate);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return toISODate(parsed);
}

async function fetchNaverSearch(
  callContext: NaverApiCallContext,
  endpoint: string,
  query: string,
  sort: "date" | "sim"
): Promise<Record<string, string>[]> {
  if (callContext.priorCalls > 0) {
    await delay(NAVER_API_CALL_DELAY_MS);
  }
  callContext.priorCalls += 1;

  const { clientId, clientSecret } = getNaverCredentials();
  const url = new URL(endpoint);
  url.searchParams.set("query", query);
  url.searchParams.set("sort", sort);
  url.searchParams.set("display", String(NAVER_SEARCH_DISPLAY));

  const res = await fetch(url.toString(), {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `네이버 검색 API 오류 (${res.status}): ${body.slice(0, 200) || res.statusText}`
    );
  }

  const data = (await res.json()) as NaverSearchResponse;
  return data.items ?? [];
}

function mapCafeItem(raw: Record<string, string>): ChannelItem {
  const publishedAt = parseNewsPubDate(raw.pubDate ?? "")
    ?? parseBlogPostDate(raw.postdate ?? "")
    ?? parseRelativeDate(raw.pubDate ?? "")
    ?? parseRelativeDate(raw.postdate ?? "");
  return {
    source: stripHtml(raw.cafename ?? "네이버 카페"),
    title: stripHtml(raw.title ?? "제목 없음"),
    preview: stripHtml(raw.description ?? ""),
    link: raw.link ?? "",
    publishedAt,
  };
}

function mapBlogItem(raw: Record<string, string>): ChannelItem {
  const publishedAt = parseBlogPostDate(raw.postdate ?? "");
  return {
    source: stripHtml(raw.bloggername ?? "네이버 블로그"),
    title: stripHtml(raw.title ?? "제목 없음"),
    preview: stripHtml(raw.description ?? ""),
    link: raw.link ?? "",
    publishedAt,
  };
}

function mapNewsItem(raw: Record<string, string>): ChannelItem {
  const publishedAt = parseNewsPubDate(raw.pubDate ?? "");
  return {
    source: "네이버 뉴스",
    title: stripHtml(raw.title ?? "제목 없음"),
    preview: stripHtml(raw.description ?? ""),
    link: raw.link ?? raw.originallink ?? "",
    publishedAt,
  };
}

function mapItem(
  channelId: NaverApiChannelId,
  raw: Record<string, string>
): ChannelItem {
  switch (channelId) {
    case "naver_cafe":
      return mapCafeItem(raw);
    case "naver_blog":
      return mapBlogItem(raw);
    case "naver_news":
      return mapNewsItem(raw);
  }
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

export async function searchNaverChannel(
  channelId: NaverApiChannelId,
  keywords: string[],
  sortOrder: SortOrder,
  _period: MonitorDateRange,
  callContext: NaverApiCallContext
): Promise<ChannelResult> {
  const sort = naverSortParam(sortOrder);
  const endpoint = NAVER_ENDPOINTS[channelId];
  const collected: ChannelItem[] = [];

  for (const keyword of keywords) {
    const items = await fetchNaverSearch(callContext, endpoint, keyword, sort);
    for (const raw of items) {
      collected.push(mapItem(channelId, raw));
    }
  }

  // 날짜 필터 적용 (날짜 없는 카페글은 제외)
  const filtered = dedupeByLink(collected).filter((item) => {
    if (channelId === "naver_cafe" && !item.publishedAt) return false;
    if (!item.publishedAt) return true;
    return item.publishedAt >= _period.startDate && item.publishedAt <= _period.endDate;
  });
  const publicItems = filtered.slice(0, NAVER_SEARCH_DISPLAY);

  return {
    channel: channelId as ChannelId,
    publicItems,
    loginRequired: [],
  };
}

export async function searchNaverChannels(
  channelIds: NaverApiChannelId[],
  keywords: string[],
  sortOrder: SortOrder,
  period: MonitorDateRange
): Promise<ChannelResult[]> {
  const callContext: NaverApiCallContext = { priorCalls: 0 };
  const results: ChannelResult[] = [];

  for (const channelId of channelIds) {
    results.push(
      await searchNaverChannel(
        channelId,
        keywords,
        sortOrder,
        period,
        callContext
      )
    );
  }

  return results;
}

export function isNaverApiChannel(
  id: ChannelId
): id is NaverApiChannelId {
  return id === "naver_cafe" || id === "naver_blog" || id === "naver_news";
}
