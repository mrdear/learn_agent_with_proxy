import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMemo, useState } from "react";
import { Copy, Check } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

const HTML_TAGS = new Set([
  "a",
  "abbr",
  "blockquote",
  "br",
  "code",
  "dd",
  "del",
  "details",
  "div",
  "dl",
  "dt",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "img",
  "ins",
  "kbd",
  "li",
  "ol",
  "p",
  "pre",
  "q",
  "s",
  "span",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
]);

function isCustomXmlTag(tagName: string): boolean {
  return !HTML_TAGS.has(tagName.toLowerCase());
}

function fenceFor(block: string): string {
  const longestFence = block
    .match(/`{3,}/g)
    ?.reduce((longest, fence) => Math.max(longest, fence.length), 2) ?? 2;

  return "`".repeat(longestFence + 1);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function protectCustomXmlBlocks(content: string): string {
  const lines = content.split("\n");
  const output: string[] = [];
  const openingTagPattern = /^\s*<([A-Za-z][\w:.-]*)(?:\s[^>]*)?>\s*$/;
  const fencePattern = /^\s*(```|~~~)/;
  let inMarkdownFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (fencePattern.test(line)) {
      inMarkdownFence = !inMarkdownFence;
      output.push(line);
      continue;
    }

    if (inMarkdownFence) {
      output.push(line);
      continue;
    }

    const openingMatch = line.match(openingTagPattern);
    const tagName = openingMatch?.[1];
    if (
      !tagName ||
      !isCustomXmlTag(tagName) ||
      line.trim().endsWith("/>") ||
      line.includes(`</${tagName}>`)
    ) {
      output.push(line);
      continue;
    }

    const block = [line];
    const closingTagPattern = new RegExp(`^\\s*</${escapeRegExp(tagName)}>\\s*$`);

    while (index + 1 < lines.length) {
      index += 1;
      block.push(lines[index]);
      if (closingTagPattern.test(lines[index])) break;
    }

    const rawBlock = block.join("\n");
    const fence = fenceFor(rawBlock);
    output.push(`${fence}xml`, rawBlock, fence);
  }

  return output.join("\n");
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const renderContent = useMemo(() => protectCustomXmlBlocks(content), [content]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for environments where clipboard API is unavailable
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex justify-end">
        <Button
          type="button"
          variant={copied ? "secondary" : "outline"}
          size="xs"
          className="shadow-sm"
          onClick={handleCopy}
        >
          {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          {copied ? t("Copied", "已复制") : t("Copy", "复制")}
        </Button>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none break-words">
        <Markdown
          remarkPlugins={[remarkGfm]}
          children={renderContent}
          components={{
            pre({ children }) {
              return (
                <pre className="bg-zinc-900 text-zinc-100 dark:bg-zinc-950 dark:text-zinc-200 rounded-md p-3 text-xs overflow-x-auto">
                  {children}
                </pre>
              );
            },
            code({ className, children, ...props }) {
              const isBlock = className?.startsWith("language-");
              if (isBlock) {
                return (
                  <code className={`${className} text-xs text-inherit`} {...props}>
                    {children}
                  </code>
                );
              }
              return (
                <code className="bg-zinc-200 dark:bg-zinc-700 text-pink-600 dark:text-pink-400 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                  {children}
                </code>
              );
            },
            table({ children }) {
              return (
                <div className="overflow-x-auto">
                  <table className="border-collapse border border-border text-xs">
                    {children}
                  </table>
                </div>
              );
            },
            th({ children }) {
              return (
                <th className="border border-border bg-muted px-3 py-1.5 text-left text-xs font-semibold">
                  {children}
                </th>
              );
            },
            td({ children }) {
              return (
                <td className="border border-border px-3 py-1.5 text-xs">
                  {children}
                </td>
              );
            },
          }}
        />
      </div>
    </div>
  );
}
