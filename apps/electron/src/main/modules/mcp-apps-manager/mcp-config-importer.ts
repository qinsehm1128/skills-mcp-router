import { promises as fsPromises } from "fs";
import { parse as parseToml } from "smol-toml";
import { getServerService } from "@/main/modules/mcp-server-manager/server-service";
import { MCPServerConfig, ClientType, ClientConfig } from "@mcp_router/shared";
import { v4 as uuidv4 } from "uuid";
import { getSettingsService } from "@/main/modules/settings/settings.service";
import { AppPaths } from "./app-paths";
import {
  STANDARD_APP_DEFINITIONS,
  findStandardAppDefinition,
} from "./app-definitions";

const HTTP_URL_REGEX = /^https?:\/\//i;

function normalizeServerName(name: string): string {
  return name.trim().toLowerCase();
}

function getIgnoredExternalServerNames(settings: any): Set<string> {
  const rawNames = settings["ignoredExternalMCPServerNames"];
  const names = Array.isArray(rawNames)
    ? rawNames.filter((name): name is string => typeof name === "string")
    : [];
  return new Set(names.map((name) => normalizeServerName(name)));
}

function saveIgnoredExternalServerNames(
  settings: any,
  names: Set<string>,
): void {
  const sorted = [...names].sort();
  const settingsService = getSettingsService();
  settingsService.saveSettings({
    ...settings,
    ignoredExternalMCPServerNames: sorted,
  } as any);
}

export function markExternalServerAsDeleted(serverName: string): void {
  const normalizedName = normalizeServerName(serverName);
  if (!normalizedName) {
    return;
  }

  const settingsService = getSettingsService();
  const settings = settingsService.getSettings();
  const ignoredNames = getIgnoredExternalServerNames(settings);

  if (ignoredNames.has(normalizedName)) {
    return;
  }

  ignoredNames.add(normalizedName);
  saveIgnoredExternalServerNames(settings, ignoredNames);
}

export function clearDeletedExternalServerMark(serverName: string): void {
  const normalizedName = normalizeServerName(serverName);
  if (!normalizedName) {
    return;
  }

  const settingsService = getSettingsService();
  const settings = settingsService.getSettings();
  const ignoredNames = getIgnoredExternalServerNames(settings);

  if (!ignoredNames.has(normalizedName)) {
    return;
  }

  ignoredNames.delete(normalizedName);
  saveIgnoredExternalServerNames(settings, ignoredNames);
}

// Helper to match CLI arg variations like "@mcp_router/cli", "@mcp_router/cli@latest", "@mcp_router/cli@0.x",
// and legacy aliases like "mcpr-cli", "mcpr-cli@latest"
function isMcpRouterCliArg(arg: string): boolean {
  if (!arg || typeof arg !== "string") return false;
  return (
    /^@mcp_router\/cli(?:@.*)?$/.test(arg) || /^mcpr-cli(?:@.*)?$/.test(arg)
  );
}

function isNpxCommand(command: string | undefined): boolean {
  if (!command) return false;
  if (command === "npx") return true;
  // Windows: allow full paths that end with npx.cmd or npx.exe
  return /[\\/]npx\.(cmd|exe)$/i.test(command.trim());
}

function stripOuterQuotes(val: any): any {
  if (typeof val !== "string") return val;
  let s = val.trim();
  // Remove single or double quotes if present on both ends
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1);
  }
  // Also remove stray leading/trailing quotes if mismatched
  if (s.startsWith('"') || s.startsWith("'")) s = s.slice(1);
  if (s.endsWith('"') || s.endsWith("'")) s = s.slice(0, -1);
  return s;
}

function isHttpUrl(value: unknown): value is string {
  return (
    typeof value === "string" && HTTP_URL_REGEX.test(stripOuterQuotes(value))
  );
}

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .filter((item): item is string => typeof item === "string")
    .map((item) => stripOuterQuotes(item));
}

function normalizeEnv(env: unknown): Record<string, string> {
  if (!env || typeof env !== "object") {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
    if (typeof value === "string") {
      normalized[key] = value;
    }
  }

  return normalized;
}

function isMcpProxyCommand(command: unknown): boolean {
  if (typeof command !== "string") {
    return false;
  }

  const normalized = stripOuterQuotes(command)
    .replace(/\\/g, "/")
    .toLowerCase();
  return normalized.endsWith("/mcp-proxy") || normalized.endsWith("mcp-proxy");
}

function findRemoteUrlFromArgs(args: string[]): string | undefined {
  const urlFlagIndex = args.findIndex((arg) => arg === "--url" || arg === "-u");
  if (
    urlFlagIndex >= 0 &&
    urlFlagIndex + 1 < args.length &&
    isHttpUrl(args[urlFlagIndex + 1])
  ) {
    return stripOuterQuotes(args[urlFlagIndex + 1]);
  }

  const firstHttpArg = args.find((arg) => isHttpUrl(arg));
  if (firstHttpArg) {
    return stripOuterQuotes(firstHttpArg);
  }

  return undefined;
}

function inferRemoteServerType(url: string): "remote" | "remote-streamable" {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    if (pathname.endsWith("/sse") || pathname.includes("/sse/")) {
      return "remote";
    }
  } catch {
    // Ignore parse errors and fallback to streamable mode
  }

  return "remote-streamable";
}

function extractRemoteUrl(
  serverConfig: Record<string, any>,
): string | undefined {
  if (isHttpUrl(serverConfig.remoteUrl)) {
    return stripOuterQuotes(serverConfig.remoteUrl);
  }

  if (isHttpUrl(serverConfig.url)) {
    return stripOuterQuotes(serverConfig.url);
  }

  if (isHttpUrl(serverConfig.command)) {
    return stripOuterQuotes(serverConfig.command);
  }

  const args = normalizeStringArray(serverConfig.args);
  if (
    isMcpProxyCommand(serverConfig.command) ||
    args.some((arg) => isMcpProxyCommand(arg))
  ) {
    return findRemoteUrlFromArgs(args);
  }

  return undefined;
}

function extractBearerToken(
  serverConfig: Record<string, any>,
): string | undefined {
  if (
    typeof serverConfig.bearerToken === "string" &&
    serverConfig.bearerToken.trim()
  ) {
    return stripOuterQuotes(serverConfig.bearerToken);
  }

  const env = normalizeEnv(serverConfig.env);
  const authHeader = env.AUTHORIZATION || env.authorization;
  if (typeof authHeader === "string" && authHeader.trim()) {
    const trimmed = authHeader.trim();
    return trimmed.toLowerCase().startsWith("bearer ")
      ? trimmed.slice(7).trim()
      : trimmed;
  }

  return undefined;
}

function buildServerConfigFromExternal(
  serverName: string,
  serverConfig: Record<string, any>,
): MCPServerConfig | null {
  if (!serverConfig || typeof serverConfig !== "object") {
    return null;
  }

  const command =
    typeof serverConfig.command === "string"
      ? stripOuterQuotes(serverConfig.command)
      : "";
  const args = normalizeStringArray(serverConfig.args);
  const env = normalizeEnv(serverConfig.env);
  const remoteUrl = extractRemoteUrl(serverConfig);
  const declaredServerType = serverConfig.serverType;
  const isDeclaredRemote =
    declaredServerType === "remote" ||
    declaredServerType === "remote-streamable";
  const isRemoteLike =
    isDeclaredRemote ||
    isHttpUrl(serverConfig.url) ||
    isHttpUrl(serverConfig.remoteUrl) ||
    isHttpUrl(serverConfig.command) ||
    isMcpProxyCommand(serverConfig.command) ||
    args.some((arg) => isMcpProxyCommand(arg));

  if (remoteUrl && isRemoteLike) {
    return {
      id: uuidv4(),
      name: serverName,
      serverType: isDeclaredRemote
        ? declaredServerType
        : inferRemoteServerType(remoteUrl),
      remoteUrl,
      bearerToken: extractBearerToken(serverConfig),
      command: "",
      args: [],
      env,
      disabled: false,
      autoStart: false,
    };
  }

  if (!command) {
    return null;
  }

  return {
    id: uuidv4(),
    name: serverName,
    serverType: "local",
    command,
    args,
    env,
    disabled: false,
    autoStart: false,
  };
}

// Fallback: extract MCPR_TOKEN from TOML by scanning env table text
function extractCodexTokenFromToml(tomlText: string): string | null {
  let root: any;
  try {
    root = parseToml(tomlText);
  } catch (error) {
    console.error("Failed to parse Codex TOML while extracting token:", error);
    return null;
  }

  const serverCandidates: any[] = [];

  const collectFromContainer = (container: any): void => {
    if (!container) return;
    if (Array.isArray(container)) {
      for (const server of container) {
        if (!server || typeof server !== "object") continue;
        const name = (server as any).name;
        if (name === "mcp-router" || name === "mcp_router") {
          serverCandidates.push(server);
        }
      }
    } else if (typeof container === "object") {
      const direct =
        (container as any)["mcp-router"] || (container as any).mcp_router;
      if (direct && typeof direct === "object") {
        serverCandidates.push(direct);
      }
      for (const [name, server] of Object.entries(container)) {
        if (name === "mcp-router" || name === "mcp_router") {
          serverCandidates.push(server);
        }
      }
    }
  };

  collectFromContainer(root?.mcp?.servers);
  collectFromContainer(root?.mcp_servers);

  for (const server of serverCandidates) {
    const env = (server as any).env;
    if (env && typeof env === "object" && "MCPR_TOKEN" in env) {
      const raw = (env as any).MCPR_TOKEN;
      return stripOuterQuotes(
        typeof raw === "string" ? raw : String(raw ?? ""),
      );
    }
  }

  return null;
}

/**
 * Sync server configurations from a provided list of configs
 * Used by the mcp-apps-service to sync servers found in client config files
 */
export async function syncServersFromClientConfig(
  serverConfigs: MCPServerConfig[],
): Promise<void> {
  if (!serverConfigs || serverConfigs.length === 0) {
    return;
  }

  try {
    // Check if external MCP configs loading is enabled
    const settingsService = getSettingsService();
    const settings = await settingsService.getSettings();

    if (settings.loadExternalMCPConfigs === false) {
      return;
    }
    const ignoredServerNames = getIgnoredExternalServerNames(settings);

    // 既存のサーバを取得して重複を避ける
    const serverService = getServerService();
    const existingServers = serverService.getAllServers();
    const existingServerNames = new Set<string>(
      existingServers.map((s: any) => normalizeServerName(s.name)),
    );

    // 各サーバ設定を処理
    for (const serverConfig of serverConfigs) {
      const normalizedName = normalizeServerName(serverConfig.name);

      // ユーザーが削除済みとしてマークした外部サーバは再インポートしない
      if (ignoredServerNames.has(normalizedName)) {
        continue;
      }

      // 同名のサーバが既に存在する場合はスキップ
      if (existingServerNames.has(normalizedName)) {
        continue;
      }

      // サーバを追加
      try {
        serverService.addServer(serverConfig);
        // 既存名のセットに追加
        existingServerNames.add(normalizedName);
      } catch (error) {
        console.error(`Failed to import server '${serverConfig.name}':`, error);
      }
    }
  } catch (error) {
    console.error("Failed to sync MCP servers from client config:", error);
  }
}

/**
 * Import existing MCP server configurations from client app settings
 */
export async function importExistingServerConfigurations(): Promise<void> {
  try {
    // Check if external MCP configs loading is enabled
    const settingsService = getSettingsService();
    const settings = await settingsService.getSettings();

    if (settings.loadExternalMCPConfigs === false) {
      return;
    }
    const ignoredServerNames = getIgnoredExternalServerNames(settings);

    console.log(
      "Checking for existing MCP server configurations in client apps...",
    );

    // Get existing servers to avoid duplicates
    const serverService = getServerService();
    const existingServers = serverService.getAllServers();
    const existingServerNames = new Set<string>(
      existingServers.map((s: any) => normalizeServerName(s.name)),
    );

    // Load all client configurations
    const clientConfigs = await loadAllClientConfigs();

    // Process each configuration
    for (const config of clientConfigs) {
      if (!config.content) continue;

      // Extract server configurations based on client type
      const serverConfigs = extractServerConfigs(
        config.type,
        config.content,
        config.path,
      );

      // Add new server configurations
      for (const serverConfig of serverConfigs) {
        const normalizedName = normalizeServerName(serverConfig.name);

        // ユーザーが削除済みとしてマークした外部サーバは再インポートしない
        if (ignoredServerNames.has(normalizedName)) {
          continue;
        }

        // Skip if a server with this name already exists
        if (existingServerNames.has(normalizedName)) {
          continue;
        }

        // Add the server
        try {
          serverService.addServer(serverConfig);
          // Add to existing names set
          existingServerNames.add(normalizedName);
        } catch (error) {
          console.error(
            `Failed to import server '${serverConfig.name}' from ${config.type}:`,
            error,
          );
        }
      }
    }
  } catch (error) {
    console.error("Failed to import existing server configurations:", error);
  }
}

/**
 * Load configurations from all supported client apps
 */
async function loadAllClientConfigs(): Promise<ClientConfig[]> {
  // Define client config paths and types
  const appPaths = new AppPaths();
  const clientConfigPaths: ClientConfig[] = STANDARD_APP_DEFINITIONS.map(
    (definition) => ({
      type: definition.clientType,
      path: definition.getConfigPath(appPaths),
    }),
  );

  // Load content for each existing config file
  const results: ClientConfig[] = [];

  for (const config of clientConfigPaths) {
    try {
      if (await appPaths.exists(config.path)) {
        const content = await fsPromises.readFile(config.path, "utf8");
        try {
          if (config.type === "codex") {
            const mcpServers = parseCodexTomlServers(content);
            results.push({
              ...config,
              content: { mcpServers },
            });
          } else {
            const parsedContent = JSON.parse(content);
            results.push({
              ...config,
              content: parsedContent,
            });
          }
        } catch (parseError) {
          console.error(
            `Failed to parse ${config.type} config file:`,
            parseError,
          );
        }
      }
    } catch (error) {
      console.error(`Error checking ${config.type} config:`, error);
    }
  }

  return results;
}

/**
 * 設定ファイルからMCP設定とトークンを抽出
 */
export async function extractConfigInfo(
  name: string,
  configPath: string,
): Promise<{
  hasMcpConfig: boolean;
  configToken: string;
  otherServers?: MCPServerConfig[];
}> {
  try {
    const fileContent = await fsPromises.readFile(configPath, "utf8");
    const definition = findStandardAppDefinition(name);
    const configKind = definition?.configKind ?? "standard-json";

    const config =
      configKind === "codex"
        ? { mcpServers: parseCodexTomlServers(fileContent) }
        : JSON.parse(fileContent);

    let hasMcpConfig;
    let configToken = "";
    let otherServers: MCPServerConfig[] = [];

    switch (configKind) {
      case "vscode-json": {
        const servers = (config as any).servers;
        const argsArr = servers?.["mcp-router"]?.args;
        hasMcpConfig =
          !!servers &&
          !!servers["mcp-router"] &&
          isNpxCommand(servers["mcp-router"].command) &&
          Array.isArray(argsArr) &&
          argsArr.includes("connect") &&
          argsArr.some(isMcpRouterCliArg);

        if (servers?.["mcp-router"]?.env?.MCPR_TOKEN) {
          configToken = stripOuterQuotes(servers["mcp-router"].env.MCPR_TOKEN);
        }

        if (servers) {
          otherServers = extractServersFromConfig(servers);
        }
        break;
      }
      case "codex": {
        const servers = (config as any).mcpServers || {};
        const mcpr = servers["mcp-router"] || servers["mcp_router"];
        const argsArr = mcpr?.args;
        const hasCommand = !!mcpr && isNpxCommand(mcpr.command);
        const hasArgs = Array.isArray(argsArr);
        const hasConnect =
          !!hasArgs && (argsArr as string[]).includes("connect");
        const hasCli =
          !!hasArgs && (argsArr as string[]).some(isMcpRouterCliArg);
        hasMcpConfig = !!(hasCommand && hasArgs && hasConnect && hasCli);

        if (mcpr?.env?.MCPR_TOKEN) {
          configToken = stripOuterQuotes(mcpr.env.MCPR_TOKEN);
        }
        if (!configToken) {
          const fallback = extractCodexTokenFromToml(fileContent);
          if (fallback) {
            configToken = fallback;
          }
        }

        otherServers = extractServersFromConfig(servers);
        break;
      }
      default: {
        const servers = (config as any).mcpServers;
        const srv = servers?.["mcp-router"];
        const argsArr = srv?.args;
        hasMcpConfig =
          !!servers &&
          !!srv &&
          isNpxCommand(srv.command) &&
          Array.isArray(argsArr) &&
          argsArr.includes("connect") &&
          argsArr.some(isMcpRouterCliArg);

        if (servers?.["mcp-router"]?.env?.MCPR_TOKEN) {
          configToken = stripOuterQuotes(servers["mcp-router"].env.MCPR_TOKEN);
        }

        if (servers) {
          otherServers = extractServersFromConfig(servers);
        }
        break;
      }
    }

    return { hasMcpConfig, configToken, otherServers };
  } catch (error) {
    console.error(`Error extracting config info from ${configPath}:`, error);
    return { hasMcpConfig: false, configToken: "" };
  }
}

/**
 * 設定オブジェクトから他のMCPサーバ構成を抽出
 * 標準化されたバージョン - 以前のextractOtherServers関数を置き換え
 */
function extractServersFromConfig(
  servers: Record<string, any>,
): MCPServerConfig[] {
  const configs: MCPServerConfig[] = [];

  for (const [serverName, serverConfig] of Object.entries(servers)) {
    // mcp-router 自体は除外
    if (serverName === "mcp-router" || serverName === "mcp_router") continue;

    const config = buildServerConfigFromExternal(serverName, serverConfig);
    if (config) {
      configs.push(config);
    }
  }

  return configs;
}

/**
 * Extract MCP server configurations from client config
 */
function extractServerConfigs(
  clientType: ClientType,
  content: any,
  configPath: string,
): MCPServerConfig[] {
  const configs: MCPServerConfig[] = [];

  try {
    switch (clientType) {
      case "vscode":
        // VSCode uses 'servers' structure
        if (content.servers) {
          extractVSCodeServerConfigs(content.servers, configs, clientType);
        }
        break;

      case "claude":
      case "cline":
      case "windsurf":
      case "cursor":
        // These clients use 'mcpServers' structure
        if (content.mcpServers) {
          extractStandardServerConfigs(
            content.mcpServers,
            configs,
            clientType,
            configPath,
          );
        }
        break;
      case "codex":
        // Codex config is TOML; we already normalized to { mcpServers }
        if (content.mcpServers) {
          extractStandardServerConfigs(
            content.mcpServers,
            configs,
            clientType,
            configPath,
          );
        }
        break;
    }
  } catch (error) {
    console.error(`Error extracting server configs from ${clientType}:`, error);
  }

  return configs;
}

/**
 * Parse Codex config.toml and extract MCP servers
 * Supports:
 * - Tables like [mcp.servers."name"] or [mcp_servers.name]
 * - Array-of-tables [[mcp.servers]] / [[mcp_servers]] with name="..."
 */
function parseCodexTomlServers(tomlText: string): Record<string, any> {
  const servers: Record<string, any> = {};

  let root: any;
  try {
    root = parseToml(tomlText);
  } catch (error) {
    console.error("Failed to parse Codex TOML config:", error);
    return servers;
  }

  const addServer = (name: string, server: any): void => {
    if (!name || !server || typeof server !== "object") return;
    const command = (server as any).command;
    const url =
      (server as any).url ||
      (server as any).remoteUrl ||
      (server as any).remote_url;
    if (!command && !url) return;
    const args = Array.isArray((server as any).args)
      ? (server as any).args
      : [];
    const env =
      (server as any).env && typeof (server as any).env === "object"
        ? (server as any).env
        : {};
    const entry: Record<string, any> = { args, env };
    if (command) {
      entry.command = command;
    }
    if (url) {
      entry.url = url;
    }

    servers[name] = entry;
  };

  const collectFromContainer = (container: any): void => {
    if (!container) return;
    if (Array.isArray(container)) {
      for (const server of container) {
        if (!server || typeof server !== "object") continue;
        const name = (server as any).name;
        if (typeof name === "string") {
          addServer(name, server);
        }
      }
    } else if (typeof container === "object") {
      for (const [name, server] of Object.entries(container)) {
        addServer(name, server);
      }
    }
  };

  collectFromContainer(root?.mcp?.servers);
  collectFromContainer(root?.mcp_servers);

  return servers;
}

/**
 * Extract server configs from VSCode config format
 */
function extractVSCodeServerConfigs(
  servers: Record<string, any>,
  configs: MCPServerConfig[],
  _clientType: ClientType,
): void {
  for (const [serverName, serverConfig] of Object.entries(servers)) {
    // Skip 'mcp-router' server as it's this app itself
    if (serverName === "mcp-router") continue;

    const config = buildServerConfigFromExternal(serverName, serverConfig);
    if (config) {
      configs.push(config);
    }
  }
}

/**
 * Extract server configs from standard client config format
 */
function extractStandardServerConfigs(
  servers: Record<string, any>,
  configs: MCPServerConfig[],
  _clientType: ClientType,
  _configPath: string,
): void {
  for (const [serverName, serverConfig] of Object.entries(servers)) {
    // Skip 'mcp-router' server as it's this app itself
    if (serverName === "mcp-router" || serverName === "mcp_router") continue;

    const config = buildServerConfigFromExternal(serverName, serverConfig);
    if (config) {
      configs.push(config);
    }
  }
}
