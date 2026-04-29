const BLOCKED_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "content-encoding",
]);

function cloneHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};

  headers.forEach((value, key) => {
    if (BLOCKED_HEADERS.has(key.toLowerCase())) {
      return;
    }
    result[key] = value;
  });

  return result;
}

export function sanitizeHeaders(headers: Headers): Record<string, string> {
  return cloneHeaders(headers);
}

export function cloneResponseHeaders(headers: Headers): Record<string, string> {
  return cloneHeaders(headers);
}
