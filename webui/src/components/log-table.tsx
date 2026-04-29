import type { LogEntry } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

interface LogTableProps {
  logs: LogEntry[];
  loading: boolean;
  page: number;
  totalPages: number;
  selectedIds: number[];
  viewedId?: number | null;
  onPageChange: (page: number) => void;
  onToggleSelect: (log: LogEntry, checked: boolean) => void;
  onSelect: (log: LogEntry) => void;
}

function ProviderBadge({ provider }: { provider: string }) {
  return (
    <Badge variant={provider === "openai" ? "default" : "secondary"}>
      {provider}
    </Badge>
  );
}

function StatusBadge({ status }: { status: number | null }) {
  if (status === null) return <Badge variant="outline">--</Badge>;
  const variant = status >= 200 && status < 300 ? "default" : "destructive";
  return <Badge variant={variant}>{status}</Badge>;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "--";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(input: number | null, output: number | null): string {
  if (input === null && output === null) return "--";
  return `${input ?? "?"}/${output ?? "?"}`;
}

function hasToolCalls(log: LogEntry): boolean {
  const text = log.response_body_finish;
  if (!text) return false;
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    // OpenAI format: choices[].message.tool_calls
    const choices = data.choices as Array<Record<string, unknown>> | undefined;
    if (choices?.some((c) => {
      const msg = c.message as Record<string, unknown> | undefined;
      return msg?.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0;
    })) return true;
    // Anthropic format: content[] with type "tool_use"
    const content = data.content as Array<Record<string, unknown>> | undefined;
    if (content?.some((b) => b.type === "tool_use")) return true;
  } catch {
    // not JSON
  }
  return false;
}

function extractFirstUserMessage(log: LogEntry): string | null {
  if (!log.request_body) return null;
  try {
    const body = JSON.parse(log.request_body) as Record<string, unknown>;
    const messages = body.messages as Array<{ role: string; content: unknown }> | undefined;
    if (!messages) return null;
    const userMsg = messages.find((m) => m.role === "user");
    if (!userMsg) return null;
    if (typeof userMsg.content === "string") return userMsg.content;
    if (Array.isArray(userMsg.content)) {
      const textPart = (userMsg.content as Array<Record<string, unknown>>).find(
        (p) => p.type === "text" && typeof p.text === "string"
      );
      return (textPart?.text as string) ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

function hasToolsDefined(log: LogEntry): boolean {
  if (!log.request_body) return false;
  try {
    const body = JSON.parse(log.request_body) as Record<string, unknown>;
    return Array.isArray(body.tools) && body.tools.length > 0;
  } catch {
    return false;
  }
}

export function LogTable({
  logs,
  loading,
  page,
  totalPages,
  selectedIds,
  viewedId,
  onPageChange,
  onToggleSelect,
  onSelect,
}: LogTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-lg">No logs captured yet</p>
        <p className="text-sm mt-1">
          Point your AI SDK to this proxy server to start capturing requests
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[44px]">
                <span className="sr-only">Select</span>
              </TableHead>
              <TableHead className="w-[60px]">ID</TableHead>
              <TableHead className="w-[100px]">Provider</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead>Model</TableHead>
              <TableHead className="min-w-[200px]">User Message</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead className="w-[80px]">Stream</TableHead>
              <TableHead className="w-[90px]">Tools</TableHead>
              <TableHead className="w-[120px]">Tokens (I/O)</TableHead>
              <TableHead className="w-[80px]">Duration</TableHead>
              <TableHead className="w-[140px]">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow
                key={log.id}
                className={cn(
                  "cursor-pointer hover:bg-muted/50",
                  selectedIds.includes(log.id) && "bg-primary/5",
                  viewedId === log.id && "ring-2 ring-inset ring-primary/40 bg-primary/10"
                )}
                onClick={() => onSelect(log)}
              >
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.includes(log.id)}
                    aria-label={`Select log ${log.id}`}
                    onCheckedChange={(checked) =>
                      onToggleSelect(log, checked === true)
                    }
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">
                  <div className="flex flex-col gap-1">
                    <span>{log.id}</span>
                    {log.source_log_id ? (
                      <Badge variant="outline" className="w-fit text-[10px]">
                        from #{log.source_log_id}
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <ProviderBadge provider={log.provider} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={log.response_status} />
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {log.model || "--"}
                </TableCell>
                <TableCell className="text-xs max-w-[300px]">
                  {(() => {
                    const msg = extractFirstUserMessage(log);
                    if (!msg) return <span className="text-muted-foreground">--</span>;
                    const truncated = msg.length > 80 ? msg.slice(0, 80) + "..." : msg;
                    return <span className="line-clamp-2 break-all" title={msg.slice(0, 200)}>{truncated}</span>;
                  })()}
                </TableCell>
                <TableCell className="font-mono text-xs max-w-[200px] truncate">
                  {log.endpoint}
                </TableCell>
                <TableCell>
                  {log.is_streaming ? (
                    <Badge variant="outline">SSE</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">--</span>
                  )}
                </TableCell>
                <TableCell>
                  {hasToolCalls(log) ? (
                    <Badge variant="default" className="bg-purple-600 hover:bg-purple-700">Call</Badge>
                  ) : hasToolsDefined(log) ? (
                    <Badge variant="outline" className="text-purple-600 border-purple-300 dark:text-purple-400 dark:border-purple-700">Def</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">--</span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {formatTokens(log.input_tokens, log.output_tokens)}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {formatDuration(log.duration_ms)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatTime(log.request_time)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <CaretLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <CaretRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
