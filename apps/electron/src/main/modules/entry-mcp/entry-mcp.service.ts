/**
 * Entry MCP Service
 * 入口MCP的业务逻辑层
 */

import type {
  MCPServer,
  MCPServerInfo,
  MCPToolInfo,
  ListMCPToolsParams,
  ListMCPToolsResult,
  CallMCPToolParams,
  CallMCPToolResult,
  ToolResultContent,
} from "@mcp_router/shared";

export interface EntryMCPServiceDeps {
  getServers: () => MCPServer[];
  getServerTools: (serverId: string) => Promise<MCPToolInfo[]>;
  callTool: (
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ) => Promise<any>;
}

export class EntryMCPService {
  private deps: EntryMCPServiceDeps;

  constructor(deps: EntryMCPServiceDeps) {
    this.deps = deps;
  }

  /**
   * 列出指定MCP服务器的工具
   * 必须指定mcpName，否则返回提示信息
   */
  public async listMCPTools(params: ListMCPToolsParams): Promise<ListMCPToolsResult> {
    // 如果没有指定mcpName，返回提示
    if (!params.mcpName) {
      return {
        servers: [],
        message: "请查看mcp-router技能",
      };
    }

    const servers = this.deps.getServers();

    // 查找指定的服务器
    const server = servers.find(
      (s) => s.name === params.mcpName && s.status === "running" && !s.disabled,
    );

    if (!server) {
      return {
        servers: [],
        message: `MCP服务器 "${params.mcpName}" 未找到或未运行`,
      };
    }

    // 获取指定服务器的工具列表
    try {
      const tools = await this.deps.getServerTools(server.id);
      return {
        servers: [
          {
            name: server.name,
            description: server.description,
            status: server.status,
            toolCount: tools.length,
            tools: tools,
          },
        ],
      };
    } catch (error) {
      console.error(`[EntryMCP] Failed to get tools for server ${server.name}:`, error);
      return {
        servers: [],
        message: `获取 "${params.mcpName}" 的工具列表失败`,
      };
    }
  }

  /**
   * 调用指定MCP服务器上的工具
   */
  public async callMCPTool(
    params: CallMCPToolParams,
  ): Promise<CallMCPToolResult> {
    // 验证参数
    const validation = await this.validateCallParams(params);
    if (!validation.valid) {
      return {
        content: [{ type: "text", text: validation.error! }],
        isError: true,
        errorCode: validation.errorCode,
      };
    }

    try {
      const result = await this.deps.callTool(
        params.mcpName,
        params.toolName,
        params.arguments,
      );

      return {
        content: this.normalizeContent(result.content || []),
        isError: result.isError || false,
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
        errorCode: "CALL_FAILED",
      };
    }
  }

  /**
   * 验证调用参数
   */
  private async validateCallParams(params: CallMCPToolParams): Promise<{
    valid: boolean;
    error?: string;
    errorCode?: string;
    serverId?: string;
  }> {
    const servers = this.deps.getServers();
    const server = servers.find((s) => s.name === params.mcpName);

    if (!server) {
      return {
        valid: false,
        error: `MCP server not found: ${params.mcpName}`,
        errorCode: "SERVER_NOT_FOUND",
      };
    }

    if (server.status !== "running") {
      return {
        valid: false,
        error: `MCP server is not running: ${params.mcpName}`,
        errorCode: "SERVER_NOT_RUNNING",
      };
    }

    if (server.disabled) {
      return {
        valid: false,
        error: `MCP server is disabled: ${params.mcpName}`,
        errorCode: "SERVER_DISABLED",
      };
    }

    // 动态获取工具列表并验证工具是否存在
    try {
      const tools = await this.deps.getServerTools(server.id);
      const tool = tools.find((t) => t.name === params.toolName);
      if (!tool) {
        return {
          valid: false,
          error: `Tool not found: ${params.toolName} on server ${params.mcpName}`,
          errorCode: "TOOL_NOT_FOUND",
        };
      }

      // 检查工具是否被禁用
      if (
        server.toolPermissions &&
        server.toolPermissions[params.toolName] === false
      ) {
        return {
          valid: false,
          error: `Tool is disabled: ${params.toolName}`,
          errorCode: "TOOL_DISABLED",
        };
      }

      return { valid: true, serverId: server.id };
    } catch (error) {
      return {
        valid: false,
        error: `Failed to get tools from server: ${params.mcpName}`,
        errorCode: "TOOLS_FETCH_FAILED",
      };
    }
  }

  /**
   * 转换MCPServer为MCPServerInfo
   */
  private convertToServerInfo(server: MCPServer): MCPServerInfo {
    return {
      name: server.name,
      description: server.description,
      status: server.status,
      toolCount: server.tools?.length || 0,
      tools: server.tools?.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  }

  /**
   * 标准化返回内容
   */
  private normalizeContent(content: any[]): ToolResultContent[] {
    return content.map((item) => {
      if (typeof item === "string") {
        return { type: "text" as const, text: item };
      }
      return {
        type: item.type || "text",
        text: item.text,
        data: item.data,
        mimeType: item.mimeType,
      };
    });
  }

  /**
   * 通过名称获取服务器
   */
  public getServerByName(name: string): MCPServer | undefined {
    return this.deps.getServers().find((s) => s.name === name);
  }

  /**
   * 获取list_mcp_tools工具定义
   */
  public static getListMCPToolsDefinition() {
    return {
      name: "list_mcp_tools",
      description: `查询指定MCP服务器的可用工具列表。

使用前提：
- 必须先阅读 mcp-router 的 SKILL.md 技能文件了解有哪些可用的MCP服务器
- 必须指定 mcpName 参数

返回信息包含：服务器描述、工具列表及每个工具的用途说明。`,
      inputSchema: {
        type: "object" as const,
        properties: {
          mcpName: {
            type: "string",
            description: "必填，MCP服务器名称（从SKILL.md技能文件中获取）",
          },
        },
        required: ["mcpName"] as string[],
      },
    };
  }

  /**
   * 获取call_mcp_tool工具定义
   */
  public static getCallMCPToolDefinition() {
    return {
      name: "call_mcp_tool",
      description: `调用指定MCP服务器上的工具。

使用流程：
1. 先使用 list_mcp_tools 查询目标服务器的工具列表
2. 根据工具描述选择合适的工具
3. 按照工具的 inputSchema 提供正确的参数

注意事项：
- 调用前必须确认工具名称和参数格式正确
- 如果调用失败，请检查参数是否符合工具要求
- 不要重复调用同一工具，除非用户明确要求`,
      inputSchema: {
        type: "object" as const,
        properties: {
          mcpName: {
            type: "string",
            description: "MCP服务器名称",
          },
          toolName: {
            type: "string",
            description: "要调用的工具名称（从list_mcp_tools返回的工具列表中选择）",
          },
          arguments: {
            type: "object",
            description: "工具参数（根据工具的inputSchema提供）",
            additionalProperties: true,
          },
        },
        required: ["mcpName", "toolName"] as string[],
      },
    };
  }
}

// 单例
let entryMCPServiceInstance: EntryMCPService | null = null;

export function getEntryMCPService(
  deps?: EntryMCPServiceDeps,
): EntryMCPService {
  if (!entryMCPServiceInstance && deps) {
    entryMCPServiceInstance = new EntryMCPService(deps);
  }
  if (!entryMCPServiceInstance) {
    throw new Error("EntryMCPService not initialized. Call with deps first.");
  }
  return entryMCPServiceInstance;
}

export function resetEntryMCPService(): void {
  entryMCPServiceInstance = null;
}
