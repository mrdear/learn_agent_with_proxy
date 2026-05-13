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
import type { RoutePath } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { ArrowLeftIcon, ArrowsClockwiseIcon } from "@phosphor-icons/react";

type ComparePair = [LogEntry, LogEntry];

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

function ComparisonRow({
  label,
  left,
  right,
}: {
  label: string;
  left: string;
  right: string;
}) {
  const same = left === right;

  return (
    <div
      className={cn(
        "grid gap-3 rounded-none border p-3 xl:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-center",
        same
          ? "border-secondary/30 bg-secondary/10"
          : "border-destructive/25 bg-destructive/10"
      )}
    >
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="rounded-none border border-border bg-muted/30 px-3 py-2 font-mono text-xs break-words">
        {left}
      </div>
      <div className="rounded-none border border-border bg-muted/30 px-3 py-2 font-mono text-xs break-words">
        {right}
      </div>
      <Badge variant={same ? "secondary" : "destructive"} className="w-fit">
        {same ? "Same" : "Different"}
      </Badge>
    </div>
  );
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

  const metrics = useMemo(() => {
    if (!pair) return [];

    const [left, right] = pair;
    return [
      { label: "Provider", left: left.provider, right: right.provider },
      { label: "Endpoint", left: left.endpoint, right: right.endpoint },
      { label: "Upstream URL", left: left.upstream_url || "--", right: right.upstream_url || "--" },
      { label: "Model", left: left.model || "--", right: right.model || "--" },
      { label: "Status", left: display(left.response_status), right: display(right.response_status) },
      { label: "Streaming", left: display(Boolean(left.is_streaming)), right: display(Boolean(right.is_streaming)) },
      { label: "Input tokens", left: display(left.input_tokens), right: display(right.input_tokens) },
      { label: "Output tokens", left: display(left.output_tokens), right: display(right.output_tokens) },
      { label: "Duration", left: display(left.duration_ms == null ? null : `${left.duration_ms}ms`), right: display(right.duration_ms == null ? null : `${right.duration_ms}ms`) },
      { label: "Request time", left: formatTime(left.request_time), right: formatTime(right.request_time) },
    ];
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

  const sameMetrics = pair
    ? metrics.filter((metric) => metric.left === metric.right).length
    : 0;

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
          <Card className="ring-1 ring-border/70 bg-card">
            <CardHeader className="border-b border-border/70">
              <div className="flex flex-col gap-2">
                <CardTitle>Quick diff</CardTitle>
                <CardDescription>
                  {sameMetrics} of {metrics.length} summary fields match.
                </CardDescription>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="shadow-sm">
                    Same {sameMetrics}
                  </Badge>
                  <Badge variant="destructive" className="shadow-sm">
                    Different {metrics.length - sameMetrics}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-4">
              {metrics.map((metric) => (
                <ComparisonRow
                  key={metric.label}
                  label={metric.label}
                  left={metric.left}
                  right={metric.right}
                />
              ))}
            </CardContent>
          </Card>

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
