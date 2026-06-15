# TAgent 教程

v1.0.0 · 作者：LiangMX · 2026-06-15

## 简介

TAgent 是一个**双模式** Agent 桌面应用：

- **通用模式**：基于 Claude Agent SDK，集成 MCP、Skills、SubAgent、记忆、联网、飞书远程等能力。
- **TA 模式**：面向游戏 TA 领域，内置 54 个领域工具 + 资产库 + 审核/流水线 + Blender/UE5 集成。

两种模式独立运行、记忆和配置互不干扰，共享 Provider 和基础设施。

开源地址：https://github.com/Frank-LiangMX/TAgent_General

## 安装

1. 从 [Releases](https://github.com/Frank-LiangMX/TAgent_General/releases) 下载安装包，Windows 推荐安装到 `C 盘`。
2. 首次启动后按引导安装 `Node JS` 和 `Git`（Windows 务必装到 C 盘，并勾选 `Add to Path`）。

## 基础配置

### AI 渠道

设置 → 渠道 → 添加渠道。Agent 模式要求渠道支持 `Anthropic` 协议。填写 `BaseUrl` 和 `API KEY`，点击 `测试链接` 验证。

### 模型

点击 `从供应商获取` 拉取模型，按需勾选即可。保存时记得滚到顶部点击 `创建渠道`。勾选 `Agent 供应商` 后即可用于 Agent 模式。

### 记忆和联网（可选但推荐）

- **MemOS**：每月免费 5 万次存储 / 2 万次调用。设置 → 工具 → 记忆，填入 API KEY 即可。Chat 模式下需打开右上角记忆开关。
- **Tavily**：每月免费 1000 次联网。设置 → 工具 → 联网搜索，填入 API KEY 即可。需访问国际互联网。

## Chat 模式

简单的问答场景，文件仅可读取。功能包括：文件解析、剪贴板粘贴图片、模型切换、思考模式、记忆和联网开关、上下文调整、清除上下文（`Ctrl/Cmd + K`）、系统提示词切换、置顶对话。

不适合深度研究、文件修改、多步骤工作流 —— 这些交给 Agent 模式。

## Agent 模式

Agent 模式基于 Claude Agent SDK，适合长程复杂任务：文件编辑、数据分析、深度研究、PR 处理、PPT 文档生成等。

### Skills

Skills 是渐进式披露的技能包，核心是节省 tokens 并结构化地提供工作流程。用自然语言描述你的工作流，让 Agent 帮你创建 Skills；也可以用内置的 `find-skills` 去网上找现成的 Skills 安装使用。

### MCP

MCP 是外部服务的标准化封装（API + 提示词），让 Agent 能直接调用 Gmail、飞书、GitHub 等服务。用自然语言告诉 Agent 你想接入的服务即可，授权流程 Agent 会引导你完成。

### 工作区

左侧顶部可创建多个工作区，每个工作区独立的 Skills、MCP、会话和配置。建议按工作类型拆分工作区，避免配置互相干扰。

### 文件系统

Agent 基于文件系统工作：可以直接读取参考资料、产出文件到本地。多文件场景用 `@` 精确指定上下文。

### SubAgent

复杂任务可委派给内置 SubAgent（explorer / researcher / code-reviewer 等），主 Agent 会自动调度并在右侧 Team 侧边栏展示调用过程。

## TA 模式

进入 TA 模式后获得 54 个游戏 TA 领域工具，涵盖 FBX 处理、贴图优化、命名规范、资产审核等。可直读 SQLite 资产库，支持 Blender/UE5 集成。

环境额外要求：Python + `ta-agent-mcp` 包（Blender / UE5 按需）。数据集中在 `~/.tagent/ta/`，包含资产库、项目配置、TA 记忆、UE5 桥接配置和会话数据。

## 飞书远程

设置 → 飞书，跟随文字教程完成配置（3-5 分钟）。支持群聊和私聊，PC 不休眠即可随时远程派任务、查结果、回消息。典型场景：通勤路上做深度研究、远程处理 PR、紧急修复生产 Bug。

## 总结

TAgent = 通用 Agent 能力 + 游戏 TA 专业工具链。日常 AI 辅助用 Chat 模式，复杂任务用 Agent 模式，专业 TA 工作流用 TA 模式，远程协同用飞书。遇到问题欢迎在 GitHub 提 Issue 或 PR。
