import { useEffect, useMemo, useState } from "react";
import type { LogEntry, ReplayLogOverrides } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { replayLog } from "@/lib/api";
import { toast } from "sonner";
import { LogRelayPanel } from "@/components/log-relay-panel";
import { MagnifyingGlass } from "@phosphor-icons/react";

interface LogDetailProps {
  log: LogEntry;
  showActions?: boolean;
  onReplayComplete?: (log: LogEntry) => void;
}

// ── Extraction helpers ──

function parseBody(requestBody: string | null): Record<string, unknown> | null {
  if (!requestBody) return null;
  try {
    return JSON.parse(requestBody);
  } catch {
    return null;
  }
}

function extractMessages(body: Record<string, unknown> | null): Array<{ role: string; content: unknown; tool_calls?: unknown; tool_call_id?: string; name?: string }> | null {
  if (!body) return null;
  return (body.messages as Array<{ role: string; content: unknown }>) ?? null;
}

function extractSystemPrompt(body: Record<string, unknown> | null, provider: string): string | null {
  if (!body) return null;

  // Anthropic: top-level "system" field
  if (provider === "anthropic" && body.system) {
    if (typeof body.system === "string") return body.system;
    if (Array.isArray(body.system)) {
      return (body.system as Array<{ text?: string; type?: string }>)
        .map((b) => b.text || "")
        .join("\n");
    }
  }

  // OpenAI: system / developer role in messages
  const msgs = body.messages as Array<{ role: string; content: unknown }> | undefined;
  if (msgs) {
    const systemMsgs = msgs.filter((m) => m.role === "system" || m.role === "developer");
    if (systemMsgs.length > 0) {
      return systemMsgs
        .map((m) => {
          if (typeof m.content === "string") return m.content;
          if (Array.isArray(m.content)) {
            return (m.content as Array<{ text?: string }>)
              .map((p) => p.text || "")
              .join("\n");
          }
          return JSON.stringify(m.content);
        })
        .join("\n---\n");
    }
  }

  return null;
}

interface ToolDef {
  type?: string;
  function?: { name?: string; description?: string; parameters?: unknown };
  name?: string;
  description?: string;
  input_schema?: unknown;
}

function extractTools(body: Record<string, unknown> | null): ToolDef[] | null {
  if (!body) return null;
  return (body.tools as ToolDef[]) ?? null;
}

function extractRequestParams(body: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!body) return null;
  const params: Record<string, unknown> = {};
  const exclude = new Set(["messages", "tools", "system"]);
  for (const [k, v] of Object.entries(body)) {
    if (!exclude.has(k)) params[k] = v;
  }
  return Object.keys(params).length > 0 ? params : null;
}

function getToolName(tool: ToolDef): string {
  // OpenAI format
  if (tool.function?.name) return tool.function.name;
  // Anthropic format
  if (tool.name) return tool.name;
  return "(unknown)";
}

function getToolDescription(tool: ToolDef): string {
  if (tool.function?.description) return tool.function.description;
  if (tool.description) return tool.description;
  return "";
}

function getToolSchema(tool: ToolDef): unknown {
  if (tool.function?.parameters) return tool.function.parameters;
  if (tool.input_schema) return tool.input_schema;
  return null;
}

// ── Sub-components ──

function JsonBlock({ label, data }: { label: string; data: string | null }) {
  if (!data) return null;
  let formatted: string;
  try {
    formatted = JSON.stringify(JSON.parse(data), null, 2);
  } catch {
    formatted = data;
  }
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap break-all">
        {formatted}
      </pre>
    </div>
  );
}

const roleMeta: Record<string, { bg: string; label: string }> = {
  system: { bg: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200", label: "System" },
  developer: { bg: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200", label: "Developer" },
  user: { bg: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200", label: "User" },
  assistant: { bg: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200", label: "Assistant" },
  tool: { bg: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200", label: "Tool Result" },
};

function MessageItem({ msg, index }: { msg: { role: string; content: unknown; tool_calls?: unknown; tool_call_id?: string; name?: string }; index: number }) {
  const meta = roleMeta[msg.role] || { bg: "", label: msg.role };

  const contentText =
    typeof msg.content === "string"
      ? msg.content
      : msg.content !== null && msg.content !== undefined
        ? JSON.stringify(msg.content, null, 2)
        : "";

  const hasToolCalls = msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0;

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b border-border">
        <Badge variant="outline" className={meta.bg}>
          {meta.label}
        </Badge>
        <span className="text-[10px] text-muted-foreground font-mono">#{index}</span>
        {msg.role === "tool" && msg.name && (
          <span className="text-[10px] text-muted-foreground font-mono">
            fn: {msg.name}
          </span>
        )}
      </div>
      {contentText && (
        <pre className="p-3 text-xs overflow-x-auto max-h-[400px] overflow-y-auto whitespace-pre-wrap break-all">
          {contentText}
        </pre>
      )}
      {!!hasToolCalls && (
        <div className="border-t border-border p-3">
          <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider font-semibold">Tool Calls</p>
          <pre className="bg-muted rounded-md p-2 text-xs overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap break-all">
            {JSON.stringify(msg.tool_calls, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ToolCard({ tool, highlight }: { tool: ToolDef; highlight: string }) {
  const name = getToolName(tool);
  const desc = getToolDescription(tool);
  const schema = getToolSchema(tool);

  const nameMatch = highlight && name.toLowerCase().includes(highlight.toLowerCase());
  const descMatch = highlight && desc.toLowerCase().includes(highlight.toLowerCase());

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
        <span className={`font-mono text-sm font-semibold ${nameMatch ? "bg-yellow-200 dark:bg-yellow-800 px-1 rounded" : ""}`}>
          {name}
        </span>
      </div>
      {desc && (
        <div className="px-3 py-2 border-b border-border">
          <p className={`text-xs text-muted-foreground ${descMatch ? "bg-yellow-200/50 dark:bg-yellow-800/50" : ""}`}>
            {desc}
          </p>
        </div>
      )}
      {schema != null && (
        <pre className="p-3 text-xs overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap break-all">
          {JSON.stringify(schema, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ToolsPanel({ tools }: { tools: ToolDef[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return tools;
    const q = search.toLowerCase();
    return tools.filter((t) => {
      const name = getToolName(t).toLowerCase();
      const desc = getToolDescription(t).toLowerCase();
      const schema = JSON.stringify(getToolSchema(t) || "").toLowerCase();
      return name.includes(q) || desc.includes(q) || schema.includes(q);
    });
  }, [tools, search]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search tools by name, description, schema..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-xs"
        />
      </div>
      <div className="text-xs text-muted-foreground">
        {filtered.length} / {tools.length} tools
      </div>
      <div className="space-y-2">
        {filtered.map((tool, i) => (
          <ToolCard key={i} tool={tool} highlight={search} />
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No tools match "{search}"
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main component ──

export function LogDetail({
  log,
  showActions = true,
  onReplayComplete,
}: LogDetailProps) {
  const body = parseBody(log.request_body);
  const messages = extractMessages(body);
  const systemPrompt = extractSystemPrompt(body, log.provider);
  const tools = extractTools(body);
  const params = extractRequestParams(body);
  const nonSystemMessages =
    messages?.filter((m) => m.role !== "system" && m.role !== "developer") ?? [];

  const [activeTab, setActiveTab] = useState("messages");
  const [replaying, setReplaying] = useState(false);

  useEffect(() => {
    setActiveTab("messages");
    setReplaying(false);
  }, [log.id]);

  const handleReplay = async (overrides?: ReplayLogOverrides): Promise<void> => {
    const mode = overrides ? "relay" : "replay";
    setReplaying(true);

    try {
      const replayed = await replayLog(log.id, overrides);
      toast.success(
        overrides
          ? `Relayed as #${replayed.id}`
          : `Replayed as #${replayed.id}`
      );
      onReplayComplete?.(replayed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(mode === "relay" ? `Relay failed: ${message}` : `Replay failed: ${message}`);
    } finally {
      setReplaying(false);
    }
  };

  const sourceLabel = log.source_log_id ? `#${log.source_log_id}` : "Original";

  return (
    <div className="space-y-5 p-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm lg:grid-cols-4">
        <div>
          <span className="text-xs text-muted-foreground">Provider</span>
          <div>
            <Badge variant="default" className="shadow-sm">
              {log.provider}
            </Badge>
          </div>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Model</span>
          <div className="font-mono text-xs">{log.model || "--"}</div>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Status</span>
          <div className="font-mono text-xs">{log.response_status ?? "--"}</div>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Streaming</span>
          <div className="text-xs">{log.is_streaming ? "Yes (SSE)" : "No"}</div>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Input Tokens</span>
          <div className="font-mono text-xs">{log.input_tokens ?? "--"}</div>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Output Tokens</span>
          <div className="font-mono text-xs">{log.output_tokens ?? "--"}</div>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Duration</span>
          <div className="font-mono text-xs">
            {log.duration_ms != null ? `${log.duration_ms}ms` : "--"}
          </div>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Time</span>
          <div className="text-xs">
            {new Date(log.request_time).toLocaleString("zh-CN")}
          </div>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Origin</span>
          <div>
            <Badge variant={log.source_log_id ? "secondary" : "outline"}>
              {sourceLabel}
            </Badge>
          </div>
        </div>
      </div>

      {log.error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3">
          <p className="text-xs font-medium text-destructive">Error: {log.error}</p>
        </div>
      )}

      {showActions && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-none border border-primary/15 bg-primary/5 px-3 py-2">
          <div className="flex flex-col gap-1">
            <Badge variant="default" className="w-fit shadow-sm">
              Replay tools
            </Badge>
            <p className="text-xs text-muted-foreground">
              Replay sends the captured request again. Relay opens the editor tab so you
              can tweak the path, method, or body before resending.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="shadow-sm"
              disabled={replaying}
              onClick={() => {
                void handleReplay();
              }}
            >
              {replaying ? "Replaying..." : "Replay exact"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={replaying}
              onClick={() => setActiveTab("relay")}
            >
              Open relay
            </Button>
          </div>
        </div>
      )}

      <Separator />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="messages">
            Messages {nonSystemMessages.length > 0 && `(${nonSystemMessages.length})`}
          </TabsTrigger>
          <TabsTrigger value="system">System Prompt</TabsTrigger>
          {tools && <TabsTrigger value="tools">Tools ({tools.length})</TabsTrigger>}
          <TabsTrigger value="params">Params</TabsTrigger>
          <TabsTrigger value="response">Response</TabsTrigger>
          <TabsTrigger value="raw">Raw</TabsTrigger>
          {showActions && <TabsTrigger value="relay">Relay</TabsTrigger>}
        </TabsList>

        <TabsContent value="messages" className="mt-4 space-y-2">
          {nonSystemMessages.length > 0 ? (
            nonSystemMessages.map((msg, i) => (
              <MessageItem key={i} msg={msg} index={i} />
            ))
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No messages found
            </p>
          )}
        </TabsContent>

        <TabsContent value="system" className="mt-4">
          {systemPrompt ? (
            <pre className="max-h-[700px] overflow-x-auto overflow-y-auto whitespace-pre-wrap break-all rounded-md bg-muted p-4 text-xs leading-relaxed">
              {systemPrompt}
            </pre>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No system prompt found
            </p>
          )}
        </TabsContent>

        {tools && (
          <TabsContent value="tools" className="mt-4">
            <ToolsPanel tools={tools} />
          </TabsContent>
        )}

        <TabsContent value="params" className="mt-4">
          {params ? (
            <pre className="max-h-[600px] overflow-x-auto overflow-y-auto whitespace-pre-wrap break-all rounded-md bg-muted p-4 text-xs">
              {JSON.stringify(params, null, 2)}
            </pre>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No parameters
            </p>
          )}
        </TabsContent>

        <TabsContent value="response" className="mt-4">
          {log.response_body_finish ? (
            <pre className="max-h-[700px] overflow-x-auto overflow-y-auto whitespace-pre-wrap break-all rounded-md bg-muted p-4 text-xs leading-relaxed">
              {log.response_body_finish}
            </pre>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No response body
            </p>
          )}
        </TabsContent>

        <TabsContent value="raw" className="mt-4 space-y-4">
          <JsonBlock label="Request Headers" data={log.request_headers} />
          <JsonBlock label="Request Body" data={log.request_body} />
          <JsonBlock label="Response Body (Full)" data={log.response_body_finish} />
          {log.is_streaming === 1 && (
            <JsonBlock label="Streaming Chunks" data={log.response_body} />
          )}
        </TabsContent>

        {showActions && (
          <TabsContent value="relay" className="mt-4">
            <LogRelayPanel
              log={log}
              disabled={replaying}
              onRelay={handleReplay}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
