import crypto from "node:crypto";
import { getLogById, type LogRow } from "../db/index.js";
import {
  collectSseChunks,
  inspectRequestBody,
  type Provider,
} from "./proxy.js";
import { sanitizeHeaders } from "./http.js";
import { getRelayStrategy } from "./strategies/index.js";
import { proxyEventBus } from "../events/index.js";
import { getLogIdForRequest } from "../events/listeners/db-logger.js";

function isBodyMethod(method: string): boolean {
  return method !== "GET" && method !== "HEAD";
}

function parseHeaders(value: string | null): Headers {
  const headers = new Headers();

  if (!value) {
    return headers;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [key, headerValue] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof headerValue === "string") {
          headers.set(key, headerValue);
        }
      }
    }
  } catch {
    // Ignore malformed header blobs and replay with no extra headers.
  }

  return headers;
}

function buildReplayRequestUrl(endpoint: string): URL {
  return new URL(endpoint, "http://replay.local");
}

function normalizeMethod(method: string): string {
  return method.toUpperCase();
}

export interface ReplayOverrides {
  endpoint?: string;
  method?: string;
  request_body?: string | null;
}

export class ReplayError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ReplayError";
    this.status = status;
  }
}

function selectEndpoint(original: LogRow, overrides: ReplayOverrides): string {
  return overrides.endpoint?.trim() || original.endpoint;
}

function selectMethod(original: LogRow, overrides: ReplayOverrides): string {
  return normalizeMethod(overrides.method?.trim() || original.method);
}

function selectRequestBody(original: LogRow, overrides: ReplayOverrides): string | null {
  if (Object.prototype.hasOwnProperty.call(overrides, "request_body")) {
    return overrides.request_body ?? null;
  }

  return original.request_body;
}

export async function replayLogById(
  logId: number,
  overrides: ReplayOverrides = {},
  signal?: AbortSignal
): Promise<LogRow> {
  const original = getLogById(logId);
  if (!original) {
    throw new ReplayError(`Log ${logId} not found`, 404);
  }

  const endpoint = selectEndpoint(original, overrides);
  if (!endpoint) {
    throw new ReplayError("Invalid endpoint", 400);
  }

  const method = selectMethod(original, overrides);
  const requestBody = selectRequestBody(original, overrides);
  const provider = original.provider as Provider;
  const requestUrl = buildReplayRequestUrl(endpoint);
  const requestHeaders = sanitizeHeaders(parseHeaders(original.request_headers));
  const strategy = getRelayStrategy(provider);
  const startTime = Date.now();
  const requestTime = new Date(startTime).toISOString();
  const bodyInspection = inspectRequestBody(requestBody);
  const relayRequest = strategy.prepareRelayRequest(bodyInspection, parseHeaders(original.request_headers));
  const isStreaming = bodyInspection.json ? bodyInspection.json.stream === true : original.is_streaming === 1;
  const model = relayRequest.model ?? original.model;
  const relayInput = {
    path: `${requestUrl.pathname}${requestUrl.search}`,
    method,
    headers: relayRequest.headers,
    body: isBodyMethod(method) && relayRequest.body !== null ? relayRequest.body : undefined,
    signal,
  };
  let upstreamUrl: string | null = null;

  const requestId = crypto.randomUUID();

  try {
    upstreamUrl = await strategy.getRelayUrl(relayInput);
  } catch {
    upstreamUrl = null;
  }

  proxyEventBus.emit("proxy:request", {
    requestId,
    provider,
    endpoint,
    upstreamUrl,
    method,
    headers: requestHeaders,
    body: requestBody,
    model,
    isStreaming,
    sourceLogId: original.id,
    requestTime,
  });

  // emit 是同步的，此时 logId 已写入 map；必须在 proxy:response 删除之前捕获
  const replayedLogId = getLogIdForRequest(requestId);

  try {
    const { response, targetUrl } = await strategy.sendRelayRequest(relayInput);
    if (!upstreamUrl) {
      upstreamUrl = targetUrl;
    }

    if (isStreaming && response.body) {
      const chunks = await collectSseChunks(response.body);
      const summary = strategy.summarizeStream(chunks);

      proxyEventBus.emit("proxy:response", {
        requestId,
        status: response.status,
        body: JSON.stringify(chunks),
        bodyFinish: summary.text,
        inputTokens: summary.tokens.input,
        outputTokens: summary.tokens.output,
        responseTime: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      });
    } else {
      const responseText = await response.text();
      let tokens = { input: null as number | null, output: null as number | null };

      try {
        const responseJson = JSON.parse(responseText) as Record<string, unknown>;
        tokens = strategy.extractTokens(responseJson);
      } catch {
        // Non-JSON bodies are stored raw.
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
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    proxyEventBus.emit("proxy:error", {
      requestId,
      status: 502,
      error: message,
      responseTime: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    });
  }

  if (replayedLogId === undefined) {
    throw new ReplayError("Replay log not found", 500);
  }

  const replayed = getLogById(replayedLogId);
  if (!replayed) {
    throw new ReplayError("Replay log not found", 500);
  }

  return replayed;
}

export const replayLog = replayLogById;
