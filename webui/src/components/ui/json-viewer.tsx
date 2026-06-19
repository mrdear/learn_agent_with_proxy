import { useMemo, useState, type CSSProperties } from "react";
import JsonView, { ValueQuote } from "@uiw/react-json-view";
import { githubDarkTheme } from "@uiw/react-json-view/githubDark";
import { githubLightTheme } from "@uiw/react-json-view/githubLight";
import type { ShouldExpandNodeInitially } from "@uiw/react-json-view";
import { useTheme } from "next-themes";
import { Eye } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MarkdownViewer } from "@/components/ui/markdown-viewer";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

interface JsonViewerProps {
  data: unknown;
  arrayCollapseThreshold?: number;
  className?: string;
  enableStringPreview?: boolean;
  longTextPreviewThreshold?: number;
}

const DEFAULT_ARRAY_COLLAPSE_THRESHOLD = 100;
const DEFAULT_LONG_TEXT_PREVIEW_THRESHOLD = 240;
const INLINE_STRING_PREVIEW_LENGTH = 180;

type PreviewMode = "json" | "markdown" | "plain";

interface StringPreview {
  keyPath: string;
  value: string;
  detectedMode: PreviewMode;
  mode: PreviewMode;
  parsedJson?: unknown;
}

const shouldExpandNodeInitially: ShouldExpandNodeInitially<object> = (shouldExpand, { value }) => {
  if (Array.isArray(value)) {
    return value.length <= DEFAULT_ARRAY_COLLAPSE_THRESHOLD;
  }

  return shouldExpand;
};

function parseJsonString(value: string): unknown | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const looksLikeJson =
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"));

  if (!looksLikeJson) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }
}

function looksLikeMarkdown(value: string): boolean {
  return [
    /(^|\n)#{1,6}\s+\S/,
    /(^|\n)\s*(?:[-*+]|\d+\.)\s+\S/,
    /(^|\n)\s*>\s+\S/,
    /(^|\n)\s*```/,
    /(^|\n)\|.+\|/,
    /\[[^\]\n]+\]\([^)]+\)/,
    /(^|\n)\s*[-*_]{3,}\s*(\n|$)/,
    /[*_]{2}[^*_]+[*_]{2}/,
  ].some((pattern) => pattern.test(value));
}

function createStringPreview(
  keyName: string | number,
  keys: (string | number)[] | undefined,
  value: string
): StringPreview {
  const parsedJson = parseJsonString(value);
  if (parsedJson !== undefined) {
    return {
      keyPath: formatKeyPath(keyName, keys),
      value,
      detectedMode: "json",
      mode: "json",
      parsedJson,
    };
  }

  const detectedMode = looksLikeMarkdown(value) ? "markdown" : "plain";
  return {
    keyPath: formatKeyPath(keyName, keys),
    value,
    detectedMode,
    mode: detectedMode,
  };
}

function isPreviewMode(value: string | undefined): value is PreviewMode {
  return value === "plain" || value === "markdown" || value === "json";
}

function formatKeyPath(
  keyName: string | number,
  keys: (string | number)[] | undefined
): string {
  const segments = keys && keys.length > 0 ? keys : [keyName];
  return segments.reduce<string>((path, segment) => {
    if (typeof segment === "number") {
      return `${path}[${segment}]`;
    }

    if (!path) {
      return segment;
    }

    return /^[A-Za-z_$][\w$]*$/.test(segment)
      ? `${path}.${segment}`
      : `${path}[${JSON.stringify(segment)}]`;
  }, "");
}

function truncateString(value: string): string {
  if (value.length <= INLINE_STRING_PREVIEW_LENGTH) {
    return value;
  }

  return `${value.slice(0, INLINE_STRING_PREVIEW_LENGTH)}...`;
}

function PreviewContent({ preview }: { preview: StringPreview }) {
  if (preview.mode === "json") {
    const parsedJson = preview.parsedJson ?? parseJsonString(preview.value);
    if (parsedJson === undefined) {
      return (
        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-border bg-background/70 px-3 py-2 text-xs text-muted-foreground">
            Current value is not parseable as JSON.
          </div>
          <PlainPreview value={preview.value} />
        </div>
      );
    }

    return (
      <JsonViewer
        data={parsedJson}
        enableStringPreview={false}
        className="max-h-none"
      />
    );
  }

  if (preview.mode === "markdown") {
    return (
      <MarkdownViewer
        content={preview.value}
        className="rounded-md border border-border bg-background/70 p-3"
      />
    );
  }

  return <PlainPreview value={preview.value} />;
}

function PlainPreview({ value }: { value: string }) {
  return (
    <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-background/70 p-3 font-mono text-xs/relaxed text-foreground">
      {value}
    </pre>
  );
}

export function JsonViewer({
  data,
  arrayCollapseThreshold = DEFAULT_ARRAY_COLLAPSE_THRESHOLD,
  className,
  enableStringPreview = true,
  longTextPreviewThreshold = DEFAULT_LONG_TEXT_PREVIEW_THRESHOLD,
}: JsonViewerProps) {
  const { resolvedTheme } = useTheme();
  const [preview, setPreview] = useState<StringPreview | null>(null);
  const theme = resolvedTheme === "dark" ? githubDarkTheme : githubLightTheme;
  const shouldExpandArrayNode: ShouldExpandNodeInitially<object> = useMemo(
    () => (shouldExpand, { value }) => {
      if (Array.isArray(value)) {
        return value.length <= arrayCollapseThreshold;
      }

      return shouldExpand;
    },
    [arrayCollapseThreshold]
  );

  return (
    <>
      <div className={cn("max-h-[600px] overflow-auto rounded-md border border-border bg-muted/30", className)}>
        <JsonView
          value={data as object}
          collapsed={false}
          shouldExpandNodeInitially={
            arrayCollapseThreshold === DEFAULT_ARRAY_COLLAPSE_THRESHOLD
              ? shouldExpandNodeInitially
              : shouldExpandArrayNode
          }
          displayDataTypes={false}
          enableClipboard={true}
          shortenTextAfterLength={0}
          style={{
            ...theme,
            "--w-rjv-font-family": "var(--font-mono, 'JetBrains Mono Variable', monospace)",
            "--w-rjv-background-color": "transparent",
            fontSize: "12px",
            padding: "12px",
          } as CSSProperties}
        >
          {enableStringPreview && (
            <JsonView.String
              render={({ children, className: valueClassName, ...valueProps }, { type, value, keyName, keys }) => {
                if (
                  type !== "value" ||
                  typeof value !== "string" ||
                  value.length <= longTextPreviewThreshold
                ) {
                  return undefined;
                }

                const inlineValue = typeof children === "string" ? children : value;

                return (
                  <>
                    <ValueQuote />
                    <span {...valueProps} className={cn(valueClassName, "break-words")}>
                      {truncateString(inlineValue)}
                    </span>
                    <ValueQuote />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="ml-1 align-middle text-muted-foreground"
                      title="Preview value"
                      aria-label="Preview value"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setPreview(createStringPreview(keyName, keys, value));
                      }}
                    >
                      <Eye data-icon="inline-start" />
                      <span className="sr-only">Preview value</span>
                    </Button>
                  </>
                );
              }}
            />
          )}
        </JsonView>
      </div>
      <Dialog
        open={preview !== null}
        disablePointerDismissal={false}
        onOpenChange={(open) => {
          if (!open) {
            setPreview(null);
          }
        }}
      >
        {preview && (
          <DialogContent className="bg-muted/30">
            <DialogHeader className="border-b border-border pr-12">
              <div className="flex min-w-0 items-center gap-2">
                <DialogTitle className="truncate">Value preview</DialogTitle>
                <Badge variant="outline">Auto: {preview.detectedMode}</Badge>
              </div>
              <DialogDescription className="break-all font-mono">
                {preview.keyPath}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2">
              <ToggleGroup
                variant="outline"
                size="sm"
                value={[preview.mode]}
                onValueChange={(nextValue) => {
                  const nextMode = nextValue[0];
                  if (!isPreviewMode(nextMode)) {
                    return;
                  }

                  setPreview({ ...preview, mode: nextMode });
                }}
              >
                <ToggleGroupItem value="plain">Plain</ToggleGroupItem>
                <ToggleGroupItem value="markdown">Markdown</ToggleGroupItem>
                <ToggleGroupItem value="json">JSON</ToggleGroupItem>
              </ToggleGroup>
              <span className="text-xs text-muted-foreground">
                Preview as {preview.mode}
              </span>
            </div>
            <div className="min-h-0 overflow-auto bg-muted/30 p-4">
              <PreviewContent preview={preview} />
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
