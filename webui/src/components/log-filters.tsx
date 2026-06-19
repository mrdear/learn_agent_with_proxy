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
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
  const handleGroupGapChange = (value: number | readonly number[]) => {
    onGroupGapMinutesChange(Array.isArray(value) ? (value[0] ?? 1) : value);
  };

  return (
    <div className="grid shrink-0 grid-cols-1 gap-3 md:grid-cols-[160px_220px_minmax(280px,1fr)_190px_auto]">
      <Select
        value={provider || "all"}
        onValueChange={(v) => onProviderChange(v === "all" ? "" : (v ?? ""))}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t("All providers", "全部 Provider")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("All providers", "全部 Provider")}</SelectItem>
          <SelectItem value="openai">OpenAI</SelectItem>
          <SelectItem value="anthropic">Anthropic</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={model || "all"}
        onValueChange={(v) => onModelChange(v === "all" ? "" : (v ?? ""))}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t("All models", "全部模型")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("All models", "全部模型")}</SelectItem>
          {models.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        placeholder={t("Search prompts, models...", "搜索 prompt、模型...")}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full"
      />

      <div className="flex h-8 min-w-0 items-center gap-2 rounded-none border border-input bg-transparent px-2.5 dark:bg-input/30">
        <Label htmlFor="log-group-gap" className="shrink-0 text-xs text-muted-foreground">
          {t("Gap", "间隔")}
        </Label>
        <Slider
          id="log-group-gap"
          value={[groupGapMinutes]}
          min={1}
          max={30}
          step={1}
          className="min-w-16 flex-1"
          aria-label={t("Group gap in minutes", "按分钟设置分组间隔")}
          onValueChange={handleGroupGapChange}
        />
        <span className="w-8 shrink-0 text-right font-mono text-xs text-muted-foreground">
          {groupGapMinutes}m
        </span>
      </div>

      <Button
        variant="default"
        size="icon"
        className="shadow-sm"
        onClick={onRefresh}
        title={t("Refresh", "刷新")}
      >
        <ArrowsClockwise data-icon="inline-start" />
      </Button>
    </div>
  );
}
