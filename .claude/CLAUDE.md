# TAgent — Claude Code 上下文

> 本工程是 Proma（开源）融合 ta_agent（自研游戏 TA 领域 Agent）的产物。
> 未来任何进入此工程的 AI 编码 Agent（Claude Code、Cursor、Codex 等）请先读本文。

## 工程身份

- **产品名**：TAgent
- **类型**：Electron 桌面应用（TypeScript + Python 后端）
- **核心特征**：双顶层模式（通用 / TA），共享 Provider + UI，独立 Memory / 工具集 / 会话
- **不要在代码 / 文档 / git 提交中出现 "Proma" 字样**（已用 codemod 全量替换为 TAgent）

## 双模式

```
顶层 Tab
├── 通用模式（general）
│   └─ 内部仍是 Proma 现有 chat / agent / scratch 三 Tab
└── TA 模式（ta）
    └─ 激活 TAgent 54 工具 + 资产库 + 审核 + 流水线
```

互斥规则：同一时刻只有一个 mode 可交互；切走 mode 的长任务后台跑完，红点提示。

## 关键路径

| 用途 | 路径 |
|------|------|
| 设计文档 | `docs/plans/` |
| 架构决策 | `docs/decisions/` |
| 实验记录 | `docs/experiments/` |
| 运行时数据 | `%APPDATA%\TAgent\general\` 与 `%APPDATA%\TAgent\ta\`（**完全独立**） |
| 资产数据库 | `%APPDATA%\TAgent\ta\tag_store\tags.db`（**Proma 直读**） |
| 记忆 5 层 | `%APPDATA%\TAgent\{mode}\memory\` |

## 与原 ta_agent 关系

- ta_agent 的 Python 工具链**整体迁入**，跑成 MCP server（PyInstaller 打包）
- 54 工具、记忆系统、Blender/UE5 集成 **保留**
- ta_agent 的 Web 前端（apps/web/）**整体替换**为 Proma 设计系统重写的 TA 模式 UI
- ta_agent 旧数据 **不迁移**

## 5 层 Memory 概览

```
L0_user.md        用户画像（hermes Honcho 思路）
L1_project.md     项目画像
L2_facts.md       稳定事实
L3_corrections/   纠正记录 + 规则（含 version 可回滚）
L4_sessions/      原始会话日志 + FTS5 全文索引
L5_insights.md    提炼的洞察（LLM 周期 review）
+ nudges/         Periodic Nudges（hermes 思路）
+ reflect/        自我反思（GenericAgent 思路）
+ scheduled_tasks.json  自动清理
+ sops/           开发者维护的操作说明书
+ providers/      外部 memory provider 挂载点（honcho/mem0/hindsight）
```

## 当前阶段

**MVP 设计已拍板**，实施待启动。
- 详细设计：`docs/plans/2026-06-05-tagent-fusion-design.md`
- 改代码前请先读该文档 §2（决策）和 §3（架构总览）

## 编码约束

1. **品牌字样**：永远用 TAgent，不用 Proma
2. **模式隔离**：写到任何 mode 相关代码时确认 general 与 ta 是否共享
3. **Provider 共享**：Channel / API Key 全局共享；MCP / Skill 模式独立
4. **Memory 写入**：直写 JSONL/MD，幂等；删除/合并要 preserve_history
5. **SQLite**：Proma 端 readonly pragma；写入只走 ta_agent MCP server
6. **MCP 工具命名空间**：TA 模式工具考虑加 `tagent__` 前缀避免冲突
7. **流式响应**：长 memory context 用 StreamingContextScrubber 过滤不泄露到 UI
8. **错误处理**：MCP server 崩溃自动重启一次，第二次失败弹"重试 / 切到通用"

## 调试常用命令

```bash
# 启动 TAgent 后端 MCP server（dev 模式）
cd F:\ta_agent && python -m agent --mcp-server

# 启动 TAgent 桌面（dev 模式）
cd F:\TAgent_General\apps\electron && bun run dev

# 重命名残留 "Proma" 检查
grep -r "Proma" F:\TAgent_General\src --include="*.ts" --include="*.tsx"
```

## 引用

- 完整设计：`docs/plans/2026-06-05-tagent-fusion-design.md`
- 决策摘要：本文 §"双模式" 以上
- 原 ta_agent：`F:\ta_agent\`
- 原 Proma（已重命名完成）：`F:\Proma\`（待迁移到本工程）
