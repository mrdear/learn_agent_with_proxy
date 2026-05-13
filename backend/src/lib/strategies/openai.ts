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
  prepareOpenAIHeaders,
  prepareRelayBody,
  sendSdkRequest,
} from "./shared.js";
import type { RelayStrategy, RelayRequest } from "./types.js";

const relayClient = new OpenAI({
  baseURL: OPENAI_BASE_URL,
  apiKey: OPENAI_API_KEY,
});

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
  sendRelayRequest(request: RelayRequest) {
    return sendSdkRequest(relayClient, request, OPENAI_BASE_URL);
  },
  extractTokens(data) {
    return extractTokens("openai", data);
  },
  summarizeStream(chunks) {
    return summarizeStream("openai", chunks);
  },
};
