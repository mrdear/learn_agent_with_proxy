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

function isModelsEndpoint(endpoint: string): boolean {
  const pathname = new URL(endpoint, "http://proxy.local").pathname;
  return pathname === "/v1/models" || pathname.startsWith("/v1/models/");
}

function parseSystemPrompt(messages: ParsedMessage[]): string | null {
  const systemMessages = messages.filter(
    (message) => message.role === "system" || message.role === "developer",
  );
  if (systemMessages.length === 0) return null;

  return systemMessages
    .map((message) => normalizeSystemContent(message.content))
    .filter((content): content is string => Boolean(content))
    .join("\n---\n");
}

function parseResponseItems(responseBody: unknown): ParsedResponseItem[] {
  if (Array.isArray(responseBody)) {
    return parseStreamingResponseItems(responseBody);
  }

  if (!responseBody || typeof responseBody !== "object" || Array.isArray(responseBody)) {
    return [];
  }

  const choices = (responseBody as Record<string, unknown>).choices;
  if (!Array.isArray(choices)) return [];

  return choices.flatMap((choice) => {
    if (!choice || typeof choice !== "object") return [];
    const message = (choice as Record<string, unknown>).message as
      | Record<string, unknown>
      | undefined;
    if (!message) return [];

    const items: ParsedResponseItem[] = [];
    if (message.content !== null && message.content !== undefined) {
      items.push({
        kind: "message",
        role: (message.role as string) || "assistant",
        content: message.content,
        raw: message,
      });
    }

    if (Array.isArray(message.tool_calls)) {
      items.push(
        ...message.tool_calls.map((toolCall) => ({
          kind: "tool_call" as const,
          role: "function_call",
          content: toolCall,
          name:
            typeof toolCall === "object" && toolCall !== null
              ? (((toolCall as Record<string, unknown>).function as Record<string, unknown> | undefined)
                  ?.name as string | undefined)
              : undefined,
          raw: toolCall,
        })),
      );
    }

    return items;
  });
}

function parseStreamingResponseItems(chunks: unknown[]): ParsedResponseItem[] {
  let text = "";
  const toolCalls = new Map<
    string,
    {
      id?: string;
      type?: string;
      function: {
        name?: string;
        arguments: string;
      };
    }
  >();

  for (const chunk of chunks) {
    if (!chunk || typeof chunk !== "object") continue;
    const choices = (chunk as Record<string, unknown>).choices;
    if (!Array.isArray(choices)) continue;

    for (const choice of choices) {
      if (!choice || typeof choice !== "object") continue;
      const delta = (choice as Record<string, unknown>).delta;
      if (!delta || typeof delta !== "object") continue;

      const typedDelta = delta as Record<string, unknown>;
      if (typeof typedDelta.content === "string") {
        text += typedDelta.content;
      }

      if (!Array.isArray(typedDelta.tool_calls)) continue;
      for (const toolCall of typedDelta.tool_calls) {
        if (!toolCall || typeof toolCall !== "object") continue;
        const typedToolCall = toolCall as Record<string, unknown>;
        const index =
          typeof typedToolCall.index === "number" ? String(typedToolCall.index) : null;
        const id = typeof typedToolCall.id === "string" ? typedToolCall.id : null;
        const key = id || index || String(toolCalls.size);
        const current =
          toolCalls.get(key) ??
          {
            function: {
              arguments: "",
            },
          };
        const fn = typedToolCall.function as Record<string, unknown> | undefined;

        if (id) current.id = id;
        if (typeof typedToolCall.type === "string") current.type = typedToolCall.type;
        if (typeof fn?.name === "string") current.function.name = fn.name;
        if (typeof fn?.arguments === "string") current.function.arguments += fn.arguments;

        toolCalls.set(key, current);
      }
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

  for (const toolCall of toolCalls.values()) {
    const parsedArguments = tryParseJsonContent(toolCall.function.arguments);
    items.push({
      kind: "tool_call",
      role: "function_call",
      content: {
        ...toolCall,
        function: {
          ...toolCall.function,
          arguments: parsedArguments ?? toolCall.function.arguments,
        },
      },
      name: toolCall.function.name || "unknown",
      raw: toolCall,
    });
  }

  return items;
}

function parseModelListItems(responseBody: unknown): ParsedResponseItem[] {
  if (!responseBody || typeof responseBody !== "object" || Array.isArray(responseBody)) {
    return [];
  }

  const data = (responseBody as Record<string, unknown>).data;
  if (!Array.isArray(data)) {
    return [];
  }

  const modelIds = data
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const id = (item as Record<string, unknown>).id;
      return typeof id === "string" ? id : null;
    })
    .filter((id): id is string => Boolean(id));
  const preview = modelIds.slice(0, 20);
  const remainingCount = Math.max(modelIds.length - preview.length, 0);
  const content = [
    `${modelIds.length} models returned.`,
    "",
    ...preview.map((id) => `- ${id}`),
    remainingCount > 0 ? `... ${remainingCount} more` : null,
  ].filter((line): line is string => line !== null).join("\n");

  return [
    {
      kind: "message",
      role: "assistant",
      content,
      raw: {
        object: (responseBody as Record<string, unknown>).object,
        count: modelIds.length,
        preview,
      },
    },
  ];
}

export const openAIChatAdapter: LogAdapter = {
  protocol: "openai-chat",
  matches(input: AdapterInput) {
    if (input.log.provider !== "openai") return false;
    return Array.isArray(input.requestBody?.messages) || isModelsEndpoint(input.log.endpoint);
  },
  parseRequest(input: AdapterInput) {
    const messages = parseMessages(input.requestBody);
    return {
      messages,
      systemPrompt: parseSystemPrompt(messages),
      tools: getTools(input.requestBody),
      params: getParams(input.requestBody),
    };
  },
  parseResponse(input: AdapterInput) {
    const isModelsRequest = isModelsEndpoint(input.log.endpoint);
    const items = isModelsRequest
      ? parseModelListItems(input.responseBody)
      : parseResponseItems(input.responseBody);

    return {
      items,
      raw: input.responseBody,
      effectiveBody: isModelsRequest ? null : input.effectiveResponseBody,
      hasToolCalls: hasResponseToolCalls(items),
    };
  },
};
