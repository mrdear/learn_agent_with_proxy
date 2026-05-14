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

function extractOpenAIResponsesTokens(data: Record<string, unknown>): Tokens {
  const usage = data.usage as Record<string, unknown> | undefined;
  if (!usage) {
    return { input: null, output: null };
  }

  return {
    input: readNumber(usage.input_tokens),
    output: readNumber(usage.output_tokens),
  };
}

function summarizeResponsesStream(chunks: unknown[]): StreamSummary {
  let text = "";
  let tokens: Tokens = { input: null, output: null };
  const tools: Array<{ name: string; arguments: string; call_id: string }> = [];

  for (const chunk of chunks) {
    const item = chunk as Record<string, unknown>;

    if (item.type !== "response.completed" || !item.response) {
      continue;
    }

    const response = item.response as Record<string, unknown>;
    tokens = extractOpenAIResponsesTokens(response);

    const output = response.output as Array<Record<string, unknown>> | undefined;
    if (!output) {
      continue;
    }

    for (const outItem of output) {
      if (outItem.type === "function_call" && typeof outItem.name === "string") {
        tools.push({
          name: outItem.name,
          arguments: (outItem.arguments as string) || "",
          call_id: (outItem.call_id as string) || "",
        });
        continue;
      }

      if (outItem.type !== "message") {
        continue;
      }

      const content = outItem.content as Array<Record<string, unknown>> | undefined;
      if (!content) {
        continue;
      }

      for (const part of content) {
        if (part.type === "output_text" && typeof part.text === "string") {
          text += part.text;
        }
      }
    }
  }

  if (!text && tools.length > 0) {
    text = tools.map((tool) => `Tool call: ${tool.name}(${tool.arguments})`).join("\n");
  }

  return { text, tokens, tools: tools.length > 0 ? tools : undefined };
}

export const openaiResponsesStrategy: RelayStrategy = {
  provider: "openai-responses",
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
    return extractOpenAIResponsesTokens(data);
  },
  summarizeStream(chunks) {
    return summarizeResponsesStream(chunks);
  },
};
