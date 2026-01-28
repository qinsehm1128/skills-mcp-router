import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@mcp_router/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";
import { Badge } from "@mcp_router/ui";
import { Switch } from "@mcp_router/ui";
import { Input } from "@mcp_router/ui";
import { useThemeStore } from "@/renderer/stores";
import { IconCheck, IconX } from "@tabler/icons-react";
import { electronPlatformAPI as platformAPI } from "../../platform-api/electron-platform-api";
import type { AIConfig, MCPEndpointMode } from "@mcp_router/shared";
import { DEFAULT_AI_CONFIG } from "@mcp_router/shared";

const Settings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [loadExternalMCPConfigs, setLoadExternalMCPConfigs] =
    useState<boolean>(true);
  const [openAtLogin, setOpenAtLogin] = useState<boolean>(false);
  const [showWindowOnStartup, setShowWindowOnStartup] = useState<boolean>(true);
  const [mcpEndpointMode, setMcpEndpointMode] = useState<MCPEndpointMode>("entry");
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // AI Configuration State
  const [aiConfig, setAiConfig] = useState<AIConfig>(DEFAULT_AI_CONFIG);
  const [isSavingAIConfig, setIsSavingAIConfig] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  // HTTP Server State
  const [httpServerInfo, setHttpServerInfo] = useState<{
    port: number;
    isRunning: boolean;
    endpointMode?: MCPEndpointMode;
    endpoints: { path: string; description: string }[];
  } | null>(null);

  // Zustand stores
  const { theme, setTheme } = useThemeStore();

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
  };

  // Get normalized language code for select
  const getCurrentLanguage = () => {
    const currentLang = i18n.language;
    // Handle cases like 'en-US' -> 'en', 'ja-JP' -> 'ja', 'zh-CN' -> 'zh'
    if (currentLang.startsWith("en")) return "en";
    if (currentLang.startsWith("ja")) return "ja";
    if (currentLang.startsWith("zh")) return "zh";
    return "en"; // fallback
  };

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await platformAPI.settings.get();
        setLoadExternalMCPConfigs(settings.loadExternalMCPConfigs ?? true);
        setOpenAtLogin(settings.openAtLogin ?? false);
        setShowWindowOnStartup(settings.showWindowOnStartup ?? true);
        setMcpEndpointMode(settings.mcpEndpointMode ?? "entry");
      } catch {
        // Ignore error and use default value
        console.log("Failed to load settings, using defaults");
      }
    };
    loadSettings();

    // Load AI config
    const loadAIConfig = async () => {
      try {
        const config = await window.electronAPI.getAIConfig();
        if (config) {
          setAiConfig(config);
        }
      } catch {
        console.log("Failed to load AI config, using defaults");
      }
    };
    loadAIConfig();

    // Load HTTP server info
    const loadHttpServerInfo = async () => {
      try {
        const info = await window.electronAPI.getHttpServerInfo();
        if (info) {
          setHttpServerInfo(info);
        }
      } catch {
        console.log("Failed to load HTTP server info");
      }
    };
    loadHttpServerInfo();
  }, []);

  // Handle external MCP configs toggle
  const handleExternalMCPConfigsToggle = async (checked: boolean) => {
    setLoadExternalMCPConfigs(checked);
    setIsSavingSettings(true);

    try {
      const currentSettings = await platformAPI.settings.get();
      await platformAPI.settings.save({
        ...currentSettings,
        loadExternalMCPConfigs: checked,
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
      // Revert on error
      setLoadExternalMCPConfigs(!checked);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Handle open at login toggle
  const handleOpenAtLoginToggle = async (checked: boolean) => {
    setOpenAtLogin(checked);
    setIsSavingSettings(true);

    try {
      const currentSettings = await platformAPI.settings.get();
      await platformAPI.settings.save({
        ...currentSettings,
        openAtLogin: checked,
      });
    } catch (error) {
      console.error("Failed to save open at login settings:", error);
      // Revert on error
      setOpenAtLogin(!checked);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Handle startup visibility toggle
  const handleStartupVisibilityToggle = async (checked: boolean) => {
    setShowWindowOnStartup(checked);
    setIsSavingSettings(true);

    try {
      const currentSettings = await platformAPI.settings.get();
      await platformAPI.settings.save({
        ...currentSettings,
        showWindowOnStartup: checked,
      });
    } catch (error) {
      console.error("Failed to save startup visibility settings:", error);
      // Revert on error
      setShowWindowOnStartup(!checked);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Handle MCP endpoint mode change
  const handleMcpEndpointModeChange = async (mode: MCPEndpointMode) => {
    const previousMode = mcpEndpointMode;
    setMcpEndpointMode(mode);
    setIsSavingSettings(true);

    try {
      const currentSettings = await platformAPI.settings.get();
      await platformAPI.settings.save({
        ...currentSettings,
        mcpEndpointMode: mode,
      });
      // Refresh HTTP server info to show updated endpoint description
      const info = await window.electronAPI.getHttpServerInfo();
      if (info) {
        setHttpServerInfo(info);
      }
    } catch (error) {
      console.error("Failed to save MCP endpoint mode:", error);
      setMcpEndpointMode(previousMode);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Handle AI config changes
  const handleAIConfigChange = (field: keyof AIConfig, value: string | boolean) => {
    setAiConfig((prev) => ({ ...prev, [field]: value }));
    setConnectionTestResult(null); // Clear test result when config changes
  };

  // Save AI config
  const handleSaveAIConfig = async () => {
    setIsSavingAIConfig(true);
    try {
      await window.electronAPI.saveAIConfig(aiConfig);
    } catch (error) {
      console.error("Failed to save AI config:", error);
    } finally {
      setIsSavingAIConfig(false);
    }
  };

  // Test AI connection
  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionTestResult(null);
    try {
      // Save config first
      await window.electronAPI.saveAIConfig(aiConfig);
      // Then test connection
      const result = await window.electronAPI.testAIConnection();
      setConnectionTestResult(result);
    } catch (error: any) {
      setConnectionTestResult({ success: false, error: error.message });
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-3xl font-bold">{t("common.settings")}</h1>

      {/* Appearance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("settings.appearance")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t("common.language")}
            </label>
            <div className="flex flex-1 min-w-[220px]">
              <Select
                value={getCurrentLanguage()}
                onValueChange={handleLanguageChange}
              >
                <SelectTrigger id="language" className="w-full">
                  <SelectValue placeholder={t("common.language")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("settings.theme")}</label>
            <div className="flex flex-1 min-w-[220px]">
              <Select
                value={theme}
                onValueChange={(value: "light" | "dark" | "system") =>
                  setTheme(value)
                }
              >
                <SelectTrigger id="theme" className="w-full">
                  <SelectValue placeholder={t("settings.theme")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    {t("settings.themeLight")}
                  </SelectItem>
                  <SelectItem value="dark">
                    {t("settings.themeDark")}
                  </SelectItem>
                  <SelectItem value="system">
                    {t("settings.themeSystem")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HTTP Server Card */}
      {httpServerInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.httpServer")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("settings.httpServerDescription")}
            </p>

            {/* Server Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t("settings.httpServerStatus")}</span>
              <Badge variant={httpServerInfo.isRunning ? "default" : "secondary"}>
                {httpServerInfo.isRunning
                  ? t("settings.httpServerRunning")
                  : t("settings.httpServerStopped")}
              </Badge>
            </div>

            {/* Endpoint Mode */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("settings.mcpEndpointMode")}</label>
              <p className="text-xs text-muted-foreground">
                {t("settings.mcpEndpointModeDescription")}
              </p>
              <Select
                value={mcpEndpointMode}
                onValueChange={(value: MCPEndpointMode) => handleMcpEndpointModeChange(value)}
                disabled={isSavingSettings}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entry">
                    {t("settings.mcpEndpointModeEntry")}
                  </SelectItem>
                  <SelectItem value="aggregator">
                    {t("settings.mcpEndpointModeAggregator")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Server URL */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("settings.httpServerUrl")}</label>
              <div className="flex gap-2">
                <Input
                  value={`http://localhost:${httpServerInfo.port}/mcp`}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`http://localhost:${httpServerInfo.port}/mcp`);
                  }}
                >
                  {t("settings.httpServerCopyUrl")}
                </Button>
              </div>
            </div>

            {/* Endpoints */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("settings.httpServerEndpoints")}</label>
              <div className="rounded-md bg-muted p-3 space-y-2">
                {httpServerInfo.endpoints.map((endpoint, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <code className="bg-background px-2 py-0.5 rounded font-mono text-xs">
                      {endpoint.path}
                    </code>
                    <span className="text-muted-foreground">{endpoint.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("aiConfig.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("aiConfig.description")}
          </p>

          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">
                {t("aiConfig.enable")}
              </label>
              <p className="text-xs text-muted-foreground">
                {t("aiConfig.enableDescription")}
              </p>
            </div>
            <Switch
              checked={aiConfig.enabled}
              onCheckedChange={(checked) => handleAIConfigChange("enabled", checked)}
            />
          </div>

          {/* API Base URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t("aiConfig.baseUrl")}
            </label>
            <Input
              value={aiConfig.baseUrl}
              onChange={(e) => handleAIConfigChange("baseUrl", e.target.value)}
              placeholder={t("aiConfig.baseUrlPlaceholder")}
              disabled={!aiConfig.enabled}
            />
            <p className="text-xs text-muted-foreground">
              {t("aiConfig.baseUrlHelp")}
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t("aiConfig.apiKey")}
            </label>
            <Input
              type="password"
              value={aiConfig.apiKey}
              onChange={(e) => handleAIConfigChange("apiKey", e.target.value)}
              placeholder={t("aiConfig.apiKeyPlaceholder")}
              disabled={!aiConfig.enabled}
            />
          </div>

          {/* Model */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t("aiConfig.model")}
            </label>
            <Input
              value={aiConfig.model}
              onChange={(e) => handleAIConfigChange("model", e.target.value)}
              placeholder={t("aiConfig.modelPlaceholder")}
              disabled={!aiConfig.enabled}
            />
            <p className="text-xs text-muted-foreground">
              {t("aiConfig.modelHelp")}
            </p>
          </div>

          {/* Connection Test Result */}
          {connectionTestResult && (
            <div
              className={`flex items-center gap-2 p-3 rounded-md ${
                connectionTestResult.success
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                  : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
              }`}
            >
              {connectionTestResult.success ? (
                <>
                  <IconCheck className="h-4 w-4" />
                  <span className="text-sm">{t("aiConfig.connectionSuccess")}</span>
                </>
              ) : (
                <>
                  <IconX className="h-4 w-4" />
                  <span className="text-sm">
                    {t("aiConfig.connectionFailed")}: {connectionTestResult.error}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={!aiConfig.enabled || !aiConfig.baseUrl || !aiConfig.apiKey || isTestingConnection}
              className="flex-1"
            >
              {isTestingConnection ? t("aiConfig.testing") : t("aiConfig.testConnection")}
            </Button>
            <Button
              onClick={handleSaveAIConfig}
              disabled={isSavingAIConfig}
              className="flex-1"
            >
              {isSavingAIConfig ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* External Applications Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("settings.advanced")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">
                {t("settings.loadExternalMCPConfigs")}
              </label>
              <p className="text-xs text-muted-foreground">
                {t("settings.loadExternalMCPConfigsDescription")}
              </p>
            </div>
            <Switch
              checked={loadExternalMCPConfigs}
              onCheckedChange={handleExternalMCPConfigsToggle}
              disabled={isSavingSettings}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">
                {t("settings.openAtLogin")}
              </label>
              <p className="text-xs text-muted-foreground">
                {t("settings.openAtLoginDescription")}
              </p>
            </div>
            <Switch
              checked={openAtLogin}
              onCheckedChange={handleOpenAtLoginToggle}
              disabled={isSavingSettings}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">
                {t("settings.showWindowOnStartup")}
              </label>
              <p className="text-xs text-muted-foreground">
                {t("settings.showWindowOnStartupDescription")}
              </p>
            </div>
            <Switch
              checked={showWindowOnStartup}
              onCheckedChange={handleStartupVisibilityToggle}
              disabled={isSavingSettings || !openAtLogin}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
