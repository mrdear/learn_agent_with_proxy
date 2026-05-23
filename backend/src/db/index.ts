import Database from "better-sqlite3";
import path from "path";
import {
  createAccessKey,
  decryptConfigSecret,
  encryptConfigSecret,
  hashConfigSecret,
} from "../lib/config-secret.js";

const dbPath = process.env.DATABASE_URL || "./proxy.db";
const resolvedPath = path.resolve(dbPath);

const db = new Database(resolvedPath);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 请求信息
    provider TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    upstream_url TEXT,
    method TEXT NOT NULL,
    request_headers TEXT,
    request_body TEXT,
    
    -- 响应信息
    response_status INTEGER,
    response_body TEXT,
    response_body_finish TEXT,
    
    -- Token 统计
    input_tokens INTEGER,
    output_tokens INTEGER,
    cache_read_tokens INTEGER,
    cache_creation_tokens INTEGER,
    thinking_tokens INTEGER,
    
    -- 时间信息
    request_time TEXT NOT NULL,
    response_time TEXT,
    duration_ms INTEGER,
    
    -- 附加信息
    model TEXT,
    is_streaming INTEGER DEFAULT 0,
    source_log_id INTEGER,
    error TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS provider_configs (
    provider TEXT PRIMARY KEY,
    base_url TEXT NOT NULL,
    api_key_cipher TEXT,
    default_model TEXT,
    extra_headers TEXT,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS model_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    source_model TEXT NOT NULL,
    target_model TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, source_model)
  );

  CREATE INDEX IF NOT EXISTS idx_model_mappings_provider
    ON model_mappings(provider, enabled);
`);

function ensureColumn(column: string, ddl: string): void {
  const columns = db.prepare("PRAGMA table_info(logs)").all() as { name: string }[];
  if (!columns.some((col) => col.name === column)) {
    db.exec(ddl);
  }
}

ensureColumn("source_log_id", "ALTER TABLE logs ADD COLUMN source_log_id INTEGER");
ensureColumn("cache_read_tokens", "ALTER TABLE logs ADD COLUMN cache_read_tokens INTEGER");
ensureColumn("cache_creation_tokens", "ALTER TABLE logs ADD COLUMN cache_creation_tokens INTEGER");
ensureColumn("thinking_tokens", "ALTER TABLE logs ADD COLUMN thinking_tokens INTEGER");
ensureColumn("upstream_url", "ALTER TABLE logs ADD COLUMN upstream_url TEXT");

function ensureProviderConfigColumn(column: string, ddl: string): void {
  const columns = db.prepare("PRAGMA table_info(provider_configs)").all() as { name: string }[];
  if (!columns.some((col) => col.name === column)) {
    db.exec(ddl);
  }
}

function ensureModelMappingColumn(column: string, ddl: string): void {
  const columns = db.prepare("PRAGMA table_info(model_mappings)").all() as { name: string }[];
  if (!columns.some((col) => col.name === column)) {
    db.exec(ddl);
  }
}

ensureProviderConfigColumn("api_key_cipher", "ALTER TABLE provider_configs ADD COLUMN api_key_cipher TEXT");
ensureProviderConfigColumn("default_model", "ALTER TABLE provider_configs ADD COLUMN default_model TEXT");
ensureProviderConfigColumn("extra_headers", "ALTER TABLE provider_configs ADD COLUMN extra_headers TEXT");
ensureProviderConfigColumn("access_key_cipher", "ALTER TABLE provider_configs ADD COLUMN access_key_cipher TEXT");
ensureProviderConfigColumn("access_key_hash", "ALTER TABLE provider_configs ADD COLUMN access_key_hash TEXT");
ensureProviderConfigColumn("enabled", "ALTER TABLE provider_configs ADD COLUMN enabled INTEGER DEFAULT 1");
ensureProviderConfigColumn("created_at", "ALTER TABLE provider_configs ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP");
ensureProviderConfigColumn("updated_at", "ALTER TABLE provider_configs ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP");
ensureModelMappingColumn("enabled", "ALTER TABLE model_mappings ADD COLUMN enabled INTEGER DEFAULT 1");
ensureModelMappingColumn("created_at", "ALTER TABLE model_mappings ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP");
ensureModelMappingColumn("updated_at", "ALTER TABLE model_mappings ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP");

export interface LogRow {
  id: number;
  provider: string;
  endpoint: string;
  upstream_url: string | null;
  method: string;
  request_headers: string | null;
  request_body: string | null;
  response_status: number | null;
  response_body: string | null;
  response_body_finish: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cache_creation_tokens: number | null;
  thinking_tokens: number | null;
  request_time: string;
  response_time: string | null;
  duration_ms: number | null;
  model: string | null;
  is_streaming: number;
  source_log_id: number | null;
  error: string | null;
  created_at: string;
}

export type ProviderName = "openai" | "anthropic" | "openai-responses";

export interface ProviderConfigPublic {
  provider: ProviderName;
  base_url: string;
  api_key_configured: boolean;
  access_key: string | null;
  access_key_configured: boolean;
  default_model: string | null;
  extra_headers: Record<string, string>;
  enabled: boolean;
  updated_at: string | null;
}

export interface ProviderRuntimeConfig {
  provider: ProviderName;
  baseUrl: string;
  apiKey: string | null;
  defaultModel: string | null;
  extraHeaders: Record<string, string>;
  enabled: boolean;
  modelMappings: Record<string, string>;
}

export interface ModelMappingRow {
  id: number;
  provider: ProviderName;
  source_model: string;
  target_model: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

const providerNames = ["openai", "openai-responses", "anthropic"] as const;

export function isProviderName(value: string): value is ProviderName {
  return providerNames.includes(value as ProviderName);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseHeadersJson(value: string | null): Record<string, string> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const headers: Record<string, string> = {};
    for (const [key, headerValue] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof headerValue === "string" && key.trim() && headerValue.trim()) {
        headers[key.trim()] = headerValue.trim();
      }
    }
    return headers;
  } catch {
    return {};
  }
}

function stringifyHeaders(value: Record<string, string> | null | undefined): string {
  const headers: Record<string, string> = {};
  for (const [key, headerValue] of Object.entries(value ?? {})) {
    if (key.trim() && headerValue.trim()) {
      headers[key.trim()] = headerValue.trim();
    }
  }
  return JSON.stringify(headers);
}

function createOpenAIExtraHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const referer = process.env.OPENAI_HTTP_REFERER?.trim();
  const title = process.env.OPENAI_TITLE?.trim();

  if (referer) {
    headers["HTTP-Referer"] = referer;
  }
  if (title) {
    headers["X-Title"] = title;
  }

  return headers;
}

const seedProviderConfig = db.prepare(`
  INSERT OR IGNORE INTO provider_configs
    (provider, base_url, api_key_cipher, access_key_cipher, access_key_hash, default_model, extra_headers, enabled)
  VALUES
    (@provider, @base_url, @api_key_cipher, @access_key_cipher, @access_key_hash, @default_model, @extra_headers, 1)
`);

for (const config of [
  {
    provider: "openai",
    base_url: process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com",
    api_key: normalizeOptionalText(process.env.OPENAI_API_KEY),
    default_model: normalizeOptionalText(process.env.OPENAI_DEFAULT_MODEL),
    extra_headers: createOpenAIExtraHeaders(),
  },
  {
    provider: "openai-responses",
    base_url: process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com",
    api_key: normalizeOptionalText(process.env.OPENAI_API_KEY),
    default_model: normalizeOptionalText(process.env.OPENAI_DEFAULT_MODEL),
    extra_headers: createOpenAIExtraHeaders(),
  },
  {
    provider: "anthropic",
    base_url: process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com",
    api_key: normalizeOptionalText(process.env.ANTHROPIC_API_KEY),
    default_model: null,
    extra_headers: {},
  },
] satisfies Array<{
  provider: ProviderName;
  base_url: string;
  api_key: string | null;
  default_model: string | null;
  extra_headers: Record<string, string>;
}>) {
  const accessKey = createAccessKey();
  seedProviderConfig.run({
    provider: config.provider,
    base_url: config.base_url,
    api_key_cipher: encryptConfigSecret(config.api_key),
    access_key_cipher: encryptConfigSecret(accessKey),
    access_key_hash: hashConfigSecret(accessKey),
    default_model: config.default_model,
    extra_headers: stringifyHeaders(config.extra_headers),
  });
}

const rowsWithoutAccessKey = db
  .prepare(
    `SELECT provider FROM provider_configs
     WHERE access_key_cipher IS NULL OR access_key_hash IS NULL`
  )
  .all() as Array<{ provider: string }>;

const updateAccessKey = db.prepare(
  `UPDATE provider_configs SET
    access_key_cipher = @access_key_cipher,
    access_key_hash = @access_key_hash,
    updated_at = CURRENT_TIMESTAMP
   WHERE provider = @provider`
);

for (const row of rowsWithoutAccessKey) {
  if (!isProviderName(row.provider)) continue;
  const accessKey = createAccessKey();
  updateAccessKey.run({
    provider: row.provider,
    access_key_cipher: encryptConfigSecret(accessKey),
    access_key_hash: hashConfigSecret(accessKey),
  });
}

const insertLog = db.prepare(`
  INSERT INTO logs (provider, endpoint, upstream_url, method, request_headers, request_body, model, is_streaming, source_log_id, request_time)
  VALUES (@provider, @endpoint, @upstream_url, @method, @request_headers, @request_body, @model, @is_streaming, @source_log_id, @request_time)
`);

const updateLogResponse = db.prepare(`
  UPDATE logs SET
    response_status = @response_status,
    response_body = @response_body,
    response_body_finish = @response_body_finish,
    input_tokens = @input_tokens,
    output_tokens = @output_tokens,
    cache_read_tokens = @cache_read_tokens,
    cache_creation_tokens = @cache_creation_tokens,
    thinking_tokens = @thinking_tokens,
    response_time = @response_time,
    duration_ms = @duration_ms,
    error = @error
  WHERE id = @id
`);

export function createLog(data: {
  provider: string;
  endpoint: string;
  upstream_url: string | null;
  method: string;
  request_headers: string | null;
  request_body: string | null;
  model: string | null;
  is_streaming: number;
  source_log_id?: number | null;
  request_time: string;
}): number {
  const result = insertLog.run({
    ...data,
    source_log_id: data.source_log_id ?? null,
  });
  return Number(result.lastInsertRowid);
}

export function completeLog(data: {
  id: number;
  response_status: number | null;
  response_body: string | null;
  response_body_finish: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens?: number | null;
  cache_creation_tokens?: number | null;
  thinking_tokens?: number | null;
  response_time: string;
  duration_ms: number;
  error: string | null;
}): void {
  updateLogResponse.run({
    ...data,
    cache_read_tokens: data.cache_read_tokens ?? null,
    cache_creation_tokens: data.cache_creation_tokens ?? null,
    thinking_tokens: data.thinking_tokens ?? null,
  });
}

export function getLogs(params: {
  page: number;
  pageSize: number;
  provider?: string;
  model?: string;
  search?: string;
}): { data: LogRow[]; total: number } {
  const conditions: string[] = [];
  const values: Record<string, unknown> = {};

  if (params.provider) {
    conditions.push("provider = @provider");
    values.provider = params.provider;
  }
  if (params.model) {
    conditions.push("model = @model");
    values.model = params.model;
  }
  if (params.search) {
    conditions.push("(request_body LIKE @search OR response_body_finish LIKE @search OR model LIKE @search)");
    values.search = `%${params.search}%`;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (params.page - 1) * params.pageSize;

  const total = (
    db.prepare(`SELECT COUNT(*) as count FROM logs ${where}`).get(values) as { count: number }
  ).count;

  const data = db
    .prepare(`SELECT * FROM logs ${where} ORDER BY id DESC LIMIT @limit OFFSET @offset`)
    .all({ ...values, limit: params.pageSize, offset }) as LogRow[];

  return { data, total };
}

export function getLogById(id: number): LogRow | undefined {
  return db.prepare("SELECT * FROM logs WHERE id = @id").get({ id }) as LogRow | undefined;
}

export function clearLogs(): number {
  const result = db.prepare("DELETE FROM logs").run();
  return result.changes;
}

export function getModels(): string[] {
  const rows = db.prepare("SELECT DISTINCT model FROM logs WHERE model IS NOT NULL ORDER BY model").all() as { model: string }[];
  return rows.map((r) => r.model);
}

type ProviderConfigDbRow = {
  provider: string;
  base_url: string;
  api_key_cipher: string | null;
  access_key_cipher: string | null;
  access_key_hash: string | null;
  default_model: string | null;
  extra_headers: string | null;
  enabled: number;
  updated_at: string | null;
};

function toPublicProviderConfig(row: ProviderConfigDbRow): ProviderConfigPublic {
  if (!isProviderName(row.provider)) {
    throw new Error(`Unsupported provider config: ${row.provider}`);
  }

  return {
    provider: row.provider,
    base_url: row.base_url,
    api_key_configured: Boolean(row.api_key_cipher),
    access_key: decryptConfigSecret(row.access_key_cipher),
    access_key_configured: Boolean(row.access_key_hash),
    default_model: row.default_model,
    extra_headers: parseHeadersJson(row.extra_headers),
    enabled: row.enabled === 1,
    updated_at: row.updated_at,
  };
}

export function getProviderConfigs(): ProviderConfigPublic[] {
  const rows = db
    .prepare("SELECT * FROM provider_configs ORDER BY provider")
    .all() as ProviderConfigDbRow[];
  return rows.map(toPublicProviderConfig);
}

export function getProviderConfig(provider: ProviderName): ProviderRuntimeConfig | null {
  const row = db
    .prepare("SELECT * FROM provider_configs WHERE provider = @provider")
    .get({ provider }) as ProviderConfigDbRow | undefined;

  if (!row || !isProviderName(row.provider)) {
    return null;
  }

  const mappings = db
    .prepare(
      `SELECT source_model, target_model
       FROM model_mappings
       WHERE provider = @provider AND enabled = 1`
    )
    .all({ provider }) as Array<{ source_model: string; target_model: string }>;

  return {
    provider: row.provider,
    baseUrl: row.base_url,
    apiKey: decryptConfigSecret(row.api_key_cipher),
    defaultModel: row.default_model,
    extraHeaders: parseHeadersJson(row.extra_headers),
    enabled: row.enabled === 1,
    modelMappings: Object.fromEntries(
      mappings.map((mapping) => [mapping.source_model, mapping.target_model])
    ),
  };
}

export function getProviderConfigByAccessKey(accessKey: string): ProviderRuntimeConfig | null {
  const accessKeyHash = hashConfigSecret(accessKey);
  const row = db
    .prepare("SELECT provider FROM provider_configs WHERE access_key_hash = @access_key_hash")
    .get({ access_key_hash: accessKeyHash }) as { provider: string } | undefined;

  if (!row || !isProviderName(row.provider)) {
    return null;
  }

  return getProviderConfig(row.provider);
}

export function updateProviderConfig(data: {
  provider: ProviderName;
  base_url: string;
  default_model?: string | null;
  extra_headers?: Record<string, string>;
  enabled: boolean;
  api_key?: string | null;
  clear_api_key?: boolean;
  regenerate_access_key?: boolean;
}): ProviderConfigPublic {
  const current = db
    .prepare("SELECT * FROM provider_configs WHERE provider = @provider")
    .get({ provider: data.provider }) as ProviderConfigDbRow | undefined;

  const apiKeyCipher = data.clear_api_key
    ? null
    : data.api_key !== undefined
      ? encryptConfigSecret(normalizeOptionalText(data.api_key))
      : (current?.api_key_cipher ?? null);
  const accessKey = data.regenerate_access_key || !current?.access_key_cipher
    ? createAccessKey()
    : null;
  const accessKeyCipher = accessKey
    ? encryptConfigSecret(accessKey)
    : (current?.access_key_cipher ?? null);
  const accessKeyHash = accessKey
    ? hashConfigSecret(accessKey)
    : (current?.access_key_hash ?? null);

  db.prepare(
    `INSERT INTO provider_configs
       (provider, base_url, api_key_cipher, access_key_cipher, access_key_hash, default_model, extra_headers, enabled, updated_at)
     VALUES
       (@provider, @base_url, @api_key_cipher, @access_key_cipher, @access_key_hash, @default_model, @extra_headers, @enabled, CURRENT_TIMESTAMP)
     ON CONFLICT(provider) DO UPDATE SET
       base_url = excluded.base_url,
       api_key_cipher = excluded.api_key_cipher,
       access_key_cipher = excluded.access_key_cipher,
       access_key_hash = excluded.access_key_hash,
       default_model = excluded.default_model,
       extra_headers = excluded.extra_headers,
       enabled = excluded.enabled,
       updated_at = CURRENT_TIMESTAMP`
  ).run({
    provider: data.provider,
    base_url: data.base_url.trim(),
    api_key_cipher: apiKeyCipher,
    access_key_cipher: accessKeyCipher,
    access_key_hash: accessKeyHash,
    default_model: normalizeOptionalText(data.default_model),
    extra_headers: stringifyHeaders(data.extra_headers),
    enabled: data.enabled ? 1 : 0,
  });

  const updated = db
    .prepare("SELECT * FROM provider_configs WHERE provider = @provider")
    .get({ provider: data.provider }) as ProviderConfigDbRow;
  return toPublicProviderConfig(updated);
}

export function getModelMappings(provider?: ProviderName): ModelMappingRow[] {
  if (provider) {
    return db
      .prepare("SELECT * FROM model_mappings WHERE provider = @provider ORDER BY source_model")
      .all({ provider }) as ModelMappingRow[];
  }

  return db
    .prepare("SELECT * FROM model_mappings ORDER BY provider, source_model")
    .all() as ModelMappingRow[];
}

export function saveModelMapping(data: {
  id?: number;
  provider: ProviderName;
  source_model: string;
  target_model: string;
  enabled: boolean;
}): ModelMappingRow {
  if (data.id) {
    db.prepare(
      `UPDATE model_mappings SET
        provider = @provider,
        source_model = @source_model,
        target_model = @target_model,
        enabled = @enabled,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = @id`
    ).run({
      id: data.id,
      provider: data.provider,
      source_model: data.source_model.trim(),
      target_model: data.target_model.trim(),
      enabled: data.enabled ? 1 : 0,
    });
  } else {
    db.prepare(
      `INSERT INTO model_mappings
        (provider, source_model, target_model, enabled, updated_at)
       VALUES
        (@provider, @source_model, @target_model, @enabled, CURRENT_TIMESTAMP)
       ON CONFLICT(provider, source_model) DO UPDATE SET
        target_model = excluded.target_model,
        enabled = excluded.enabled,
        updated_at = CURRENT_TIMESTAMP`
    ).run({
      provider: data.provider,
      source_model: data.source_model.trim(),
      target_model: data.target_model.trim(),
      enabled: data.enabled ? 1 : 0,
    });
  }

  return db
    .prepare(
      `SELECT * FROM model_mappings
       WHERE provider = @provider AND source_model = @source_model`
    )
    .get({
      provider: data.provider,
      source_model: data.source_model.trim(),
    }) as ModelMappingRow;
}

export function deleteModelMapping(id: number): number {
  const result = db.prepare("DELETE FROM model_mappings WHERE id = @id").run({ id });
  return result.changes;
}

export default db;
