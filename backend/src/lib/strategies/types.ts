import type { Provider, RequestBodyInspection, StreamSummary, Tokens } from "../proxy.js";

export type RelayMethod = "get" | "post" | "put" | "patch" | "delete";

export type RelayRequest = {
  path: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  signal?: AbortSignal;
};

export type RelayResponse = {
  response: Response;
  targetUrl: string;
};

export type PreparedRelayRequest = {
  headers: Record<string, string>;
  body: unknown;
  model: string | null;
};

export type RelayProviderConfig = {
  baseUrl: string;
  apiKey: string | null;
  defaultModel: string | null;
  extraHeaders: Record<string, string>;
  enabled: boolean;
  modelMappings: Record<string, string>;
};

export interface RelayStrategy {
  provider: Provider;
  prepareRelayRequest(
    requestBody: RequestBodyInspection,
    requestHeaders: Headers,
    config: RelayProviderConfig
  ): PreparedRelayRequest;
  getRelayUrl(request: RelayRequest, config: RelayProviderConfig): Promise<string>;
  sendRelayRequest(request: RelayRequest, config: RelayProviderConfig): Promise<RelayResponse>;
  extractTokens(data: Record<string, unknown>): Tokens;
  summarizeStream(chunks: unknown[]): StreamSummary;
}
