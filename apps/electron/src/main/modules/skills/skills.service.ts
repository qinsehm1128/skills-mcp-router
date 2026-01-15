/**
 * Skills Service
 * Skills功能的业务逻辑层
 */

import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import type {
  SkillsConfig,
  SkillsContent,
  SkillsOutputPath,
  MCPServerSummary,
  MCPServer,
} from "@mcp_router/shared";
import { DEFAULT_SKILLS_CONFIG } from "@mcp_router/shared";
import { getSkillsGenerator } from "./skills.generator";
import { getSkillsRepository } from "./skills.repository";

export interface SyncResult {
  success: boolean;
  path: string;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class SkillsService {
  private generator = getSkillsGenerator();

  /**
   * 获取当前配置（从repository读取）
   */
  private get config(): SkillsConfig {
    return getSkillsRepository().getConfig();
  }

  /**
   * 从MCPServer列表构建SkillsContent
   */
  public buildSkillsContent(servers: MCPServer[]): SkillsContent {
    const summaries = servers.map((server) => this.convertToSummary(server));

    return {
      servers: summaries,
      generatedAt: new Date().toISOString(),
      version: "1.0.0",
    };
  }

  /**
   * 将MCPServer转换为MCPServerSummary
   */
  public convertToSummary(server: MCPServer): MCPServerSummary {
    return {
      name: server.name,
      description: server.description || "",
      enabled: !server.disabled && server.status === "running",
      toolCount: server.tools?.length,
      projectId: server.projectId || undefined,
    };
  }

  /**
   * 同步Skills文件到所有启用的输出路径
   */
  public syncSkills(servers: MCPServer[]): SyncResult[] {
    // 检查是否启用
    if (!this.config.enabled) {
      return [];
    }

    // 检查是否有启用的输出路径
    const enabledPaths = this.config.outputPaths.filter((p) => p.enabled);
    if (enabledPaths.length === 0) {
      return [];
    }

    const content = this.buildSkillsContent(servers);
    const results: SyncResult[] = [];

    for (const outputPath of enabledPaths) {
      const result = this.writeSkillsFile(outputPath, content);
      results.push(result);
    }

    return results;
  }

  /**
   * 写入Skills文件
   */
  private writeSkillsFile(
    outputPath: SkillsOutputPath,
    content: SkillsContent,
  ): SyncResult {
    try {
      const filePath = this.resolveOutputPath(outputPath);
      const fileContent = this.generateContent(content);

      // 确保目录存在
      this.ensureDirectoryExists(filePath);

      // 写入文件
      fs.writeFileSync(filePath, fileContent, "utf-8");

      return { success: true, path: filePath };
    } catch (error: any) {
      return {
        success: false,
        path: outputPath.path,
        error: error.message,
      };
    }
  }

  /**
   * 解析输出路径
   * 按照agentskills.io规范: <base_path>/skills/mcp-router/SKILL.md
   */
  private resolveOutputPath(outputPath: SkillsOutputPath): string {
    let basePath = outputPath.path;

    // 处理预设路径
    if (outputPath.type !== "custom") {
      const presetPath = this.getPresetPath(outputPath.type);
      if (presetPath) {
        basePath = presetPath;
      }
    }

    // 按照agentskills.io规范构建完整路径
    // 结构: <base_path>/skills/mcp-router/SKILL.md
    return path.join(basePath, "skills", "mcp-router", "SKILL.md");
  }

  /**
   * 生成文件内容
   */
  private generateContent(content: SkillsContent): string {
    return this.generator.generate(content, this.config.customTemplate);
  }

  /**
   * 获取预设路径
   */
  public getPresetPath(type: string): string | null {
    const homeDir = app.getPath("home");

    switch (type) {
      case "cursor":
        return path.join(homeDir, ".cursor");
      case "cline":
        return path.join(homeDir, ".cline");
      case "windsurf":
        return path.join(homeDir, ".windsurf");
      default:
        return null;
    }
  }

  /**
   * 确保目录存在
   */
  private ensureDirectoryExists(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 验证配置
   */
  public validateConfig(config: SkillsConfig): ValidationResult {
    const errors: string[] = [];

    if (config.enabled) {
      if (!config.outputPaths || config.outputPaths.length === 0) {
        errors.push(
          "At least one output path is required when skills is enabled",
        );
      }

      for (const outputPath of config.outputPaths || []) {
        if (!this.isValidPath(outputPath.path)) {
          errors.push(
            `Invalid path for output ${outputPath.id}: ${outputPath.path}`,
          );
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 验证路径是否有效
   */
  public isValidPath(pathStr: string): boolean {
    if (!pathStr || pathStr.trim() === "") return false;
    if (pathStr.includes("\0")) return false;
    return true;
  }
}

// 单例
let skillsServiceInstance: SkillsService | null = null;

export function getSkillsService(): SkillsService {
  if (!skillsServiceInstance) {
    skillsServiceInstance = new SkillsService();
  }
  return skillsServiceInstance;
}
