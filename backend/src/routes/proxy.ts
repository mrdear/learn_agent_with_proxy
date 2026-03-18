import { Hono } from "hono";
import { createLog, completeLog } from "../db/index.js";

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com";
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";

/**
 * Determine provider based on request headers.
 * Anthropic uses `x-api-key` header; OpenAI uses `Authorization: Bearer ...`.
 * We also check the endpoint path as a fallback.
 */
function detectProvider(headers: Headers, path: string): "openai" | "anthropic" {
  if (headers.get("x-api-key") || path.includes("/messages")) {
    return "anthropic";
  }
  return "openai";
}

function getBaseUrl(provider: "openai" | "anthropic"): string {
  return provider === "openai" ? OPENAI_BASE_URL : ANTHROPIC_BASE_URL;
}

function sanitizeHeaders(headers: Headers): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    // Skip hop-by-hop and host headers
    if (["host", "connection", "keep-alive", "transfer-encoding", "content-length"].includes(lower)) return;
    obj[key] = value;
  });
  return obj;
}

/**
 * Extract model name from the request body.
 */
function extractModel(body: Record<string, unknown>): string | null {
  return (body.model as string) ?? null;
}

/**
 * Extract token usage from OpenAI response.
 */
function extractOpenAITokens(data: Record<string, unknown>): { input: number | null; output: number | null } {
  const usage = data.usage as Record<string, number> | undefined;
  if (!usage) return { input: null, output: null };
  return {
    input: usage.prompt_tokens ?? null,
    output: usage.completion_tokens ?? null,
  };
}

/**
 * Extract token usage from Anthropic response.
 */
function extractAnthropicTokens(data: Record<string, unknown>): { input: number | null; output: number | null } {
  const usage = data.usage as Record<string, number> | undefined;
  if (!usage) return { input: null, output: null };
  return {
    input: usage.input_tokens ?? null,
    output: usage.output_tokens ?? null,
  };
}

function extractTokens(provider: string, data: Record<string, unknown>) {
  return provider === "anthropic" ? extractAnthropicTokens(data) : extractOpenAITokens(data);
}

/**
 * Collect the full assistant text from OpenAI streaming chunks.
 */
function assembleOpenAIStreamContent(chunks: unknown[]): { text: string; tokens: { input: number | null; output: number | null } } {
  let text = "";
  let tokens: { input: number | null; output: number | null } = { input: null, output: null };

  for (const chunk of chunks) {
    const c = chunk as Record<string, unknown>;
    // Accumulate delta content
    const choices = c.choices as Array<Record<string, unknown>> | undefined;
    if (choices) {
      for (const choice of choices) {
        const delta = choice.delta as Record<string, unknown> | undefined;
        if (delta?.content) {
          text += delta.content as string;
        }
      }
    }
    // The last chunk may contain usage
    if (c.usage) {
      tokens = extractOpenAITokens(c);
    }
  }
  return { text, tokens };
}

/**
 * Collect the full assistant text from Anthropic streaming events.
 */
function assembleAnthropicStreamContent(chunks: unknown[]): { text: string; tokens: { input: number | null; output: number | null } } {
  let text = "";
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;

  for (const chunk of chunks) {
    const c = chunk as Record<string, unknown>;
    if (c.type === "content_block_delta") {
      const delta = c.delta as Record<string, unknown> | undefined;
      if (delta?.text) {
        text += delta.text as string;
      }
    }
    if (c.type === "message_start") {
      const message = c.message as Record<string, unknown> | undefined;
      if (message?.usage) {
        const usage = message.usage as Record<string, number>;
        inputTokens = usage.input_tokens ?? null;
      }
    }
    if (c.type === "message_delta") {
      const usage = c.usage as Record<string, number> | undefined;
      if (usage) {
        outputTokens = usage.output_tokens ?? null;
      }
    }
  }
  return { text, tokens: { input: inputTokens, output: outputTokens } };
}

const proxy = new Hono();

// Catch-all proxy route for /v1/*
proxy.all("/v1/*", async (c) => {
  const startTime = Date.now();
  const requestTime = new Date().toISOString();
  const reqPath = new URL(c.req.url).pathname;
  const method = c.req.method;
  const headers = c.req.header();
  const rawHeaders = new Headers(headers);

  const provider = detectProvider(rawHeaders, reqPath);
  const baseUrl = getBaseUrl(provider);
  const targetUrl = `${baseUrl}${reqPath}`;

  let bodyText: string | null = null;
  let bodyJson: Record<string, unknown> | null = null;
  let isStreaming = false;
  let model: string | null = null;

  // Read request body for POST/PUT/PATCH
  if (["POST", "PUT", "PATCH"].includes(method)) {
    bodyText = await c.req.text();
    try {
      bodyJson = JSON.parse(bodyText);
      model = extractModel(bodyJson!);
      isStreaming = (bodyJson as Record<string, unknown>)?.stream === true;
    } catch {
      // Body is not JSON, that's fine
    }
  }

  // Save initial log
  const logId = createLog({
    provider,
    endpoint: reqPath,
    method,
    request_headers: JSON.stringify(sanitizeHeaders(rawHeaders)),
    request_body: bodyText,
    model,
    is_streaming: isStreaming ? 1 : 0,
    request_time: requestTime,
  });

  // Build forwarded headers
  const forwardHeaders = sanitizeHeaders(rawHeaders);

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: forwardHeaders,
    };
    if (bodyText && ["POST", "PUT", "PATCH"].includes(method)) {
      fetchOptions.body = bodyText;
    }

    const response = await fetch(targetUrl, fetchOptions);

    if (isStreaming && response.body) {
      // --- Streaming response ---
      const chunks: unknown[] = [];
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      const stream = new ReadableStream({
        async start(controller) {
          let buffer = "";
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const text = decoder.decode(value, { stream: true });
              // Forward raw bytes to client immediately
              controller.enqueue(value);

              // Parse SSE for logging
              buffer += text;
              const lines = buffer.split("\n");
              // Keep last potentially incomplete line in buffer
              buffer = lines.pop() || "";

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith("data:")) continue;
                const data = trimmed.slice(5).trim();
                if (data === "[DONE]") continue;
                try {
                  chunks.push(JSON.parse(data));
                } catch {
                  // Not valid JSON, skip
                }
              }
            }

            // Process remaining buffer
            if (buffer.trim()) {
              const remaining = buffer.trim();
              if (remaining.startsWith("data:")) {
                const data = remaining.slice(5).trim();
                if (data !== "[DONE]") {
                  try {
                    chunks.push(JSON.parse(data));
                  } catch {
                    // skip
                  }
                }
              }
            }

            controller.close();
          } catch (err) {
            controller.error(err);
          } finally {
            // Save streaming log
            const endTime = Date.now();
            const assembled =
              provider === "anthropic"
                ? assembleAnthropicStreamContent(chunks)
                : assembleOpenAIStreamContent(chunks);

            completeLog({
              id: logId,
              response_status: response.status,
              response_body: JSON.stringify(chunks),
              response_body_finish: assembled.text,
              input_tokens: assembled.tokens.input,
              output_tokens: assembled.tokens.output,
              response_time: new Date().toISOString(),
              duration_ms: endTime - startTime,
              error: null,
            });
          }
        },
      });

      // Return streaming response to client
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (!["content-length", "transfer-encoding", "connection"].includes(lower)) {
          responseHeaders[key] = value;
        }
      });

      return new Response(stream, {
        status: response.status,
        headers: responseHeaders,
      });
    } else {
      // --- Non-streaming response ---
      const responseText = await response.text();
      let tokens = { input: null as number | null, output: null as number | null };

      try {
        const responseJson = JSON.parse(responseText);
        tokens = extractTokens(provider, responseJson);
      } catch {
        // Not JSON
      }

      const endTime = Date.now();
      completeLog({
        id: logId,
        response_status: response.status,
        response_body: null,
        response_body_finish: responseText,
        input_tokens: tokens.input,
        output_tokens: tokens.output,
        response_time: new Date().toISOString(),
        duration_ms: endTime - startTime,
        error: null,
      });

      // Forward response to client
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (!["content-length", "transfer-encoding", "connection"].includes(lower)) {
          responseHeaders[key] = value;
        }
      });
      responseHeaders["content-type"] = response.headers.get("content-type") || "application/json";

      return c.body(responseText, response.status as 200, responseHeaders);
    }
  } catch (err) {
    const endTime = Date.now();
    const errorMessage = err instanceof Error ? err.message : String(err);

    completeLog({
      id: logId,
      response_status: 502,
      response_body: null,
      response_body_finish: null,
      input_tokens: null,
      output_tokens: null,
      response_time: new Date().toISOString(),
      duration_ms: endTime - startTime,
      error: errorMessage,
    });

    return c.json({ error: "Proxy error", message: errorMessage }, 502);
  }
});

export default proxy;
