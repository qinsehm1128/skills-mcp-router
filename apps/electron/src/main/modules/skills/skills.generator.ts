/**
 * Skills Generator
 * 生成符合 agentskills.io 规范的 SKILL.md 文件
 */

import type { SkillsContent, MCPServerSummary } from "@mcp_router/shared";
import { DEFAULT_SKILL_TEMPLATE } from "@mcp_router/shared";

export class SkillsGenerator {
  /**
   * 生成SKILL.md文件内容（符合agentskills.io规范）
   */
  public generate(content: SkillsContent, customTemplate?: string): string {
    const template = customTemplate || DEFAULT_SKILL_TEMPLATE;
    return this.applyTemplate(template, content);
  }

  /**
   * 生成服务器列表的Markdown内容
   */
  private generateServersMarkdown(servers: MCPServerSummary[]): string {
    const enabledServers = servers.filter((s) => s.enabled);

    if (enabledServers.length === 0) {
      return "No MCP servers configured.\n";
    }

    let md = "";
    for (const server of enabledServers) {
      md += `## ${server.name}\n\n`;
      md += `${server.description || "No description available."}\n\n`;
      if (server.toolCount !== undefined && server.toolCount > 0) {
        md += `- **Tools**: ${server.toolCount}\n`;
      }
      md += "\n";
    }

    return md;
  }

  /**
   * 生成总体描述
   */
  private generateDescription(servers: MCPServerSummary[]): string {
    const enabledServers = servers.filter((s) => s.enabled);
    const serverCount = enabledServers.length;
    const totalTools = enabledServers.reduce(
      (sum, s) => sum + (s.toolCount || 0),
      0,
    );

    if (serverCount === 0) {
      return "No MCP servers configured.";
    }

    return `Collection of ${serverCount} MCP servers with ${totalTools} tools for AI assistance.`;
  }

  /**
   * 应用模板生成最终内容
   */
  public applyTemplate(template: string, content: SkillsContent): string {
    const enabledServers = content.servers.filter((s) => s.enabled);

    let result = template;

    // 生成服务器列表
    const serversList = this.generateServersMarkdown(content.servers);

    // 生成描述
    const description = this.generateDescription(content.servers);

    // 替换占位符
    result = result.replace(/\{\{servers\}\}/g, serversList);
    result = result.replace(/\{\{description\}\}/g, description);
    result = result.replace(/\{\{generatedAt\}\}/g, content.generatedAt);
    result = result.replace(/\{\{version\}\}/g, content.version);
    result = result.replace(
      /\{\{serverCount\}\}/g,
      String(enabledServers.length),
    );

    return result;
  }

  /**
   * 获取默认模板
   */
  public getDefaultTemplate(): string {
    return DEFAULT_SKILL_TEMPLATE;
  }

  /**
   * 验证模板格式
   */
  public validateTemplate(template: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 检查是否有YAML frontmatter
    if (!template.startsWith("---")) {
      errors.push("Template must start with YAML frontmatter (---)");
    }

    // 检查是否有结束的frontmatter
    const secondDashIndex = template.indexOf("---", 3);
    if (secondDashIndex === -1) {
      errors.push("Template must have closing YAML frontmatter (---)");
    }

    // 检查必要的占位符
    if (!template.includes("{{servers}}")) {
      errors.push("Template must include {{servers}} placeholder");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// 单例导出
let skillsGeneratorInstance: SkillsGenerator | null = null;

export function getSkillsGenerator(): SkillsGenerator {
  if (!skillsGeneratorInstance) {
    skillsGeneratorInstance = new SkillsGenerator();
  }
  return skillsGeneratorInstance;
}
