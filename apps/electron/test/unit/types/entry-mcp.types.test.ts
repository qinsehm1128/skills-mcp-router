/**
 * Entry MCP Types - TDD Tests
 * 测试入口MCP相关类型定义的正确性
 */

import { describe, it, expect } from "vitest";
import type {
  EntryMCPConfig,
  ListMCPToolsParams,
  ListMCPToolsResult,
  CallMCPToolParams,
  CallMCPToolResult,
  MCPToolInfo,
  MCPServerInfo,
} from "@mcp_router/shared";

describe("Entry MCP Types", () => {
  describe("EntryMCPConfig", () => {
    it("should have required properties", () => {
      const config: EntryMCPConfig = {
        enabled: true,
        port: 3282,
        exposeOriginalTools: false,
      };

      expect(config).toHaveProperty("enabled");
      expect(config).toHaveProperty("port");
      expect(config).toHaveProperty("exposeOriginalTools");
    });

    it("should allow optional description property", () => {
      const config: EntryMCPConfig = {
        enabled: true,
        port: 3282,
        exposeOriginalTools: false,
        description: "入口MCP服务器，提供统一的工具访问接口",
      };

      expect(config.description).toBeDefined();
    });
  });

  describe("ListMCPToolsParams", () => {
    it("should allow optional mcpName filter", () => {
      const params: ListMCPToolsParams = {
        mcpName: "filesystem",
      };

      expect(params).toHaveProperty("mcpName");
    });

    it("should work without any parameters", () => {
      const params: ListMCPToolsParams = {};

      expect(params).toBeDefined();
    });

    it("should allow optional projectId filter", () => {
      const params: ListMCPToolsParams = {
        projectId: "project-123",
      };

      expect(params).toHaveProperty("projectId");
    });
  });

  describe("ListMCPToolsResult", () => {
    it("should return array of MCP server info with tools", () => {
      const result: ListMCPToolsResult = {
        servers: [
          {
            name: "filesystem",
            description: "文件系统操作",
            status: "running",
            toolCount: 2,
            tools: [
              {
                name: "read_file",
                description: "读取文件内容",
              },
              {
                name: "write_file",
                description: "写入文件内容",
              },
            ],
          },
        ],
      };

      expect(result).toHaveProperty("servers");
      expect(Array.isArray(result.servers)).toBe(true);
      expect(result.servers[0]).toHaveProperty("tools");
    });
  });

  describe("CallMCPToolParams", () => {
    it("should have required mcpName and toolName properties", () => {
      const params: CallMCPToolParams = {
        mcpName: "filesystem",
        toolName: "read_file",
        arguments: {
          path: "/path/to/file.txt",
        },
      };

      expect(params).toHaveProperty("mcpName");
      expect(params).toHaveProperty("toolName");
      expect(params).toHaveProperty("arguments");
    });

    it("should allow empty arguments", () => {
      const params: CallMCPToolParams = {
        mcpName: "system",
        toolName: "get_info",
        arguments: {},
      };

      expect(params.arguments).toEqual({});
    });
  });

  describe("CallMCPToolResult", () => {
    it("should have content array with results", () => {
      const result: CallMCPToolResult = {
        content: [
          {
            type: "text",
            text: "File content here...",
          },
        ],
        isError: false,
      };

      expect(result).toHaveProperty("content");
      expect(result).toHaveProperty("isError");
      expect(Array.isArray(result.content)).toBe(true);
    });

    it("should support error responses", () => {
      const result: CallMCPToolResult = {
        content: [
          {
            type: "text",
            text: "Error: File not found",
          },
        ],
        isError: true,
        errorCode: "FILE_NOT_FOUND",
      };

      expect(result.isError).toBe(true);
      expect(result).toHaveProperty("errorCode");
    });
  });

  describe("MCPToolInfo", () => {
    it("should have name, description and inputSchema", () => {
      const toolInfo: MCPToolInfo = {
        name: "read_file",
        description: "读取指定路径的文件内容",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "文件路径",
            },
          },
          required: ["path"],
        },
      };

      expect(toolInfo).toHaveProperty("name");
      expect(toolInfo).toHaveProperty("description");
      expect(toolInfo).toHaveProperty("inputSchema");
    });
  });

  describe("MCPServerInfo", () => {
    it("should have name, description, status and tools array", () => {
      const serverInfo: MCPServerInfo = {
        name: "filesystem",
        description: "文件系统操作MCP服务器",
        status: "running",
        toolCount: 5,
        tools: [],
      };

      expect(serverInfo).toHaveProperty("name");
      expect(serverInfo).toHaveProperty("description");
      expect(serverInfo).toHaveProperty("status");
      expect(serverInfo).toHaveProperty("toolCount");
    });
  });
});
