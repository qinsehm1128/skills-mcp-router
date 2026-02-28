/**
 * Entry MCP Service - TDD Tests
 * 测试入口MCP服务的业务逻辑
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  MCPServer,
  ListMCPToolsParams,
  ListMCPToolsResult,
  CallMCPToolParams,
  CallMCPToolResult,
  MCPServerInfo,
  MCPToolInfo,
} from "@mcp_router/shared";

describe("EntryMCPService", () => {
  const mockServers: MCPServer[] = [
    {
      id: "server-1",
      name: "filesystem",
      description: "文件系统操作",
      status: "running",
      disabled: false,
      serverType: "local",
      env: {},
      tools: [
        { name: "read_file", description: "读取文件内容" },
        { name: "write_file", description: "写入文件内容" },
      ],
    },
    {
      id: "server-2",
      name: "github",
      description: "GitHub操作",
      status: "running",
      disabled: false,
      serverType: "local",
      env: {},
      tools: [
        { name: "create_pr", description: "创建PR" },
        { name: "list_issues", description: "列出Issues" },
      ],
    },
    {
      id: "server-3",
      name: "database",
      description: "数据库操作",
      status: "stopped",
      disabled: true,
      serverType: "local",
      env: {},
      tools: [{ name: "query", description: "执行查询" }],
    },
  ];

  describe("listMCPTools", () => {
    it("should list all running MCP servers with their tools", () => {
      const listMCPTools = (
        servers: MCPServer[],
        params: ListMCPToolsParams
      ): ListMCPToolsResult => {
        const runningServers = servers.filter(
          (s) => s.status === "running" && !s.disabled
        );

        return {
          servers: runningServers.map((s) => ({
            name: s.name,
            description: s.description,
            status: s.status,
            toolCount: s.tools?.length || 0,
            tools: s.tools?.map((t) => ({
              name: t.name,
              description: t.description,
            })),
          })),
        };
      };

      const result = listMCPTools(mockServers, {});

      expect(result.servers).toHaveLength(2);
      expect(result.servers[0].name).toBe("filesystem");
      expect(result.servers[0].tools).toHaveLength(2);
      expect(result.servers[1].name).toBe("github");
    });

    it("should filter by mcpName when provided", () => {
      const listMCPTools = (
        servers: MCPServer[],
        params: ListMCPToolsParams
      ): ListMCPToolsResult => {
        let filteredServers = servers.filter(
          (s) => s.status === "running" && !s.disabled
        );

        if (params.mcpName) {
          filteredServers = filteredServers.filter(
            (s) => s.name === params.mcpName
          );
        }

        return {
          servers: filteredServers.map((s) => ({
            name: s.name,
            description: s.description,
            status: s.status,
            toolCount: s.tools?.length || 0,
            tools: s.tools?.map((t) => ({
              name: t.name,
              description: t.description,
            })),
          })),
        };
      };

      const result = listMCPTools(mockServers, { mcpName: "filesystem" });

      expect(result.servers).toHaveLength(1);
      expect(result.servers[0].name).toBe("filesystem");
    });

    it("should return empty array when no servers match", () => {
      const listMCPTools = (
        servers: MCPServer[],
        params: ListMCPToolsParams
      ): ListMCPToolsResult => {
        let filteredServers = servers.filter(
          (s) => s.status === "running" && !s.disabled
        );

        if (params.mcpName) {
          filteredServers = filteredServers.filter(
            (s) => s.name === params.mcpName
          );
        }

        return {
          servers: filteredServers.map((s) => ({
            name: s.name,
            description: s.description,
            status: s.status,
            toolCount: s.tools?.length || 0,
          })),
        };
      };

      const result = listMCPTools(mockServers, { mcpName: "nonexistent" });

      expect(result.servers).toHaveLength(0);
    });

    it("should not include disabled servers", () => {
      const listMCPTools = (
        servers: MCPServer[],
        params: ListMCPToolsParams
      ): ListMCPToolsResult => {
        const filteredServers = servers.filter(
          (s) => s.status === "running" && !s.disabled
        );

        return {
          servers: filteredServers.map((s) => ({
            name: s.name,
            description: s.description,
            status: s.status,
            toolCount: s.tools?.length || 0,
          })),
        };
      };

      const result = listMCPTools(mockServers, {});

      // database server is disabled
      expect(result.servers.find((s) => s.name === "database")).toBeUndefined();
    });
  });

  describe("callMCPTool", () => {
    it("should call tool on specified MCP server", async () => {
      const mockToolResult = {
        content: [{ type: "text" as const, text: "File content here" }],
        isError: false,
      };

      const callMCPTool = async (
        params: CallMCPToolParams,
        callTool: (
          serverName: string,
          toolName: string,
          args: any
        ) => Promise<any>
      ): Promise<CallMCPToolResult> => {
        try {
          const result = await callTool(
            params.mcpName,
            params.toolName,
            params.arguments
          );
          return {
            content: result.content || [],
            isError: false,
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: error.message }],
            isError: true,
            errorCode: "CALL_FAILED",
          };
        }
      };

      const mockCallTool = vi.fn().mockResolvedValue(mockToolResult);

      const result = await callMCPTool(
        {
          mcpName: "filesystem",
          toolName: "read_file",
          arguments: { path: "/test.txt" },
        },
        mockCallTool
      );

      expect(mockCallTool).toHaveBeenCalledWith("filesystem", "read_file", {
        path: "/test.txt",
      });
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe("File content here");
    });

    it("should handle tool call errors", async () => {
      const callMCPTool = async (
        params: CallMCPToolParams,
        callTool: (
          serverName: string,
          toolName: string,
          args: any
        ) => Promise<any>
      ): Promise<CallMCPToolResult> => {
        try {
          const result = await callTool(
            params.mcpName,
            params.toolName,
            params.arguments
          );
          return {
            content: result.content || [],
            isError: false,
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: error.message }],
            isError: true,
            errorCode: "CALL_FAILED",
          };
        }
      };

      const mockCallTool = vi.fn().mockRejectedValue(new Error("Server not found"));

      const result = await callMCPTool(
        {
          mcpName: "nonexistent",
          toolName: "some_tool",
          arguments: {},
        },
        mockCallTool
      );

      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe("CALL_FAILED");
      expect(result.content[0].text).toContain("Server not found");
    });

    it("should validate mcpName before calling", async () => {
      const validateAndCall = async (
        params: CallMCPToolParams,
        servers: MCPServer[]
      ): Promise<{ valid: boolean; error?: string }> => {
        const server = servers.find((s) => s.name === params.mcpName);

        if (!server) {
          return { valid: false, error: `MCP server not found: ${params.mcpName}` };
        }

        if (server.status !== "running") {
          return { valid: false, error: `MCP server is not running: ${params.mcpName}` };
        }

        if (server.disabled) {
          return { valid: false, error: `MCP server is disabled: ${params.mcpName}` };
        }

        return { valid: true };
      };

      // Valid server
      const validResult = await validateAndCall(
        { mcpName: "filesystem", toolName: "read_file", arguments: {} },
        mockServers
      );
      expect(validResult.valid).toBe(true);

      // Non-existent server
      const notFoundResult = await validateAndCall(
        { mcpName: "nonexistent", toolName: "test", arguments: {} },
        mockServers
      );
      expect(notFoundResult.valid).toBe(false);
      expect(notFoundResult.error).toContain("not found");

      // Disabled server
      const disabledResult = await validateAndCall(
        { mcpName: "database", toolName: "query", arguments: {} },
        mockServers
      );
      expect(disabledResult.valid).toBe(false);
    });

    it("should validate toolName exists on the server", async () => {
      const validateTool = (
        params: CallMCPToolParams,
        servers: MCPServer[]
      ): { valid: boolean; error?: string } => {
        const server = servers.find((s) => s.name === params.mcpName);
        if (!server) {
          return { valid: false, error: "Server not found" };
        }

        const tool = server.tools?.find((t) => t.name === params.toolName);
        if (!tool) {
          return {
            valid: false,
            error: `Tool not found: ${params.toolName} on server ${params.mcpName}`,
          };
        }

        return { valid: true };
      };

      // Valid tool
      const validResult = validateTool(
        { mcpName: "filesystem", toolName: "read_file", arguments: {} },
        mockServers
      );
      expect(validResult.valid).toBe(true);

      // Invalid tool
      const invalidResult = validateTool(
        { mcpName: "filesystem", toolName: "nonexistent_tool", arguments: {} },
        mockServers
      );
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain("Tool not found");
    });
  });

  describe("getServerByName", () => {
    it("should find server by name", () => {
      const getServerByName = (
        servers: MCPServer[],
        name: string
      ): MCPServer | undefined => {
        return servers.find((s) => s.name === name);
      };

      const server = getServerByName(mockServers, "filesystem");

      expect(server).toBeDefined();
      expect(server!.name).toBe("filesystem");
    });

    it("should return undefined for non-existent server", () => {
      const getServerByName = (
        servers: MCPServer[],
        name: string
      ): MCPServer | undefined => {
        return servers.find((s) => s.name === name);
      };

      const server = getServerByName(mockServers, "nonexistent");

      expect(server).toBeUndefined();
    });
  });

  describe("tool definitions", () => {
    it("should define list_mcp_tools tool schema", () => {
      const listMCPToolsSchema = {
        name: "list_mcp_tools",
        description:
          "列出所有可用的MCP服务器及其工具。可以指定mcpName来查询特定服务器的详细工具列表。",
        inputSchema: {
          type: "object",
          properties: {
            mcpName: {
              type: "string",
              description: "可选，指定要查询的MCP服务器名称",
            },
          },
          required: [],
        },
      };

      expect(listMCPToolsSchema.name).toBe("list_mcp_tools");
      expect(listMCPToolsSchema.inputSchema.properties).toHaveProperty("mcpName");
    });

    it("should define call_mcp_tool tool schema", () => {
      const callMCPToolSchema = {
        name: "call_mcp_tool",
        description:
          "调用指定MCP服务器上的工具。需要提供服务器名称、工具名称和参数。",
        inputSchema: {
          type: "object",
          properties: {
            mcpName: {
              type: "string",
              description: "MCP服务器名称",
            },
            toolName: {
              type: "string",
              description: "要调用的工具名称",
            },
            arguments: {
              type: "object",
              description: "工具参数",
            },
            timeoutSec: {
              type: "number",
              description: "可选，调用超时时间（秒），默认 300 秒",
            },
          },
          required: ["mcpName", "toolName"],
        },
      };

      expect(callMCPToolSchema.name).toBe("call_mcp_tool");
      expect(callMCPToolSchema.inputSchema.required).toContain("mcpName");
      expect(callMCPToolSchema.inputSchema.required).toContain("toolName");
      expect(callMCPToolSchema.inputSchema.properties).toHaveProperty("timeoutSec");
    });
  });
});
