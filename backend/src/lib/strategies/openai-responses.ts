import OpenAI from "openai";
import {
  type RequestBodyInspection,
  extractTokens,
  summarizeStream,
} from "../proxy.js";
import {
  OPENAI_API_KEY,
  OPENAI_BASE_URL,
  OPENAI_DEFAULT_MODEL,
  getSdkTargetUrl,
  prepareOpenAIHeaders,
  prepareRelayBody,
  sendSdkRequest,
} from "./shared.js";
import type { RelayStrategy, RelayRequest } from "./types.js";

const relayClient = new OpenAI({
  baseURL: OPENAI_BASE_URL,
  apiKey: OPENAI_API_KEY,
});

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
    return extractTokens("openai-responses", data);
  },
  summarizeStream(chunks) {
    return summarizeStream("openai-responses", chunks);
  },
};
