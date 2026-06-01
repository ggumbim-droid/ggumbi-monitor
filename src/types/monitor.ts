export type SortOrder = "latest" | "relevance";

export type DateRangePreset =
  | "last_week"
  | "recent_2_weeks"
  | "this_month"
  | "custom";

export interface MonitorDateRange {
  startDate: string;
  endDate: string;
  preset?: DateRangePreset;
}

export type ChannelId =
  | "naver_cafe"
  | "naver_blog"
  | "naver_news"
  | "youtube"
  | "instagram"
  | "meta_ads"
  | "smartstore"
  | "smartstore_reviews"
  | "naver_ranking";

/** @deprecated Use ChannelItem */
export interface CafePost {
  cafeName: string;
  title: string;
  preview: string;
  link: string;
}

export interface ChannelItem {
  source: string;
  title: string;
  preview: string;
  link: string;
  publishedAt?: string;
  tag?: string;
}

export interface LoginRequiredItem {
  channel: ChannelId;
  source: string;
  title: string;
  reason?: string;
  link?: string;
}

export interface ReviewTrendPoint {
  date: string;
  reviewCount: number;
  label?: string;
}

export interface SmartStoreReviewData {
  productName: string;
  brandName: string;
  storeUrl: string;
  currentTotalReviews: number;
  lastWeekTotalReviews: number;
  thisWeekNewReviews: number;
  lastWeekNewReviews: number;
  changeRatePercent: number;
  trend: ReviewTrendPoint[];
  interpretation: string;
}

export interface ChannelResult {
  channel: ChannelId;
  publicItems: ChannelItem[];
  loginRequired: LoginRequiredItem[];
  reviewData?: SmartStoreReviewData;
}

export interface Insights {
  consumerInterests: string[];
  positiveKeywords: string[];
  negativeKeywords: string[];
  immediateAction: string;
  channelHighlights?: string[];
}

export interface MonitorResult {
  channels: ChannelResult[];
  insights: Insights;
  searchedAt: string;
  keywords: string[];
  sortOrder: SortOrder;
  selectedChannels: ChannelId[];
  period: MonitorDateRange;
  /** @deprecated Derived from naver_cafe channel */
  publicPosts?: CafePost[];
  /** @deprecated Aggregated login items */
  loginRequired?: LoginRequiredItem[];
}

export interface MonitorRequest {
  keywords: string[];
  sortOrder: SortOrder;
  channels?: ChannelId[];
  period?: MonitorDateRange;
}
