/**
 * Shared workspace types used across the application
 */

export interface Workspace {
  id: string;
  name: string;
  type: "local";
  isActive: boolean;
  createdAt: Date;
  lastUsedAt: Date;
  localConfig?: {
    databasePath: string;
  };
}

export interface WorkspaceCreateConfig {
  name: string;
  type: "local";
}

export interface WorkspaceUpdateConfig {
  name?: string;
}
