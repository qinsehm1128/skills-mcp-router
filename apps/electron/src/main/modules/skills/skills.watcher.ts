/**
 * Skills Watcher
 * 监听MCP服务器状态变化，自动同步Skills文件
 */

import type { MCPServer, SkillsConfig } from "@mcp_router/shared";
import { getSkillsService } from "./skills.service";
import { getSkillsRepository } from "./skills.repository";

export type SkillsEventType =
  | "server:started"
  | "server:stopped"
  | "server:added"
  | "server:removed"
  | "server:updated"
  | "config:changed";

export interface SkillsWatcherOptions {
  debounceMs?: number;
}

export class SkillsWatcher {
  private debounceTimer: NodeJS.Timeout | null = null;
  private debounceMs: number;
  private getServers: (() => MCPServer[]) | null = null;

  constructor(options: SkillsWatcherOptions = {}) {
    this.debounceMs = options.debounceMs ?? 500;
  }

  /**
   * 设置服务器获取函数
   */
  public setServerProvider(getServers: () => MCPServer[]): void {
    this.getServers = getServers;
  }

  /**
   * 检查是否应该自动同步
   */
  public shouldAutoSync(): boolean {
    const config = this.getConfig();
    return config.enabled && config.autoSync;
  }

  /**
   * 服务器启动事件
   */
  public onServerStarted(serverId: string): void {
    if (this.shouldAutoSync()) {
      this.debouncedSync();
    }
  }

  /**
   * 服务器停止事件
   */
  public onServerStopped(serverId: string): void {
    if (this.shouldAutoSync()) {
      this.debouncedSync();
    }
  }

  /**
   * 服务器添加事件
   */
  public onServerAdded(server: MCPServer): void {
    if (this.shouldAutoSync()) {
      this.debouncedSync();
    }
  }

  /**
   * 服务器移除事件
   */
  public onServerRemoved(serverId: string): void {
    if (this.shouldAutoSync()) {
      this.debouncedSync();
    }
  }

  /**
   * 服务器更新事件
   */
  public onServerUpdated(serverId: string, changes: Partial<MCPServer>): void {
    // 只有相关字段变化才触发同步
    const relevantFields = ["description", "name", "disabled"];
    const hasRelevantChange = relevantFields.some((field) => field in changes);

    if (this.shouldAutoSync() && hasRelevantChange) {
      this.debouncedSync();
    }
  }

  /**
   * 配置变更事件
   */
  public onConfigChanged(): void {
    const config = this.getConfig();
    if (config.enabled) {
      this.syncNow();
    }
  }

  /**
   * 手动触发同步（不受autoSync限制）
   */
  public manualSync(): void {
    const config = this.getConfig();
    if (config.enabled) {
      this.syncNow();
    }
  }

  /**
   * 初始化时同步
   */
  public initialize(): void {
    const config = this.getConfig();
    if (config.enabled) {
      this.syncNow();
    }
  }

  /**
   * 防抖同步
   */
  private debouncedSync(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.syncNow();
      this.debounceTimer = null;
    }, this.debounceMs);
  }

  /**
   * 立即同步
   */
  private syncNow(): void {
    try {
      if (!this.getServers) {
        console.warn("[SkillsWatcher] No server provider set");
        return;
      }

      const servers = this.getServers();
      const results = getSkillsService().syncSkills(servers);

      // Log results
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      if (results.length > 0) {
        console.log(
          `[SkillsWatcher] Sync completed: ${successCount} success, ${failCount} failed`,
        );
      }

      // Log failures
      results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.error(
            `[SkillsWatcher] Failed to sync to ${r.path}: ${r.error}`,
          );
        });
    } catch (error) {
      console.error("[SkillsWatcher] Sync error:", error);
    }
  }

  /**
   * 获取配置
   */
  private getConfig(): SkillsConfig {
    return getSkillsRepository().getConfig();
  }

  /**
   * 销毁watcher
   */
  public destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.getServers = null;
  }
}

// 单例
let skillsWatcherInstance: SkillsWatcher | null = null;

export function getSkillsWatcher(): SkillsWatcher {
  if (!skillsWatcherInstance) {
    skillsWatcherInstance = new SkillsWatcher();
  }
  return skillsWatcherInstance;
}

export function resetSkillsWatcher(): void {
  if (skillsWatcherInstance) {
    skillsWatcherInstance.destroy();
    skillsWatcherInstance = null;
  }
}
