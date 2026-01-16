/**
 * Entry MCP Types
 * 入口MCP服务器的类型定义
 */

/**
 * 入口MCP配置
 */
export interface EntryMCPConfig {
  /** 是否启用入口MCP模式 */
  enabled: boolean;
  /** 服务端口 */
  port: number;
  /** 是否同时暴露原始工具（用于兼容模式） */
  exposeOriginalTools: boolean;
  /** 服务描述（可选） */
  description?: string;
}

/**
 * MCP工具信息
 */
export interface MCPToolInfo {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description?: string;
  /** 输入参数Schema */
  inputSchema?: Record<string, unknown>;
}

/**
 * MCP服务器信息
 */
export interface MCPServerInfo {
  /** 服务器名称 */
  name: string;
  /** 服务器描述 */
  description?: string;
  /** 运行状态 */
  status: "running" | "starting" | "stopping" | "stopped" | "error";
  /** 工具数量 */
  toolCount: number;
  /** 工具列表（可选，详细查询时返回） */
  tools?: MCPToolInfo[];
}

/**
 * list_mcp_tools 工具的参数
 */
export interface ListMCPToolsParams {
  /** 指定MCP名称过滤（可选） */
  mcpName?: string;
  /** 项目ID过滤（可选） */
  projectId?: string;
}

/**
 * list_mcp_tools 工具的返回结果
 */
export interface ListMCPToolsResult {
  /** MCP服务器列表（包含工具信息） */
  servers: MCPServerInfo[];
  /** 提示信息（当没有指定mcpName时返回） */
  message?: string;
}

/**
 * call_mcp_tool 工具的参数
 */
export interface CallMCPToolParams {
  /** MCP服务器名称 */
  mcpName: string;
  /** 工具名称 */
  toolName: string;
  /** 工具参数 */
  arguments: Record<string, unknown>;
}

/**
 * 工具调用结果内容项
 */
export interface ToolResultContent {
  /** 内容类型 */
  type: "text" | "image" | "resource";
  /** 文本内容 */
  text?: string;
  /** 图片数据（base64） */
  data?: string;
  /** MIME类型 */
  mimeType?: string;
}

/**
 * call_mcp_tool 工具的返回结果
 */
export interface CallMCPToolResult {
  /** 结果内容 */
  content: ToolResultContent[];
  /** 是否为错误 */
  isError: boolean;
  /** 错误码（可选） */
  errorCode?: string;
}

/**
 * 默认入口MCP配置
 */
export const DEFAULT_ENTRY_MCP_CONFIG: EntryMCPConfig = {
  enabled: false,
  port: 3282,
  exposeOriginalTools: false,
  description: "MCP Router Entry Point - 提供统一的MCP工具访问接口",
};
