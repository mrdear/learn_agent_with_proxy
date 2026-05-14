import { useCallback, useEffect, useMemo, useState } from "react";
import { type LogEntry, fetchLogs, fetchModels, clearAllLogs, type LogListResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LogTable } from "@/components/log-table";
import { LogDetail } from "@/components/log-detail";
import { LogFilters } from "@/components/log-filters";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { saveCompareSelection } from "@/lib/compare-selection";
import type { RoutePath } from "@/lib/routes";

export function LogsPage({
  onNavigate,
}: {
  onNavigate: (path: RoutePath) => void;
}) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [provider, setProvider] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [models, setModels] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [viewedId, setViewedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const compareEnabled = selectedIds.length === 2;
  const selectedLabel = useMemo(() => {
    if (selectedIds.length === 0) return "Select two logs to compare";
    if (selectedIds.length === 1) return "Select one more log to compare";
    if (selectedIds.length === 2) {
      return `Ready to compare #${selectedIds[0]} and #${selectedIds[1]}`;
    }

    return `Selected ${selectedIds.length} logs. Keep only two to compare.`;
  }, [selectedIds]);

  const loadLogs = useCallback(async () => {
    setLoading(true);

    try {
      const res: LogListResponse = await fetchLogs({
        page,
        pageSize,
        provider: provider || undefined,
        model: model || undefined,
        search: search || undefined,
      });
      setLogs(res.data);
      setTotal(res.total);
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, provider, model, search]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    fetchModels().then(setModels).catch(console.error);
  }, []);

  const totalPages = Math.ceil(total / pageSize);

  const handleToggleSelect = useCallback((log: LogEntry, checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) {
        if (current.includes(log.id)) {
          return current;
        }
        return [...current, log.id];
      }

      return current.filter((id) => id !== log.id);
    });
  }, []);

  const handleCompare = useCallback(() => {
    if (!compareEnabled) return;

    saveCompareSelection([selectedIds[0], selectedIds[1]]);
    onNavigate("/compare");
  }, [compareEnabled, onNavigate, selectedIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  return (
    <div className="flex min-h-[calc(100svh-7rem)] flex-col gap-4">
      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardHeader className="shrink-0 border-b border-border/70">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-col gap-1">
              <Badge variant="default" className="w-fit shadow-sm">
                Captured traffic
              </Badge>
              <CardTitle className="text-2xl">Request log explorer</CardTitle>
              <CardDescription>
                Inspect prompts, parameters, token counts, and streamed response chunks.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default" className="w-fit shadow-sm">
                {total} records
              </Badge>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={async () => {
                  if (!confirm("确认清除所有日志？此操作不可恢复。")) return;
                  try {
                    const { deleted } = await clearAllLogs();
                    toast.success(`已清除 ${deleted} 条日志`);
                    setSelectedIds([]);
                    setViewedId(null);
                    setSelectedLog(null);
                    void loadLogs();
                  } catch {
                    toast.error("清除失败");
                  }
                }}
              >
                Clear all
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 pt-4">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-none border border-primary/15 bg-primary/5 px-3 py-2">
            <div className="flex flex-col gap-1">
              <Badge
                variant={compareEnabled ? "default" : "secondary"}
                className="w-fit shadow-sm"
              >
                {selectedIds.length} selected
              </Badge>
              <p className="text-xs text-muted-foreground">{selectedLabel}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedIds.length > 0 && (
                <Button type="button" variant="outline" size="sm" onClick={clearSelection}>
                  Clear selection
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                disabled={!compareEnabled}
                className="shadow-sm"
                onClick={handleCompare}
              >
                Compare selected
              </Button>
            </div>
          </div>

          <LogFilters
            provider={provider}
            model={model}
            search={search}
            models={models}
            onProviderChange={(value) => {
              setProvider(value);
              setPage(1);
            }}
            onModelChange={(value) => {
              setModel(value);
              setPage(1);
            }}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            onRefresh={loadLogs}
          />

          <div className="min-h-0 flex-1">
            <LogTable
              logs={logs}
              loading={loading}
              page={page}
              totalPages={totalPages}
              selectedIds={selectedIds}
              onPageChange={setPage}
              onToggleSelect={handleToggleSelect}
              viewedId={viewedId}
              onSelect={(log) => {
                setSelectedLog(log);
                setViewedId(log.id);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Sheet
        open={!!selectedLog}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      >
        <SheetContent className="sm:max-w-5xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Request Detail #{selectedLog?.id}</SheetTitle>
          </SheetHeader>
          {selectedLog && (
            <LogDetail
              log={selectedLog}
              onReplayComplete={(replayed) => {
                setSelectedLog(replayed);
                void loadLogs();
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
