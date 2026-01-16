/**
 * Skills IPC Handlers
 * Skills模块的IPC通信处理器
 */

import { ipcMain } from "electron";
import type { SkillsConfig, SkillsOutputPath } from "@mcp_router/shared";
import { getSkillsRepository } from "./skills.repository";
import { getSkillsWatcher } from "./skills.watcher";

/**
 * 设置Skills相关的IPC处理器
 */
export function setupSkillsHandlers(): void {
  // 获取Skills配置
  ipcMain.handle("skills:get-config", () => {
    try {
      return getSkillsRepository().getConfig();
    } catch (error) {
      console.error("[Skills IPC] Failed to get config:", error);
      return null;
    }
  });

  // 保存Skills配置
  ipcMain.handle("skills:save-config", (_, config: SkillsConfig) => {
    try {
      const result = getSkillsRepository().saveConfig(config);
      if (result) {
        // 配置变更后通知watcher
        getSkillsWatcher().onConfigChanged();
      }
      return result;
    } catch (error) {
      console.error("[Skills IPC] Failed to save config:", error);
      return false;
    }
  });

  // 更新Skills配置
  ipcMain.handle(
    "skills:update-config",
    (_, updates: Partial<SkillsConfig>) => {
      try {
        const result = getSkillsRepository().updateConfig(updates);
        // 配置变更后通知watcher
        getSkillsWatcher().onConfigChanged();
        return result;
      } catch (error) {
        console.error("[Skills IPC] Failed to update config:", error);
        return null;
      }
    },
  );

  // 添加输出路径
  ipcMain.handle(
    "skills:add-output-path",
    (_, outputPath: SkillsOutputPath) => {
      try {
        const result = getSkillsRepository().addOutputPath(outputPath);
        getSkillsWatcher().onConfigChanged();
        return result;
      } catch (error) {
        console.error("[Skills IPC] Failed to add output path:", error);
        return null;
      }
    },
  );

  // 删除输出路径
  ipcMain.handle("skills:remove-output-path", (_, id: string) => {
    try {
      const result = getSkillsRepository().removeOutputPath(id);
      getSkillsWatcher().onConfigChanged();
      return result;
    } catch (error) {
      console.error("[Skills IPC] Failed to remove output path:", error);
      return null;
    }
  });

  // 更新输出路径
  ipcMain.handle(
    "skills:update-output-path",
    (_, id: string, updates: Partial<SkillsOutputPath>) => {
      try {
        const result = getSkillsRepository().updateOutputPath(id, updates);
        getSkillsWatcher().onConfigChanged();
        return result;
      } catch (error) {
        console.error("[Skills IPC] Failed to update output path:", error);
        return null;
      }
    },
  );

  // 切换输出路径启用状态
  ipcMain.handle("skills:toggle-output-path", (_, id: string) => {
    try {
      const result = getSkillsRepository().toggleOutputPath(id);
      getSkillsWatcher().onConfigChanged();
      return result;
    } catch (error) {
      console.error("[Skills IPC] Failed to toggle output path:", error);
      return null;
    }
  });

  // 获取预设输出路径
  ipcMain.handle(
    "skills:get-preset-path",
    (_, type: "cursor" | "cline" | "windsurf") => {
      try {
        return getSkillsRepository().getPresetOutputPath(type);
      } catch (error) {
        console.error("[Skills IPC] Failed to get preset path:", error);
        return null;
      }
    },
  );

  // 验证配置
  ipcMain.handle("skills:validate-config", (_, config: SkillsConfig) => {
    try {
      return getSkillsRepository().validateConfig(config);
    } catch (error) {
      console.error("[Skills IPC] Failed to validate config:", error);
      return { valid: false, errors: ["Validation failed"] };
    }
  });

  // 手动触发同步
  ipcMain.handle("skills:manual-sync", () => {
    try {
      getSkillsWatcher().manualSync();
      return { success: true };
    } catch (error: any) {
      console.error("[Skills IPC] Failed to manual sync:", error);
      return { success: false, error: error.message };
    }
  });
}
