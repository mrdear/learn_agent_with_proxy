import OpenAI from "openai";
import type { RequestBodyInspection, StreamSummary, Tokens } from "../proxy.js";
import {
  getOpenAIApiKey,
  getSdkTargetUrl,
  prepareOpenAIHeaders,
  prepareRelayBody,
  readNumber,
  sendSdkRequest,
} from "./shared.js";
import type { RelayProviderConfig, RelayStrategy, RelayRequest } from "./types.js";

function createRelayClient(
  config: RelayProviderConfig,
  headers: Record<string, string>,
  baseURL = config.baseUrl
): OpenAI {
  return new OpenAI({
    baseURL,
    apiKey: getOpenAIApiKey(config, headers),
  });
}

function isModelsRequest(requestPath: string): boolean {
  const pathname = new URL(requestPath, "http://proxy.local").pathname;
  return pathname === "/v1/models" || pathname.startsWith("/v1/models/");
}

function stripPathSuffix(pathname: string, suffix: string[]): string {
  const segments = pathname.split("/").filter(Boolean);
  const hasSuffix = suffix.every(
    (segment, index) => segments[segments.length - suffix.length + index] === segment
  );

  if (!hasSuffix) {
    return pathname;
  }

  const stripped = segments.slice(0, -suffix.length);
  return `/${stripped.join("/")}`;
}

function getOpenAIRelayBaseUrl(requestPath: string, baseUrl: string): string {
  if (!isModelsRequest(requestPath)) {
    return baseUrl;
  }

  const url = new URL(baseUrl);
  url.pathname = stripPathSuffix(url.pathname, ["chat", "completions"]);
  return url.toString();
}

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
  prepareRelayRequest(
    requestBody: RequestBodyInspection,
    requestHeaders: Headers,
    config: RelayProviderConfig
  ) {
    const headers = prepareOpenAIHeaders(requestHeaders, config);
    const prepared = prepareRelayBody(requestBody, "openai", config);

    return {
      headers,
      body: prepared.body,
      model: prepared.model,
    };
  },
  getRelayUrl(request: RelayRequest, config: RelayProviderConfig) {
    const baseUrl = getOpenAIRelayBaseUrl(request.path, config.baseUrl);
    return getSdkTargetUrl(createRelayClient(config, request.headers, baseUrl), request, baseUrl);
  },
  sendRelayRequest(request: RelayRequest, config: RelayProviderConfig) {
    const baseUrl = getOpenAIRelayBaseUrl(request.path, config.baseUrl);
    return sendSdkRequest(createRelayClient(config, request.headers, baseUrl), request, baseUrl);
  },
  extractTokens(data) {
    return extractOpenAITokens(data);
  },
  summarizeStream(chunks) {
    return summarizeOpenAIStream(chunks);
  },
};
