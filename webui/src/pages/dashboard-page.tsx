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
  baseURL: "http://localhost:3000",
  apiKey: process.env.OPENAI_API_KEY!,
});`;

const ANTHROPIC_SNIPPET = `import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  baseURL: "http://localhost:3000",
  apiKey: process.env.ANTHROPIC_API_KEY!,
});`;

const CURL_SNIPPET = `curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-openai-key" \
  -d '{
    "model": "gpt-4.1-mini",
    "messages": [
      { "role": "user", "content": "Hello from the proxy" }
    ]
  }'`;

const BACKEND_ENV_SNIPPET = `PORT=3000
DATABASE_URL=./proxy.db

OPENAI_BASE_URL=https://api.openai.com
ANTHROPIC_BASE_URL=https://api.anthropic.com`;

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
    <Button type="button" variant="default" size="xs" className="shadow-sm" onClick={handleCopy}>
      {copied ? (
        <CheckIcon data-icon="inline-start" />
      ) : (
        <CopySimpleIcon data-icon="inline-start" />
      )}
      {copied ? "Copied" : "Copy"}
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
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/70">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <CopyButton text={code} />
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <pre className="max-h-[420px] overflow-x-auto overflow-y-auto rounded-none border border-border bg-muted p-4 font-mono text-xs leading-6 whitespace-pre-wrap break-all">
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
    <Card className={cn(tone !== "outline" && "ring-1", tone === "default" && "ring-primary/15 bg-primary/5", tone === "secondary" && "ring-secondary/15 bg-secondary/20")}>
      <CardHeader className="gap-3">
        <Badge variant={tone} className="w-fit font-mono shadow-sm">
          {step}
        </Badge>
        <div className="flex flex-col gap-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
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
  const valueToneClass =
    tone === "default"
      ? "border-primary/25 bg-primary/10 text-foreground shadow-sm"
      : tone === "secondary"
        ? "border-secondary/40 bg-secondary/30 text-foreground"
        : "border-border bg-muted/30 text-foreground";

  return (
    <div className="flex items-center justify-between gap-3 rounded-none border border-border px-3 py-2">
      <div className="flex flex-col gap-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
        <div
          className={cn(
            "max-w-full rounded-none border px-3 py-1.5 font-mono text-xs leading-5 break-all",
            valueToneClass
          )}
        >
          {value}
        </div>
      </div>
      {copyable ? <CopyButton text={value} /> : null}
    </div>
  );
}

function ProviderTabs() {
  return (
    <Tabs defaultValue="openai" className="w-full">
      <TabsList variant="line" className="flex-wrap">
        <TabsTrigger value="openai">OpenAI SDK</TabsTrigger>
        <TabsTrigger value="anthropic">Anthropic SDK</TabsTrigger>
        <TabsTrigger value="curl">cURL</TabsTrigger>
      </TabsList>

      <TabsContent value="openai" className="mt-4">
        <SnippetCard
          title="OpenAI SDK"
          description="Use the local proxy as the base URL, while keeping your existing OpenAI key."
          code={OPENAI_SNIPPET}
        />
      </TabsContent>

      <TabsContent value="anthropic" className="mt-4">
        <SnippetCard
          title="Anthropic SDK"
          description="The proxy forwards Anthropic requests and preserves the x-api-key header."
          code={ANTHROPIC_SNIPPET}
        />
      </TabsContent>

      <TabsContent value="curl" className="mt-4">
        <SnippetCard
          title="cURL smoke test"
          description="A quick check that the proxy is reachable and logs a chat completion."
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
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <Card className="relative overflow-hidden ring-1 ring-primary/10 bg-primary/5">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-10 right-0 size-56 rounded-full bg-foreground/5 blur-3xl" />
            <div className="absolute -bottom-20 left-24 size-72 rounded-full bg-muted/70 blur-3xl" />
          </div>
          <CardHeader className="relative gap-3">
            <Badge variant="default" className="w-fit shadow-sm">
              Setup guide
            </Badge>
            <div className="flex flex-col gap-2">
              <CardTitle className="text-2xl lg:text-3xl">
                把你的 AI 客户端指向本地代理
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm">
                只要把 base URL 切到这个本地服务，后端就会帮你转发到 OpenAI
                或 Anthropic，并把请求与响应写入日志。
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="relative flex flex-wrap items-center gap-3">
            <Button type="button" size="lg" className="shadow-sm" onClick={() => onNavigate("/logs")}>
              Open logs
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
            <Button type="button" variant="secondary" size="lg" onClick={() => onNavigate("/compare")}>
              Compare logs
            </Button>
            <Badge variant="default" className="gap-1.5 shadow-sm">
              <LightningIcon data-icon="inline-start" />
              Local proxy
            </Badge>
          </CardContent>
        </Card>

        <Card className="ring-1 ring-border/70 bg-card">
          <CardHeader>
            <CardTitle>Connection points</CardTitle>
            <CardDescription>
              These are the only URLs most users need to change.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <FactRow label="Proxy URL" value={PROXY_URL} copyable tone="default" />
            <FactRow label="OpenAI route" value="/v1/chat/completions" tone="secondary" />
            <FactRow label="Anthropic route" value="/v1/messages" tone="secondary" />
            <FactRow label="Logs route" value="/logs" tone="outline" />
          </CardContent>
        </Card>
      </section>

      <Separator />

      <section className="grid gap-4 lg:grid-cols-3">
        <StepCard
          step="01"
          title="Run the backend"
          description="Start the proxy server and confirm it is listening on http://localhost:3000."
          tone="default"
        />
        <StepCard
          step="02"
          title="Swap the base URL"
          description="Point your SDK or HTTP client to the local proxy, but keep your provider API key as-is."
          tone="secondary"
        />
        <StepCard
          step="03"
          title="Check the logs"
          description="Send one request, then open /logs to verify provider, model, tokens, and streaming chunks."
          tone="outline"
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
            Client snippets
          </p>
          <h2 className="text-lg font-medium tracking-tight">
            Use the same API shape, just change the destination
          </h2>
        </div>
        <ProviderTabs />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <SnippetCard
          title="Backend .env"
          description="These values control where the proxy forwards traffic."
          code={BACKEND_ENV_SNIPPET}
        />

        <Card>
          <CardHeader>
            <CardTitle>What to verify</CardTitle>
            <CardDescription>
              After one request, these fields should start showing up in the logs.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 font-mono">
                provider
              </Badge>
              <p className="text-xs text-muted-foreground">
                Should be <span className="text-foreground">openai</span> or{" "}
                <span className="text-foreground">anthropic</span>.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 font-mono">
                request_body
              </Badge>
              <p className="text-xs text-muted-foreground">
                Should contain the prompt, messages, and any tools you passed in.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 font-mono">
                response_body_finish
              </Badge>
              <p className="text-xs text-muted-foreground">
                Should show the final assistant text, even for streaming responses.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
