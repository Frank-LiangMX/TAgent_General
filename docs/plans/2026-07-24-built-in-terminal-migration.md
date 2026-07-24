# 内置终端移植设计（借鉴 F:\Kun）

> **状态**：方案已定，待用户过目后实施
> **日期**：2026-07-24
> **分支**：`feature/built-in-terminal`（已从当前 main `c4448290` 重新拉起，旧的方向错分支已删）
> **来源**：F:\Kun 终端调研（`F:\Kun\src/main/terminal/`、`F:\Kun\src/renderer/src/components/terminal/`、`F:\Kun\src/shared/`）+ TAgent 接入点调研

---

## 0. 目标

先把 F:\Kun 那套成熟的内置终端**简单照搬接进 TAgent**，先有个能用的终端（能开 shell、敲命令、主题对、切 tab 保留 shell）。**不急着跟会话/agent CLI 结合**——那是后续阶段（见 §7）。

用户起因：想做"主会话派子代理（kscc/opencode/codex 这种 CLI）时，能在会话页看到实际运行过程"。但调研发现 kscc 是 SDK 协议流、原始命令行输出 TAgent 拿不到，且 SDK 原生子代理执行事件已在消息流里只是 UI 折叠了。所以**先把终端基础能力接进来**，后续再考虑怎么把 CLI 子代理执行过程接到终端里呈现。

---

## 1. F:\Kun 终端技术栈（已调研确认）

```
前端:  @xterm/xterm 6.0  +  addon-fit 0.11  +  addon-web-links 0.12   (DOM 渲染，无 webgl)
后端:  node-pty 1.1  (Windows=ConPTY, mac/linux=forkpty)  懒 import + 失败降级
通信:  6 个 IPC 通道: terminal:create / write / resize / dispose / data / exit
       payload 直接传 UTF-8 字符串（不 base64）
组件:  单 React 组件 TerminalPanel（lazy 懒加载）
多端:  每个 sessionId（=workspaceHash:tabId）一个 PTY，主进程 Map 持有
       切 tab/折叠面板只 dispose xterm 渲染器，PTY 常驻 + 64KB ring buffer 重放
       关 tab 才真正杀 PTY；上限 8 个 session
shell: Windows pwsh7→powershell→cmd；mac zsh；linux bash
       TERM=xterm-256color + 强制 UTF-8 locale（治 CJK 乱码）
主题:  native/none/custom 三模式；背景 alpha 合成到 DOM surface；MutationObserver 热跟随 app 主题
键盘:  不自定义拦截，全走 xterm 默认（Ctrl+C/粘贴/Tab 都不抢）
```

**最值得保留的机制**：①切 tab/折叠不杀 shell + ring buffer 重放；②背景色跟 app 主题融合；③主题热跟随；④ResizeObserver 防抖 fit；⑤node-pty 懒加载降级；⑥不抢键盘。

---

## 2. 移植文件清单（5 个核心 + 依赖）

| # | F:\Kun 源文件 | 行数 | 职责 | TAgent 落点 | 搬运性质 |
|---|---|---|---|---|---|
| 1 | `src/main/terminal/terminal-pty-ipc.ts` | ~353 | PTY 生命周期 + Map 管理 + ring buffer + IPC 注册 + 跨平台 shell 选择 + UTF-8 env | `apps/electron/src/main/lib/terminal-ipc.ts` | 纯终端逻辑，直接搬（改 IPC 常量 + 去掉 F:\Kun 设置读取） |
| 2 | `src/renderer/src/components/terminal/TerminalPanel.tsx` | ~793 | xterm UI + 多 tab 栏 + attach/重放 + 主题热跟随 + 背景合成 + fit | `apps/electron/src/renderer/components/terminal/TerminalPanel.tsx` | 含多处耦合需改（见 §3） |
| 3 | `src/renderer/src/components/terminal/terminal-session.ts` | ~23 | sessionId 命名（workspaceHash:tabId） | 同名搬 | workspace 概念需简化（见 §3.4） |
| 4 | `src/shared/app-settings-terminal.ts` | ~327 | 终端配色类型 + resolveTerminalTheme + 预设 + ANSI 调色板 | `packages/shared/src/types/terminal.ts` 或渲染层本地 | 基本纯逻辑，去掉 F:\Kun 设置架构耦合 |
| 5 | `src/shared/terminal.ts` | ~58 | 常量 + payload 类型 | `packages/shared/src/types/terminal.ts` | 100% 自包含，直接搬 |

**新增依赖**（`apps/electron/package.json`）：
- `@xterm/xterm` ^6.0
- `@xterm/addon-fit` ^0.11
- `@xterm/addon-web-links` ^0.12
- `node-pty` ^1.1.0（主进程，懒 import；**原生模块，需按平台编译 + electron-builder optionalDependencies 配置**，见 §6）

---

## 3. 耦合点改造（F:\Kun → TAgent 必改）

| 耦合点 | 位置 | 改法 |
|---|---|---|
| **API 桥名** `window.kunGui.*` | TerminalPanel.tsx ~10 处调用 | → `window.electronAPI.terminal.*` |
| **IPC 通道字符串字面量** | preload/main/Panel | → `@tagent/shared` 的 `TERMINAL_IPC_CHANNELS` 常量对象（仿 `KANBAN_IPC_CHANNELS`） |
| **workspace 概念** | terminal-session.ts（`workspaceRootIdentityKey`） | **先简化**：cwd 用 TAgent 当前工作区项目目录或主进程 cwd，hash 函数保留；不搬 F:\Kun 的 workspace-path.ts |
| **`rendererRuntimeClient.getSettings()`** | TerminalPanel.tsx:200 | → `window.electronAPI.getSettings()` 或先删掉设置同步 effect，用默认色 |
| **`SETTINGS_CHANGED_EVENT`** | TerminalPanel.tsx:30 | 删除或换成 TAgent 设置变更信号 |
| **`ds-*` Tailwind token** | TerminalPanel.tsx 全文 | **映射到 TAgent token、跟主题走**（不搬 Kun 固定色、不照搬 ds-*）：`ds-surface-strong`→`bg-card`、`ds-ink`→`text-foreground`、`ds-border-muted`→`border`、`ds-muted`→`text-muted-foreground`、`ds-hover`→hover 态、`ds-no-drag`→`titlebar-no-drag` 等。xterm 内部 ANSI 配色用 native 模式跟 app 深/浅色（F:\Kun 已有 resolveTerminalTheme，搬来接 TAgent 主题信号）。结果：终端布局/交互像 Kun，颜色随 TAgent 主题（ocean/forest/slate + 浅/深）联动 |
| **i18n** `useTranslation('common')` | TerminalPanel.tsx:153 | 先硬编码中文字符串（TAgent i18n 方案后续再说） |
| **`data-theme` 深/浅检测** | TerminalPanel.tsx:83,409 | 适配 TAgent 主题机制（读 TAgent 的主题 atom / data 属性，需实施时确认 TAgent 怎么标深浅色） |
| **zod schemas** | F:\Kun app-ipc-schemas/system.ts | TAgent IPC 不强制 zod；schemas 内联进主进程 terminal-ipc.ts 或省略（先简单） |
| **`getTerminalColorMode`** | terminal-pty-ipc.ts 注册参数 | 先传 `() => 'native'` 默认，颜色设置后续接 |

---

## 4. 接入位置：rail 入口（推荐，已定）

**不选**底部抽屉（碰会话布局、要加开关 atom + 拖拽手柄）、不选 terminal tab（改 TabType/openTab/持久化/LRU 一大串，终端不是"会话"硬塞不合适）。

**选 rail 入口**：左侧 FunctionalRail 加一个"终端"图标，点开主区直接是终端面板，跟看板/记忆页同级模式。

### 改动点（5-6 处纯添加，仿 kanban）

1. `apps/electron/src/renderer/atoms/app-mode.ts:84` — `GeneralRailItem` 联合类型加 `'terminal'`
2. `apps/electron/src/renderer/components/app-shell/FunctionalRail.tsx:58-88` — `GENERAL_RAIL_ITEMS` 加 `{ id:'terminal', label:'终端', icon:<Terminal/>, description:'内置终端' }`（icon 用 lucide `Terminal`）
3. `apps/electron/src/renderer/components/tabs/MainArea.tsx:68-97` — `renderRailContent` 加 `if (activeRailItem === 'terminal') return <TerminalMainView />`
4. 新建 `apps/electron/src/renderer/components/terminal/TerminalMainView.tsx` — 仿 `KanbanMainView`，`<Panel variant="grow" className="app-main-layout">` 包 `TerminalPanel`
5. `apps/electron/src/renderer/components/app-shell/shell-layout.ts` — `deriveRailSelection`/`deriveShellLayout` 加 `'terminal'` 分支（仿 kanban/skills，主区取代侧栏或带空侧栏）
6. `LeftSidebar.tsx` — 终端 rail 选中时侧栏处理（F.\Kun 终端不需侧栏，显示空或折叠）

---

## 5. IPC 接入（5 文件链，仿 kanban-ipc 先例）

1. **`packages/shared/src/types/terminal.ts`**（新）— `TERMINAL_IPC_CHANNELS = { CREATE, WRITE, RESIZE, DISPOSE, DATA, EXIT }` + payload 类型（搬 F:\Kun `shared/terminal.ts`）。从 `types/index.ts` export。
2. **`apps/electron/src/main/lib/terminal-ipc.ts`**（新）— 移植 `registerTerminalPtyIpc`，用 `TERMINAL_IPC_CHANNELS` 常量。node-pty 懒 `await import` + 失败降级。
3. **`apps/electron/src/main/ipc.ts`** — 调 `registerTerminalPtyIpc({ ipcMain, getMainWindow, ... })`（仿 `registerKanbanIpc` 调用点）。
4. **`apps/electron/src/preload/index.ts`** — `electronAPI` 加 `terminal: { create, write, resize, dispose, onData, onExit }` 子对象，用同常量。加到 `ElectronAPI` 类型。
5. **渲染层** `TerminalPanel.tsx` — 调 `window.electronAPI.terminal.*`。

无冲突，完全遵循现有 kanban 先例。

---

## 6. node-pty 原生模块打包（关键坑）

node-pty 是原生模块，按平台编译（Windows/macOS/Linux 各一份），必须像 Claude Agent SDK 那样处理：

- `package.json`：`node-pty` 放 `optionalDependencies`（或主依赖 + electron-rebuild）
- `electron-builder.yml`：`files` 要包含 node-pty 的平台 prebuilt（或用 `asarUnpack`）
- **主进程 esbuild**：node-pty 必须 `--external:node-pty`（不能打进 bundle，要走 require 解析原生 .node 文件），仿 SDK 的 `--external:@anthropic-ai/claude-agent-sdk`
- **懒 import**：`await import('node-pty')` 在终端首次创建时才加载，加载失败不崩主进程，面板显示"终端不可用"+ 重试（F.\Kun `terminal-pty-ipc.ts:44-58` 已是此模式，直接保留）
- 需确认 TAgent 现有 electron-rebuild / postinstall 流程（grep `electron-rebuild|@electron/rebuild`），没有则需加

**实施时务必验证**：dev 模式能 spawn shell + 打包后 Windows 能跑（原生模块打包是最易翻车点）。

---

## 7. 后续阶段（本次不做，记录方向）

终端基础能力接进来后，再考虑用户原始需求"看 CLI 子代理执行过程"：

- **SDK 原生子代理**（code-reviewer/explorer/researcher，含 kscc 渠道派的）：执行事件已在主会话消息流（带 `parent_tool_use_id`），只是渲染层折叠成 SubAgent 卡片。**纯渲染层改造**让卡片流式自动展开/实时滚动即可，不用终端。
- **kscc CLI 原始命令行输出**：SDK 当协议流消费，TAgent 拿不到原始 stdout。要在 `spawnClaudeCodeProcess`（`claude-agent-adapter.ts:867`）旁路 tee stdout 解析 JSON 行，或让 CLI 输出人类可读流（kscc 无此模式）。**深坑，后续专门攻坚**。
- **opencode/codex**：零集成，要新做 spawn + 接进终端。后续。
- **会话内终端**（在当前会话项目目录开终端）：让 `TerminalMainView` 读当前会话工作区目录传给 `TerminalPanel` 作 cwd，后续可加底部抽屉形态。

---

## 8. 实施计划

**分支**：`feature/built-in-terminal`（已建，基于 main `c4448290`）

**步骤**：
1. 加依赖（xterm 3 个 + node-pty）+ 确认 electron-rebuild 流程
2. `packages/shared/src/types/terminal.ts`：常量 + 类型 + 配色（搬 F:\Kun `shared/terminal.ts` + `app-settings-terminal.ts` 的核心）
3. `main/lib/terminal-ipc.ts`：移植 PTY 管理（改常量、去 F:\Kun 设置耦合、懒 import 降级）
4. `main/ipc.ts` + `preload/index.ts`：接 IPC 通道
5. `renderer/components/terminal/`：移植 `TerminalPanel.tsx` + `terminal-session.ts`（改桥名/token/workspace 简化/硬编码中文）
6. rail 入口：`app-mode.ts` + `FunctionalRail.tsx` + `MainArea.tsx` + `TerminalMainView.tsx` + `shell-layout.ts`
7. node-pty 打包配置（esbuild --external + electron-builder files/asarUnpack）
8. `bun run typecheck` + dev 实测（开终端、spawn shell、敲命令、切 tab 保留、主题跟随）+ 打包实测 Windows

**完成后不自动 commit**（等用户确认 + 实测）。

**风险点**：
- node-pty 原生模块打包（最易翻车，§6）
- TAgent 主题机制适配（`data-theme` 检测，需实施时确认 TAgent 深浅色标法）
- `ds-*` token 替换工作量大（TerminalPanel 793 行全文）
- electron-rebuild 流程若无则需加

---

## 9. 待用户确认

1. 接入位置 rail 入口（非底部抽屉/terminal tab）—— **已推荐，待确认**
2. workspace 概念先简化成"当前工作区目录或主进程 cwd"（不搬 F:\Kun workspace-path.ts）—— 待确认
3. i18n 先硬编码中文 —— 待确认
4. 颜色设置：**终端配色跟 TAgent 主题走（native 模式），不搬 Kun 固定色，`ds-*` 映射到 TAgent token** —— ✅ 已确认
5. 是否本次就做打包配置（node-pty），还是先只做 dev 能跑、打包后续 —— 待确认
