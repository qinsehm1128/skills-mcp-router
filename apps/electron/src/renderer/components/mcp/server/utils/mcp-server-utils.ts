import { v4 as uuidv4 } from "uuid";
import type { MCPServer } from "@mcp_router/shared";

const HTTP_URL_REGEX = /^https?:\/\//i;

function stripOuterQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function isHttpUrl(value: unknown): value is string {
  return (
    typeof value === "string" && HTTP_URL_REGEX.test(stripOuterQuotes(value))
  );
}

function normalizeHttpUrl(value: string): string {
  return stripOuterQuotes(value);
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

function findRemoteUrlFromArgs(args: unknown): string | undefined {
  if (!Array.isArray(args)) {
    return undefined;
  }

  const normalizedArgs = args
    .filter((arg): arg is string => typeof arg === "string")
    .map((arg) => stripOuterQuotes(arg));

  const urlFlagIndex = normalizedArgs.findIndex(
    (arg) => arg === "--url" || arg === "-u",
  );
  if (
    urlFlagIndex >= 0 &&
    urlFlagIndex + 1 < normalizedArgs.length &&
    isHttpUrl(normalizedArgs[urlFlagIndex + 1])
  ) {
    return normalizeHttpUrl(normalizedArgs[urlFlagIndex + 1]);
  }

  const firstHttpArg = normalizedArgs.find((arg) => isHttpUrl(arg));
  if (firstHttpArg) {
    return normalizeHttpUrl(firstHttpArg);
  }

  return undefined;
}

function inferRemoteServerTypeFromUrl(
  url: string,
): "remote" | "remote-streamable" {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();

    if (pathname.endsWith("/sse") || pathname.includes("/sse/")) {
      return "remote";
    }
  } catch {
    // Ignore URL parsing errors and fallback to streamable mode
  }

  return "remote-streamable";
}

function extractRemoteUrlFromServerConfig(
  serverConfig: Record<string, any>,
): string | undefined {
  if (isHttpUrl(serverConfig.remoteUrl)) {
    return normalizeHttpUrl(serverConfig.remoteUrl);
  }

  if (isHttpUrl(serverConfig.url)) {
    return normalizeHttpUrl(serverConfig.url);
  }

  if (isHttpUrl(serverConfig.command)) {
    return normalizeHttpUrl(serverConfig.command);
  }

  if (
    isMcpProxyCommand(serverConfig.command) ||
    (Array.isArray(serverConfig.args) &&
      serverConfig.args.some((arg) => isMcpProxyCommand(arg)))
  ) {
    return findRemoteUrlFromArgs(serverConfig.args);
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
    return serverConfig.bearerToken.trim();
  }

  const env = serverConfig.env;
  if (!env || typeof env !== "object") {
    return undefined;
  }

  const authHeader =
    (env as Record<string, unknown>).AUTHORIZATION ??
    (env as Record<string, unknown>).authorization;
  if (typeof authHeader === "string" && authHeader.trim()) {
    const trimmed = authHeader.trim();
    return trimmed.toLowerCase().startsWith("bearer ")
      ? trimmed.slice(7).trim()
      : trimmed;
  }

  return undefined;
}

function isRemoteServerDefinition(
  serverConfig: Record<string, any>,
  remoteUrl?: string,
): boolean {
  if (!remoteUrl) {
    return false;
  }

  const declaredServerType = serverConfig.serverType;
  if (
    declaredServerType === "remote" ||
    declaredServerType === "remote-streamable"
  ) {
    return true;
  }

  return (
    isMcpProxyCommand(serverConfig.command) ||
    isHttpUrl(serverConfig.command) ||
    isHttpUrl(serverConfig.url) ||
    isHttpUrl(serverConfig.remoteUrl)
  );
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

/**
 * Validates a JSON input for MCP server configuration format
 * Works with both mcpServers object wrapper and direct server configurations
 *
 * @param jsonInput The JSON input string or object to validate
 * @returns Validation result with parsed data if valid
 */
export function validateMcpServerJson(jsonInput: string | object): {
  valid: boolean;
  error?: string;
  jsonData?: any;
  serverConfigs?: Record<string, any>;
} {
  try {
    // Parse JSON if input is a string
    const parsed =
      typeof jsonInput === "string" ? JSON.parse(jsonInput) : jsonInput;

    // Determine if the JSON has mcpServers wrapper or is a direct server config
    const mcpServers = parsed.mcpServers || parsed;

    if (typeof mcpServers !== "object" || mcpServers === null) {
      return { valid: false, error: "Invalid JSON format: Expected an object" };
    }

    const serverNames = Object.keys(mcpServers);

    if (serverNames.length === 0) {
      return { valid: false, error: "No server configurations found" };
    }

    // Check if at least one server has the required fields
    for (const serverName of serverNames) {
      const server = mcpServers[serverName];
      if (!server || typeof server !== "object") {
        return {
          valid: false,
          error: `Invalid server configuration for '${serverName}': Expected an object`,
        };
      }

      const remoteUrl = extractRemoteUrlFromServerConfig(server);
      const hasCommand =
        typeof server.command === "string" && server.command.trim().length > 0;

      if (!hasCommand && !remoteUrl) {
        return {
          valid: false,
          error: `Missing command or remote URL for server '${serverName}'`,
        };
      }

      if (server.args !== undefined && !Array.isArray(server.args)) {
        return {
          valid: false,
          error: `Arguments must be an array for server '${serverName}'`,
        };
      }
    }

    return {
      valid: true,
      jsonData: parsed,
      serverConfigs: mcpServers,
    };
  } catch (error: any) {
    return {
      valid: false,
      error: `Invalid JSON: ${error.message}`,
    };
  }
}

/**
 * Processes MCP server configurations from validated JSON
 * Handles duplicate names by creating unique names
 *
 * @param serverConfigs The validated server configurations object
 * @param existingServerNames Set of existing server names to avoid duplicates
 * @returns Array of processed server configurations
 */
export function processMcpServerConfigs(
  serverConfigs: Record<string, any>,
  existingServerNames: Set<string>,
): Array<{
  name: string;
  originalName?: string;
  success: boolean;
  server?: any;
  message?: string;
}> {
  const results: Array<{
    name: string;
    originalName?: string;
    success: boolean;
    server?: any;
    message?: string;
  }> = [];

  // Clone the set to avoid modifying the original
  const currentNames = new Set(existingServerNames);

  // Process each server in the configuration
  for (const [serverName, serverConfig] of Object.entries(serverConfigs)) {
    try {
      // Ensure server config is an object
      if (!serverConfig || typeof serverConfig !== "object") {
        results.push({
          name: serverName,
          success: false,
          message: "Invalid server configuration",
        });
        continue;
      }

      // Generate a unique name if the server name already exists
      let uniqueName = serverName;
      let counter = 2;
      while (currentNames.has(uniqueName)) {
        uniqueName = `${serverName}-${counter}`;
        counter++;
      }

      // Add the unique name to our set to prevent duplicates within this batch
      currentNames.add(uniqueName);

      // Extract fields from the configuration
      const { command, args } = serverConfig;
      const remoteUrl = extractRemoteUrlFromServerConfig(serverConfig);
      const isRemoteServer = isRemoteServerDefinition(serverConfig, remoteUrl);
      const env = normalizeEnv(serverConfig.env);
      const bearerToken = extractBearerToken(serverConfig);
      const declaredServerType = serverConfig.serverType;
      const remoteServerType: "remote" | "remote-streamable" =
        declaredServerType === "remote" ||
        declaredServerType === "remote-streamable"
          ? declaredServerType
          : inferRemoteServerTypeFromUrl(remoteUrl || "");

      // Create MCPServerConfig object
      const mcpServerConfig = {
        id: uuidv4(),
        name: uniqueName,
        command: isRemoteServer
          ? ""
          : typeof command === "string"
            ? command
            : "",
        args:
          !isRemoteServer && Array.isArray(args)
            ? args.filter((arg) => typeof arg === "string")
            : [],
        env,
        autoStart: false,
        disabled: false,
        serverType: isRemoteServer ? remoteServerType : ("local" as const),
        remoteUrl: isRemoteServer ? remoteUrl : undefined,
        bearerToken: isRemoteServer ? bearerToken : undefined,
      };

      results.push({
        name: uniqueName,
        originalName: serverName !== uniqueName ? serverName : undefined,
        success: true,
        server: mcpServerConfig,
      });
    } catch (error: any) {
      results.push({
        name: serverName,
        success: false,
        message: `Error processing server: ${error.message}`,
      });
    }
  }

  return results;
}

/**
 * Builds standard mcpServers JSON from current server list.
 * Remote servers are exported as mcp-proxy style for broad client compatibility.
 */
export function buildStandardMcpServersJson(servers: MCPServer[]): {
  mcpServers: Record<
    string,
    { command: string; args?: string[]; env?: Record<string, string> }
  >;
} {
  const mcpServers: Record<
    string,
    { command: string; args?: string[]; env?: Record<string, string> }
  > = {};

  for (const server of servers) {
    if (!server?.name) {
      continue;
    }

    if (server.serverType === "local") {
      if (!server.command || !server.command.trim()) {
        continue;
      }

      const entry: {
        command: string;
        args?: string[];
        env?: Record<string, string>;
      } = {
        command: server.command.trim(),
      };

      const args = Array.isArray(server.args)
        ? server.args.filter((arg): arg is string => typeof arg === "string")
        : [];
      if (args.length > 0) {
        entry.args = args;
      }

      const env = normalizeEnv(server.env);
      if (Object.keys(env).length > 0) {
        entry.env = env;
      }

      mcpServers[server.name] = entry;
      continue;
    }

    if (server.remoteUrl && isHttpUrl(server.remoteUrl)) {
      mcpServers[server.name] = {
        command: "mcp-proxy",
        args: [normalizeHttpUrl(server.remoteUrl)],
      };
    }
  }

  return { mcpServers };
}
