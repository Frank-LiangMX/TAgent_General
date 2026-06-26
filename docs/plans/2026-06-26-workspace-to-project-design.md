# 工作区概念重构 + 权限修复

> 日期: 2026-06-26
> 状态: 进行中（Phase 0-4 已完成，剩余右侧 3-tab 面板整合 + 左侧文件功能区移除 + 权限同步）
> 分支: feature/draft-restructure

## 背景

三个相互关联的问题需要解决：

1. **工作区概念难理解**：当前"抽象容器+挂载外部目录"的模型，与 Codex/Claude Code 的"项目=代码目录"直觉不符。用户不知道该在哪个目录下工作。
2. **Agent 无目录边界**：SDK 传入 `blockedPath` 表示 Agent 越界访问，但 canUseTool 完全忽略，Agent 可随意读写任意目录。
3. **自动审批 vs 完全自动无差异**：auto 模式下写操作也被 classifier 放行，用户感知不到两种模式的区别。

**改完后的心智模型**：选一个目录打开项目 → Agent 在该项目内读写 → 读写外部目录需确认 → 自动审批=读自由写确认，完全自动=全自由。

---

## ✅ Phase 0：类型基础

不改运行时行为，只为后续阶段铺路。全部已完成。

### 0.1 `AgentWorkspace` 增加 `projectDirectory`

**文件**: `packages/shared/src/types/agent.ts:97-108`

```ts
export interface AgentWorkspace {
  id: string
  name: string
  slug: string
  /** 项目目录 — 用户选择的本地代码目录，Agent 直接在该目录工作 */
  projectDirectory?: string
  createdAt: number
  updatedAt: number
}
```

可选字段保证旧工作区迁移兼容（`undefined` = 回退到旧 cwd 行为）。

### 0.2 `PermissionRequest` 增加 `blockedPath` 和 `suggestions`

**文件**: `packages/shared/src/types/agent.ts:1408-1435`

```ts
export interface PermissionRequest {
  // ... 现有字段 ...
  /** SDK 报告的越界路径 */
  blockedPath?: string
  /** SDK 建议的权限更新（如 addDirectories） */
  suggestions?: PermissionUpdate[]
}
```

### 0.3 `PermissionResponse` 增加 `addDirectories`

**文件**: `packages/shared/src/types/agent.ts`（PermissionResponse 定义处）

```ts
export interface PermissionResponse {
  requestId: string
  behavior: 'allow' | 'deny'
  alwaysAllow: boolean
  /** 用户批准扩展的目录（来自 blockedPath 场景） */
  addDirectories?: string[]
}
```

### 0.4 `PermissionUpdate` 类型移到 shared

将 `agent-permission-service.ts:42-58` 的本地类型移至 `packages/shared/src/types/agent.ts`，主进程 re-export。

### 0.5 更新 auto 模式描述

**文件**: `packages/shared/src/types/agent.ts:1374-1378`

```ts
auto: {
  sdkMode: 'auto',
  label: '自动审批',
  description: '只读操作自动放行，写操作需确认',
},
```

### 0.6 索引版本迁移

**文件**: `apps/electron/src/main/lib/agent-workspace-manager.ts`

`INDEX_VERSION` 从 2 → 3，添加迁移分支（旧工作区 `projectDirectory: undefined`，无操作）。

---

## ✅ Phase 1：跨目录边界审批

解决"Agent 无目录边界"问题。独立于 Phase 3，可在现有工作区模型内运行。全部已完成。

### 1.1 canUseTool 中处理 `blockedPath`

**文件**: `apps/electron/src/main/lib/agent-permission-service.ts:127-183`

在白名单检查之后、`isReadOnlyTool()` 检查之前，添加 blockedPath 守卫：

```ts
// 白名单检查后、只读工具检查前
if (options.blockedPath) {
  const request = this.buildBlockedPathRequest(sessionId, toolName, input, options)
  sendToRenderer(request)
  return new Promise<PermissionResult>((resolve) => {
    this.pendingPermissions.set(request.requestId, { resolve, request })
    options.signal.addEventListener('abort', () => {
      if (this.pendingPermissions.has(request.requestId)) {
        this.pendingPermissions.delete(request.requestId)
        resolve({ behavior: 'deny', message: '操作已中止' })
      }
    }, { once: true })
  })
}
```

新增 `buildBlockedPathRequest` 方法：`dangerLevel: 'normal'`，填充 `blockedPath` 和 `suggestions`，描述为"Agent 需要访问目录: {path}"。

### 1.2 `respondToPermission` 返回 `addDirectories` 权限更新

**文件**: `apps/electron/src/main/lib/agent-permission-service.ts:190-212`

当 `behavior === 'allow'` 且 `addDirectories` 非空时，PermissionResult 包含 `updatedPermissions`：

```ts
const result: PermissionResult = behavior === 'allow'
  ? {
      behavior: 'allow',
      updatedInput: pending.request.toolInput,
      ...(addDirectories?.length
        ? { updatedPermissions: [{ type: 'addDirectories', directories: addDirectories, destination: 'session' }] }
        : {}),
    }
  : { behavior: 'deny', message: '用户拒绝了此操作' }
```

### 1.3 批准后持久化目录到会话元数据

**文件**: `apps/electron/src/main/lib/agent-orchestrator.ts`

`respondToPermission` 返回 sessionId 后，如果 `addDirectories` 非空，调用 `agentSessionManager.updateSessionMeta()` 将新目录追加到 `attachedDirectories`。后续同类路径不再触发 blockedPath。

### 1.4 PermissionBanner UI：目录访问请求

**文件**: `apps/electron/src/renderer/components/agent/PermissionBanner.tsx`

当 `request.blockedPath` 存在时，渲染特殊 UI：
- 图标：`FolderOpen`（而非默认 Shield）
- 标题："Agent 需要访问目录"
- 路径：等宽字体显示 `blockedPath`
- 说明："此目录在当前项目范围之外"
- 按钮：拒绝 / 允许访问
- "允许访问" 的 respond 调用携带 `addDirectories: [request.blockedPath]`

### 1.5 Preload 传递 `blockedPath` 和 `suggestions`

**文件**: `apps/electron/src/preload/index.ts`

确认 `buildPermissionRequest` 已将 `options.blockedPath` 和 `options.suggestions` 传入 `PermissionRequest`。

### 验证

1. 会话 cwd = `~/projects/myapp`
2. Agent 读取 `~/projects/other-project` 中的文件
3. SDK 调用 canUseTool，`blockedPath = "~/projects/other-project"`
4. UI 显示"需要访问目录"横幅
5. 用户点击"允许" → Agent 继续，目录被添加到 additionalDirectories
6. 同目录后续操作不再弹窗

---

## ✅ Phase 2：Auto vs Bypass 区分

解决"两种模式无差异"问题。独立于 Phase 3。全部已完成。

### 2.1 Auto 模式下写操作始终弹窗

**文件**: `apps/electron/src/main/lib/agent-orchestrator.ts:2050`

将 `case 'auto': return autoCanUseTool(...)` 改为先检查写操作：

```ts
case 'auto': {
  // 写操作守卫：Write/Edit/Bash 写操作始终需确认（除非白名单）
  if (isWriteTool(toolName, input) && !permissionService.isWhitelisted(sessionId, toolName, input)) {
    const request = permissionService.buildPermissionRequest(sessionId, toolName, input, options)
    sendToRenderer(request)
    return new Promise<PermissionResult>((resolve) => {
      permissionService.setPending(request.requestId, { resolve, request })
      options.signal.addEventListener('abort', () => { /* deny */ }, { once: true })
    })
  }
  // 只读操作走 SDK classifier
  return autoCanUseTool(toolName, input, options)
}
```

新增 `isWriteTool` 辅助函数：
- `Write`, `Edit`, `MultiEdit`, `NotebookEdit` → `true`
- `Bash` + 命令非安全 → `true`（用 `!isSafeBashCommand(command)` 判断）
- 其余 → `false`

### 2.2 BypassPermissions 保持不变

第 2006 行 `return { behavior: 'allow', updatedInput: input }` 不动。

### 2.3 白名单机制复用

用户在 PermissionBanner 点击"本次会话总是允许"时，现有 `addToWhitelist()` 逻辑将工具/命令加入会话 Set，后续 `isWhitelisted()` 返回 `true`，写操作自动跳过弹窗。这对工作会话中重复 Write/Edit 非常实用。

### 验证

| 操作 | Auto | Bypass |
|------|------|--------|
| Read file.ts | 自动 | 自动 |
| git status | 自动 | 自动 |
| Write file.ts | 弹窗 | 自动 |
| Edit file.ts | 弹窗 | 自动 |
| npm install | 弹窗 | 自动 |
| rm -rf | 弹窗⚠️ | 自动 |

---

## ✅ Phase 3：项目模型重构

最大的结构性变更，分两个子阶段交付。全部已完成。

### Phase 3A：后端数据模型

#### 3A.1 新建 `createProjectWorkspace`

**文件**: `apps/electron/src/main/lib/agent-workspace-manager.ts`

与 `createAgentWorkspace` 并存的新函数：

```ts
export function createProjectWorkspace(projectDirectory: string): AgentWorkspace {
  const index = readIndex()

  // 已关联此目录的工作区直接返回
  const existing = index.workspaces.find(w => w.projectDirectory === projectDirectory)
  if (existing) return existing

  const dirName = basename(projectDirectory)
  const existingSlugs = new Set(index.workspaces.map(w => w.slug))
  const slug = slugify(dirName, existingSlugs)
  const now = Date.now()

  const workspace: AgentWorkspace = {
    id: randomUUID(),
    name: dirName,
    slug,
    projectDirectory,
    createdAt: now,
    updatedAt: now,
  }

  // 内部存储仍为 ~/.tagent/agent-workspaces/{slug}/
  ensureDirSync(getAgentWorkspacePath(slug))
  ensurePluginManifest(slug, dirName)
  copyDefaultSkills(slug)

  index.workspaces.unshift(workspace)
  writeIndex(index)
  return workspace
}
```

#### 3A.2 修改 `agentCwd` 确定

**文件**: `apps/electron/src/main/lib/agent-orchestrator.ts:1570-1580`

```ts
if (ws.projectDirectory) {
  // 项目模式：cwd = 用户项目目录
  agentCwd = ws.projectDirectory
  console.log(`[Agent 编排] 使用项目目录 cwd: ${agentCwd}`)
} else {
  // 旧模式：cwd = ~/.tagent 内部 session 目录
  agentCwd = getAgentSessionWorkspacePath(ws.slug, sessionId)
}
```

SDK 直接在用户项目目录内操作。SDK 配置目录通过 `getSdkConfigDir()` 指向 `~/.tagent/sdk-config/`（已实现），不污染用户 git。

#### 3A.3 `collectAttachedDirectories` 条件排除 workspace-files

**文件**: `apps/electron/src/main/lib/agent-orchestrator.ts:578-601`

```ts
if (workspaceSlug) {
  for (const d of getWorkspaceAttachedDirectories(workspaceSlug)) push(d)
  for (const f of getWorkspaceAttachedFiles(workspaceSlug)) push(dirname(f))
  const ws = getAgentWorkspace(workspaceSlug)
  // 仅旧模式工作区包含 workspace-files（项目模式下 cwd 就是项目目录，无需单独附加）
  if (!ws?.projectDirectory) {
    push(getWorkspaceFilesDir(workspaceSlug))
  }
}
```

#### 3A.4 新 IPC 通道

**文件**: `apps/electron/src/main/ipc.ts`, `apps/electron/src/preload/index.ts`

新增：
- `agent:create-project-workspace` → `createProjectWorkspace(projectDirectory)`
- Preload: `createProjectWorkspace(dir: string) => ipcRenderer.invoke(CREATE_PROJECT_WORKSPACE, dir)`

#### 3A.5 旧默认工作区兼容

`ensureDefaultWorkspace()` 不改，默认工作区 `slug='default'`，`projectDirectory=undefined`，按旧模式运行。

### Phase 3B：渲染进程 UI

#### 3B.1 首次引导卡片

**文件**: `apps/electron/src/renderer/components/agent/AgentView.tsx`

当无任何项目时（`workspaces` 为空或全部 `projectDirectory === undefined`），AgentView 主区居中显示引导卡片：
- 大号图标 `FolderOpen`
- 标题："选择项目目录开始"
- 副标题："TAgent 将在你选择的代码目录中工作"
- 主按钮："选择目录" → 调用 `createProject()`
- 背景：与设置页一致，使用卡片 + 阴影风格

选择目录后自动创建项目并进入正常 Agent 界面。

#### 3B.2 `useWorkspaceActions` 新增 `createProject`

**文件**: `apps/electron/src/renderer/hooks/useWorkspaceActions.ts`

```ts
async function createProject(): Promise<AgentWorkspace | null> {
  const result = await window.electronAPI.openFolderDialog()
  if (!result) return null

  const workspace = await window.electronAPI.createProjectWorkspace(result.path)
  setWorkspaces(prev => [workspace, ...prev])
  setCurrentWorkspaceId(workspace.id)
  window.electronAPI.updateSettings({ agentWorkspaceId: workspace.id }).catch(console.error)
  return workspace
}
```

#### 3B.3 `WorkspaceManagerDialog` → `ProjectManagerDialog`

**文件**: `apps/electron/src/renderer/components/agent/WorkspaceManagerDialog.tsx`

关键改动：
- 所有"工作区"文案 → "项目"
- "新建"按钮：不再弹名称输入框，改为调 `openFolderDialog` → `createProjectWorkspace`
- 每行显示：`[拖拽柄] [FolderOpen] [项目名] [/path/to/dir 截断]` （取代仅显示名称）
- 保留：拖拽排序、重命名、删除
- 标题："项目管理"
- 描述："每个项目对应一个本地代码目录"

#### 3B.4 AgentView 项目选择器

**文件**: `apps/electron/src/renderer/components/agent/AgentView.tsx`

- 下拉显示项目名 + 路径截断
- "新建项目"入口调 `createProject`

#### 3B.5 SidePanel："添加更多目录"

**文件**: `apps/electron/src/renderer/components/agent/SidePanel.tsx`

- 项目根目录显示为不可移除的第一行
- "附加目录"按钮文案改为"添加更多目录"
- 其余 UI 不变

#### 3B.6 WorkspaceFilesView 项目模式

**文件**: `apps/electron/src/renderer/components/agent/WorkspaceFilesView.tsx`

- 有 `projectDirectory` 时，FileBrowser `rootPath` 用 `projectDirectory`
- 无 `projectDirectory` 时，保持用 `workspace-files/` 路径
- 标题"工作区文件" → "项目文件"
- workspace-files/ 概念在项目模式下完全隐藏，用户不会感知它的存在

### 验证

1. 用户点击"新建项目" → 选择 `~/projects/myapp` → 工作区创建 `projectDirectory="~/projects/myapp"`
2. Agent 以 `cwd="~/projects/myapp"` 启动
3. 侧栏文件浏览器以 `~/projects/myapp` 为根目录
4. 附加目录通过"添加更多目录"按钮挂载
5. 旧默认工作区仍以 `~/.tagent/agent-workspaces/default/` 为 cwd 运行
6. 项目管理弹窗显示项目名和目录路径
7. 首次打开无项目时，AgentView 居中显示引导卡片

---

## 实施顺序

```
Phase 0 (类型)          ← 最先，独立合并
   |
   +---> Phase 1 (blockedPath)  ← 与 Phase 3 独立
   |
   +---> Phase 2 (auto/bypass)  ← 与 Phase 3 独立
   |
   +---> Phase 3A (后端)        ← 依赖 Phase 0
            |
            +---> Phase 3B (UI) ← 依赖 3A
```

Phase 1 和 2 可并行开发（都只改权限服务/编排器，无结构重叠）。

---

## 关键文件清单

| 层 | 文件 | Phase |
|---|---|---|
| shared 类型 | `packages/shared/src/types/agent.ts` | 0, 3A |
| shared 常量 | `packages/shared/src/constants/permission-rules.ts` | 2 |
| 主进程-工作区 | `apps/electron/src/main/lib/agent-workspace-manager.ts` | 0, 3A |
| 主进程-权限 | `apps/electron/src/main/lib/agent-permission-service.ts` | 1, 2 |
| 主进程-编排 | `apps/electron/src/main/lib/agent-orchestrator.ts` | 1, 2, 3A |
| 主进程-会话 | `apps/electron/src/main/lib/agent-session-manager.ts` | 1, 3A |
| 主进程-IPC | `apps/electron/src/main/ipc.ts` | 1, 3A |
| Preload | `apps/electron/src/preload/index.ts` | 1, 3A |
| 渲染-Atom | `apps/electron/src/renderer/atoms/agent-atoms.ts` | 0, 3B |
| 渲染-权限UI | `apps/electron/src/renderer/components/agent/PermissionBanner.tsx` | 1 |
| 渲染-权限选择 | `apps/electron/src/renderer/components/agent/PermissionModeSelector.tsx` | 2 |
| 渲染-Hook | `apps/electron/src/renderer/hooks/useWorkspaceActions.ts` | 3B |
| 渲染-项目弹窗 | `apps/electron/src/renderer/components/agent/WorkspaceManagerDialog.tsx` | 3B |
| 渲染-主视图 | `apps/electron/src/renderer/components/agent/AgentView.tsx` | 3B (引导卡片+选择器) |
| 渲染-侧栏 | `apps/electron/src/renderer/components/agent/SidePanel.tsx` | 3B |
| 渲染-文件 | `apps/electron/src/renderer/components/agent/WorkspaceFilesView.tsx` | 3B |

---

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| 项目模式下 `.claude/` 写入用户目录 | SDK 的 `CLAUDE_CONFIG_DIR` 已通过 `getSdkConfigDir()` 指向 `~/.tagent/sdk-config/`，不会写入项目目录 |
| 旧默认工作区会话中断 | `projectDirectory=undefined` 时 cwd 回退到 `~/.tagent/agent-workspaces/{slug}/{sessionId}/`，向后兼容 |
| Windows 路径反斜杠 | `createProjectWorkspace` 内 `projectDirectory.replace(/\\/g, '/')` 规范化 |
| blockedPath 和 isWriteTool 顺序 | blockedPath 检查在更上层（Phase 1 先于 Phase 2），路径越界即使是读操作也要确认 |
