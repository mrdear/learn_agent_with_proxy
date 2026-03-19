import { Hono } from "hono";
import { completeLog, createLog } from "../db/index.js";
import {
  buildTargetUrl,
  cloneResponseHeaders,
  collectSseChunks,
  detectProvider,
  extractModel,
  extractTokens,
  isStreamingRequest,
  sanitizeHeaders,
  summarizeStream,
  type Provider,
} from "../lib/proxy.js";

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com";
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";

function getBaseUrl(provider: Provider): string {
  return provider === "openai" ? OPENAI_BASE_URL : ANTHROPIC_BASE_URL;
}

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

function safeCreateLog(
  data: Parameters<typeof createLog>[0]
): number | null {
  try {
    return createLog(data);
  } catch (error) {
    console.error("Failed to create proxy log:", error);
    return null;
  }
}

function safeCompleteLog(data: Parameters<typeof completeLog>[0]): void {
  try {
    completeLog(data);
  } catch (error) {
    console.error("Failed to complete proxy log:", error);
  }
}

async function recordStreamingLog(params: {
  body: ReadableStream<Uint8Array>;
  provider: Provider;
  logId: number | null;
  startTime: number;
  responseStatus: number;
}): Promise<void> {
  if (params.logId === null) {
    return;
  }

  const chunks = await collectSseChunks(params.body);
  const summary = summarizeStream(params.provider, chunks);

  safeCompleteLog({
    id: params.logId,
    response_status: params.responseStatus,
    response_body: JSON.stringify(chunks),
    response_body_finish: summary.text,
    input_tokens: summary.tokens.input,
    output_tokens: summary.tokens.output,
    response_time: new Date().toISOString(),
    duration_ms: Date.now() - params.startTime,
    error: null,
  });
}

const proxy = new Hono();

// Catch-all proxy route for /v1/*
proxy.all("/v1/*", async (c) => {
  const startTime = Date.now();
  const requestTime = new Date().toISOString();
  const requestUrl = new URL(c.req.url);
  const requestPath = `${requestUrl.pathname}${requestUrl.search}`;
  const method = c.req.method;
  const rawHeaders = c.req.raw.headers;
  const provider = detectProvider(rawHeaders, requestUrl.pathname);
  const baseUrl = getBaseUrl(provider);
  const targetUrl = buildTargetUrl(baseUrl, requestUrl);
  const forwardHeaders = sanitizeHeaders(rawHeaders);

  let requestBody: string | null = null;
  let model: string | null = null;
  let streaming = false;

  if (isBodyMethod(method)) {
    requestBody = await c.req.text();

    try {
      const parsed = JSON.parse(requestBody) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        model = extractModel(parsed);
        streaming = isStreamingRequest(parsed);
      }
    } catch {
      // Body is not JSON, which is fine for generic proxying.
    }
  }

  const logId = safeCreateLog({
    provider,
    endpoint: requestPath,
    method,
    request_headers: JSON.stringify(forwardHeaders),
    request_body: requestBody,
    model,
    is_streaming: streaming ? 1 : 0,
    request_time: requestTime,
  });

  try {
    const response = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body: isBodyMethod(method) && requestBody !== null ? requestBody : undefined,
      signal: c.req.raw.signal,
    });

    if (streaming && response.body) {
      const [clientBody, logBody] = response.body.tee();

      void recordStreamingLog({
        body: logBody,
        provider,
        logId,
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
      tokens = extractTokens(provider, responseJson);
    } catch {
      // Non-JSON responses are forwarded as-is.
    }

    if (logId !== null) {
      safeCompleteLog({
        id: logId,
        response_status: response.status,
        response_body: null,
        response_body_finish: responseText,
        input_tokens: tokens.input,
        output_tokens: tokens.output,
        response_time: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        error: null,
      });
    }

    return new Response(responseText, {
      status: response.status,
      headers: createResponseHeaders(response, "application/json"),
    });
  } catch (error) {
    if (logId !== null) {
      safeCompleteLog({
        id: logId,
        response_status: 502,
        response_body: null,
        response_body_finish: null,
        input_tokens: null,
        output_tokens: null,
        response_time: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: "Proxy error", message }, 502);
  }
});

export default proxy;
