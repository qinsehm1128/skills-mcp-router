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
   * 生成服务器列表的Markdown内容（用于简单 {{servers}} 占位符）
   */
  private generateServersMarkdown(servers: MCPServerSummary[]): string {
    const enabledServers = servers.filter((s) => s.enabled);

    if (enabledServers.length === 0) {
      return "No MCP servers configured.\n";
    }

    let md = "";
    for (const server of enabledServers) {
      md += `### 🔹 \`${server.name}\`\n\n`;
      md += `> **Capabilities**: ${server.description || "No description available."}\n\n`;
    }

    return md;
  }

  /**
   * 处理 {{#each servers}} 块语法
   */
  private processEachBlock(template: string, servers: MCPServerSummary[]): string {
    const eachRegex = /\{\{#each servers\}\}([\s\S]*?)\{\{\/each\}\}/g;
    
    return template.replace(eachRegex, (_, blockContent) => {
      const enabledServers = servers.filter((s) => s.enabled);
      
      if (enabledServers.length === 0) {
        return "No MCP servers configured.\n";
      }

      return enabledServers.map(server => {
        let content = blockContent;
        content = content.replace(/\{\{name\}\}/g, server.name);
        content = content.replace(/\{\{description\}\}/g, server.description || "No description available.");
        if (server.toolCount !== undefined) {
          content = content.replace(/\{\{toolCount\}\}/g, String(server.toolCount));
        }
        return content;
      }).join("");
    });
  }

  /**
   * 应用模板生成最终内容
   */
  public applyTemplate(template: string, content: SkillsContent): string {
    const enabledServers = content.servers.filter((s) => s.enabled);

    let result = template;

    // 处理 {{#each servers}} 块语法
    result = this.processEachBlock(result, content.servers);

    // 生成服务器列表（用于简单 {{servers}} 占位符）
    const serversList = this.generateServersMarkdown(content.servers);

    // 替换简单占位符
    result = result.replace(/\{\{servers\}\}/g, serversList);
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

    // 检查必要的占位符（支持 {{servers}} 或 {{#each servers}}）
    const hasServersPlaceholder = template.includes("{{servers}}");
    const hasEachBlock = template.includes("{{#each servers}}");
    
    if (!hasServersPlaceholder && !hasEachBlock) {
      errors.push("Template must include {{servers}} or {{#each servers}} block");
    }

    // 检查 each 块是否正确闭合
    if (hasEachBlock && !template.includes("{{/each}}")) {
      errors.push("{{#each servers}} block must be closed with {{/each}}");
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
