import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type LogEntry,
  type LogListEntry,
  fetchLogById,
  fetchLogs,
  fetchModels,
  deleteLogs,
  type LogListResponse,
} from "@/lib/api";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { saveCompareSelection } from "@/lib/compare-selection";
import type { RoutePath } from "@/lib/routes";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

const DEFAULT_GROUP_GAP_MINUTES = 3;
const MINUTE_MS = 60 * 1000;
const LOG_FILTER_STORAGE_KEY = "learn-agent-log-filters";

type StoredLogFilters = {
  provider?: string;
  model?: string;
  search?: string;
  groupGapMinutes?: number;
};

function readStoredFilters(): StoredLogFilters {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(LOG_FILTER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredLogFilters;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function LogsPage({
  onNavigate,
}: {
  onNavigate: (path: RoutePath) => void;
}) {
  const storedFilters = useMemo(readStoredFilters, []);
  const [logs, setLogs] = useState<LogListEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [provider, setProvider] = useState<string>(storedFilters.provider ?? "");
  const [model, setModel] = useState<string>(storedFilters.model ?? "");
  const [search, setSearch] = useState<string>(storedFilters.search ?? "");
  const [models, setModels] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [viewedId, setViewedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [groupGapMinutes, setGroupGapMinutes] = useState(
    storedFilters.groupGapMinutes ?? DEFAULT_GROUP_GAP_MINUTES
  );
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

  const selectedLogIndex = useMemo(() => {
    if (selectedLogId === null) return -1;
    return logs.findIndex((log) => log.id === selectedLogId);
  }, [logs, selectedLogId]);
  const previousLog = selectedLogIndex > 0 ? logs[selectedLogIndex - 1] : null;
  const nextLog =
    selectedLogIndex >= 0 && selectedLogIndex < logs.length - 1
      ? logs[selectedLogIndex + 1]
      : null;

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
    if (selectedLogId === null) {
      setSelectedLog(null);
      setDetailLoading(false);
      setDetailError(null);
      return;
    }

    let active = true;
    setSelectedLog(null);
    setDetailError(null);
    setDetailLoading(true);

    fetchLogById(selectedLogId)
      .then((log) => {
        if (!active) return;
        setSelectedLog(log);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "详情加载失败";
        if (!active) return;
        setDetailError(message);
        toast.error(message);
      })
      .finally(() => {
        if (active) {
          setDetailLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedLogId]);

  useEffect(() => {
    fetchModels().then(setModels).catch(console.error);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      LOG_FILTER_STORAGE_KEY,
      JSON.stringify({ provider, model, search, groupGapMinutes })
    );
  }, [groupGapMinutes, model, provider, search]);

  const totalPages = Math.ceil(total / pageSize);

  const handleToggleSelect = useCallback((log: LogListEntry, checked: boolean) => {
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

  const handleDeleteLogs = useCallback(async () => {
    const idsToDelete = selectedIds.length > 0 ? selectedIds : undefined;
    const deletingSelected = Boolean(idsToDelete);
    const confirmMessage = deletingSelected
      ? `确认删除选中的 ${selectedIds.length} 条日志？此操作不可恢复。`
      : "确认清除所有日志？此操作不可恢复。";

    if (!confirm(confirmMessage)) return;

    try {
      const { deleted } = await deleteLogs(idsToDelete);
      toast.success(deletingSelected ? `已删除 ${deleted} 条选中日志` : `已清除 ${deleted} 条日志`);

      const deletedIds = new Set(idsToDelete ?? []);
      const remainingLogsOnPage = idsToDelete
        ? logs.filter((log) => !deletedIds.has(log.id)).length
        : 0;

      setSelectedIds([]);

      if (!idsToDelete || (selectedLogId !== null && deletedIds.has(selectedLogId))) {
        setViewedId(null);
        setSelectedLogId(null);
        setSelectedLog(null);
      }

      if (!idsToDelete) {
        if (page === 1) {
          void loadLogs();
        } else {
          setPage(1);
        }
        return;
      }

      if (remainingLogsOnPage === 0 && page > 1) {
        setPage((currentPage) => Math.max(1, currentPage - 1));
        return;
      }

      void loadLogs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  }, [loadLogs, logs, page, selectedIds, selectedLogId]);

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
                onClick={() => void handleDeleteLogs()}
              >
                {selectedIds.length > 0 ? "Delete selected" : "Clear all"}
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
            groupGapMinutes={groupGapMinutes}
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
            onGroupGapMinutesChange={setGroupGapMinutes}
            onRefresh={loadLogs}
          />

          <div className="min-h-0 min-w-0 flex-1">
            <LogTable
              logs={logs}
              loading={loading}
              page={page}
              totalPages={totalPages}
              selectedIds={selectedIds}
              groupGapMs={groupGapMinutes * MINUTE_MS}
              onPageChange={setPage}
              onToggleSelect={handleToggleSelect}
              viewedId={viewedId}
              onSelect={(log) => {
                setSelectedLogId(log.id);
                setViewedId(log.id);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Sheet
        open={selectedLogId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedLogId(null);
            setSelectedLog(null);
            setDetailError(null);
          }
        }}
      >
        <SheetContent className="sm:max-w-5xl overflow-y-auto">
          <SheetHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SheetTitle>Request Detail #{selectedLogId ?? "--"}</SheetTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!previousLog}
                  onClick={() => {
                    if (!previousLog) return;
                    setSelectedLogId(previousLog.id);
                    setViewedId(previousLog.id);
                  }}
                >
                  <CaretLeft data-icon="inline-start" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!nextLog}
                  onClick={() => {
                    if (!nextLog) return;
                    setSelectedLogId(nextLog.id);
                    setViewedId(nextLog.id);
                  }}
                >
                  Next
                  <CaretRight data-icon="inline-end" />
                </Button>
              </div>
            </div>
          </SheetHeader>
          {detailLoading ? (
            <div className="flex flex-col gap-3 p-4">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : detailError ? (
            <div className="p-4 text-sm text-destructive">{detailError}</div>
          ) : selectedLog ? (
            <LogDetail
              log={selectedLog}
              onReplayComplete={(replayed) => {
                setSelectedLogId(replayed.id);
                setSelectedLog(replayed);
                void loadLogs();
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
