import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none break-words ${className ?? ""}`}>
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
