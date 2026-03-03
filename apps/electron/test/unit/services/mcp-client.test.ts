import { describe, expect, it } from "vitest";
import type { MCPServerConfig } from "@mcp_router/shared";
import { resolveRemoteServerConfig } from "@/main/modules/mcp-apps-manager/mcp-client";

describe("resolveRemoteServerConfig", () => {
  it("uses explicit remote config as-is", () => {
    const server: MCPServerConfig = {
      id: "remote-1",
      name: "exa",
      serverType: "remote-streamable",
      remoteUrl: "https://mcp.exa.ai/mcp",
      bearerToken: "token-1",
      env: {},
    };

    const resolved = resolveRemoteServerConfig(server);

    expect(resolved).toEqual({
      serverType: "remote-streamable",
      remoteUrl: "https://mcp.exa.ai/mcp",
      bearerToken: "token-1",
    });
  });

  it("converts legacy local mcp-proxy config to remote", () => {
    const server: MCPServerConfig = {
      id: "legacy-1",
      name: "deepwiki",
      serverType: "local",
      command: "mcp-proxy",
      args: ["https://mcp.deepwiki.com/sse"],
      env: {},
    };

    const resolved = resolveRemoteServerConfig(server);

    expect(resolved).toEqual({
      serverType: "remote",
      remoteUrl: "https://mcp.deepwiki.com/sse",
      bearerToken: undefined,
    });
  });

  it("supports URL directly in command field", () => {
    const server: MCPServerConfig = {
      id: "legacy-2",
      name: "url-command",
      serverType: "local",
      command: "https://example.com/mcp",
      env: {},
    };

    const resolved = resolveRemoteServerConfig(server);

    expect(resolved?.serverType).toBe("remote-streamable");
    expect(resolved?.remoteUrl).toBe("https://example.com/mcp");
  });

  it("extracts bearer token from env authorization header", () => {
    const server: MCPServerConfig = {
      id: "legacy-3",
      name: "auth-remote",
      serverType: "local",
      command: "mcp-proxy",
      args: ["https://example.com/sse"],
      env: {
        AUTHORIZATION: "Bearer env-token",
      },
    };

    const resolved = resolveRemoteServerConfig(server);

    expect(resolved?.bearerToken).toBe("env-token");
  });

  it("returns null for regular local server config", () => {
    const server: MCPServerConfig = {
      id: "local-1",
      name: "filesystem",
      serverType: "local",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem"],
      env: {},
    };

    const resolved = resolveRemoteServerConfig(server);
    expect(resolved).toBeNull();
  });
});
