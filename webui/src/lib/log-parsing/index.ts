import type { LogEntry } from "@/lib/api";
import { anthropicAdapter } from "./adapters/anthropic";
import { fallbackAdapter } from "./adapters/fallback";
import { openAIChatAdapter } from "./adapters/openai-chat";
import { openAIResponsesAdapter } from "./adapters/openai-responses";
import type { AdapterInput, LogAdapter } from "./adapters/types";
import { lastTextFromContentParts, parseJson, parseJsonObject } from "./json";
import type { ParsedLog, ParsedMessage, ParsedResponseItem } from "./types";

const adapters: LogAdapter[] = [
  openAIResponsesAdapter,
  anthropicAdapter,
  openAIChatAdapter,
  fallbackAdapter,
];

function getEffectiveResponseBody(log: LogEntry): string | null {
  if (log.is_streaming && log.response_body) {
    return log.response_body;
  }
  return log.response_body_finish;
}

function firstUserMessage(messages: ParsedMessage[]): string | null {
  const userMessage = messages.find((message) => message.role === "user");
  if (!userMessage) return null;
  return lastTextFromContentParts(userMessage.content);
}

function countMessageToolCalls(messages: ParsedMessage[]): number {
  return messages.reduce((count, message) => {
    const explicitCalls = Array.isArray(message.tool_calls)
      ? message.tool_calls.length
      : 0;
    const messageIsToolCall = message.role === "function_call" ? 1 : 0;
    return count + explicitCalls + messageIsToolCall;
  }, 0);
}

function countResponseToolCalls(items: ParsedResponseItem[]): number {
  return items.filter((item) => item.kind === "tool_call").length;
}

export function parseLog(log: LogEntry): ParsedLog {
  const effectiveResponseBody = getEffectiveResponseBody(log);
  const input: AdapterInput = {
    log,
    requestBody: parseJsonObject(log.request_body),
    responseBody: parseJson(effectiveResponseBody),
    streamingChunks: parseJson(log.response_body),
    effectiveResponseBody,
  };
  const adapter = adapters.find((candidate) => candidate.matches(input)) ?? fallbackAdapter;
  const request = adapter.parseRequest(input);
  const response = adapter.parseResponse(input);

  return {
    provider: log.provider,
    protocol: adapter.protocol,
    request,
    response,
    summary: {
      firstUserMessage: firstUserMessage(request.messages),
      messageCount: request.messages.length,
      toolsDefinedCount: request.tools.length,
      toolCallCount:
        countMessageToolCalls(request.messages) + countResponseToolCalls(response.items),
      hasToolsDefined: request.tools.length > 0,
      hasToolCalls: response.hasToolCalls,
    },
    raw: {
      requestHeaders: parseJson(log.request_headers),
      requestBody: input.requestBody,
      responseBody: parseJson(log.response_body_finish),
      streamingChunks: input.streamingChunks,
    },
  };
}

export type {
  LogProtocol,
  ParsedLog,
  ParsedMessage,
  ParsedResponseItem,
  ParsedTool,
} from "./types";
export { stringifyContent, tryParseJsonContent } from "./json";
