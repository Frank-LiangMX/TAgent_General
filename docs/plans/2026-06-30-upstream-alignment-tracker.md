# 上游对齐开发跟踪（feature/upstream-v0.13.4-alignment）

> **分支**：`feature/upstream-v0.13.4-alignment`  
> **基线**：Proma `@proma/electron@0.13.4`  
> **策略**：Cursor Agent 统筹；P0 由主 Agent 直接落地 + 测试；P1+ 大模块可派 kscc worktree  
> **合并**：全部完成后留分支给用户验收，**不自动合 main**

---

## 状态图例

- ✅ 完成并已测试
- 🚧 进行中
- ⏳ 待做
- ⏭️ 跳过 / 不适用

---

## P0 稳定性

| ID | 任务 | 状态 | 备注 |
| --- | --- | --- | --- |
| P0-1 | #913 `promptSuggestions: false` + iterator break | ✅ | `claude-agent-adapter.ts` |
| P0-2 | #910 `onSessionId` 用 `capturedSdkSessionId` 守卫 | ✅ | `agent-orchestrator.ts` |
| P0-3 | #903 终止分支保留 `sdkSessionId` | ✅ | + `TRANSIENT_NETWORK_PATTERN` 扩展 |
| P0-4 | SDK 平台 optional 子包 0.3.185 | ✅ | `apps/electron/package.json` |
| P0-5 | `bun run typecheck` + `bun test` | ✅ | typecheck 0 error；`bun test` 297/300（3 个既有 electron mock 导入失败，非本分支回归） |

---

## P1 核心能力

| ID | 任务 | 状态 | 模型建议 |
| --- | --- | --- | --- |
| P1-1 | Bridge 长连接自愈 | ✅ | `bridge-registry.ts` + index 注册 |
| P1-2 | `automation-agent-tools.ts` | ✅ | 6 个 MCP 工具 + orchestrator 注入 |
| P1-3 | headless-runner-registry（Collaboration 前置） | ✅ | `agent-headless-runner-registry.ts` + agent-service |
| P1-4 | adapter Stop hook + 后台任务唤醒 idle Agent | ✅ | adapter + orchestrator + renderer |
| P1-5 | Issue A 1M 上下文 + `qwen-anthropic` | ✅ | shared 单一事实源 + qwen-anthropic 渠道 |

---

## P2 体验

| ID | 任务 | 状态 | 模型建议 |
| --- | --- | --- | --- |
| P2-1 | #915 classic/modern 双界面 | ⏭️ | 用户不需要，跳过 |
| P2-2 | `previewModePreference` 预览路由 | ✅ | useOpenPreview + 设置页 |
| P2-3 | 外部 MCP type 推断 | ✅ | 已在 agent-workspace-manager |
| P2-4 | Context Usage 显示精度 | ✅ | TAgent 自有方案 + 切会话清 stableRef |
| P2-5 | Automation NL 创建 + custom cron | 部分 ✅ | Skill + prompt + 工具编码修复 + 自动审批权限；custom cron 未做（Proma 亦无） |
| P2-6 | Nowledge Mem（可选） | ⏭️ | 用户跳过：TAgent 自有记忆系统 |

---

## P3 小修 / 验证

| ID | 任务 | 状态 |
| --- | --- | --- |
| P3-1 | #904–#912 输入预览小修（逐项验证） | ✅ | #904/#906/#908/#911/#912；#909 跳过 |
| P3-2 | 项目重命名 + 删除确认 | ✅ | 侧栏内联删除确认 + 重命名刷新 atom |
| P3-3 | WPS 协作增强 | ⏳（独立线，非 Proma 对齐） |

---

## 提交记录（本分支）

| Commit | 内容 |
| --- | --- |
| `7c8c4f2d` | P0 稳定性（#913/#910/#903 + SDK 0.3.185） |
| `9d13366d` | P1 Bridge 自愈 + automation agent MCP 工具 |
| `3fd924f1` | 文档：Kanban 编排 Epic 暂缓 |
| `84ae8c42` | 文档：上游 alignment tracker 更新 |
| `a2411a48` | P1 headless registry + 后台唤醒 + qwen-anthropic |
| `a7e1c13` | P2 预览路由 + Automation Skill + prompt |
| `f77ee38b` | P3 UI 小修 + 自动审批权限路由 + automation 工具修复 |
| `0aeb95ba` | 文档：tracker / PROGRESS 验收状态 |

**分支状态（2026-06-30）**：P0–P3（除 custom cron / WPS / #915 / Nowledge Mem）已落地，**待用户验收后合 PR**。

---

## kscc 并行编排（P1 起大模块时启用）

```powershell
# 示例：独立 worktree + 非交互 kscc
git worktree add ../TAgent-align-bridge -b fix/bridge-self-heal feature/upstream-v0.13.4-alignment
cd ../TAgent-align-bridge
kscc -p --permission-mode bypassPermissions --model glm-5.1 `
  "对照 F:\Proma\apps\electron\src\main\lib\bridge-registry.ts 为 TAgent 实现 Bridge 自愈..."
```

**合并顺序**：P0 → P1 无冲突模块并行 → P2 → 全量 typecheck/test → 交用户验收。

---

## 暂缓 Epic（上游完成后另开分支）

| Epic | 文档 | 说明 |
| --- | --- | --- |
| 任务看板编排 Kanban | [`2026-06-30-task-kanban-orchestration-design.md`](2026-06-30-task-kanban-orchestration-design.md) | Hermes 式看板 + IM 进度 + 无限角色库；**等本分支验收后再做** |
