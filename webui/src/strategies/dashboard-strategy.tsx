import { DashboardPage } from "@/pages/dashboard-page";
import type { PageStrategy } from "./types";

export const dashboardStrategy: PageStrategy = {
  path: "/",
  render: (onNavigate) => <DashboardPage onNavigate={onNavigate} />,
};
