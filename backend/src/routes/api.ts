import { Hono } from "hono";
import {
  clearLogs,
  deleteModelMapping,
  getLogById,
  getLogs,
  getModelMappings,
  getModels,
  getProviderConfigs,
  isProviderName,
  saveModelMapping,
  updateProviderConfig,
} from "../db/index.js";
import { replayLogById, ReplayError, type ReplayOverrides } from "../lib/replay.js";

const api = new Hono();

function parseJsonPayload(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseExtraHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const headers: Record<string, string> = {};
  for (const [key, headerValue] of Object.entries(value as Record<string, unknown>)) {
    if (typeof headerValue === "string" && key.trim() && headerValue.trim()) {
      headers[key.trim()] = headerValue.trim();
    }
  }
  return headers;
}

// GET /api/logs - list logs with pagination and filtering
api.get("/logs", (c) => {
  const page = parseInt(c.req.query("page") || "1", 10);
  const pageSize = parseInt(c.req.query("pageSize") || "50", 10);
  const provider = c.req.query("provider") || undefined;
  const model = c.req.query("model") || undefined;
  const search = c.req.query("search") || undefined;

  const result = getLogs({
    page: Math.max(1, page),
    pageSize: Math.min(100, Math.max(1, pageSize)),
    provider,
    model,
    search,
  });

  return c.json({
    data: result.data,
    total: result.total,
    page,
    pageSize,
  });
});

// GET /api/logs/:id - get single log detail
api.get("/logs/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    return c.json({ error: "Invalid ID" }, 400);
  }

  const log = getLogById(id);
  if (!log) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.json(log);
});

// POST /api/logs/:id/replay - replay or relay an existing log
api.post("/logs/:id/replay", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    return c.json({ error: "Invalid ID" }, 400);
  }

  let overrides: ReplayOverrides = {};

  const rawBody = await c.req.text();
  if (rawBody.trim()) {
    try {
      const parsed = JSON.parse(rawBody) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return c.json({ error: "Invalid request body" }, 400);
      }

      const payload = parsed as Record<string, unknown>;
      overrides = {
        endpoint: typeof payload.endpoint === "string" ? payload.endpoint : undefined,
        method: typeof payload.method === "string" ? payload.method : undefined,
        request_body:
          typeof payload.request_body === "string" || payload.request_body === null
            ? (payload.request_body as string | null)
            : undefined,
      };
    } catch {
      return c.json({ error: "Invalid request body" }, 400);
    }
  }

  try {
    const log = await replayLogById(id, overrides, c.req.raw.signal);
    return c.json(log);
  } catch (error) {
    if (error instanceof ReplayError) {
      const status = error.status as 400 | 404 | 500;
      return c.json({ error: error.message }, status);
    }

    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: "Replay failed", message }, 500);
  }
});

// DELETE /api/logs - clear all logs
api.delete("/logs", (c) => {
  const deleted = clearLogs();
  return c.json({ deleted });
});

// GET /api/models - get distinct model names
api.get("/models", (c) => {
  const models = getModels();
  return c.json(models);
});

api.get("/provider-configs", (c) => {
  return c.json(getProviderConfigs());
});

api.put("/provider-configs/:provider", async (c) => {
  const provider = c.req.param("provider");
  if (!isProviderName(provider)) {
    return c.json({ error: "Unsupported provider" }, 400);
  }

  const payload = parseJsonPayload(await c.req.text());
  if (!payload) {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const baseUrl = typeof payload.base_url === "string" ? payload.base_url.trim() : "";
  if (!isHttpUrl(baseUrl)) {
    return c.json({ error: "Invalid base URL" }, 400);
  }

  const updated = updateProviderConfig({
    provider,
    base_url: baseUrl,
    default_model:
      typeof payload.default_model === "string" ? payload.default_model : null,
    extra_headers: parseExtraHeaders(payload.extra_headers),
    enabled: payload.enabled !== false,
    api_key: typeof payload.api_key === "string" ? payload.api_key : undefined,
    clear_api_key: payload.clear_api_key === true,
    regenerate_access_key: payload.regenerate_access_key === true,
  });

  return c.json(updated);
});

api.get("/model-mappings", (c) => {
  const providerParam = c.req.query("provider");
  if (providerParam && !isProviderName(providerParam)) {
    return c.json({ error: "Unsupported provider" }, 400);
  }

  const provider = providerParam && isProviderName(providerParam) ? providerParam : undefined;
  return c.json(getModelMappings(provider));
});

api.post("/model-mappings", async (c) => {
  const payload = parseJsonPayload(await c.req.text());
  if (!payload) {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const provider = typeof payload.provider === "string" ? payload.provider : "";
  const sourceModel = typeof payload.source_model === "string" ? payload.source_model.trim() : "";
  const targetModel = typeof payload.target_model === "string" ? payload.target_model.trim() : "";
  if (!isProviderName(provider) || !sourceModel || !targetModel) {
    return c.json({ error: "Invalid model mapping" }, 400);
  }

  return c.json(
    saveModelMapping({
      provider,
      source_model: sourceModel,
      target_model: targetModel,
      enabled: payload.enabled !== false,
    })
  );
});

api.put("/model-mappings/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    return c.json({ error: "Invalid ID" }, 400);
  }

  const payload = parseJsonPayload(await c.req.text());
  if (!payload) {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const provider = typeof payload.provider === "string" ? payload.provider : "";
  const sourceModel = typeof payload.source_model === "string" ? payload.source_model.trim() : "";
  const targetModel = typeof payload.target_model === "string" ? payload.target_model.trim() : "";
  if (!isProviderName(provider) || !sourceModel || !targetModel) {
    return c.json({ error: "Invalid model mapping" }, 400);
  }

  return c.json(
    saveModelMapping({
      id,
      provider,
      source_model: sourceModel,
      target_model: targetModel,
      enabled: payload.enabled !== false,
    })
  );
});

api.delete("/model-mappings/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    return c.json({ error: "Invalid ID" }, 400);
  }

  return c.json({ deleted: deleteModelMapping(id) });
});

export default api;
