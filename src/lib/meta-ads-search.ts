import { toISODate } from "@/lib/date-range";
import type {
  ChannelId,
  ChannelItem,
  ChannelResult,
  MonitorDateRange,
  SortOrder,
} from "@/types/monitor";

const META_ADS_ARCHIVE_URL = "https://graph.facebook.com/v18.0/ads_archive";
const META_SEARCH_MAX = 10;
const META_API_CALL_DELAY_MS = 300;

const META_FIELDS = [
  "id",
  "page_name",
  "ad_creative_bodies",
  "ad_delivery_start_time",
  "publisher_platforms",
  "ad_snapshot_url",
].join(",");

interface MetaApiCallContext {
  priorCalls: number;
}

interface MetaAdsArchiveAd {
  id?: string;
  page_name?: string;
  ad_creative_bodies?: string[];
  ad_delivery_start_time?: string;
  publisher_platforms?: string[];
  ad_snapshot_url?: string;
}

interface MetaAdsArchiveResponse {
  data?: MetaAdsArchiveAd[];
  error?: { message?: string; type?: string; code?: number };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getMetaCredentials(): { accessToken: string; appId: string } {
  const accessToken = process.env.META_ACCESS_TOKEN?.trim();
  const appId = process.env.META_APP_ID?.trim();
  if (!accessToken || !appId) {
    throw new Error(
      "META_ACCESS_TOKEN, META_APP_ID 환경변수가 설정되지 않았습니다."
    );
  }
  return { accessToken, appId };
}

function formatPlatforms(platforms: string[] | undefined): string {
  if (!platforms?.length) return "";
  const labels = platforms.map((p) => {
    const key = p.toUpperCase();
    if (key === "FACEBOOK") return "FB";
    if (key === "INSTAGRAM") return "IG";
    if (key === "MESSENGER") return "Messenger";
    if (key === "AUDIENCE_NETWORK") return "Audience Network";
    return p;
  });
  return labels.join(", ");
}

function parseDeliveryStartDate(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return toISODate(parsed);
}

function isWithinPeriod(publishedAt: string, period: MonitorDateRange): boolean {
  return publishedAt >= period.startDate && publishedAt <= period.endDate;
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

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

async function metaFetch<T>(
  callContext: MetaApiCallContext,
  url: URL
): Promise<T> {
  if (callContext.priorCalls > 0) {
    await delay(META_API_CALL_DELAY_MS);
  }
  callContext.priorCalls += 1;

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  const body = (await res.json().catch(() => ({}))) as T & {
    error?: { message?: string };
  };

  if (!res.ok) {
    const message =
      (body as { error?: { message?: string } }).error?.message ??
      res.statusText;
    throw new Error(`Meta Ad Library API 오류 (${res.status}): ${message}`);
  }

  const apiError = (body as MetaAdsArchiveResponse).error;
  if (apiError?.message) {
    throw new Error(`Meta Ad Library API 오류: ${apiError.message}`);
  }

  return body;
}

async function fetchAdsByKeyword(
  callContext: MetaApiCallContext,
  accessToken: string,
  searchTerm: string,
  period: MonitorDateRange
): Promise<MetaAdsArchiveAd[]> {
  const url = new URL(META_ADS_ARCHIVE_URL);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("search_terms", searchTerm);
  url.searchParams.set("ad_reached_countries", JSON.stringify(["KR"]));
  url.searchParams.set("ad_active_status", "ALL");
  url.searchParams.set("ad_type", "ALL");
  url.searchParams.set("limit", String(META_SEARCH_MAX));
  url.searchParams.set("fields", META_FIELDS);
  url.searchParams.set("ad_delivery_date_min", period.startDate);
  url.searchParams.set("ad_delivery_date_max", period.endDate);

  const data = await metaFetch<MetaAdsArchiveResponse>(callContext, url);
  return data.data ?? [];
}

function mapAdItem(
  raw: MetaAdsArchiveAd,
  period: MonitorDateRange
): ChannelItem | null {
  const publishedAt = parseDeliveryStartDate(raw.ad_delivery_start_time);
  if (!publishedAt || !isWithinPeriod(publishedAt, period)) return null;

  const adText = (raw.ad_creative_bodies ?? []).join(" ").trim();
  const advertiser = raw.page_name?.trim() || "Meta 광고";
  const platforms = formatPlatforms(raw.publisher_platforms);

  const title = adText
    ? truncate(adText, 80)
    : `${advertiser} 광고`;

  const previewParts: string[] = [];
  if (platforms) previewParts.push(`플랫폼: ${platforms}`);
  if (adText && adText !== title) previewParts.push(truncate(adText, 120));
  const preview = previewParts.join(" · ") || platforms || "광고 소재";

  const link =
    raw.ad_snapshot_url?.trim() ||
    (raw.id
      ? `https://www.facebook.com/ads/library/?id=${encodeURIComponent(raw.id)}`
      : "");

  return {
    source: advertiser,
    title,
    preview,
    link,
    publishedAt,
    tag: platforms || "광고",
  };
}

export async function searchMetaAdsChannel(
  keywords: string[],
  sortOrder: SortOrder,
  period: MonitorDateRange
): Promise<ChannelResult> {
  const { accessToken } = getMetaCredentials();
  const callContext: MetaApiCallContext = { priorCalls: 0 };
  const collected: ChannelItem[] = [];

  for (const keyword of keywords) {
    const ads = await fetchAdsByKeyword(
      callContext,
      accessToken,
      keyword,
      period
    );
    for (const raw of ads) {
      const item = mapAdItem(raw, period);
      if (item) collected.push(item);
    }
  }

  let publicItems = dedupeByLink(collected);
  if (sortOrder === "latest") {
    publicItems = publicItems.sort((a, b) =>
      (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")
    );
  }
  publicItems = publicItems.slice(0, META_SEARCH_MAX);

  return {
    channel: "meta_ads" as ChannelId,
    publicItems,
    loginRequired: [],
  };
}

export function isMetaAdsApiChannel(id: ChannelId): id is "meta_ads" {
  return false; // Claude 웹서치로 처리
}
