import { parseISODate, toISODate } from "@/lib/date-range";
import type {
  ChannelId,
  ChannelItem,
  ChannelResult,
  MonitorDateRange,
  SortOrder,
} from "@/types/monitor";

const YOUTUBE_SEARCH_MAX = 10;
const YOUTUBE_API_CALL_DELAY_MS = 300;
const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

interface YoutubeApiCallContext {
  priorCalls: number;
}

interface YoutubeSearchResponse {
  items?: Array<{
    id?: { videoId?: string };
  }>;
}

interface YoutubeVideosResponse {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
    };
    statistics?: {
      viewCount?: string;
    };
  }>;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getYoutubeApiKey(): string {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다.");
  }
  return apiKey;
}

function youtubeSortParam(sortOrder: SortOrder): "date" | "relevance" {
  return sortOrder === "latest" ? "date" : "relevance";
}

/** publishedBefore는 exclusive이므로 종료일 다음날 00:00 UTC */
function toPublishedAfter(isoDate: string): string {
  return `${isoDate}T00:00:00Z`;
}

function toPublishedBefore(isoDate: string): string {
  const next = parseISODate(isoDate);
  next.setDate(next.getDate() + 1);
  return `${toISODate(next)}T00:00:00Z`;
}

function isWithinPeriod(publishedAt: string, period: MonitorDateRange): boolean {
  return (
    publishedAt >= period.startDate && publishedAt <= period.endDate
  );
}

function formatViewCount(viewCount: string | undefined): string {
  const n = Number(viewCount ?? "");
  if (!Number.isFinite(n) || n < 0) return "";
  return `조회수 ${n.toLocaleString("ko-KR")}회`;
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

async function youtubeFetch<T>(
  callContext: YoutubeApiCallContext,
  url: URL
): Promise<T> {
  if (callContext.priorCalls > 0) {
    await delay(YOUTUBE_API_CALL_DELAY_MS);
  }
  callContext.priorCalls += 1;

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `YouTube Data API 오류 (${res.status}): ${body.slice(0, 200) || res.statusText}`
    );
  }
  return (await res.json()) as T;
}

async function fetchVideoIdsByKeyword(
  callContext: YoutubeApiCallContext,
  apiKey: string,
  query: string,
  sortOrder: SortOrder,
  period: MonitorDateRange
): Promise<string[]> {
  const url = new URL(YOUTUBE_SEARCH_URL);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", String(YOUTUBE_SEARCH_MAX));
  url.searchParams.set("order", youtubeSortParam(sortOrder));
  url.searchParams.set("publishedAfter", toPublishedAfter(period.startDate));
  url.searchParams.set("publishedBefore", toPublishedBefore(period.endDate));
  url.searchParams.set("key", apiKey);

  const data = await youtubeFetch<YoutubeSearchResponse>(callContext, url);
  const ids: string[] = [];
  for (const item of data.items ?? []) {
    const videoId = item.id?.videoId;
    if (videoId) ids.push(videoId);
  }
  return ids;
}

async function fetchVideoDetails(
  callContext: YoutubeApiCallContext,
  apiKey: string,
  videoIds: string[]
): Promise<NonNullable<YoutubeVideosResponse["items"]>> {
  if (videoIds.length === 0) return [];

  const url = new URL(YOUTUBE_VIDEOS_URL);
  url.searchParams.set("part", "snippet,statistics");
  url.searchParams.set("id", videoIds.join(","));
  url.searchParams.set("key", apiKey);

  const data = await youtubeFetch<YoutubeVideosResponse>(callContext, url);
  return data.items ?? [];
}

function mapVideoItem(
  raw: NonNullable<YoutubeVideosResponse["items"]>[number],
  period: MonitorDateRange
): ChannelItem | null {
  const videoId = raw.id;
  const snippet = raw.snippet;
  if (!videoId || !snippet?.publishedAt) return null;

  const publishedAt = toISODate(new Date(snippet.publishedAt));
  if (!isWithinPeriod(publishedAt, period)) return null;

  const preview = formatViewCount(raw.statistics?.viewCount);

  return {
    source: snippet.channelTitle ?? "유튜브",
    title: snippet.title ?? "제목 없음",
    preview,
    link: `https://www.youtube.com/watch?v=${videoId}`,
    publishedAt,
    tag: "영상",
  };
}

export async function searchYoutubeChannel(
  keywords: string[],
  sortOrder: SortOrder,
  period: MonitorDateRange
): Promise<ChannelResult> {
  const apiKey = getYoutubeApiKey();
  const callContext: YoutubeApiCallContext = { priorCalls: 0 };
  const videoIds = new Set<string>();

  for (const keyword of keywords) {
    const ids = await fetchVideoIdsByKeyword(
      callContext,
      apiKey,
      keyword,
      sortOrder,
      period
    );
    for (const id of ids) videoIds.add(id);
  }

  const idList = [...videoIds].slice(0, YOUTUBE_SEARCH_MAX);
  const details = await fetchVideoDetails(callContext, apiKey, idList);

  const collected: ChannelItem[] = [];
  for (const raw of details) {
    const item = mapVideoItem(raw, period);
    if (item) collected.push(item);
  }

  let publicItems = dedupeByLink(collected);
  if (sortOrder === "latest") {
    publicItems = publicItems.sort((a, b) =>
      (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")
    );
  }
  publicItems = publicItems.slice(0, YOUTUBE_SEARCH_MAX);

  return {
    channel: "youtube" as ChannelId,
    publicItems,
    loginRequired: [],
  };
}

export function isYoutubeApiChannel(id: ChannelId): id is "youtube" {
  return id === "youtube";
}
