/**
 * Skills Generator - TDD Tests
 * 测试Skills文件生成器
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { SkillsContent, MCPServerSummary, SkillsFormat } from "@mcp_router/shared";
import { SkillsGenerator } from "@/main/modules/skills/skills.generator";

describe("SkillsGenerator", () => {
  let generator: SkillsGenerator;

  beforeEach(() => {
    generator = new SkillsGenerator();
  });

  const mockServers: MCPServerSummary[] = [
    {
      name: "filesystem",
      description: "文件系统操作，包括读写文件、目录管理、文件搜索等功能",
      enabled: true,
      toolCount: 8,
    },
    {
      name: "github",
      description: "GitHub操作，包括仓库管理、PR、Issue、代码搜索等功能",
      enabled: true,
      toolCount: 15,
    },
    {
      name: "database",
      description: "数据库操作，支持SQL查询、数据导入导出",
      enabled: false,
      toolCount: 5,
    },
  ];

  const mockContent: SkillsContent = {
    servers: mockServers,
    generatedAt: "2026-01-16T00:00:00.000Z",
    version: "1.0.0",
  };

  describe("generateMarkdown", () => {
    it("should generate valid markdown format", () => {
      const result = generator.generateMarkdown(mockContent);

      expect(result).toContain("# MCP Skills");
      expect(result).toContain("## filesystem");
      expect(result).toContain("## github");
      expect(result).not.toContain("## database"); // disabled server
      expect(result).toContain("文件系统操作");
      expect(result).toContain("Tools: 8");
    });

    it("should only include enabled servers", () => {
      const result = generator.generateMarkdown(mockContent);
      const enabledCount = (result.match(/## /g) || []).length;

      expect(enabledCount).toBe(2); // only filesystem and github
    });

    it("should include generation timestamp", () => {
      const result = generator.generateMarkdown(mockContent);

      expect(result).toContain("2026-01-16");
    });
  });

  describe("generateYAML", () => {
    it("should generate valid YAML format", () => {
      const result = generator.generateYAML(mockContent);

      expect(result).toContain("version:");
      expect(result).toContain("servers:");
      expect(result).toContain('"filesystem"');
      expect(result).toContain('"github"');
      expect(result).not.toContain('"database"');
    });

    it("should escape special characters in YAML strings", () => {
      const contentWithSpecialChars: SkillsContent = {
        servers: [
          {
            name: "test-server",
            description: 'Description with "quotes" and special: chars',
            enabled: true,
          },
        ],
        generatedAt: "2026-01-16T00:00:00.000Z",
        version: "1.0.0",
      };

      const result = generator.generateYAML(contentWithSpecialChars);

      expect(result).toContain('\\"quotes\\"');
    });
  });

  describe("generateJSON", () => {
    it("should generate valid JSON format", () => {
      const result = generator.generateJSON(mockContent);
      const parsed = JSON.parse(result);

      expect(parsed.servers).toHaveLength(2);
      expect(parsed.version).toBe("1.0.0");
      expect(parsed.generatedAt).toBeDefined();
    });

    it("should be parseable back to SkillsContent", () => {
      const jsonStr = generator.generateJSON(mockContent);
      const parsed: SkillsContent = JSON.parse(jsonStr);

      expect(parsed.servers).toHaveLength(2); // only enabled servers
      expect(parsed.version).toBe(mockContent.version);
    });
  });

  describe("generate (unified method)", () => {
    it("should generate content based on format parameter", () => {
      expect(generator.generate(mockContent, "markdown")).toContain("#");
      expect(generator.generate(mockContent, "yaml")).toContain("servers:");
      expect(generator.generate(mockContent, "json")).toContain("{");
    });

    it("should throw error for unsupported format", () => {
      expect(() => generator.generate(mockContent, "xml" as any)).toThrow("Unsupported format");
    });
  });

  describe("custom template support", () => {
    it("should support custom markdown template", () => {
      const customTemplate = `# My Custom Skills
Version: {{version}}
Generated: {{generatedAt}}

## Available MCPs
{{servers}}
`;

      const result = generator.applyTemplate(customTemplate, mockContent);

      expect(result).toContain("# My Custom Skills");
      expect(result).toContain("Version: 1.0.0");
      expect(result).toContain("**filesystem**");
      expect(result).toContain("**github**");
    });
  });

  describe("edge cases", () => {
    it("should handle empty servers array", () => {
      const emptyContent: SkillsContent = {
        servers: [],
        generatedAt: new Date().toISOString(),
        version: "1.0.0",
      };

      const result = generator.generateMarkdown(emptyContent);

      expect(result).toContain("No MCP servers configured");
    });

    it("should handle servers with missing optional fields", () => {
      const minimalContent: SkillsContent = {
        servers: [
          {
            name: "minimal",
            description: "Minimal server",
            enabled: true,
          },
        ],
        generatedAt: new Date().toISOString(),
        version: "1.0.0",
      };

      const result = generator.generateMarkdown(minimalContent);

      expect(result).toContain("## minimal");
      expect(result).not.toContain("Tools:");
    });

    it("should handle special characters in server names", () => {
      const specialContent: SkillsContent = {
        servers: [
          {
            name: "my-server_v2.0",
            description: "Server with special characters in name",
            enabled: true,
          },
        ],
        generatedAt: new Date().toISOString(),
        version: "1.0.0",
      };

      const result = generator.generateMarkdown(specialContent);

      expect(result).toContain("## my-server_v2.0");
    });
  });
});
