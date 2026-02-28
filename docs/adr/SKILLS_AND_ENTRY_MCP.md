# Skills & Entry MCP & AI Summary Architecture

## Overview

This document describes the Skills file generation system, Entry MCP server feature, and AI Summary functionality, designed to reduce AI context overhead and enhance MCP server management in MCP Router.

## Problem Statement

When AI clients (like Cursor, Cline, Windsurf) connect to MCP Router, they receive all tools from all MCP servers. This leads to:
- Large context overhead in AI conversations
- Difficulty for AI to discover and understand available tools
- Inefficient tool selection when many MCPs are configured
- Lack of meaningful descriptions for MCP servers

## Solution

### 1. Skills File Generation

Generate a `SKILL.md` file following the [agentskills.io](https://agentskills.io) specification. This file summarizes all available MCP servers and their tools for AI progressive discovery.

**Format:** SKILL.md with YAML frontmatter + Markdown body

**Output Path Structure:**
```
<base_path>/skills/mcp-router/SKILL.md
```

**Template System:**
- YAML frontmatter for metadata (name, version, description, author, etc.)
- Markdown body with placeholders: `{{SERVERS_LIST}}`, `{{TOOLS_LIST}}`, `{{GENERATED_AT}}`
- Customizable via UI template editor with live preview

### 2. Entry MCP Server

The default MCP endpoint (`/mcp`) now exposes only 2 tools instead of all individual tools:

| Tool | Description |
|------|-------------|
| `list_mcp_tools` | Query tools for a specific MCP server (mcpName required) |
| `call_mcp_tool` | Call a specific tool on a specific MCP server |

**Important Changes:**
- `list_mcp_tools` now **requires** `mcpName` parameter
- If `mcpName` is not provided, returns: "请查看mcp-router技能"
- Original aggregator mode available at `/mcp/aggregator` endpoint

### 3. AI Summary Feature

OpenAI-compatible API integration for automatically generating MCP server descriptions.

**Features:**
- Configurable API endpoint (supports OpenAI, Azure, Ollama, etc.)
- Multilingual support (English, Chinese, Japanese)
- Auto-filters `<think>` tags and other XML content from responses
- 50 character/word limit for descriptions
- Test connection functionality

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MCP Router                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐     │
│  │Skills Module │  │Entry MCP     │  │AI Summary Module   │     │
│  ├──────────────┤  ├──────────────┤  ├────────────────────┤     │
│  │- Generator   │  │- Service     │  │- AISummaryService  │     │
│  │- Service     │  │- Server      │  │- IPC Handlers      │     │
│  │- Repository  │  │  - list_mcp  │  │- OpenAI API        │     │
│  │- Watcher     │  │  - call_mcp  │  │- Multi-language    │     │
│  │- IPC         │  │- IPC         │  └────────────────────┘     │
│  └──────┬───────┘  └──────┬───────┘                             │
│         │                  │                                     │
│         ▼                  ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  MCPServerManager                        │    │
│  │    (Notifies on: start, stop, add, remove, update)      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   MCPHttpServer                          │    │
│  │  /mcp           → EntryMCPServer (2 tools only)         │    │
│  │  /mcp/aggregator → AggregatorServer (all tools)         │    │
│  │  /mcp/sse       → SSE connections                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Module Structure

### Skills Module
```
apps/electron/src/main/modules/skills/
├── index.ts              # Public exports
├── skills.generator.ts   # SKILL.md generation with template support
├── skills.service.ts     # Business logic, path: <base>/skills/mcp-router/SKILL.md
├── skills.repository.ts  # Persistence (SharedConfig)
├── skills.watcher.ts     # Auto-sync on MCP changes
└── skills.ipc.ts         # IPC handlers
```

### Entry MCP Module
```
apps/electron/src/main/modules/entry-mcp/
├── index.ts              # Public exports
├── entry-mcp.service.ts  # Business logic with dynamic tool fetching
├── entry-mcp.server.ts   # MCP Server implementation
└── entry-mcp.ipc.ts      # IPC handlers
```

### AI Summary Module
```
apps/electron/src/main/modules/ai-summary/
├── index.ts              # Public exports
├── ai-summary.service.ts # OpenAI API integration, response cleaning
└── ai-summary.ipc.ts     # IPC handlers
```

### Shared Types
```
packages/shared/src/types/
├── skills-types.ts       # SkillsConfig, DEFAULT_SKILL_TEMPLATE
├── entry-mcp-types.ts    # EntryMCPConfig, ListMCPToolsResult (with message field)
└── ai-config-types.ts    # AIConfig, AISummaryRequest (with language field)
```

### UI Components
```
apps/electron/src/renderer/components/skills/
└── SkillsPage.tsx        # Template editor with edit/preview tabs

apps/electron/src/renderer/components/setting/
└── Settings.tsx          # AI config card, HTTP server info card
```

## HTTP Server Endpoints

| Endpoint | Mode | Description |
|----------|------|-------------|
| `POST /mcp` | Entry MCP | Only exposes `list_mcp_tools` and `call_mcp_tool` |
| `POST /mcp/aggregator` | Aggregator | Exposes all tools from all servers |
| `GET /mcp/sse` | SSE | Server-Sent Events connection |

Default port: **3282**

## Entry MCP Tool Definitions

### list_mcp_tools

```typescript
{
  name: "list_mcp_tools",
  description: `查询指定MCP服务器的可用工具列表。

使用前提：
- 必须先阅读 mcp-router 的 SKILL.md 技能文件了解有哪些可用的MCP服务器
- 必须指定 mcpName 参数

返回信息包含：服务器描述、工具列表及每个工具的用途说明。`,
  inputSchema: {
    type: "object",
    properties: {
      mcpName: {
        type: "string",
        description: "必填，MCP服务器名称（从SKILL.md技能文件中获取）"
      }
    },
    required: ["mcpName"]
  }
}
```

### call_mcp_tool

```typescript
{
  name: "call_mcp_tool",
  description: `调用指定MCP服务器上的工具。

使用流程：
1. 先使用 list_mcp_tools 查询目标服务器的工具列表
2. 根据工具描述选择合适的工具
3. 按照工具的 inputSchema 提供正确的参数

注意事项：
- 调用前必须确认工具名称和参数格式正确
- 如果调用失败，请检查参数是否符合工具要求
- 不要重复调用同一工具，除非用户明确要求
- 可选 timeoutSec 参数可覆盖默认超时（默认 300 秒）`,
  inputSchema: {
    type: "object",
    properties: {
      mcpName: { type: "string", description: "MCP服务器名称" },
      toolName: { type: "string", description: "要调用的工具名称" },
      arguments: { type: "object", description: "工具参数" },
      timeoutSec: {
        type: "number",
        description: "可选，调用超时时间（秒），默认 300 秒",
        minimum: 1,
        default: 300
      }
    },
    required: ["mcpName", "toolName"]
  }
}
```

## AI Summary Configuration

### AIConfig Interface
```typescript
interface AIConfig {
  enabled: boolean;
  baseUrl: string;      // e.g., "https://api.openai.com/v1"
  apiKey: string;
  model: string;        // e.g., "gpt-4o-mini"
}
```

### AISummaryRequest Interface
```typescript
interface AISummaryRequest {
  serverName: string;
  tools: Array<{ name: string; description?: string }>;
  language?: string;    // "en" | "zh" | "ja"
}
```

### Response Cleaning

The AI Summary service cleans responses by:
1. Removing `<think>...</think>` and `<thinking>...</thinking>` tags
2. Removing unclosed think tags
3. Stripping all HTML/XML tags
4. Removing quote wrappers
5. Filtering template prefixes ("This is a...", "Description:", etc.)
6. Taking only the first line of multi-line responses

## Data Flow

### Skills Auto-Sync
```
MCP Server Change (start/stop/add/remove/update description)
       │
       ▼
MCPServerManager
       │
       ▼
SkillsWatcher.onServerXxx()
       │
       ▼
Debounce (500ms)
       │
       ▼
SkillsService.syncToAllPaths()
       │
       ▼
SkillsGenerator.generate() → Write to <base>/skills/mcp-router/SKILL.md
```

### Entry MCP Tool Call (Dynamic Tool Fetching)
```
AI Client calls list_mcp_tools(mcpName: "xxx")
       │
       ▼
EntryMCPServer handles request
       │
       ▼
EntryMCPService.listMCPTools()
       │
       ▼
deps.getServerTools(serverId)  ← Dynamic fetch from MCPServerManager
       │
       ▼
Returns server info with tools and inputSchema
```

### AI Description Generation
```
User clicks "AI Generate" button
       │
       ▼
Frontend sends request with { serverName, tools, language }
       │
       ▼
AISummaryService.generateSummary()
       │
       ▼
OpenAI API call with language-specific prompt
       │
       ▼
cleanAIResponse() → Filter tags, clean output
       │
       ▼
Return description (max 50 chars/words)
```

## Configuration

### Skills Config (SharedConfig)
```typescript
interface SkillsConfig {
  enabled: boolean;
  outputPaths: SkillsOutputPath[];  // { basePath, enabled }
  autoSync: boolean;
  template: string;  // YAML frontmatter + Markdown body
}
```

### Entry MCP Config
```typescript
interface EntryMCPConfig {
  enabled: boolean;
  port: number;
  exposeOriginalTools: boolean;
  description?: string;
}
```

## IPC Channels

### Skills
| Channel | Description |
|---------|-------------|
| `skills:get-config` | Get current config |
| `skills:save-config` | Save config |
| `skills:add-output-path` | Add output path |
| `skills:remove-output-path` | Remove output path |
| `skills:toggle-output-path` | Toggle path enabled |
| `skills:manual-sync` | Trigger manual sync |
| `skills:get-template` | Get current template |
| `skills:save-template` | Save custom template |
| `skills:validate-template` | Validate template syntax |

### Entry MCP
| Channel | Description |
|---------|-------------|
| `entry-mcp:get-config` | Get current config |
| `entry-mcp:save-config` | Save config |
| `entry-mcp:toggle-enabled` | Toggle enabled |

### AI Summary
| Channel | Description |
|---------|-------------|
| `ai-summary:get-config` | Get AI config |
| `ai-summary:save-config` | Save AI config |
| `ai-summary:test-connection` | Test API connection |
| `ai-summary:generate` | Generate description |
| `ai-summary:is-enabled` | Check if AI is enabled |

### System
| Channel | Description |
|---------|-------------|
| `system:getHttpServerInfo` | Get HTTP server port and status |

## i18n Support

All UI text is internationalized with support for:
- English (en)
- Chinese (zh)
- Japanese (ja)

Key translation namespaces:
- `skills.*` - Skills page translations
- `aiConfig.*` - AI configuration translations
- `mcpDescription.*` - MCP description field translations
- `settings.httpServer*` - HTTP server info translations

## CLI Usage

Connect to MCP Router from external clients:

```bash
# Using project CLI
node "E:\githubProject\mcp-router\apps\cli\dist\mcpr.js" connect --url http://localhost:3282/mcp

# In claude_desktop_config.json or Cursor MCP config
{
  "mcpServers": {
    "mcp-router": {
      "command": "node",
      "args": ["path/to/mcpr.js", "connect", "--url", "http://localhost:3282/mcp"]
    }
  }
}
```

## Testing

All modules are developed with TDD (Test-Driven Development):
- Unit tests covering types, services, and business logic
- Test files located in `apps/electron/test/unit/`

## Changelog

### 2026-01-16
- Changed `/mcp` endpoint to use EntryMCPServer (only 2 tools)
- Added `/mcp/aggregator` endpoint for original aggregator mode
- Made `mcpName` required for `list_mcp_tools`
- Added dynamic tool fetching (no more cached tools issue)
- Added `inputSchema` to tool listing output
- Enhanced tool descriptions with usage instructions
- Added HTTP server info card in Settings page
- Added `message` field to `ListMCPToolsResult` type
- Added `language` field to `AISummaryRequest` for multilingual generation

### 2026-01-15
- Initial implementation of Skills, Entry MCP, and AI Summary modules
- Skills file generation following agentskills.io SKILL.md spec
- Template editor with edit/preview tabs
- AI description generation with OpenAI-compatible API
- MCP description field in server creation and advanced configuration
- Auto-sync Skills when description changes on running servers
