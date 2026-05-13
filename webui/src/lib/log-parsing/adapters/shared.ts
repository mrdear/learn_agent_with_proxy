import type { ParsedMessage, ParsedTool } from "../types";
import { objectEntriesWithout, textFromContentParts } from "../json";

function readToolName(tool: Record<string, unknown>): string {
  const functionSpec = tool.function as Record<string, unknown> | undefined;
  if (typeof functionSpec?.name === "string") return functionSpec.name;
  if (typeof tool.name === "string") return tool.name;
  return "(unknown)";
}

function readToolDescription(tool: Record<string, unknown>): string {
  const functionSpec = tool.function as Record<string, unknown> | undefined;
  if (typeof functionSpec?.description === "string") return functionSpec.description;
  if (typeof tool.description === "string") return tool.description;
  return "";
}

function readToolSchema(tool: Record<string, unknown>): unknown | null {
  const functionSpec = tool.function as Record<string, unknown> | undefined;
  if (functionSpec?.parameters !== undefined) return functionSpec.parameters;
  if (tool.parameters !== undefined) return tool.parameters;
  if (tool.input_schema !== undefined) return tool.input_schema;
  return null;
}

function normalizeTool(tool: unknown): ParsedTool {
  if (!tool || typeof tool !== "object" || Array.isArray(tool)) {
    return {
      name: "(unknown)",
      description: "",
      schema: null,
      raw: tool,
    };
  }

  const record = tool as Record<string, unknown>;
  return {
    name: readToolName(record),
    description: readToolDescription(record),
    schema: readToolSchema(record),
    raw: tool,
  };
}

export function getTools(body: Record<string, unknown> | null): ParsedTool[] {
  if (!Array.isArray(body?.tools)) return [];
  return body.tools.map(normalizeTool);
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
