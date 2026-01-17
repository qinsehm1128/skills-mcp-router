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
description: Master registry of available MCP servers. Used to identify which server handles a specific domain of tasks.
license: MIT
metadata:
  version: "{{version}}"
  updatedAt: "{{generatedAt}}"
  serverCount: {{serverCount}}
---

# MCP Server Registry

This document lists the available **MCP Servers** managed by the Router.

## 🧠 Routing Instructions

You have access to a meta-tooling system. Do not hallucinate tool names. Follow this workflow:

1. **Analyze** the user's request.
2. **Match** the request to the most relevant **Server Name** from the list below based on its description.
3. **Action**:
   - Use \`get_server_tools(server_name)\` to retrieve available functions for that server.
   - Then use \`call_tool(server_name, tool_name, ...)\` to execute the task.

## 🌐 Available Servers

{{#each servers}}
### 🔹 \`{{name}}\`

> **Capabilities**: {{description}}

{{/each}}
`;
