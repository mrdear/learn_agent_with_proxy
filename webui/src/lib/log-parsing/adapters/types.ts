import type { LogEntry } from "@/lib/api";
import type { ParsedLog, LogProtocol } from "../types";

export interface AdapterInput {
  log: LogEntry;
  requestBody: Record<string, unknown> | null;
  responseBody: unknown | null;
  streamingChunks: unknown | null;
  effectiveResponseBody: string | null;
}

export interface LogAdapter {
  protocol: LogProtocol;
  matches(input: AdapterInput): boolean;
  parseRequest(input: AdapterInput): ParsedLog["request"];
  parseResponse(input: AdapterInput): ParsedLog["response"];
}
