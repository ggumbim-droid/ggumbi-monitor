/** API/LLM 응답에서 원문 URL 추출 (빈 문자열이면 링크 없음) */
export function extractItemLink(
  row: Record<string, unknown>
): string {
  const candidates = [row.link, row.url, row.originallink, row.originLink];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}
