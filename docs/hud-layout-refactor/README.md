# HUD 布局重构（hud-layout-refactor）

> 状态：方案确认中
> 目标：把 `project` 行内硬编码的 10 个 sub-element 拆成独立 `elementOrder` 项，让用户能自由控制每个信息块放在第几行 / 与谁同行。

## 系统目标

**用户痛点**：`renderProjectLine` 把模型、项目路径、git 状态、Claude Code 版本、duration、cost、speed、sessionName、extraLabel、customLine 这 10 个东西硬编码 join 到第一行。一旦终端不够宽，超出部分被省略号截断，状态栏后续行（context / usage / tools / agents / todos）被 Claude Code statusLine 区域行预算挤掉。

**用户当前能做**：开/关每个 sub-element（用 `display.show*`）。
**用户做不到**：把它们放到不同行；让 model 单独一行；让 cost 和 duration 共享一行而 git 单独一行。

**重构后能做到**：
```json
{
  "elementOrder": [
    "model", "project", "git",          // 第 1 行（mergeGroups 合并）
    "version", "duration", "cost",      // 第 2 行（mergeGroups 合并）
    "context", "usage",                  // 第 3 行
    "tools", "agents", "todos"           // 各自独立行
  ],
  "display": {
    "mergeGroups": [
      ["model", "project", "git"],
      ["version", "duration", "cost"],
      ["context", "usage"]
    ]
  }
}
```

## 范围边界

**包含**：

- 把 `project` 行的 10 个 sub-element 拆成独立 elementOrder 项（每项有自己的 line 模块 / display.show 开关）
- 扩展 `HudElement` 联合类型 + `DEFAULT_ELEMENT_ORDER` + `DEFAULT_MERGE_GROUPS`
- 配置向后兼容：用户 config 里写 `"project"` 时自动展开为新粒度组（不破坏存量配置）
- expanded 模式下的渲染分发（`render/index.ts`）扩展 switch 分发新 element key
- 文档：README.md / CONFIG_GUIDE.zh.md 字段表更新；新增"行布局自定义"指南

**不包含**：

- compact 模式 (`session-line.ts`) 的同步重构——保持现有行为，留作 P2 后续任务
- 引入新数据源（CPU / 电池等需要新 IO 的）
- mergeGroups 算法本身的改造（已经能跑，只需扩 element 池子）
- UI 大改 / 颜色系统重构 / 新 i18n key（保留现有）

## 模块导航

| 模块 | 状态 | 文档 | 是否可进 task | 说明 |
|------|------|------|---------------|------|
| 模块 A：拆 project 行 | 可进入 x-req | `./02-module-breakdown.md` | ✅ 是 | 重构入口；拆 model/duration/speed/cost/version/sessionName/extraLabel/customLine 为独立 line |
| 模块 B：elementOrder 类型与默认值扩展 | 可进入 x-req | `./02-module-breakdown.md` | ✅ 是 | HudElement 联合类型扩展、DEFAULT_ELEMENT_ORDER 与 DEFAULT_MERGE_GROUPS 重定义 |
| 模块 C：旧 config 向后兼容 | 可进入 x-req | `./02-module-breakdown.md` | ✅ 是 | mergeConfig 把旧 "project" key 自动展开为新粒度组 |
| 模块 D：environment / usage 细粒度（可选）| 探索中 | `./02-module-breakdown.md` | ⏳ 否 | environment 拆 5 项、usage 拆 5h/7d 两项；价值次于 A，留 P1 |
| 模块 E：compact 模式联动（可选）| 探索中 | `./02-module-breakdown.md` | ⏳ 否 | session-line.ts 是另一套粒度，是否同步重构待讨论；留 P2 |

## 文档导航

- [模块拆分](./02-module-breakdown.md) — 每个模块的职责、依赖、风险
- [Task 映射](./90-task-map.md) — 模块到 task 的映射、前置依赖、推荐开发顺序

## 当前建议

1. **模块 A + B + C** 形成一个最小可发布单元（MVP），三个一起进 x-req → x-plan → x-dev，独立 PR 上游
2. **模块 D** 价值次于 A，留作下一批增量
3. **模块 E** compact 模式重构争议大（用户少 + 改动面广），留到模块 A 上线观察后再决定
4. 整套方案与 `hud-mvp-signals` task **解耦**——可以并行推进，但建议先收尾 hud-mvp-signals 的剩余 2 个模块（cost-by-model / tool-error-counts），再切回这个 task

## 相关上下文

- 主 task：`dev-pipeline/tasks/hud-mvp-signals/`（11 项 MVP 信号扩展，模块 1 已完成）
- 现状分析依据：`render/index.ts` switch 分发、`render/lines/project.ts` 第 60-168 行硬编码 join
- 上游兼容性约束：`CONTRIBUTING.md` 要求新元素独立开关 + 默认 false + 测试覆盖
