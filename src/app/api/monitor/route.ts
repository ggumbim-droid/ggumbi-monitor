import { NextRequest, NextResponse } from "next/server";
import {
  createMessageWithWebSearch,
  createTextMessage,
  extractTextFromMessage,
  getAnthropicClient,
} from "@/lib/anthropic";
import { normalizeChannelIds } from "@/lib/channels";
import { isValidDateRange, normalizeDateRange } from "@/lib/date-range";
import {
  isNaverApiChannel,
  searchNaverChannels,
} from "@/lib/naver-search";
import {
  isMetaAdsApiChannel,
  searchMetaAdsChannel,
} from "@/lib/meta-ads-search";
import {
  isYoutubeApiChannel,
  searchYoutubeChannel,
} from "@/lib/youtube-search";
import {
  isSmartstoreChannel,
  searchSmartstore,
} from "@/lib/naver-shopping";
import {
  isSmartstoreReviewsChannel,
  searchSmartstoreReviews,
} from "@/lib/smartstore-reviews";
import {
  parseInsightsResponse,
  parseMonitorResponse,
} from "@/lib/parse-response";
import {
  buildInsightsPrompt,
  buildMonitorPrompt,
  getClaudeWebSearchChannels,
  getWebSearchMaxUses,
} from "@/lib/prompt";
import type {
  ChannelId,
  ChannelResult,
  MonitorRequest,
  MonitorResult,
  SortOrder,
} from "@/types/monitor";

const MONITOR_MODEL = "claude-sonnet-4-5";

function normalizeKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((k): k is string => typeof k === "string")
    .map((k) => k.trim())
    .filter(Boolean);
}

function normalizeSortOrder(raw: unknown): SortOrder {
  return raw === "relevance" ? "relevance" : "latest";
}

function emptyChannel(id: ChannelId): ChannelResult {
  return { channel: id, publicItems: [], loginRequired: [] };
}

function mergeChannelResults(
  selectedChannels: ChannelId[],
  apiResults: ChannelResult[],
  claudeResults: ChannelResult[]
): ChannelResult[] {
  const byId = new Map<ChannelId, ChannelResult>();
  for (const r of [...apiResults, ...claudeResults]) {
    byId.set(r.channel, r);
  }
  return selectedChannels.map((id) => byId.get(id) ?? emptyChannel(id));
}

function buildMonitorResult(
  channels: ChannelResult[],
  keywords: string[],
  sortOrder: SortOrder,
  selectedChannels: ChannelId[],
  period: ReturnType<typeof normalizeDateRange>,
  insights: MonitorResult["insights"]
): MonitorResult {
  return parseMonitorResponse(
    JSON.stringify({ channels, insights }),
    keywords,
    sortOrder,
    selectedChannels,
    period
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MonitorRequest;
    const keywords = normalizeKeywords(body.keywords);
    if (keywords.length === 0) {
      return NextResponse.json(
        { error: "최소 1개의 키워드를 입력해 주세요." },
        { status: 400 }
      );
    }
    const sortOrder = normalizeSortOrder(body.sortOrder);
    const selectedChannels = normalizeChannelIds(body.channels);
    const period = normalizeDateRange(body.period);

    if (selectedChannels.length === 0) {
      return NextResponse.json(
        { error: "최소 1개의 채널을 선택해 주세요." },
        { status: 400 }
      );
    }

    if (!isValidDateRange(period.startDate, period.endDate)) {
      return NextResponse.json(
        { error: "시작일은 종료일보다 이후일 수 없습니다." },
        { status: 400 }
      );
    }

    const naverChannelIds = selectedChannels.filter(isNaverApiChannel);
    const youtubeSelected = selectedChannels.some(isYoutubeApiChannel);
    const metaAdsSelected = selectedChannels.some(isMetaAdsApiChannel);
    const smartstoreSelected = selectedChannels.some(isSmartstoreChannel);
    const smartstoreReviewsSelected = selectedChannels.some(isSmartstoreReviewsChannel);
    const claudeChannelIds = getClaudeWebSearchChannels(
      selectedChannels.filter(
        (id) => !isSmartstoreChannel(id) && !isSmartstoreReviewsChannel(id)
      )
    );

    const naverResults =
      naverChannelIds.length > 0
        ? await searchNaverChannels(naverChannelIds, keywords, sortOrder, period)
        : [];

    const youtubeResult = youtubeSelected
      ? await searchYoutubeChannel(keywords, sortOrder, period)
      : null;

    const metaAdsResult = metaAdsSelected
      ? await searchMetaAdsChannel(keywords, sortOrder, period)
      : null;

    const smartstoreResult = smartstoreSelected
      ? await searchSmartstore(keywords, sortOrder, period)
      : null;

    const smartstoreReviewsResult = smartstoreReviewsSelected
      ? await searchSmartstoreReviews(keywords)
      : null;

    const apiResults = [
      ...naverResults,
      ...(youtubeResult ? [youtubeResult] : []),
      ...(metaAdsResult ? [metaAdsResult] : []),
      ...(smartstoreResult ? [smartstoreResult] : []),
      ...(smartstoreReviewsResult ? [smartstoreReviewsResult] : []),
    ];

    let claudeParsed: MonitorResult | null = null;

    if (claudeChannelIds.length > 0) {
      const client = getAnthropicClient();
      const prompt = buildMonitorPrompt(
        keywords,
        sortOrder,
        claudeChannelIds,
        period
      );
      const maxUses = getWebSearchMaxUses(claudeChannelIds.length);
      const message = await createMessageWithWebSearch(
        client,
        prompt,
        maxUses,
        MONITOR_MODEL
      );
      const rawText = extractTextFromMessage(message);
      claudeParsed = parseMonitorResponse(
        rawText,
        keywords,
        sortOrder,
        claudeChannelIds,
        period
      );
    }

    const channels = mergeChannelResults(
      selectedChannels,
      apiResults,
      claudeParsed?.channels ?? []
    );

    let insights =
      claudeParsed?.insights ?? {
        consumerInterests: [],
        positiveKeywords: [],
        negativeKeywords: [],
        immediateAction: "추가 모니터링 후 대응 방안을 검토하세요.",
        channelHighlights: [] as string[],
      };

    if (
      naverChannelIds.length > 0 ||
      youtubeSelected ||
      metaAdsSelected ||
      smartstoreSelected ||
      smartstoreReviewsSelected
    ) {
      const client = getAnthropicClient();
      const insightsPrompt = buildInsightsPrompt(keywords, channels, period);
      const insightsMessage = await createTextMessage(
        client,
        insightsPrompt,
        MONITOR_MODEL
      );
      insights = parseInsightsResponse(
        extractTextFromMessage(insightsMessage)
      );
    }

    const result = buildMonitorResult(
      channels,
      keywords,
      sortOrder,
      selectedChannels,
      period,
      insights
    );

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    let status = 502;
    if (
      message.includes("ANTHROPIC_API_KEY") ||
      message.includes("NAVER_CLIENT_ID") ||
      message.includes("NAVER_CLIENT_SECRET") ||
      message.includes("YOUTUBE_API_KEY") ||
      message.includes("META_ACCESS_TOKEN") ||
      message.includes("META_APP_ID")
    ) {
      status = 500;
    }
    console.error("[monitor]", error);
    return NextResponse.json({ error: message }, { status });
  }
}

export const maxDuration = 180;
