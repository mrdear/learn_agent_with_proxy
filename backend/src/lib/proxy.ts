export type Provider = "openai" | "anthropic" | "openai-responses";

export type Tokens = {
  input: number | null;
  output: number | null;
};

export type StreamSummary = {
  text: string;
  tokens: Tokens;
  tools?: Array<{ name: string; arguments: string; call_id: string }>;
};

export type RequestBodyInspection = {
  raw: string | null;
  json: Record<string, unknown> | null;
  model: string | null;
  isStreaming: boolean;
};

function readNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

export function parseJsonRecord(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

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

export function inspectRequestBody(requestBody: string | null): RequestBodyInspection {
  const json = parseJsonRecord(requestBody);
  const model = json ? extractModel(json) : null;
  const isStreaming = json ? isStreamingRequest(json) : false;

  return {
    raw: requestBody,
    json,
    model,
    isStreaming,
  };
}

function readSseBlocks(buffer: string, chunks: unknown[]): string {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const blocks = normalized.split("\n\n");
  const tail = blocks.pop() ?? "";

  for (const block of blocks) {
    const dataLines = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);

    if (dataLines.length === 0) {
      continue;
    }

    const data = dataLines.join("\n");
    if (data === "[DONE]") {
      continue;
    }

    try {
      chunks.push(JSON.parse(data));
    } catch {
      // Ignore malformed chunks and keep the rest of the stream.
    }
  }

  return tail;
}

function readSseTail(buffer: string, chunks: unknown[]): void {
  const trimmed = buffer.trim();
  if (!trimmed) {
    return;
  }

  const dataLines = trimmed
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);

  if (dataLines.length === 0) {
    return;
  }

  const data = dataLines.join("\n");
  if (data === "[DONE]") {
    return;
  }

  try {
    chunks.push(JSON.parse(data));
  } catch {
    // Ignore malformed tail chunks as well.
  }
}

function extractOpenAITokens(data: Record<string, unknown>): Tokens {
  const usage = data.usage as Record<string, unknown> | undefined;
  if (!usage) {
    return { input: null, output: null };
  }

  return {
    input: readNumber(usage.prompt_tokens),
    output: readNumber(usage.completion_tokens),
  };
}

function extractAnthropicTokens(data: Record<string, unknown>): Tokens {
  const usage = data.usage as Record<string, unknown> | undefined;
  if (!usage) {
    return { input: null, output: null };
  }

  return {
    input: readNumber(usage.input_tokens),
    output: readNumber(usage.output_tokens),
  };
}

export function detectProvider(headers: Headers, path: string): Provider {
  if (path.includes("/responses")) {
    return "openai-responses";
  }

  if (path.includes("/messages") || headers.get("anthropic-version")) {
    return "anthropic";
  }

  return "openai";
}

export function buildTargetUrl(baseUrl: string, requestUrl: URL): string {
  const normalizedBaseUrl = new URL(baseUrl);
  if (!normalizedBaseUrl.pathname.endsWith("/")) {
    normalizedBaseUrl.pathname = `${normalizedBaseUrl.pathname}/`;
  }

  const relativePath = `${requestUrl.pathname.replace(/^\//, "")}${requestUrl.search}`;
  return new URL(relativePath, normalizedBaseUrl).toString();
}

export function extractModel(body: Record<string, unknown>): string | null {
  return typeof body.model === "string" ? body.model : null;
}

export function isStreamingRequest(body: Record<string, unknown> | null): boolean {
  return body?.stream === true;
}

export function extractTokens(provider: Provider, data: Record<string, unknown>): Tokens {
  if (provider === "anthropic") return extractAnthropicTokens(data);
  if (provider === "openai-responses") return extractOpenAIResponsesTokens(data);
  return extractOpenAITokens(data);
}

function extractOpenAIResponsesTokens(data: Record<string, unknown>): Tokens {
  const usage = data.usage as Record<string, unknown> | undefined;
  if (!usage) {
    return { input: null, output: null };
  }
  return {
    input: readNumber(usage.input_tokens),
    output: readNumber(usage.output_tokens),
  };
}

function summarizeResponsesStream(chunks: unknown[]): StreamSummary {
  let text = "";
  let tokens: Tokens = { input: null, output: null };
  const tools: Array<{ name: string; arguments: string; call_id: string }> = [];

  for (const chunk of chunks) {
    const item = chunk as Record<string, unknown>;

    if (item.type === "response.completed" && item.response) {
      const response = item.response as Record<string, unknown>;
      tokens = extractOpenAIResponsesTokens(response);

      const output = response.output as Array<Record<string, unknown>> | undefined;
      if (output) {
        for (const outItem of output) {
          if (outItem.type === "function_call" && typeof outItem.name === "string") {
            tools.push({
              name: outItem.name,
              arguments: (outItem.arguments as string) || "",
              call_id: (outItem.call_id as string) || "",
            });
          } else if (outItem.type === "message") {
            const content = outItem.content as Array<Record<string, unknown>> | undefined;
            if (content) {
              for (const part of content) {
                if (part.type === "output_text" && typeof part.text === "string") {
                  text += part.text;
                }
              }
            }
          }
        }
      }
    }
  }

  // If no text but has tool calls, include them in the summary text
  if (!text && tools.length > 0) {
    text = tools.map((t) => `Tool call: ${t.name}(${t.arguments})`).join("\n");
  }

  return { text, tokens, tools: tools.length > 0 ? tools : undefined };
}

export function summarizeStream(provider: Provider, chunks: unknown[]): StreamSummary {
  if (provider === "openai-responses") {
    return summarizeResponsesStream(chunks);
  }

  let text = "";
  let tokens: Tokens = { input: null, output: null };

  for (const chunk of chunks) {
    const item = chunk as Record<string, unknown>;

    if (provider === "anthropic") {
      if (item.type === "content_block_delta") {
        const delta = item.delta as Record<string, unknown> | undefined;
        if (typeof delta?.text === "string") {
          text += delta.text;
        }
      }

      if (item.type === "message_start") {
        const message = item.message as Record<string, unknown> | undefined;
        const usage = message?.usage as Record<string, unknown> | undefined;
        if (usage) {
          tokens.input = readNumber(usage.input_tokens);
        }
      }

      if (item.type === "message_delta") {
        const usage = item.usage as Record<string, unknown> | undefined;
        if (usage) {
          tokens.output = readNumber(usage.output_tokens);
        }
      }

      continue;
    }

    const choices = item.choices as Array<Record<string, unknown>> | undefined;
    if (!choices) {
      continue;
    }

    for (const choice of choices) {
      const delta = choice.delta as Record<string, unknown> | undefined;
      if (typeof delta?.content === "string") {
        text += delta.content;
      }
    }

    if (item.usage) {
      tokens = extractOpenAITokens(item);
    }
  }

  return { text, tokens };
}

export async function collectSseChunks(body: ReadableStream<Uint8Array>): Promise<unknown[]> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const chunks: unknown[] = [];
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      buffer = readSseBlocks(buffer, chunks);
    }

    buffer += decoder.decode();
    readSseTail(buffer, chunks);
  } catch {
    // Keep partial chunks when the stream ends early or is aborted.
  } finally {
    reader.releaseLock();
  }

  return chunks;
}
export { cloneResponseHeaders, sanitizeHeaders } from "./http.js";
