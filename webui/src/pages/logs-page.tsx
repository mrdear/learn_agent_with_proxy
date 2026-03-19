import { useCallback, useEffect, useState } from "react";
import { type LogEntry, fetchLogs, fetchModels, type LogListResponse } from "@/lib/api";
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

export function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [provider, setProvider] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [models, setModels] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-1">
              <Badge variant="outline" className="w-fit">
                Captured traffic
              </Badge>
              <CardTitle className="text-2xl">Request log explorer</CardTitle>
              <CardDescription>
                Inspect prompts, parameters, token counts, and streamed response chunks.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">
              {total} records
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
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

          <LogTable
            logs={logs}
            loading={loading}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            onSelect={setSelectedLog}
          />
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
          {selectedLog && <LogDetail log={selectedLog} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
