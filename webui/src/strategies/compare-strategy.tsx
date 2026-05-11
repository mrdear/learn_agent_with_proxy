import { ComparePage } from "@/pages/compare-page";
import type { PageStrategy } from "./types";

export const compareStrategy: PageStrategy = {
  path: "/compare",
  render: (onNavigate) => <ComparePage onNavigate={onNavigate} />,
};
