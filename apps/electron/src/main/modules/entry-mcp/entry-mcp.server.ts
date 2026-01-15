/**
 * Entry MCP Server
 * 入口MCP服务器，只暴露两个工具：list_mcp_tools 和 call_mcp_tool
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { MCPServer, MCPToolInfo } from "@mcp_router/shared";
import {
  EntryMCPService,
  getEntryMCPService,
  type EntryMCPServiceDeps,
} from "./entry-mcp.service";
import { getLogService } from "@/main/modules/mcp-logger/mcp-logger.service";

export type EntryMCPServerDeps = EntryMCPServiceDeps;

/**
 * 入口MCP服务器
 * 将所有MCP服务器抽象为两个工具：list_mcp_tools 和 call_mcp_tool
 */
export class EntryMCPServer {
  private server!: Server;
  private transport!: StreamableHTTPServerTransport;
  private service: EntryMCPService;
  private initialized: Promise<void>;

  constructor(deps: EntryMCPServerDeps) {
    this.service = getEntryMCPService(deps);
    this.initialized = this.initServer();
  }

  /**
   * 等待初始化完成
   */
  public async waitForInit(): Promise<void> {
    await this.initialized;
  }

  /**
   * 初始化MCP服务器
   */
  private async initServer(): Promise<void> {
    try {
      this.server = new Server(
        {
          name: "mcp-router-entry",
          version: "1.0.0",
        },
        {
          capabilities: {
            tools: {},
          },
        },
      );

      this.setupHandlers();

      this.server.onerror = (error) => {
        console.error("[Entry MCP Server Error]", error);
        getLogService().recordMcpRequestLog({
          timestamp: new Date().toISOString(),
          requestType: "EntryServerError",
          params: {},
          result: "error",
          errorMessage: error.message || "Unknown server error",
          duration: 0,
          clientId: "entry-mcp-system",
        });
      };

      await this.startServer();
      console.log("[EntryMCPServer] Initialized successfully");
    } catch (error) {
      console.error("[EntryMCPServer] Failed to initialize:", error);
      throw error;
    }
  }

  /**
   * 设置请求处理器
   */
  private setupHandlers(): void {
    // 列出工具 - 只返回两个工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          EntryMCPService.getListMCPToolsDefinition(),
          EntryMCPService.getCallMCPToolDefinition(),
        ],
      };
    });

    // 调用工具
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const args = request.params.arguments || {};
      const startTime = Date.now();

      try {
        let result: any;

        if (toolName === "list_mcp_tools") {
          result = await this.service.listMCPTools({
            mcpName: args.mcpName as string | undefined,
            projectId: args.projectId as string | undefined,
          });

          // 格式化输出
          const formattedOutput = this.formatListResult(result);

          getLogService().recordMcpRequestLog({
            timestamp: new Date().toISOString(),
            requestType: "EntryMCP:list_mcp_tools",
            params: args,
            result: "success",
            duration: Date.now() - startTime,
            clientId: "entry-mcp",
          });

          return {
            content: [{ type: "text", text: formattedOutput }],
            isError: false,
          };
        } else if (toolName === "call_mcp_tool") {
          const mcpName = args.mcpName as string;
          const targetToolName = args.toolName as string;
          const toolArgs = (args.arguments || {}) as Record<string, unknown>;

          if (!mcpName || !targetToolName) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: mcpName and toolName are required",
                },
              ],
              isError: true,
            };
          }

          result = await this.service.callMCPTool({
            mcpName,
            toolName: targetToolName,
            arguments: toolArgs,
          });

          getLogService().recordMcpRequestLog({
            timestamp: new Date().toISOString(),
            requestType: `EntryMCP:call_mcp_tool(${mcpName}/${targetToolName})`,
            params: { mcpName, toolName: targetToolName, arguments: toolArgs },
            result: result.isError ? "error" : "success",
            duration: Date.now() - startTime,
            clientId: "entry-mcp",
          });

          return result;
        } else {
          return {
            content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
            isError: true,
          };
        }
      } catch (error: any) {
        getLogService().recordMcpRequestLog({
          timestamp: new Date().toISOString(),
          requestType: `EntryMCP:${toolName}`,
          params: args,
          result: "error",
          errorMessage: error.message,
          duration: Date.now() - startTime,
          clientId: "entry-mcp",
        });

        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    });
  }

  /**
   * 格式化list_mcp_tools的结果
   */
  private formatListResult(result: any): string {
    const { servers, message } = result;

    // 如果有提示信息（没有指定mcpName的情况）
    if (message) {
      return message;
    }

    if (servers.length === 0) {
      return "未找到MCP服务器";
    }

    let output = "";

    for (const server of servers) {
      output += `# ${server.name}\n`;
      output += `${server.description || "无描述"}\n`;
      output += `状态: ${server.status} | 工具数量: ${server.toolCount}\n\n`;

      if (server.tools && server.tools.length > 0) {
        output += `可以使用 call_mcp_tool 调用以下工具（mcpName: "${server.name}"）:\n\n`;
        output += "## 工具列表:\n\n";
        for (const tool of server.tools) {
          output += `### ${tool.name}\n`;
          output += `${tool.description || "无描述"}\n`;
          if (tool.inputSchema) {
            output += `参数格式: \`${JSON.stringify(tool.inputSchema)}\`\n`;
          }
          output += "\n";
        }
      }
    }

    return output;
  }

  /**
   * 启动服务器
   */
  private async startServer(): Promise<void> {
    this.transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await this.server.connect(this.transport);
  }

  /**
   * 获取transport
   */
  public getTransport(): StreamableHTTPServerTransport {
    return this.transport;
  }

  /**
   * 获取服务器实例
   */
  public getServer(): Server {
    return this.server;
  }

  /**
   * 关闭服务器
   */
  public async shutdown(): Promise<void> {
    try {
      await this.server.close();
      console.log("[EntryMCPServer] Shutdown complete");
    } catch (error) {
      console.error("[EntryMCPServer] Error during shutdown:", error);
    }
  }
}

// 单例
let entryMCPServerInstance: EntryMCPServer | null = null;

export function getEntryMCPServer(deps?: EntryMCPServerDeps): EntryMCPServer {
  if (!entryMCPServerInstance && deps) {
    entryMCPServerInstance = new EntryMCPServer(deps);
  }
  if (!entryMCPServerInstance) {
    throw new Error("EntryMCPServer not initialized. Call with deps first.");
  }
  return entryMCPServerInstance;
}

export function resetEntryMCPServer(): void {
  if (entryMCPServerInstance) {
    entryMCPServerInstance.shutdown();
    entryMCPServerInstance = null;
  }
}
