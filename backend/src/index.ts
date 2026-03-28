import "dotenv/config";

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import path from "path";
import fs from "fs";

// Initialize database (side effect: creates table)
import "./db/index.js";

import proxy from "./routes/proxy.js";
import api from "./routes/api.js";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("/api/*", cors());

// API routes
app.route("/api", api);

// Proxy relay routes (OpenAI / Anthropic inputs, OpenRouter upstream when enabled)
app.route("/", proxy);

// Static file serving - serve webui build output
const webuiDist = path.resolve(import.meta.dirname, "../../webui/dist");

if (fs.existsSync(webuiDist)) {
  app.use(
    "/assets/*",
    serveStatic({
      root: webuiDist,
    })
  );

  // SPA fallback: serve index.html for all non-API, non-asset routes
  app.get("*", (c) => {
    const indexPath = path.join(webuiDist, "index.html");
    if (fs.existsSync(indexPath)) {
      const html = fs.readFileSync(indexPath, "utf-8");
      return c.html(html);
    }
    return c.text("Frontend not built. Run: pnpm --filter webui build", 404);
  });
} else {
  app.get("/", (c) => {
    return c.text("Frontend not built. Run: pnpm --filter webui build");
  });
}

const port = parseInt(process.env.PORT || "3000", 10);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Proxy server running on http://localhost:${info.port}`);
    console.log(`Web UI: http://localhost:${info.port}/`);
    console.log(`Relay modes: OpenAI mode (OpenRouter when configured) and Anthropic mode`);
    console.log(`OpenAI route: http://localhost:${info.port}/v1/chat/completions`);
    console.log(`Anthropic route: http://localhost:${info.port}/v1/messages`);
  }
);
