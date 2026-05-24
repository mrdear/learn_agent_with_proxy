import JsonView from "@uiw/react-json-view";
import { githubDarkTheme } from "@uiw/react-json-view/githubDark";
import { githubLightTheme } from "@uiw/react-json-view/githubLight";
import type { ShouldExpandNodeInitially } from "@uiw/react-json-view";
import { useTheme } from "next-themes";

interface JsonViewerProps {
  data: unknown;
  arrayCollapseThreshold?: number;
  className?: string;
}

const DEFAULT_ARRAY_COLLAPSE_THRESHOLD = 100;

const shouldExpandNodeInitially: ShouldExpandNodeInitially<object> = (shouldExpand, { value }) => {
  if (Array.isArray(value)) {
    return value.length <= DEFAULT_ARRAY_COLLAPSE_THRESHOLD;
  }

  return shouldExpand;
};

export function JsonViewer({
  data,
  arrayCollapseThreshold = DEFAULT_ARRAY_COLLAPSE_THRESHOLD,
  className,
}: JsonViewerProps) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? githubDarkTheme : githubLightTheme;
  const shouldExpandArrayNode: ShouldExpandNodeInitially<object> = (shouldExpand, { value }) => {
    if (Array.isArray(value)) {
      return value.length <= arrayCollapseThreshold;
    }

    return shouldExpand;
  };

  return (
    <div className={`rounded-md border border-border overflow-auto max-h-[600px] ${className ?? ""}`}>
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
          fontSize: "12px",
          padding: "12px",
        } as React.CSSProperties}
      />
    </div>
  );
}
