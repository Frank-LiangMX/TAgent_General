# ADR-0001: 融合架构 — Proma + ta_agent 重构成 TAgent

> **Status**: Accepted
> **Date**: 2026-06-05
> **Deciders**: Frank Danny + Proma Agent (brainstorm session)

## Context

用户维护两个项目：
- **`F:\Proma\`**：开源通用 Agent 框架（TypeScript + Electron + Claude Agent SDK + 12 Provider），代码成熟（v0.10.25）
- **`F:\ta_agent\`**：自研游戏 TA 领域 Agent（Python + Electron + 54 工具 + 资产库 + Blender/UE5 集成），实战 1+ 年

两个项目都想往对方方向走：
- Proma 想加**领域工具**（如 FBX 解析、资产分析）
- ta_agent 想要**Proma 的开放性**（多 Provider、Skill、MCP、UI 设计系统、Claude Agent SDK 编排）

如果做"迁移"或"集成"，会引入：
- 大量代码重复（Provider 适配、IPC、UI 框架）
- 一边用不上对方的优化
- 维护负担 × 2

## Decision

**融合重构**为一个产品：TAgent。

- **基座 = Proma**，重命名为 TAgent（@proma/* → @tagent/*）
- **领域工具 = ta_agent** 整体迁入，PyInstaller 打包嵌进 TAgent 安装包
- **双顶层模式**：
  - **通用模式** = Proma 现有体验（chat / agent / scratch 三 Tab）
  - **TA 模式** = ta_agent 工具链（54 工具 + 资产库 + 审核 + 流水线）
- 模式互斥：严格互斥 + 后台跑完提示（无并发 bug）
- 模式隔离：Provider / Channel / API Key 全局共享；MCP / Skill / Memory / Session 模式独立
- 跨模式互切换：LLM 调 `switch_mode` 伪工具，建议用户切模式

**项目结构**：
- `F:\TAgent_General\` — 工程目录
  - `.claude\CLAUDE.md` — Agent 上下文
  - `docs\plans\` — 设计文档
  - `docs\decisions\` — ADR
  - `docs\process\` — 流程规范
- 设计文档：
  - `2026-06-05-tagent-fusion-design.md` — Desktop 设计
  - `2026-06-05-tagent-server-design.md` — Server 设计（轻量 metadata 同步）

## Consequences

### Positive
- **单一代码库**：不需要维护两套并行产品
- **Provider 复用**：12 个 Provider + 5 MCP + Skill 系统直接为 TA 模式所用
- **UI 复用**：Proma 设计系统 + TipTap + Radix 立即为 TA 模式 UI 服务
- **Agent 编排复用**：Claude Agent SDK 直接为 TA 模式工作
- **未来扩展清晰**：双模式 = 单一架构的两个面，新增"X 模式"成本低

### Negative
- **首版改造量大**：14 个决策需要落地、品牌替换、模式隔离、20 LLM 工具白名单
- **历史数据不迁移**：ta_agent 旧用户需重新创建项目（接受）
- **Python + TypeScript 双语言**：构建链复杂
- **PyInstaller 打包大**：含 Blender / Pillow 等大依赖
- **品牌替换风险**：codemod 漏改 = 编译失败或品牌不一致

### Neutral
- 工程目录命名约定建立（`F:\TAgent_General\` 替代两个独立仓库）
- 双模式概念是新发明，但与现有 Proma 三模式（chat/agent/scratch）正交
- TAgent Server 是可选的扩展（公司内网部署，不强制）

## Alternatives Considered

### Option A: 整体迁移（Proma → ta_agent 或 ta_agent → Proma）
- Pros: 简单直接
- Cons: 一边完全不用对方的优化；用户工作流中断
- Rejected: 用户明确反对

### Option B: 集成（双产品互连）
- Pros: 不破坏现有
- Cons: 两边都要改、复杂度乘以 2
- Rejected: 用户明确说"我不要 bridge，要 fusion"

### Option C: 从零重建
- Pros: 架构最干净
- Cons: 两边生态都要重写（Python Blender 集成 / TS 设计系统）
- Rejected: 工作量过大

## References

- `docs/plans/2026-06-05-tagent-fusion-design.md` — 完整设计（13 节）
- `docs/plans/2026-06-05-tagent-server-design.md` — Server 设计（12 节）
- Brainstorm 8 轮决策（2026-06-05 session）
