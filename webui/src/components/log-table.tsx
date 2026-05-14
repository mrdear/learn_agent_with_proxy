import { Fragment } from "react";
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
import { parseLog } from "@/lib/log-parsing";

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

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const TABLE_COLUMN_COUNT = 12;

interface LogGroup {
  key: string;
  method: string;
  endpoint: string;
  bucketStart: number;
  logs: LogEntry[];
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

function getGroupBucketStart(iso: string): number {
  const time = new Date(iso).getTime();
  return Math.floor(time / GROUP_WINDOW_MS) * GROUP_WINDOW_MS;
}

function formatGroupTimeRange(bucketStart: number): string {
  const start = new Date(bucketStart);
  const end = new Date(bucketStart + GROUP_WINDOW_MS);
  const date = start.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
  const timeFormat = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${date} ${timeFormat.format(start)}-${timeFormat.format(end)}`;
}

function groupLogs(logs: LogEntry[]): LogGroup[] {
  const groups: LogGroup[] = [];
  const groupByKey = new Map<string, LogGroup>();

  for (const log of logs) {
    const bucketStart = getGroupBucketStart(log.request_time);
    const key = `${log.method}:${log.endpoint}:${bucketStart}`;
    const existingGroup = groupByKey.get(key);

    if (existingGroup) {
      existingGroup.logs.push(log);
      continue;
    }

    const group: LogGroup = {
      key,
      method: log.method,
      endpoint: log.endpoint,
      bucketStart,
      logs: [log],
    };
    groups.push(group);
    groupByKey.set(key, group);
  }

  return groups;
}

function LogRow({
  log,
  selected,
  viewed,
  onToggleSelect,
  onSelect,
}: {
  log: LogEntry;
  selected: boolean;
  viewed: boolean;
  onToggleSelect: (log: LogEntry, checked: boolean) => void;
  onSelect: (log: LogEntry) => void;
}) {
  const parsed = parseLog(log);

  return (
    <TableRow
      key={log.id}
      className={cn(
        "h-14 cursor-pointer hover:bg-muted/50",
        selected && "bg-primary/5",
        viewed && "ring-2 ring-inset ring-primary/40 bg-primary/10"
      )}
      onClick={() => onSelect(log)}
    >
      <TableCell onClick={(event) => event.stopPropagation()}>
        <Checkbox
          checked={selected}
          aria-label={`Select log ${log.id}`}
          onCheckedChange={(checked) => onToggleSelect(log, checked === true)}
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
      <TableCell
        className="max-w-[220px] truncate font-mono text-xs"
        title={log.model || undefined}
      >
        {log.model || "--"}
      </TableCell>
      <TableCell className="whitespace-normal text-xs">
        {(() => {
          const msg = parsed.summary.firstUserMessage;
          if (!msg) return <span className="text-muted-foreground">--</span>;
          const truncated = msg.length > 140 ? msg.slice(0, 140) + "..." : msg;
          return (
            <span
              className="line-clamp-2 break-words"
              title={msg.slice(0, 240)}
            >
              {truncated}
            </span>
          );
        })()}
      </TableCell>
      <TableCell
        className="max-w-[260px] truncate font-mono text-xs"
        title={log.endpoint}
      >
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
        {parsed.summary.hasToolCalls ? (
          <Badge variant="default">Call</Badge>
        ) : parsed.summary.hasToolsDefined ? (
          <Badge variant="outline">Def</Badge>
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
  );
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
  const groupedLogs = groupLogs(logs);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center text-muted-foreground">
        <p className="text-lg">No logs captured yet</p>
        <p className="mt-1 text-sm">
          Point your AI SDK to this proxy server to start capturing requests
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
        <Table className="min-w-[1680px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[44px]">
                <span className="sr-only">Select</span>
              </TableHead>
              <TableHead className="w-[60px]">ID</TableHead>
              <TableHead className="w-[100px]">Provider</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead className="w-[220px]">Model</TableHead>
              <TableHead className="w-[420px]">User Message</TableHead>
              <TableHead className="w-[260px]">Endpoint</TableHead>
              <TableHead className="w-[80px]">Stream</TableHead>
              <TableHead className="w-[90px]">Tools</TableHead>
              <TableHead className="w-[120px]">Tokens (I/O)</TableHead>
              <TableHead className="w-[80px]">Duration</TableHead>
              <TableHead className="w-[140px]">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedLogs.map((group) => (
              <Fragment key={group.key}>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableCell colSpan={TABLE_COLUMN_COUNT} className="py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="font-mono">
                        {group.method} {group.endpoint}
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatGroupTimeRange(group.bucketStart)}
                      </span>
                      <Badge variant="outline">
                        {group.logs.length} requests
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
                {group.logs.map((log) => {
                  return (
                    <LogRow
                      key={log.id}
                      log={log}
                      selected={selectedIds.includes(log.id)}
                      viewed={viewedId === log.id}
                      onToggleSelect={onToggleSelect}
                      onSelect={onSelect}
                    />
                  );
                })}
              </Fragment>
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
              <CaretLeft data-icon="inline-start" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <CaretRight data-icon="inline-start" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
