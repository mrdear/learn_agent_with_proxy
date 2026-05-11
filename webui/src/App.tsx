import { useEffect, useSyncExternalStore } from "react";
import { AppShell } from "@/components/app-shell";
import { getRouteMeta, normalizeRoute, type RoutePath } from "@/lib/routes";
import { getStrategy } from "@/strategies";

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
  const strategy = getStrategy(pathname);

  useEffect(() => {
    document.title = `${currentRoute.label} · Learn Agent With Proxy`;
  }, [currentRoute.label]);

  return (
    <AppShell pathname={pathname} onNavigate={navigate}>
      {strategy.render(navigate)}
    </AppShell>
  );
}

export default App;
