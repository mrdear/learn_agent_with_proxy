import type { ReactNode } from "react";
import type { RoutePath } from "@/lib/routes";

export interface PageStrategy {
  path: RoutePath;
  render: (onNavigate: (path: RoutePath) => void) => ReactNode;
}
