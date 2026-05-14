import { sanitizeHeaders } from "../http.js";
import { type RequestBodyInspection } from "../proxy.js";
import type { RelayMethod, RelayRequest, RelayResponse } from "./types.js";

export const OPENAI_BASE_URL =
  process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com";
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim() || "proxy";
export const OPENAI_DEFAULT_MODEL = process.env.OPENAI_DEFAULT_MODEL?.trim() || "";
export const OPENAI_HTTP_REFERER = process.env.OPENAI_HTTP_REFERER?.trim() || "";
export const OPENAI_TITLE = process.env.OPENAI_TITLE?.trim() || "Learn Agent With Proxy";

export const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com";
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY?.trim() || "proxy";

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

export function prepareOpenAIHeaders(requestHeaders: Headers): Record<string, string> {
  const relayHeaders = sanitizeHeaders(requestHeaders);

  if (OPENAI_HTTP_REFERER) {
    setHeader(relayHeaders, "HTTP-Referer", OPENAI_HTTP_REFERER);
  }

  if (OPENAI_TITLE) {
    setHeader(relayHeaders, "X-Title", OPENAI_TITLE);
  }

  return relayHeaders;
}

export function prepareRelayBody(
  requestBody: RequestBodyInspection,
  rewriteModel?: boolean
): { body: unknown; model: string | null } {
  const currentModel = requestBody.model?.trim() || null;

  if (requestBody.json) {
    const body = cloneJsonBody(requestBody.json);

    if (rewriteModel && OPENAI_DEFAULT_MODEL && shouldRewriteModel(currentModel)) {
      body.model = OPENAI_DEFAULT_MODEL;
      return { body, model: OPENAI_DEFAULT_MODEL };
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
