import Database from "better-sqlite3";
import path from "path";

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

export default db;
