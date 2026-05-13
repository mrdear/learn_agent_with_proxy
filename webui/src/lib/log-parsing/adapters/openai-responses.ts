import type { LogAdapter, AdapterInput } from "./types";
import type { ParsedMessage, ParsedResponseItem } from "../types";
import {
  getParams,
  getTools,
  hasResponseToolCalls,
  normalizeSystemContent,
} from "./shared";
import { textFromContentParts } from "../json";

function parseInputMessages(body: Record<string, unknown> | null): ParsedMessage[] {
  if (!Array.isArray(body?.input)) return [];

  return (body.input as Array<Record<string, unknown>>).map((item) => {
    if (item.type === "function_call") {
      return {
        role: "function_call",
        content: JSON.stringify(
          {
            name: item.name,
            arguments: item.arguments,
            call_id: item.call_id,
          },
          null,
          2,
        ),
        name: (item.name as string) || "unknown",
      };
    }

    if (item.type === "function_call_output") {
      return {
        role: "tool",
        content: item.output ?? item,
        name: (item.call_id as string) || "function_output",
      };
    }

    if (
      item.type === "message" ||
      item.role === "user" ||
      item.role === "assistant" ||
      item.role === "system" ||
      item.role === "developer"
    ) {
      return {
        role: (item.role as string) || "user",
        content: item.content,
      };
    }

    return {
      role: "system",
      content: JSON.stringify(item, null, 2),
    };
  });
}

function parseSystemPrompt(
  body: Record<string, unknown> | null,
  messages: ParsedMessage[],
): string | null {
  if (!body) return null;

  const instructions = normalizeSystemContent(body.instructions);
  if (instructions) return instructions;

  const systemMessages = messages.filter(
    (message) => message.role === "system" || message.role === "developer",
  );
  if (systemMessages.length === 0) return null;

  return systemMessages
    .map((message) => normalizeSystemContent(message.content))
    .filter((content): content is string => Boolean(content))
    .join("\n---\n");
}

function extractOutput(responseBody: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(responseBody)) {
    const completedEvent = responseBody.find(
      (event) =>
        event &&
        typeof event === "object" &&
        (event as Record<string, unknown>).type === "response.completed",
    ) as Record<string, unknown> | undefined;
    const response = completedEvent?.response as Record<string, unknown> | undefined;
    return Array.isArray(response?.output) ? response.output as Array<Record<string, unknown>> : [];
  }

  if (!responseBody || typeof responseBody !== "object") return [];
  let response = responseBody as Record<string, unknown>;
  if (response.type === "response.completed" && response.response) {
    response = response.response as Record<string, unknown>;
  }

  return Array.isArray(response.output) ? response.output as Array<Record<string, unknown>> : [];
}

function parseResponseItems(responseBody: unknown): ParsedResponseItem[] {
  return extractOutput(responseBody).map((item) => {
    if (item.type === "function_call") {
      return {
        kind: "tool_call",
        role: "function_call",
        content: JSON.stringify(
          {
            name: item.name,
            arguments: item.arguments,
            call_id: item.call_id,
          },
          null,
          2,
        ),
        name: (item.name as string) || "unknown",
        raw: item,
      };
    }

    if (item.type === "message") {
      const textContent = textFromContentParts(item.content, ["output_text", "text"]);
      return {
        kind: "message",
        role: (item.role as string) || "assistant",
        content: textContent || item,
        raw: item,
      };
    }

    return {
      kind: "raw",
      role: "system",
      content: item,
      raw: item,
    };
  });
}

export const openAIResponsesAdapter: LogAdapter = {
  protocol: "openai-responses",
  matches(input: AdapterInput) {
    if (input.log.provider === "openai-responses") return true;
    return Array.isArray(input.requestBody?.input) || Boolean(input.requestBody?.instructions);
  },
  parseRequest(input: AdapterInput) {
    const messages = parseInputMessages(input.requestBody);
    return {
      messages,
      systemPrompt: parseSystemPrompt(input.requestBody, messages),
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
