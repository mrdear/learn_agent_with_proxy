import crypto from "node:crypto";
import { Hono } from "hono";
import {
  collectSseChunks,
  detectProvider,
  inspectRequestBody,
} from "../lib/proxy.js";
import { cloneResponseHeaders, sanitizeHeaders } from "../lib/http.js";
import { getRelayStrategy, type RelayStrategy } from "../lib/strategies/index.js";
import { proxyEventBus } from "../events/index.js";

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
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  const requestTime = new Date().toISOString();
  const requestUrl = new URL(c.req.url);
  const requestPath = `${requestUrl.pathname}${requestUrl.search}`;
  const method = c.req.method;
  const rawHeaders = c.req.raw.headers;
  const provider = detectProvider(rawHeaders, requestUrl.pathname);
  const strategy = getRelayStrategy(provider);
  const logHeaders = sanitizeHeaders(rawHeaders);

  let requestBody: string | null = null;
  let bodyInspection = inspectRequestBody(null);

  if (isBodyMethod(method)) {
    requestBody = await c.req.text();
    bodyInspection = inspectRequestBody(requestBody);
  }

  const relayRequest = strategy.prepareRelayRequest(bodyInspection, rawHeaders);

  proxyEventBus.emit("proxy:request", {
    requestId,
    provider,
    endpoint: requestPath,
    method,
    headers: logHeaders,
    body: requestBody,
    model: relayRequest.model ?? bodyInspection.model,
    isStreaming: bodyInspection.isStreaming,
    requestTime,
  });

  try {
    const response = await strategy.sendRelayRequest({
      path: requestPath,
      method,
      headers: relayRequest.headers,
      body: isBodyMethod(method) && relayRequest.body !== null ? relayRequest.body : undefined,
      signal: c.req.raw.signal,
    });

    if (bodyInspection.isStreaming && response.body) {
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
