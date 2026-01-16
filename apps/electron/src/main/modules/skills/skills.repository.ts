/**
 * Skills Repository
 * Skills配置的持久化层，使用SharedConfigManager存储
 */

import { app } from "electron";
import * as path from "path";
import type { SkillsConfig, SkillsOutputPath } from "@mcp_router/shared";
import { DEFAULT_SKILLS_CONFIG } from "@mcp_router/shared";
import { getSharedConfigManager } from "@/main/infrastructure/shared-config-manager";

export class SkillsRepository {
  private static instance: SkillsRepository | null = null;

  private constructor() {
    console.log("[SkillsRepository] Initialized");
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): SkillsRepository {
    if (!SkillsRepository.instance) {
      SkillsRepository.instance = new SkillsRepository();
    }
    return SkillsRepository.instance;
  }

  /**
   * 重置实例（测试用）
   */
  public static resetInstance(): void {
    SkillsRepository.instance = null;
  }

  /**
   * 获取Skills配置
   */
  public getConfig(): SkillsConfig {
    try {
      return getSharedConfigManager().getSkillsConfig();
    } catch (error) {
      console.error("[SkillsRepository] Failed to get config:", error);
      return { ...DEFAULT_SKILLS_CONFIG };
    }
  }

  /**
   * 保存Skills配置
   */
  public saveConfig(config: SkillsConfig): boolean {
    try {
      const configWithTimestamp: SkillsConfig = {
        ...config,
        updatedAt: new Date().toISOString(),
      };
      getSharedConfigManager().saveSkillsConfig(configWithTimestamp);
      return true;
    } catch (error) {
      console.error("[SkillsRepository] Failed to save config:", error);
      return false;
    }
  }

  /**
   * 更新配置的部分字段
   */
  public updateConfig(updates: Partial<SkillsConfig>): SkillsConfig {
    const currentConfig = this.getConfig();
    const updatedConfig: SkillsConfig = {
      ...currentConfig,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveConfig(updatedConfig);
    return updatedConfig;
  }

  /**
   * 添加输出路径
   */
  public addOutputPath(outputPath: SkillsOutputPath): SkillsConfig {
    const config = this.getConfig();
    const newPaths = [...config.outputPaths, outputPath];
    return this.updateConfig({ outputPaths: newPaths });
  }

  /**
   * 删除输出路径
   */
  public removeOutputPath(id: string): SkillsConfig {
    const config = this.getConfig();
    const newPaths = config.outputPaths.filter((p) => p.id !== id);
    return this.updateConfig({ outputPaths: newPaths });
  }

  /**
   * 更新输出路径
   */
  public updateOutputPath(
    id: string,
    updates: Partial<SkillsOutputPath>,
  ): SkillsConfig {
    const config = this.getConfig();
    const newPaths = config.outputPaths.map((p) =>
      p.id === id ? { ...p, ...updates } : p,
    );
    return this.updateConfig({ outputPaths: newPaths });
  }

  /**
   * 切换输出路径的启用状态
   */
  public toggleOutputPath(id: string): SkillsConfig {
    const config = this.getConfig();
    const newPaths = config.outputPaths.map((p) =>
      p.id === id ? { ...p, enabled: !p.enabled } : p,
    );
    return this.updateConfig({ outputPaths: newPaths });
  }

  /**
   * 获取预设输出路径
   */
  public getPresetOutputPath(
    type: "cursor" | "cline" | "windsurf",
  ): SkillsOutputPath {
    const homeDir = app.getPath("home");
    const presets: Record<string, { path: string; displayName: string }> = {
      cursor: {
        path: path.join(homeDir, ".cursor"),
        displayName: "Cursor",
      },
      cline: {
        path: path.join(homeDir, ".cline"),
        displayName: "Cline",
      },
      windsurf: {
        path: path.join(homeDir, ".windsurf"),
        displayName: "Windsurf",
      },
    };

    const preset = presets[type];
    return {
      id: `preset-${type}`,
      path: preset.path,
      type,
      enabled: true,
      displayName: preset.displayName,
    };
  }

  /**
   * 验证配置
   */
  public validateConfig(config: SkillsConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (config.enabled && config.outputPaths.length === 0) {
      errors.push("At least one output path required when enabled");
    }

    for (const outputPath of config.outputPaths) {
      if (!outputPath.path || outputPath.path.trim() === "") {
        errors.push(`Empty path for output ${outputPath.id}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

/**
 * 获取SkillsRepository单例
 */
export function getSkillsRepository(): SkillsRepository {
  return SkillsRepository.getInstance();
}
