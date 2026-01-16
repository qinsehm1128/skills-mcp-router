import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";
import { Switch } from "@mcp_router/ui";
import { Input } from "@mcp_router/ui";
import { Textarea } from "@mcp_router/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@mcp_router/ui";
import {
  IconPlus,
  IconTrash,
  IconRefresh,
  IconFolder,
  IconFileDescription,
  IconCode,
  IconEye,
} from "@tabler/icons-react";
import type { SkillsConfig, SkillsOutputPath } from "@mcp_router/shared";
import {
  DEFAULT_SKILLS_CONFIG,
  DEFAULT_SKILL_TEMPLATE,
} from "@mcp_router/shared";

const SkillsPage: React.FC = () => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<SkillsConfig>(DEFAULT_SKILLS_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [template, setTemplate] = useState(DEFAULT_SKILL_TEMPLATE);
  const [templatePreview, setTemplatePreview] = useState("");

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    // 生成预览
    generatePreview();
  }, [template]);

  const loadConfig = async () => {
    try {
      const savedConfig = await window.electronAPI.getSkillsConfig();
      if (savedConfig) {
        setConfig(savedConfig);
        if (savedConfig.customTemplate) {
          setTemplate(savedConfig.customTemplate);
        }
        if (savedConfig.updatedAt) {
          setLastSyncTime(savedConfig.updatedAt);
        }
      }
    } catch (error) {
      console.error("Failed to load skills config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePreview = () => {
    // 简单预览，替换占位符为示例值
    let preview = template;
    preview = preview.replace(
      /\{\{description\}\}/g,
      "Collection of 3 MCP servers with 15 tools for AI assistance.",
    );
    preview = preview.replace(/\{\{generatedAt\}\}/g, new Date().toISOString());
    preview = preview.replace(/\{\{version\}\}/g, "1.0.0");
    preview = preview.replace(/\{\{serverCount\}\}/g, "3");
    preview = preview.replace(
      /\{\{servers\}\}/g,
      `## filesystem

File system operations for reading and writing files.

- **Tools**: 5

## github

GitHub integration for repository management.

- **Tools**: 8

## database

Database operations and queries.

- **Tools**: 2
`,
    );
    setTemplatePreview(preview);
  };

  const saveConfig = async (newConfig: SkillsConfig) => {
    setIsSaving(true);
    try {
      await window.electronAPI.saveSkillsConfig(newConfig);
      setConfig(newConfig);
    } catch (error) {
      console.error("Failed to save skills config:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnabledToggle = (checked: boolean) => {
    saveConfig({ ...config, enabled: checked });
  };

  const handleAutoSyncToggle = (checked: boolean) => {
    saveConfig({ ...config, autoSync: checked });
  };

  const handleTemplateChange = (newTemplate: string) => {
    setTemplate(newTemplate);
  };

  const handleTemplateSave = () => {
    saveConfig({ ...config, customTemplate: template });
  };

  const handleTemplateReset = () => {
    setTemplate(DEFAULT_SKILL_TEMPLATE);
    saveConfig({ ...config, customTemplate: undefined });
  };

  const handleAddPresetPath = async (type: "cursor" | "cline" | "windsurf") => {
    try {
      const preset = await window.electronAPI.getSkillsPresetPath(type);
      if (preset) {
        const exists = config.outputPaths.some((p) => p.path === preset.path);
        if (!exists) {
          const result = await window.electronAPI.addSkillsOutputPath(preset);
          if (result) {
            setConfig(result);
          }
        }
      }
    } catch (error) {
      console.error("Failed to add preset path:", error);
    }
  };

  const handleAddCustomPath = async () => {
    if (!newPath.trim()) return;

    const outputPath: SkillsOutputPath = {
      id: `custom-${Date.now()}`,
      path: newPath.trim(),
      type: "custom",
      enabled: true,
    };

    try {
      const result = await window.electronAPI.addSkillsOutputPath(outputPath);
      if (result) {
        setConfig(result);
        setNewPath("");
      }
    } catch (error) {
      console.error("Failed to add custom path:", error);
    }
  };

  const handleRemovePath = async (id: string) => {
    try {
      const result = await window.electronAPI.removeSkillsOutputPath(id);
      if (result) {
        setConfig(result);
      }
    } catch (error) {
      console.error("Failed to remove path:", error);
    }
  };

  const handleTogglePath = async (id: string) => {
    try {
      const result = await window.electronAPI.toggleSkillsOutputPath(id);
      if (result) {
        setConfig(result);
      }
    } catch (error) {
      console.error("Failed to toggle path:", error);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const result = await window.electronAPI.manualSkillsSync();
      if (result.success) {
        setLastSyncTime(new Date().toISOString());
      } else {
        console.error("Sync failed:", result.error);
      }
    } catch (error) {
      console.error("Failed to sync:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconFileDescription className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">{t("skills.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("skills.description")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={config.enabled}
            onCheckedChange={handleEnabledToggle}
            disabled={isSaving}
          />
          <span className="text-sm font-medium">
            {config.enabled ? t("skills.enabled") : t("skills.disabled")}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Configuration */}
        <div className="space-y-6">
          {/* Sync Status Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>{t("skills.syncStatus")}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualSync}
                  disabled={isSyncing || !config.enabled}
                >
                  <IconRefresh
                    className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`}
                  />
                  {isSyncing ? t("skills.syncing") : t("skills.syncNow")}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("skills.lastSync")}:
                </span>
                <span>
                  {lastSyncTime
                    ? new Date(lastSyncTime).toLocaleString()
                    : t("skills.never")}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-muted-foreground">
                  {t("skills.autoSync")}:
                </span>
                <Switch
                  checked={config.autoSync}
                  onCheckedChange={handleAutoSyncToggle}
                  disabled={isSaving || !config.enabled}
                />
              </div>
            </CardContent>
          </Card>

          {/* Preset Paths Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{t("skills.quickAdd")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                {t("skills.presetDesc")}
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddPresetPath("cursor")}
                  disabled={!config.enabled}
                >
                  <IconFolder className="h-4 w-4 mr-1" />
                  Cursor
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddPresetPath("cline")}
                  disabled={!config.enabled}
                >
                  <IconFolder className="h-4 w-4 mr-1" />
                  Cline
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddPresetPath("windsurf")}
                  disabled={!config.enabled}
                >
                  <IconFolder className="h-4 w-4 mr-1" />
                  Windsurf
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Output Paths Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                {t("skills.outputPaths")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Custom Path */}
              <div className="flex gap-2">
                <Input
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  placeholder={t("skills.enterPath")}
                  disabled={!config.enabled}
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleAddCustomPath()}
                />
                <Button
                  variant="outline"
                  onClick={handleAddCustomPath}
                  disabled={!config.enabled || !newPath.trim()}
                >
                  <IconPlus className="h-4 w-4" />
                </Button>
              </div>

              {/* Paths List */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {config.outputPaths.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <IconFolder className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>{t("skills.noOutputPaths")}</p>
                    <p className="text-xs mt-1">{t("skills.addPathHint")}</p>
                  </div>
                ) : (
                  config.outputPaths.map((outputPath) => (
                    <div
                      key={outputPath.id}
                      className="flex items-center gap-2 p-3 rounded-md bg-slate-100 dark:bg-slate-800"
                    >
                      <Switch
                        checked={outputPath.enabled}
                        onCheckedChange={() => handleTogglePath(outputPath.id)}
                        disabled={!config.enabled}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {outputPath.displayName || outputPath.path}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {outputPath.path}/skills/mcp-router/SKILL.md
                        </p>
                      </div>
                      <span className="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded">
                        {outputPath.type}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemovePath(outputPath.id)}
                        disabled={!config.enabled}
                      >
                        <IconTrash className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Template Editor */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>{t("skills.template")}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTemplateSave}
                  disabled={!config.enabled || isSaving}
                >
                  {t("common.save")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleTemplateReset}
                  disabled={!config.enabled}
                >
                  {t("skills.resetTemplate")}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {t("skills.templateDesc")}
            </p>
            <Tabs defaultValue="edit" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="edit" className="flex items-center gap-1">
                  <IconCode className="h-4 w-4" />
                  {t("skills.editTemplate")}
                </TabsTrigger>
                <TabsTrigger
                  value="preview"
                  className="flex items-center gap-1"
                >
                  <IconEye className="h-4 w-4" />
                  {t("skills.previewTemplate")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="edit">
                <Textarea
                  value={template}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  disabled={!config.enabled}
                  className="font-mono text-sm min-h-[400px]"
                  placeholder="SKILL.md template..."
                />
              </TabsContent>
              <TabsContent value="preview">
                <div className="border rounded-md p-4 min-h-[400px] max-h-[500px] overflow-auto bg-slate-50 dark:bg-slate-900">
                  <pre className="text-sm whitespace-pre-wrap font-mono">
                    {templatePreview}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SkillsPage;
