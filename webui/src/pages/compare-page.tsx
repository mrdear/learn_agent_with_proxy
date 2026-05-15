import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchLogById, fetchLogs, type LogEntry } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LogDetail } from "@/components/log-detail";
import { Separator } from "@/components/ui/separator";
import { clearCompareSelection, loadCompareSelection } from "@/lib/compare-selection";
import { parseLog, stringifyContent, type ParsedLog } from "@/lib/log-parsing";
import type { RoutePath } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { ArrowLeftIcon, ArrowsClockwiseIcon } from "@phosphor-icons/react";

type ComparePair = [LogEntry, LogEntry];
type DiffStatus = "same" | "different" | "left-only" | "right-only";

interface DiffRowData {
  label: string;
  left: string;
  right: string;
  status: DiffStatus;
}

interface DiffSectionData {
  title: string;
  description: string;
  rows: DiffRowData[];
}

function formatTime(value: string | null): string {
  if (!value) return "--";
  return new Date(value).toLocaleString("zh-CN");
}

function display(value: string | number | boolean | null | undefined): string {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (value === null || value === undefined || value === "") {
    return "--";
  }

  return String(value);
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "--";
  }

  if (typeof value === "string") {
    return value || "--";
  }

  if (typeof value !== "object") {
    return String(value);
  }

  return JSON.stringify(sortJsonValue(value), null, 2);
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, nestedValue]) => [key, sortJsonValue(nestedValue)])
  );
}

function toContentText(value: unknown): string {
  const text = stringifyContent(value);
  return text || stableStringify(value);
}

function getDiffStatus(left: string, right: string): DiffStatus {
  if (left === right) return "same";
  if (left === "--") return "right-only";
  if (right === "--") return "left-only";
  return "different";
}

function createDiffRow(label: string, left: string, right: string): DiffRowData {
  return {
    label,
    left,
    right,
    status: getDiffStatus(left, right),
  };
}

function hasOwnValue(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function statusLabel(status: DiffStatus): string {
  if (status === "same") return "Same";
  if (status === "left-only") return "Left only";
  if (status === "right-only") return "Right only";
  return "Different";
}

function DiffValue({ value }: { value: string }) {
  return (
    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words border border-border bg-muted/30 px-3 py-2 font-mono text-xs leading-relaxed">
      {value}
    </pre>
  );
}

function StructuredDiffRow({ row }: { row: DiffRowData }) {
  const same = row.status === "same";

  return (
    <div
      className={cn(
        "grid gap-3 border p-3 xl:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_6.5rem]",
        same
          ? "border-border/70 bg-background"
          : "border-destructive/20 bg-destructive/5"
      )}
    >
      <div className="flex flex-col gap-2">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {row.label}
        </span>
        <Badge variant={same ? "secondary" : "destructive"} className="w-fit">
          {statusLabel(row.status)}
        </Badge>
      </div>
      <DiffValue value={row.left} />
      <DiffValue value={row.right} />
      <div className="hidden items-center justify-end xl:flex">
        <Badge variant={same ? "outline" : "destructive"}>
          {same ? "=" : "!="}
        </Badge>
      </div>
    </div>
  );
}

function DiffSection({ section }: { section: DiffSectionData }) {
  const changed = section.rows.filter((row) => row.status !== "same").length;

  return (
    <Card>
      <CardHeader className="border-b border-border/70">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>{section.title}</CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{section.rows.length - changed} same</Badge>
            <Badge variant={changed > 0 ? "destructive" : "outline"}>
              {changed} changed
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-4">
        {section.rows.length > 0 ? (
          section.rows.map((row) => (
            <StructuredDiffRow key={row.label} row={row} />
          ))
        ) : (
          <div className="border border-dashed border-border/80 p-6 text-sm text-muted-foreground">
            No comparable data in this section.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function buildStructuredDiff(leftLog: LogEntry, rightLog: LogEntry): DiffSectionData[] {
  const left = parseLog(leftLog);
  const right = parseLog(rightLog);

  return [
    buildOverviewSection(leftLog, rightLog, left, right),
    buildSystemSection(left, right),
    buildMessagesSection(left, right),
    buildToolsSection(left, right),
    buildParamsSection(left, right),
    buildResponseSection(left, right),
  ];
}

function buildOverviewSection(
  leftLog: LogEntry,
  rightLog: LogEntry,
  left: ParsedLog,
  right: ParsedLog
): DiffSectionData {
  return {
    title: "Request overview",
    description: "Provider、模型、Token、耗时等请求级字段。",
    rows: [
      createDiffRow("Provider", leftLog.provider, rightLog.provider),
      createDiffRow("Protocol", left.protocol, right.protocol),
      createDiffRow("Endpoint", leftLog.endpoint, rightLog.endpoint),
      createDiffRow("Upstream URL", leftLog.upstream_url || "--", rightLog.upstream_url || "--"),
      createDiffRow("Model", leftLog.model || "--", rightLog.model || "--"),
      createDiffRow("Status", display(leftLog.response_status), display(rightLog.response_status)),
      createDiffRow("Streaming", display(Boolean(leftLog.is_streaming)), display(Boolean(rightLog.is_streaming))),
      createDiffRow("Input tokens", display(leftLog.input_tokens), display(rightLog.input_tokens)),
      createDiffRow("Output tokens", display(leftLog.output_tokens), display(rightLog.output_tokens)),
      createDiffRow("Duration", display(leftLog.duration_ms == null ? null : `${leftLog.duration_ms}ms`), display(rightLog.duration_ms == null ? null : `${rightLog.duration_ms}ms`)),
      createDiffRow("Request time", formatTime(leftLog.request_time), formatTime(rightLog.request_time)),
    ],
  };
}

function buildSystemSection(left: ParsedLog, right: ParsedLog): DiffSectionData {
  return {
    title: "System prompt",
    description: "归一化后的 system 指令内容。",
    rows: [
      createDiffRow(
        "system",
        left.request.systemPrompt || "--",
        right.request.systemPrompt || "--"
      ),
    ],
  };
}

function buildMessagesSection(left: ParsedLog, right: ParsedLog): DiffSectionData {
  const maxLength = Math.max(left.request.messages.length, right.request.messages.length);
  const rows: DiffRowData[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    const leftMessage = left.request.messages[index];
    const rightMessage = right.request.messages[index];
    const leftLabel = leftMessage ? `${index + 1}. ${leftMessage.role}` : `${index + 1}. missing`;
    const rightLabel = rightMessage ? `${index + 1}. ${rightMessage.role}` : `${index + 1}. missing`;
    const label = leftLabel === rightLabel ? leftLabel : `${leftLabel} / ${rightLabel}`;

    rows.push(
      createDiffRow(
        label,
        leftMessage ? formatMessage(leftMessage) : "--",
        rightMessage ? formatMessage(rightMessage) : "--"
      )
    );
  }

  return {
    title: "Messages",
    description: "按消息顺序对比 role、content、tool call 引用。",
    rows,
  };
}

function formatMessage(message: ParsedLog["request"]["messages"][number]): string {
  const parts = [`role: ${message.role}`];

  if (message.name) {
    parts.push(`name: ${message.name}`);
  }

  if (message.tool_call_id) {
    parts.push(`tool_call_id: ${message.tool_call_id}`);
  }

  parts.push(`content:\n${toContentText(message.content)}`);

  if (message.tool_calls !== undefined) {
    parts.push(`tool_calls:\n${stableStringify(message.tool_calls)}`);
  }

  return parts.join("\n");
}

function buildToolsSection(left: ParsedLog, right: ParsedLog): DiffSectionData {
  const names = Array.from(
    new Set([
      ...left.request.tools.map((tool) => tool.name),
      ...right.request.tools.map((tool) => tool.name),
    ])
  ).sort((leftName, rightName) => leftName.localeCompare(rightName));

  return {
    title: "Tools",
    description: "按工具名称对比 description、schema 和原始定义。",
    rows: names.map((name) => {
      const leftTool = left.request.tools.find((tool) => tool.name === name);
      const rightTool = right.request.tools.find((tool) => tool.name === name);

      return createDiffRow(
        name,
        leftTool ? formatTool(leftTool) : "--",
        rightTool ? formatTool(rightTool) : "--"
      );
    }),
  };
}

function formatTool(tool: ParsedLog["request"]["tools"][number]): string {
  return [
    `name: ${tool.name}`,
    `description: ${tool.description || "--"}`,
    `schema:\n${stableStringify(tool.schema)}`,
  ].join("\n");
}

function buildParamsSection(left: ParsedLog, right: ParsedLog): DiffSectionData {
  const leftParams = left.request.params ?? {};
  const rightParams = right.request.params ?? {};
  const keys = Array.from(
    new Set([...Object.keys(leftParams), ...Object.keys(rightParams)])
  ).sort((leftKey, rightKey) => leftKey.localeCompare(rightKey));

  return {
    title: "Params",
    description: "归一化请求参数，排除 messages、tools 等大块结构。",
    rows: keys.map((key) =>
      createDiffRow(
        key,
        hasOwnValue(leftParams, key) ? stableStringify(leftParams[key]) : "--",
        hasOwnValue(rightParams, key) ? stableStringify(rightParams[key]) : "--"
      )
    ),
  };
}

function buildResponseSection(left: ParsedLog, right: ParsedLog): DiffSectionData {
  const maxLength = Math.max(left.response.items.length, right.response.items.length);
  const rows: DiffRowData[] = [
    createDiffRow(
      "effective body",
      left.response.effectiveBody || "--",
      right.response.effectiveBody || "--"
    ),
    createDiffRow(
      "has tool calls",
      display(left.response.hasToolCalls),
      display(right.response.hasToolCalls)
    ),
  ];

  for (let index = 0; index < maxLength; index += 1) {
    const leftItem = left.response.items[index];
    const rightItem = right.response.items[index];
    const leftLabel = leftItem ? `${index + 1}. ${leftItem.kind}` : `${index + 1}. missing`;
    const rightLabel = rightItem ? `${index + 1}. ${rightItem.kind}` : `${index + 1}. missing`;
    const label = leftLabel === rightLabel ? leftLabel : `${leftLabel} / ${rightLabel}`;

    rows.push(
      createDiffRow(
        label,
        leftItem ? formatResponseItem(leftItem) : "--",
        rightItem ? formatResponseItem(rightItem) : "--"
      )
    );
  }

  return {
    title: "Response",
    description: "对比最终响应文本、工具调用和归一化响应项。",
    rows,
  };
}

function formatResponseItem(item: ParsedLog["response"]["items"][number]): string {
  return [
    `kind: ${item.kind}`,
    `role: ${item.role || "--"}`,
    item.name ? `name: ${item.name}` : null,
    `content:\n${toContentText(item.content)}`,
    item.raw !== undefined ? `raw:\n${stableStringify(item.raw)}` : null,
  ].filter(Boolean).join("\n");
}

function LogPanel({
  title,
  log,
  tone,
}: {
  title: string;
  log: LogEntry;
  tone: "left" | "right";
}) {
  const panelClassName =
    tone === "left"
      ? "overflow-hidden ring-1 ring-primary/15 bg-primary/5"
      : "overflow-hidden ring-1 ring-secondary/20 bg-secondary/10";

  return (
    <Card className={panelClassName}>
      <CardHeader className="border-b border-border/70">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <Badge variant={tone === "left" ? "default" : "secondary"} className="w-fit shadow-sm">
              {tone === "left" ? "Left" : "Right"}
            </Badge>
            <CardTitle>{title}</CardTitle>
            <CardDescription className="font-mono">
              #{log.id} · {log.provider} · {log.model || "--"}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{display(log.response_status)}</Badge>
            <Badge variant={log.is_streaming ? "secondary" : "outline"}>
              {log.is_streaming ? "Streaming" : "Non-streaming"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[calc(100vh-20rem)] overflow-auto">
          <LogDetail log={log} showActions={false} />
        </div>
      </CardContent>
    </Card>
  );
}

export function ComparePage({
  onNavigate,
}: {
  onNavigate: (path: RoutePath) => void;
}) {
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [pair, setPair] = useState<ComparePair | null>(null);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadPair = useCallback(async (left: number, right: number) => {
    if (left === right) {
      if (mountedRef.current) {
        setError("Choose two different log IDs.");
        setPair(null);
      }
      return;
    }

    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const [leftLog, rightLog] = await Promise.all([
        fetchLogById(left),
        fetchLogById(right),
      ]);
      if (mountedRef.current) {
        setPair([leftLog, rightLog]);
      }
    } catch (loadError) {
      console.error("Failed to load comparison logs:", loadError);
      if (mountedRef.current) {
        setPair(null);
        setError("Failed to load one or both logs.");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const stored = loadCompareSelection();
      if (stored) {
        clearCompareSelection();
        if (!active || !mountedRef.current) return;
        setLeftId(String(stored[0]));
        setRightId(String(stored[1]));
        await loadPair(stored[0], stored[1]);
        if (active && mountedRef.current) setBootstrapping(false);
        return;
      }

      try {
        const latest = await fetchLogs({ page: 1, pageSize: 2 });
        if (!active || !mountedRef.current) return;

        if (latest.data.length >= 2) {
          const [first, second] = latest.data;
          setLeftId(String(first.id));
          setRightId(String(second.id));
          await loadPair(first.id, second.id);
        } else if (latest.data.length === 1) {
          const [single] = latest.data;
          setLeftId(String(single.id));
          setError("Capture at least two logs to compare.");
          setPair(null);
        } else {
          setError("No logs captured yet.");
          setPair(null);
        }
      } catch (bootstrapError) {
        console.error("Failed to bootstrap compare page:", bootstrapError);
        if (active && mountedRef.current) {
          setError("Failed to load recent logs.");
        }
      } finally {
        if (active && mountedRef.current) {
          setBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadPair]);

  const structuredSections = useMemo(() => {
    if (!pair) return [];
    return buildStructuredDiff(pair[0], pair[1]);
  }, [pair]);

  const handleSubmit = useCallback(async () => {
    const left = Number.parseInt(leftId, 10);
    const right = Number.parseInt(rightId, 10);

    if (Number.isNaN(left) || Number.isNaN(right)) {
      setError("Enter two valid log IDs.");
      setPair(null);
      return;
    }

    await loadPair(left, right);
  }, [leftId, loadPair, rightId]);

  const diffCounts = useMemo(() => {
    const rows = structuredSections.flatMap((section) => section.rows);
    const same = rows.filter((row) => row.status === "same").length;
    return {
      same,
      changed: rows.length - same,
      total: rows.length,
    };
  }, [structuredSections]);

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden ring-1 ring-primary/10 bg-primary/5">
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-1">
              <Badge variant="default" className="w-fit shadow-sm">
                Compare
              </Badge>
              <CardTitle className="text-2xl">Prompt diff view</CardTitle>
              <CardDescription>
                Compare two captured requests side by side and inspect how the prompt,
                params, and response changed.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onNavigate("/logs")}>
                <ArrowLeftIcon data-icon="inline-start" />
                Back to logs
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shadow-sm"
                onClick={() => {
                  if (pair) {
                    setLeftId(String(pair[1].id));
                    setRightId(String(pair[0].id));
                    void loadPair(pair[1].id, pair[0].id);
                  }
                }}
                disabled={!pair}
              >
                <ArrowsClockwiseIcon data-icon="inline-start" />
                Swap
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          <form
            className="grid gap-3 rounded-none border border-primary/15 bg-background/80 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <Input
              inputMode="numeric"
              placeholder="Left log ID"
              value={leftId}
              onChange={(event) => setLeftId(event.target.value)}
              className="font-mono"
            />
            <Input
              inputMode="numeric"
              placeholder="Right log ID"
              value={rightId}
              onChange={(event) => setRightId(event.target.value)}
              className="font-mono"
            />
            <Button type="submit" variant="default" disabled={loading || bootstrapping} className="shadow-sm">
              {loading ? "Loading..." : "Load comparison"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground">
            Select two logs from the logs page or enter IDs manually. The page also
            loads the latest two logs by default.
          </p>

          {error && (
            <div className="rounded-none border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {pair ? (
        <>
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-medium tracking-tight">Structured diff</h2>
              <p className="text-xs text-muted-foreground">
                按请求结构分区对比，先看变化项，再展开完整日志核对。
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="shadow-sm">
                  Same {diffCounts.same}
                </Badge>
                <Badge variant="destructive" className="shadow-sm">
                  Changed {diffCounts.changed}
                </Badge>
                <Badge variant="outline" className="shadow-sm">
                  Total {diffCounts.total}
                </Badge>
              </div>
            </div>
            <div className="grid gap-4">
              {structuredSections.map((section) => (
                <DiffSection key={section.title} section={section} />
              ))}
            </div>
          </section>

          <Separator />

          <div className="grid gap-4 xl:grid-cols-2">
            <LogPanel title="Left log" log={pair[0]} tone="left" />
            <LogPanel title="Right log" log={pair[1]} tone="right" />
          </div>
        </>
      ) : !loading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No comparison loaded yet.
            </p>
            <p className="text-xs text-muted-foreground">
              Use the form above or compare two selected logs from the logs page.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
