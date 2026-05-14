import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowsClockwise } from "@phosphor-icons/react";

interface LogFiltersProps {
  provider: string;
  model: string;
  search: string;
  models: string[];
  onProviderChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
}

export function LogFilters({
  provider,
  model,
  search,
  models,
  onProviderChange,
  onModelChange,
  onSearchChange,
  onRefresh,
}: LogFiltersProps) {
  return (
    <div className="grid shrink-0 grid-cols-1 gap-3 md:grid-cols-[160px_220px_minmax(280px,1fr)_auto]">
      <Select
        value={provider || "all"}
        onValueChange={(v) => onProviderChange(v === "all" ? "" : (v ?? ""))}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="All Providers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Providers</SelectItem>
          <SelectItem value="openai">OpenAI</SelectItem>
          <SelectItem value="anthropic">Anthropic</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={model || "all"}
        onValueChange={(v) => onModelChange(v === "all" ? "" : (v ?? ""))}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="All Models" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Models</SelectItem>
          {models.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        placeholder="Search prompts, models..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full"
      />

      <Button variant="default" size="icon" className="shadow-sm" onClick={onRefresh} title="Refresh">
        <ArrowsClockwise data-icon="inline-start" />
      </Button>
    </div>
  );
}
