# 模块拆分

## 模块总览

| 模块 | 职责 | 依赖 | 状态 | 备注 |
|------|------|------|------|------|
| A | 拆 `project` 行：8 个 sub-element 单独成 line 模块 | B 的类型扩展 | 可进入 x-req | 重构核心 |
| B | 扩展 `HudElement` 联合类型 / `DEFAULT_ELEMENT_ORDER` / `DEFAULT_MERGE_GROUPS` | 无 | 可进入 x-req | A 的前置 |
| C | 旧 config 向后兼容：`elementOrder` 含 `"project"` 时自动展开 | A、B | 可进入 x-req | 用户体验底线 |
| D | environment 拆 5 项 + usage 拆 5h/7d | A、B | 探索中 | P1，下一批 |
| E | compact 模式与 expanded 粒度对齐 | A、B、C | 探索中 | P2，后做 |

---

## 模块详情

### 模块 A：拆 `project` 行（重构核心）

**职责**：把 `src/render/lines/project.ts` 内部硬编码的 10 个 sub-element 中**可独立的 8 个**拆成独立的 line 模块和 elementOrder 项。

**包含范围**：

| 新 element key | 来源 sub-element | 新建文件 | 现有 display 字段 |
|---|---|---|---|
| `model` | `[Opus]` 徽章 | `src/render/lines/model.ts` (新) | `display.showModel` |
| `version` | `CC v2.1.111` | `src/render/lines/version.ts` (新) | `display.showClaudeCodeVersion` |
| `duration` | `⏱️ 5m` | `src/render/lines/duration.ts` (新) | `display.showDuration` |
| `cost` | `$13.20` | 已有 `src/render/lines/cost.ts` 复用 | `display.showCost` |
| `speed` | `out: 42.1 tok/s` | `src/render/lines/speed.ts` (新) | `display.showSpeed` |
| `sessionName` | `/rename` 自定义名 | `src/render/lines/session-name.ts` (新) | `display.showSessionName` |
| `extraLabel` | `--extra-cmd` 输出 | `src/render/lines/extra-label.ts` (新) | （已有 ctx.extraLabel） |
| `customLine` | 静态自定义文本 | `src/render/lines/custom-line.ts` (新) | `display.customLine` |

**保留在 project.ts 不拆的**：
- `project` 路径本身（projectPath）
- `git` 状态（branch + dirty + ahead/behind + fileStats）—— git 内部再拆没价值，几个字段语义紧耦合

**为什么保留 project + git 在一起？**——两者是"我在哪里 + 当前状态"的语义统一体；用户也极少需要把它们放到不同行。

**不包含范围**：

- `git` 内部进一步拆（branch / dirty / ahead-behind / fileStats）—— 保留 `gitStatus.show*` 子开关足够
- `compact` 模式同步重构（属于模块 E）

**依赖**：模块 B 提供新 element 类型；同步推进。

**风险与讨论点**：

- **DEFAULT_MERGE_GROUPS 默认值**：为了让重构后**视觉上和现在完全一样**，`DEFAULT_MERGE_GROUPS` 需要把这些拆出来的 element 默认放到一个 group 里，比如：
  ```ts
  DEFAULT_MERGE_GROUPS = [
    ['model', 'project', 'git', 'sessionName', 'version', 'extraLabel', 'duration', 'cost', 'speed', 'customLine'],
    ['context', 'usage'],  // 现有
  ]
  ```
- **测试快照**：现有 render 快照测试可能因新 element key 出现在 elementOrder 里而需要更新（虽然渲染输出不变）
- **renderProjectLine 的 ETA 接收方**：当前 contextEta 在 identity.ts 里——本任务不动

**task 建议**：

- 建议 task 名：`hud-line-granularity-project-split`
- 是否进入 x-req：**是**
- 原因：模块边界清晰、价值明确、有现成参照（已有的 lines/cost.ts 模式），可独立测试

---

### 模块 B：elementOrder 类型与默认值扩展

**职责**：扩展 HudElement 联合类型支持新 element key，重定义默认值确保向前兼容。

**包含范围**：

- `src/config.ts` 的 `HudElement` 类型新增 8 个字符串字面量：
  ```ts
  export type HudElement =
    | 'project' | 'context' | 'usage' | 'promptCache' | 'memory' | 'environment'
    | 'tools' | 'agents' | 'todos'
    | 'model' | 'version' | 'duration' | 'cost' | 'speed'
    | 'sessionName' | 'extraLabel' | 'customLine';
  ```
- `KNOWN_ELEMENTS` Set 同步更新
- `DEFAULT_ELEMENT_ORDER` 决策——**两个候选方案**：
  - **方案 1（保守）**：保留 `"project"` 在数组首位，新 element 加到末尾。配合模块 C 的兼容层让 `"project"` 自动展开。**优点**：默认行为完全不变。**缺点**：新用户也得通过显式配置才能享受细粒度。
  - **方案 2（激进）**：直接用新 element 替换 `"project"`，比如 `["model", "project", "git", ...]`。**优点**：默认就是新粒度。**缺点**：用户的 `display.showProject: false` 必须迁移到 `display.showProject` + 新加 `display.showModel: false`。
  - **推荐方案 1**——风险更低
- `DEFAULT_MERGE_GROUPS` 同步：把新 element 放到一个 group 里，让默认视觉效果与重构前一致

**不包含范围**：

- 新 element 的具体渲染实现（属于模块 A）
- 实际的兼容层（属于模块 C）

**依赖**：无外部依赖；模块 A 同步开发。

**风险与讨论点**：

- 类型扩展是 `src/config.ts` 公共契约的变更；CONTRIBUTING.md 要求测试覆盖
- 新增 element key 命名是否考虑 kebab-case（`session-name`）vs camelCase（`sessionName`）？现有 `promptCache` 用的是 camelCase，**保持一致用 camelCase**

**task 建议**：

- 建议 task 名：`hud-element-type-extend`
- 是否进入 x-req：**是**
- 原因：纯类型与默认值改动，先做能为模块 A 解锁

---

### 模块 C：旧 config 向后兼容

**职责**：用户 `config.json` 里 `elementOrder` 含 `"project"` 时，自动**展开**为新粒度组。

**包含范围**：

- `src/config.ts` 的 `mergeConfig` 加迁移逻辑：扫描用户 elementOrder，遇到 `"project"` 自动替换为新粒度数组（顺序与 `DEFAULT_ELEMENT_ORDER` 一致）
- 同样处理 `display.mergeGroups` 里的 `"project"`：自动展开
- 行为：**自动展开 + 一次性日志**（DEBUG=claude-hud 时打印一行迁移信息），不弹 UI 不阻断
- 测试：旧 config 输入 → 校验展开后 elementOrder 与新 DEFAULT 行为一致

**不包含范围**：

- 自动写回 config.json（保持原样，纯运行时兼容）
- UI 提示用户迁移（CONTRIBUTING.md 要求"小而专注"，不要 UI 改动）

**依赖**：模块 A、B（要先有新 element 才能展开）

**风险与讨论点**：

- 用户已经手动 merged group 含 `["project", "context"]` 的极端 config——展开后应保持原意（`"project"` 替换为新粒度组，整体仍属于一个 mergeGroup）
- "兼容多久"：上游一旦合并，可能保留 ≥1 年。在 CHANGELOG 里说明 deprecation 路径

**task 建议**：

- 建议 task 名：`hud-config-backwards-compat`
- 是否进入 x-req：**是**
- 原因：用户体验底线，必须有

---

### 模块 D：environment / usage 细粒度（P1）

**职责**：把 environment 行的 5 项和 usage 行的 5h/7d 也拆成独立 element。

**包含范围**：

| 顶级 key | 拆分为 |
|---|---|
| `environment` | `claudeMdCount` / `rulesCount` / `mcpCount` / `hooksCount` / `outputStyle` |
| `usage` | `usage5h` / `usage7d` |

**不包含范围**：

- environment / usage 内部进一步细分
- compact 模式同步

**依赖**：模块 A、B、C 完成且稳定

**风险与讨论点**：

- environment 5 项独立后，用户可能想"只看 hooks 数"——但这种粒度有意义吗？需要先看模块 A 上线后的用户反馈
- usage 5h vs 7d 拆分**有意义**——免费用户只关心 7d，Max 用户更关心 5h

**task 建议**：

- 建议 task 名：`hud-line-granularity-env-usage-split`
- 是否进入 x-req：**否**（先观察模块 A 落地反馈）
- 原因：价值不如模块 A 直接，可以延后

---

### 模块 E：compact 模式与 expanded 粒度对齐（P2）

**职责**：让 `session-line.ts`（compact 模式）也通过新 element key 配置，而不是手工 join 13 项。

**包含范围**：

- `session-line.ts` 改造：从手工 part 数组 → 复用 expanded 模式的 element 渲染函数
- compact 模式下 `elementOrder` 也生效（当前不读这个字段，全部硬编码顺序）

**不包含范围**：

- 视觉效果改变（默认 compact 输出应保持一致）
- mergeGroups 在 compact 模式生效（compact 永远 1 行）

**依赖**：模块 A、B、C 必须全部上线且稳定

**风险与讨论点**：

- compact 用户少（默认 expanded），ROI 较低
- session-line.ts 重构面较大（420 行），动它可能引入回归
- 是否真的要做？建议**先看模块 A 反馈，再决定**

**task 建议**：

- 建议 task 名：`hud-compact-mode-align`
- 是否进入 x-req：**否**（探索中）
- 原因：性价比低，先做主线
