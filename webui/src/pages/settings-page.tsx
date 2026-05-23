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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
                Key set
              </Badge>
            ) : null}
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
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[190px_minmax(180px,1fr)_minmax(180px,1fr)_auto]">
            <MappingProviderSelect
              value={mappingDraft.provider}
              onChange={(provider) => setMappingDraft({ ...mappingDraft, provider })}
            />
            <Input
              value={mappingDraft.source_model}
              placeholder="Request model"
              onChange={(event) =>
                setMappingDraft({ ...mappingDraft, source_model: event.target.value })
              }
            />
            <Input
              value={mappingDraft.target_model}
              placeholder="Upstream model"
              onChange={(event) =>
                setMappingDraft({ ...mappingDraft, target_model: event.target.value })
              }
            />
            <Button
              type="button"
              onClick={addMapping}
              disabled={
                loading ||
                savingMapping ||
                !mappingDraft.source_model.trim() ||
                !mappingDraft.target_model.trim()
              }
            >
              <Check data-icon="inline-start" />
              Add
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Request model</TableHead>
                <TableHead>Upstream model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((mapping) => (
                <TableRow key={mapping.id}>
                  <TableCell>{PROVIDER_LABELS[mapping.provider]}</TableCell>
                  <TableCell className="font-mono">{mapping.source_model}</TableCell>
                  <TableCell className="font-mono">{mapping.target_model}</TableCell>
                  <TableCell>
                    <Badge variant={mapping.enabled ? "secondary" : "outline"}>
                      {mapping.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="Delete"
                      aria-label="Delete mapping"
                      onClick={() => void removeMapping(mapping.id)}
                    >
                      <Trash data-icon="inline-start" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
