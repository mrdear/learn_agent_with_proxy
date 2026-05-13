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

export function isProvider(value: string): value is Provider {
  return value === "openai" || value === "anthropic" || value === "openai-responses";
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

export function detectProvider(headers: Headers, path: string): Provider {
  if (path.includes("/responses")) {
    return "openai-responses";
  }

  if (path.includes("/messages") || headers.get("anthropic-version")) {
    return "anthropic";
  }

  return "openai";
}

export function extractModel(body: Record<string, unknown>): string | null {
  return typeof body.model === "string" ? body.model : null;
}

export function isStreamingRequest(body: Record<string, unknown> | null): boolean {
  return body?.stream === true;
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
