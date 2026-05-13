import type { LogAdapter, AdapterInput } from "./types";
import type { ParsedMessage, ParsedResponseItem } from "../types";
import {
  getParams,
  getTools,
  hasResponseToolCalls,
  normalizeSystemContent,
} from "./shared";

function parseMessages(body: Record<string, unknown> | null): ParsedMessage[] {
  if (!Array.isArray(body?.messages)) return [];
  return body.messages as ParsedMessage[];
}

function parseSystemPrompt(body: Record<string, unknown> | null): string | null {
  if (!body || body.system === undefined) return null;
  if (typeof body.system === "string") return body.system;
  if (Array.isArray(body.system)) {
    return body.system
      .map((block) => {
        if (!block || typeof block !== "object") return "";
        const text = (block as Record<string, unknown>).text;
        return typeof text === "string" ? text : "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return normalizeSystemContent(body.system);
}

function parseResponseItems(responseBody: unknown): ParsedResponseItem[] {
  if (!responseBody || typeof responseBody !== "object" || Array.isArray(responseBody)) {
    return [];
  }

  const content = (responseBody as Record<string, unknown>).content;
  if (!Array.isArray(content)) return [];

  return content.map((block) => {
    if (!block || typeof block !== "object") {
      return {
        kind: "raw",
        role: "assistant",
        content: block,
        raw: block,
      } satisfies ParsedResponseItem;
    }

    const typedBlock = block as Record<string, unknown>;
    if (typedBlock.type === "tool_use") {
      return {
        kind: "tool_call",
        role: "function_call",
        content: typedBlock,
        name: (typedBlock.name as string) || "unknown",
        raw: typedBlock,
      };
    }

    return {
      kind: "message",
      role: "assistant",
      content: typeof typedBlock.text === "string" ? typedBlock.text : typedBlock,
      raw: typedBlock,
    };
  });
}

export const anthropicAdapter: LogAdapter = {
  protocol: "anthropic",
  matches(input: AdapterInput) {
    return input.log.provider === "anthropic";
  },
  parseRequest(input: AdapterInput) {
    return {
      messages: parseMessages(input.requestBody),
      systemPrompt: parseSystemPrompt(input.requestBody),
      tools: getTools(input.requestBody),
      params: getParams(input.requestBody),
    };
  },
  parseResponse(input: AdapterInput) {
    const items = parseResponseItems(input.responseBody);
    return {
      items,
      raw: input.responseBody,
      effectiveBody: input.effectiveResponseBody,
      hasToolCalls: hasResponseToolCalls(items),
    };
  },
};
