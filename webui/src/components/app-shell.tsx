import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { appRoutes, type RoutePath } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface AppShellProps {
  pathname: RoutePath;
  onNavigate: (path: RoutePath) => void;
  children: ReactNode;
}

function RouteButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "secondary"}
      className={cn(active && "shadow-sm")}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

export function AppShell({ pathname, onNavigate, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center border border-border bg-primary/5 text-xs font-semibold tracking-[0.3em]">
              AP
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-sm font-semibold tracking-tight">
                  Learn Agent With Proxy
                </h1>
                <Badge variant="secondary">Local guide</Badge>
              </div>
              <p className="max-w-2xl text-xs text-muted-foreground">
                Route AI SDK traffic through a local proxy, capture prompts, and
                inspect the recorded requests and responses.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {appRoutes.map((route) => (
              <RouteButton
                key={route.path}
                active={pathname === route.path}
                label={route.label}
                onClick={() => onNavigate(route.path)}
              />
            ))}
            <Badge variant="default" className="font-mono text-[11px] shadow-sm">
              http://localhost:3000
            </Badge>
          </div>
        </div>
        <Separator />
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
