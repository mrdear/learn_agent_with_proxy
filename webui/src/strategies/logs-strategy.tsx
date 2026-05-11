import { LogsPage } from "@/pages/logs-page";
import type { PageStrategy } from "./types";

export const logsStrategy: PageStrategy = {
  path: "/logs",
  render: (onNavigate) => <LogsPage onNavigate={onNavigate} />,
};
