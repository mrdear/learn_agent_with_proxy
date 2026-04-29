import JsonView from "@uiw/react-json-view";
import { githubDarkTheme } from "@uiw/react-json-view/githubDark";
import { githubLightTheme } from "@uiw/react-json-view/githubLight";
import { useTheme } from "next-themes";

interface JsonViewerProps {
  data: unknown;
  collapsed?: number | boolean;
  className?: string;
}

export function JsonViewer({ data, collapsed = false, className }: JsonViewerProps) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? githubDarkTheme : githubLightTheme;

  return (
    <div className={`rounded-md border border-border overflow-auto max-h-[600px] ${className ?? ""}`}>
      <JsonView
        value={data as object}
        collapsed={collapsed}
        displayDataTypes={false}
        enableClipboard={true}
        shortenTextAfterLength={0}
        style={{
          ...theme,
          "--w-rjv-font-family": "var(--font-mono, 'JetBrains Mono Variable', monospace)",
          fontSize: "12px",
          padding: "12px",
        } as React.CSSProperties}
      />
    </div>
  );
}
