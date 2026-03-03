import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getUserShellEnv } from "@/main/utils/env-utils";
import { logError, logInfo } from "@/main/utils/logger";
import {
  MCPServerConfig,
  MCPConnectionResult,
  MCPInputParam,
} from "@mcp_router/shared";

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

function isMcpProxyCommand(command: unknown): boolean {
  if (typeof command !== "string") {
    return false;
  }

  const normalized = stripOuterQuotes(command)
    .replace(/\\/g, "/")
    .toLowerCase();
  return normalized.endsWith("/mcp-proxy") || normalized.endsWith("mcp-proxy");
}

function normalizeArgs(args: unknown): string[] {
  if (!Array.isArray(args)) {
    return [];
  }

  return args
    .filter((arg): arg is string => typeof arg === "string")
    .map((arg) => stripOuterQuotes(arg));
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

function inferServerTypeFromArgsAndUrl(
  args: string[],
  remoteUrl: string,
): "remote" | "remote-streamable" {
  const transportFlagIndex = args.findIndex((arg) => arg === "--transport");
  if (transportFlagIndex >= 0 && transportFlagIndex + 1 < args.length) {
    const transport = args[transportFlagIndex + 1].toLowerCase();
    if (transport === "sse") {
      return "remote";
    }
    if (
      transport === "streamable-http" ||
      transport === "streamable" ||
      transport === "http"
    ) {
      return "remote-streamable";
    }
  }

  if (args.includes("--sse")) {
    return "remote";
  }

  try {
    const parsed = new URL(remoteUrl);
    const pathname = parsed.pathname.toLowerCase();
    const transportParam = parsed.searchParams.get("transport")?.toLowerCase();

    if (
      pathname.endsWith("/sse") ||
      pathname.includes("/sse/") ||
      transportParam === "sse"
    ) {
      return "remote";
    }
  } catch {
    // Ignore parse errors and fallback to streamable mode
  }

  return "remote-streamable";
}

function extractBearerToken(server: MCPServerConfig): string | undefined {
  if (typeof server.bearerToken === "string" && server.bearerToken.trim()) {
    return server.bearerToken.trim();
  }

  const env = server.env || {};
  const authHeader = env.AUTHORIZATION || env.authorization;
  if (typeof authHeader === "string" && authHeader.trim()) {
    const trimmed = authHeader.trim();
    return trimmed.toLowerCase().startsWith("bearer ")
      ? trimmed.slice(7).trim()
      : trimmed;
  }

  return undefined;
}

type ResolvedRemoteServerConfig = {
  serverType: "remote" | "remote-streamable";
  remoteUrl: string;
  bearerToken?: string;
};

export function resolveRemoteServerConfig(
  server: MCPServerConfig,
): ResolvedRemoteServerConfig | null {
  if (
    server.serverType === "remote" ||
    server.serverType === "remote-streamable"
  ) {
    if (!server.remoteUrl || !isHttpUrl(server.remoteUrl)) {
      return null;
    }

    return {
      serverType: server.serverType,
      remoteUrl: stripOuterQuotes(server.remoteUrl),
      bearerToken: extractBearerToken(server),
    };
  }

  const args = normalizeArgs(server.args);
  const command =
    typeof server.command === "string" ? stripOuterQuotes(server.command) : "";

  let remoteUrl: string | undefined;

  if (isHttpUrl(server.remoteUrl)) {
    remoteUrl = stripOuterQuotes(server.remoteUrl);
  } else if (isHttpUrl(command)) {
    remoteUrl = command;
  } else if (
    isMcpProxyCommand(command) ||
    args.some((arg) => isMcpProxyCommand(arg))
  ) {
    remoteUrl = findRemoteUrlFromArgs(args);
  }

  if (!remoteUrl) {
    return null;
  }

  return {
    serverType: inferServerTypeFromArgsAndUrl(args, remoteUrl),
    remoteUrl,
    bearerToken: extractBearerToken(server),
  };
}

/**
 * MCPクライアント接続機能を提供するクラス
 */
export class MCPClient {
  /**
   * Creates an MCP client and connects to the specified server
   */
  public async connectToMCPServer(
    server: MCPServerConfig,
    clientName = "mcp-client",
  ): Promise<MCPConnectionResult> {
    try {
      // Create MCP client
      const client = new Client({
        name: clientName,
        version: "1.0.0",
      });
      const resolvedRemoteConfig = resolveRemoteServerConfig(server);

      // Choose transport based on server type
      if (resolvedRemoteConfig?.serverType === "remote-streamable") {
        // Use StreamableHTTP transport for remote-streamable servers
        const transport = new StreamableHTTPClientTransport(
          new URL(resolvedRemoteConfig.remoteUrl),
          {
            sessionId: undefined,
            requestInit: {
              headers: {
                authorization: resolvedRemoteConfig.bearerToken
                  ? `Bearer ${resolvedRemoteConfig.bearerToken}`
                  : "",
              },
            },
          },
        );
        await client.connect(transport);
      } else if (resolvedRemoteConfig?.serverType === "remote") {
        // Use SSE transport for remote servers
        const headers: Record<string, string> = {
          Accept: "text/event-stream",
        };

        if (resolvedRemoteConfig.bearerToken) {
          headers["authorization"] =
            `Bearer ${resolvedRemoteConfig.bearerToken}`;
        }

        const transport = new SSEClientTransport(
          new URL(resolvedRemoteConfig.remoteUrl),
          {
            eventSourceInit: {
              fetch: (url, init) => globalThis.fetch(url, { ...init, headers }),
            },
            requestInit: {
              headers,
            },
          },
        );
        await client.connect(transport);
      } else if (server.serverType === "local") {
        // Local server - check if command is provided
        if (!server.command) {
          throw new Error(
            "Server configuration error: command must be provided for local servers",
          );
        }

        // Get environment variables from user shell
        const userEnvs = await getUserShellEnv();

        // Filter out undefined values from userEnvs
        const cleanUserEnvs = Object.entries(userEnvs).reduce(
          (acc, [key, value]) => {
            if (value !== undefined) {
              acc[key] = value;
            }
            return acc;
          },
          {} as Record<string, string>,
        );

        // Merge environment variables
        const mergedEnv = {
          ...cleanUserEnvs,
          ...server.env,
        };

        // Use Stdio transport for local servers
        const transport = new StdioClientTransport({
          command: server.command,
          args: server.args,
          env: mergedEnv,
        });
        await client.connect(transport);
      } else {
        throw new Error(
          `Unsupported server type: ${(server as any).serverType}`,
        );
      }

      logInfo(`Successfully connected to MCP server: ${server.name}`);
      return {
        status: "success",
        client,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logError(`Failed to connect to MCP server: ${errorMessage}`);
      return {
        status: "error",
        error: errorMessage,
      };
    }
  }

  /**
   * Fetches available tools from MCP server
   */
  public async fetchServerTools(client: Client): Promise<any[]> {
    try {
      const response = await client.listTools();
      return response.tools;
    } catch (error) {
      logError(`Failed to fetch tools: ${error}`);
      return [];
    }
  }

  /**
   * Fetches available resources from MCP server
   */
  public async fetchServerResources(client: Client): Promise<any[]> {
    try {
      const response = await client.listResources();
      return response.resources;
    } catch (error) {
      logError(`Failed to fetch resources: ${error}`);
      return [];
    }
  }

  /**
   * Reads a specific resource from MCP server
   */
  public async readServerResource(
    client: Client,
    resourceUri: string,
  ): Promise<any> {
    try {
      const response = await client.readResource({ uri: resourceUri });
      return response.contents;
    } catch (error) {
      logError(`Failed to read resource: ${error}`);
      return null;
    }
  }

  /**
   * Substitutes parameter values with actual arguments
   */
  public substituteArgsParameters(
    argsTemplate: string[],
    env: Record<string, string>,
    inputParams: Record<string, MCPInputParam>,
  ): string[] {
    return argsTemplate.map((arg) => {
      // Check if arg is a placeholder like "${paramName}" or "${user_config.paramName}"
      const match = arg.match(/^\$\{(.+)\}$/);
      if (match) {
        const fullParamName = match[1];

        // Handle user_config.paramName format
        if (fullParamName.startsWith("user_config.")) {
          const paramName = fullParamName.substring("user_config.".length);
          if (inputParams[paramName]) {
            const param = inputParams[paramName];
            if (param.default !== undefined) {
              return String(param.default);
            }
          }
        }

        // First check env variables
        if (env[fullParamName]) {
          return env[fullParamName];
        }

        // Then check input params
        if (inputParams[fullParamName]) {
          const param = inputParams[fullParamName];
          if (param.default !== undefined) {
            return String(param.default);
          }
        }
      }
      return arg;
    });
  }
}
