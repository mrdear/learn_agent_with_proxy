import type { ParsedMessage, ParsedTool } from "../types";
import { objectEntriesWithout, textFromContentParts } from "../json";

export function getTools(body: Record<string, unknown> | null): ParsedTool[] {
  if (!Array.isArray(body?.tools)) return [];
  return body.tools as ParsedTool[];
}

export function getParams(body: Record<string, unknown> | null): Record<string, unknown> | null {
  return objectEntriesWithout(body, ["messages", "input", "tools", "system", "instructions"]);
}

export function getFirstUserMessage(messages: ParsedMessage[]): string | null {
  const userMessage = messages.find((message) => message.role === "user");
  if (!userMessage) return null;
  return textFromContentParts(userMessage.content);
}

export function hasResponseToolCalls(items: Array<{ kind: string }>): boolean {
  return items.some((item) => item.kind === "tool_call");
}

export function normalizeSystemContent(content: unknown): string | null {
  const text = textFromContentParts(content);
  if (text) return text;
  if (content === null || content === undefined) return null;
  return JSON.stringify(content);
}
