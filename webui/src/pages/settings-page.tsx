import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteModelMapping,
  fetchModelMappings,
  fetchProviderConfigs,
  saveModelMapping,
  updateProviderSettings,
  type ModelMapping,
  type ModelMappingInput,
  type ProviderConfig,
  type ProviderName,
} from "@/lib/api";
import { Check, FloppyDisk, Key, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";

const PROVIDER_LABELS: Record<ProviderName, string> = {
  openai: "OpenAI",
  "openai-responses": "OpenAI Responses",
  anthropic: "Anthropic",
};

type ProviderConfigDraft = ProviderConfig & {
  api_key: string;
  clear_api_key: boolean;
};

const emptyMapping: ModelMappingInput = {
  provider: "openai",
  source_model: "",
  target_model: "",
  enabled: true,
};

function toDraft(config: ProviderConfig): ProviderConfigDraft {
  return {
    ...config,
    api_key: "",
    clear_api_key: false,
  };
}

function ProviderCard({
  draft,
  saving,
  onChange,
  onSave,
}: {
  draft: ProviderConfigDraft;
  saving: boolean;
  onChange: (draft: ProviderConfigDraft) => void;
  onSave: () => void;
}) {
  const keyState = draft.clear_api_key
    ? "Will clear"
    : draft.api_key
      ? draft.api_key_configured
        ? "Will replace"
        : "Will set"
      : draft.api_key_configured
        ? "Key set"
        : "No key";

  return (
    <Card>
      <CardHeader className="border-b border-border/70">
        <div className="flex min-w-0 flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle>{PROVIDER_LABELS[draft.provider]}</CardTitle>
            <CardDescription className="font-mono">{draft.provider}</CardDescription>
          </div>
          <CardAction className="flex items-center gap-2">
            <Badge variant={draft.enabled ? "secondary" : "outline"}>
              {draft.enabled ? "Enabled" : "Disabled"}
            </Badge>
            {draft.api_key_configured ? (
              <Badge variant="outline">
                <Key data-icon="inline-start" />
                {keyState}
              </Badge>
            ) : (
              <Badge variant="outline">{keyState}</Badge>
            )}
          </CardAction>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(260px,1fr)_minmax(180px,260px)]">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${draft.provider}-base-url`}>Endpoint</Label>
            <Input
              id={`${draft.provider}-base-url`}
              value={draft.base_url}
              onChange={(event) =>
                onChange({ ...draft, base_url: event.target.value })
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${draft.provider}-default-model`}>Default model</Label>
            <Input
              id={`${draft.provider}-default-model`}
              value={draft.default_model ?? ""}
              onChange={(event) =>
                onChange({ ...draft, default_model: event.target.value || null })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(220px,1fr)_auto_auto]">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${draft.provider}-api-key`}>API key</Label>
            <Input
              id={`${draft.provider}-api-key`}
              type="password"
              value={draft.api_key}
              placeholder={draft.api_key_configured ? "Configured" : ""}
              onChange={(event) =>
                onChange({ ...draft, api_key: event.target.value, clear_api_key: false })
              }
            />
          </div>

          <label className="flex h-8 items-center gap-2 self-end text-xs">
            <Checkbox
              checked={draft.enabled}
              onCheckedChange={(checked) =>
                onChange({ ...draft, enabled: checked === true })
              }
            />
            Enabled
          </label>

          <label className="flex h-8 items-center gap-2 self-end text-xs">
            <Checkbox
              checked={draft.clear_api_key}
              onCheckedChange={(checked) =>
                onChange({ ...draft, clear_api_key: checked === true, api_key: "" })
              }
            />
            Clear key
          </label>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={onSave} disabled={saving}>
            <FloppyDisk data-icon="inline-start" />
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MappingProviderSelect({
  value,
  onChange,
}: {
  value: ProviderName;
  onChange: (value: ProviderName) => void;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as ProviderName)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(PROVIDER_LABELS) as ProviderName[]).map((provider) => (
          <SelectItem key={provider} value={provider}>
            {PROVIDER_LABELS[provider]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MappingConfigurator({
  draft,
  loading,
  saving,
  onChange,
  onSave,
}: {
  draft: ModelMappingInput;
  loading: boolean;
  saving: boolean;
  onChange: (draft: ModelMappingInput) => void;
  onSave: () => void;
}) {
  return (
    <div className="grid min-w-0 gap-4 border border-primary/15 bg-primary/5 p-3 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-col gap-2">
        <Label>Provider</Label>
        <MappingProviderSelect
          value={draft.provider}
          onChange={(provider) => onChange({ ...draft, provider })}
        />
      </div>

      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="mapping-source-model">Request model</Label>
          <Input
            id="mapping-source-model"
            value={draft.source_model}
            placeholder="gpt-4.1-mini"
            className="font-mono"
            onChange={(event) => onChange({ ...draft, source_model: event.target.value })}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="mapping-target-model">Upstream model</Label>
          <Input
            id="mapping-target-model"
            value={draft.target_model}
            placeholder="openai/gpt-4.1-mini"
            className="font-mono"
            onChange={(event) => onChange({ ...draft, target_model: event.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 lg:flex-col lg:items-stretch lg:justify-end">
        <label className="flex h-8 items-center gap-2 text-xs">
          <Checkbox
            checked={draft.enabled}
            onCheckedChange={(checked) => onChange({ ...draft, enabled: checked === true })}
          />
          Enabled
        </label>
        <Button
          type="button"
          onClick={onSave}
          disabled={
            loading ||
            saving ||
            !draft.source_model.trim() ||
            !draft.target_model.trim()
          }
        >
          <Check data-icon="inline-start" />
          Save mapping
        </Button>
      </div>
    </div>
  );
}

function MappingList({
  mappings,
  onToggle,
  onDelete,
}: {
  mappings: ModelMapping[];
  onToggle: (mapping: ModelMapping) => void;
  onDelete: (id: number) => void;
}) {
  if (mappings.length === 0) {
    return (
      <div className="border border-dashed border-border/80 p-6 text-sm text-muted-foreground">
        还没有模型映射。保存上面的配置后，会出现在这里。
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {mappings.map((mapping) => (
        <div
          key={mapping.id}
          className="grid min-w-0 gap-3 border-t border-border/70 py-3 first:border-t-0 first:pt-0 last:pb-0 lg:grid-cols-[180px_minmax(0,1fr)_auto] lg:items-center"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{PROVIDER_LABELS[mapping.provider]}</Badge>
            <Badge variant={mapping.enabled ? "outline" : "destructive"}>
              {mapping.enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <div className="grid min-w-0 gap-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
            <code className="truncate font-mono text-xs">{mapping.source_model}</code>
            <span className="hidden text-xs text-muted-foreground md:inline">to</span>
            <code className="truncate font-mono text-xs text-muted-foreground">
              {mapping.target_model}
            </code>
          </div>
          <div className="flex items-center gap-1 lg:justify-end">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onToggle(mapping)}
            >
              {mapping.enabled ? "Disable" : "Enable"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="Delete"
              aria-label="Delete mapping"
              onClick={() => onDelete(mapping.id)}
            >
              <Trash data-icon="inline-start" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SettingsPage() {
  const [providerDrafts, setProviderDrafts] = useState<ProviderConfigDraft[]>([]);
  const [mappings, setMappings] = useState<ModelMapping[]>([]);
  const [mappingDraft, setMappingDraft] = useState<ModelMappingInput>(emptyMapping);
  const [savingProvider, setSavingProvider] = useState<ProviderName | null>(null);
  const [savingMapping, setSavingMapping] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [configs, modelMappings] = await Promise.all([
        fetchProviderConfigs(),
        fetchModelMappings(),
      ]);
      setProviderDrafts(configs.map(toDraft));
      setMappings(modelMappings);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const providerDraftByName = useMemo(
    () => new Map(providerDrafts.map((draft) => [draft.provider, draft])),
    [providerDrafts]
  );

  const updateDraft = (nextDraft: ProviderConfigDraft) => {
    setProviderDrafts((drafts) =>
      drafts.map((draft) =>
        draft.provider === nextDraft.provider ? nextDraft : draft
      )
    );
  };

  const saveProvider = async (provider: ProviderName) => {
    const draft = providerDraftByName.get(provider);
    if (!draft) {
      return;
    }

    setSavingProvider(provider);
    try {
      const updated = await updateProviderSettings(provider, {
        base_url: draft.base_url,
        api_key: draft.api_key || undefined,
        clear_api_key: draft.clear_api_key,
        default_model: draft.default_model,
        extra_headers: draft.extra_headers,
        enabled: draft.enabled,
      });
      updateDraft(toDraft(updated));
      toast.success(`${PROVIDER_LABELS[provider]} saved`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save provider");
    } finally {
      setSavingProvider(null);
    }
  };

  const addMapping = async () => {
    setSavingMapping(true);
    try {
      const saved = await saveModelMapping(mappingDraft);
      setMappings((current) => {
        const withoutExisting = current.filter((mapping) => mapping.id !== saved.id);
        return [...withoutExisting, saved].sort((left, right) =>
          `${left.provider}:${left.source_model}`.localeCompare(
            `${right.provider}:${right.source_model}`
          )
        );
      });
      setMappingDraft(emptyMapping);
      toast.success("Mapping saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save mapping");
    } finally {
      setSavingMapping(false);
    }
  };

  const removeMapping = async (id: number) => {
    try {
      await deleteModelMapping(id);
      setMappings((current) => current.filter((mapping) => mapping.id !== id));
      toast.success("Mapping deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete mapping");
    }
  };

  const toggleMapping = async (mapping: ModelMapping) => {
    try {
      const saved = await saveModelMapping(
        {
          provider: mapping.provider,
          source_model: mapping.source_model,
          target_model: mapping.target_model,
          enabled: mapping.enabled !== 1,
        },
        mapping.id
      );
      setMappings((current) =>
        current.map((item) => (item.id === saved.id ? saved : item))
      );
      toast.success(saved.enabled ? "Mapping enabled" : "Mapping disabled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update mapping");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {providerDrafts.map((draft) => (
          <ProviderCard
            key={draft.provider}
            draft={draft}
            saving={savingProvider === draft.provider}
            onChange={updateDraft}
            onSave={() => void saveProvider(draft.provider)}
          />
        ))}
      </div>

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex min-w-0 flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle>Model mappings</CardTitle>
              <CardDescription>Request model to upstream model</CardDescription>
            </div>
            <CardAction>
              <Badge variant="secondary">{mappings.length}</Badge>
            </CardAction>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <MappingConfigurator
            draft={mappingDraft}
            loading={loading}
            saving={savingMapping}
            onChange={setMappingDraft}
            onSave={() => void addMapping()}
          />
          <MappingList
            mappings={mappings}
            onToggle={(mapping) => void toggleMapping(mapping)}
            onDelete={(id) => void removeMapping(id)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
