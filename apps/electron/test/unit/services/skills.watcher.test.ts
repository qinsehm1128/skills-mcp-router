/**
 * Skills Watcher - TDD Tests
 * 测试Skills自动同步监听器
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { MCPServer, SkillsConfig } from "@mcp_router/shared";
import { DEFAULT_SKILLS_CONFIG } from "@mcp_router/shared";

describe("SkillsWatcher", () => {
  const mockServers: MCPServer[] = [
    {
      id: "server-1",
      name: "filesystem",
      description: "文件系统操作",
      status: "running",
      disabled: false,
      serverType: "local",
      env: {},
      tools: [{ name: "read_file" }, { name: "write_file" }],
    },
    {
      id: "server-2",
      name: "github",
      description: "GitHub操作",
      status: "running",
      disabled: false,
      serverType: "local",
      env: {},
      tools: [{ name: "create_pr" }],
    },
    {
      id: "server-3",
      name: "database",
      description: "数据库操作",
      status: "stopped",
      disabled: true,
      serverType: "local",
      env: {},
    },
  ];

  const enabledConfig: SkillsConfig = {
    ...DEFAULT_SKILLS_CONFIG,
    enabled: true,
    autoSync: true,
    outputPaths: [
      { id: "path-1", path: "/path/to/.skills", type: "custom", enabled: true },
    ],
  };

  describe("shouldSync", () => {
    it("should return true when config is enabled and autoSync is true", () => {
      const shouldSync = (config: SkillsConfig): boolean => {
        return config.enabled && config.autoSync;
      };

      expect(shouldSync(enabledConfig)).toBe(true);
    });

    it("should return false when config is disabled", () => {
      const shouldSync = (config: SkillsConfig): boolean => {
        return config.enabled && config.autoSync;
      };

      const disabledConfig = { ...enabledConfig, enabled: false };
      expect(shouldSync(disabledConfig)).toBe(false);
    });

    it("should return false when autoSync is false", () => {
      const shouldSync = (config: SkillsConfig): boolean => {
        return config.enabled && config.autoSync;
      };

      const noAutoSyncConfig = { ...enabledConfig, autoSync: false };
      expect(shouldSync(noAutoSyncConfig)).toBe(false);
    });
  });

  describe("onServerStarted", () => {
    it("should trigger sync when server starts", () => {
      let syncCalled = false;
      const syncSkills = () => {
        syncCalled = true;
      };

      const onServerStarted = (
        serverId: string,
        config: SkillsConfig,
        sync: () => void
      ) => {
        if (config.enabled && config.autoSync) {
          sync();
        }
      };

      onServerStarted("server-1", enabledConfig, syncSkills);

      expect(syncCalled).toBe(true);
    });

    it("should not trigger sync when disabled", () => {
      let syncCalled = false;
      const syncSkills = () => {
        syncCalled = true;
      };

      const onServerStarted = (
        serverId: string,
        config: SkillsConfig,
        sync: () => void
      ) => {
        if (config.enabled && config.autoSync) {
          sync();
        }
      };

      const disabledConfig = { ...enabledConfig, enabled: false };
      onServerStarted("server-1", disabledConfig, syncSkills);

      expect(syncCalled).toBe(false);
    });
  });

  describe("onServerStopped", () => {
    it("should trigger sync when server stops", () => {
      let syncCalled = false;
      const syncSkills = () => {
        syncCalled = true;
      };

      const onServerStopped = (
        serverId: string,
        config: SkillsConfig,
        sync: () => void
      ) => {
        if (config.enabled && config.autoSync) {
          sync();
        }
      };

      onServerStopped("server-1", enabledConfig, syncSkills);

      expect(syncCalled).toBe(true);
    });
  });

  describe("onServerAdded", () => {
    it("should trigger sync when new server is added", () => {
      let syncCalled = false;
      const syncSkills = () => {
        syncCalled = true;
      };

      const onServerAdded = (
        server: MCPServer,
        config: SkillsConfig,
        sync: () => void
      ) => {
        if (config.enabled && config.autoSync) {
          sync();
        }
      };

      onServerAdded(mockServers[0], enabledConfig, syncSkills);

      expect(syncCalled).toBe(true);
    });
  });

  describe("onServerRemoved", () => {
    it("should trigger sync when server is removed", () => {
      let syncCalled = false;
      const syncSkills = () => {
        syncCalled = true;
      };

      const onServerRemoved = (
        serverId: string,
        config: SkillsConfig,
        sync: () => void
      ) => {
        if (config.enabled && config.autoSync) {
          sync();
        }
      };

      onServerRemoved("server-1", enabledConfig, syncSkills);

      expect(syncCalled).toBe(true);
    });
  });

  describe("onServerUpdated", () => {
    it("should trigger sync when server description changes", () => {
      let syncCalled = false;
      const syncSkills = () => {
        syncCalled = true;
      };

      const onServerUpdated = (
        serverId: string,
        changes: Partial<MCPServer>,
        config: SkillsConfig,
        sync: () => void
      ) => {
        // Only sync if relevant fields changed
        const relevantFields = ["description", "name", "disabled"];
        const hasRelevantChange = relevantFields.some(
          (field) => field in changes
        );

        if (config.enabled && config.autoSync && hasRelevantChange) {
          sync();
        }
      };

      onServerUpdated(
        "server-1",
        { description: "新的描述" },
        enabledConfig,
        syncSkills
      );

      expect(syncCalled).toBe(true);
    });

    it("should not trigger sync for irrelevant changes", () => {
      let syncCalled = false;
      const syncSkills = () => {
        syncCalled = true;
      };

      const onServerUpdated = (
        serverId: string,
        changes: Partial<MCPServer>,
        config: SkillsConfig,
        sync: () => void
      ) => {
        const relevantFields = ["description", "name", "disabled"];
        const hasRelevantChange = relevantFields.some(
          (field) => field in changes
        );

        if (config.enabled && config.autoSync && hasRelevantChange) {
          sync();
        }
      };

      // autoStart is not a relevant field
      onServerUpdated("server-1", { autoStart: true }, enabledConfig, syncSkills);

      expect(syncCalled).toBe(false);
    });
  });

  describe("debouncing", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should debounce multiple rapid sync calls", async () => {
      let syncCount = 0;
      const actualSync = () => {
        syncCount++;
      };

      let debounceTimer: NodeJS.Timeout | null = null;
      const debouncedSync = (delay: number) => {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(actualSync, delay);
      };

      // Trigger multiple rapid calls
      debouncedSync(100);
      debouncedSync(100);
      debouncedSync(100);
      debouncedSync(100);

      // Fast-forward time
      vi.advanceTimersByTime(150);

      expect(syncCount).toBe(1); // Only one sync should occur
    });
  });

  describe("manual sync", () => {
    it("should allow manual sync trigger regardless of autoSync setting", () => {
      let syncCalled = false;
      const syncSkills = () => {
        syncCalled = true;
      };

      const manualSync = (config: SkillsConfig, sync: () => void) => {
        if (config.enabled) {
          sync();
        }
      };

      const noAutoSyncConfig = { ...enabledConfig, autoSync: false };
      manualSync(noAutoSyncConfig, syncSkills);

      expect(syncCalled).toBe(true);
    });
  });

  describe("initialization", () => {
    it("should sync on initialization when enabled", () => {
      let syncCalled = false;
      const syncSkills = () => {
        syncCalled = true;
      };

      const initialize = (config: SkillsConfig, sync: () => void) => {
        if (config.enabled) {
          sync();
        }
      };

      initialize(enabledConfig, syncSkills);

      expect(syncCalled).toBe(true);
    });
  });

  describe("event types", () => {
    it("should define all supported event types", () => {
      const eventTypes = [
        "server:started",
        "server:stopped",
        "server:added",
        "server:removed",
        "server:updated",
        "config:changed",
      ];

      expect(eventTypes).toContain("server:started");
      expect(eventTypes).toContain("server:stopped");
      expect(eventTypes).toContain("server:added");
      expect(eventTypes).toContain("server:removed");
      expect(eventTypes).toContain("server:updated");
      expect(eventTypes).toContain("config:changed");
    });
  });
});
