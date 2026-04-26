# Claude HUD 配置指南（中文）

> 本文档是 `~/.claude/plugins/claude-hud/config.json` 的**全量中文说明**。
> 字段源头：`src/config.ts` 的 `DEFAULT_CONFIG`（claude-hud 0.1.0）。

---

## 目录

- [基础](#基础)
- [配置文件位置](#配置文件位置)
- [JSON 不允许注释怎么办](#json-不允许注释怎么办)
- [字段清单](#字段清单)
  - [顶层基础](#顶层基础)
  - [`elementOrder` 元素顺序](#elementorder-元素顺序)
  - [`gitStatus` Git 状态](#gitstatus-git-状态)
  - [`display` 显示开关](#display-显示开关)
  - [`colors` 颜色](#colors-颜色)
- [常用配置配方](#常用配置配方)
- [故障排查](#故障排查)

---

## 基础

Claude HUD 每次状态栏刷新（~300ms）都会**重新读**一次 `config.json`，所以改完保存立刻生效，不用重启 Claude Code。

**解析策略（关键）**：

1. 文件不存在 → 用全默认配置
2. 文件存在但 `JSON.parse` 失败 → 静默降级到全默认配置
3. 文件合法但某字段值无效 → 只那一个字段回退默认，其余字段正常

所以**改错了最多退回默认**，不会让 HUD 崩溃。

## 配置文件位置

```
~/.claude/plugins/claude-hud/config.json
```

目录不存在就先建：

```bash
mkdir -p ~/.claude/plugins/claude-hud
```

## JSON 不允许注释怎么办

严格 JSON 规范不支持 `//` 或 `/* */`。三种实用做法：

### ① 双文件法（推荐）

```
~/.claude/plugins/claude-hud/
├── config.json             ← 实际使用，纯净合法 JSON
└── config.schema.jsonc     ← 参考手册，带 // 注释的完整模板
```

- VS Code 原生识别 `.jsonc` 扩展，支持语法高亮 + `//` 注释
- HUD 只读 `config.json`
- 编辑时对着 `.jsonc` 参考，在 `config.json` 里实际写

### ② 伪字段法

HUD 用白名单校验，未知字段会被忽略——所以可以加 `_doc_*` 前缀的说明字段：

```json
{
  "_doc_language": "en=英文 zh=中文",
  "language": "zh",
  "_doc_lineLayout": "expanded 多行，compact 单行",
  "lineLayout": "expanded"
}
```

合法 JSON，可用但略臃肿。

### ③ 纯 JSON + 查本文档

保持 `config.json` 干净，所有说明去查 `CONFIG_GUIDE.zh.md`（也就是这份）。

---

## 字段清单

### 顶层基础

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `language` | `"en"` \| `"zh"` | `"en"` | HUD 标签语言 |
| `lineLayout` | `"expanded"` \| `"compact"` | `"expanded"` | `expanded` 多行布局 / `compact` 所有字段压到一行 |
| `showSeparators` | boolean | `false` | 行间是否显示分隔符 |
| `pathLevels` | `1` \| `2` \| `3` | `1` | 项目路径显示几层目录 |
| `maxWidth` | number \| null | `null` | 终端宽度检测失败时的兜底宽度；正常不需要设 |

### `elementOrder` 元素顺序

```json
"elementOrder": [
  "model", "project",
  "context", "promptCache",
  "usage",
  "cost", "duration", "speed",
  "environment", "version", "sessionName", "outputStyle",
  "memory", "extraLabel", "customLine",
  "tools", "agents", "todos"
]
```

- 控制 `expanded` 布局下元素的**出现顺序**
- 从数组**移除**某项 = 该元素不显示（比 `display.showXxx` 更彻底）
- 可选值（细粒度）：
  - **身份类**：`model`、`project`、`git`、`version`、`sessionName`
  - **上下文类**：`context`、`promptCache`、`memory`
  - **用量类**：`usage`、`cost`、`duration`、`speed`
  - **环境类**：`environment`、`outputStyle`、`extraLabel`、`customLine`
  - **活动类**：`tools`、`agents`、`todos`
- **向后兼容**：旧的 `"project"` 关键字仍然可用，加载配置时会自动展开为
  `model + project + git + version + duration + cost + speed + sessionName
  + extraLabel + customLine + outputStyle` 这 10 个细粒度子项。如果你的
  `elementOrder` 数组里已经显式列出了任意一个细粒度子项，则跳过展开
  （默认认为你已经手动迁移）。

### `gitStatus` Git 状态

```json
"gitStatus": {
  "enabled": true,
  "showDirty": true,
  "showAheadBehind": false,
  "showFileStats": false,
  "branchOverflow": "truncate",
  "pushWarningThreshold": 0,
  "pushCriticalThreshold": 0
}
```

| 字段 | 默认 | 说明 | 显示样例 |
|---|---|---|---|
| `enabled` | `true` | Git 总开关 | — |
| `showDirty` | `true` | 脏状态标记 | `git:(main*)` |
| `showAheadBehind` | `false` | 领先/落后远程 | `git:(main ↑2 ↓1)` |
| `showFileStats` | `false` | 文件变更计数 | `git:(main* !3 +1 ✘0 ?2)` |
| `branchOverflow` | `"truncate"` | 分支名过长：`truncate` 截断 / `wrap` 换行 | — |
| `pushWarningThreshold` | `0` | 领先 N 个未推时变黄；`0` 禁用 | — |
| `pushCriticalThreshold` | `0` | 领先 N 个未推时变红；`0` 禁用 | — |

**文件状态符号**：`!` 修改 · `+` 新增/staged · `✘` 删除 · `?` 未跟踪。0 的计数会省略。

### `display` 显示开关

#### 基础元素（默认开，一般不动）

| 字段 | 默认 | 说明 |
|---|---|---|
| `showModel` | `true` | 模型徽章 `[Opus]` |
| `showProject` | `true` | 项目路径 |
| `showContextBar` | `true` | Context 可视进度条 |
| `showUsage` | `true` | 订阅用量限额（5h / 7d） |
| `usageBarEnabled` | `true` | Usage 用可视条；`false` = 纯文字 |
| `showResetLabel` | `true` | 重置倒计时前缀 `resets in` |
| `showTokenBreakdown` | `true` | Context >85% 时自动展开 token 细节 |

#### Context 格式

| 字段 | 取值 | 效果 |
|---|---|---|
| `contextValue` | `"percent"` | `45%`（默认） |
| | `"tokens"` | `45k/200k` |
| | `"remaining"` | `55%` 剩余 |
| | `"both"` | `45% (45k/200k)` |

#### Usage 格式

| 字段 | 默认 | 说明 |
|---|---|---|
| `usageCompact` | `false` | `true` → 简短格式 `5h: 25% (1h 30m)` |
| `timeFormat` | `"relative"` | `relative` 倒计时 / `absolute` 时钟 / `both` 都显 |

#### 可选元素（默认关，按需开）

| 字段 | 默认 | 启用后显示 |
|---|---|---|
| `showTools` | `false` | ◐ Edit: auth.ts \| ✓ Read ×3 |
| `showAgents` | `false` | ◐ explore [haiku]: Finding auth code |
| `showTodos` | `false` | ▸ Fix authentication bug (2/5) |
| `showConfigCounts` | `false` | 2 CLAUDE.md \| 4 rules \| 1 MCPs |
| `showCost` | `false` | 本 session 成本估算 |
| `showDuration` | `false` | ⏱️ 5m |
| `showSpeed` | `false` | out: 42.1 tok/s |
| `showMemoryUsage` | `false` | 本机 RAM 使用条（仅 expanded 生效） |
| `showPromptCache` | `false` | Prompt cache 剩余 TTL 倒计时 |
| `showSessionTokens` | `false` | 本 session 累计 token（in/out/cache） |
| `showSessionName` | `false` | /rename 自定义会话名 |
| `showClaudeCodeVersion` | `false` | CC v2.1.81 |
| `showEffortLevel` | `false` | effort 符号 + 级别 |
| `showOutputStyle` | `false` | style: 当前 outputStyle |
| `showContextEta` | `false` | Context 爆炸倒计时 `→ ~12m to full`；> 30m 灰、10-30m 黄、< 10m 红；低置信度加 `?` |

#### Prompt Cache

| 字段 | 默认 | 说明 |
|---|---|---|
| `promptCacheTtlSeconds` | `300` | Pro 用 `300`（5 分钟），Max 用 `3600`（1 小时） |

#### 合并组 `mergeGroups`

```json
"mergeGroups": [
  ["model", "project", "git"],
  ["context", "promptCache"],
  ["cost", "duration", "speed"],
  ["environment", "version", "sessionName", "outputStyle"],
  ["memory", "extraLabel", "customLine"]
]
```

- 相邻元素若总宽度 ≤ 终端宽度就**合并到一行**，用 `│` 连接
- 超宽自动拆成多行
- 设为 `[]` 完全禁用合并（所有元素都独占一行）
- 默认这 5 组对应「身份 / 上下文+缓存 / 消耗 / 环境元数据 / 杂项」5 类语义

#### 阈值

| 字段 | 默认 | 说明 |
|---|---|---|
| `autocompactBuffer` | `"enabled"` | 考虑 autocompact 缓冲：`enabled` 更保守 / `disabled` 关 |
| `contextWarningThreshold` | `70` | Context 黄色阈值 % |
| `contextCriticalThreshold` | `85` | Context 红色阈值 % |
| `usageThreshold` | `0` | 5h usage 显示门槛 %；`0` = 始终显示 |
| `sevenDayThreshold` | `80` | 7d usage 显示门槛 %；达到才显示 |
| `environmentThreshold` | `0` | 配置计数显示门槛；`0` = 有就显 |

#### 外部 Usage 兜底

给 API 用户或特殊环境：当 stdin 里没有 `rate_limits` 时，可以读本地 JSON 快照。

| 字段 | 默认 | 说明 |
|---|---|---|
| `externalUsagePath` | `""` | JSON 快照绝对路径；空字符串 = 禁用 |
| `externalUsageFreshnessMs` | `300000` | 快照新鲜度上限（毫秒）；超时视为无效 |

快照文件格式：

```json
{
  "updated_at": "2026-04-24T12:00:00.000Z",
  "five_hour": { "used_percentage": 42, "resets_at": "2026-04-24T15:00:00.000Z" },
  "seven_day": { "used_percentage": 84, "resets_at": "2026-05-01T12:00:00.000Z" }
}
```

#### 模型名格式

| 字段 | 默认 | 说明 |
|---|---|---|
| `modelFormat` | `"full"` | `full` 原样 / `compact` 去冗余后缀 / `short` 再去 "Claude " 前缀 |
| `modelOverride` | `""` | 手动覆盖模型显示名；空字符串 = 不覆盖 |

#### 自定义行

| 字段 | 默认 | 说明 |
|---|---|---|
| `customLine` | `""` | 固定显示的自定义文本；**和 `--extra-cmd` 不同**，这是静态字符串 |

### `colors` 颜色

```json
"colors": {
  "context": "green",
  "usage": "brightBlue",
  "warning": "yellow",
  "usageWarning": "brightMagenta",
  "critical": "red",
  "model": "cyan",
  "project": "yellow",
  "git": "magenta",
  "gitBranch": "cyan",
  "label": "dim",
  "custom": 208
}
```

每项可取三种值：

| 形式 | 例子 |
|---|---|
| 预设名 | `"dim"` / `"red"` / `"green"` / `"yellow"` / `"magenta"` / `"cyan"` / `"brightBlue"` / `"brightMagenta"` |
| 256 色数字 | `0` ~ `255`（例：`208` 是橙色） |
| HEX | `"#FF6600"` |

| 字段 | 控制 |
|---|---|
| `context` | Context 条和百分比 |
| `usage` | Usage 条正常色 |
| `warning` | Context 警告阈值色 |
| `usageWarning` | Usage 接近限额色 |
| `critical` | 达到限额/危急色 |
| `model` | `[Opus]` 徽章 |
| `project` | 项目路径 |
| `git` | `git:(` 括号 |
| `gitBranch` | 分支名 |
| `label` | 次要标签（Context / Usage / 计数） |
| `custom` | `--extra-cmd` 自定义行 |

---

## 常用配置配方

### 配方 A：中文 + 全量开发信息

适合自己本机开发，尽量多显示。

```json
{
  "language": "zh",
  "lineLayout": "expanded",
  "pathLevels": 2,
  "gitStatus": {
    "enabled": true,
    "showDirty": true,
    "showAheadBehind": true,
    "showFileStats": true
  },
  "display": {
    "contextValue": "both",
    "showTools": true,
    "showAgents": true,
    "showTodos": true,
    "showConfigCounts": true,
    "showCost": true,
    "showDuration": true,
    "showSessionTokens": true,
    "showMemoryUsage": true
  }
}
```

### 配方 B：极简

只要模型名 + Context 条。

```json
{
  "lineLayout": "compact",
  "display": {
    "showUsage": false,
    "showTokenBreakdown": false
  }
}
```

### 配方 C：只关心 Token

加强 token 相关显示。

```json
{
  "display": {
    "contextValue": "both",
    "showSessionTokens": true,
    "showPromptCache": true,
    "promptCacheTtlSeconds": 3600
  }
}
```

### 配方 D：只看工具活动 + Git

监控 Claude 在做什么，但不关心用量。

```json
{
  "gitStatus": {
    "enabled": true,
    "showDirty": true,
    "showFileStats": true
  },
  "display": {
    "showUsage": false,
    "showTools": true,
    "showAgents": true,
    "showTodos": true
  }
}
```

### 配方 E：暖色调深色终端

```json
{
  "colors": {
    "context": "#D4A84A",
    "usage": "#B8860B",
    "warning": "#FF9800",
    "critical": "#E53935",
    "model": "#DAA520",
    "project": "#CDBE9A",
    "git": "#9E7FFF",
    "gitBranch": "#64B5F6",
    "label": "dim"
  }
}
```

### 配方 F：4 行紧凑布局（重构后默认）

适合大多数终端宽度。每行有清晰的语义主题。

```json
{
  "elementOrder": [
    "model", "project",
    "context", "promptCache",
    "usage",
    "cost", "duration", "speed"
  ],
  "display": {
    "mergeGroups": [
      ["model", "project"],
      ["context", "promptCache"],
      ["cost", "duration", "speed"]
    ]
  }
}
```

视觉：行 1 身份 / 行 2 上下文+缓冲 / 行 3 用量 / 行 4 消耗。

---

## 故障排查

### HUD 显示成默认配置，我的 config 没生效

- 可能 JSON 语法有问题，整个文件解析失败 → 静默降级默认。
- 用 `node -e "JSON.parse(require('fs').readFileSync('~/.claude/plugins/claude-hud/config.json','utf8'))"` 或 `jq . config.json` 检查。
- 开 debug：`DEBUG=claude-hud` 环境变量下跑 HUD 看 stderr 报错。

### 改了配置不生效

- 检查保存路径：必须是 `~/.claude/plugins/claude-hud/config.json`，不是源码项目内的文件。
- HUD 每次调用都会重读，无需重启。如果完全不变化，大概率是保存到了错位置或 JSON 无法解析。

### Usage 行不出现

- 必须是 Claude 订阅用户（Pro/Max/Team），API key 用户没有 `rate_limits`。
- AWS Bedrock / Google Vertex 模型会隐藏 usage（云计费）。
- `display.showUsage` 不能为 `false`。
- 首次对话前 Claude Code 可能不发 `rate_limits`，有过交互后才出现。
- 最后可用 `display.externalUsagePath` 兜底。

### Tool / Agent / Todo 行不出现

- 默认关。要手动设 `display.showTools`/`showAgents`/`showTodos` 为 `true`。
- 即使开了，**没有活动时也不显示**——只在正在运行或最近完成时显示。

### 字体太小 / 终端太窄

- 调小 `mergeGroups`：`"mergeGroups": []` 强制所有元素独占一行。
- 或改 `lineLayout` 为 `"compact"`，全压到一行自然紧凑。

### 颜色在某些终端里不对

- 某些终端不支持 256 色或 HEX。退回预设名（`"red"` 等）能确保兼容。
- `NO_COLOR` 环境变量会让整个输出去色（这是 ANSI 约定）。

---

## 参考

- 项目主页：`README.md`
- 源码：`src/config.ts` 的 `DEFAULT_CONFIG`（本文档字段都从这里推导）
- 官方配置向导：`/claude-hud:configure`（HUD 作为插件安装后可用）

---

*此文档为本地自用中文配置手册；基于 claude-hud 0.1.0 写就。如果你 fork 了本仓库并发 PR，建议把这份文档加到主仓库作为社区中文资源。*
