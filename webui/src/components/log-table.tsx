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

export function LogTable({
  logs,
  loading,
  page,
  totalPages,
  selectedIds,
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
              <TableHead>Endpoint</TableHead>
              <TableHead className="w-[80px]">Stream</TableHead>
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
                  selectedIds.includes(log.id) && "bg-muted/30"
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
                <TableCell className="font-mono text-xs">{log.id}</TableCell>
                <TableCell>
                  <ProviderBadge provider={log.provider} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={log.response_status} />
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {log.model || "--"}
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
