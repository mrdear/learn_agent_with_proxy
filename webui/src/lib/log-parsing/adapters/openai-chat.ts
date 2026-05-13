import type { LogAdapter, AdapterInput } from "./types";
import type { ParsedMessage, ParsedResponseItem } from "../types";
import {
  getParams,
  getTools,
  hasResponseToolCalls,
  normalizeSystemContent,
} from "./shared";

function parseMessages(body: Record<string, unknown> | null): ParsedMessage[] {
  if (!Array.isArray(body?.messages)) return [];
  return body.messages as ParsedMessage[];
}

function parseSystemPrompt(messages: ParsedMessage[]): string | null {
  const systemMessages = messages.filter(
    (message) => message.role === "system" || message.role === "developer",
  );
  if (systemMessages.length === 0) return null;

  return systemMessages
    .map((message) => normalizeSystemContent(message.content))
    .filter((content): content is string => Boolean(content))
    .join("\n---\n");
}

function parseResponseItems(responseBody: unknown): ParsedResponseItem[] {
  if (!responseBody || typeof responseBody !== "object" || Array.isArray(responseBody)) {
    return [];
  }

  const choices = (responseBody as Record<string, unknown>).choices;
  if (!Array.isArray(choices)) return [];

  return choices.flatMap((choice) => {
    if (!choice || typeof choice !== "object") return [];
    const message = (choice as Record<string, unknown>).message as
      | Record<string, unknown>
      | undefined;
    if (!message) return [];

    const items: ParsedResponseItem[] = [];
    if (message.content !== null && message.content !== undefined) {
      items.push({
        kind: "message",
        role: (message.role as string) || "assistant",
        content: message.content,
        raw: message,
      });
    }

    if (Array.isArray(message.tool_calls)) {
      items.push(
        ...message.tool_calls.map((toolCall) => ({
          kind: "tool_call" as const,
          role: "function_call",
          content: toolCall,
          name:
            typeof toolCall === "object" && toolCall !== null
              ? (((toolCall as Record<string, unknown>).function as Record<string, unknown> | undefined)
                  ?.name as string | undefined)
              : undefined,
          raw: toolCall,
        })),
      );
    }

    return items;
  });
}

export const openAIChatAdapter: LogAdapter = {
  protocol: "openai-chat",
  matches(input: AdapterInput) {
    if (input.log.provider !== "openai") return false;
    return Array.isArray(input.requestBody?.messages);
  },
  parseRequest(input: AdapterInput) {
    const messages = parseMessages(input.requestBody);
    return {
      messages,
      systemPrompt: parseSystemPrompt(messages),
      tools: getTools(input.requestBody),
      params: getParams(input.requestBody),
    };
  },
  parseResponse(input: AdapterInput) {
    const items = parseResponseItems(input.responseBody);
    return {
      items,
      raw: input.responseBody,
      effectiveBody: input.effectiveResponseBody,
      hasToolCalls: hasResponseToolCalls(items),
    };
  },
};
