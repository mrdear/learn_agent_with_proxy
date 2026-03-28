import {
  completeLog,
  createLog,
  getLogById,
  type LogRow,
} from "../db/index.js";
import {
  buildTargetUrl,
  collectSseChunks,
  extractTokens,
  summarizeStream,
  type Provider,
} from "./proxy.js";
import { sanitizeHeaders } from "./http.js";
import {
  prepareRelayBody,
  prepareRelayHeaders,
  resolveRelayBaseUrl,
} from "./upstream.js";

function isBodyMethod(method: string): boolean {
  return method !== "GET" && method !== "HEAD";
}

function parseJsonRecord(value: string | null): Record<string, unknown> | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Keep raw non-JSON bodies as-is.
  }

  return null;
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
  const targetUrl = buildTargetUrl(resolveRelayBaseUrl(provider), requestUrl);
  const requestHeaders = sanitizeHeaders(parseHeaders(original.request_headers));
  const relayHeaders = prepareRelayHeaders(parseHeaders(original.request_headers));
  const startTime = Date.now();
  const requestTime = new Date(startTime).toISOString();
  const bodyJson = parseJsonRecord(requestBody);
  const relayBody = prepareRelayBody(requestBody);
  const isStreaming = bodyJson ? bodyJson.stream === true : original.is_streaming === 1;
  const model = relayBody.model ?? original.model;

  const logIdInserted = createLog({
    provider,
    endpoint,
    method,
    request_headers: JSON.stringify(requestHeaders),
    request_body: requestBody,
    model,
    is_streaming: isStreaming ? 1 : 0,
    source_log_id: original.id,
    request_time: requestTime,
  });

  try {
    const response = await fetch(targetUrl, {
      method,
      headers: relayHeaders,
      body: isBodyMethod(method) && relayBody.body !== null ? relayBody.body : undefined,
      signal,
    });

    if (isStreaming && response.body) {
      const chunks = await collectSseChunks(response.body);
      const summary = summarizeStream(provider, chunks);

      completeLog({
        id: logIdInserted,
        response_status: response.status,
        response_body: JSON.stringify(chunks),
        response_body_finish: summary.text,
        input_tokens: summary.tokens.input,
        output_tokens: summary.tokens.output,
        response_time: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        error: null,
      });
    } else {
      const responseText = await response.text();
      let tokens = { input: null as number | null, output: null as number | null };

      try {
        const responseJson = JSON.parse(responseText) as Record<string, unknown>;
        tokens = extractTokens(provider, responseJson);
      } catch {
        // Non-JSON bodies are stored raw.
      }

      completeLog({
        id: logIdInserted,
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    completeLog({
      id: logIdInserted,
      response_status: 502,
      response_body: null,
      response_body_finish: null,
      input_tokens: null,
      output_tokens: null,
      response_time: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      error: message,
    });
  }

  const replayed = getLogById(logIdInserted);
  if (!replayed) {
    throw new ReplayError("Replay log not found", 500);
  }

  return replayed;
}

export const replayLog = replayLogById;
