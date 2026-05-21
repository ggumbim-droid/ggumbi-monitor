import { getChannelMeta } from "@/lib/channels";
import { formatMonitorPeriodLabel } from "@/lib/date-range";
import type { ChannelResult, MonitorResult } from "@/types/monitor";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatChannelSection(channel: ChannelResult): string[] {
  const meta = getChannelMeta(channel.channel);
  const lines: string[] = [
    `## ${meta.label}`,
    "",
  ];

  if (channel.channel === "smartstore_reviews" && channel.reviewData) {
    const r = channel.reviewData;
    lines.push(
      `### ${r.brandName ? `${r.brandName} · ` : ""}${r.productName}`,
      "",
      `| 항목 | 값 |`,
      `|------|-----|`,
      `| 현재 리뷰 총 수 | ${r.currentTotalReviews.toLocaleString("ko-KR")}건 |`,
      `| 이번 주 신규 리뷰 | ${r.thisWeekNewReviews}건 |`,
      `| 지난 주 신규 리뷰 | ${r.lastWeekNewReviews}건 |`,
      `| 주간 증감률 | ${r.changeRatePercent > 0 ? "+" : ""}${r.changeRatePercent.toFixed(1)}% |`,
      "",
      "**추이 (주별)**",
      ""
    );
    for (const point of r.trend) {
      const label = point.label ?? point.date;
      lines.push(`- ${label}: ${point.reviewCount.toLocaleString("ko-KR")}건`);
    }
    lines.push(
      "",
      `> ${r.interpretation}`,
      r.storeUrl ? `[스토어 보기](${r.storeUrl})` : "",
      ""
    );
    return lines;
  }

  lines.push(`### 공개 콘텐츠 (${channel.publicItems.length}건)`, "");

  if (channel.publicItems.length === 0) {
    lines.push("_수집된 공개 콘텐츠가 없습니다._", "");
  } else {
    for (const item of channel.publicItems) {
      lines.push(
        `### [${item.source}] ${item.title}`,
        item.tag ? `🏷 ${item.tag}` : "",
        item.preview,
        item.publishedAt ? `📅 ${item.publishedAt}` : "",
        item.link ? `[링크](${item.link})` : "",
        ""
      );
    }
  }

  if (channel.loginRequired.length > 0) {
    lines.push(
      `### 로그인·직접 확인 필요 (${channel.loginRequired.length}건)`,
      ""
    );
    for (const item of channel.loginRequired) {
      lines.push(
        `- **[${item.source}]** ${item.title}`,
        item.reason ? `  - 사유: ${item.reason}` : "",
        item.link ? `  - 링크: ${item.link}` : ""
      );
    }
    lines.push("");
  }

  return lines;
}

export function buildNotionReport(result: MonitorResult): string {
  const sortLabel = result.sortOrder === "latest" ? "최신순" : "관련도순";
  const channelLabels = result.selectedChannels
    .map((id) => getChannelMeta(id).label)
    .join(", ");

  const periodLabel = result.period
    ? formatMonitorPeriodLabel(result.period.startDate, result.period.endDate)
    : "기간 미지정";

  const lines: string[] = [
    "# 꿈비 그룹 · 전 채널 통합 경쟁사 모니터링 리포트",
    "",
    `> **모니터링 기간: ${periodLabel}**`,
    `> 수집 시각: ${formatDate(result.searchedAt)} | 정렬: ${sortLabel}`,
    `> 키워드: ${result.keywords.join(", ")}`,
    `> 채널: ${channelLabels}`,
    "",
    "---",
    "",
    "## 전 채널 통합 AI 인사이트",
    "",
    "### 소비자 주요 관심사",
    ...result.insights.consumerInterests.map((i) => `- ${i}`),
    "",
    "### 긍정 키워드 Top 3",
    ...result.insights.positiveKeywords.map((k, i) => `${i + 1}. ${k}`),
    "",
    "### 부정 키워드 Top 3",
    ...result.insights.negativeKeywords.map((k, i) => `${i + 1}. ${k}`),
    "",
    "### 즉시 대응 액션",
    `> ${result.insights.immediateAction}`,
    "",
  ];

  if (result.insights.channelHighlights?.length) {
    lines.push("### 채널별 핵심 요약", "");
    for (const h of result.insights.channelHighlights) {
      lines.push(`- ${h}`);
    }
    lines.push("");
  }

  lines.push("---", "", "## 채널별 수집 결과", "");

  for (const channel of result.channels) {
    lines.push(...formatChannelSection(channel), "---", "");
  }

  const allLogin = result.channels.flatMap((c) => c.loginRequired);
  if (allLogin.length > 0) {
    lines.push(
      "## 팀원 직접 확인 필요 (전체)",
      ""
    );
    for (const item of allLogin) {
      const meta = getChannelMeta(item.channel);
      lines.push(
        `- **[${meta.shortLabel} · ${item.source}]** ${item.title}`,
        item.reason ? `  - 사유: ${item.reason}` : "",
        item.link ? `  - 링크: ${item.link}` : ""
      );
    }
    lines.push("");
  }

  lines.push("---", "", "_꿈비 그룹 전 채널 경쟁사 모니터링 웹앱 자동 생성_");
  return lines.filter((l) => l !== undefined).join("\n");
}
