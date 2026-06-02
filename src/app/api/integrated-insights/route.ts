import { NextRequest, NextResponse } from "next/server";
import {
  createTextMessage,
  extractTextFromMessage,
  getAnthropicClient,
} from "@/lib/anthropic";
import { normalizeDateRange } from "@/lib/date-range";
import { buildIntegratedInsightsPrompt } from "@/lib/prompt";
import { parseInsightsResponse } from "@/lib/parse-response";
import type { ChannelResult, MonitorDateRange } from "@/types/monitor";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { groups, period } = body as {
      groups: {
        groupId: string;
        keywords: string[];
        channels: ChannelResult[];
      }[];
      period: MonitorDateRange;
    };

    const normalizedPeriod = normalizeDateRange(period);
    const client = getAnthropicClient();

    const prompt = buildIntegratedInsightsPrompt(groups, normalizedPeriod);
    const message = await createTextMessage(client, prompt, "claude-sonnet-4-5");
    const rawText = extractTextFromMessage(message);

    // JSON 파싱
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "인사이트 파싱 오류" }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "오류 발생";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
