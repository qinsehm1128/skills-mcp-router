/**
 * AI Summary IPC Handlers
 * AI总结服务的IPC通信处理器
 */

import { ipcMain } from "electron";
import type { AIConfig, AISummaryRequest } from "@mcp_router/shared";
import { getAISummaryService } from "./ai-summary.service";

/**
 * 设置AI Summary相关的IPC处理器
 */
export function setupAISummaryHandlers(): void {
  // 获取AI配置
  ipcMain.handle("ai-summary:get-config", () => {
    try {
      return getAISummaryService().getConfig();
    } catch (error) {
      console.error("[AI Summary IPC] Failed to get config:", error);
      return null;
    }
  });

  // 保存AI配置
  ipcMain.handle("ai-summary:save-config", (_, config: AIConfig) => {
    try {
      getAISummaryService().saveConfig(config);
      return true;
    } catch (error) {
      console.error("[AI Summary IPC] Failed to save config:", error);
      return false;
    }
  });

  // 测试连接
  ipcMain.handle("ai-summary:test-connection", async () => {
    try {
      getAISummaryService().refreshConfig();
      return await getAISummaryService().testConnection();
    } catch (error: any) {
      console.error("[AI Summary IPC] Failed to test connection:", error);
      return { success: false, error: error.message };
    }
  });

  // 生成描述
  ipcMain.handle(
    "ai-summary:generate",
    async (_, request: AISummaryRequest) => {
      try {
        getAISummaryService().refreshConfig();
        return await getAISummaryService().generateSummary(request);
      } catch (error: any) {
        console.error("[AI Summary IPC] Failed to generate summary:", error);
        return { description: "", success: false, error: error.message };
      }
    },
  );

  // 检查是否已启用
  ipcMain.handle("ai-summary:is-enabled", () => {
    try {
      return getAISummaryService().isEnabled();
    } catch (error) {
      console.error("[AI Summary IPC] Failed to check enabled:", error);
      return false;
    }
  });
}
