import { createLog, completeLog } from "../../db/index.js";
import { proxyEventBus } from "../bus.js";
import type {
  ProxyRequestEvent,
  ProxyResponseEvent,
  ProxyErrorEvent,
} from "../types.js";

const requestIdToLogId = new Map<string, number>();

function onProxyRequest(event: ProxyRequestEvent): void {
  try {
    const logId = createLog({
      provider: event.provider,
      endpoint: event.endpoint,
      method: event.method,
      request_headers: JSON.stringify(event.headers),
      request_body: event.body,
      model: event.model,
      is_streaming: event.isStreaming ? 1 : 0,
      source_log_id: event.sourceLogId ?? null,
      request_time: event.requestTime,
    });
    requestIdToLogId.set(event.requestId, logId);
  } catch (error) {
    console.error("Failed to create proxy log:", error);
  }
}

function onProxyResponse(event: ProxyResponseEvent): void {
  const logId = requestIdToLogId.get(event.requestId);
  if (logId === undefined) return;
  requestIdToLogId.delete(event.requestId);

  try {
    completeLog({
      id: logId,
      response_status: event.status,
      response_body: event.body,
      response_body_finish: event.bodyFinish,
      input_tokens: event.inputTokens,
      output_tokens: event.outputTokens,
      cache_read_tokens: event.cacheReadTokens ?? null,
      cache_creation_tokens: event.cacheCreationTokens ?? null,
      thinking_tokens: event.thinkingTokens ?? null,
      response_time: event.responseTime,
      duration_ms: event.durationMs,
      error: null,
    });
  } catch (error) {
    console.error("Failed to complete proxy log:", error);
  }
}

function onProxyError(event: ProxyErrorEvent): void {
  const logId = requestIdToLogId.get(event.requestId);
  if (logId === undefined) return;
  requestIdToLogId.delete(event.requestId);

  try {
    completeLog({
      id: logId,
      response_status: event.status,
      response_body: null,
      response_body_finish: null,
      input_tokens: null,
      output_tokens: null,
      response_time: event.responseTime,
      duration_ms: event.durationMs,
      error: event.error,
    });
  } catch (error) {
    console.error("Failed to complete proxy log:", error);
  }
}

export function registerDbLogger(): void {
  proxyEventBus.on("proxy:request", onProxyRequest);
  proxyEventBus.on("proxy:response", onProxyResponse);
  proxyEventBus.on("proxy:error", onProxyError);
}

export function getLogIdForRequest(requestId: string): number | undefined {
  return requestIdToLogId.get(requestId);
}
