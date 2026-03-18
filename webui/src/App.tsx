import { useState, useEffect, useCallback } from "react";
import { fetchLogs, fetchModels, type LogEntry, type LogListResponse } from "@/lib/api";
import { LogTable } from "@/components/log-table";
import { LogDetail } from "@/components/log-detail";
import { LogFilters } from "@/components/log-filters";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

function App() {
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
    } catch (err) {
      console.error("Failed to fetch logs:", err);
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Agent Proxy Logs</h1>
            <p className="text-sm text-muted-foreground">
              Intercept and analyze AI agent requests
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            {total} records
          </div>
        </div>
      </header>

      <main className="p-6 space-y-4">
        <LogFilters
          provider={provider}
          model={model}
          search={search}
          models={models}
          onProviderChange={(v) => { setProvider(v); setPage(1); }}
          onModelChange={(v) => { setModel(v); setPage(1); }}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
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
      </main>

      <Sheet open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
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

export default App;
