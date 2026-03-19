export type RoutePath = "/" | "/logs" | "/compare";

export const appRoutes = [
  {
    path: "/" as const,
    label: "Dashboard",
  },
  {
    path: "/logs" as const,
    label: "Logs",
  },
  {
    path: "/compare" as const,
    label: "Compare",
  },
] as const;

export function normalizeRoute(pathname: string): RoutePath {
  if (pathname === "/logs" || pathname.startsWith("/logs/")) {
    return "/logs";
  }

  if (pathname === "/compare" || pathname.startsWith("/compare/")) {
    return "/compare";
  }

  return "/";
}
