import { Hono } from "hono";
import { getLogs, getLogById, getModels } from "../db/index.js";

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

// GET /api/models - get distinct model names
api.get("/models", (c) => {
  const models = getModels();
  return c.json(models);
});

export default api;
