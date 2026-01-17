import { SingletonService } from "@/main/modules/singleton-service";
import { SqliteManager } from "../../infrastructure/database/sqlite-manager";
import { session, app } from "electron";
import { EventEmitter } from "events";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import * as fsSync from "fs";
import type { Workspace, WorkspaceCreateConfig } from "@mcp_router/shared";

export class WorkspaceService extends SingletonService<
  Workspace,
  string,
  WorkspaceService
> {
  private electronSessions: Map<string, Electron.Session> = new Map();
  private databaseInstances: Map<string, SqliteManager> = new Map();
  private metaDb: SqliteManager | null = null;
  private eventEmitter: EventEmitter = new EventEmitter();

  public static getInstance(): WorkspaceService {
    return this.getInstanceBase();
  }

  public static resetInstance(): void {
    const instance = this.getInstance();
    instance.cleanup();
    this.resetInstanceBase(WorkspaceService);
  }

  public constructor() {
    super();
    this.initializeMetaDatabase();
  }

  private initializeMetaDatabase(): void {
    const metaDbPath = path.join(app.getPath("userData"), "mcprouter.db");
    this.metaDb = new SqliteManager(metaDbPath);
    this.createMetaTables();
    this.initializeDefaultWorkspace();
  }

  private createMetaTables(): void {
    if (!this.metaDb) return;

    this.metaDb.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'local',
        isActive INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        lastUsedAt TEXT NOT NULL,
        localConfig TEXT
      )
    `);
  }

  private initializeDefaultWorkspace(): void {
    if (!this.metaDb) return;

    const existing = this.metaDb
      .prepare("SELECT * FROM workspaces WHERE id = ?")
      .get("local-default");

    if (!existing) {
      const legacyDbPath = path.join(app.getPath("userData"), "mcprouter.db");
      const legacyDbExists = fsSync.existsSync(legacyDbPath);

      if (legacyDbExists) {
        console.log(
          "[WorkspaceService] Using existing mcprouter.db as default workspace",
        );

        const defaultWorkspace: Workspace = {
          id: "local-default",
          name: "Local",
          type: "local",
          isActive: true,
          createdAt: new Date(),
          lastUsedAt: new Date(),
          localConfig: {
            databasePath: "mcprouter.db",
          },
        };

        this.metaDb
          .prepare(
            `
          INSERT INTO workspaces (id, name, type, isActive, createdAt, lastUsedAt, localConfig)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
          )
          .run(
            defaultWorkspace.id,
            defaultWorkspace.name,
            defaultWorkspace.type,
            1,
            defaultWorkspace.createdAt.toISOString(),
            defaultWorkspace.lastUsedAt.toISOString(),
            JSON.stringify(defaultWorkspace.localConfig),
          );
      } else {
        const defaultWorkspace: Workspace = {
          id: "local-default",
          name: "Local",
          type: "local",
          isActive: true,
          createdAt: new Date(),
          lastUsedAt: new Date(),
          localConfig: {
            databasePath: path.join(
              "workspaces",
              "local-default",
              "database.db",
            ),
          },
        };

        this.metaDb
          .prepare(
            `
          INSERT INTO workspaces (id, name, type, isActive, createdAt, lastUsedAt, localConfig)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
          )
          .run(
            defaultWorkspace.id,
            defaultWorkspace.name,
            defaultWorkspace.type,
            1,
            defaultWorkspace.createdAt.toISOString(),
            defaultWorkspace.lastUsedAt.toISOString(),
            JSON.stringify(defaultWorkspace.localConfig),
          );
      }
    }
  }

  protected getEntityName(): string {
    return "Workspace";
  }

  async list(): Promise<Workspace[]> {
    try {
      if (!this.metaDb) return [];
      const rows = this.metaDb
        .prepare("SELECT * FROM workspaces ORDER BY lastUsedAt DESC")
        .all();
      return rows.map((row: any) => this.deserializeWorkspace(row));
    } catch (error) {
      return this.handleError("list", error, []);
    }
  }

  async findById(id: string): Promise<Workspace | null> {
    try {
      if (!this.metaDb) return null;
      const row = this.metaDb
        .prepare("SELECT * FROM workspaces WHERE id = ?")
        .get(id);
      return row ? this.deserializeWorkspace(row) : null;
    } catch (error) {
      return this.handleError("get", error, null);
    }
  }

  async create(config: WorkspaceCreateConfig): Promise<Workspace> {
    try {
      if (!this.metaDb) throw new Error("Meta database not initialized");

      const workspace: Workspace = {
        id: uuidv4(),
        name: config.name,
        type: "local",
        isActive: false,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        localConfig: {
          databasePath: path.join("workspaces", uuidv4(), "database.db"),
        },
      };

      this.metaDb
        .prepare(
          `
        INSERT INTO workspaces (id, name, type, isActive, createdAt, lastUsedAt, localConfig)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          workspace.id,
          workspace.name,
          workspace.type,
          0,
          workspace.createdAt.toISOString(),
          workspace.lastUsedAt.toISOString(),
          workspace.localConfig ? JSON.stringify(workspace.localConfig) : null,
        );

      return workspace;
    } catch (error) {
      return this.handleError("create", error);
    }
  }

  async update(id: string, updates: Partial<Workspace>): Promise<void> {
    try {
      if (!this.metaDb) throw new Error("Meta database not initialized");

      const workspace = await this.findById(id);
      if (!workspace) throw new Error(`Workspace ${id} not found`);

      const updated = { ...workspace, ...updates, lastUsedAt: new Date() };

      this.metaDb
        .prepare(
          `
        UPDATE workspaces 
        SET name = ?, isActive = ?, lastUsedAt = ?, localConfig = ?
        WHERE id = ?
      `,
        )
        .run(
          updated.name,
          updated.isActive ? 1 : 0,
          updated.lastUsedAt.toISOString(),
          updated.localConfig ? JSON.stringify(updated.localConfig) : null,
          id,
        );
    } catch (error) {
      this.handleError("update", error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      if (!this.metaDb) throw new Error("Meta database not initialized");

      if (id === "local-default") {
        throw new Error("Cannot delete default local workspace");
      }

      const workspace = await this.findById(id);
      if (!workspace) {
        throw new Error("Workspace not found");
      }

      if (workspace.isActive) {
        await this.switchWorkspace("local-default");
      }

      if (this.databaseInstances.has(id)) {
        const db = this.databaseInstances.get(id);
        db?.close();
        this.databaseInstances.delete(id);
      }

      if (this.electronSessions.has(id)) {
        this.electronSessions.delete(id);
      }

      if (workspace.localConfig?.databasePath) {
        const workspaceDir = path.dirname(
          path.join(
            app.getPath("userData"),
            workspace.localConfig.databasePath,
          ),
        );
        await fs.rm(workspaceDir, { recursive: true, force: true });
      }

      this.metaDb.prepare("DELETE FROM workspaces WHERE id = ?").run(id);
    } catch (error) {
      this.handleError("delete", error);
    }
  }

  async getActiveWorkspace(): Promise<Workspace | null> {
    try {
      if (!this.metaDb) return null;
      const row = this.metaDb
        .prepare("SELECT * FROM workspaces WHERE isActive = 1")
        .get();
      return row ? this.deserializeWorkspace(row) : null;
    } catch (error) {
      return this.handleError("get active workspace", error, null);
    }
  }

  async getWorkspaceDatabase(workspaceId: string): Promise<SqliteManager> {
    if (!this.databaseInstances.has(workspaceId)) {
      const workspace = await this.findById(workspaceId);
      if (!workspace) throw new Error(`Workspace ${workspaceId} not found`);

      const dbPath =
        workspace.localConfig?.databasePath ||
        path.join("workspaces", workspaceId, "database.db");

      const fullPath = path.join(app.getPath("userData"), dbPath);

      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      const db = new SqliteManager(fullPath);
      this.databaseInstances.set(workspaceId, db);
    }

    const db = this.databaseInstances.get(workspaceId);
    if (!db) throw new Error(`Database for workspace ${workspaceId} not found`);

    return db;
  }

  getIsolatedSession(workspaceId: string): Electron.Session {
    if (!this.electronSessions.has(workspaceId)) {
      const partition = `persist:workspace-${workspaceId}`;
      const isolatedSession = session.fromPartition(partition);
      this.electronSessions.set(workspaceId, isolatedSession);
    }
    return this.electronSessions.get(workspaceId)!;
  }

  async switchWorkspace(workspaceId: string): Promise<void> {
    try {
      if (!this.metaDb) throw new Error("Meta database not initialized");

      const workspace = await this.findById(workspaceId);
      if (!workspace) {
        throw new Error("Workspace not found");
      }

      const currentWorkspace = await this.getActiveWorkspace();
      if (currentWorkspace && this.databaseInstances.has(currentWorkspace.id)) {
        const currentDb = this.databaseInstances.get(currentWorkspace.id);
        currentDb?.close();
        this.databaseInstances.delete(currentWorkspace.id);
      }

      this.metaDb.transaction(() => {
        this.metaDb!.prepare("UPDATE workspaces SET isActive = 0").run();
        this.metaDb!.prepare(
          "UPDATE workspaces SET isActive = 1, lastUsedAt = ? WHERE id = ?",
        ).run(new Date().toISOString(), workspaceId);
      });

      this.eventEmitter.emit("workspace-switched", workspace);
    } catch (error) {
      this.handleError("switch", error);
    }
  }

  onWorkspaceSwitched(callback: (workspace: Workspace) => void): void {
    this.eventEmitter.on("workspace-switched", callback);
  }

  offWorkspaceSwitched(callback: (workspace: Workspace) => void): void {
    this.eventEmitter.off("workspace-switched", callback);
  }

  private deserializeWorkspace(row: any): Workspace {
    return {
      id: row.id,
      name: row.name,
      type: "local",
      isActive: row.isActive === 1,
      localConfig: row.localConfig ? JSON.parse(row.localConfig) : undefined,
      createdAt: new Date(row.createdAt),
      lastUsedAt: new Date(row.lastUsedAt),
    };
  }

  private cleanup(): void {
    for (const [_, db] of this.databaseInstances) {
      db.close();
    }
    this.databaseInstances.clear();

    if (this.metaDb) {
      this.metaDb.close();
      this.metaDb = null;
    }

    this.electronSessions.clear();
  }
}

export function getWorkspaceService(): WorkspaceService {
  return WorkspaceService.getInstance();
}
