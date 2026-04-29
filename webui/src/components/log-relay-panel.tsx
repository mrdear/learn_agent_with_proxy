import { useEffect, useMemo, useState } from "react";
import type { LogEntry, ReplayLogOverrides } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { JsonViewer } from "@/components/ui/json-viewer";

interface LogRelayPanelProps {
  log: LogEntry;
  onRelay: (overrides: ReplayLogOverrides) => Promise<void> | void;
  disabled?: boolean;
}

function formatBody(requestBody: string | null): string {
  if (!requestBody) {
    return "";
  }

  try {
    return JSON.stringify(JSON.parse(requestBody), null, 2);
  } catch {
    return requestBody;
  }
}

export function LogRelayPanel({ log, onRelay, disabled = false }: LogRelayPanelProps) {
  const originalBody = useMemo(() => formatBody(log.request_body), [log.request_body]);
  const [endpoint, setEndpoint] = useState(log.endpoint);
  const [method, setMethod] = useState(log.method);
  const [body, setBody] = useState(originalBody);
  const [sending, setSending] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const bodyJson = useMemo(() => {
    try {
      const parsed = JSON.parse(body);
      return typeof parsed === "object" && parsed !== null ? parsed : null;
    } catch {
      return null;
    }
  }, [body]);

  useEffect(() => {
    setEndpoint(log.endpoint);
    setMethod(log.method);
    setBody(originalBody);
  }, [log.endpoint, log.method, originalBody]);

  const hasChanges =
    endpoint !== log.endpoint || method !== log.method || body !== originalBody;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className="w-fit">
            Provider: {log.provider}
          </Badge>
          <p className="text-xs text-muted-foreground">
            Exact replay keeps the original auth headers. Relay lets you edit the
            path, method, and raw body before resending.
          </p>
        </div>
        <Badge variant={hasChanges ? "default" : "secondary"} className="shadow-sm">
          {hasChanges ? "Edited" : "Original"}
        </Badge>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Endpoint
          </p>
          <Input
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
            className="font-mono"
            spellCheck={false}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Method
          </p>
          <Input
            value={method}
            onChange={(event) => setMethod(event.target.value.toUpperCase())}
            className="font-mono"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Request Body
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => setEditMode((v) => !v)}
          >
            {editMode ? "Preview" : "Edit"}
          </Button>
        </div>
        {editMode ? (
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            spellCheck={false}
            className={cn(
              "min-h-[260px] w-full rounded-none border border-input bg-background px-3 py-2 font-mono text-xs leading-6 outline-none",
              "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
            )}
          />
        ) : bodyJson ? (
          <JsonViewer data={bodyJson} />
        ) : (
          <pre className="min-h-[260px] w-full rounded-md border border-input bg-muted px-3 py-2 font-mono text-xs leading-6 overflow-auto max-h-[600px] whitespace-pre-wrap break-all">
            {body || "(empty)"}
          </pre>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          The relay keeps the original headers, so you can focus on prompt and
          parameter changes.
        </p>
        <Button
          type="button"
          variant="default"
          className="shadow-sm"
          disabled={sending || disabled}
          onClick={async () => {
            setSending(true);
            try {
              await Promise.resolve(
                onRelay({
                  endpoint,
                  method,
                  request_body: body,
                })
              );
            } finally {
              setSending(false);
            }
          }}
        >
          {sending ? "Sending..." : "Relay edits"}
        </Button>
      </div>
    </div>
  );
}
