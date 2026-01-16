/**
 * Entry MCP Module
 * 导出入口MCP功能的所有公共接口
 */

export {
  EntryMCPService,
  getEntryMCPService,
  resetEntryMCPService,
  type EntryMCPServiceDeps,
} from "./entry-mcp.service";

export {
  EntryMCPServer,
  getEntryMCPServer,
  resetEntryMCPServer,
  type EntryMCPServerDeps,
} from "./entry-mcp.server";

export { setupEntryMCPHandlers } from "./entry-mcp.ipc";
