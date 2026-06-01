import type { ChannelId } from "@/types/monitor";

export interface ChannelMeta {
  id: ChannelId;
  label: string;
  shortLabel: string;
  description: string;
  searchHint: string;
}

export const CHANNELS: ChannelMeta[] = [
  {
    id: "naver_cafe",
    label: "네이버 카페",
    shortLabel: "카페",
    description: "카페 게시글·소비자 반응",
    searchHint: "site:cafe.naver.com 또는 cafe.naver.com",
  },
  {
    id: "naver_blog",
    label: "네이버 블로그",
    shortLabel: "블로그",
    description: "블로그 리뷰·체험기",
    searchHint: "site:blog.naver.com",
  },
  {
    id: "naver_news",
    label: "네이버 뉴스 / 보도자료",
    shortLabel: "뉴스",
    description: "언론·보도자료",
    searchHint: "site:news.naver.com 또는 보도자료",
  },
  {
    id: "youtube",
    label: "유튜브",
    shortLabel: "유튜브",
    description: "영상·리뷰 콘텐츠",
    searchHint: "site:youtube.com",
  },
  {
    id: "instagram",
    label: "인스타그램",
    shortLabel: "인스타",
    description: "공개 게시물·해시태그",
    searchHint: "site:instagram.com 공개 프로필/게시물",
  },
  {
    id: "meta_ads",
    label: "Meta 광고 라이브러리",
    shortLabel: "Meta 광고",
    description: "Facebook/Instagram 광고",
    searchHint: "facebook.com/ads/library 검색",
  },
  {
    id: "smartstore",
    label: "스마트스토어 / 자사몰",
    shortLabel: "스토어",
    description: "기획전·행사·신제품·할인",
    searchHint: "smartstore.naver.com 기획전·이벤트",
  },
  {
    id: "smartstore_reviews",
    label: "스마트스토어 리뷰 추이",
    shortLabel: "리뷰 추이",
    description: "리뷰 수·주간 증감",
    searchHint: "smartstore.naver.com 상품 리뷰 수",
  },
  {
    id: "naver_ranking",
    label: "검색 노출 순위 추이",
    shortLabel: "순위 추이",
    description: "네이버 쇼핑 검색 순위·주간 변화",
    searchHint: "네이버 쇼핑 검색 순위",
  },
];

export const ALL_CHANNEL_IDS: ChannelId[] = CHANNELS.map((c) => c.id);

export function getChannelMeta(id: ChannelId): ChannelMeta {
  return CHANNELS.find((c) => c.id === id) ?? CHANNELS[0];
}

export function normalizeChannelIds(raw: unknown): ChannelId[] {
  if (!Array.isArray(raw)) return [...ALL_CHANNEL_IDS];
  const valid = new Set(ALL_CHANNEL_IDS);
  const cleaned = raw.filter(
    (id): id is ChannelId => typeof id === "string" && valid.has(id as ChannelId)
  );
  return cleaned.length > 0 ? cleaned : [...ALL_CHANNEL_IDS];
}
