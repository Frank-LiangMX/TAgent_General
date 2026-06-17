# TAgent

> 双模式通用 + 游戏 TA 领域 Agent 桌面应用

## 仓库状态

✅ **实施阶段**（2026-06-18）：P0-P2 核心功能已完成，Ask 档位统一、TA 模式 UI、记忆自进化机制已落地。

## 阅读顺序

1. **`AGENTS.md`** — Agent 协作入口规范（必读）
2. **`CLAUDE.md`** — Claude Code 工程上下文（5 分钟入门）
3. **`docs/PROGRESS.md`** — 当前进度与完成情况
4. **`docs/plans/2026-06-05-tagent-fusion-design.md`** — 完整设计文档（约 1 小时读完）

## 目录结构

```
TAgent_General/
├── AGENTS.md                         ← Agent 协作入口规范
├── CLAUDE.md                         ← Claude Code 上下文
├── CHANGELOG.md                      ← 版本变更记录
├── CONTRIBUTING.md                   ← 贡献流程
│
├── docs/
│   ├── README.md                     ← 文档索引
│   ├── PROGRESS.md                   ← 进度追踪
│   ├── plans/                        ← 设计文档
│   ├── decisions/                    ← 架构决策记录（ADR）
│   └── process/                      ← 流程规范
│
├── packages/
│   ├── shared/                       ← 共享类型、IPC 常量、工具函数
│   ├── core/                         ← AI Provider 适配器
│   └── ui/                           ← 共享 UI 组件
│
└── apps/
    └── electron/                     ← Electron 桌面应用
        └── src/
            ├── main/                 ← 主进程 + 服务层
            ├── preload/              ← IPC 上下文桥接
            └── renderer/             ← React UI
```

## 核心功能

- **双顶层模式**：通用模式（General） / TA 模式互斥切换
- **Ask 档位**：轻量对话入口，引导升级到完整 Agent
- **TA 工具链**：54 个游戏 TA 领域工具（mesh/texture/FBX 检查等）
- **记忆系统**：5 层记忆（L0-L5）+ FTS5 语义搜索 + 自进化机制
- **远程连通**：飞书/钉钉/微信/WPS 协作 Bridge
- **本地优先**：数据存储于 `~/.tagent/`，无需云端数据库

## 快速开始

```bash
# 安装依赖
bun install

# 开发模式
bun run dev

# 类型检查
bun run typecheck

# 测试
bun test

# 打包
cd apps/electron
bun run dist:mac      # macOS
bun run dist:win      # Windows
bun run dist:linux    # Linux
```

## 关联项目

- **Proma** — 通用 Agent 框架，形成 TAgent 主代码基座
- **ta_agent** — 自研游戏 TA 领域 Agent，工具链通过 MCP 接入

## 里程碑

| 阶段 | 状态 | 内容 |
|-----|------|------|
| P0 MVP | ✅ 完成 | 品牌替换、TA MCP Server、工具验证 |
| P1 模式切换 | ✅ 完成 | ModeManager、顶层 Tab、模式互斥 |
| P2 TA 模式 | ✅ 完成 | 资产库、审核队列、流水线、记忆 5 层、自进化 |
| P3 后续优化 | ✅ 完成 | Token 统计、/btw 侧面提问、使用统计页 |
