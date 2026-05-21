import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Message } from "@anthropic-ai/sdk/resources/messages";

const DEFAULT_MODEL = "claude-sonnet-4-5";

export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.");
  }
  return new Anthropic({ apiKey });
}

export function getModel(): string {
  return process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
}

export function extractTextFromMessage(message: Message): string {
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => ("text" in block ? block.text : ""))
    .join("\n");
}

export async function createMessageWithWebSearch(
  client: Anthropic,
  userPrompt: string,
  maxUses = 8,
  modelOverride?: string
): Promise<Message> {
  const messages: MessageParam[] = [{ role: "user", content: userPrompt }];
  const model = modelOverride ?? getModel();

  for (let turn = 0; turn < 12; turn++) {
    const response = await client.messages.create({
      model,
      max_tokens: 8192,
      messages,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: maxUses,
        } as unknown as Anthropic.Messages.Tool,
      ],
    });

    if ((response.stop_reason as string | null) === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    return response;
  }

  throw new Error("웹 검색 응답이 최대 턴 수를 초과했습니다. 잠시 후 다시 시도해 주세요.");
}

export async function createTextMessage(
  client: Anthropic,
  userPrompt: string,
  modelOverride?: string
): Promise<Message> {
  const model = modelOverride ?? getModel();
  return client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content: userPrompt }],
  });
}
