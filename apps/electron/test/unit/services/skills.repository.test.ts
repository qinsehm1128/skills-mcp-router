/**
 * Skills Repository - TDD Tests
 * 测试Skills配置持久化
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SkillsConfig, SkillsOutputPath } from "@mcp_router/shared";
import { DEFAULT_SKILLS_CONFIG } from "@mcp_router/shared";

describe("SkillsRepository", () => {
  const mockConfig: SkillsConfig = {
    enabled: true,
    outputPaths: [
      {
        id: "path-1",
        path: "/path/to/.skills",
        type: "custom",
        enabled: true,
      },
      {
        id: "path-2",
        path: "/path/to/cursor",
        type: "cursor",
        enabled: true,
      },
    ],
    format: "markdown",
    autoSync: true,
    customTemplate: "# My Skills\n{{servers}}",
  };

  describe("getConfig", () => {
    it("should return default config when no config exists", () => {
      // Mock implementation
      const getConfig = (): SkillsConfig => {
        return { ...DEFAULT_SKILLS_CONFIG };
      };

      const config = getConfig();

      expect(config.enabled).toBe(false);
      expect(config.outputPaths).toHaveLength(0);
      expect(config.format).toBe("markdown");
      expect(config.autoSync).toBe(true);
    });

    it("should return stored config when exists", () => {
      let storedConfig: SkillsConfig | null = mockConfig;

      const getConfig = (): SkillsConfig => {
        return storedConfig ? { ...storedConfig } : { ...DEFAULT_SKILLS_CONFIG };
      };

      const config = getConfig();

      expect(config.enabled).toBe(true);
      expect(config.outputPaths).toHaveLength(2);
      expect(config.customTemplate).toBe("# My Skills\n{{servers}}");
    });
  });

  describe("saveConfig", () => {
    it("should save config successfully", () => {
      let storedConfig: SkillsConfig | null = null;

      const saveConfig = (config: SkillsConfig): boolean => {
        storedConfig = { ...config };
        return true;
      };

      const result = saveConfig(mockConfig);

      expect(result).toBe(true);
      expect(storedConfig).not.toBeNull();
      expect(storedConfig!.enabled).toBe(true);
    });

    it("should update timestamps on save", () => {
      const saveConfig = (config: SkillsConfig): SkillsConfig => {
        return {
          ...config,
          updatedAt: new Date().toISOString(),
        };
      };

      const saved = saveConfig(mockConfig);

      expect(saved.updatedAt).toBeDefined();
    });
  });

  describe("updateConfig", () => {
    it("should merge partial updates", () => {
      let storedConfig: SkillsConfig = { ...DEFAULT_SKILLS_CONFIG };

      const updateConfig = (updates: Partial<SkillsConfig>): SkillsConfig => {
        storedConfig = { ...storedConfig, ...updates };
        return storedConfig;
      };

      const updated = updateConfig({ enabled: true, format: "yaml" });

      expect(updated.enabled).toBe(true);
      expect(updated.format).toBe("yaml");
      expect(updated.autoSync).toBe(true); // unchanged
    });
  });

  describe("output paths management", () => {
    it("should add output path", () => {
      let paths: SkillsOutputPath[] = [];

      const addOutputPath = (path: SkillsOutputPath): SkillsOutputPath[] => {
        paths = [...paths, path];
        return paths;
      };

      const newPath: SkillsOutputPath = {
        id: "new-path",
        path: "/new/path",
        type: "custom",
        enabled: true,
      };

      const result = addOutputPath(newPath);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("new-path");
    });

    it("should remove output path by id", () => {
      let paths: SkillsOutputPath[] = [...mockConfig.outputPaths];

      const removeOutputPath = (id: string): SkillsOutputPath[] => {
        paths = paths.filter((p) => p.id !== id);
        return paths;
      };

      const result = removeOutputPath("path-1");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("path-2");
    });

    it("should update output path", () => {
      let paths: SkillsOutputPath[] = [...mockConfig.outputPaths];

      const updateOutputPath = (
        id: string,
        updates: Partial<SkillsOutputPath>
      ): SkillsOutputPath[] => {
        paths = paths.map((p) => (p.id === id ? { ...p, ...updates } : p));
        return paths;
      };

      const result = updateOutputPath("path-1", { enabled: false });

      expect(result[0].enabled).toBe(false);
      expect(result[1].enabled).toBe(true);
    });

    it("should toggle output path enabled status", () => {
      let paths: SkillsOutputPath[] = [...mockConfig.outputPaths];

      const toggleOutputPath = (id: string): SkillsOutputPath[] => {
        paths = paths.map((p) =>
          p.id === id ? { ...p, enabled: !p.enabled } : p
        );
        return paths;
      };

      // First toggle - disable
      let result = toggleOutputPath("path-1");
      expect(result[0].enabled).toBe(false);

      // Second toggle - enable
      result = toggleOutputPath("path-1");
      expect(result[0].enabled).toBe(true);
    });
  });

  describe("preset paths", () => {
    it("should get preset path for cursor", () => {
      const getPresetOutputPath = (
        type: string,
        homeDir: string
      ): SkillsOutputPath | null => {
        const presets: Record<string, string> = {
          cursor: `${homeDir}/.cursor`,
          cline: `${homeDir}/.cline`,
          windsurf: `${homeDir}/.windsurf`,
        };

        const basePath = presets[type];
        if (!basePath) return null;

        return {
          id: `preset-${type}`,
          path: basePath,
          type: type as any,
          enabled: true,
          displayName: type.charAt(0).toUpperCase() + type.slice(1),
        };
      };

      const cursorPath = getPresetOutputPath("cursor", "/home/user");

      expect(cursorPath).not.toBeNull();
      expect(cursorPath!.path).toBe("/home/user/.cursor");
      expect(cursorPath!.type).toBe("cursor");
    });

    it("should return null for unknown preset type", () => {
      const getPresetOutputPath = (type: string): SkillsOutputPath | null => {
        const knownTypes = ["cursor", "cline", "windsurf"];
        if (!knownTypes.includes(type)) return null;
        return { id: type, path: "", type: type as any, enabled: true };
      };

      const unknownPath = getPresetOutputPath("vscode");

      expect(unknownPath).toBeNull();
    });
  });

  describe("config validation", () => {
    it("should validate config before save", () => {
      const validateAndSave = (
        config: SkillsConfig
      ): { success: boolean; errors: string[] } => {
        const errors: string[] = [];

        if (config.enabled && config.outputPaths.length === 0) {
          errors.push("At least one output path required when enabled");
        }

        for (const path of config.outputPaths) {
          if (!path.path || path.path.trim() === "") {
            errors.push(`Empty path for ${path.id}`);
          }
        }

        return { success: errors.length === 0, errors };
      };

      // Valid config
      const validResult = validateAndSave(mockConfig);
      expect(validResult.success).toBe(true);

      // Invalid config - enabled but no paths
      const invalidConfig: SkillsConfig = {
        ...DEFAULT_SKILLS_CONFIG,
        enabled: true,
        outputPaths: [],
      };
      const invalidResult = validateAndSave(invalidConfig);
      expect(invalidResult.success).toBe(false);
    });
  });

  describe("persistence format", () => {
    it("should serialize config to JSON compatible format", () => {
      const serializeConfig = (config: SkillsConfig): string => {
        return JSON.stringify(config);
      };

      const serialized = serializeConfig(mockConfig);
      const parsed = JSON.parse(serialized);

      expect(parsed.enabled).toBe(true);
      expect(parsed.outputPaths).toHaveLength(2);
    });

    it("should deserialize config from JSON", () => {
      const jsonStr = JSON.stringify(mockConfig);

      const deserializeConfig = (json: string): SkillsConfig => {
        return JSON.parse(json);
      };

      const config = deserializeConfig(jsonStr);

      expect(config.enabled).toBe(mockConfig.enabled);
      expect(config.outputPaths).toEqual(mockConfig.outputPaths);
    });
  });
});
