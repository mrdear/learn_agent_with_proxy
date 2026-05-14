export type LogProtocol =
  | "openai-chat"
  | "openai-responses"
  | "anthropic"
  | "unknown";

export interface ParsedMessage {
  role: string;
  content: unknown;
  tool_calls?: unknown;
  tool_call_id?: string;
  name?: string;
}

export interface ParsedTool {
  name: string;
  description: string;
  schema: unknown | null;
  raw: unknown;
}

export interface ParsedResponseItem {
  kind: "message" | "tool_call" | "raw";
  role: string;
  content: unknown;
  name?: string;
  raw?: unknown;
}

export interface ParsedLog {
  provider: string;
  protocol: LogProtocol;
  request: {
    messages: ParsedMessage[];
    systemPrompt: string | null;
    tools: ParsedTool[];
    params: Record<string, unknown> | null;
  };
  response: {
    items: ParsedResponseItem[];
    raw: unknown | null;
    effectiveBody: string | null;
    hasToolCalls: boolean;
  };
  summary: {
    firstUserMessage: string | null;
    hasToolsDefined: boolean;
    hasToolCalls: boolean;
  };
  raw: {
    requestHeaders: unknown | null;
    requestBody: unknown | null;
    responseBody: unknown | null;
    streamingChunks: unknown | null;
  };
}
