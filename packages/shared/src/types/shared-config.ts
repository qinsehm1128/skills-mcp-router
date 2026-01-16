/**
 * 共通設定ファイルの型定義
 * ワークスペース間で共有される設定を管理
 */

import { AppSettings } from "./settings-types";
import { Token, TokenServerAccess } from "./token-types";
import { SkillsConfig } from "./skills-types";
import { AIConfig } from "./ai-config-types";

/**
 * 共通設定ファイルの構造
 */
export interface SharedConfig {
  /**
   * アプリケーション全体の設定
   */
  settings: AppSettings;

  /**
   * MCP Apps（トークン）の設定
   */
  mcpApps: {
    tokens: Token[];
  };

  /**
   * Skills設定
   */
  skills?: SkillsConfig;

  /**
   * AI設定
   */
  aiConfig?: AIConfig;

  /**
   * マイグレーション情報
   */
  _meta?: {
    version: string;
    migratedAt?: string;
    lastModified: string;
  };
}

/**
 * 共通設定マネージャーのインターフェース
 */
export interface ISharedConfigManager {
  /**
   * 設定を取得
   */
  getSettings(): AppSettings;

  /**
   * 設定を保存
   */
  saveSettings(settings: AppSettings): void;

  /**
   * トークンリストを取得
   */
  getTokens(): Token[];

  /**
   * トークンを保存
   */
  saveToken(token: Token): void;

  /**
   * トークンを削除
   */
  deleteToken(tokenId: string): void;

  /**
   * クライアントIDに関連するトークンを削除
   */
  deleteClientTokens(clientId: string): void;

  /**
   * トークンのサーバーアクセスを更新
   */
  updateTokenServerAccess(
    tokenId: string,
    serverAccess: TokenServerAccess,
  ): void;

  /**
   * 設定ファイルを初期化
   */
  initialize(): Promise<void>;

  /**
   * 既存データからマイグレーション
   */
  migrateFromDatabase(workspaceId: string): Promise<void>;

  /**
   * ワークスペースのサーバーリストとトークンを同期
   * 新しいサーバーがあれば自動的にトークンに追加
   */
  syncTokensWithWorkspaceServers(serverList: string[]): void;

  /**
   * Skills設定を取得
   */
  getSkillsConfig(): SkillsConfig;

  /**
   * Skills設定を保存
   */
  saveSkillsConfig(config: SkillsConfig): void;

  /**
   * AI設定を取得
   */
  getAIConfig(): AIConfig;

  /**
   * AI設定を保存
   */
  saveAIConfig(config: AIConfig): void;
}
