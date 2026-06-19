import type { Icon } from "@phosphor-icons/react";
import { ArrowsLeftRight, FileText, GearSix, House } from "@phosphor-icons/react";
import { localizedText, type LocalizedText } from "@/lib/i18n";

export type RoutePath = "/" | "/logs" | "/compare" | "/settings";

export type AppRoute = {
  path: RoutePath;
  label: LocalizedText;
  description: LocalizedText;
  icon: Icon;
};

export const appRoutes = [
  {
    path: "/" as const,
    label: localizedText("Dashboard", "仪表盘"),
    description: localizedText("Setup guide and client snippets", "接入指南和客户端示例"),
    icon: House,
  },
  {
    path: "/logs" as const,
    label: localizedText("Logs", "日志"),
    description: localizedText("Captured requests and responses", "已捕获的请求和响应"),
    icon: FileText,
  },
  {
    path: "/compare" as const,
    label: localizedText("Compare", "对比"),
    description: localizedText("Side-by-side log analysis", "并排分析两条日志"),
    icon: ArrowsLeftRight,
  },
  {
    path: "/settings" as const,
    label: localizedText("Settings", "设置"),
    description: localizedText("Provider endpoints and model mappings", "Provider endpoint 和模型映射"),
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
