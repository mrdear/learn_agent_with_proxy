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
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={provider || "all"}
        onValueChange={(v) => onProviderChange(v === "all" ? "" : (v ?? ""))}
      >
        <SelectTrigger className="w-[160px]">
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
        <SelectTrigger className="w-[200px]">
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
        className="w-[280px]"
      />

      <Button variant="default" size="icon" className="shadow-sm" onClick={onRefresh} title="Refresh">
        <ArrowsClockwise className="h-4 w-4" />
      </Button>
    </div>
  );
}
