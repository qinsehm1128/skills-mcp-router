import type { Theme } from "./ui";

/**
 * MCP 端点模式
 */
export type MCPEndpointMode = "entry" | "aggregator";

/**
 * アプリケーション設定のインターフェース
 */
export interface AppSettings {
  /**
   * パッケージマネージャーオーバーレイの表示回数
   */
  packageManagerOverlayDisplayCount?: number;

  /**
   * 外部アプリケーションからのMCP設定の読み込みを有効化するか
   * デフォルト: true
   */
  loadExternalMCPConfigs?: boolean;

  /**
   * アナリティクスの送信を有効化するか
   * デフォルト: true
   */
  analyticsEnabled?: boolean;

  /**
   * 自動アップデートを有効化するか
   * デフォルト: true
   */
  autoUpdateEnabled?: boolean;

  /**
   * OS起動時にアプリを自動起動するか
   * デフォルト: false
   */
  openAtLogin?: boolean;

  /**
   * OS起動時にアプリのメインウィンドウを表示するか
   * デフォルト: true
   */
  showWindowOnStartup?: boolean;

  /**
   * アプリケーションのテーマ設定
   * デフォルト: "system"
   */
  theme?: Theme;

  /**
   * MCP 端点模式
   * entry: 只暴露 list_mcp_tools 和 call_mcp_tool
   * aggregator: 暴露所有工具
   * デフォルト: "entry"
   */
  mcpEndpointMode?: MCPEndpointMode;
}

/**
 * デフォルトのアプリケーション設定
 */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  packageManagerOverlayDisplayCount: 0,
  loadExternalMCPConfigs: true,
  analyticsEnabled: true,
  autoUpdateEnabled: true,
  openAtLogin: false,
  showWindowOnStartup: true,
  theme: "system",
  mcpEndpointMode: "entry",
};
