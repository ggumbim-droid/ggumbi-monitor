import { ALL_CHANNEL_IDS } from "@/lib/channels";
import { normalizeDateRange } from "@/lib/date-range";
import { extractItemLink } from "@/lib/item-link";
import type {
  ChannelId,
  ChannelItem,
  ChannelResult,
  Insights,
  LoginRequiredItem,
  MonitorDateRange,
  MonitorResult,
  ReviewTrendPoint,
  SmartStoreReviewData,
  SortOrder,
} from "@/types/monitor";

function tryParseJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock?.[1]) {
      return JSON.parse(codeBlock[1].trim());
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("JSON 파싱 실패");
  }
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && !Number.isNaN(value) ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function asChannelId(value: unknown, fallback: ChannelId): ChannelId {
  const valid = new Set(ALL_CHANNEL_IDS);
  return typeof value === "string" && valid.has(value as ChannelId)
    ? (value as ChannelId)
    : fallback;
}

function parseChannelItem(item: unknown): ChannelItem {
  const row = (item ?? {}) as Record<string, unknown>;
  return {
    source: asString(row.source) || asString(row.cafeName, "알 수 없음"),
    title: asString(row.title, "제목 없음"),
    preview: asString(row.preview),
    link: extractItemLink(row),
    publishedAt: asString(row.publishedAt) || undefined,
    tag: asString(row.tag) || undefined,
  };
}

function parseLoginItem(item: unknown, defaultChannel: ChannelId): LoginRequiredItem {
  const row = (item ?? {}) as Record<string, unknown>;
  return {
    channel: asChannelId(row.channel, defaultChannel),
    source: asString(row.source) || asString(row.cafeName, "알 수 없음"),
    title: asString(row.title, "제목 없음"),
    reason: asString(row.reason) || undefined,
    link: extractItemLink(row) || undefined,
  };
}

function parseTrend(raw: unknown): ReviewTrendPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((point) => {
      const row = point as Record<string, unknown>;
      return {
        date: asString(row.date),
        reviewCount: asNumber(row.reviewCount),
        label: asString(row.label) || undefined,
      };
    })
    .filter((p) => p.date || p.reviewCount > 0);
}

function parseReviewData(raw: unknown): SmartStoreReviewData | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as Record<string, unknown>;
  const trend = parseTrend(row.trend);
  if (trend.length === 0 && !asString(row.productName)) return undefined;

  return {
    productName: asString(row.productName, "제품명 미확인"),
    brandName: asString(row.brandName),
    storeUrl: asString(row.storeUrl),
    currentTotalReviews: asNumber(row.currentTotalReviews),
    lastWeekTotalReviews: asNumber(row.lastWeekTotalReviews),
    thisWeekNewReviews: asNumber(row.thisWeekNewReviews),
    lastWeekNewReviews: asNumber(row.lastWeekNewReviews),
    changeRatePercent: asNumber(row.changeRatePercent ?? row.changeRate),
    trend,
    interpretation: asString(
      row.interpretation,
      "리뷰 추이 데이터를 추가 확인하세요."
    ),
  };
}

function parseChannelResult(item: unknown, expectedId: ChannelId): ChannelResult {
  const row = (item ?? {}) as Record<string, unknown>;
  const channel = asChannelId(row.channel, expectedId);
  const publicRaw = Array.isArray(row.publicItems)
    ? row.publicItems
    : Array.isArray(row.publicPosts)
      ? row.publicPosts
      : [];

  const loginRaw = Array.isArray(row.loginRequired) ? row.loginRequired : [];

  return {
    channel,
    publicItems: publicRaw.map(parseChannelItem),
    loginRequired: loginRaw.map((l) => parseLoginItem(l, channel)),
    reviewData:
      channel === "smartstore_reviews"
        ? parseReviewData(row.reviewData)
        : undefined,
  };
}

function emptyChannel(id: ChannelId): ChannelResult {
  return { channel: id, publicItems: [], loginRequired: [] };
}

function legacyToChannels(parsed: Record<string, unknown>): ChannelResult[] {
  const publicRaw = Array.isArray(parsed.publicPosts) ? parsed.publicPosts : [];
  const loginRaw = Array.isArray(parsed.loginRequired)
    ? parsed.loginRequired
    : [];

  return [
    {
      channel: "naver_cafe",
      publicItems: publicRaw.map(parseChannelItem),
      loginRequired: loginRaw.map((l) =>
        parseLoginItem(l, "naver_cafe")
      ),
    },
  ];
}

function attachLegacyFields(result: MonitorResult): MonitorResult {
  const cafe = result.channels.find((c) => c.channel === "naver_cafe");
  const allLogin = result.channels.flatMap((c) => c.loginRequired);

  return {
    ...result,
    publicPosts: cafe?.publicItems.map((item) => ({
      cafeName: item.source,
      title: item.title,
      preview: item.preview,
      link: item.link,
    })),
    loginRequired: allLogin,
  };
}

export function parseInsightsResponse(rawText: string): Insights {
  const parsed = tryParseJson(rawText) as Record<string, unknown>;
  const insightsRaw =
    parsed.insights && typeof parsed.insights === "object"
      ? (parsed.insights as Record<string, unknown>)
      : parsed;

  return {
    consumerInterests: asStringArray(insightsRaw.consumerInterests),
    positiveKeywords: asStringArray(insightsRaw.positiveKeywords).slice(0, 3),
    negativeKeywords: asStringArray(insightsRaw.negativeKeywords).slice(0, 3),
    immediateAction: asString(
      insightsRaw.immediateAction,
      "추가 모니터링 후 대응 방안을 검토하세요."
    ),
    channelHighlights: asStringArray(insightsRaw.channelHighlights),
  };
}

export function parseMonitorResponse(
  rawText: string,
  keywords: string[],
  sortOrder: SortOrder,
  selectedChannels: ChannelId[],
  period: MonitorDateRange
): MonitorResult {
  const parsed = tryParseJson(rawText) as Record<string, unknown>;

  let channels: ChannelResult[];

  if (Array.isArray(parsed.channels)) {
    const byId = new Map<ChannelId, ChannelResult>();
    for (const item of parsed.channels) {
      const row = item as Record<string, unknown>;
      const id = asChannelId(row.channel, "naver_cafe");
      byId.set(id, parseChannelResult(item, id));
    }
    channels = selectedChannels.map(
      (id) => byId.get(id) ?? emptyChannel(id)
    );
  } else {
    channels = legacyToChannels(parsed).filter((c) =>
      selectedChannels.includes(c.channel)
    );
    for (const id of selectedChannels) {
      if (!channels.some((c) => c.channel === id)) {
        channels.push(emptyChannel(id));
      }
    }
  }

  const insightsRaw =
    parsed.insights && typeof parsed.insights === "object"
      ? (parsed.insights as Record<string, unknown>)
      : {};

  const result: MonitorResult = {
    channels,
    insights: {
      consumerInterests: asStringArray(insightsRaw.consumerInterests),
      positiveKeywords: asStringArray(insightsRaw.positiveKeywords).slice(0, 3),
      negativeKeywords: asStringArray(insightsRaw.negativeKeywords).slice(0, 3),
      immediateAction: asString(
        insightsRaw.immediateAction,
        "추가 모니터링 후 대응 방안을 검토하세요."
      ),
      channelHighlights: asStringArray(insightsRaw.channelHighlights),
    },
    searchedAt: new Date().toISOString(),
    keywords,
    sortOrder,
    selectedChannels,
    period: normalizeDateRange(period),
  };

  return attachLegacyFields(result);
}
