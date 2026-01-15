/**
 * AI Summary Service
 * 使用OpenAI格式API生成MCP服务器描述
 */

import type {
  AIConfig,
  AISummaryRequest,
  AISummaryResponse,
  AITestConnectionResponse,
} from "@mcp_router/shared";
import { getSharedConfigManager } from "@/main/infrastructure/shared-config-manager";

/**
 * 根据语言生成提示词
 */
function getSummaryPrompt(language: string): string {
  const prompts: Record<string, string> = {
    zh: `你是一个帮助总结MCP服务器的AI助手。
根据服务器名称和工具列表，生成一个简洁的描述。

严格要求：
- 描述必须在50个字以内
- 说明这个服务器的用途
- 只输出描述文本，不要任何解释、标签或思考过程
- 不要使用引号包裹`,

    ja: `あなたはMCPサーバーを要約するAIアシスタントです。
サーバー名とツールリストに基づいて、簡潔な説明を生成してください。

厳格な要件：
- 説明は50文字以内
- このサーバーの用途を説明
- 説明テキストのみを出力、説明やタグや思考プロセスは不要
- 引用符で囲まない`,

    en: `You are an AI assistant helping to summarize MCP servers.
Generate a concise description based on the server name and tools list.

Strict requirements:
- Description MUST be 50 words or less
- Explain what this server does
- Output ONLY the description text, no explanation, tags, or thinking process
- Do not wrap in quotes`,
  };

  return prompts[language] || prompts.en;
}

/**
 * 清理AI响应中的思考过程和模板文字
 */
function cleanAIResponse(text: string): string {
  if (!text) return "";
  
  let result = text;
  
  // 1. 过滤 <think>...</think> 和 <thinking>...</thinking> 标签及内容
  result = result.replace(/<think>[\s\S]*?<\/think>/gi, "");
  result = result.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  
  // 2. 过滤未闭合的 <think> 或 <thinking> 标签 (从标签到文本末尾)
  result = result.replace(/<think>[\s\S]*/gi, "");
  result = result.replace(/<thinking>[\s\S]*/gi, "");
  
  // 3. 过滤其他所有XML/HTML标签
  result = result.replace(/<[^>]*>/g, "");
  
  // 4. 移除引号包裹
  result = result.replace(/^["'`]+|["'`]+$/g, "");
  
  // 5. 移除常见的模板开头文字
  const templatePatterns = [
    /^This is an? .+?(?:called|named) ["']?.+?["']?[.:]\s*/i,
    /^Here'?s? (?:the |a )?(?:concise )?description[.:]\s*/i,
    /^Description[.:]\s*/i,
    /^Summary[.:]\s*/i,
    /^以下是.+?描述[：:]\s*/,
    /^描述[：:]\s*/,
    /^説明[：:]\s*/,
  ];
  
  for (const pattern of templatePatterns) {
    result = result.replace(pattern, "");
  }
  
  // 6. 取第一行（如果有多行输出，通常第一行是描述）
  const lines = result.split(/\n/).filter(line => line.trim());
  if (lines.length > 0) {
    result = lines[0];
  }
  
  return result.trim();
}

export class AISummaryService {
  private config: AIConfig;

  constructor() {
    this.config = getSharedConfigManager().getAIConfig();
  }

  /**
   * 刷新配置
   */
  public refreshConfig(): void {
    this.config = getSharedConfigManager().getAIConfig();
  }

  /**
   * 获取当前配置
   */
  public getConfig(): AIConfig {
    return { ...this.config };
  }

  /**
   * 保存配置
   */
  public saveConfig(config: AIConfig): void {
    this.config = { ...config };
    getSharedConfigManager().saveAIConfig(config);
  }

  /**
   * 测试连接
   */
  public async testConnection(): Promise<AITestConnectionResponse> {
    if (!this.config.baseUrl || !this.config.apiKey) {
      return { success: false, error: "API URL and Key are required" };
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `API error: ${response.status} ${error}`,
        };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || "Connection failed" };
    }
  }

  /**
   * 生成MCP服务器描述
   */
  public async generateSummary(
    request: AISummaryRequest,
  ): Promise<AISummaryResponse> {
    console.log("[AI Summary] generateSummary called with:", {
      serverName: request.serverName,
      toolsCount: request.tools.length,
    });
    console.log("[AI Summary] Current config:", {
      enabled: this.config.enabled,
      baseUrl: this.config.baseUrl,
      model: this.config.model,
      hasApiKey: Boolean(this.config.apiKey),
    });

    if (!this.config.enabled) {
      console.log("[AI Summary] AI is disabled");
      return {
        description: "",
        success: false,
        error: "AI summary is disabled",
      };
    }

    if (!this.config.baseUrl || !this.config.apiKey) {
      console.log("[AI Summary] API not configured");
      return { description: "", success: false, error: "API not configured" };
    }

    try {
      const language = request.language || "en";
      const toolsList = request.tools
        .map((t) => `- ${t.name}: ${t.description || "No description"}`)
        .join("\n");

      const userMessage = `Server Name: ${request.serverName}

Tools (${request.tools.length}):
${toolsList}

Generate a concise description (max 50 characters) for this MCP server:`;

      console.log("[AI Summary] Sending request to:", `${this.config.baseUrl}/chat/completions`);
      console.log("[AI Summary] Language:", language);

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: "system", content: getSummaryPrompt(language) },
            { role: "user", content: userMessage },
          ],
          max_tokens: 100,
          temperature: 0.7,
        }),
      });

      console.log("[AI Summary] Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[AI Summary] API error response:", errorText);
        return {
          description: "",
          success: false,
          error: `API error: ${response.status}`,
        };
      }

      const data = await response.json();
      console.log("[AI Summary] API response data:", JSON.stringify(data, null, 2));
      
      // 尝试多种响应格式
      let description = "";
      
      // OpenAI 格式: data.choices[0].message.content
      if (data.choices?.[0]?.message?.content) {
        description = data.choices[0].message.content.trim();
      }
      // 某些API可能直接返回 data.content
      else if (data.content) {
        description = typeof data.content === "string" 
          ? data.content.trim() 
          : data.content[0]?.text?.trim() || "";
      }
      // Claude 格式: data.content[0].text
      else if (data.content?.[0]?.text) {
        description = data.content[0].text.trim();
      }
      // 其他格式
      else if (data.text) {
        description = data.text.trim();
      }
      else if (data.response) {
        description = data.response.trim();
      }

      console.log("[AI Summary] Raw parsed description (full content):\n", description);

      // 保存原始内容用于调试
      const rawContent = description;

      // 清理AI输出中的思考过程和模板文字
      description = cleanAIResponse(description);

      console.log("[AI Summary] Cleaned description:", description);
      console.log("[AI Summary] Raw vs Cleaned - Raw length:", rawContent.length, "Cleaned length:", description.length);

      if (!description) {
        console.error("[AI Summary] Could not parse description from response");
        return {
          description: "",
          success: false,
          error: "Could not parse API response",
        };
      }

      // 限制50字符
      if (description.length > 50) {
        description = description.substring(0, 47) + "...";
      }

      console.log("[AI Summary] Final description:", description);
      return { description, success: true };
    } catch (error: any) {
      console.error("[AI Summary] Exception:", error);
      return {
        description: "",
        success: false,
        error: error.message || "Failed to generate summary",
      };
    }
  }

  /**
   * 检查是否已配置且启用
   */
  public isEnabled(): boolean {
    const result =
      this.config.enabled &&
      Boolean(this.config.baseUrl) &&
      Boolean(this.config.apiKey);
    console.log("[AI Summary] isEnabled check:", {
      enabled: this.config.enabled,
      hasBaseUrl: Boolean(this.config.baseUrl),
      hasApiKey: Boolean(this.config.apiKey),
      result,
    });
    return result;
  }
}

// 单例
let aiSummaryServiceInstance: AISummaryService | null = null;

export function getAISummaryService(): AISummaryService {
  if (!aiSummaryServiceInstance) {
    aiSummaryServiceInstance = new AISummaryService();
  }
  return aiSummaryServiceInstance;
}

export function resetAISummaryService(): void {
  aiSummaryServiceInstance = null;
}
