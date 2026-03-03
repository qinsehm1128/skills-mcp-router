import { describe, expect, it } from "vitest";
import type { MCPServer } from "@mcp_router/shared";
import {
  buildStandardMcpServersJson,
  processMcpServerConfigs,
  validateMcpServerJson,
} from "@/renderer/components/mcp/server/utils/mcp-server-utils";

describe("mcp-server-utils", () => {
  describe("validateMcpServerJson", () => {
    it("accepts command-based local server config", () => {
      const input = {
        mcpServers: {
          filesystem: {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem"],
          },
        },
      };

      const result = validateMcpServerJson(input);
      expect(result.valid).toBe(true);
    });

    it("accepts URL-based remote server config without command", () => {
      const input = {
        mcpServers: {
          exa: {
            url: "https://mcp.exa.ai/mcp",
          },
        },
      };

      const result = validateMcpServerJson(input);
      expect(result.valid).toBe(true);
    });

    it("rejects server config with neither command nor remote URL", () => {
      const input = {
        mcpServers: {
          broken: {
            env: { TOKEN: "x" },
          },
        },
      };

      const result = validateMcpServerJson(input);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Missing command or remote URL");
    });
  });

  describe("processMcpServerConfigs", () => {
    it("maps mcp-proxy URL config to remote server", () => {
      const result = processMcpServerConfigs(
        {
          deepwiki: {
            command: "mcp-proxy",
            args: ["https://mcp.deepwiki.com/sse"],
          },
        },
        new Set<string>(),
      );

      expect(result).toHaveLength(1);
      expect(result[0].success).toBe(true);
      expect(result[0].server?.serverType).toBe("remote");
      expect(result[0].server?.remoteUrl).toBe("https://mcp.deepwiki.com/sse");
      expect(result[0].server?.command).toBe("");
    });

    it("infers streamable remote type for /mcp endpoint", () => {
      const result = processMcpServerConfigs(
        {
          exa: {
            url: "https://mcp.exa.ai/mcp",
          },
        },
        new Set<string>(),
      );

      expect(result[0].server?.serverType).toBe("remote-streamable");
      expect(result[0].server?.remoteUrl).toBe("https://mcp.exa.ai/mcp");
    });

    it("renames duplicate server names", () => {
      const result = processMcpServerConfigs(
        {
          exa: {
            command: "mcp-proxy",
            args: ["https://mcp.exa.ai/mcp"],
          },
        },
        new Set<string>(["exa"]),
      );

      expect(result[0].name).toBe("exa-2");
      expect(result[0].originalName).toBe("exa");
    });
  });

  describe("buildStandardMcpServersJson", () => {
    it("exports local and remote servers into standard mcpServers format", () => {
      const servers: MCPServer[] = [
        {
          id: "local-1",
          name: "filesystem",
          serverType: "local",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem"],
          env: { FOO: "bar" },
          status: "stopped",
        },
        {
          id: "remote-1",
          name: "deepwiki",
          serverType: "remote",
          remoteUrl: "https://mcp.deepwiki.com/sse",
          env: {},
          status: "stopped",
        },
      ];

      const exported = buildStandardMcpServersJson(servers);

      expect(exported).toEqual({
        mcpServers: {
          filesystem: {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem"],
            env: { FOO: "bar" },
          },
          deepwiki: {
            command: "mcp-proxy",
            args: ["https://mcp.deepwiki.com/sse"],
          },
        },
      });
    });
  });
});
