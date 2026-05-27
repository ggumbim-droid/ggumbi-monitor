import { getChannelMeta } from "@/lib/channels";
import { formatPeriodForPrompt } from "@/lib/date-range";
import { isMetaAdsApiChannel } from "@/lib/meta-ads-search";
import { isNaverApiChannel } from "@/lib/naver-search";
import { isYoutubeApiChannel } from "@/lib/youtube-search";
import type {
  ChannelId,
  ChannelResult,
  MonitorDateRange,
  SortOrder,
} from "@/types/monitor";

/** Claude web_search로 수집하는 채널 */
export function getClaudeWebSearchChannels(
  selected: ChannelId[]
): ChannelId[] {
  return selected.filter(
    (id) =>
      !isNaverApiChannel(id) &&
      !isYoutubeApiChannel(id) &&
      !isMetaAdsApiChannel(id)
  );
}

function buildChannelInstructions(selected: ChannelId[]): string {
  return selected
    .map((id) => {
      const meta = getChannelMeta(id);
      switch (id) {
        case "naver_cafe":
          return `### ${meta.label}
- 검색: ${meta.searchHint}
- 수집: 신제품·프로모션·소비자 반응 게시글`;
        case "naver_blog":
          return `### ${meta.label}
- 검색: ${meta.searchHint}
- 수집: 리뷰·체험기·비교 후기 블로그 글`;
        case "naver_news":
          return `### ${meta.label}
- 검색: ${meta.searchHint}, 보도자료·언론 기사
- 수집: 브랜드/제품 관련 뉴스·PR`;
        case "youtube":
          return `### ${meta.label}
- 검색: ${meta.searchHint}
- 수집: 리뷰·언박싱·광고·브랜드 관련 영상 (제목·채널명)`;
        case "instagram":
          return `### ${meta.label}
- 검색: site:instagram.com "키워드" 또는 instagram.com/브랜드계정
- 경쟁사 브랜드 계정 직접 검색 (예: instagram.com/ggumbi_official)
- 해시태그 검색: #키워드 #유아용품 #육아 관련 공개 게시물
- 수집: 공개 계정의 최신 게시물 (좋아요수·댓글수 포함 시 기재)
- 광고성 게시물, 신제품 홍보, 이벤트/협찬 게시물 우선 수집
- 로그인 필요 계정은 loginRequired로 분류`;
- 검색: facebook.com/ads/library 에서 브랜드명·제품명 광고 검색
- 수집: 활성/최근 광고 소재 제목·광고주·랜딩 요약`;
        case "smartstore":
          return `### ${meta.label}
- 검색: ${meta.searchHint}
- 수집: 기획전·행사·신제품 출시·할인·쿠폰 이벤트`;
        case "smartstore_reviews":
          return `### ${meta.label}
- 검색: ${meta.searchHint} 상품 페이지
- 수집: 리뷰 총 개수, 최근 4~8주 주간 리뷰 수 추정치
- reviewData 필드 필수: 이번 주 vs 지난 주 신규 리뷰 수, 증감률(%), trend 배열(주별 reviewCount), 판매 추이 간접 지표 해석`;
        default:
          return "";
      }
    })
    .join("\n\n");
}

function buildChannelJsonExample(selected: ChannelId[]): string {
  const blocks = selected.map((id) => {
    const base = {
      channel: id,
      publicItems: [
        {
          source: "출처명",
          title: "제목",
          preview: "요약 80자 내외",
          link: "https://...",
          publishedAt: "2026-05-01 또는 빈 문자열",
          tag: "신제품|프로모션|리뷰 등",
        },
      ],
      loginRequired: [
        {
          channel: id,
          source: "출처명",
          title: "제목",
          reason: "로그인/비공개 사유",
          link: "URL 또는 빈 문자열",
        },
      ],
    };

    if (id === "smartstore_reviews") {
      return JSON.stringify(
        {
          ...base,
          publicItems: [],
          reviewData: {
            productName: "제품명",
            brandName: "브랜드명",
            storeUrl: "https://smartstore.naver.com/...",
            currentTotalReviews: 0,
            lastWeekTotalReviews: 0,
            thisWeekNewReviews: 0,
            lastWeekNewReviews: 0,
            changeRatePercent: 0,
            trend: [
              { date: "2026-04-21", reviewCount: 0, label: "4주 전" },
              { date: "2026-04-28", reviewCount: 0, label: "3주 전" },
              { date: "2026-05-05", reviewCount: 0, label: "2주 전" },
              { date: "2026-05-12", reviewCount: 0, label: "지난 주" },
              { date: "2026-05-19", reviewCount: 0, label: "이번 주" },
            ],
            interpretation:
              "리뷰 증가 속도와 판매 추이 간접 지표 해석 1~2문장",
          },
        },
        null,
        2
      );
    }

    return JSON.stringify(base, null, 2);
  });

  return blocks.join(",\n");
}

export function buildMonitorPrompt(
  keywords: string[],
  sortOrder: SortOrder,
  selectedChannels: ChannelId[],
  period: MonitorDateRange
): string {
  const sortLabel = sortOrder === "latest" ? "최신순" : "관련도순";
  const keywordList = keywords.map((k) => `"${k}"`).join(", ");
  const channelLabels = selectedChannels
    .map((id) => getChannelMeta(id).label)
    .join(", ");
  const periodLabel = formatPeriodForPrompt(period.startDate, period.endDate);

  return `당신은 꿈비 그룹(유아용품 브랜드)의 **전 채널 통합 경쟁사 모니터링** 분석가입니다.
web_search 도구를 사용해 아래 선택된 채널(인스타·스마트스토어 등)에서 키워드 관련 콘텐츠를 검색·수집하세요.
네이버 카페·블로그·뉴스는 네이버 검색 API로, 유튜브는 YouTube Data API로, Meta 광고는 Ad Library API로 별도 수집되므로 이 작업에서 제외합니다.

## 검색 조건
- **모니터링 기간: ${periodLabel}** (${period.startDate} ~ ${period.endDate})
- **반드시 위 기간 내에 게시·업로드·보도·집행된 콘텐츠만** 수집하세요. 기간 밖 콘텐츠는 제외합니다.
- 게시일·업로드일·보도일을 확인할 수 없으면 loginRequired로 분류하거나 제외하세요.
- 모니터링 키워드: ${keywordList}
- 모니터링 채널: ${channelLabels}
- 정렬 기준: ${sortLabel}에 가깝게 결과 선별
- 각 (키워드 × 채널) 조합마다 최소 1회 검색 시도

## 채널별 수집 가이드

${buildChannelInstructions(selectedChannels)}

## 분류 규칙
1. **publicItems**: 로그인 없이 확인 가능한 공개 콘텐츠
2. **loginRequired**: 회원 전용·로그인 필요·비공개·팀원 직접 확인 필요 항목 (channel 필드에 해당 채널 ID)
3. **smartstore_reviews**: publicItems 대신 reviewData 중심으로 작성

## 통합 인사이트 (꿈비 관점, 전 채널 종합)
- 소비자 주요 관심사 3~5개 (전 채널 통합)
- 긍정 키워드 Top 3
- 부정 키워드 Top 3
- 즉시 실행 가능한 대응 액션 1가지 (구체적으로)
- channelHighlights: 채널별 핵심 한 줄 요약 (선택 채널 각 1개)

## 출력 형식
반드시 아래 JSON 스키마만 포함한 단일 JSON 객체를 응답하세요. 마크다운 코드블록 없이 순수 JSON만 출력합니다.

{
  "channels": [
${buildChannelJsonExample(selectedChannels)}
  ],
  "insights": {
    "consumerInterests": ["관심사1", "관심사2"],
    "positiveKeywords": ["긍정1", "긍정2", "긍정3"],
    "negativeKeywords": ["부정1", "부정2", "부정3"],
    "immediateAction": "즉시 대응 액션 1문장",
    "channelHighlights": ["카페: ...", "유튜브: ..."]
  }
}

규칙:
- channels 배열에는 선택된 채널 ID(${selectedChannels.join(", ")})마다 정확히 1개 객체
- publicItems는 채널당 최대 5건, 전체 최대 40건
- publicItems의 publishedAt에는 가능하면 게시일(YYYY-MM-DD)을 기입하고, 반드시 모니터링 기간(${period.startDate}~${period.endDate}) 내 날짜만 포함
- 실제 검색에서 확인된 URL만 포함, 추측 URL 금지
- 검색 결과 없으면 빈 배열 사용
- smartstore_reviews의 trend는 모니터링 기간에 맞춰 주별 누적/신규 리뷰 수로 4~8개 포인트`;
}

export function getWebSearchMaxUses(channelCount: number): number {
  return Math.min(25, Math.max(10, channelCount * 3));
}

export function buildInsightsPrompt(
  keywords: string[],
  channels: ChannelResult[],
  period: MonitorDateRange
): string {
  const keywordList = keywords.map((k) => `"${k}"`).join(", ");
  const periodLabel = formatPeriodForPrompt(period.startDate, period.endDate);
  const channelSummary = channels.map((ch) => {
    const meta = getChannelMeta(ch.channel);
    const items = ch.publicItems
      .slice(0, 8)
      .map(
        (item) =>
          `- [${item.source}] ${item.title}${item.publishedAt ? ` (${item.publishedAt})` : ""}: ${item.preview.slice(0, 120)}`
      )
      .join("\n");
    return `### ${meta.label}\n${items || "_수집 항목 없음_"}`;
  });

  return `꿈비 그룹(유아용품) 경쟁사 모니터링 데이터를 바탕으로 통합 인사이트 JSON만 출력하세요.

## 조건
- 모니터링 기간: ${periodLabel} (${period.startDate} ~ ${period.endDate})
- 키워드: ${keywordList}

## 수집 데이터
${channelSummary.join("\n\n")}

## 출력 (순수 JSON만, 코드블록 없음)
{
  "insights": {
    "consumerInterests": ["관심사1", "관심사2"],
    "positiveKeywords": ["긍정1", "긍정2", "긍정3"],
    "negativeKeywords": ["부정1", "부정2", "부정3"],
    "immediateAction": "즉시 대응 액션 1문장",
    "channelHighlights": ["채널별 한 줄 요약"]
  }
}`;
}
