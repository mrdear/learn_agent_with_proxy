import crypto from "node:crypto";
import { Hono } from "hono";
import {
  collectSseChunks,
  detectProvider,
  type Provider,
  inspectRequestBody,
} from "../lib/proxy.js";
import { cloneResponseHeaders, sanitizeHeaders } from "../lib/http.js";
import { getRelayStrategy, type RelayStrategy } from "../lib/strategies/index.js";
import { normalizeRelayPath } from "../lib/strategies/shared.js";
import { proxyEventBus } from "../events/index.js";
import { getProviderConfigByAccessKey } from "../db/index.js";
import type { ProviderRuntimeConfig } from "../db/index.js";

function isBodyMethod(method: string): boolean {
  return method !== "GET" && method !== "HEAD";
}

function createResponseHeaders(response: Response, defaultContentType?: string): Record<string, string> {
  const headers = cloneResponseHeaders(response.headers);

  if (!headers["content-type"] && defaultContentType) {
    headers["content-type"] = defaultContentType;
  }

  return headers;
}

function isEventStreamResponse(response: Response): boolean {
  return response.headers.get("content-type")?.toLowerCase().includes("text/event-stream") ?? false;
}

function isModelsRequest(pathname: string): boolean {
  return pathname === "/v1/models" || pathname.startsWith("/v1/models/");
}

function stripPathSuffix(pathname: string, suffix: string[]): string {
  const segments = pathname.split("/").filter(Boolean);
  const hasSuffix =
    segments.length >= suffix.length &&
    suffix.every(
      (segment, index) => segments[segments.length - suffix.length + index] === segment
    );

  if (!hasSuffix) {
    return pathname;
  }

  return `/${segments.slice(0, -suffix.length).join("/")}`;
}

function getPassthroughBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  for (const suffix of [["chat", "completions"], ["responses"], ["messages"]]) {
    const strippedPathname = stripPathSuffix(url.pathname, suffix);
    if (strippedPathname !== url.pathname) {
      url.pathname = strippedPathname;
      break;
    }
  }
  return url.toString();
}

function appendRelayPath(baseUrl: string, relayPath: string): string {
  const target = new URL(baseUrl);
  const [pathname, search = ""] = relayPath.split("?", 2);
  const baseSegments = target.pathname.split("/").filter(Boolean);
  const relaySegments = pathname.split("/").filter(Boolean);

  target.pathname = `/${[...baseSegments, ...relaySegments].join("/")}`;
  target.search = search ? `?${search}` : "";

  return target.toString();
}

function getPassthroughUrl(baseUrl: string, requestPath: string): string {
  const passthroughBaseUrl = getPassthroughBaseUrl(baseUrl);
  return appendRelayPath(
    passthroughBaseUrl,
    normalizeRelayPath(passthroughBaseUrl, requestPath)
  );
}

function truncateForLog(value: string, maxLength = 2000): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSensitiveKey(key: string): boolean {
  return /authorization|api[-_]?key|token|secret|password|credential|cookie/i.test(key);
}

function redactText(value: string): string {
  return value.replace(/Bearer\s+[\w.+/=~-]+/gi, "Bearer [redacted]");
}

function redactSensitiveValues(value: unknown): unknown {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map((item) => redactSensitiveValues(item));
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      isSensitiveKey(key) ? "[redacted]" : redactSensitiveValues(child),
    ])
  );
}

function pickErrorFields(error: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  for (const key of ["message", "type", "code", "param", "status"]) {
    if (error[key] !== undefined) {
      fields[key] = redactSensitiveValues(error[key]);
    }
  }

  return Object.keys(fields).length > 0 ? fields : redactSensitiveValues(error) as Record<string, unknown>;
}

function formatUpstreamErrorBody(responseBody: string): string {
  const body = responseBody.trim();
  if (!body) return "<empty>";

  try {
    const parsed = JSON.parse(body) as unknown;
    if (isRecord(parsed)) {
      if (typeof parsed.error === "string") {
        return JSON.stringify({ error: redactText(parsed.error) });
      }
      if (isRecord(parsed.error)) {
        return JSON.stringify({ error: pickErrorFields(parsed.error) });
      }
      return JSON.stringify(redactSensitiveValues(parsed));
    }
  } catch {
    // Fall through to sanitized text for non-JSON error bodies.
  }

  return redactText(truncateForLog(body));
}

function logUpstreamError(params: {
  requestId: string;
  status: number;
  statusText: string;
  upstreamUrl: string;
  responseBody: string;
}): void {
  const statusText = params.statusText ? ` ${params.statusText}` : "";

  console.warn(
    `[PROXY] upstream error ${params.status}${statusText} request=${params.requestId} url=${params.upstreamUrl}`
  );
  console.warn(`[PROXY] upstream error body ${formatUpstreamErrorBody(params.responseBody)}`);
}

function readBearerToken(headers: Headers): string | null {
  const authorization = headers.get("authorization")?.trim();
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return authorization.slice(7).trim() || null;
}

async function forwardModelsRequest(params: {
  provider: Provider;
  providerConfig: ProviderRuntimeConfig;
  strategy: RelayStrategy;
  requestId: string;
  requestPath: string;
  method: string;
  rawHeaders: Headers;
  requestBody: string | null;
  requestTime: string;
  startTime: number;
  signal: AbortSignal;
}): Promise<Response> {
  const relayRequest = params.strategy.prepareRelayRequest(
    inspectRequestBody(null),
    params.rawHeaders,
    params.providerConfig
  );
  const upstreamUrl = getPassthroughUrl(params.providerConfig.baseUrl, params.requestPath);
  const requestHeaders = sanitizeHeaders(params.rawHeaders);

  proxyEventBus.emit("proxy:request", {
    requestId: params.requestId,
    provider: params.provider,
    endpoint: params.requestPath,
    upstreamUrl,
    method: params.method,
    headers: requestHeaders,
    body: params.requestBody,
    model: null,
    isStreaming: false,
    requestTime: params.requestTime,
  });

  try {
    const response = await fetch(upstreamUrl, {
      method: params.method,
      headers: relayRequest.headers,
      body: isBodyMethod(params.method) ? (params.requestBody ?? undefined) : undefined,
      signal: params.signal,
    });
    const responseText = await response.text();

    if (!response.ok) {
      logUpstreamError({
        requestId: params.requestId,
        status: response.status,
        statusText: response.statusText,
        upstreamUrl,
        responseBody: responseText,
      });
    }

    proxyEventBus.emit("proxy:response", {
      requestId: params.requestId,
      status: response.status,
      body: null,
      bodyFinish: responseText,
      inputTokens: null,
      outputTokens: null,
      responseTime: new Date().toISOString(),
      durationMs: Date.now() - params.startTime,
    });

    return new Response(responseText, {
      status: response.status,
      headers: createResponseHeaders(response, "application/json"),
    });
  } catch (error) {
    proxyEventBus.emit("proxy:error", {
      requestId: params.requestId,
      status: 502,
      error: error instanceof Error ? error.message : String(error),
      responseTime: new Date().toISOString(),
      durationMs: Date.now() - params.startTime,
    });

    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: "Proxy error", message }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}

async function recordStreamingResponse(params: {
  body: ReadableStream<Uint8Array>;
  strategy: RelayStrategy;
  requestId: string;
  startTime: number;
  responseStatus: number;
}): Promise<void> {
  const chunks = await collectSseChunks(params.body);
  const summary = params.strategy.summarizeStream(chunks);

  proxyEventBus.emit("proxy:response", {
    requestId: params.requestId,
    status: params.responseStatus,
    body: JSON.stringify(chunks),
    bodyFinish: summary.text,
    inputTokens: summary.tokens.input,
    outputTokens: summary.tokens.output,
    responseTime: new Date().toISOString(),
    durationMs: Date.now() - params.startTime,
  });
}

const proxy = new Hono();

proxy.all("/v1/*", async (c) => {
  console.log(`[PROXY] ${c.req.method} ${c.req.url} from ${c.req.header("x-codex-session-id") || "unknown"}`);
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  const requestTime = new Date().toISOString();
  const requestUrl = new URL(c.req.url);
  const requestPath = `${requestUrl.pathname}${requestUrl.search}`;
  const method = c.req.method;
  const rawHeaders = c.req.raw.headers;
  const detectedProvider = detectProvider(rawHeaders, requestUrl.pathname);
  const logHeaders = sanitizeHeaders(rawHeaders);
  const accessKey = readBearerToken(rawHeaders);
  const providerConfig = accessKey ? getProviderConfigByAccessKey(accessKey) : null;
  const isModelsPassthrough = isModelsRequest(requestUrl.pathname);
  const provider = isModelsPassthrough && providerConfig
    ? providerConfig.provider
    : detectedProvider;
  const strategy = getRelayStrategy(provider);

  let requestBody: string | null = null;
  let bodyInspection = inspectRequestBody(null);

  if (isBodyMethod(method)) {
    requestBody = await c.req.text();
    bodyInspection = inspectRequestBody(requestBody);
  }

  if (
    !providerConfig ||
    (!isModelsPassthrough && providerConfig.provider !== provider) ||
    !providerConfig.enabled
  ) {
    const status = providerConfig?.enabled === false ? 400 : 401;
    const message = !accessKey
      ? "Missing proxy access key"
      : !providerConfig
        ? "Invalid proxy access key"
        : providerConfig.provider !== provider
          ? `Access key is for ${providerConfig.provider}, not ${provider}`
          : `Provider disabled: ${provider}`;

    proxyEventBus.emit("proxy:request", {
      requestId,
      provider,
      endpoint: requestPath,
      upstreamUrl: null,
      method,
      headers: logHeaders,
      body: requestBody,
      model: bodyInspection.model,
      isStreaming: bodyInspection.isStreaming,
      requestTime,
    });

    proxyEventBus.emit("proxy:error", {
      requestId,
      status,
      error: message,
      responseTime: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    });

    return c.json({ error: "Proxy access error", message }, status as 400 | 401);
  }

  if (isModelsPassthrough) {
    return forwardModelsRequest({
      provider,
      providerConfig,
      strategy,
      requestId,
      requestPath,
      method,
      rawHeaders,
      requestBody,
      requestTime,
      startTime,
      signal: c.req.raw.signal,
    });
  }

  const relayRequest = strategy.prepareRelayRequest(bodyInspection, rawHeaders, providerConfig);
  const relayInput = {
    path: requestPath,
    method,
    headers: relayRequest.headers,
    body: isBodyMethod(method) && relayRequest.body !== null ? relayRequest.body : undefined,
    signal: c.req.raw.signal,
  };
  let upstreamUrl: string | null = null;

  try {
    upstreamUrl = await strategy.getRelayUrl(relayInput, providerConfig);
    console.log(`[PROXY] upstream ${upstreamUrl}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    proxyEventBus.emit("proxy:request", {
      requestId,
      provider,
      endpoint: requestPath,
      upstreamUrl: null,
      method,
      headers: logHeaders,
      body: requestBody,
      model: relayRequest.model ?? bodyInspection.model,
      isStreaming: bodyInspection.isStreaming,
      requestTime,
    });

    proxyEventBus.emit("proxy:error", {
      requestId,
      status: 502,
      error: message,
      responseTime: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    });

    return c.json({ error: "Proxy error", message }, 502);
  }

  proxyEventBus.emit("proxy:request", {
    requestId,
    provider,
    endpoint: requestPath,
    upstreamUrl,
    method,
    headers: logHeaders,
    body: requestBody,
    model: relayRequest.model ?? bodyInspection.model,
    isStreaming: bodyInspection.isStreaming,
    requestTime,
  });

  try {
    const { response, targetUrl } = await strategy.sendRelayRequest(relayInput, providerConfig);

    if (bodyInspection.isStreaming && response.ok && response.body && isEventStreamResponse(response)) {
      const [clientBody, logBody] = response.body.tee();

      void recordStreamingResponse({
        body: logBody,
        strategy,
        requestId,
        startTime,
        responseStatus: response.status,
      });

      return new Response(clientBody, {
        status: response.status,
        headers: createResponseHeaders(response),
      });
    }

    const responseText = await response.text();
    let tokens = { input: null as number | null, output: null as number | null };

    if (!response.ok) {
      logUpstreamError({
        requestId,
        status: response.status,
        statusText: response.statusText,
        upstreamUrl: targetUrl,
        responseBody: responseText,
      });
    }

    try {
      const responseJson = JSON.parse(responseText) as Record<string, unknown>;
      tokens = strategy.extractTokens(responseJson);
    } catch {
      // Non-JSON responses are forwarded as-is.
    }

    proxyEventBus.emit("proxy:response", {
      requestId,
      status: response.status,
      body: null,
      bodyFinish: responseText,
      inputTokens: tokens.input,
      outputTokens: tokens.output,
      responseTime: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    });

    return new Response(responseText, {
      status: response.status,
      headers: createResponseHeaders(response, "application/json"),
    });
  } catch (error) {
    proxyEventBus.emit("proxy:error", {
      requestId,
      status: 502,
      error: error instanceof Error ? error.message : String(error),
      responseTime: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    });

    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: "Proxy error", message }, 502);
  }
});

export default proxy;
