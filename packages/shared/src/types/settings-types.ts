import type { Theme } from "./ui";

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
   * OS起動時にアプリのメインウィンドウを表示するか
   * デフォルト: true
   */
  showWindowOnStartup?: boolean;

  /**
   * アプリケーションのテーマ設定
   * デフォルト: "system"
   */
  theme?: Theme;
}

/**
 * デフォルトのアプリケーション設定
 */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  packageManagerOverlayDisplayCount: 0,
  loadExternalMCPConfigs: true,
  analyticsEnabled: true,
  autoUpdateEnabled: true,
  showWindowOnStartup: true,
  theme: "system",
};
