# TAgent

> 双模式通用 + 游戏 TA 领域 Agent 桌面应用

## 仓库状态

🚧 **设计阶段**（2026-06-05）：架构已定，文档已落地，**实施待启动**。

## 阅读顺序

1. **`.claude\CLAUDE.md`** — Agent 上下文（5 分钟入门）
2. **`docs/plans/2026-06-05-tagent-fusion-design.md`** — 完整设计文档（约 1 小时读完）

## 目录结构

```
TAgent_General\
├── .claude\
│   └── CLAUDE.md                      ← Agent 工程上下文
├── docs\
│   ├── plans\
│   │   └── 2026-06-05-tagent-fusion-design.md  ← 完整设计
│   ├── decisions\                      ← 架构决策记录
│   └── experiments\                    ← 实验 / 调研记录
└── README.md                           ← 本文件
```

## 关联项目（外部引用）

- **`F:\Proma\`** — 通用 Agent 框架，被重命名 + 模式扩展后形成 TAgent 主代码
- **`F:\ta_agent\`** — 自研游戏 TA 领域 Agent，工具链被 PyInstaller 打包后嵌入
- **`F:\hermes-agent\`** — 参考其 MemoryProvider 抽象 + StreamingContextScrubber + FTS5 + Honcho 思路
- **`F:\GenericAgent\`** — 参考其 L4 raw_sessions + 反思层 + scheduled cleanup
- **`F:\kscc\`、`F:\KsccAgent_New\`** — 用户其他相关项目（暂未涉及）

## 后续动作

- [ ] **W1**：品牌替换 codemod（Proma → TAgent）
- [ ] **W1**：ta_agent 加 MCP server mode
- [ ] **W2**：Proma 端接 TAgent MCP server
- [ ] **W2**：MVP 验证 54 工具可调
- [ ] **W3+**：模式隔离 + 资产库 UI + 5 层 memory 实施
