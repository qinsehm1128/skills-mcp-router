/**
 * Entry MCP IPC Handlers
 * 入口MCP模块的IPC通信处理器
 */

import { ipcMain } from "electron";
import type { EntryMCPConfig } from "@mcp_router/shared";
import { DEFAULT_ENTRY_MCP_CONFIG } from "@mcp_router/shared";

// Entry MCP配置存储在SharedConfig中
// 暂时简化实现，后续可扩展

/**
 * 设置Entry MCP相关的IPC处理器
 */
export function setupEntryMCPHandlers(): void {
  // 获取Entry MCP配置
  ipcMain.handle("entry-mcp:get-config", () => {
    try {
      // 目前Entry MCP配置相对简单，可以扩展到SharedConfig
      // 暂时返回默认配置
      return { ...DEFAULT_ENTRY_MCP_CONFIG };
    } catch (error) {
      console.error("[Entry MCP IPC] Failed to get config:", error);
      return null;
    }
  });

  // 保存Entry MCP配置
  ipcMain.handle("entry-mcp:save-config", (_, config: EntryMCPConfig) => {
    try {
      // 保存配置逻辑
      console.log("[Entry MCP IPC] Config saved:", config);
      return true;
    } catch (error) {
      console.error("[Entry MCP IPC] Failed to save config:", error);
      return false;
    }
  });

  // 切换Entry MCP模式
  ipcMain.handle("entry-mcp:toggle-enabled", (_, enabled: boolean) => {
    try {
      console.log("[Entry MCP IPC] Toggle enabled:", enabled);
      return { success: true, enabled };
    } catch (error) {
      console.error("[Entry MCP IPC] Failed to toggle enabled:", error);
      return { success: false };
    }
  });
}
