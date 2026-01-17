import { create } from "zustand";
import { electronPlatformAPI } from "../platform-api/electron-platform-api";
import type { PlatformAPI, Workspace } from "@mcp_router/shared";
import { useServerStore } from "@/renderer/stores";

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadWorkspaces: () => Promise<void>;
  loadCurrentWorkspace: () => Promise<void>;
  createWorkspace: (config: any) => Promise<Workspace>;
  updateWorkspace: (id: string, updates: any) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  switchWorkspace: (id: string) => Promise<void>;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  setError: (error: string | null) => void;

  // Platform API related
  getPlatformAPI: () => PlatformAPI;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  currentWorkspace: null,
  isLoading: false,
  error: null,

  loadWorkspaces: async () => {
    set({ isLoading: true, error: null });
    try {
      const workspaces = await electronPlatformAPI.workspaces.list();
      set({ workspaces, isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Failed to load workspaces",
        isLoading: false,
      });
    }
  },

  loadCurrentWorkspace: async () => {
    try {
      const workspace = await electronPlatformAPI.workspaces.getActive();
      set({ currentWorkspace: workspace });
    } catch (error) {
      console.error("Failed to load current workspace:", error);
    }
  },

  createWorkspace: async (config) => {
    set({ isLoading: true, error: null });
    try {
      const newWorkspace = await electronPlatformAPI.workspaces.create(config);
      const workspaces = [...get().workspaces, newWorkspace];
      set({ workspaces, isLoading: false });
      return newWorkspace;
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Failed to create workspace",
        isLoading: false,
      });
      throw error;
    }
  },

  updateWorkspace: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const updatedWorkspace = await electronPlatformAPI.workspaces.update(
        id,
        updates,
      );
      const workspaces = get().workspaces.map((w) =>
        w.id === id ? updatedWorkspace : w,
      );
      set({ workspaces, isLoading: false });

      if (get().currentWorkspace?.id === id) {
        set({ currentWorkspace: updatedWorkspace });
      }
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Failed to update workspace",
        isLoading: false,
      });
      throw error;
    }
  },

  deleteWorkspace: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await electronPlatformAPI.workspaces.delete(id);
      const workspaces = get().workspaces.filter((w) => w.id !== id);
      set({ workspaces, isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete workspace",
        isLoading: false,
      });
      throw error;
    }
  },

  switchWorkspace: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await electronPlatformAPI.workspaces.switch(id);
      const workspace = get().workspaces.find((w) => w.id === id);
      if (workspace) {
        set({ currentWorkspace: workspace, isLoading: false });

        // Clear server store before switching
        useServerStore.getState().clearStore();

        // Refresh servers for the new workspace
        try {
          await useServerStore.getState().refreshServers();

          // Check for AutoStart servers that might still be starting
          const checkAutoStartServers = async (retryCount = 0) => {
            const servers = useServerStore.getState().servers;
            const hasStartingAutoStart = servers.some(
              (s) => s.status === "starting" && s.autoStart && !s.disabled,
            );

            if (hasStartingAutoStart && retryCount < 5) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              await useServerStore.getState().refreshServers();
              await checkAutoStartServers(retryCount + 1);
            }
          };

          await checkAutoStartServers();
        } catch (error) {
          console.error("Failed to refresh servers:", error);
        }
      }
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Failed to switch workspace",
        isLoading: false,
      });
      throw error;
    }
  },

  setCurrentWorkspace: (workspace) => {
    set({ currentWorkspace: workspace });
  },

  setError: (error) => {
    set({ error });
  },

  getPlatformAPI: () => {
    // Always use local electron API
    return electronPlatformAPI;
  },
}));

// Workspace switch event listener
if (typeof window !== "undefined" && window.electronAPI) {
  window.electronAPI.onWorkspaceSwitched((workspace: Workspace) => {
    useWorkspaceStore.getState().setCurrentWorkspace(workspace);
  });
}
