import type { Provider } from "../lib/proxy.js";

export type ProxyRequestEvent = {
  requestId: string;
  provider: Provider;
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  model: string | null;
  isStreaming: boolean;
  sourceLogId?: number | null;
  requestTime: string;
};

export type ProxyResponseEvent = {
  requestId: string;
  status: number;
  body: string | null;
  bodyFinish: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens?: number | null;
  cacheCreationTokens?: number | null;
  thinkingTokens?: number | null;
  responseTime: string;
  durationMs: number;
};

export type ProxyErrorEvent = {
  requestId: string;
  status: number;
  error: string;
  responseTime: string;
  durationMs: number;
};

export interface ProxyEventMap {
  "proxy:request": ProxyRequestEvent;
  "proxy:response": ProxyResponseEvent;
  "proxy:error": ProxyErrorEvent;
}
