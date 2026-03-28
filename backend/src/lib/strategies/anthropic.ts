import Anthropic from "@anthropic-ai/sdk";
import { sanitizeHeaders } from "../http.js";
import {
  type RequestBodyInspection,
  extractTokens,
  summarizeStream,
} from "../proxy.js";
import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_BASE_URL,
  prepareRelayBody,
  sendSdkRequest,
} from "./shared.js";
import type { RelayStrategy, RelayRequest } from "./types.js";

const anthropicClient = new Anthropic({
  baseURL: ANTHROPIC_BASE_URL,
  apiKey: ANTHROPIC_API_KEY,
});

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
  sendRelayRequest(request: RelayRequest) {
    return sendSdkRequest(anthropicClient, request);
  },
  extractTokens(data) {
    return extractTokens("anthropic", data);
  },
  summarizeStream(chunks) {
    return summarizeStream("anthropic", chunks);
  },
};
