import { useEffect, useSyncExternalStore } from "react";
import { AppShell } from "@/components/app-shell";
import { ComparePage } from "@/pages/compare-page";
import { DashboardPage } from "@/pages/dashboard-page";
import { LogsPage } from "@/pages/logs-page";
import { SettingsPage } from "@/pages/settings-page";
import { getRouteMeta, normalizeRoute, type RoutePath } from "@/lib/routes";
import { useI18n } from "@/lib/i18n";

function useRouteState() {
  const pathname = useSyncExternalStore<RoutePath>(
    (onStoreChange) => {
      window.addEventListener("popstate", onStoreChange);
      window.addEventListener("locationchange", onStoreChange);
      return () => {
        window.removeEventListener("popstate", onStoreChange);
        window.removeEventListener("locationchange", onStoreChange);
      };
    },
    () => normalizeRoute(window.location.pathname),
    () => "/"
  );

  useEffect(() => {
    const normalized = normalizeRoute(window.location.pathname);
    if (normalized !== window.location.pathname) {
      window.history.replaceState({}, "", normalized);
      window.dispatchEvent(new Event("locationchange"));
    }
  }, []);

  const navigate = (to: RoutePath) => {
    if (to === normalizeRoute(window.location.pathname)) {
      return;
    }

    window.history.pushState({}, "", to);
    window.dispatchEvent(new Event("locationchange"));
  };

  return { pathname, navigate };
}

function App() {
  const { pathname, navigate } = useRouteState();
  const currentRoute = getRouteMeta(pathname);
  const { formatText } = useI18n();
  const currentRouteLabel = formatText(currentRoute.label);

  useEffect(() => {
    document.title = `${currentRouteLabel} · Learn Agent With Proxy`;
  }, [currentRouteLabel]);

  return (
    <AppShell pathname={pathname} onNavigate={navigate}>
      {pathname === "/logs" ? (
        <LogsPage onNavigate={navigate} />
      ) : pathname === "/compare" ? (
        <ComparePage onNavigate={navigate} />
      ) : pathname === "/settings" ? (
        <SettingsPage />
      ) : (
        <DashboardPage onNavigate={navigate} />
      )}
    </AppShell>
  );
}

export default App;
