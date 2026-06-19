import { useMemo, useState, type CSSProperties } from "react";
import JsonView, { ValueQuote } from "@uiw/react-json-view";
import { githubDarkTheme } from "@uiw/react-json-view/githubDark";
import { githubLightTheme } from "@uiw/react-json-view/githubLight";
import type { ShouldExpandNodeInitially } from "@uiw/react-json-view";
import { useTheme } from "next-themes";
import { Check, Copy, Eye } from "@phosphor-icons/react";

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
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();

  if (preview.mode === "json") {
    const parsedJson = preview.parsedJson ?? parseJsonString(preview.value);
    if (parsedJson === undefined) {
      return (
        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground shadow-sm">
            {t(
              "Current value is not parseable as JSON.",
              "当前值不能解析为 JSON。"
            )}
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
        className="rounded-md border border-border bg-background p-3 shadow-sm"
      />
    );
  }

  return <PlainPreview value={preview.value} />;
}

function PlainPreview({ value }: { value: string }) {
  return (
    <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-background p-3 font-mono text-xs/relaxed text-foreground shadow-sm">
      {value}
    </pre>
  );
}

function getPreviewCopyText(preview: StringPreview): string {
  if (preview.mode === "json") {
    const parsedJson = preview.parsedJson ?? parseJsonString(preview.value);
    if (parsedJson !== undefined) {
      return JSON.stringify(parsedJson, null, 2);
    }
  }

  return preview.value;
}

export function JsonViewer({
  data,
  arrayCollapseThreshold = DEFAULT_ARRAY_COLLAPSE_THRESHOLD,
  className,
  enableStringPreview = true,
  longTextPreviewThreshold = DEFAULT_LONG_TEXT_PREVIEW_THRESHOLD,
}: JsonViewerProps) {
  const { resolvedTheme } = useTheme();
  const { t } = useI18n();
  const [preview, setPreview] = useState<StringPreview | null>(null);
  const [previewCopied, setPreviewCopied] = useState(false);
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

  const handleCopyPreview = async (currentPreview: StringPreview) => {
    try {
      await navigator.clipboard.writeText(getPreviewCopyText(currentPreview));
      setPreviewCopied(true);
      window.setTimeout(() => setPreviewCopied(false), 1200);
    } catch {
      setPreviewCopied(false);
    }
  };

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
                      title={t("Preview value", "预览值")}
                      aria-label={t("Preview value", "预览值")}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setPreviewCopied(false);
                        setPreview(createStringPreview(keyName, keys, value));
                      }}
                    >
                      <Eye data-icon="inline-start" />
                      <span className="sr-only">{t("Preview value", "预览值")}</span>
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
            setPreviewCopied(false);
          }
        }}
      >
        {preview && (
          <DialogContent className="bg-background">
            <DialogHeader className="border-b border-border bg-background pr-12">
              <div className="flex min-w-0 items-center gap-2">
                <DialogTitle className="truncate">
                  {t("Value preview", "值预览")}
                </DialogTitle>
                <Badge variant="outline">
                  {t("Auto: {mode}", "自动：{mode}", { mode: preview.detectedMode })}
                </Badge>
              </div>
              <DialogDescription className="break-all font-mono">
                {preview.keyPath}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted px-4 py-2">
              <ToggleGroup
                variant="outline"
                size="sm"
                value={[preview.mode]}
                onValueChange={(nextValue) => {
                  const nextMode = nextValue[0];
                  if (!isPreviewMode(nextMode)) {
                    return;
                  }

                  setPreviewCopied(false);
                  setPreview({ ...preview, mode: nextMode });
                }}
              >
                <ToggleGroupItem value="plain">{t("Plain", "纯文本")}</ToggleGroupItem>
                <ToggleGroupItem value="markdown">Markdown</ToggleGroupItem>
                <ToggleGroupItem value="json">JSON</ToggleGroupItem>
              </ToggleGroup>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {t("Preview as {mode}", "预览为 {mode}", {
                    mode: preview.mode,
                  })}
                </span>
                <Button
                  type="button"
                  variant={previewCopied ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => void handleCopyPreview(preview)}
                >
                  {previewCopied ? (
                    <Check data-icon="inline-start" />
                  ) : (
                    <Copy data-icon="inline-start" />
                  )}
                  {previewCopied ? t("Copied", "已复制") : t("Copy", "复制")}
                </Button>
              </div>
            </div>
            <div className="min-h-0 overflow-auto bg-muted p-4">
              <PreviewContent preview={preview} />
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
