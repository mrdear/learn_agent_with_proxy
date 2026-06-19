import { Fragment } from "react";
import type { LogListEntry } from "@/lib/api";
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
import { useI18n, type Locale } from "@/lib/i18n";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

interface LogTableProps {
  logs: LogListEntry[];
  loading: boolean;
  page: number;
  totalPages: number;
  selectedIds: number[];
  groupGapMs: number;
  viewedId?: number | null;
  onPageChange: (page: number) => void;
  onToggleSelect: (log: LogListEntry, checked: boolean) => void;
  onSelect: (log: LogListEntry) => void;
}

const TABLE_COLUMN_COUNT = 14;

interface LogGroup {
  key: string;
  provider: string;
  startTime: number;
  endTime: number;
  logs: LogListEntry[];
}

const groupAccentClasses = [
  {
    row: "bg-chart-1/10 hover:bg-chart-1/10",
    dot: "bg-chart-1 ring-chart-1/20",
  },
  {
    row: "bg-chart-2/10 hover:bg-chart-2/10",
    dot: "bg-chart-2 ring-chart-2/20",
  },
  {
    row: "bg-chart-3/10 hover:bg-chart-3/10",
    dot: "bg-chart-3 ring-chart-3/20",
  },
  {
    row: "bg-chart-4/10 hover:bg-chart-4/10",
    dot: "bg-chart-4 ring-chart-4/20",
  },
  {
    row: "bg-chart-5/10 hover:bg-chart-5/10",
    dot: "bg-chart-5 ring-chart-5/20",
  },
] as const;

function getProviderAccent(provider: string) {
  let hash = 0;
  for (const character of provider) {
    hash += character.charCodeAt(0);
  }

  return groupAccentClasses[hash % groupAccentClasses.length];
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

function formatTime(iso: string, locale: Locale): string {
  const d = new Date(iso);
  return d.toLocaleString(locale, {
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

function CountBadge({ value, label }: { value: number | null; label: string }) {
  if (value === null) {
    return (
      <Badge variant="outline" className="font-mono">
        -- {label}
      </Badge>
    );
  }

  return (
    <Badge variant={value > 0 ? "secondary" : "outline"} className="font-mono">
      {value} {label}
    </Badge>
  );
}

function truncatePreview(message: string): string {
  return message.length > 140 ? `${message.slice(0, 140)}...` : message;
}

function PreviewLine({
  label,
  preview,
}: {
  label: string;
  preview: string | null;
}) {
  return (
    <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-start gap-2">
      <span className="text-muted-foreground">{label}</span>
      {preview ? (
        <span className="line-clamp-1 break-words" title={preview.slice(0, 240)}>
          {truncatePreview(preview)}
        </span>
      ) : (
        <span className="text-muted-foreground">--</span>
      )}
    </div>
  );
}

function SignalBadges({ log }: { log: LogListEntry }) {
  const { t } = useI18n();
  const signals: Array<{ label: string; variant: "outline" | "secondary" | "destructive" }> = [];

  if (log.error || (log.response_status !== null && log.response_status >= 400)) {
    signals.push({ label: t("error", "错误"), variant: "destructive" });
  }
  if (!log.has_upstream_url) {
    signals.push({ label: t("no upstream", "无上游"), variant: "outline" });
  }
  if (log.source_log_id) {
    signals.push({ label: t("replay", "重放"), variant: "secondary" });
  }
  if (log.duration_ms !== null && log.duration_ms >= 10000) {
    signals.push({ label: t("slow", "慢"), variant: "outline" });
  }

  if (signals.length === 0) {
    return <span className="text-xs text-muted-foreground">--</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {signals.map((signal) => (
        <Badge key={signal.label} variant={signal.variant} className="text-[10px]">
          {signal.label}
        </Badge>
      ))}
    </div>
  );
}

function formatGroupTimeRange(startTime: number, endTime: number, locale: Locale): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const date = start.toLocaleDateString(locale, {
    month: "2-digit",
    day: "2-digit",
  });
  const timeFormat = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${date} ${timeFormat.format(start)}-${timeFormat.format(end)}`;
}

function groupLogs(logs: LogListEntry[], groupGapMs: number): LogGroup[] {
  const groups: LogGroup[] = [];

  for (const log of logs) {
    const requestTime = new Date(log.request_time).getTime();
    const latestGroup = groups.at(-1);
    const canJoinLatestGroup =
      latestGroup &&
      latestGroup.provider === log.provider &&
      Math.abs(latestGroup.endTime - requestTime) <= groupGapMs;

    if (canJoinLatestGroup) {
      latestGroup.logs.push(log);
      latestGroup.startTime = Math.min(latestGroup.startTime, requestTime);
      latestGroup.endTime = Math.max(latestGroup.endTime, requestTime);
      continue;
    }

    const group: LogGroup = {
      key: `${log.provider}:${log.id}`,
      provider: log.provider,
      startTime: requestTime,
      endTime: requestTime,
      logs: [log],
    };
    groups.push(group);
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
  log: LogListEntry;
  selected: boolean;
  viewed: boolean;
  onToggleSelect: (log: LogListEntry, checked: boolean) => void;
  onSelect: (log: LogListEntry) => void;
}) {
  const { locale, t } = useI18n();

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
          aria-label={t("Select log {id}", "选择日志 {id}", { id: log.id })}
          onCheckedChange={(checked) => onToggleSelect(log, checked === true)}
        />
      </TableCell>
      <TableCell className="font-mono text-xs">
        <div className="flex flex-col gap-1">
          <span>{log.id}</span>
          {log.source_log_id ? (
            <Badge variant="outline" className="w-fit text-[10px]">
              {t("from #{id}", "来自 #{id}", { id: log.source_log_id })}
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
        className="max-w-[180px] truncate font-mono text-xs"
        title={log.model || undefined}
      >
        {log.model || "--"}
      </TableCell>
      <TableCell className="whitespace-normal text-xs">
        <div className="flex flex-col gap-1">
          <PreviewLine label={t("Request", "请求")} preview={log.request_preview} />
          <PreviewLine label={t("Response", "响应")} preview={log.response_preview} />
        </div>
      </TableCell>
      <TableCell
        className="max-w-[210px] truncate font-mono text-xs"
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
        <CountBadge value={log.message_count} label={t("msg", "消息")} />
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          <CountBadge value={log.tools_defined_count} label={t("def", "定义")} />
          <CountBadge value={log.tool_call_count} label={t("call", "调用")} />
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs">
        {formatTokens(log.input_tokens, log.output_tokens)}
      </TableCell>
      <TableCell className="font-mono text-xs">
        {formatDuration(log.duration_ms)}
      </TableCell>
      <TableCell>
        <SignalBadges log={log} />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {formatTime(log.request_time, locale)}
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
  groupGapMs,
  viewedId,
  onPageChange,
  onToggleSelect,
  onSelect,
}: LogTableProps) {
  const { locale, t } = useI18n();
  const groupedLogs = groupLogs(logs, groupGapMs);

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
        <p className="text-lg">{t("No logs captured yet", "还没有捕获日志")}</p>
        <p className="mt-1 text-sm">
          {t(
            "Point your AI SDK to this proxy server to start capturing requests",
            "把 AI SDK 指向这个代理服务后就会开始捕获请求"
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-4">
      <div className="min-h-0 min-w-0 flex-1 overflow-auto rounded-md border">
        <Table className="min-w-[1660px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[44px]">
                <span className="sr-only">{t("Select", "选择")}</span>
              </TableHead>
              <TableHead className="w-[56px]">ID</TableHead>
              <TableHead className="w-[90px]">Provider</TableHead>
              <TableHead className="w-[72px]">{t("Status", "状态")}</TableHead>
              <TableHead className="w-[180px]">{t("Model", "模型")}</TableHead>
              <TableHead className="w-[330px]">{t("User Messages", "用户消息")}</TableHead>
              <TableHead className="w-[210px]">Endpoint</TableHead>
              <TableHead className="w-[70px]">{t("Stream", "流式")}</TableHead>
              <TableHead className="w-[80px]">{t("Messages", "消息")}</TableHead>
              <TableHead className="w-[115px]">{t("Tools", "工具")}</TableHead>
              <TableHead className="w-[105px]">Tokens</TableHead>
              <TableHead className="w-[75px]">{t("Duration", "耗时")}</TableHead>
              <TableHead className="w-[120px]">{t("Signals", "信号")}</TableHead>
              <TableHead className="w-[115px]">{t("Time", "时间")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedLogs.map((group) => {
              const accent = getProviderAccent(group.provider);

              return (
                <Fragment key={group.key}>
                  <TableRow className={accent.row}>
                    <TableCell colSpan={TABLE_COLUMN_COUNT} className="py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "size-2.5 rounded-full ring-4",
                            accent.dot
                          )}
                        />
                        <ProviderBadge provider={group.provider} />
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatGroupTimeRange(group.startTime, group.endTime, locale)}
                        </span>
                        <Badge variant="outline">
                          {t("{count} requests", "{count} 条请求", {
                            count: group.logs.length,
                          })}
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
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("Page {page} of {total}", "第 {page} / {total} 页", {
              page,
              total: totalPages,
            })}
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
