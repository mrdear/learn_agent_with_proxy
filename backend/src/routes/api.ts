import { Hono } from "hono";
import { getLogs, getLogById, getModels } from "../db/index.js";
import { replayLogById, ReplayError, type ReplayOverrides } from "../lib/replay.js";

const api = new Hono();

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

// GET /api/models - get distinct model names
api.get("/models", (c) => {
  const models = getModels();
  return c.json(models);
});

export default api;
