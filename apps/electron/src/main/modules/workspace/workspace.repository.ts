import { BaseRepository } from "../../infrastructure/database/base-repository";
import {
  SqliteManager,
  getSqliteManager,
} from "../../infrastructure/database/sqlite-manager";
import { Workspace } from "@mcp_router/shared";

export class WorkspaceRepository extends BaseRepository<Workspace> {
  private static instance: WorkspaceRepository | null = null;

  private static readonly CREATE_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'local',
      isActive INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      lastUsedAt TEXT NOT NULL,
      localConfig TEXT
    )
  `;

  private static readonly INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_workspaces_active ON workspaces(isActive)",
    "CREATE INDEX IF NOT EXISTS idx_workspaces_last_used ON workspaces(lastUsedAt)",
  ];

  private constructor(db: SqliteManager) {
    super(db, "workspaces");
    console.log(
      "[WorkspaceRepository] Constructor called with database:",
      db?.getDbPath?.() || "database instance",
    );
  }

  public static getInstance(): WorkspaceRepository {
    const db = getSqliteManager();
    if (
      !WorkspaceRepository.instance ||
      WorkspaceRepository.instance.db !== db
    ) {
      WorkspaceRepository.instance = new WorkspaceRepository(db);
    }
    return WorkspaceRepository.instance;
  }

  public static resetInstance(): void {
    WorkspaceRepository.instance = null;
  }

  protected initializeTable(): void {
    try {
      this.db.execute(WorkspaceRepository.CREATE_TABLE_SQL);

      WorkspaceRepository.INDEXES.forEach((indexSQL) => {
        this.db.execute(indexSQL);
      });

      console.log("[WorkspaceRepository] Table initialization completed");
    } catch (error) {
      console.error("[WorkspaceRepository] Error initializing table:", error);
      throw error;
    }
  }

  protected mapRowToEntity(row: any): Workspace {
    return {
      id: row.id,
      name: row.name,
      type: "local",
      isActive: row.isActive === 1,
      createdAt: new Date(row.createdAt),
      lastUsedAt: new Date(row.lastUsedAt),
      localConfig: row.localConfig ? JSON.parse(row.localConfig) : undefined,
    };
  }

  protected mapEntityToRow(workspace: Workspace): any {
    return {
      id: workspace.id,
      name: workspace.name,
      type: "local",
      isActive: workspace.isActive ? 1 : 0,
      createdAt: workspace.createdAt.toISOString(),
      lastUsedAt: workspace.lastUsedAt.toISOString(),
      localConfig: workspace.localConfig
        ? JSON.stringify(workspace.localConfig)
        : null,
    };
  }

  getActiveWorkspace(): Workspace | null {
    return this.findOne("isActive = ?", [1]);
  }

  setActiveWorkspace(workspaceId: string): void {
    this.db.transaction(() => {
      this.db.execute("UPDATE workspaces SET isActive = 0");
      this.db.execute(
        "UPDATE workspaces SET isActive = 1, lastUsedAt = :lastUsedAt WHERE id = :id",
        {
          lastUsedAt: new Date().toISOString(),
          id: workspaceId,
        },
      );
    });
  }
}
