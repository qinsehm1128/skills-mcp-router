# Skills & Entry MCP Architecture

## Overview

This document describes the Skills file generation system and Entry MCP server feature, designed to reduce AI context overhead when using MCP Router.

## Problem Statement

When AI clients (like Cursor, Cline, Windsurf) connect to MCP Router, they receive all tools from all MCP servers. This leads to:
- Large context overhead in AI conversations
- Difficulty for AI to discover and understand available tools
- Inefficient tool selection when many MCPs are configured

## Solution

### 1. Skills File Generation

Generate a `.skills` file that summarizes all available MCP servers and their tools. AI clients can read this file for progressive discovery.

**Supported Formats:**
- Markdown (`.md`) - Human-readable, good for AI understanding
- YAML (`.yaml`) - Structured, easy to parse
- JSON (`.json`) - Machine-readable

**Output Paths:**
- Cursor: `~/.cursor/skills.md`
- Cline: `~/.cline/skills.md`
- Windsurf: `~/.windsurf/skills.md`
- Custom paths supported

### 2. Entry MCP Server

An optional MCP server that exposes only 2 tools instead of all individual tools:

| Tool | Description |
|------|-------------|
| `list_mcp_tools` | List all available MCP servers and their tools |
| `call_mcp_tool` | Call a specific tool on a specific MCP server |

This reduces context from potentially hundreds of tools to just 2.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      MCP Router                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐     ┌─────────────────────────────┐    │
│  │  Skills Module  │     │      Entry MCP Module        │    │
│  ├─────────────────┤     ├─────────────────────────────┤    │
│  │ - Generator     │     │ - EntryMCPService           │    │
│  │ - Service       │     │ - EntryMCPServer            │    │
│  │ - Repository    │     │   - list_mcp_tools          │    │
│  │ - Watcher       │     │   - call_mcp_tool           │    │
│  │ - IPC Handlers  │     │ - IPC Handlers              │    │
│  └────────┬────────┘     └──────────────┬──────────────┘    │
│           │                              │                   │
│           ▼                              ▼                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              MCPServerManager                        │    │
│  │  (Notifies on: start, stop, add, remove, update)    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Module Structure

### Skills Module
```
apps/electron/src/main/modules/skills/
├── index.ts              # Public exports
├── skills.generator.ts   # File content generation
├── skills.service.ts     # Business logic
├── skills.repository.ts  # Persistence (SharedConfig)
├── skills.watcher.ts     # Auto-sync on MCP changes
└── skills.ipc.ts         # IPC handlers
```

### Entry MCP Module
```
apps/electron/src/main/modules/entry-mcp/
├── index.ts              # Public exports
├── entry-mcp.service.ts  # Business logic
├── entry-mcp.server.ts   # MCP Server implementation
└── entry-mcp.ipc.ts      # IPC handlers
```

### Shared Types
```
packages/shared/src/types/
├── skills-types.ts       # SkillsConfig, SkillsOutputPath, etc.
└── entry-mcp-types.ts    # EntryMCPConfig, ListMCPToolsParams, etc.
```

### UI Components
```
apps/electron/src/renderer/components/skills/
└── SkillsPage.tsx        # Skills configuration page
```

## Data Flow

### Skills Auto-Sync
```
MCP Server Change
       │
       ▼
MCPServerManager (startServer/stopServer/addServer/removeServer/updateServer)
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
SkillsGenerator.generate() → Write to output paths
```

### Entry MCP Tool Call
```
AI Client calls call_mcp_tool
       │
       ▼
EntryMCPServer handles request
       │
       ▼
EntryMCPService.callMCPTool()
       │
       ▼
Validates server & tool exist
       │
       ▼
RequestHandlers.handleCallTool()
       │
       ▼
Returns result to AI Client
```

## Configuration

### Skills Config (SharedConfig)
```typescript
interface SkillsConfig {
  enabled: boolean;
  outputPaths: SkillsOutputPath[];
  format: "markdown" | "yaml" | "json";
  autoSync: boolean;
  customTemplate?: string;
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
| `skills:get-preset-path` | Get preset path for AI client |
| `skills:manual-sync` | Trigger manual sync |

### Entry MCP
| Channel | Description |
|---------|-------------|
| `entry-mcp:get-config` | Get current config |
| `entry-mcp:save-config` | Save config |
| `entry-mcp:toggle-enabled` | Toggle enabled |

## Testing

All modules are developed with TDD (Test-Driven Development):
- 83 unit tests covering types, services, and business logic
- Test files located in `apps/electron/test/unit/`

## Future Enhancements

1. **Custom Templates**: Allow users to define custom Skills file templates
2. **Entry MCP Hybrid Mode**: Option to expose both Entry MCP tools and original tools
3. **Skills File Validation**: Validate generated files match expected schema
4. **Real-time Preview**: Show Skills file preview in UI before sync
