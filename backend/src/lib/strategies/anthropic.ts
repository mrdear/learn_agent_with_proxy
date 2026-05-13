import Anthropic from "@anthropic-ai/sdk";
import { sanitizeHeaders } from "../http.js";
import type { RequestBodyInspection, StreamSummary, Tokens } from "../proxy.js";
import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_BASE_URL,
  getSdkTargetUrl,
  prepareRelayBody,
  readNumber,
  sendSdkRequest,
} from "./shared.js";
import type { RelayStrategy, RelayRequest } from "./types.js";

const anthropicClient = new Anthropic({
  baseURL: ANTHROPIC_BASE_URL,
  apiKey: ANTHROPIC_API_KEY,
});

function extractAnthropicTokens(data: Record<string, unknown>): Tokens {
  const usage = data.usage as Record<string, unknown> | undefined;
  if (!usage) {
    return { input: null, output: null };
  }

  return {
    input: readNumber(usage.input_tokens),
    output: readNumber(usage.output_tokens),
  };
}

function summarizeAnthropicStream(chunks: unknown[]): StreamSummary {
  let text = "";
  const tokens: Tokens = { input: null, output: null };

  for (const chunk of chunks) {
    const item = chunk as Record<string, unknown>;

    if (item.type === "content_block_delta") {
      const delta = item.delta as Record<string, unknown> | undefined;
      if (typeof delta?.text === "string") {
        text += delta.text;
      }
    }

    if (item.type === "message_start") {
      const message = item.message as Record<string, unknown> | undefined;
      const usage = message?.usage as Record<string, unknown> | undefined;
      if (usage) {
        tokens.input = readNumber(usage.input_tokens);
      }
    }

    if (item.type === "message_delta") {
      const usage = item.usage as Record<string, unknown> | undefined;
      if (usage) {
        tokens.output = readNumber(usage.output_tokens);
      }
    }
  }

  return { text, tokens };
}

export const anthropicStrategy: RelayStrategy = {
  provider: "anthropic",
  prepareRelayRequest(requestBody: RequestBodyInspection, requestHeaders: Headers) {
    const prepared = prepareRelayBody(requestBody);

    return {
      headers: sanitizeHeaders(requestHeaders),
      body: prepared.body,
      model: prepared.model,
    };
  },
  getRelayUrl(request: RelayRequest) {
    return getSdkTargetUrl(anthropicClient, request, ANTHROPIC_BASE_URL);
  },
  sendRelayRequest(request: RelayRequest) {
    return sendSdkRequest(anthropicClient, request, ANTHROPIC_BASE_URL);
  },
  extractTokens(data) {
    return extractAnthropicTokens(data);
  },
  summarizeStream(chunks) {
    return summarizeAnthropicStream(chunks);
  },
};
