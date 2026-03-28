import { sanitizeHeaders } from "./http.js";
import type { Provider } from "./proxy.js";

const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY?.trim() || "";
const OPENROUTER_DEFAULT_MODEL = process.env.OPENROUTER_DEFAULT_MODEL?.trim() || "openrouter/free";
const OPENROUTER_HTTP_REFERER = process.env.OPENROUTER_HTTP_REFERER?.trim() || "";
const OPENROUTER_TITLE = process.env.OPENROUTER_TITLE?.trim() || "Learn Agent With Proxy";

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com";
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com";

function isOpenRouterEnabled(): boolean {
  return OPENROUTER_API_KEY.length > 0;
}

function setHeader(headers: Record<string, string>, name: string, value: string): void {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === name.toLowerCase()) {
      delete headers[key];
    }
  }

  headers[name] = value;
}

function shouldRewriteModel(model: string | null): boolean {
  if (!model) {
    return true;
  }

  return !model.includes("/") && !model.endsWith(":free");
}

function rewriteRequestBody(requestBody: string | null): { body: string | null; model: string | null } {
  if (!requestBody || !isOpenRouterEnabled()) {
    return { body: requestBody, model: null };
  }

  try {
    const parsed = JSON.parse(requestBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { body: requestBody, model: null };
    }

    const body = parsed as Record<string, unknown>;
    const currentModel = typeof body.model === "string" ? body.model.trim() : null;

    if (shouldRewriteModel(currentModel)) {
      body.model = OPENROUTER_DEFAULT_MODEL;
      return { body: JSON.stringify(body), model: OPENROUTER_DEFAULT_MODEL };
    }

    return { body: requestBody, model: currentModel };
  } catch {
    return { body: requestBody, model: null };
  }
}

export function resolveRelayBaseUrl(provider: Provider): string {
  if (isOpenRouterEnabled()) {
    return OPENROUTER_BASE_URL;
  }

  return provider === "openai" ? OPENAI_BASE_URL : ANTHROPIC_BASE_URL;
}

export function prepareRelayHeaders(headers: Headers): Record<string, string> {
  const relayHeaders = sanitizeHeaders(headers);

  if (!isOpenRouterEnabled()) {
    return relayHeaders;
  }

  setHeader(relayHeaders, "Authorization", `Bearer ${OPENROUTER_API_KEY}`);

  if (OPENROUTER_HTTP_REFERER) {
    setHeader(relayHeaders, "HTTP-Referer", OPENROUTER_HTTP_REFERER);
  }

  if (OPENROUTER_TITLE) {
    setHeader(relayHeaders, "X-Title", OPENROUTER_TITLE);
  }

  return relayHeaders;
}

export function prepareRelayBody(requestBody: string | null): { body: string | null; model: string | null } {
  return rewriteRequestBody(requestBody);
}
