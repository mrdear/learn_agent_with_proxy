import type { LogAdapter, AdapterInput } from "./types";
import type { ParsedMessage, ParsedResponseItem } from "../types";
import {
  getParams,
  getTools,
  hasResponseToolCalls,
  normalizeSystemContent,
} from "./shared";
import { tryParseJsonContent } from "../json";

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
  if (Array.isArray(responseBody)) {
    return parseStreamingResponseItems(responseBody);
  }

  if (!responseBody || typeof responseBody !== "object") {
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

function parseStreamingResponseItems(chunks: unknown[]): ParsedResponseItem[] {
  let text = "";
  const toolBlocks = new Map<
    number,
    {
      id?: string;
      name?: string;
      inputText: string;
      input?: unknown;
    }
  >();

  for (const chunk of chunks) {
    if (!chunk || typeof chunk !== "object") continue;
    const event = chunk as Record<string, unknown>;

    if (event.type === "content_block_start") {
      const index = typeof event.index === "number" ? event.index : toolBlocks.size;
      const block = event.content_block as Record<string, unknown> | undefined;
      if (block?.type === "tool_use") {
        toolBlocks.set(index, {
          id: typeof block.id === "string" ? block.id : undefined,
          name: typeof block.name === "string" ? block.name : undefined,
          input: block.input,
          inputText: "",
        });
      }
    }

    if (event.type !== "content_block_delta") continue;
    const delta = event.delta as Record<string, unknown> | undefined;
    if (!delta) continue;

    if (typeof delta.text === "string") {
      text += delta.text;
    }

    if (typeof delta.partial_json === "string") {
      const index = typeof event.index === "number" ? event.index : 0;
      const current =
        toolBlocks.get(index) ??
        {
          inputText: "",
        };
      current.inputText += delta.partial_json;
      toolBlocks.set(index, current);
    }
  }

  const items: ParsedResponseItem[] = [];
  if (text) {
    items.push({
      kind: "message",
      role: "assistant",
      content: text,
    });
  }

  for (const block of toolBlocks.values()) {
    const parsedInput = block.inputText ? tryParseJsonContent(block.inputText) : null;
    const raw = {
      type: "tool_use",
      id: block.id,
      name: block.name,
      input: parsedInput ?? block.input ?? block.inputText,
    };

    items.push({
      kind: "tool_call",
      role: "function_call",
      content: raw,
      name: block.name || "unknown",
      raw,
    });
  }

  return items;
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
