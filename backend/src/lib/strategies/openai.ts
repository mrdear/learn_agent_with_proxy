import OpenAI from "openai";
import type { RequestBodyInspection, StreamSummary, Tokens } from "../proxy.js";
import {
  OPENAI_API_KEY,
  OPENAI_BASE_URL,
  OPENAI_DEFAULT_MODEL,
  getSdkTargetUrl,
  prepareOpenAIHeaders,
  prepareRelayBody,
  readNumber,
  sendSdkRequest,
} from "./shared.js";
import type { RelayStrategy, RelayRequest } from "./types.js";

const relayClient = new OpenAI({
  baseURL: OPENAI_BASE_URL,
  apiKey: OPENAI_API_KEY,
});

function extractOpenAITokens(data: Record<string, unknown>): Tokens {
  const usage = data.usage as Record<string, unknown> | undefined;
  if (!usage) {
    return { input: null, output: null };
  }

  return {
    input: readNumber(usage.prompt_tokens),
    output: readNumber(usage.completion_tokens),
  };
}

function summarizeOpenAIStream(chunks: unknown[]): StreamSummary {
  let text = "";
  let tokens: Tokens = { input: null, output: null };

  for (const chunk of chunks) {
    const item = chunk as Record<string, unknown>;
    const choices = item.choices as Array<Record<string, unknown>> | undefined;
    if (!choices) {
      continue;
    }

    for (const choice of choices) {
      const delta = choice.delta as Record<string, unknown> | undefined;
      if (typeof delta?.content === "string") {
        text += delta.content;
      }
    }

    if (item.usage) {
      tokens = extractOpenAITokens(item);
    }
  }

  return { text, tokens };
}

export const openaiStrategy: RelayStrategy = {
  provider: "openai",
  prepareRelayRequest(requestBody: RequestBodyInspection, requestHeaders: Headers) {
    const headers = prepareOpenAIHeaders(requestHeaders);
    const prepared = prepareRelayBody(requestBody, Boolean(OPENAI_DEFAULT_MODEL));

    return {
      headers,
      body: prepared.body,
      model: prepared.model,
    };
  },
  getRelayUrl(request: RelayRequest) {
    return getSdkTargetUrl(relayClient, request, OPENAI_BASE_URL);
  },
  sendRelayRequest(request: RelayRequest) {
    return sendSdkRequest(relayClient, request, OPENAI_BASE_URL);
  },
  extractTokens(data) {
    return extractOpenAITokens(data);
  },
  summarizeStream(chunks) {
    return summarizeOpenAIStream(chunks);
  },
};
