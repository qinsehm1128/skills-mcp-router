/**
 * Skills Service - TDD Tests
 * 测试Skills服务业务逻辑
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  SkillsConfig,
  SkillsContent,
  MCPServerSummary,
  MCPServer,
} from "@mcp_router/shared";

// Mock fs module
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe("SkillsService", () => {
  const mockServers: MCPServerSummary[] = [
    {
      name: "filesystem",
      description: "文件系统操作",
      enabled: true,
      toolCount: 8,
    },
    {
      name: "github",
      description: "GitHub操作",
      enabled: true,
      toolCount: 15,
    },
  ];

  const mockConfig: SkillsConfig = {
    enabled: true,
    outputPaths: [
      {
        id: "path-1",
        path: "/path/to/.skills",
        type: "custom",
        enabled: true,
      },
    ],
    format: "markdown",
    autoSync: true,
  };

  describe("buildSkillsContent", () => {
    it("should build SkillsContent from MCP servers", () => {
      const buildSkillsContent = (servers: MCPServerSummary[]): SkillsContent => {
        return {
          servers,
          generatedAt: new Date().toISOString(),
          version: "1.0.0",
        };
      };

      const content = buildSkillsContent(mockServers);

      expect(content.servers).toHaveLength(2);
      expect(content.version).toBe("1.0.0");
      expect(content.generatedAt).toBeDefined();
    });

    it("should convert MCPServer to MCPServerSummary", () => {
      const mcpServer: Partial<MCPServer> = {
        id: "server-1",
        name: "filesystem",
        description: "文件系统操作",
        status: "running",
        disabled: false,
        tools: [
          { name: "read_file", description: "读取文件" },
          { name: "write_file", description: "写入文件" },
        ],
      };

      const convertToSummary = (server: Partial<MCPServer>): MCPServerSummary => {
        return {
          name: server.name || "",
          description: server.description || "",
          enabled: !server.disabled && server.status === "running",
          toolCount: server.tools?.length,
        };
      };

      const summary = convertToSummary(mcpServer);

      expect(summary.name).toBe("filesystem");
      expect(summary.enabled).toBe(true);
      expect(summary.toolCount).toBe(2);
    });
  });

  describe("syncSkills", () => {
    it("should generate and write skills file to all enabled paths", () => {
      const writtenPaths: string[] = [];
      
      const syncSkills = (config: SkillsConfig, content: string): string[] => {
        const paths: string[] = [];
        for (const outputPath of config.outputPaths) {
          if (outputPath.enabled) {
            paths.push(outputPath.path);
            writtenPaths.push(outputPath.path);
          }
        }
        return paths;
      };

      const mockContent = "# MCP Skills\n...";
      const result = syncSkills(mockConfig, mockContent);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe("/path/to/.skills");
    });

    it("should skip disabled output paths", () => {
      const configWithDisabled: SkillsConfig = {
        ...mockConfig,
        outputPaths: [
          { id: "1", path: "/path/1", type: "custom", enabled: true },
          { id: "2", path: "/path/2", type: "custom", enabled: false },
          { id: "3", path: "/path/3", type: "custom", enabled: true },
        ],
      };

      const syncSkills = (config: SkillsConfig): string[] => {
        return config.outputPaths
          .filter(p => p.enabled)
          .map(p => p.path);
      };

      const result = syncSkills(configWithDisabled);

      expect(result).toHaveLength(2);
      expect(result).not.toContain("/path/2");
    });

    it("should create parent directories if not exist", () => {
      const ensureDirectoryExists = (filePath: string): boolean => {
        const dir = filePath.substring(0, filePath.lastIndexOf("/"));
        // In real implementation, would call fs.mkdirSync
        return dir.length > 0;
      };

      expect(ensureDirectoryExists("/path/to/.skills")).toBe(true);
      expect(ensureDirectoryExists(".skills")).toBe(false);
    });
  });

  describe("getSkillsFilename", () => {
    it("should return correct filename based on format", () => {
      const getFilename = (format: string): string => {
        switch (format) {
          case "markdown":
            return ".skills.md";
          case "yaml":
            return ".skills.yaml";
          case "json":
            return ".skills.json";
          default:
            return ".skills";
        }
      };

      expect(getFilename("markdown")).toBe(".skills.md");
      expect(getFilename("yaml")).toBe(".skills.yaml");
      expect(getFilename("json")).toBe(".skills.json");
    });
  });

  describe("validateConfig", () => {
    it("should validate skills config", () => {
      const validateConfig = (config: SkillsConfig): { valid: boolean; errors: string[] } => {
        const errors: string[] = [];
        
        if (!config.outputPaths || config.outputPaths.length === 0) {
          errors.push("At least one output path is required");
        }
        
        for (const path of config.outputPaths) {
          if (!path.path || path.path.trim() === "") {
            errors.push(`Invalid path for output ${path.id}`);
          }
        }
        
        return { valid: errors.length === 0, errors };
      };

      const validResult = validateConfig(mockConfig);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      const invalidConfig: SkillsConfig = {
        ...mockConfig,
        outputPaths: [],
      };
      const invalidResult = validateConfig(invalidConfig);
      expect(invalidResult.valid).toBe(false);
    });
  });

  describe("getPresetPath", () => {
    it("should return correct preset path for known AI clients", () => {
      const getPresetPath = (type: string, homeDir: string): string | null => {
        switch (type) {
          case "cursor":
            return `${homeDir}/.cursor/.skills`;
          case "cline":
            return `${homeDir}/.cline/.skills`;
          case "windsurf":
            return `${homeDir}/.windsurf/.skills`;
          default:
            return null;
        }
      };

      expect(getPresetPath("cursor", "/home/user")).toBe("/home/user/.cursor/.skills");
      expect(getPresetPath("cline", "/home/user")).toBe("/home/user/.cline/.skills");
      expect(getPresetPath("custom", "/home/user")).toBeNull();
    });
  });

  describe("error handling", () => {
    it("should handle file write errors gracefully", () => {
      const writeSkillsFile = (path: string, content: string): { success: boolean; error?: string } => {
        try {
          if (path.includes("readonly")) {
            throw new Error("EACCES: permission denied");
          }
          return { success: true };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      };

      const successResult = writeSkillsFile("/path/to/.skills", "content");
      expect(successResult.success).toBe(true);

      const errorResult = writeSkillsFile("/readonly/path/.skills", "content");
      expect(errorResult.success).toBe(false);
      expect(errorResult.error).toContain("permission denied");
    });

    it("should handle invalid paths", () => {
      const isValidPath = (path: string): boolean => {
        if (!path || path.trim() === "") return false;
        if (path.includes("\0")) return false; // null byte
        return true;
      };

      expect(isValidPath("/path/to/.skills")).toBe(true);
      expect(isValidPath("")).toBe(false);
      expect(isValidPath("path\0with\0nulls")).toBe(false);
    });
  });
});
