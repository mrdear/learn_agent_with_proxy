import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ArrowsClockwise } from "@phosphor-icons/react";

interface LogFiltersProps {
  provider: string;
  model: string;
  search: string;
  models: string[];
  groupGapMinutes: number;
  onProviderChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onGroupGapMinutesChange: (value: number) => void;
  onRefresh: () => void;
}

export function LogFilters({
  provider,
  model,
  search,
  models,
  groupGapMinutes,
  onProviderChange,
  onModelChange,
  onSearchChange,
  onGroupGapMinutesChange,
  onRefresh,
}: LogFiltersProps) {
  const handleGroupGapChange = (value: number | readonly number[]) => {
    onGroupGapMinutesChange(Array.isArray(value) ? (value[0] ?? 1) : value);
  };

  return (
    <div className="grid shrink-0 grid-cols-1 gap-3 md:grid-cols-[160px_220px_minmax(280px,1fr)_220px_auto]">
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

      <div className="flex min-w-0 flex-col justify-center gap-2 rounded-none border border-border bg-background px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="log-group-gap" className="text-xs">
            Group gap
          </Label>
          <span className="font-mono text-xs text-muted-foreground">
            {groupGapMinutes} min
          </span>
        </div>
        <Slider
          id="log-group-gap"
          value={[groupGapMinutes]}
          min={1}
          max={30}
          step={1}
          aria-label="Group gap in minutes"
          onValueChange={handleGroupGapChange}
        />
      </div>

      <Button variant="default" size="icon" className="shadow-sm" onClick={onRefresh} title="Refresh">
        <ArrowsClockwise data-icon="inline-start" />
      </Button>
    </div>
  );
}
