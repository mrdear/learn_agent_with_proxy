import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { RoutePath } from "@/lib/routes";
import {
  ArrowRightIcon,
  CheckIcon,
  CopySimpleIcon,
  LightningIcon,
} from "@phosphor-icons/react";

const PROXY_URL = "http://localhost:3000";

const OPENAI_SNIPPET = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:3000/v1",
  apiKey: "sk-local-proxy",
});`;

const OPENAI_RESPONSES_SNIPPET = `// OpenAI Responses API (用于特定的集成，如 Junie)
curl http://localhost:3000/v1/responses \\
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

const BACKEND_ENV_SNIPPET = `# 代理服务的端口
PORT=3000

# 数据库文件路径 (用于存储日志)
DATABASE_URL=./proxy.db

# 上游 API 配置 (目前支持 OpenRouter 格式)
OPENAI_API_KEY=sk-your-openrouter-key
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_DEFAULT_MODEL=gpt-4.1-mini`;

function CopyButton({ text }: { text: string }) {
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
    <Button type="button" variant="default" size="xs" className="h-7 px-2 text-[10px]" onClick={handleCopy}>
      {copied ? (
        <CheckIcon className="mr-1 size-3" />
      ) : (
        <CopySimpleIcon className="mr-1 size-3" />
      )}
      {copied ? "已复制" : "复制"}
    </Button>
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
    <Card className="overflow-hidden border-border/50 bg-card/50">
      <CardHeader className="bg-muted/30 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
          <CopyButton text={code} />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <pre className="max-h-[300px] overflow-auto bg-muted/20 p-4 font-mono text-[11px] leading-relaxed">
          <code>{code}</code>
        </pre>
      </CardContent>
    </Card>
  );
}

function StepCard({
  step,
  title,
  description,
  tone = "outline",
}: {
  step: string;
  title: string;
  description: string;
  tone?: "default" | "secondary" | "outline";
}) {
  return (
    <Card className={cn(
      "relative overflow-hidden transition-all hover:shadow-md",
      tone === "default" && "border-primary/20 bg-primary/5",
      tone === "secondary" && "border-secondary/20 bg-secondary/5",
      tone === "outline" && "border-border/50 bg-card"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <span className={cn(
            "flex size-7 items-center justify-center rounded-full font-mono text-xs font-bold",
            tone === "default" && "bg-primary text-primary-foreground",
            tone === "secondary" && "bg-secondary text-secondary-foreground",
            tone === "outline" && "bg-muted text-muted-foreground"
          )}>
            {step}
          </span>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <CardDescription className="pt-1 text-xs leading-relaxed">
          {description}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function FactRow({
  label,
  value,
  copyable = false,
  tone = "outline",
}: {
  label: string;
  value: string;
  copyable?: boolean;
  tone?: "default" | "secondary" | "outline";
}) {
  return (
    <div className="group flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-muted/30 p-3 transition-colors hover:bg-muted/50">
      <div className="flex flex-col gap-1 overflow-hidden">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
          {label}
        </span>
        <code className={cn(
          "truncate font-mono text-xs font-medium",
          tone === "default" && "text-primary",
          tone === "secondary" && "text-secondary-foreground"
        )}>
          {value}
        </code>
      </div>
      {copyable && <CopyButton text={value} />}
    </div>
  );
}

function ProviderTabs() {
  return (
    <Tabs defaultValue="openai" className="w-full">
      <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
        <TabsTrigger value="openai">OpenAI SDK</TabsTrigger>
        <TabsTrigger value="responses">Responses API</TabsTrigger>
        <TabsTrigger value="anthropic">Anthropic SDK</TabsTrigger>
        <TabsTrigger value="curl">cURL</TabsTrigger>
      </TabsList>

      <TabsContent value="openai" className="mt-4">
        <SnippetCard
          title="OpenAI SDK 配置"
          description="将 baseURL 指向本地代理的 /v1 路径即可。"
          code={OPENAI_SNIPPET}
        />
      </TabsContent>

      <TabsContent value="responses" className="mt-4">
        <SnippetCard
          title="OpenAI Responses API"
          description="支持特殊的 /responses 路径，通常用于 Realtime 或自定义集成。"
          code={OPENAI_RESPONSES_SNIPPET}
        />
      </TabsContent>

      <TabsContent value="anthropic" className="mt-4">
        <SnippetCard
          title="Anthropic SDK 配置"
          description="代理会自动将请求转换为 OpenRouter 兼容格式。"
          code={ANTHROPIC_SNIPPET}
        />
      </TabsContent>

      <TabsContent value="curl" className="mt-4">
        <SnippetCard
          title="快速测试 (cURL)"
          description="无需 SDK，直接通过命令行验证代理是否工作。"
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
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 py-4">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/10 via-background to-background p-8 lg:p-12">
        <div className="relative z-10 flex flex-col gap-6 lg:max-w-2xl">
          <Badge variant="outline" className="w-fit border-primary/20 bg-primary/5 px-3 py-1 text-primary">
            使用指南 & 配置说明
          </Badge>
          <div className="flex flex-col gap-4">
            <h1 className="text-3xl font-bold tracking-tight lg:text-5xl">
              把你的 AI 客户端<br />
              <span className="text-primary">指向本地代理</span>
            </h1>
            <p className="text-base text-muted-foreground lg:text-lg">
              通过将 API 基础地址切换到本地服务，你可以透明地观察所有 AI 请求，
              自动路由到 OpenRouter，并持久化每一条对话日志。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="lg" className="h-12 px-8 shadow-lg shadow-primary/20" onClick={() => onNavigate("/logs")}>
              查看实时日志
              <ArrowRightIcon className="ml-2 size-4" />
            </Button>
            <Button variant="outline" size="lg" className="h-12 px-8" onClick={() => onNavigate("/compare")}>
              对比模型响应
            </Button>
          </div>
        </div>
        <div className="absolute -right-20 -top-20 hidden size-96 rounded-full bg-primary/5 blur-3xl lg:block" />
      </section>

      {/* Connection Points */}
      <section className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">快速配置连接点</h2>
            <p className="text-sm text-muted-foreground">
              大多数情况下，你只需要修改代码中的 baseURL 或环境变量。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FactRow label="代理基础 URL" value={PROXY_URL} copyable tone="default" />
            <FactRow label="OpenAI 兼容路径" value="/v1/chat/completions" tone="secondary" />
            <FactRow label="OpenAI Responses" value="/v1/responses" tone="secondary" />
            <FactRow label="Anthropic 兼容路径" value="/v1/messages" tone="secondary" />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">后端环境变量</h2>
            <p className="text-sm text-muted-foreground">
              确保 <code>backend/.env</code> 文件已正确配置。
            </p>
          </div>
          <Card className="border-border/50">
            <CardContent className="p-0">
              <pre className="overflow-auto bg-muted/20 p-4 font-mono text-[11px] leading-relaxed">
                <code>{BACKEND_ENV_SNIPPET}</code>
              </pre>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator className="opacity-50" />

      {/* Steps */}
      <section className="flex flex-col gap-8">
        <div className="flex flex-col gap-2 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">三个步骤开始工作</h2>
          <p className="text-sm text-muted-foreground">
            只需几分钟，即可完成开发环境的 AI 观测配置。
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <StepCard
            step="01"
            title="启动后端服务"
            description="在 backend 目录下运行 pnpm dev，确保服务在 3000 端口监听。"
            tone="default"
          />
          <StepCard
            step="02"
            title="修改 Base URL"
            description="将你的 SDK 或客户端地址指向 http://localhost:3000/v1，API Key 可填任意值。"
            tone="secondary"
          />
          <StepCard
            step="03"
            title="观察与调试"
            description="发起一次请求后，在日志页面查看完整的 Provider、模型、Token 及流式响应。"
            tone="outline"
          />
        </div>
      </section>

      {/* Code Snippets */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">代码集成示例</h2>
          <p className="text-sm text-muted-foreground">
            保持现有的 API 调用逻辑，仅需更改目标地址。
          </p>
        </div>
        <ProviderTabs />
      </section>

      {/* Verification Card */}
      <section className="rounded-3xl border border-border bg-muted/20 p-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h3 className="text-xl font-semibold">验证日志字段</h3>
            <p className="text-sm text-muted-foreground">
              成功发送请求后，你应该在日志详情中看到以下关键信息，这有助于你确认代理逻辑是否正确执行。
            </p>
            <div className="flex flex-col gap-3">
              {[
                { field: "provider", desc: "应显示 openai, anthropic 或 openai-responses。" },
                { field: "request_body", desc: "包含你的提示词、消息列表及工具调用定义。" },
                { field: "response_body_finish", desc: "合并后的最终回复内容（包括流式响应）。" },
                { field: "duration_ms", desc: "记录从发起请求到接收完成的总耗时。" }
              ].map((item) => (
                <div key={item.field} className="flex items-start gap-3">
                  <Badge variant="secondary" className="mt-0.5 font-mono text-[10px]">
                    {item.field}
                  </Badge>
                  <p className="text-xs text-muted-foreground/90">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative size-48 rounded-2xl bg-gradient-to-tr from-primary/20 to-secondary/20 p-6">
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <LightningIcon className="size-12 text-primary" weight="fill" />
                <span className="text-sm font-bold">代理运行中</span>
                <span className="text-[10px] text-muted-foreground">Ready for connections</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

