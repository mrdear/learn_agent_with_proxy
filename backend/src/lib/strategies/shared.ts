import { sanitizeHeaders } from "../http.js";
import { type Provider, type RequestBodyInspection } from "../proxy.js";
import type { RelayMethod, RelayProviderConfig, RelayRequest, RelayResponse } from "./types.js";

export function setHeader(headers: Record<string, string>, name: string, value: string): void {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === name.toLowerCase()) {
      delete headers[key];
    }
  }

  headers[name] = value;
}

export function readNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

export function normalizeMethod(method: string): RelayMethod {
  const normalized = method.toLowerCase();
  if (
    normalized === "get" ||
    normalized === "post" ||
    normalized === "put" ||
    normalized === "patch" ||
    normalized === "delete"
  ) {
    return normalized;
  }

  return "post";
}

export function shouldRewriteModel(model: string | null): boolean {
  if (!model) {
    return true;
  }

  return !model.includes("/") && !model.endsWith(":free");
}

export function cloneJsonBody(body: Record<string, unknown>): Record<string, unknown> {
  return { ...body };
}

function getHeader(headers: Record<string, string>, name: string): string | null {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1] ?? null;
}

export function getOpenAIApiKey(
  config: RelayProviderConfig,
  headers: Record<string, string>
): string {
  if (config.apiKey) {
    return config.apiKey;
  }

  const authorization = getHeader(headers, "authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim() || "proxy";
  }

  return "proxy";
}

export function getAnthropicApiKey(
  config: RelayProviderConfig,
  headers: Record<string, string>
): string {
  if (config.apiKey) {
    return config.apiKey;
  }

  return getHeader(headers, "x-api-key") || "proxy";
}

function applyConfiguredHeaders(
  headers: Record<string, string>,
  extraHeaders: Record<string, string>
): void {
  for (const [key, value] of Object.entries(extraHeaders)) {
    setHeader(headers, key, value);
  }
}

export function prepareOpenAIHeaders(
  requestHeaders: Headers,
  config: RelayProviderConfig
): Record<string, string> {
  const relayHeaders = sanitizeHeaders(requestHeaders);
  applyConfiguredHeaders(relayHeaders, config.extraHeaders);

  if (config.apiKey) {
    setHeader(relayHeaders, "Authorization", `Bearer ${config.apiKey}`);
  }

  return relayHeaders;
}

export function prepareAnthropicHeaders(
  requestHeaders: Headers,
  config: RelayProviderConfig
): Record<string, string> {
  const relayHeaders = sanitizeHeaders(requestHeaders);
  applyConfiguredHeaders(relayHeaders, config.extraHeaders);

  if (config.apiKey) {
    setHeader(relayHeaders, "x-api-key", config.apiKey);
  }

  return relayHeaders;
}

export function prepareRelayBody(
  requestBody: RequestBodyInspection,
  provider: Provider,
  config: RelayProviderConfig
): { body: unknown; model: string | null } {
  const currentModel = requestBody.model?.trim() || null;
  const mappedModel = currentModel ? config.modelMappings[currentModel] : null;
  const defaultModel = config.defaultModel?.trim() || null;

  if (requestBody.json) {
    const body = cloneJsonBody(requestBody.json);

    if (mappedModel) {
      body.model = mappedModel;
      return { body, model: mappedModel };
    }

    if (
      defaultModel &&
      (provider === "openai" || provider === "openai-responses"
        ? shouldRewriteModel(currentModel)
        : !currentModel)
    ) {
      body.model = defaultModel;
      return { body, model: defaultModel };
    }

    return { body, model: currentModel };
  }

  if (requestBody.raw === null) {
    return { body: null, model: currentModel };
  }

  return {
    body: new TextEncoder().encode(requestBody.raw),
    model: currentModel,
  };
}

export function normalizeRelayPath(baseUrl: string, requestPath: string): string {
  const [pathname, search = ""] = requestPath.split("?", 2);
  const basePath = new URL(baseUrl).pathname;
  const baseSegments = basePath.split("/").filter(Boolean);
  const requestSegments = pathname.split("/").filter(Boolean);

  let overlap = 0;
  const maxOverlap = Math.min(baseSegments.length, requestSegments.length);

  for (let size = 1; size <= maxOverlap; size += 1) {
    const baseTail = baseSegments.slice(baseSegments.length - size);
    const requestHead = requestSegments.slice(0, size);

    if (baseTail.every((segment, index) => segment === requestHead[index])) {
      overlap = size;
    }
  }

  const normalizedPath = `/${requestSegments.slice(overlap).join("/")}`;
  return search ? `${normalizedPath}?${search}` : normalizedPath;
}

type SdkClient = {
  buildRequest: (
    input: {
      method: RelayMethod;
      path: string;
      headers: Record<string, string>;
      body?: unknown;
      signal?: AbortSignal;
    },
    options?: { retryCount?: number }
  ) => Promise<{ req: RequestInit; url: string; timeout: number }>;
};

async function buildSdkRequest(
  client: SdkClient,
  request: RelayRequest,
  baseUrl: string
): Promise<{ req: RequestInit; url: string }> {
  return client.buildRequest(
    {
      method: normalizeMethod(request.method),
      path: normalizeRelayPath(baseUrl, request.path),
      headers: request.headers,
      body: request.body ?? undefined,
      signal: request.signal,
    },
    { retryCount: 0 }
  );
}

export async function getSdkTargetUrl(
  client: SdkClient,
  request: RelayRequest,
  baseUrl: string
): Promise<string> {
  const { url } = await buildSdkRequest(client, request, baseUrl);
  return url;
}

export async function sendSdkRequest(
  client: SdkClient,
  request: RelayRequest,
  baseUrl: string
): Promise<RelayResponse> {
  const { req, url } = await buildSdkRequest(client, request, baseUrl);

  return {
    response: await fetch(url, req),
    targetUrl: url,
  };
}

export type { RequestBodyInspection } from "../proxy.js";
