import { sanitizeHeaders } from "../http.js";
import { type RequestBodyInspection } from "../proxy.js";
import type { RelayMethod, RelayRequest } from "./types.js";

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

export async function sendSdkRequest(client: {
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
}, request: RelayRequest): Promise<Response> {
  const { req, url } = await client.buildRequest(
    {
      method: normalizeMethod(request.method),
      path: request.path,
      headers: request.headers,
      body: request.body ?? undefined,
      signal: request.signal,
    },
    { retryCount: 0 }
  );

  return fetch(url, req);
}

export type { RequestBodyInspection } from "../proxy.js";
