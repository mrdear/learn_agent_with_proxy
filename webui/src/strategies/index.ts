import type { RoutePath } from "@/lib/routes";
import type { PageStrategy } from "./types";
import { dashboardStrategy } from "./dashboard-strategy";
import { logsStrategy } from "./logs-strategy";
import { compareStrategy } from "./compare-strategy";

const strategies: Record<RoutePath, PageStrategy> = {
  "/": dashboardStrategy,
  "/logs": logsStrategy,
  "/compare": compareStrategy,
};

export function getStrategy(pathname: RoutePath): PageStrategy {
  return strategies[pathname] ?? strategies["/"];
}
