/**
 * AI Configuration Types
 * AI总结服务的类型定义
 */

/**
 * AI配置
 */
export interface AIConfig {
  /** 是否启用AI总结 */
  enabled: boolean;
  /** API基础URL（OpenAI格式） */
  baseUrl: string;
  /** API密钥 */
  apiKey: string;
  /** 模型名称 */
  model: string;
}

/**
 * AI总结请求
 */
export interface AISummaryRequest {
  /** 服务器名称 */
  serverName: string;
  /** 工具列表 */
  tools: Array<{
    name: string;
    description?: string;
  }>;
  /** 语言代码 (en, zh, ja) */
  language?: string;
}

/**
 * AI总结响应
 */
export interface AISummaryResponse {
  /** 生成的描述（最多50字符） */
  description: string;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * AI连接测试响应
 */
export interface AITestConnectionResponse {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 默认AI配置
 */
export const DEFAULT_AI_CONFIG: AIConfig = {
  enabled: false,
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
};
