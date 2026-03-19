export type RoutePath = "/" | "/logs";

export const appRoutes = [
  {
    path: "/" as const,
    label: "Dashboard",
  },
  {
    path: "/logs" as const,
    label: "Logs",
  },
] as const;

export function normalizeRoute(pathname: string): RoutePath {
  return pathname === "/logs" || pathname.startsWith("/logs/") ? "/logs" : "/";
}
