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

export interface RelayStrategy {
  provider: Provider;
  prepareRelayRequest(
    requestBody: RequestBodyInspection,
    requestHeaders: Headers
  ): PreparedRelayRequest;
  getRelayUrl(request: RelayRequest): Promise<string>;
  sendRelayRequest(request: RelayRequest): Promise<RelayResponse>;
  extractTokens(data: Record<string, unknown>): Tokens;
  summarizeStream(chunks: unknown[]): StreamSummary;
}
