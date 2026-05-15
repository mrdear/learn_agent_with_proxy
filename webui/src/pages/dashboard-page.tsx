import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type LogEntry, fetchLogs } from "@/lib/api";
import { parseLog } from "@/lib/log-parsing";
import type { RoutePath } from "@/lib/routes";
import {
  ArrowRightIcon,
  CheckIcon,
  CopySimpleIcon,
} from "@phosphor-icons/react";

const PROXY_URL = "http://localhost:3000";
const API_BASE_URL = `${PROXY_URL}/v1`;

const OPENAI_SNIPPET = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:3000/v1",
  apiKey: "sk-local-proxy",
});`;

const OPENAI_RESPONSES_SNIPPET = `curl http://localhost:3000/v1/responses \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-local-proxy" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{ "role": "user", "content": "Hello" }]
  }'`;

const ANTHROPIC_SNIPPET = `import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  baseURL: "http://localhost:3000/v1",
  apiKey: "sk-local-proxy",
});`;

const CURL_SNIPPET = `curl http://localhost:3000/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-local-proxy" \\
  -d '{
    "model": "gpt-4.1-mini",
    "messages": [
      { "role": "user", "content": "Hello from the proxy" }
    ]
  }'`;

const BACKEND_ENV_SNIPPET = `PORT=3000
DATABASE_URL=./proxy.db
OPENAI_API_KEY=sk-your-openrouter-key
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_DEFAULT_MODEL=gpt-4.1-mini`;

function CopyButton({ text, label = "复制" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout(() => {
        setCopied(false);
        timerRef.current = null;
      }, 1200);
    } catch {
      // Clipboard may be unavailable in some contexts; keep the UI quiet.
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
      {copied ? (
        <CheckIcon data-icon="inline-start" />
      ) : (
        <CopySimpleIcon data-icon="inline-start" />
      )}
      {copied ? "已复制" : label}
    </Button>
  );
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "--";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: number | null }) {
  if (status === null) return <Badge variant="outline">pending</Badge>;
  if (status >= 200 && status < 300) return <Badge variant="default">{status}</Badge>;
  return <Badge variant="destructive">{status}</Badge>;
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card size="sm" className="bg-card/80">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tracking-tight">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function EndpointRow({
  label,
  value,
  copyable = false,
}: {
  label: string;
  value: string;
  copyable?: boolean;
}) {
  return (
    <div className="grid gap-2 border-t border-border/70 py-3 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[9rem_1fr_auto] sm:items-center">
      <span className="text-xs text-muted-foreground">{label}</span>
      <code className="truncate font-mono text-xs text-foreground">{value}</code>
      {copyable ? <CopyButton text={value} label="复制" /> : <span />}
    </div>
  );
}

function RecentLogRow({ log }: { log: LogEntry }) {
  const parsed = parseLog(log);
  const summary = parsed.summary.firstUserMessage || log.endpoint || "No prompt summary";
  const trimmed = summary.length > 120 ? `${summary.slice(0, 120)}...` : summary;

  return (
    <div className="grid gap-3 border-t border-border/70 py-3 first:border-t-0 first:pt-0 last:pb-0 md:grid-cols-[4.5rem_7rem_1fr_5rem] md:items-center">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">#{log.id}</span>
        <StatusBadge status={log.response_status} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{log.provider}</Badge>
        {log.is_streaming ? <Badge variant="outline">stream</Badge> : null}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm">{trimmed}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">
          {log.model || "--"} · {formatTime(log.request_time)}
        </p>
      </div>
      <p className="font-mono text-xs text-muted-foreground md:text-right">
        {formatDuration(log.duration_ms)}
      </p>
    </div>
  );
}

function SnippetCard({
  title,
  description,
  code,
}: {
  title: string;
  description: string;
  code: string;
}) {
  return (
    <Card className="bg-card/80">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <CopyButton text={code} />
        </div>
      </CardHeader>
      <CardContent>
        <pre className="max-h-[280px] overflow-auto border border-border/70 bg-muted/30 p-4 font-mono text-[11px] leading-relaxed">
          <code>{code}</code>
        </pre>
      </CardContent>
    </Card>
  );
}

function ProviderTabs() {
  return (
    <Tabs defaultValue="openai" className="w-full">
      <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
        <TabsTrigger value="openai">OpenAI</TabsTrigger>
        <TabsTrigger value="responses">Responses</TabsTrigger>
        <TabsTrigger value="anthropic">Anthropic</TabsTrigger>
        <TabsTrigger value="curl">cURL</TabsTrigger>
      </TabsList>

      <TabsContent value="openai" className="mt-4">
        <SnippetCard
          title="OpenAI SDK"
          description="把 baseURL 指向本地代理的 /v1 路径。"
          code={OPENAI_SNIPPET}
        />
      </TabsContent>

      <TabsContent value="responses" className="mt-4">
        <SnippetCard
          title="Responses API"
          description="适合需要直接验证 /responses 路径的集成。"
          code={OPENAI_RESPONSES_SNIPPET}
        />
      </TabsContent>

      <TabsContent value="anthropic" className="mt-4">
        <SnippetCard
          title="Anthropic SDK"
          description="请求会由代理转换到兼容的上游格式。"
          code={ANTHROPIC_SNIPPET}
        />
      </TabsContent>

      <TabsContent value="curl" className="mt-4">
        <SnippetCard
          title="cURL"
          description="不接 SDK 时，用命令行快速打一条请求。"
          code={CURL_SNIPPET}
        />
      </TabsContent>
    </Tabs>
  );
}

export function DashboardPage({
  onNavigate,
}: {
  onNavigate: (path: RoutePath) => void;
}) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);

    try {
      const response = await fetchLogs({ page: 1, pageSize: 6 });
      setLogs(response.data);
      setTotal(response.total);
    } catch (error) {
      console.error("Failed to fetch dashboard logs:", error);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const recentErrors = logs.filter((log) => {
    const status = log.response_status;
    return Boolean(log.error) || (status !== null && status >= 400);
  }).length;
  const completedDurations = logs
    .map((log) => log.duration_ms)
    .filter((duration): duration is number => duration !== null);
  const averageDuration =
    completedDurations.length > 0
      ? Math.round(
          completedDurations.reduce((totalMs, duration) => totalMs + duration, 0) /
            completedDurations.length
        )
      : null;

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <Card className="bg-card/90">
          <CardHeader className="border-b border-border/70">
            <CardDescription>Local proxy workspace</CardDescription>
            <CardTitle className="max-w-3xl text-3xl tracking-tight">
              捕获、查看和对比 AI 请求
            </CardTitle>
            <CardAction>
              <Badge variant={loadFailed ? "destructive" : "secondary"}>
                {loadFailed ? "API offline" : "Ready"}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 pt-1">
            <p className="max-w-2xl text-sm text-muted-foreground">
              常用入口集中在这里：看最近流量、复制代理地址、跳到日志详情或响应对比。
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => onNavigate("/logs")}>
                查看日志
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onNavigate("/compare")}
              >
                响应对比
              </Button>
              <CopyButton text={API_BASE_URL} label="复制 baseURL" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/90">
          <CardHeader>
            <CardTitle>代理连接</CardTitle>
            <CardDescription>客户端 SDK 只需要改这个入口。</CardDescription>
          </CardHeader>
          <CardContent>
            <EndpointRow label="Base URL" value={API_BASE_URL} copyable />
            <EndpointRow label="Chat" value="/v1/chat/completions" />
            <EndpointRow label="Responses" value="/v1/responses" />
            <EndpointRow label="Messages" value="/v1/messages" />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label="日志总量"
          value={loading ? "--" : String(total)}
          detail="来自当前代理数据库"
        />
        <MetricCard
          label="最近错误"
          value={loading ? "--" : String(recentErrors)}
          detail="按首页最近 6 条估算"
        />
        <MetricCard
          label="平均耗时"
          value={formatDuration(averageDuration)}
          detail="按首页最近完成请求计算"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="bg-card/90">
          <CardHeader>
            <CardTitle>最近请求</CardTitle>
            <CardDescription>
              用来快速确认代理有没有收到流量，完整筛选放在日志页。
            </CardDescription>
            <CardAction>
              <Button type="button" variant="outline" size="sm" onClick={loadOverview}>
                刷新
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                正在读取最近日志...
              </div>
            ) : logs.length > 0 ? (
              <div className="flex flex-col">
                {logs.map((log) => (
                  <RecentLogRow key={log.id} log={log} />
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-border/80 p-6 text-sm text-muted-foreground">
                还没有请求。复制 baseURL 接入客户端后，这里会出现最新流量。
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="bg-card/90">
            <CardHeader>
              <CardTitle>后端环境变量</CardTitle>
              <CardDescription>只保留启动代理需要看的字段。</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-auto border border-border/70 bg-muted/30 p-4 font-mono text-[11px] leading-relaxed">
                <code>{BACKEND_ENV_SNIPPET}</code>
              </pre>
            </CardContent>
          </Card>

          <Card className="bg-card/90">
            <CardHeader>
              <CardTitle>常见确认项</CardTitle>
              <CardDescription>请求发出去后，优先看这些字段。</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col">
                {["provider", "model", "duration_ms", "response_body_finish"].map(
                  (field) => (
                    <div
                      key={field}
                      className="flex items-center justify-between gap-3 border-t border-border/70 py-3 first:border-t-0 first:pt-0 last:pb-0"
                    >
                      <code className="font-mono text-xs">{field}</code>
                      <Badge variant="outline">Log detail</Badge>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <Card className="bg-card/90">
          <CardHeader>
            <CardTitle>接入示例</CardTitle>
            <CardDescription>
              需要换 SDK 或命令行验证时再展开对应标签。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProviderTabs />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
