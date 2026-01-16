/**
 * Skills Types
 * 用于Skills功能的类型定义
 * 基于 agentskills.io 规范
 */

/**
 * Skills输出路径类型（预设AI客户端或自定义）
 */
export type SkillsOutputType = "cursor" | "cline" | "windsurf" | "custom";

/**
 * Skills输出路径配置
 */
export interface SkillsOutputPath {
  /** 唯一标识符 */
  id: string;
  /** 文件输出路径 */
  path: string;
  /** 路径类型 */
  type: SkillsOutputType;
  /** 是否启用 */
  enabled: boolean;
  /** 显示名称（可选） */
  displayName?: string;
}

/**
 * Skills配置
 */
export interface SkillsConfig {
  /** 是否启用Skills功能 */
  enabled: boolean;
  /** 输出路径列表 */
  outputPaths: SkillsOutputPath[];
  /** 是否自动同步（MCP状态变化时自动更新） */
  autoSync: boolean;
  /** 自定义模板（可选，符合SKILL.md规范） */
  customTemplate?: string;
  /** 创建时间 */
  createdAt?: string;
  /** 更新时间 */
  updatedAt?: string;
}

/**
 * MCP服务器摘要信息（用于Skills文件）
 */
export interface MCPServerSummary {
  /** 服务器名称 */
  name: string;
  /** 服务器描述/用途 */
  description: string;
  /** 是否启用 */
  enabled: boolean;
  /** 工具数量（可选） */
  toolCount?: number;
  /** 所属项目ID（可选） */
  projectId?: string;
}

/**
 * Skills文件内容结构
 */
export interface SkillsContent {
  /** MCP服务器列表 */
  servers: MCPServerSummary[];
  /** 生成时间 */
  generatedAt: string;
  /** Skills版本 */
  version: string;
}

/**
 * 默认Skills配置
 */
export const DEFAULT_SKILLS_CONFIG: SkillsConfig = {
  enabled: false,
  outputPaths: [],
  autoSync: true,
};

/**
 * 默认SKILL.md模板（符合agentskills.io规范）
 */
export const DEFAULT_SKILL_TEMPLATE = `---
name: mcp-router-skills
description: {{description}}
license: MIT
metadata:
  version: "{{version}}"
  generatedAt: "{{generatedAt}}"
  serverCount: {{serverCount}}
---

# MCP Router Skills

This file lists all available MCP servers managed by MCP Router.

{{servers}}
`;
