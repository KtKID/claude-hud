# CLAUDE.md

本文件为 Claude Code 在此仓库中工作时提供指导。

## 项目概述

Claude HUD 是一个 Claude Code 插件，用于展示实时多行状态栏。它能显示上下文健康状况、工具活动、代理状态以及待办事项进度。

## 构建命令

```bash
npm ci               # 安装依赖
npm run build        # 将 TypeScript 构建到 dist/

# 使用示例 stdin 数据进行测试
echo '{"model":{"display_name":"Opus"},"context_window":{"current_usage":{"input_tokens":45000},"context_window_size":200000}}' | node dist/index.js
```

## 架构

### 数据流

```
Claude Code → stdin JSON → 解析 → 渲染行 → stdout → Claude Code 显示
           ↘ transcript_path → 解析 JSONL → 工具/代理/待办
```

**关键点**：状态栏由 Claude Code 每约 300ms 调用一次。每次调用会：
1. 通过 stdin 接收 JSON（模型、上下文、token——原生准确数据）
2. 解析 transcript JSONL 文件，提取工具、代理和待办事项
3. 向 stdout 渲染多行输出
4. Claude Code 显示所有行

### 数据来源

**来自 stdin JSON 的原生数据**（准确，无需估算）：
- `model.display_name` - 当前模型
- `context_window.current_usage` - token 用量
- `context_window.context_window_size` - 最大上下文
- `transcript_path` - 会话 transcript 路径

**通过解析 transcript JSONL 获得**：
- `tool_use` 块 → 工具名称、输入、开始时间
- `tool_result` 块 → 完成状态、耗时
- 运行中的工具 = 没有匹配 `tool_result` 的 `tool_use`
- `TodoWrite` 调用 → 待办列表
- `Task` 调用 → 代理信息

**来自配置文件**：
- MCP 数量来自 `~/.claude/settings.json`（mcpServers）
- Hooks 数量来自 `~/.claude/settings.json`（hooks）
- 规则数量来自 CLAUDE.md 文件

**来自 Claude Code stdin 的速率限制**：
- `rate_limits.five_hour.used_percentage` - 5 小时订阅用量百分比
- `rate_limits.five_hour.resets_at` - 5 小时重置时间戳
- `rate_limits.seven_day.used_percentage` - 7 天订阅用量百分比
- `rate_limits.seven_day.resets_at` - 7 天重置时间戳

### 文件结构

```
src/
├── index.ts           # 入口文件
├── stdin.ts           # 解析 Claude 的 JSON 输入
├── transcript.ts      # 解析 transcript JSONL
├── config-reader.ts   # 读取 MCP / 规则配置
├── config.ts          # 加载 / 校验用户配置
├── git.ts             # Git 状态（分支、脏状态、领先/落后）
├── types.ts           # TypeScript 接口
└── render/
    ├── index.ts       # 主渲染协调器
    ├── session-line.ts   # 紧凑模式：单行包含全部信息
    ├── tools-line.ts     # 工具活动（可选开启）
    ├── agents-line.ts    # 代理状态（可选开启）
    ├── todos-line.ts     # 待办进度（可选开启）
    ├── colors.ts         # ANSI 颜色辅助
    └── lines/
        ├── index.ts      # Barrel 导出
        ├── project.ts    # 第 1 行：模型括号 + 项目 + git
        ├── identity.ts   # 第 2a 行：上下文进度条
        ├── usage.ts      # 第 2b 行：用量进度条（与 identity 合并）
        └── environment.ts # 配置计数（可选开启）
```

### 输出格式（默认展开布局）

```
[Opus] │ my-project git:(main*)
Context █████░░░░░ 45% │ Usage ██░░░░░░░░ 25% (1h 30m / 5h)
```

第 1-2 行始终显示。其他行可通过配置开启：
- 工具行（`showTools`）：◐ Edit: auth.ts | ✓ Read ×3
- 代理行（`showAgents`）：◐ explore [haiku]: Finding auth code
- 待办行（`showTodos`）：▸ Fix authentication bug (2/5)
- 环境行（`showConfigCounts`）：2 CLAUDE.md | 4 rules

### 上下文阈值

| 阈值 | 颜色 | 动作 |
|------|------|------|
| <70% | 绿色 | 正常 |
| 70-85% | 黄色 | 警告 |
| >85% | 红色 | 显示 token 分解 |

## 插件配置

插件清单位于 `.claude-plugin/plugin.json`（仅包含元数据——名称、描述、版本、作者）。

**StatusLine 配置**需通过 `/claude-hud:setup` 添加到用户的 `~/.claude/settings.json`。

setup 命令会添加一条自动更新的命令，在运行时查找最新安装的版本。

注意：`statusLine` 不是 plugin.json 的合法字段。必须在插件安装后在 settings.json 中配置。更新是自动的——无需重新运行 setup。

## 依赖

- **运行时**：Node.js 18+ 或 Bun
- **构建**：TypeScript 5、ES2022 目标、NodeNext 模块
