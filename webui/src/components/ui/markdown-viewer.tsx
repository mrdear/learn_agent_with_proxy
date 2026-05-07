import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { Copy, Check } from "@phosphor-icons/react";

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  const [copied, setCopied] = useState(false);

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
    <div className={`prose prose-sm dark:prose-invert max-w-none break-words relative group ${className ?? ""}`}>
      <button
        onClick={handleCopy}
        className="absolute top-1 right-1 z-10 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100 focus:opacity-100"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
      <Markdown
        remarkPlugins={[remarkGfm]}
        children={content}
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
  );
}
