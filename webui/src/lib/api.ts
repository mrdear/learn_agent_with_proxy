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

export type ProviderName = "openai" | "openai-responses" | "anthropic";

export interface ProviderConfig {
  provider: ProviderName;
  base_url: string;
  api_key_configured: boolean;
  api_key_hint: string | null;
  access_key: string | null;
  access_key_configured: boolean;
  default_model: string | null;
  extra_headers: Record<string, string>;
  enabled: boolean;
  updated_at: string | null;
}

export interface ProviderConfigUpdate {
  base_url: string;
  api_key?: string;
  clear_api_key?: boolean;
  default_model?: string | null;
  extra_headers?: Record<string, string>;
  enabled: boolean;
  regenerate_access_key?: boolean;
}

export interface ModelMapping {
  id: number;
  provider: ProviderName;
  source_model: string;
  target_model: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export interface ModelMappingInput {
  provider: ProviderName;
  source_model: string;
  target_model: string;
  enabled: boolean;
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

async function readError(res: Response, fallback: string): Promise<Error> {
  const text = await res.text();
  if (!text) {
    return new Error(fallback);
  }

  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string };
    return new Error(parsed.message || parsed.error || fallback);
  } catch {
    return new Error(text);
  }
}

export async function fetchProviderConfigs(): Promise<ProviderConfig[]> {
  const res = await fetch(`${BASE}/provider-configs`);
  if (!res.ok) {
    throw await readError(res, "Failed to load provider configs");
  }
  return res.json();
}

export async function updateProviderSettings(
  provider: ProviderName,
  payload: ProviderConfigUpdate
): Promise<ProviderConfig> {
  const res = await fetch(`${BASE}/provider-configs/${provider}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw await readError(res, "Failed to update provider config");
  }

  return res.json();
}

export async function fetchModelMappings(): Promise<ModelMapping[]> {
  const res = await fetch(`${BASE}/model-mappings`);
  if (!res.ok) {
    throw await readError(res, "Failed to load model mappings");
  }
  return res.json();
}

export async function saveModelMapping(
  payload: ModelMappingInput,
  id?: number
): Promise<ModelMapping> {
  const res = await fetch(`${BASE}/model-mappings${id ? `/${id}` : ""}`, {
    method: id ? "PUT" : "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw await readError(res, "Failed to save model mapping");
  }

  return res.json();
}

export async function deleteModelMapping(id: number): Promise<{ deleted: number }> {
  const res = await fetch(`${BASE}/model-mappings/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw await readError(res, "Failed to delete model mapping");
  }
  return res.json();
}
