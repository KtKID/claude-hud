# Task Map

| 模块 | 建议 task 名 | 是否创建 task | 前置依赖 | 当前状态 |
|------|--------------|----------------|----------|----------|
| A | `hud-line-granularity-project-split` | ✅ 是 | 模块 B（同步） | 可进入 x-req |
| B | `hud-element-type-extend` | ✅ 是 | 无 | 可进入 x-req |
| C | `hud-config-backwards-compat` | ✅ 是 | A、B | 可进入 x-req |
| D | `hud-line-granularity-env-usage-split` | ❌ 否（先观察 A 反馈） | A、B、C | 探索中 |
| E | `hud-compact-mode-align` | ❌ 否（性价比低） | A、B、C | 探索中 |

---

## 推荐执行顺序

### 阶段 1：MVP（A + B + C，强烈推荐捆绑同一 task）

**关键洞察**：模块 A、B、C 实际上**强耦合**——B 是 A 的类型基础，C 是 A 的兼容兜底。三者拆成 3 个独立 task 反而带来不必要的协调成本。

**推荐做法**：合并为**一个 task** `hud-line-granularity`，内含三个子模块（`x-plan` 阶段细化为 dev-checklist 上的多个任务编号）。

**task 目录结构**：
```
dev-pipeline/tasks/hud-line-granularity/
├── README.md           # x-req 产出，包含 A+B+C 三个模块
├── plan.md             # x-plan 产出
├── dev-checklist.md    # x-plan 产出
├── changelog.md        # x-dev 产出
└── artifacts/
```

**对应 PR**：`feat/line-granularity` 单分支单 PR，干净易 review。

### 阶段 2：增量（D，独立 task）

**前置**：阶段 1 已 PR 且 merge 到 KtKID/x-dev、用户实际用过一段时间。

**新 task**：`hud-element-granularity-env-usage`

### 阶段 3（可选）：compact 重构（E，独立 task）

**前置**：阶段 1 上线≥ 1 个月、用户没有大批量回流到 compact 模式抱怨问题。

**新 task**：`hud-compact-mode-align`

只在用户/社区有强烈需求时启动。

---

## 与现有 task 的关系

**当前 in-flight**：`hud-mvp-signals`（11 项 MVP 信号扩展，模块 1/3 已完成）

**关系**：

- `hud-line-granularity` 是 **独立的并行 task**，不阻塞 hud-mvp-signals
- 但建议**先收尾 hud-mvp-signals 剩余两个模块**（cost-by-model + tool-error-counts），再开新 task
- 原因：hud-mvp-signals 已有 push 出去的分支（feat/context-eta），上下文连贯做完更高效；line-granularity 是结构性重构，需要清晰的脑容量

**可选并行**：如果用户希望同时推进，可以让 hud-mvp-signals 继续走，line-granularity 单独切分支并行——但需要小心两者都改 `config.ts` / `types.ts`，merge 时可能小冲突。

---

## 推荐 PR 拆分（合并到上游 jarrodwatts/main 时）

阶段 1 上线后，如果想发上游 PR，**建议拆 2 个独立 PR**：

1. **PR-1：`feat: extend HudElement type with model/version/duration/cost/...`**
   - 类型扩展（B）+ 默认值更新（B 的一部分）+ 兼容层（C）
   - 这部分纯类型 + 配置变更，作者好评估
   - 含完整测试

2. **PR-2：`feat: split project line into individual elements`**
   - 实际拆 line 模块（A）
   - 依赖 PR-1 已合并
   - 含 snapshot 测试 + i18n 同步

如果作者偏好"一个完整功能一个 PR"，也可以合并成一个，但 diff 会比较大（~500 行）。

---

## 风险登记

| 风险 | 影响 | 缓解 |
|---|---|---|
| 现有 render 测试 snapshot 因 element 顺序变化挂掉 | 测试红 | 阶段 1 内同步更新 snapshot；UPDATE_SNAPSHOTS=1 跑一次后人工 review |
| 用户存量 config 含 `"project"` 在 elementOrder 不展开导致行为异常 | 用户报告"开关失效" | 模块 C 自动展开 + DEBUG 日志；CHANGELOG.md 写明迁移路径 |
| compact 模式与 expanded 配置不一致让用户困惑 | UX 偏差 | 在 CONFIG_GUIDE.zh.md / README.md 明确说明 compact 仍是旧粒度（直到模块 E） |
| 上游不接受这种粒度细化（认为"project 一行就够了"） | PR 被拒 | 先发 issue 探口风：作者已接纳 README.zh.md，开放性较高，但仍需提前沟通 |

---

## 决策：现在做不做 / 做哪个

| 决策项 | 推荐 |
|---|---|
| **是否拆系统？** | ✅ 是（6 个判断标准全中） |
| **拆几个模块？** | 主流程 3 个（A+B+C 捆绑），扩展 2 个（D、E）探索中 |
| **创建几个 task？** | 1 个（`hud-line-granularity`，A+B+C 合并） |
| **现在就走 x-req？** | ❌ 不立刻——建议**先收尾 hud-mvp-signals** |
| **何时启动？** | hud-mvp-signals 模块 2 + 模块 3 + #31 收尾完成后 |
