/**
 * Skills Types - TDD Tests
 * 测试Skills相关类型定义的正确性
 */

import { describe, it, expect } from "vitest";
import type {
  SkillsConfig,
  SkillsOutputPath,
  MCPServerSummary,
  SkillsFormat,
  SkillsContent,
} from "@mcp_router/shared";

describe("Skills Types", () => {
  describe("SkillsConfig", () => {
    it("should have required properties", () => {
      const config: SkillsConfig = {
        enabled: true,
        outputPaths: [],
        format: "markdown",
        autoSync: true,
      };

      expect(config).toHaveProperty("enabled");
      expect(config).toHaveProperty("outputPaths");
      expect(config).toHaveProperty("format");
      expect(config).toHaveProperty("autoSync");
    });

    it("should allow optional customTemplate property", () => {
      const config: SkillsConfig = {
        enabled: true,
        outputPaths: [],
        format: "markdown",
        autoSync: true,
        customTemplate: "# Custom Skills\n{{skills}}",
      };

      expect(config.customTemplate).toBe("# Custom Skills\n{{skills}}");
    });
  });

  describe("SkillsOutputPath", () => {
    it("should have required path and type properties", () => {
      const outputPath: SkillsOutputPath = {
        id: "path-1",
        path: "/path/to/.skills",
        type: "custom",
        enabled: true,
      };

      expect(outputPath).toHaveProperty("id");
      expect(outputPath).toHaveProperty("path");
      expect(outputPath).toHaveProperty("type");
      expect(outputPath).toHaveProperty("enabled");
    });

    it("should support preset types", () => {
      const presetTypes: SkillsOutputPath["type"][] = ["cursor", "cline", "windsurf", "custom"];
      
      presetTypes.forEach((type) => {
        const outputPath: SkillsOutputPath = {
          id: `path-${type}`,
          path: `/path/to/${type}/.skills`,
          type,
          enabled: true,
        };
        expect(presetTypes).toContain(outputPath.type);
      });
    });
  });

  describe("MCPServerSummary", () => {
    it("should have name and description properties", () => {
      const summary: MCPServerSummary = {
        name: "filesystem",
        description: "文件系统操作，包括读写文件、目录管理",
        enabled: true,
      };

      expect(summary).toHaveProperty("name");
      expect(summary).toHaveProperty("description");
      expect(summary).toHaveProperty("enabled");
    });

    it("should allow optional toolCount property", () => {
      const summary: MCPServerSummary = {
        name: "github",
        description: "GitHub操作",
        enabled: true,
        toolCount: 15,
      };

      expect(summary.toolCount).toBe(15);
    });
  });

  describe("SkillsFormat", () => {
    it("should support markdown, yaml, and json formats", () => {
      const validFormats: SkillsFormat[] = ["markdown", "yaml", "json"];
      
      validFormats.forEach((format) => {
        expect(validFormats).toContain(format);
      });
    });
  });

  describe("SkillsContent", () => {
    it("should have servers array and metadata", () => {
      const content: SkillsContent = {
        servers: [
          {
            name: "filesystem",
            description: "文件系统操作",
            enabled: true,
          },
        ],
        generatedAt: new Date().toISOString(),
        version: "1.0.0",
      };

      expect(content).toHaveProperty("servers");
      expect(content).toHaveProperty("generatedAt");
      expect(content).toHaveProperty("version");
      expect(Array.isArray(content.servers)).toBe(true);
    });
  });
});
