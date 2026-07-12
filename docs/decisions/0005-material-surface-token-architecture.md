# ADR-0005: 材质 Surface Token 架构（基线 = frosted）

> **Status**: Accepted（实现进行中：PR-1 surface token 基线）  
> **Date**: 2026-07-12  
> **Deciders**: 产品确认默认扁平轻磨砂；高级材质 = 高透玻璃 / 轻拟态

## Context

TAgent 前端同时存在：

1. **材质轴**：`data-material`（frosted / glass / soft）+ 历史 `html.material-frosted`
2. **主题色轴**：`.dark` + `.theme-{style}` + 语义色 token
3. **表面样式类**：`session-glass-*`、`settings-card`、业务 `panel-glass` 等

产品意图已明确：

- **默认**（高级材质关）= 扁平 Material Design + **轻微**磨砂玻璃（`frosted`）
- **高级材质开** = 高透玻璃（`glass`）或轻拟态（`soft`）

设置层默认值已正确（`advancedMaterialEnabled = false` → frosted），但 **CSS 基类写成了高透 Liquid Glass**，再靠 `[data-material="frosted"]` / `html.material-frosted` 补丁压扁。结果：

- 部分表面类无 frosted 覆盖（如 `settings-card`、toast、segmented-tabs），改材质不跟着变
- 默认观感偏「高级高透」，与产品定义不符
- 双轨选择器与「frosted 无 blur vs 轻磨砂」意图打架
- 主题选择器偶发硬改 blur/阴影，破坏正交

## Decision

我们决定：

1. **CSS 基线 = frosted 观感**（扁平 MD + 轻磨砂），`:root` 与 `[data-material="frosted"]` 同值，防止首屏闪高透。
2. **引入统一 Surface Token 表**（`--surface-blur` / `--surface-opacity` / `--surface-rim` / `--surface-shadow` / `--surface-shine-opacity` 等）；三种材质只改 token 表，不靠成吨类级补丁。
3. **所有表面样式类只消费 surface token + 语义色**；禁止新增写死 `backdrop-filter: blur(Npx)` 或拟态 rgba 阴影。
4. **材质轴与主题色轴严格正交**：主题只改 hue 语义变量；材质只改表面语言。
5. **`html[data-material]` 为唯一材质权威**；`material-frosted` class 仅迁移期兼容，新代码禁止依赖。
6. **高级材质 glass / soft 为增强层**，不是默认基线；`liquid` 不作为用户可见材质保留。
7. **分 PR 渐进迁移**（ui 包基线 → 漏网类 → globals 壳层 → 可选 token 生成器），详见设计文档。

详细设计见：

- `docs/plans/2026-07-12-material-surface-token-architecture.md`

本 ADR **吸收** `docs/plans/2026-07-12-soft-glass-highlight-system-design.md` 中「变量驱动 soft 高光」的原则，并将其推广为全材质 surface 表；**废止**「基类高透、frosted 后补」作为目标架构。

## Consequences

### Positive

- 默认视觉与设置语义一致，减少「关了高级材质仍像玻璃」的投诉
- 新增表面类只要读 token，自动跟三种材质
- 主题换色不再误伤材质语言
- 双轨 CSS 可收敛，维护成本下降

### Negative

- 需要倒转大量历史 CSS（有回归风险，需分 PR + 视觉 checklist）
- 短期 soft 高光文档与实现可能并存两套变量名（alias 过渡）
- 无像素级自动化测试时依赖手工验收

### Neutral

- 用户 settings schema **不变**（仍用 `advancedMaterialEnabled` / `advancedMaterialOnMode`）
- 圆角 token、语义色 token 流程不变
- `@tagent/ui` 组件 API 不变，主要改 CSS 实现

## Alternatives Considered

### Option A: 只补 frosted 覆盖（最小修复）

- Pros: 改动小、风险低
- Cons: 基线仍是高透；新类继续漏网；技术债不减
- Rejected: 产品要求正确架构，非继续补丁

### Option B: 材质与主题合并为单一 themeStyle

- Pros: 用户只选一个「风格」
- Cons: 组合爆炸；与现有高级材质开关 UX 冲突；soft 与 ocean 无法正交
- Rejected: 已确认双轴产品模型

### Option C: 基线 glass，frosted 用更完整补丁

- Pros: 少改高透路径
- Cons: 默认路径依赖覆盖完整性，与「默认扁平」产品定义相反
- Rejected

## References

- 设计文档: `docs/plans/2026-07-12-material-surface-token-architecture.md`
- Soft 高光: `docs/plans/2026-07-12-soft-glass-highlight-system-design.md`
- UI 规范: `packages/ui/DESIGN.md`
- 运行时: `apps/electron/src/renderer/atoms/advanced-material.ts`
- 设置默认: `apps/electron/src/types/settings.ts`（`DEFAULT_ADVANCED_MATERIAL_*`）
