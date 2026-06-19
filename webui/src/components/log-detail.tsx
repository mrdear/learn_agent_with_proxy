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
import { CaretRight, Check, Copy, MagnifyingGlass } from "@phosphor-icons/react";
import { JsonViewer } from "@/components/ui/json-viewer";
import { MarkdownViewer } from "@/components/ui/markdown-viewer";
import {
  parseLog,
  stringifyContent,
  tryParseJsonContent,
  type LogProtocol,
  type ParsedMessage,
  type ParsedResponseItem,
  type ParsedTool,
} from "@/lib/log-parsing";

interface LogDetailProps {
  log: LogEntry;
  showActions?: boolean;
  onReplayComplete?: (log: LogEntry) => void;
}

type ParsedJsonBlock = {
  text: string;
  parsed: unknown | null;
};

type LogDetailData = {
  parsed: ReturnType<typeof parseLog>;
  responseRawBlock: ParsedJsonBlock | null;
  rawBlocks: {
    relayTarget: ParsedJsonBlock | null;
    requestHeaders: ParsedJsonBlock | null;
    requestBody: ParsedJsonBlock | null;
    responseBody: ParsedJsonBlock | null;
    streamingChunks: ParsedJsonBlock | null;
  };
};

function createJsonBlock(text: string | null, parsed: unknown | null): ParsedJsonBlock | null {
  if (!text) {
    return null;
  }

  return { text, parsed };
}

function buildLogDetailData(log: LogEntry): LogDetailData {
  const parsed = parseLog(log);
  const relayTarget = { upstream_url: log.upstream_url };
  const responseRawText =
    log.is_streaming === 1
      ? log.response_body
      : (log.response_body_finish ?? parsed.response.effectiveBody);

  return {
    parsed,
    responseRawBlock: createJsonBlock(responseRawText, parsed.response.raw),
    rawBlocks: {
      relayTarget: {
        text: JSON.stringify(relayTarget, null, 2),
        parsed: relayTarget,
      },
      requestHeaders: createJsonBlock(log.request_headers, parsed.raw.requestHeaders),
      requestBody: createJsonBlock(log.request_body, parsed.raw.requestBody),
      responseBody: createJsonBlock(log.response_body_finish, parsed.raw.responseBody),
      streamingChunks:
        log.is_streaming === 1
          ? createJsonBlock(log.response_body, parsed.raw.streamingChunks)
          : null,
    },
  };
}

function getToolName(tool: ParsedTool): string {
  return tool.name;
}

function getToolDescription(tool: ParsedTool): string {
  return tool.description;
}

function getToolSchema(tool: ParsedTool): unknown {
  return tool.schema;
}

function formatToolResultText(contentText: string, parsedJson: unknown | null): string {
  if (parsedJson !== null) {
    return JSON.stringify(parsedJson, null, 2);
  }

  return contentText;
}

// ── Sub-components ──

function JsonBlock({ label, block }: { label: string; block: ParsedJsonBlock | null }) {
  if (!block) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      {block.parsed !== null && typeof block.parsed === "object" ? (
        <JsonViewer data={block.parsed} />
      ) : (
        <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap break-all">
          {block.text}
        </pre>
      )}
    </div>
  );
}

function ToolResultContent({
  contentText,
  parsedJson,
}: {
  contentText: string;
  parsedJson: unknown | null;
}) {
  const [copied, setCopied] = useState(false);
  const text = useMemo(
    () => formatToolResultText(contentText, parsedJson),
    [contentText, parsedJson],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <Button
          type="button"
          variant={copied ? "secondary" : "outline"}
          size="xs"
          className="shadow-sm"
          onClick={handleCopy}
        >
          {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="max-h-[500px] overflow-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-xs leading-5 whitespace-pre-wrap break-words">
        {text}
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
  function_call: { bg: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200", label: "Tool Call" },
};

function MessageItem({ msg, index }: { msg: ParsedMessage; index: number }) {
  const meta = roleMeta[msg.role] || { bg: "", label: msg.role };
  const contentText = useMemo(() => stringifyContent(msg.content), [msg.content]);
  const parsedJson = useMemo(() => tryParseJsonContent(contentText), [contentText]);
  const isJsonContent = parsedJson !== null;

  const hasToolCalls = msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0;

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b border-border">
        <Badge variant="outline" className={meta.bg}>
          {meta.label}
        </Badge>
        <span className="text-[10px] text-muted-foreground font-mono">#{index}</span>
        {(msg.role === "tool" || msg.role === "function_call") && msg.name && (
          <span className="text-[10px] text-muted-foreground font-mono">
            fn: {msg.name}
          </span>
        )}
      </div>
      {contentText && (
        <div className="p-3 overflow-x-auto max-h-[400px] overflow-y-auto">
          {msg.role === "tool" ? (
            <ToolResultContent contentText={contentText} parsedJson={parsedJson} />
          ) : isJsonContent ? (
            <JsonViewer data={parsedJson as object} />
          ) : (
            <MarkdownViewer content={contentText} />
          )}
        </div>
      )}
      {!!hasToolCalls && (
        <div className="border-t border-border p-3">
          <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider font-semibold">Tool Calls</p>
          <JsonViewer data={msg.tool_calls as object} />
        </div>
      )}
    </div>
  );
}

function ToolCard({ tool, highlight }: { tool: ParsedTool; highlight: string }) {
  const name = getToolName(tool);
  const desc = getToolDescription(tool);
  const schema = getToolSchema(tool);

  const nameMatch = highlight && name.toLowerCase().includes(highlight.toLowerCase());
  const descMatch = highlight && desc.toLowerCase().includes(highlight.toLowerCase());

  return (
    <details className="group rounded-md border border-border overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 bg-muted/50 px-3 py-2 outline-none transition-colors hover:bg-muted [&::-webkit-details-marker]:hidden">
        <CaretRight className="shrink-0 transition-transform group-open:rotate-90" />
        <div className="min-w-0 flex-1">
          <span className={`font-mono text-sm font-semibold ${nameMatch ? "bg-yellow-200 dark:bg-yellow-800 px-1 rounded" : ""}`}>
            {name}
          </span>
        </div>
        <Badge variant="outline">Schema</Badge>
      </summary>
      {desc && (
        <div className="px-3 py-2 border-t border-border">
          <p className={`text-xs text-muted-foreground ${descMatch ? "bg-yellow-200/50 dark:bg-yellow-800/50" : ""}`}>
            {desc}
          </p>
        </div>
      )}
      {schema != null && typeof schema === "object" ? (
        <div className="p-3">
          <JsonViewer data={schema} />
        </div>
      ) : (
        <div className="p-3">
          <JsonViewer data={tool.raw as object} />
        </div>
      )}
    </details>
  );
}

function ToolsPanel({ tools }: { tools: ParsedTool[] }) {
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

function ParamsPanel({
  headers,
  request,
}: {
  headers: ParsedJsonBlock | null;
  request: Record<string, unknown> | null;
}) {
  if (!headers && !request) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No parameters
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <JsonBlock label="Headers" block={headers} />
      {request ? (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-muted-foreground">Request</p>
          <JsonViewer data={request} />
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No request parameters
        </p>
      )}
    </div>
  );
}

function ResponseItem({ item, index }: { item: ParsedResponseItem; index: number }) {
  const role = item.role || (item.kind === "tool_call" ? "function_call" : "assistant");
  const meta = roleMeta[role] || { bg: roleMeta.system.bg, label: role };
  const contentText = useMemo(() => stringifyContent(item.content), [item.content]);
  const parsedJson = useMemo(() => tryParseJsonContent(contentText), [contentText]);
  const isJsonContent = parsedJson !== null;

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b border-border">
        <Badge variant="outline" className={meta.bg}>
          {item.kind === "tool_call" ? "Tool Call" : meta.label}
        </Badge>
        <span className="text-[10px] text-muted-foreground font-mono">output #{index}</span>
        {item.name && (
          <span className="text-[10px] text-muted-foreground font-mono">fn: {item.name}</span>
        )}
      </div>
      <div className="p-3 overflow-x-auto max-h-[400px] overflow-y-auto">
        {role === "tool" ? (
          <ToolResultContent contentText={contentText} parsedJson={parsedJson} />
        ) : isJsonContent ? (
          <JsonViewer data={parsedJson as object} />
        ) : (
          <MarkdownViewer content={contentText} />
        )}
      </div>
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const parsed = tryParseJsonContent(value);
  return parsed ?? value;
}

function extractToolPayload(item: ParsedResponseItem): {
  name: string;
  callId: string | null;
  argumentsData: unknown;
  raw: unknown;
} {
  const raw = isRecord(item.raw) ? item.raw : isRecord(item.content) ? item.content : null;
  const openAIChatFunction = isRecord(raw?.function) ? raw.function : null;
  const name =
    item.name ||
    (typeof raw?.name === "string" ? raw.name : null) ||
    (typeof openAIChatFunction?.name === "string" ? openAIChatFunction.name : null) ||
    "unknown";
  const callId =
    (typeof raw?.call_id === "string" ? raw.call_id : null) ||
    (typeof raw?.id === "string" ? raw.id : null);
  const argumentsData =
    raw?.arguments ??
    openAIChatFunction?.arguments ??
    raw?.input ??
    item.content;

  return {
    name,
    callId,
    argumentsData: parseMaybeJson(argumentsData),
    raw: item.raw ?? item.content,
  };
}

function ToolCallResponseItem({ item, index }: { item: ParsedResponseItem; index: number }) {
  const payload = useMemo(() => extractToolPayload(item), [item]);

  return (
    <div className="overflow-hidden rounded-none border border-border">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <Badge variant="secondary">Tool call</Badge>
        <span className="font-mono text-xs font-medium">{payload.name}</span>
        <span className="font-mono text-[10px] text-muted-foreground">#{index}</span>
        {payload.callId && (
          <Badge variant="outline" className="font-mono">
            {payload.callId}
          </Badge>
        )}
      </div>
      <div className="flex flex-col gap-3 p-3">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Arguments</p>
          {isRecord(payload.argumentsData) || Array.isArray(payload.argumentsData) ? (
            <JsonViewer data={payload.argumentsData} />
          ) : (
            <div className="max-h-[320px] overflow-auto rounded-md border border-border bg-muted/30 p-3">
              <MarkdownViewer content={stringifyContent(payload.argumentsData)} />
            </div>
          )}
        </div>
        <details className="group overflow-hidden rounded-none border border-border">
          <summary className="flex cursor-pointer list-none items-center gap-2 bg-muted/30 px-3 py-2 text-xs text-muted-foreground outline-none hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
            <CaretRight className="transition-transform group-open:rotate-90" />
            Raw tool payload
          </summary>
          <div className="border-t border-border p-3">
            {isRecord(payload.raw) || Array.isArray(payload.raw) ? (
              <JsonViewer data={payload.raw} />
            ) : (
              <pre className="max-h-[320px] overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap break-all">
                {stringifyContent(payload.raw)}
              </pre>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}

function ReadableResponseItem({ item, index }: { item: ParsedResponseItem; index: number }) {
  if (item.kind === "tool_call") {
    return <ToolCallResponseItem item={item} index={index} />;
  }

  return <ResponseItem item={item} index={index} />;
}

function ProtocolBadge({ protocol }: { protocol: LogProtocol }) {
  const label: Record<LogProtocol, string> = {
    "openai-chat": "OpenAI Chat",
    "openai-responses": "Responses",
    anthropic: "Anthropic",
    unknown: "Unknown",
  };

  return <Badge variant="outline">{label[protocol]}</Badge>;
}

function RawResponseBlock({ block }: { block: ParsedJsonBlock | null }) {
  if (!block) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Raw JSON</p>
      </div>
      {block.parsed !== null && typeof block.parsed === "object" ? (
        <JsonViewer data={block.parsed} />
      ) : (
        <pre className="max-h-[520px] overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap break-all">
          {block.text}
        </pre>
      )}
    </div>
  );
}

function ResponsePanel({
  items,
  effectiveBody,
  rawBlock,
  protocol,
  hasToolCalls,
}: {
  items: ParsedResponseItem[];
  effectiveBody: string | null;
  rawBlock: ParsedJsonBlock | null;
  protocol: LogProtocol;
  hasToolCalls: boolean;
}) {
  const readableText = effectiveBody;
  const rawIsParsedJson = rawBlock?.parsed !== null && typeof rawBlock?.parsed === "object";
  const shouldShowReadableText = Boolean(readableText && !rawIsParsedJson);
  const messageCount = items.filter((item) => item.kind === "message").length;
  const toolCallCount = items.filter((item) => item.kind === "tool_call").length;

  if (!shouldShowReadableText && items.length === 0 && !rawBlock) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No response body
      </p>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section className="overflow-hidden rounded-none border border-border">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Readable</Badge>
            <ProtocolBadge protocol={protocol} />
            <Badge variant="outline">{messageCount} messages</Badge>
            <Badge variant={hasToolCalls ? "secondary" : "outline"}>
              {toolCallCount} tool calls
            </Badge>
          </div>
        </div>
        <div className="flex flex-col gap-3 p-3">
          {items.length > 0 ? (
            items.map((item, index) => (
              <ReadableResponseItem key={index} item={item} index={index} />
            ))
          ) : shouldShowReadableText && readableText ? (
            <div className="max-h-[520px] overflow-y-auto rounded-md border border-border bg-muted/30 p-4">
              <MarkdownViewer content={readableText} />
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No readable response extracted
            </p>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-none border border-border">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Raw</Badge>
          </div>
        </div>
        <div className="p-3">
          <RawResponseBlock block={rawBlock} />
        </div>
      </section>
    </div>
  );
}

// ── Main component ──

export function LogDetail({
  log,
  showActions = true,
  onReplayComplete,
}: LogDetailProps) {
  const detail = useMemo(() => buildLogDetailData(log), [log]);
  const { parsed, rawBlocks, responseRawBlock } = detail;
  const requestMessages = parsed.request.messages.filter(
    (message) => message.role !== "system" && message.role !== "developer",
  );
  const systemPrompt = parsed.request.systemPrompt;
  const tools = parsed.request.tools;
  const params = parsed.request.params;

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
        <div className="col-span-2 lg:col-span-4">
          <span className="text-xs text-muted-foreground">Upstream URL</span>
          <div className="break-all font-mono text-xs">
            {log.upstream_url || "--"}
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
            Messages {requestMessages.length > 0 && `(${requestMessages.length})`}
          </TabsTrigger>
          <TabsTrigger value="system">System Prompt</TabsTrigger>
          {tools.length > 0 && <TabsTrigger value="tools">Tools ({tools.length})</TabsTrigger>}
          <TabsTrigger value="params">Params</TabsTrigger>
          <TabsTrigger value="response">Response</TabsTrigger>
          <TabsTrigger value="raw">Raw</TabsTrigger>
          {showActions && <TabsTrigger value="relay">Relay</TabsTrigger>}
        </TabsList>

        <TabsContent value="messages" className="mt-4 space-y-2">
          {requestMessages.length > 0 ? (
            requestMessages.map((msg, i) => (
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
            <div className="max-h-[700px] overflow-y-auto rounded-md border border-border bg-muted/30 p-4">
              <MarkdownViewer content={systemPrompt} />
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No system prompt found
            </p>
          )}
        </TabsContent>

        {tools.length > 0 && (
          <TabsContent value="tools" className="mt-4">
            <ToolsPanel tools={tools} />
          </TabsContent>
        )}

        <TabsContent value="params" className="mt-4">
          <ParamsPanel headers={rawBlocks.requestHeaders} request={params} />
        </TabsContent>

        <TabsContent value="response" className="mt-4">
          <ResponsePanel
            items={parsed.response.items}
            effectiveBody={parsed.response.effectiveBody}
            rawBlock={responseRawBlock}
            protocol={parsed.protocol}
            hasToolCalls={parsed.response.hasToolCalls}
          />
        </TabsContent>

        <TabsContent value="raw" className="mt-4 space-y-4">
          <JsonBlock label="Relay Target" block={rawBlocks.relayTarget} />
          <JsonBlock label="Request Headers" block={rawBlocks.requestHeaders} />
          <JsonBlock label="Request Body" block={rawBlocks.requestBody} />
          <JsonBlock label="Response Body (Full)" block={rawBlocks.responseBody} />
          {log.is_streaming === 1 && (
            <JsonBlock label="Streaming Chunks" block={rawBlocks.streamingChunks} />
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
