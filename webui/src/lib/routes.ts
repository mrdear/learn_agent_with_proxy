import type { Icon } from "@phosphor-icons/react";
import { ArrowsLeftRight, FileText, GearSix, House } from "@phosphor-icons/react";

export type RoutePath = "/" | "/logs" | "/compare" | "/settings";

export type AppRoute = {
  path: RoutePath;
  label: string;
  description: string;
  icon: Icon;
};

export const appRoutes = [
  {
    path: "/" as const,
    label: "Dashboard",
    description: "Setup guide and client snippets",
    icon: House,
  },
  {
    path: "/logs" as const,
    label: "Logs",
    description: "Captured requests and responses",
    icon: FileText,
  },
  {
    path: "/compare" as const,
    label: "Compare",
    description: "Side-by-side log analysis",
    icon: ArrowsLeftRight,
  },
  {
    path: "/settings" as const,
    label: "Settings",
    description: "Provider endpoints and model mappings",
    icon: GearSix,
  },
] as const satisfies readonly AppRoute[];

export function getRouteMeta(pathname: RoutePath) {
  return appRoutes.find((route) => route.path === pathname) ?? appRoutes[0];
}

export function normalizeRoute(pathname: string): RoutePath {
  if (pathname === "/logs" || pathname.startsWith("/logs/")) {
    return "/logs";
  }

  if (pathname === "/compare" || pathname.startsWith("/compare/")) {
    return "/compare";
  }

  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return "/settings";
  }

  return "/";
}
