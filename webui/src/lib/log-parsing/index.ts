import type { LogEntry } from "@/lib/api";
import { anthropicAdapter } from "./adapters/anthropic";
import { fallbackAdapter } from "./adapters/fallback";
import { openAIChatAdapter } from "./adapters/openai-chat";
import { openAIResponsesAdapter } from "./adapters/openai-responses";
import type { AdapterInput, LogAdapter } from "./adapters/types";
import { parseJson, parseJsonObject, textFromContentParts } from "./json";
import type { ParsedLog, ParsedMessage } from "./types";

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
  return textFromContentParts(userMessage.content);
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
