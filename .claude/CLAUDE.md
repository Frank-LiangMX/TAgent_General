# TAgent — Claude Code 上下文

> 本工程是 Proma（开源）融合 ta_agent（自研游戏 TA 领域 Agent）的产物。
> 未来任何进入此工程的 AI 编码 Agent 请先读本文。

## 工程身份

- **产品名**：TAgent
- **类型**：Electron 桌面应用（TypeScript + Python 后端）
- **核心特征**：双顶层模式（通用 / TA），共享 Provider + UI，独立 Memory / 工具集 / 会话
- **品牌约束**：永远用 **TAgent**，不用 Proma

## 双模式

```
顶层 Tab
├── 通用模式（general）
│   └─ 内部 chat / agent / scratch 三 Tab
└── TA 模式（ta）
    └─ 激活 TAgent 54 工具 + 资产库 + 审核 + 流水线
```

## 关键路径

| 用途 | 路径 |
|------|------|
| 项目入口 | `CLAUDE.md`（根目录）|
| 进度追踪 | `.context/PROGRESS.md` |
| 设计文档 | `docs/plans/2026-06-05-tagent-fusion-design.md` |
| 运行时数据 | `~/.tagent/general/` 与 `~/.tagent/ta/` |

## 与原 ta_agent 关系

- ta_agent 的 Python 工具链整体迁入，跑成 MCP server
- 54 工具、记忆系统、Blender/UE5 集成保留
- ta_agent 旧数据不迁移

## 5 层 Memory 概览

```
L0_user.md        用户画像
L1_project.md     项目画像
L2_facts.md       稳定事实
L3_corrections/   纠正记录
L4_sessions/      原始会话日志
L5_insights.md    提炼的洞察
```

## 编码约束

1. **品牌字样**：永远用 TAgent，不用 Proma
2. **模式隔离**：写到 mode 相关代码时确认 general 与 ta 是否共享
3. **Provider 共享**：Channel / API Key 全局共享
4. **Memory 写入**：直写 JSONL/MD，幂等

## 调试命令

```bash
# 启动 TAgent 桌面（dev 模式）
cd F:\TAgent_General && bun run dev

# 类型检查
bun run typecheck

# 测试
bun test
```

---

## 当前进度

见 `docs/PROGRESS.md`