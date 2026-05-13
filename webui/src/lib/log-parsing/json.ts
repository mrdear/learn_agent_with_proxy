export function parseJsonObject(value: string | null): Record<string, unknown> | null {
  const parsed = parseJson(value);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return null;
}

export function parseJson(value: string | null): unknown | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function tryParseJsonContent(content: string): unknown | null {
  try {
    const trimmed = content.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      return JSON.parse(trimmed) as unknown;
    }
  } catch {
    return null;
  }
  return null;
}

export function stringifyContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (content === null || content === undefined) return "";
  return JSON.stringify(content, null, 2);
}

export function textFromContentParts(
  content: unknown,
  preferredTypes: string[] = ["text", "input_text", "output_text"],
): string | null {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;

  const text = (content as Array<Record<string, unknown>>)
    .filter((part) => {
      if (typeof part.text !== "string") return false;
      if (typeof part.type !== "string") return true;
      return preferredTypes.includes(part.type);
    })
    .map((part) => part.text as string)
    .join("\n");

  return text || null;
}

export function objectEntriesWithout(
  body: Record<string, unknown> | null,
  excludedKeys: string[],
): Record<string, unknown> | null {
  if (!body) return null;

  const excluded = new Set(excludedKeys);
  const params: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!excluded.has(key)) params[key] = value;
  }

  return Object.keys(params).length > 0 ? params : null;
}
