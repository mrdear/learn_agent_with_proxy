export interface LogEntry {
  id: number;
  provider: string;
  endpoint: string;
  upstream_url: string | null;
  method: string;
  request_headers: string | null;
  request_body: string | null;
  source_log_id: number | null;
  response_status: number | null;
  response_body: string | null;
  response_body_finish: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  request_time: string;
  response_time: string | null;
  duration_ms: number | null;
  model: string | null;
  is_streaming: number;
  error: string | null;
  created_at: string;
}

export interface LogListResponse {
  data: LogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReplayLogOverrides {
  endpoint?: string;
  method?: string;
  request_body?: string | null;
}

const BASE = "/api";

export async function fetchLogs(params: {
  page?: number;
  pageSize?: number;
  provider?: string;
  model?: string;
  search?: string;
}): Promise<LogListResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", String(params.page));
  if (params.pageSize) searchParams.set("pageSize", String(params.pageSize));
  if (params.provider) searchParams.set("provider", params.provider);
  if (params.model) searchParams.set("model", params.model);
  if (params.search) searchParams.set("search", params.search);

  const res = await fetch(`${BASE}/logs?${searchParams}`);
  return res.json();
}

export async function fetchLogById(id: number): Promise<LogEntry> {
  const res = await fetch(`${BASE}/logs/${id}`);
  return res.json();
}

export async function fetchModels(): Promise<string[]> {
  const res = await fetch(`${BASE}/models`);
  return res.json();
}

export async function clearAllLogs(): Promise<{ deleted: number }> {
  const res = await fetch(`${BASE}/logs`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error("Failed to clear logs");
  }
  return res.json();
}

export async function replayLog(
  id: number,
  overrides?: ReplayLogOverrides
): Promise<LogEntry> {
  const res = await fetch(`${BASE}/logs/${id}/replay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: overrides ? JSON.stringify(overrides) : "",
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to replay log");
  }

  return res.json();
}
