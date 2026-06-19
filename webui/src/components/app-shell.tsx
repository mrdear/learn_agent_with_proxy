import type { ReactNode } from "react";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { appRoutes, getRouteMeta, type RoutePath } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  Moon,
  Sun,
  Translate,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";

interface AppShellProps {
  pathname: RoutePath;
  onNavigate: (path: RoutePath) => void;
  children: ReactNode;
}

function RouteButton({
  active,
  label,
  icon: RouteIcon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: PhosphorIcon;
  onClick: () => void;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        type="button"
        isActive={active}
        tooltip={label}
        onClick={onClick}
      >
        <RouteIcon />
        <span className="group-data-[collapsible=icon]:hidden">{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useI18n();
  const isDark = resolvedTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";
  const label = isDark
    ? t("Switch to light mode", "切换到浅色模式")
    : t("Switch to dark mode", "切换到深色模式");
  const ThemeIcon = isDark ? Sun : Moon;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      title={label}
      aria-label={label}
      onClick={() => setTheme(nextTheme)}
    >
      <ThemeIcon data-icon="inline-start" />
    </Button>
  );
}

function LanguageToggle() {
  const { locale, t, toggleLocale } = useI18n();
  const nextLocaleLabel = locale === "zh-CN" ? "English" : "中文";
  const label = t("Switch language to {locale}", "切换语言为 {locale}", {
    locale: nextLocaleLabel,
  });

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      title={label}
      aria-label={label}
      onClick={toggleLocale}
    >
      <Translate data-icon="inline-start" />
      {locale === "zh-CN" ? "中文" : "EN"}
    </Button>
  );
}

export function AppShell({ pathname, onNavigate, children }: AppShellProps) {
  const currentRoute = getRouteMeta(pathname);
  const { formatText, t } = useI18n();
  const currentRouteLabel = formatText(currentRoute.label);
  const currentRouteDescription = formatText(currentRoute.description);

  return (
    <SidebarProvider defaultOpen className="bg-background text-foreground">
      <Sidebar side="left" collapsible="icon">
        <SidebarHeader className="px-4 pt-4">
          <div className="flex items-start gap-3 rounded-none border border-sidebar-border/70 bg-sidebar-accent/30 p-3 transition-all group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2">
            <div className="flex size-10 shrink-0 items-center justify-center border border-sidebar-border bg-sidebar">
              <img
                src="/favicon.svg"
                alt=""
                className="size-7"
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold tracking-tight">
                Learn Agent With Proxy
              </p>
              <p className="truncate text-xs text-sidebar-foreground/70">
                {t("Prompt capture dashboard", "Prompt 捕获看板")}
              </p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent className="px-2 py-3">
          <SidebarGroup className="gap-2">
            <SidebarGroupLabel>{t("Navigation", "导航")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {appRoutes.map((route) => {
                  const RouteIcon = route.icon;
                  const label = formatText(route.label);

                  return (
                    <RouteButton
                      key={route.path}
                      active={pathname === route.path}
                      label={label}
                      icon={RouteIcon}
                      onClick={() => onNavigate(route.path)}
                    />
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarSeparator />

        <SidebarFooter className="px-4 pb-4">
          <div className="flex flex-col gap-2 rounded-none border border-sidebar-border/70 bg-sidebar-accent/20 p-3 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="secondary" className="w-fit shadow-none">
                {t("Local proxy", "本地代理")}
              </Badge>
              <span className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/60">
                {t("Ready", "就绪")}
              </span>
            </div>
            <p className="text-xs text-sidebar-foreground/70">
              {t(
                "Route SDK traffic through the local proxy to inspect prompts, tokens, and streamed chunks.",
                "把 SDK 流量接到本地代理，用来查看 prompt、token 和流式分块。"
              )}
            </p>
            <div className="rounded-none border border-sidebar-border/70 bg-sidebar p-2 font-mono text-[11px] text-sidebar-foreground/80">
              http://localhost:3000
            </div>
          </div>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 overflow-x-hidden">
        <div className="flex min-h-svh min-w-0 flex-col">
          <header className="sticky top-0 z-10 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <SidebarTrigger className="shrink-0" />
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="shadow-sm">
                      {currentRouteLabel}
                    </Badge>
                    <p className="truncate text-sm font-medium tracking-tight">
                      {currentRouteDescription}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "Local dashboard for proxy capture and prompt inspection.",
                      "用于代理捕获和 prompt 检查的本地看板。"
                    )}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  variant="outline"
                  className="hidden font-mono text-[11px] md:inline-flex"
                >
                  http://localhost:3000
                </Badge>
                <LanguageToggle />
                <ThemeToggle />
              </div>
            </div>
          </header>

          <div
            className={cn(
              "min-w-0 flex-1 px-4 py-6 sm:px-6",
              pathname === "/logs" ? "lg:px-4 xl:px-6" : "lg:px-8"
            )}
          >
            <div
              className={cn(
                "mx-auto flex min-w-0 w-full flex-col gap-6",
                pathname === "/logs" ? "max-w-none" : "max-w-6xl"
              )}
            >
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
