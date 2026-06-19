import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  deleteModelMapping,
  fetchModelMappings,
  fetchProviderApiKey,
  fetchProviderConfigs,
  saveModelMapping,
  updateProviderSettings,
  type ModelMapping,
  type ModelMappingInput,
  type ProviderConfig,
  type ProviderName,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { ArrowsClockwise, Copy, Eye, EyeSlash, FloppyDisk, Key, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";

const PROVIDER_LABELS: Record<ProviderName, string> = {
  openai: "OpenAI Chat",
  "openai-responses": "OpenAI Responses",
  anthropic: "Anthropic Messages",
};

const PROVIDER_PATHS: Record<ProviderName, string> = {
  openai: "/v1/chat/completions",
  "openai-responses": "/v1/responses",
  anthropic: "/v1/messages",
};

type ProviderConfigDraft = ProviderConfig & {
  api_key: string;
  clear_api_key: boolean;
};

type MappingDraft = Omit<ModelMappingInput, "provider">;
type RevealedApiKeys = Partial<Record<ProviderName, string | null>>;

function emptyMappingDraft(): MappingDraft {
  return {
    source_model: "",
    target_model: "",
    enabled: true,
  };
}

function toDraft(config: ProviderConfig): ProviderConfigDraft {
  return {
    ...config,
    api_key: "",
    clear_api_key: false,
  };
}

async function copyText(
  value: string,
  successMessage: string,
  failureMessage: string
): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error(failureMessage);
  }
}

function AccessKeyPanel({
  draft,
  regenerating,
  onRegenerate,
}: {
  draft: ProviderConfigDraft;
  regenerating: boolean;
  onRegenerate: () => void;
}) {
  const { t } = useI18n();
  const accessKeyPlaceholder = t("Generated after save", "保存后生成");
  const copyAccessKeyLabel = t("Copy access key", "复制访问 key");
  const regenerateAccessKeyLabel = regenerating
    ? t("Regenerating access key", "正在重新生成访问 key")
    : t("Regenerate access key", "重新生成访问 key");

  return (
    <div className="grid min-w-0 gap-3 border border-primary/15 bg-primary/5 p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            <Key data-icon="inline-start" />
            {t("Proxy access", "代理访问")}
          </Badge>
          <Badge variant="outline" className="font-mono">
            {PROVIDER_PATHS[draft.provider]}
          </Badge>
        </div>
        <code
          className={cn(
            "truncate border border-border/70 bg-background px-2.5 py-2 font-mono text-xs",
            !draft.access_key && "text-muted-foreground"
          )}
        >
          {draft.access_key || accessKeyPlaceholder}
        </code>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          title={copyAccessKeyLabel}
          aria-label={copyAccessKeyLabel}
          disabled={!draft.access_key}
          onClick={() =>
            draft.access_key &&
            void copyText(
              draft.access_key,
              t("Access key copied", "访问 key 已复制"),
              t("Copy failed", "复制失败")
            )
          }
        >
          <Copy data-icon="inline-start" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          title={regenerateAccessKeyLabel}
          aria-label={regenerateAccessKeyLabel}
          disabled={regenerating}
          onClick={onRegenerate}
        >
          <ArrowsClockwise data-icon="inline-start" />
        </Button>
      </div>
    </div>
  );
}

function ProviderUpstreamForm({
  draft,
  replacingApiKey,
  saving,
  revealedApiKey,
  revealingApiKey,
  onChange,
  onReplaceApiKey,
  onCancelReplaceApiKey,
  onRevealApiKey,
  onHideApiKey,
  onSave,
}: {
  draft: ProviderConfigDraft;
  replacingApiKey: boolean;
  saving: boolean;
  revealedApiKey: string | null | undefined;
  revealingApiKey: boolean;
  onChange: (draft: ProviderConfigDraft) => void;
  onReplaceApiKey: () => void;
  onCancelReplaceApiKey: () => void;
  onRevealApiKey: () => Promise<boolean>;
  onHideApiKey: () => void;
  onSave: () => void;
}) {
  const { t } = useI18n();
  const editingApiKey = !draft.api_key_configured || replacingApiKey;
  const visibilityKey = `${draft.provider}:${editingApiKey ? "editing" : "saved"}`;
  const [visibleApiKeyFor, setVisibleApiKeyFor] = useState<string | null>(null);
  const showApiKey = visibleApiKeyFor === visibilityKey;
  const keyPlaceholder = draft.api_key_configured
    ? t("Paste replacement API key", "粘贴替换用 API key")
    : t("Paste upstream API key", "粘贴上游 API key");
  const revealApiKeyLabel = showApiKey
    ? t("Hide API key", "隐藏 API key")
    : t("Show API key", "查看 API key");

  const toggleApiKeyVisibility = async () => {
    if (showApiKey) {
      setVisibleApiKeyFor(null);
      if (!editingApiKey) {
        onHideApiKey();
      }
      return;
    }

    if (!editingApiKey) {
      const revealed = await onRevealApiKey();
      if (!revealed) {
        return;
      }
    }

    setVisibleApiKeyFor(visibilityKey);
  };

  return (
    <div className="flex flex-col gap-3 border border-border/70 bg-muted/30 p-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(260px,1fr)_minmax(180px,260px)]">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${draft.provider}-base-url`}>
            {t("Upstream endpoint", "上游 endpoint")}
          </Label>
          <Input
            id={`${draft.provider}-base-url`}
            value={draft.base_url}
            onChange={(event) => onChange({ ...draft, base_url: event.target.value })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${draft.provider}-default-model`}>
            {t("Default model", "默认模型")}
          </Label>
          <Input
            id={`${draft.provider}-default-model`}
            value={draft.default_model ?? ""}
            onChange={(event) =>
              onChange({ ...draft, default_model: event.target.value || null })
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${draft.provider}-api-key`}>
            {t("Upstream API key", "上游 API key")}
          </Label>
          {editingApiKey ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="grid grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  id={`${draft.provider}-api-key`}
                  type={showApiKey ? "text" : "password"}
                  value={draft.api_key}
                  placeholder={keyPlaceholder}
                  autoComplete="off"
                  className="border-r-0 font-mono"
                  onChange={(event) =>
                    onChange({ ...draft, api_key: event.target.value, clear_api_key: false })
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title={revealApiKeyLabel}
                  aria-label={revealApiKeyLabel}
                  aria-pressed={showApiKey}
                  onClick={() => void toggleApiKeyVisibility()}
                >
                  {showApiKey ? (
                    <EyeSlash data-icon="inline-start" />
                  ) : (
                    <Eye data-icon="inline-start" />
                  )}
                </Button>
              </div>
              {draft.api_key_configured && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancelReplaceApiKey}
                >
                  {t("Cancel", "取消")}
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="grid grid-cols-[minmax(0,1fr)_auto]">
                <code
                  className={cn(
                    "flex h-8 items-center truncate border border-border/70 bg-background px-2.5 font-mono text-xs",
                    showApiKey && "select-text"
                  )}
                >
                  {showApiKey ? (revealedApiKey ?? "") : (draft.api_key_hint ?? "************")}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title={revealingApiKey ? t("Loading API key", "正在读取 API key") : revealApiKeyLabel}
                  aria-label={revealingApiKey ? t("Loading API key", "正在读取 API key") : revealApiKeyLabel}
                  aria-pressed={showApiKey}
                  disabled={revealingApiKey}
                  onClick={() => void toggleApiKeyVisibility()}
                >
                  {showApiKey ? (
                    <EyeSlash data-icon="inline-start" />
                  ) : (
                    <Eye data-icon="inline-start" />
                  )}
                </Button>
              </div>
              <Button type="button" variant="outline" onClick={onReplaceApiKey}>
                {t("Replace", "替换")}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={onSave} disabled={saving}>
          <FloppyDisk data-icon="inline-start" />
          {t("Save upstream", "保存上游配置")}
        </Button>
      </div>
    </div>
  );
}

function MappingEditor({
  provider,
  draft,
  loading,
  saving,
  onChange,
  onSave,
}: {
  provider: ProviderName;
  draft: MappingDraft;
  loading: boolean;
  saving: boolean;
  onChange: (draft: MappingDraft) => void;
  onSave: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="grid min-w-0 gap-3 border border-border/70 p-3 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor={`${provider}-mapping-source`}>
            {t("Request model", "请求模型")}
          </Label>
          <Input
            id={`${provider}-mapping-source`}
            value={draft.source_model}
            placeholder="gpt-4.1-mini"
            className="font-mono"
            onChange={(event) => onChange({ ...draft, source_model: event.target.value })}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor={`${provider}-mapping-target`}>
            {t("Upstream model", "上游模型")}
          </Label>
          <Input
            id={`${provider}-mapping-target`}
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
          {t("Enabled", "已启用")}
        </label>
        <Button
          type="button"
          variant="outline"
          onClick={onSave}
          disabled={
            loading ||
            saving ||
            !draft.source_model.trim() ||
            !draft.target_model.trim()
          }
        >
          {t("Save mapping", "保存映射")}
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
  const { t } = useI18n();

  if (mappings.length === 0) {
    return (
      <div className="border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
        {t("No model mappings.", "没有模型映射。")}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {mappings.map((mapping) => (
        <div
          key={mapping.id}
          className="grid min-w-0 gap-3 border-t border-border/70 py-3 first:border-t-0 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
        >
          <div className="grid min-w-0 gap-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
            <code className="truncate font-mono text-xs">{mapping.source_model}</code>
            <span className="hidden text-xs text-muted-foreground md:inline">
              {t("to", "到")}
            </span>
            <code className="truncate font-mono text-xs text-muted-foreground">
              {mapping.target_model}
            </code>
          </div>
          <div className="flex items-center gap-1 lg:justify-end">
            <Badge variant={mapping.enabled ? "outline" : "destructive"}>
              {mapping.enabled ? t("Enabled", "已启用") : t("Disabled", "已禁用")}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onToggle(mapping)}
            >
              {mapping.enabled ? t("Disable", "禁用") : t("Enable", "启用")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title={t("Delete", "删除")}
              aria-label={t("Delete mapping", "删除模型映射")}
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

function ProviderPanel({
  draft,
  mappings,
  mappingDraft,
  loading,
  savingProvider,
  replacingApiKey,
  revealedApiKey,
  revealingApiKey,
  regeneratingAccessKey,
  savingMapping,
  onDraftChange,
  onSaveProvider,
  onReplaceApiKey,
  onCancelReplaceApiKey,
  onRevealApiKey,
  onHideApiKey,
  onRegenerateAccessKey,
  onMappingDraftChange,
  onSaveMapping,
  onToggleMapping,
  onDeleteMapping,
}: {
  draft: ProviderConfigDraft;
  mappings: ModelMapping[];
  mappingDraft: MappingDraft;
  loading: boolean;
  savingProvider: boolean;
  replacingApiKey: boolean;
  revealedApiKey: string | null | undefined;
  revealingApiKey: boolean;
  regeneratingAccessKey: boolean;
  savingMapping: boolean;
  onDraftChange: (draft: ProviderConfigDraft) => void;
  onSaveProvider: () => void;
  onReplaceApiKey: () => void;
  onCancelReplaceApiKey: () => void;
  onRevealApiKey: () => Promise<boolean>;
  onHideApiKey: () => void;
  onRegenerateAccessKey: () => void;
  onMappingDraftChange: (draft: MappingDraft) => void;
  onSaveMapping: () => void;
  onToggleMapping: (mapping: ModelMapping) => void;
  onDeleteMapping: (id: number) => void;
}) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader className="border-b border-border/70">
        <div className="min-w-0">
          <CardTitle>{PROVIDER_LABELS[draft.provider]}</CardTitle>
          <CardDescription className="font-mono">{draft.provider}</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <AccessKeyPanel
          draft={draft}
          regenerating={regeneratingAccessKey}
          onRegenerate={onRegenerateAccessKey}
        />
        <ProviderUpstreamForm
          draft={draft}
          replacingApiKey={replacingApiKey}
          saving={savingProvider}
          revealedApiKey={revealedApiKey}
          revealingApiKey={revealingApiKey}
          onChange={onDraftChange}
          onReplaceApiKey={onReplaceApiKey}
          onCancelReplaceApiKey={onCancelReplaceApiKey}
          onRevealApiKey={onRevealApiKey}
          onHideApiKey={onHideApiKey}
          onSave={onSaveProvider}
        />
        <details className="group overflow-hidden border border-border/70">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-muted/30 px-3 py-2 text-xs font-medium outline-none hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
            <span>{t("Optional model mappings", "可选模型映射")}</span>
            <Badge variant="outline">{mappings.length}</Badge>
          </summary>
          <div className="flex flex-col gap-3 border-t border-border/70 p-3">
            <MappingEditor
              provider={draft.provider}
              draft={mappingDraft}
              loading={loading}
              saving={savingMapping}
              onChange={onMappingDraftChange}
              onSave={onSaveMapping}
            />
            <MappingList
              mappings={mappings}
              onToggle={onToggleMapping}
              onDelete={onDeleteMapping}
            />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function createMappingDrafts(): Record<ProviderName, MappingDraft> {
  return {
    openai: emptyMappingDraft(),
    "openai-responses": emptyMappingDraft(),
    anthropic: emptyMappingDraft(),
  };
}

function sortMappings(mappings: ModelMapping[]): ModelMapping[] {
  return [...mappings].sort((left, right) =>
    `${left.provider}:${left.source_model}`.localeCompare(
      `${right.provider}:${right.source_model}`
    )
  );
}

export function SettingsPage() {
  const { t } = useI18n();
  const [providerDrafts, setProviderDrafts] = useState<ProviderConfigDraft[]>([]);
  const [mappings, setMappings] = useState<ModelMapping[]>([]);
  const [mappingDrafts, setMappingDrafts] = useState(createMappingDrafts);
  const [savingProvider, setSavingProvider] = useState<ProviderName | null>(null);
  const [regeneratingProvider, setRegeneratingProvider] = useState<ProviderName | null>(null);
  const [savingMapping, setSavingMapping] = useState<ProviderName | null>(null);
  const [replacingApiKeyProvider, setReplacingApiKeyProvider] = useState<ProviderName | null>(null);
  const [revealingApiKeyProvider, setRevealingApiKeyProvider] = useState<ProviderName | null>(null);
  const [revealedApiKeys, setRevealedApiKeys] = useState<RevealedApiKeys>({});
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [configs, modelMappings] = await Promise.all([
        fetchProviderConfigs(),
        fetchModelMappings(),
      ]);
      setProviderDrafts(configs.map(toDraft));
      setMappings(sortMappings(modelMappings));
      setRevealedApiKeys({});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to load settings", "设置加载失败"));
    } finally {
      setLoading(false);
    }
  }, [t]);

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

  const hideRevealedApiKey = (provider: ProviderName) => {
    setRevealedApiKeys((current) => {
      if (!(provider in current)) {
        return current;
      }

      const next = { ...current };
      delete next[provider];
      return next;
    });
  };

  const revealApiKey = async (provider: ProviderName): Promise<boolean> => {
    if (provider in revealedApiKeys) {
      return true;
    }

    setRevealingApiKeyProvider(provider);
    try {
      const { api_key } = await fetchProviderApiKey(provider);
      if (!api_key) {
        toast.error(t("No API key configured", "还没有配置 API key"));
        return false;
      }

      setRevealedApiKeys((current) => ({ ...current, [provider]: api_key }));
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to load API key", "API key 加载失败"));
      return false;
    } finally {
      setRevealingApiKeyProvider(null);
    }
  };

  const saveProvider = async (
    provider: ProviderName,
    options?: { regenerateAccessKey?: boolean }
  ) => {
    const draft = providerDraftByName.get(provider);
    if (!draft) {
      return;
    }

    if (options?.regenerateAccessKey) {
      setRegeneratingProvider(provider);
    } else {
      setSavingProvider(provider);
    }

    try {
      const updated = await updateProviderSettings(provider, {
        base_url: draft.base_url,
        api_key: draft.api_key || undefined,
        clear_api_key: draft.clear_api_key,
        default_model: draft.default_model,
        extra_headers: draft.extra_headers,
        enabled: draft.enabled,
        regenerate_access_key: options?.regenerateAccessKey,
      });
      updateDraft(toDraft(updated));
      hideRevealedApiKey(provider);
      setReplacingApiKeyProvider((current) => (current === provider ? null : current));
      toast.success(
        options?.regenerateAccessKey
          ? t("{provider} access key regenerated", "{provider} 访问 key 已重新生成", {
              provider: PROVIDER_LABELS[provider],
            })
          : t("{provider} saved", "{provider} 已保存", {
              provider: PROVIDER_LABELS[provider],
            })
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to save provider", "Provider 保存失败"));
    } finally {
      setSavingProvider(null);
      setRegeneratingProvider(null);
    }
  };

  const cancelApiKeyReplace = (provider: ProviderName) => {
    const draft = providerDraftByName.get(provider);
    if (draft) {
      updateDraft({ ...draft, api_key: "", clear_api_key: false });
    }
    hideRevealedApiKey(provider);
    setReplacingApiKeyProvider((current) => (current === provider ? null : current));
  };

  const saveMappingForProvider = async (provider: ProviderName) => {
    const draft = mappingDrafts[provider];
    setSavingMapping(provider);
    try {
      const saved = await saveModelMapping({
        provider,
        source_model: draft.source_model,
        target_model: draft.target_model,
        enabled: draft.enabled,
      });
      setMappings((current) =>
        sortMappings([
          ...current.filter((mapping) => mapping.id !== saved.id),
          saved,
        ])
      );
      setMappingDrafts((current) => ({
        ...current,
        [provider]: emptyMappingDraft(),
      }));
      toast.success(t("Mapping saved", "映射已保存"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to save mapping", "映射保存失败"));
    } finally {
      setSavingMapping(null);
    }
  };

  const removeMapping = async (id: number) => {
    try {
      await deleteModelMapping(id);
      setMappings((current) => current.filter((mapping) => mapping.id !== id));
      toast.success(t("Mapping deleted", "映射已删除"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to delete mapping", "映射删除失败"));
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
      toast.success(
        saved.enabled ? t("Mapping enabled", "映射已启用") : t("Mapping disabled", "映射已禁用")
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to update mapping", "映射更新失败"));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {providerDrafts.map((draft) => {
        const providerMappings = mappings.filter((mapping) => mapping.provider === draft.provider);

        return (
          <ProviderPanel
            key={draft.provider}
            draft={draft}
            mappings={providerMappings}
            mappingDraft={mappingDrafts[draft.provider]}
            loading={loading}
            savingProvider={savingProvider === draft.provider}
            replacingApiKey={replacingApiKeyProvider === draft.provider}
            revealedApiKey={revealedApiKeys[draft.provider]}
            revealingApiKey={revealingApiKeyProvider === draft.provider}
            regeneratingAccessKey={regeneratingProvider === draft.provider}
            savingMapping={savingMapping === draft.provider}
            onDraftChange={updateDraft}
            onSaveProvider={() => void saveProvider(draft.provider)}
            onReplaceApiKey={() => {
              hideRevealedApiKey(draft.provider);
              setReplacingApiKeyProvider(draft.provider);
            }}
            onCancelReplaceApiKey={() => cancelApiKeyReplace(draft.provider)}
            onRevealApiKey={() => revealApiKey(draft.provider)}
            onHideApiKey={() => hideRevealedApiKey(draft.provider)}
            onRegenerateAccessKey={() =>
              void saveProvider(draft.provider, { regenerateAccessKey: true })
            }
            onMappingDraftChange={(nextDraft) =>
              setMappingDrafts((current) => ({
                ...current,
                [draft.provider]: nextDraft,
              }))
            }
            onSaveMapping={() => void saveMappingForProvider(draft.provider)}
            onToggleMapping={(mapping) => void toggleMapping(mapping)}
            onDeleteMapping={(id) => void removeMapping(id)}
          />
        );
      })}
    </div>
  );
}
