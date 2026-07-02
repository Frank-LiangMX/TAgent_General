/**
 * IPC 处理器模块
 *
 * 负责注册主进程和渲染进程之间的通信处理器
 */

import { existsSync, realpathSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep, dirname } from 'node:path'

import {
  IPC_CHANNELS,
  CHANNEL_IPC_CHANNELS,
  CHAT_IPC_CHANNELS,
  AGENT_IPC_CHANNELS,
  ENVIRONMENT_IPC_CHANNELS,
  INSTALLER_IPC_CHANNELS,
  PROXY_IPC_CHANNELS,
  GITHUB_RELEASE_IPC_CHANNELS,
  SYSTEM_PROMPT_IPC_CHANNELS,
  MEMORY_IPC_CHANNELS,
  FEISHU_IPC_CHANNELS,
  DINGTALK_IPC_CHANNELS,
  WECHAT_IPC_CHANNELS,
  WPS_IPC_CHANNELS,
  PIPELINE_IPC_CHANNELS,
  USAGE_STATS_IPC_CHANNELS,
  BTW_IPC_CHANNELS,
  ASK_IPC_CHANNELS,
  SOUL_IPC_CHANNELS,
  isTAgentPermissionMode,
  AUTOMATION_IPC_CHANNELS,
  DRAFT_IPC_CHANNELS,
  KANBAN_IPC_CHANNELS,
} from '@tagent/shared'
import type {
  NudgeCandidate,
  MemoryConfig,
  CompactSessionInput,
  CompactSessionResult,
  RuntimeStatus,
  GitRepoStatus,
  Channel,
  ChannelCreateInput,
  ChannelUpdateInput,
  ChannelTestResult,
  ChannelModelValidateInput,
  FetchModelsInput,
  FetchModelsResult,
  ConversationMeta,
  ChatMessage,
  FileDialogResult,
  AgentSessionMeta,
  AgentSendInput,
  AgentWorkspace,
  AgentGenerateTitleInput,
  AgentSaveFilesInput,
  AgentSaveWorkspaceFilesInput,
  AgentSavedFile,
  AgentAttachDirectoryInput,
  AgentAttachFileInput,
  WorkspaceAttachDirectoryInput,
  WorkspaceAttachFileInput,
  GetTaskOutputInput,
  GetTaskOutputResult,
  StopTaskInput,
  WorkspaceMcpConfig,
  SkillMeta,
  WorkspaceCapabilities,
  FileEntry,
  FileSearchResult,
  EnvironmentCheckResult,
  InstallerManifest,
  InstallerDownloadRequest,
  InstallerDownloadResult,
  ProxyConfig,
  SystemProxyDetectResult,
  GitHubRelease,
  GitHubReleaseListOptions,
  PermissionResponse,
  TAgentPermissionMode,
  AskUserResponse,
  ExitPlanModeResponse,
  SystemPromptConfig,
  SystemPrompt,
  SystemPromptCreateInput,
  SystemPromptUpdateInput,
  MoveSessionToWorkspaceInput,
  ForkSessionInput,
  RewindSessionInput,
  RewindSessionResult,
  AgentSessionReferenceSearchInput,
  FeishuConfigInput,
  FeishuConfig,
  FeishuBridgeState,
  FeishuTestResult,
  FeishuChatBinding,
  FeishuPresenceReport,
  FeishuUpdateBindingInput,
  FeishuRegisterAppQRCode,
  FeishuRegisterAppStatus,
  FeishuRegisterAppResult,
  DingTalkConfigInput,
  DingTalkConfig,
  DingTalkBridgeState,
  DingTalkTestResult,
  WeChatConfig,
  WeChatBridgeState,
  SDKMessage,
  GetFileDiffInput,
  DetachedPreviewWindowInput,
  RevertFileInput,
  FileAccessOptions,
  ResolvedFileUrl,
} from '@tagent/shared'
import { ipcMain, nativeTheme, shell, dialog, BrowserWindow, app } from 'electron'

import {
  USER_PROFILE_IPC_CHANNELS,
  SETTINGS_IPC_CHANNELS,
  QUICK_TASK_IPC_CHANNELS,
  VOICE_DICTATION_IPC_CHANNELS,
  APP_ICON_IPC_CHANNELS,
  DOCK_BADGE_IPC_CHANNELS,
  STORAGE_IPC_CHANNELS,
  WINDOW_CLOSE_IPC_CHANNELS,
} from '../types'
import type { WindowCloseResponseData } from '../types'
import { askUserService } from './lib/agent-ask-user-service'
import { exitPlanService } from './lib/agent-exit-plan-service'
import { permissionService } from './lib/agent-permission-service'
import { registerKanbanIpcHandlers } from './lib/kanban-ipc'
import { registerAgentRoleIpcHandlers } from './lib/agent-role-ipc'
import {
  runAgent,
  stopAgent,
  getAgentContextUsage,
  getAgentContextUsageCached,
  generateAgentTitle,
  saveFilesToAgentSession,
  saveFilesToWorkspaceFiles,
  isAgentSessionActive,
  queueAgentMessage,
  updateAgentPermissionMode,
  rewindAgentSession,
} from './lib/agent-service'
import {
  listAgentSessions,
  createAgentSession,
  getAgentSessionMeta,
  getAgentSessionSDKMessages,
  updateAgentSessionMeta,
  deleteAgentSession,
  migrateChatToAgentSession,
  moveSessionToWorkspace,
  forkAgentSession,
  cleanupStaleAttachedPaths,
  searchAgentSessionMessages,
  searchAgentSessionReferences,
} from './lib/agent-session-manager'
import {
  listAgentWorkspaces,
  createAgentWorkspace,
  createProjectWorkspace,
  updateAgentWorkspace,
  deleteAgentWorkspace,
  reorderAgentWorkspaces,
  ensureDefaultWorkspace,
  getWorkspaceMcpConfig,
  saveWorkspaceMcpConfig,
  getAllWorkspaceSkills,
  getWorkspaceCapabilities,
  getAgentWorkspace,
  deleteWorkspaceSkill,
  installStoreSkill,
  installStoreBundle,
  getPluginStoreCatalog,
  readWorkspaceSkillContent,
  writeWorkspaceSkillContent,
  toggleWorkspaceSkill,
  listSkillFiles,
  readSkillFile,
  writeSkillFile,
  createSkillEntry,
  deleteSkillEntry,
  renameSkillEntry,
  getWorkspaceAttachedDirectories,
  getWorkspaceAttachedFiles,
  attachWorkspaceDirectory,
  attachWorkspaceFile,
  detachWorkspaceDirectory,
  detachWorkspaceFile,
  getWorktreeRepos,
  addWorktreeRepo,
  removeWorktreeRepo,
  cleanupStaleWorkspaceAttachedPaths,
} from './lib/agent-workspace-manager'
import { readAttachmentAsBase64, openFileDialog } from './lib/attachment-service'
import {
  listChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  decryptApiKey,
  testChannel,
  testChannelDirect,
  fetchModels,
  validateChannelModel,
} from './lib/channel-manager'
import {
  getAgentSessionWorkspacePath,
  getAgentWorkspacesDir,
  getWorkspaceSkillsDir,
  getWorkspaceFilesDir,
} from './lib/config-paths'
import { listConversations, deleteConversation } from './lib/conversation-manager'
import { dingtalkBridgeManager } from './lib/dingtalk-bridge-manager'
import { requestApplicationQuit } from './lib/app-shutdown'
import {
  getDingTalkConfig,
  saveDingTalkConfig,
  getDecryptedClientSecret,
  getDingTalkMultiBotConfig,
  saveDingTalkBotConfig,
  removeDingTalkBot,
  getDecryptedBotClientSecret,
} from './lib/dingtalk-config'
import { setDockBadgeCount } from './lib/dock-badge-service'
import { setMacDockIconFromPng } from './lib/dock-icon-mac'
import { checkEnvironment } from './lib/environment-checker'
import { feishuBridgeManager } from './lib/feishu-bridge-manager'
import {
  getFeishuConfig,
  saveFeishuConfig,
  getDecryptedAppSecret,
  getFeishuMultiBotConfig,
  saveFeishuBotConfig,
  removeFeishuBot,
  getDecryptedBotAppSecret,
} from './lib/feishu-config'
import { presenceService } from './lib/feishu-presence'
import { syncFeishuSyncSleepBlocker } from './lib/feishu-sleep-blocker'
import {
  getUnstagedChanges,
  getFileDiff,
  getUntrackedContent,
  revertFile,
  getDiffContents,
  listWorktrees,
  getWorktreeChanges,
} from './lib/git-diff-service'
import {
  getLatestRelease,
  listReleases as listGitHubReleases,
  getReleaseByTag,
} from './lib/github-release-service'
import {
  cancelInstallerDownload,
  downloadInstaller,
  launchInstaller,
} from './lib/installer-downloader'
import { fetchInstallerManifest, findInstallerSource } from './lib/installer-manifest'
import { registerTAgentFilePath } from './lib/local-file-protocol'
import { getMemoryConfig, setMemoryConfig } from './lib/memory-service'
import { getProxySettings, saveProxySettings } from './lib/proxy-settings-service'
import { getRuntimeStatus, getGitRepoStatus, reinitializeRuntime } from './lib/runtime-init'
import { getSettings, updateSettings } from './lib/settings-service'
import { calculateStorageStats, cleanupStorage, cleanupTempFiles } from './lib/storage-service'
import {
  getSystemPromptConfig,
  createSystemPrompt,
  updateSystemPrompt,
  deleteSystemPrompt,
  updateAppendSetting,
  setDefaultPrompt,
} from './lib/system-prompt-manager'
import { detectSystemProxy } from './lib/system-proxy-detector'
import { getTutorialHtmlPath } from './lib/tutorial-service'
import { registerUpdaterIpc } from './lib/updater/updater-ipc'
import { getUserProfile, updateUserProfile } from './lib/user-profile-service'
import { wechatBridge } from './lib/wechat-bridge'
import { getWeChatConfig } from './lib/wechat-config'
import { watchAttachedDirectory, unwatchAttachedDirectory } from './lib/workspace-watcher'
import { wpsBridge } from './lib/wps-bridge'
import { getDecryptedWpsSecretKey, getWpsConfig, saveWpsConfig } from './lib/wps-config'

import type {
  QuickTaskSubmitInput,
  VoiceDictationAudioChunkInput,
  VoiceDictationCommitInput,
  VoiceDictationCommitResult,
  VoiceDictationResizeInput,
  VoiceDictationSettings,
  VoiceDictationSettingsUpdate,
  VoiceDictationStartInput,
  VoiceDictationStopInput,
  VoiceDictationTestResult,
  MicPermissionResult,
  UserProfile,
  AppSettings,
} from '../types'
import type { CleanupOptions } from './lib/storage-service'

/** 文件浏览器中需要隐藏的系统文件 */
const HIDDEN_FS_ENTRIES = new Set(['.DS_Store', 'Thumbs.db'])

/** 已知编辑器应用名称白名单（macOS） */
const KNOWN_EDITORS = [
  'Visual Studio Code',
  'Cursor',
  'Sublime Text',
  'Windsurf',
  'Zed',
  'CotEditor',
  'IntelliJ IDEA',
  'Xcode',
  'TextEdit',
]

/**
 * 检查路径是否在允许的目录范围内（解析 symlink）
 *
 * extraAllowedPaths 来自 renderer 的 basePaths（用户通过 UI 附加的目录），
 * 虽然 renderer 不可信，但附加目录功能本身就允许用户授权 workspaces 外的路径访问。
 * 攻击者需要先控制 renderer 才能伪造 basePaths，此时已有更大的攻击面。
 */
function realpathOrResolve(path: string): string {
  try {
    return realpathSync(resolve(path))
  } catch {
    return resolve(path)
  }
}

function getAuthorizedRoots(options?: FileAccessOptions): string[] {
  const roots: string[] = [getAgentWorkspacesDir(), join(tmpdir(), 'tagent-preview')]

  const workspaceSlugs = new Set<string>()

  if (options?.sessionId) {
    const meta = getAgentSessionMeta(options.sessionId)
    if (meta?.attachedDirectories) {
      roots.push(...meta.attachedDirectories)
    }
    if (meta?.attachedFiles) {
      roots.push(...meta.attachedFiles)
    }
    if (meta?.workspaceId) {
      const workspace = getAgentWorkspace(meta.workspaceId)
      if (workspace?.slug) workspaceSlugs.add(workspace.slug)
      if (workspace?.projectDirectory) {
        roots.push(workspace.projectDirectory)
      }
    }
  }

  if (options?.workspaceSlug) {
    workspaceSlugs.add(options.workspaceSlug)
  }

  for (const slug of workspaceSlugs) {
    roots.push(getWorkspaceFilesDir(slug))
    roots.push(...getWorkspaceAttachedDirectories(slug))
    roots.push(...getWorkspaceAttachedFiles(slug))
    // 项目模式下加入 projectDirectory
    for (const ws of listAgentWorkspaces()) {
      if (ws.slug === slug && ws.projectDirectory) {
        roots.push(ws.projectDirectory)
        break
      }
    }
  }

  return roots
}

function isWithinWorkspacesOrProjects(filePath: string): boolean {
  const resolved = resolve(filePath)
  const workspacesRoot = resolve(getAgentWorkspacesDir())
  if (resolved.startsWith(workspacesRoot + sep) || resolved === workspacesRoot) return true
  for (const ws of listAgentWorkspaces()) {
    if (ws.projectDirectory) {
      const pd = resolve(ws.projectDirectory)
      if (resolved.startsWith(pd + sep) || resolved === pd) return true
    }
  }
  return false
}

/** 确保路径在工作区目录或项目目录内，否则抛出越界错误 */
function ensureWithinWorkspacesOrProjects(filePath: string): void {
  if (isWithinWorkspacesOrProjects(filePath)) return
  throw new Error('访问路径超出 Agent 工作区范围')
}

function isUnderRoot(resolvedPath: string, root: string): boolean {
  const resolvedRoot = realpathOrResolve(root)
  return resolvedPath === resolvedRoot || resolvedPath.startsWith(resolvedRoot + sep)
}

function isPathAllowed(filePath: string, options?: FileAccessOptions): boolean {
  let resolved: string
  try {
    resolved = realpathSync(resolve(filePath))
  } catch {
    return false
  }
  return getAuthorizedRoots(options).some((root) => isUnderRoot(resolved, root))
}

function normalizeFileAccessOptions(
  value?: FileAccessOptions | string[]
): FileAccessOptions | undefined {
  if (!value || Array.isArray(value) || typeof value !== 'object') return undefined
  return {
    sessionId: typeof value.sessionId === 'string' ? value.sessionId : undefined,
    workspaceSlug: typeof value.workspaceSlug === 'string' ? value.workspaceSlug : undefined,
    candidateBasePaths: Array.isArray(value.candidateBasePaths)
      ? value.candidateBasePaths.filter((p): p is string => typeof p === 'string' && p.length > 0)
      : undefined,
  }
}

function getAllowedCandidateBasePaths(options?: FileAccessOptions): string[] | undefined {
  const allowed = options?.candidateBasePaths?.filter((p) => isPathAllowed(p, options)) ?? []
  return allowed.length > 0 ? allowed : undefined
}

function ensurePathAllowed(filePath: string, options?: FileAccessOptions): boolean {
  if (isPathAllowed(filePath, options)) return true
  console.warn('[IPC] 拒绝越界路径:', filePath)
  return false
}

/**
 * 注册 IPC 处理器
 *
 * 注册的通道：
 * - runtime:get-status: 获取运行时状态
 * - git:get-repo-status: 获取指定目录的 Git 仓库状态
 * - channel:*: 渠道管理相关
 * - chat:*: 对话管理 + 消息发送 + 流式事件
 */
/**
 * 打包内置资源目录
 * dev: __dirname/resources（build:resources 阶段拷贝）
 * prod: process.resourcesPath（electron-builder extraResources 产物）
 */
function getBundledResourcesDir(): string {
  return app.isPackaged ? process.resourcesPath : join(__dirname, 'resources')
}

/**
 * 默认 App 探测结果按文件后缀缓存（含 null 负缓存），避免反复 spawn osascript / 注册表查询。
 * 进程级别一次会话足够，无需失效策略——用户切换默认 App 是低频行为，下次重启生效即可。
 */
const defaultAppCache = new Map<string, import('@tagent/shared').DefaultAppInfo | null>()

function extOf(filePath: string): string {
  const base = filePath.split(/[\\/]/).pop() ?? ''
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot).toLowerCase() : ''
}

async function getAppIconDataUrl(appPath: string): Promise<string> {
  // macOS: 用 sips 把 App bundle 的 .icns 转成 64×64 PNG 再读。
  // 不要用 nativeImage.createFromPath(.icns) + resize ——某些 Electron 版本对多分辨率 .icns
  // resize 时会 SIGTRAP 直接崩主进程。
  if (process.platform === 'darwin' && appPath.endsWith('.app')) {
    const dataUrl = await getMacAppIconViaSips(appPath)
    if (dataUrl) return dataUrl
  }

  const icon = await app.getFileIcon(appPath, { size: 'large' })
  if (icon.isEmpty()) return ''
  return icon.toDataURL()
}

async function getMacAppIconViaSips(appPath: string): Promise<string> {
  const { existsSync, readFileSync, unlinkSync, mkdtempSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { tmpdir } = await import('node:os')

  // 找 .icns 文件
  const resourcesDir = join(appPath, 'Contents', 'Resources')
  const plistPath = join(appPath, 'Contents', 'Info.plist')
  let iconName: string | null = null
  if (existsSync(plistPath)) {
    const r = await runCmd(
      '/usr/libexec/PlistBuddy',
      ['-c', 'Print :CFBundleIconFile', plistPath],
      { timeoutMs: 2000 }
    )
    if (r.status === 0) iconName = r.stdout.trim()
  }
  const candidates: string[] = []
  if (iconName)
    candidates.push(join(resourcesDir, iconName.endsWith('.icns') ? iconName : `${iconName}.icns`))
  candidates.push(
    join(resourcesDir, 'AppIcon.icns'),
    join(resourcesDir, 'app.icns'),
    join(resourcesDir, 'icon.icns')
  )
  const icnsPath = candidates.find((p) => existsSync(p))
  if (!icnsPath) return ''

  const tmp = mkdtempSync(join(tmpdir(), 'tagent-icon-'))
  const outPath = join(tmp, 'icon.png')
  try {
    const r = await runCmd(
      'sips',
      ['-s', 'format', 'png', '-Z', '64', icnsPath, '--out', outPath],
      { timeoutMs: 4000 }
    )
    if (r.status !== 0 || !existsSync(outPath)) return ''
    const buf = readFileSync(outPath)
    return `data:image/png;base64,${buf.toString('base64')}`
  } finally {
    try {
      if (existsSync(outPath)) unlinkSync(outPath)
    } catch {
      /* ignore */
    }
  }
}

/** 异步执行外部命令，超时即 kill；不经 shell，避免 shell 元字符注入。 */
async function runCmd(
  bin: string,
  args: string[],
  opts: { timeoutMs?: number; stdin?: string } = {}
): Promise<{ status: number | null; stdout: string }> {
  const { spawn } = await import('node:child_process')
  const { timeoutMs = 4000, stdin } = opts
  return new Promise((resolvePromise) => {
    const child = spawn(bin, args, {
      stdio: [stdin !== undefined ? 'pipe' : 'ignore', 'pipe', 'ignore'],
    })
    let stdout = ''
    let settled = false
    const finish = (status: number | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolvePromise({ status, stdout })
    }
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {
        /* ignore */
      }
      finish(null)
    }, timeoutMs)
    child.on('error', () => finish(null))
    child.on('close', (code) => finish(code))
    if (child.stdout) {
      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk
      })
    }
    if (stdin !== undefined && child.stdin) {
      child.stdin.end(stdin)
    }
  })
}

function parseWindowsRegistryValue(stdout: string): string {
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/\s+REG_\w+\s+(.+)$/)
    if (match?.[1]) return match[1].trim()
  }
  return ''
}

function expandWindowsEnvPath(filePath: string): string {
  return filePath.replace(/%([^%]+)%/g, (token, name: string) => {
    const foundKey = Object.keys(process.env).find(
      (key) => key.toLowerCase() === name.toLowerCase()
    )
    return foundKey ? (process.env[foundKey] ?? token) : token
  })
}

function parseWindowsExecutablePath(command: string): string {
  const match = command.match(/"([^"]+\.exe)"|([^\s"]+\.exe)/i)
  return expandWindowsEnvPath((match?.[1] || match?.[2] || '').trim())
}

function isSafeWindowsProgId(progId: string): boolean {
  return /^[a-zA-Z0-9_.+-]+$/.test(progId)
}

async function getWindowsDefaultAppCommand(progId: string): Promise<string> {
  if (!isSafeWindowsProgId(progId)) return ''

  const registryResult = await runCmd('reg', [
    'query',
    `HKCR\\${progId}\\shell\\open\\command`,
    '/ve',
  ])
  const registryCommand = parseWindowsRegistryValue(registryResult.stdout)
  if (registryCommand) return registryCommand

  const ftypeResult = await runCmd('cmd', ['/c', `ftype ${progId}`])
  return (ftypeResult.stdout || '').split('=').slice(1).join('=').trim()
}

async function getWindowsDefaultAppInfo(
  filePath: string
): Promise<{ appPath: string; appName: string; isUwp?: boolean } | null> {
  const ext = extOf(filePath)
  // ext 来自渲染进程的 filePath，必须严格校验：cmd /c "assoc ${ext}" 中 & | > < 等会触发命令链
  if (!/^\.[a-zA-Z0-9]+$/.test(ext)) {
    console.log('[DefaultApp] ext 校验失败:', ext)
    return null
  }

  const userChoiceResult = await runCmd('reg', [
    'query',
    `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\${ext}\\UserChoice`,
    '/v',
    'ProgId',
  ])
  let progId = parseWindowsRegistryValue(userChoiceResult.stdout)
  console.log('[DefaultApp] ext=%s UserChoice progId=%s', ext, progId)

  if (!progId) {
    const assoc = await runCmd('cmd', ['/c', `assoc ${ext}`])
    progId = (assoc.stdout || '').split('=').slice(1).join('=').trim()
    console.log('[DefaultApp] assoc fallback progId=%s', progId)
  }
  // 第三 fallback：HKCU OpenWithList MRU（取最近使用的 exe，与 Windows 设置显示一致）
  if (!progId) {
    const mruResult = await runCmd('reg', [
      'query',
      `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\${ext}\\OpenWithList`,
    ])
    const mruLine = mruResult.stdout.split(/\r?\n/).find((l) => /\s+MRUList\s+REG_SZ\s+/.test(l))
    const mruOrder = mruLine?.split(/\s+REG_SZ\s+/)[1]?.trim() ?? ''
    if (mruOrder) {
      const firstKey = mruOrder[0]
      const exeLine = mruResult.stdout
        .split(/\r?\n/)
        .find((l) => new RegExp(`\\s+${firstKey}\\s+REG_SZ\\s+`).test(l))
      const exeName = exeLine?.split(/\s+REG_SZ\s+/)[1]?.trim() ?? ''
      if (exeName && /^[a-zA-Z0-9 _.+()-]+\.exe$/i.test(exeName)) {
        // 从 App Paths 把 exe 名转成 progId（取 exe 对应的 HKCR 下注册的 ProgId）
        // 直接用 exe 名（去掉 .exe）当 appName，appPath 从 App Paths 查
        const appName = exeName.replace(/\.exe$/i, '')
        const apResult = await runCmd('reg', [
          'query',
          `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exeName}`,
          '/ve',
        ])
        let exePath = parseWindowsRegistryValue(apResult.stdout)
        if (!exePath) {
          const apResult2 = await runCmd('reg', [
            'query',
            `HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exeName}`,
            '/ve',
          ])
          exePath = parseWindowsRegistryValue(apResult2.stdout)
        }
        console.log('[DefaultApp] OpenWithList MRU fallback: exe=%s path=%s', exeName, exePath)
        if (exePath) return { appPath: exePath, appName }
      }
    }
  }
  // 第四 fallback：HKCU OpenWithProgids（无 UserChoice 但有文件类型关联时）
  if (!progId) {
    const owpResult = await runCmd('reg', [
      'query',
      `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\${ext}\\OpenWithProgids`,
    ])
    // 取第一个非空值名（跳过空行和路径行）
    for (const line of owpResult.stdout.split(/\r?\n/)) {
      const m = line.match(/^\s+(\S+)\s+REG_/)
      if (m && m[1] && isSafeWindowsProgId(m[1])) {
        progId = m[1]
        console.log('[DefaultApp] OpenWithProgids fallback progId=%s', progId)
        break
      }
    }
  }
  if (!progId || !isSafeWindowsProgId(progId)) {
    console.log('[DefaultApp] progId 无效或不安全:', progId)
    return null
  }

  // UWP 应用：shell\open\command 下只有 DelegateExecute，没有传统 exe 路径
  // 从 Application 子键读 ApplicationName 作为 appName
  if (progId.startsWith('AppX')) {
    const nameResult = await runCmd('reg', [
      'query',
      `HKCR\\${progId}\\Application`,
      '/v',
      'ApplicationName',
    ])
    let appName = parseWindowsRegistryValue(nameResult.stdout)
    // ApplicationName 通常是资源引用 "@{...?ms-resource://...}"，取最后一段
    if (appName.startsWith('@{')) {
      const appIdResult = await runCmd('reg', [
        'query',
        `HKCR\\${progId}\\Application`,
        '/v',
        'AppUserModelId',
      ])
      const appUserModelId = parseWindowsRegistryValue(appIdResult.stdout)
      // AppUserModelId 形如 "Microsoft.ZuneVideo_8wekyb3d8bbwe!Microsoft.ZuneVideo"
      // 取 ! 之后的部分作为名字，再去掉前缀
      const parts = appUserModelId.split('!')
      appName =
        (parts[1] ?? parts[0] ?? '').replace(/^Microsoft\./, '').replace(/^Windows\./, '') ||
        'UWP App'
    }
    console.log('[DefaultApp] UWP app, appName=%s', appName)
    return { appPath: '', appName, isUwp: true }
  }

  const command = await getWindowsDefaultAppCommand(progId)
  console.log('[DefaultApp] open command:', command)
  const appPath = parseWindowsExecutablePath(command)
  console.log('[DefaultApp] parsed appPath:', appPath)
  if (!appPath) {
    // Fallback：从 HKCR\<progId> 默认值取 app 名，从 App Paths 找 exe
    const rootResult = await runCmd('reg', ['query', `HKCR\\${progId}`, '/ve'])
    const rootName = parseWindowsRegistryValue(rootResult.stdout)
    // AppUserModelId 字段（非 UWP 也可能有，如 Quark）
    const appModelResult = await runCmd('reg', ['query', `HKCR\\${progId}`, '/v', 'AppUserModelId'])
    const appModelId = parseWindowsRegistryValue(appModelResult.stdout)
    const candidateAppName = (appModelId || rootName || '')
      .replace(/\s+(HTML?\s+)?(Document|File)$/i, '')
      .trim()
    if (!candidateAppName || !/^[a-zA-Z0-9 _.+-]+$/.test(candidateAppName)) return null
    // 从 App Paths 找 exe（应用注册了 App Paths 就能找到）
    const appPathsResult = await runCmd('reg', [
      'query',
      `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${candidateAppName}.exe`,
      '/ve',
    ])
    let exePath = parseWindowsRegistryValue(appPathsResult.stdout)
    if (!exePath) {
      const appPathsResult2 = await runCmd('reg', [
        'query',
        `HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${candidateAppName}.exe`,
        '/ve',
      ])
      exePath = parseWindowsRegistryValue(appPathsResult2.stdout)
    }
    console.log(
      '[DefaultApp] App Paths fallback: candidateAppName=%s exePath=%s',
      candidateAppName,
      exePath
    )
    if (!exePath) return null
    const base = exePath.split(/[\\/]/).pop() || ''
    return { appPath: exePath, appName: base.replace(/\.exe$/i, '') }
  }

  const base = appPath.split(/[\\/]/).pop() || ''
  return { appPath, appName: base.replace(/\.exe$/i, '') }
}

async function getDefaultAppInfoForFile(
  filePath: string,
  _options?: FileAccessOptions
): Promise<import('@tagent/shared').DefaultAppInfo | null> {
  const { resolve } = await import('node:path')
  const absPath = resolve(filePath)

  const cacheKey = `${process.platform}:${extOf(filePath) || filePath}`
  if (defaultAppCache.has(cacheKey)) return defaultAppCache.get(cacheKey) ?? null

  let appPath = ''
  let appName = ''

  if (process.platform === 'darwin') {
    // 通过 swift + AppKit/NSWorkspace.urlForApplication(toOpen:) 调 LaunchServices。
    // 比 AppleScript 的 `default application of (file as alias)` 稳得多——后者在 macOS 14+
    // 经常返回 -1700（无法转 alias），即便文件存在、默认 App 已正确设置。
    // swift 通过 stdin 接收脚本，文件路径作为 argv[1]，杜绝任何字符串拼接注入。
    const swiftSrc = `import Foundation
import AppKit
let path = CommandLine.arguments.dropFirst().first ?? ""
let url = URL(fileURLWithPath: path)
if let appUrl = NSWorkspace.shared.urlForApplication(toOpen: url) {
  print(appUrl.path)
} else {
  exit(1)
}`
    const r = await runCmd('swift', ['-', absPath], { stdin: swiftSrc, timeoutMs: 6000 })
    if (r.status === 0) {
      appPath = r.stdout.trim().replace(/\/$/, '')
    }
    if (appPath.endsWith('.app')) {
      const base = appPath.split('/').pop() || ''
      appName = base.replace(/\.app$/, '')
    }
  } else if (process.platform === 'win32') {
    const info = await getWindowsDefaultAppInfo(filePath)
    console.log('[DefaultApp] win32 getWindowsDefaultAppInfo 结果:', info)
    if (!info) return cacheNull(cacheKey)
    appPath = info.isUwp ? absPath : info.appPath
    appName = info.appName
  } else {
    const mimeRes = await runCmd('xdg-mime', ['query', 'filetype', absPath])
    const mime = mimeRes.stdout.trim()
    if (!mime) return cacheNull(cacheKey)
    const defRes = await runCmd('xdg-mime', ['query', 'default', mime])
    const desktop = defRes.stdout.trim()
    if (!desktop) return cacheNull(cacheKey)
    const { homedir } = await import('node:os')
    const candidates = [
      `${homedir()}/.local/share/applications/${desktop}`,
      `/usr/share/applications/${desktop}`,
      `/usr/local/share/applications/${desktop}`,
    ]
    const { existsSync, readFileSync } = await import('node:fs')
    const desktopPath = candidates.find((p) => existsSync(p))
    if (!desktopPath) return cacheNull(cacheKey)
    const text = readFileSync(desktopPath, 'utf8')
    const execLine =
      text
        .split('\n')
        .find((l) => l.startsWith('Exec='))
        ?.slice(5) || ''
    const nameLine =
      text
        .split('\n')
        .find((l) => l.startsWith('Name='))
        ?.slice(5) || ''
    appPath = execLine.split(/\s+/)[0] || ''
    appName = nameLine || (appPath.split('/').pop() ?? '')
  }

  if (!appPath || !appName) {
    console.log(
      '[DefaultApp] appPath 或 appName 为空，返回 null. appPath=%s appName=%s',
      appPath,
      appName
    )
    return cacheNull(cacheKey)
  }

  const iconDataUrl = await getAppIconDataUrl(appPath).catch((e) => {
    console.warn('[DefaultApp] getAppIconDataUrl 失败:', e)
    return ''
  })
  console.log('[DefaultApp] iconDataUrl 长度:', iconDataUrl?.length)
  if (!iconDataUrl) return cacheNull(cacheKey)

  const info: import('@tagent/shared').DefaultAppInfo = { name: appName, appPath, iconDataUrl }
  defaultAppCache.set(cacheKey, info)
  return info
}

function cacheNull(key: string): null {
  defaultAppCache.set(key, null)
  return null
}

/**
 * 解析应用图标变体的文件路径
 * 当前仅保留主图标，所有变体请求统一回退到 icon.png
 */
export function resolveAppIconPath(_variantId: string): string | null {
  const resourcesDir = getBundledResourcesDir()
  return join(resourcesDir, 'icon.png')
}

/** macOS Dock：运行时套 squircle，不修改 resources 图标文件 */
export function setMacDockIcon(iconPath: string): boolean {
  return setMacDockIconFromPng(iconPath)
}

export function registerIpcHandlers(): void {
  console.log('[IPC] 正在注册 IPC 处理器...')

  // ===== 运行时相关 =====

  // 获取运行时状态
  ipcMain.handle(IPC_CHANNELS.GET_RUNTIME_STATUS, async (): Promise<RuntimeStatus | null> => {
    return getRuntimeStatus()
  })

  // 重新初始化运行时（用户安装完 Git/Node 后触发，Windows 场景常用）
  ipcMain.handle(IPC_CHANNELS.REINIT_RUNTIME, async (): Promise<RuntimeStatus> => {
    return reinitializeRuntime()
  })

  // 获取指定目录的 Git 仓库状态
  ipcMain.handle(
    IPC_CHANNELS.GET_GIT_REPO_STATUS,
    async (_, dirPath: string): Promise<GitRepoStatus | null> => {
      if (!dirPath || typeof dirPath !== 'string') {
        console.warn('[IPC] git:get-repo-status 收到无效的目录路径')
        return null
      }

      return getGitRepoStatus(dirPath)
    }
  )

  // 获取未暂存的变更文件列表
  ipcMain.handle(
    IPC_CHANNELS.GET_UNSTAGED_CHANGES,
    async (
      _,
      dirPath: string,
      sessionPath?: string,
      workspaceFilesPath?: string,
      extraPaths?: string[],
      sessionId?: string
    ) => {
      if (!dirPath || typeof dirPath !== 'string') {
        console.warn('[IPC] git:get-unstaged-changes 收到无效的目录路径')
        return { isGitRepo: false, files: [], untrackedFiles: [], gitRootNames: [] }
      }
      const access = normalizeFileAccessOptions({ sessionId })
      if (!ensurePathAllowed(dirPath, access)) {
        return { isGitRepo: false, files: [], untrackedFiles: [], gitRootNames: [] }
      }
      const allowedSessionPath =
        sessionPath && isPathAllowed(sessionPath, access) ? sessionPath : undefined
      const allowedWorkspaceFilesPath =
        workspaceFilesPath && isPathAllowed(workspaceFilesPath, access)
          ? workspaceFilesPath
          : undefined
      const allowedExtraPaths = extraPaths?.filter((p) => isPathAllowed(p, access))
      return getUnstagedChanges(
        dirPath,
        allowedSessionPath,
        allowedWorkspaceFilesPath,
        allowedExtraPaths
      )
    }
  )

  // 获取单个文件的 diff
  ipcMain.handle(IPC_CHANNELS.GET_FILE_DIFF, async (_, input: GetFileDiffInput) => {
    const { dirPath, filePath, gitRoot, sessionId } = input
    if (!dirPath || !filePath || typeof dirPath !== 'string' || typeof filePath !== 'string') {
      console.warn('[IPC] git:get-file-diff 收到无效参数')
      return ''
    }
    const access = normalizeFileAccessOptions({ sessionId })
    if (!ensurePathAllowed(dirPath, access) || (gitRoot && !ensurePathAllowed(gitRoot, access)))
      return ''
    return getFileDiff(dirPath, filePath, gitRoot)
  })

  // 获取未追踪文件内容
  ipcMain.handle(IPC_CHANNELS.GET_UNTRACKED_CONTENT, async (_, input: GetFileDiffInput) => {
    const { dirPath, filePath, gitRoot, sessionId } = input
    if (!dirPath || !filePath || typeof dirPath !== 'string' || typeof filePath !== 'string') {
      console.warn('[IPC] git:get-untracked-content 收到无效参数')
      return ''
    }
    const access = normalizeFileAccessOptions({ sessionId })
    if (!ensurePathAllowed(dirPath, access) || (gitRoot && !ensurePathAllowed(gitRoot, access)))
      return ''
    return getUntrackedContent(dirPath, filePath, gitRoot)
  })

  // 还原文件变更
  ipcMain.handle(IPC_CHANNELS.REVERT_FILE, async (_, input: RevertFileInput) => {
    const { dirPath, filePath, gitRoot, sessionId } = input
    if (!dirPath || !filePath || typeof dirPath !== 'string' || typeof filePath !== 'string') {
      console.warn('[IPC] git:revert-file 收到无效参数')
      return
    }
    const access = normalizeFileAccessOptions({ sessionId })
    if (!ensurePathAllowed(dirPath, access) || (gitRoot && !ensurePathAllowed(gitRoot, access)))
      return
    await revertFile(dirPath, filePath, gitRoot)
  })

  // 获取文件新旧版本内容
  ipcMain.handle(IPC_CHANNELS.GET_DIFF_CONTENTS, async (_, input: GetFileDiffInput) => {
    const { dirPath, filePath, gitRoot, sessionId } = input
    if (!dirPath || !filePath || typeof dirPath !== 'string' || typeof filePath !== 'string') {
      console.warn('[IPC] git:get-diff-contents 收到无效参数')
      return null
    }
    const access = normalizeFileAccessOptions({ sessionId })
    if (!ensurePathAllowed(dirPath, access) || (gitRoot && !ensurePathAllowed(gitRoot, access)))
      return null
    return getDiffContents(dirPath, filePath, gitRoot, input.baseRef)
  })

  // 列出 Git Worktree（只读取 worktree 元信息，不涉及文件内容，跳过路径安全检查）
  ipcMain.handle(IPC_CHANNELS.LIST_WORKTREES, async (_, repoPath: string, _sessionId: string) => {
    if (!repoPath || typeof repoPath !== 'string') return []
    return await listWorktrees(repoPath)
  })

  // 获取 Worktree 相对于基准分支的全量变更
  ipcMain.handle(
    IPC_CHANNELS.GET_WORKTREE_CHANGES,
    async (_, worktreePath: string, baseBranch: string, sessionId: string) => {
      if (!worktreePath || typeof worktreePath !== 'string') {
        return { isGitRepo: false, files: [], untrackedFiles: [], gitRootNames: [] }
      }
      const access = normalizeFileAccessOptions({ sessionId })
      if (!ensurePathAllowed(worktreePath, access)) {
        return { isGitRepo: false, files: [], untrackedFiles: [], gitRootNames: [] }
      }
      return getWorktreeChanges(worktreePath, baseBranch)
    }
  )

  // 打开独立预览窗口
  ipcMain.handle(
    IPC_CHANNELS.OPEN_DETACHED_PREVIEW,
    async (event, input: DetachedPreviewWindowInput): Promise<string | null> => {
      if (
        !input ||
        typeof input.sessionId !== 'string' ||
        typeof input.filePath !== 'string' ||
        typeof input.dirPath !== 'string'
      ) {
        console.warn('[IPC] preview:open-detached 收到无效参数')
        return null
      }
      const { openDetachedPreviewWindow } = await import('./lib/detached-preview-window')
      const sourceWindow = BrowserWindow.fromWebContents(event.sender)
      return openDetachedPreviewWindow(input, sourceWindow)
    }
  )

  // 获取独立预览窗口数据
  ipcMain.handle(IPC_CHANNELS.GET_DETACHED_PREVIEW_DATA, async (_, previewId: string) => {
    if (!previewId || typeof previewId !== 'string') return null
    const { getDetachedPreviewWindowData } = await import('./lib/detached-preview-window')
    return getDetachedPreviewWindowData(previewId)
  })

  // 截图导出
  ipcMain.handle(
    IPC_CHANNELS.SCREENSHOT_CAPTURE,
    async (
      _,
      input: {
        html: string
        isDark: boolean
        width?: number
        mode: 'clipboard' | 'file'
        css?: string
        themeClass?: string
      }
    ) => {
      const { captureScreenshot } = await import('./lib/screenshot-service')
      return captureScreenshot(input)
    }
  )

  // 在系统默认浏览器中打开外部链接
  // —— 旧 handler 已迁移到下方合并版本（含 tutorial:// 哨兵支持） ——

  // 用系统默认应用打开任意文件（appName 需在 KNOWN_EDITORS 白名单内）
  ipcMain.handle(
    IPC_CHANNELS.SYSTEM_OPEN_FILE,
    async (
      _,
      filePath: string,
      appName?: string,
      access?: FileAccessOptions | string[]
    ): Promise<void> => {
      const { resolve } = await import('node:path')
      const absPath = resolve(filePath)
      const options = normalizeFileAccessOptions(access)
      if (!isPathAllowed(absPath, options)) {
        console.warn('[IPC] shell:system-open-file 拒绝越界路径:', absPath)
        return
      }
      if (process.platform === 'darwin') {
        const { spawnSync } = await import('node:child_process')
        if (appName) {
          if (!KNOWN_EDITORS.includes(appName)) {
            console.warn('[IPC] shell:system-open-file 拒绝未知应用:', appName)
            return
          }
          spawnSync('open', ['-a', appName, absPath], { timeout: 5000 })
        } else {
          spawnSync('open', [absPath], { timeout: 5000 })
        }
      } else {
        await shell.openPath(absPath)
      }
    }
  )

  // 扫描系统中的编辑器应用（仅 macOS）
  ipcMain.handle(
    IPC_CHANNELS.SCAN_EDITORS,
    async (): Promise<import('@tagent/shared').EditorApp[]> => {
      if (process.platform !== 'darwin') return []
      const { existsSync } = await import('node:fs')
      const { homedir } = await import('node:os')
      const home = homedir()

      const editors = KNOWN_EDITORS.map((name) => {
        const searchPaths =
          name === 'Xcode' || name === 'TextEdit'
            ? [`/Applications/${name}.app`]
            : [`/Applications/${name}.app`, `${home}/Applications/${name}.app`]
        return { name, paths: searchPaths }
      })

      return editors
        .filter((e) => e.paths.some((p) => existsSync(p)))
        .map((e) => ({ name: e.name, path: e.paths.find((p) => existsSync(p))! }))
    }
  )

  // 查询某个文件在本机的默认打开应用信息（带图标）
  ipcMain.handle(
    IPC_CHANNELS.GET_DEFAULT_APP_FOR_FILE,
    async (
      _,
      filePath: string,
      access?: FileAccessOptions | string[]
    ): Promise<import('@tagent/shared').DefaultAppInfo | null> => {
      if (!filePath || typeof filePath !== 'string') return null
      try {
        const options = normalizeFileAccessOptions(access)
        if (options && !isPathAllowed(filePath, options)) {
          console.warn('[IPC] shell:get-default-app-for-file 拒绝越界路径:', filePath)
          return null
        }
        console.log('[IPC] get-default-app-for-file 收到请求:', filePath)
        const result = await getDefaultAppInfoForFile(filePath, options)
        console.log(
          '[IPC] get-default-app-for-file 返回:',
          result
            ? `name=${result.name} appPath=${result.appPath} iconLen=${result.iconDataUrl?.length}`
            : 'null'
        )
        return result
      } catch (err) {
        console.warn('[IPC] shell:get-default-app-for-file 失败:', err)
        return null
      }
    }
  )

  // ===== 渠道管理相关 =====

  // 获取所有渠道（apiKey 保持加密态）
  ipcMain.handle(CHANNEL_IPC_CHANNELS.LIST, async (): Promise<Channel[]> => {
    return listChannels()
  })

  // 创建渠道
  ipcMain.handle(
    CHANNEL_IPC_CHANNELS.CREATE,
    async (_, input: ChannelCreateInput): Promise<Channel> => {
      return createChannel(input)
    }
  )

  // 更新渠道
  ipcMain.handle(
    CHANNEL_IPC_CHANNELS.UPDATE,
    async (_, id: string, input: ChannelUpdateInput): Promise<Channel> => {
      return updateChannel(id, input)
    }
  )

  // 删除渠道
  ipcMain.handle(CHANNEL_IPC_CHANNELS.DELETE, async (_, id: string): Promise<void> => {
    return deleteChannel(id)
  })

  // 解密 API Key（仅在用户查看时调用）
  ipcMain.handle(
    CHANNEL_IPC_CHANNELS.DECRYPT_KEY,
    async (_, channelId: string): Promise<string> => {
      return decryptApiKey(channelId)
    }
  )

  // 测试渠道连接
  ipcMain.handle(
    CHANNEL_IPC_CHANNELS.TEST,
    async (_, channelId: string): Promise<ChannelTestResult> => {
      return testChannel(channelId)
    }
  )

  // 直接测试连接（无需已保存渠道，传入明文凭证）
  ipcMain.handle(
    CHANNEL_IPC_CHANNELS.TEST_DIRECT,
    async (_, input: FetchModelsInput): Promise<ChannelTestResult> => {
      return testChannelDirect(input)
    }
  )

  // P0-2: 验证指定 model 名是否被供应商接受（防止 9120caac 那类 400 (2013)）
  ipcMain.handle(
    CHANNEL_IPC_CHANNELS.VALIDATE_MODEL,
    async (_, input: ChannelModelValidateInput): Promise<ChannelTestResult> => {
      return validateChannelModel(input)
    }
  )

  // 从供应商拉取可用模型列表（直接传入凭证，无需已保存渠道）
  ipcMain.handle(
    CHANNEL_IPC_CHANNELS.FETCH_MODELS,
    async (_, input: FetchModelsInput): Promise<FetchModelsResult> => {
      return fetchModels(input)
    }
  )

  // ===== 对话管理相关 =====

  // 获取对话列表
  ipcMain.handle(CHAT_IPC_CHANNELS.LIST_CONVERSATIONS, async (): Promise<ConversationMeta[]> => {
    return listConversations()
  })

  // 删除对话
  ipcMain.handle(CHAT_IPC_CHANNELS.DELETE_CONVERSATION, async (_, id: string): Promise<void> => {
    return deleteConversation(id)
  })

  // 在系统默认浏览器中打开本地教程页面（resources/index.html）
  // 教程已改为独立 HTML 页面，渲染端只发语义动作，路径与 file:// 协议由主进程拼接
  ipcMain.handle(
    IPC_CHANNELS.OPEN_EXTERNAL,
    async (_, url: string): Promise<{ opened: boolean; reason?: string }> => {
      // 渲染端传入 'tutorial://' 哨兵 → 替换为本地教程页面
      if (url === 'tutorial://') {
        const htmlPath = getTutorialHtmlPath()
        if (!htmlPath) {
          return { opened: false, reason: '教程文件不存在' }
        }
        // Windows 路径需 toFileURL 规范化（处理空格、中文）
        const { pathToFileURL } = await import('node:url')
        await shell.openExternal(pathToFileURL(htmlPath).toString())
        return { opened: true }
      }
      // 其他 URL 走原 http/https 逻辑
      if (!url || typeof url !== 'string') {
        console.warn('[IPC] shell:open-external 收到无效的 URL')
        return { opened: false, reason: '无效 URL' }
      }
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        console.warn('[IPC] shell:open-external 仅支持 http/https 协议:', url)
        return { opened: false, reason: '不支持的协议' }
      }
      await shell.openExternal(url)
      return { opened: true }
    }
  )

  // ===== 附件管理相关 =====

  // 读取附件（返回 base64）
  ipcMain.handle(
    CHAT_IPC_CHANNELS.READ_ATTACHMENT,
    async (_, localPath: string): Promise<string> => {
      return readAttachmentAsBase64(localPath)
    }
  )

  // 另存图片到用户选择的位置（原生 Save As 对话框）
  ipcMain.handle(
    CHAT_IPC_CHANNELS.SAVE_IMAGE_AS,
    async (event, localPath: string, defaultFilename: string): Promise<boolean> => {
      const { dialog, BrowserWindow } = await import('electron')
      const { writeFileSync } = await import('node:fs')
      const { extname: pathExtname } = await import('node:path')

      const win = BrowserWindow.fromWebContents(event.sender)
      const ext = pathExtname(defaultFilename).replace('.', '').toLowerCase()
      const filterMap: Record<string, string> = {
        jpg: 'JPEG',
        jpeg: 'JPEG',
        png: 'PNG',
        gif: 'GIF',
        webp: 'WebP',
        bmp: 'BMP',
      }
      const filterName = filterMap[ext] ?? 'Image'

      const result = await dialog.showSaveDialog(win ?? BrowserWindow.getFocusedWindow()!, {
        defaultPath: defaultFilename,
        filters: [
          { name: `${filterName} 图片`, extensions: [ext || 'png'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      })

      if (result.canceled || !result.filePath) return false

      const base64 = readAttachmentAsBase64(localPath)
      writeFileSync(result.filePath, Buffer.from(base64, 'base64'))
      return true
    }
  )

  // 打开文件选择对话框
  ipcMain.handle(CHAT_IPC_CHANNELS.OPEN_FILE_DIALOG, async (): Promise<FileDialogResult> => {
    return openFileDialog()
  })

  // ===== 用户档案相关 =====

  // 获取用户档案
  ipcMain.handle(USER_PROFILE_IPC_CHANNELS.GET, async (): Promise<UserProfile> => {
    return getUserProfile()
  })

  // 更新用户档案
  ipcMain.handle(
    USER_PROFILE_IPC_CHANNELS.UPDATE,
    async (_, updates: Partial<UserProfile>): Promise<UserProfile> => {
      return updateUserProfile(updates)
    }
  )

  // ===== 应用设置相关 =====

  // 获取应用设置
  ipcMain.handle(SETTINGS_IPC_CHANNELS.GET, async (): Promise<AppSettings> => {
    return getSettings()
  })

  // 更新应用设置
  ipcMain.handle(
    SETTINGS_IPC_CHANNELS.UPDATE,
    async (event, updates: Partial<AppSettings>): Promise<AppSettings> => {
      const result = await updateSettings(updates)

      if (updates.feishuSessionMirror !== undefined) {
        syncFeishuSyncSleepBlocker(result)
      }

      // 主题相关设置变化时，广播给所有窗口（跨窗口同步，如 Quick Task 面板）
      if (updates.themeMode !== undefined || updates.themeStyle !== undefined) {
        const payload = { themeMode: result.themeMode, themeStyle: result.themeStyle }
        BrowserWindow.getAllWindows().forEach((win) => {
          // 跳过发起者窗口，避免重复应用
          if (win.webContents.id !== event.sender.id) {
            win.webContents.send(SETTINGS_IPC_CHANNELS.ON_THEME_SETTINGS_CHANGED, payload)
          }
        })
      }

      return result
    }
  )

  // 同步更新应用设置（用于 beforeunload 场景）
  ipcMain.on(SETTINGS_IPC_CHANNELS.UPDATE_SYNC, (event, updates: Partial<AppSettings>) => {
    try {
      const result = updateSettings(updates)
      if (updates.feishuSessionMirror !== undefined) {
        syncFeishuSyncSleepBlocker(result)
      }
      event.returnValue = true
    } catch {
      event.returnValue = false
    }
  })

  // 获取系统主题（是否深色模式）
  ipcMain.handle(SETTINGS_IPC_CHANNELS.GET_SYSTEM_THEME, async (): Promise<boolean> => {
    return nativeTheme.shouldUseDarkColors
  })

  // 监听系统主题变化，推送给所有渲染进程窗口
  nativeTheme.on('updated', () => {
    const isDark = nativeTheme.shouldUseDarkColors
    console.log(`[设置] 系统主题变化: ${isDark ? '深色' : '浅色'}`)
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(SETTINGS_IPC_CHANNELS.ON_SYSTEM_THEME_CHANGED, isDark)
    })
  })

  // ===== 应用图标切换 =====

  ipcMain.handle(APP_ICON_IPC_CHANNELS.SET, async (_, variantId: string): Promise<boolean> => {
    try {
      // 解析图标文件路径
      const iconPath = resolveAppIconPath(variantId)
      if (!iconPath || !existsSync(iconPath)) {
        console.warn('[图标] 图标文件不存在:', iconPath)
        return false
      }

      // macOS: 设置 Dock 图标（squircle 蒙版）
      if (process.platform === 'darwin' && app.dock) {
        setMacDockIcon(iconPath)
      }

      // 持久化到设置
      await updateSettings({ appIconVariant: variantId })
      console.log(`[图标] 已切换到: ${variantId}`)
      return true
    } catch (error) {
      console.error('[图标] 切换失败:', error)
      return false
    }
  })

  // ===== Dock/Launcher 角标 =====

  ipcMain.handle(DOCK_BADGE_IPC_CHANNELS.SET_COUNT, async (_, count: number): Promise<boolean> => {
    return setDockBadgeCount(count)
  })

  // ===== 环境检测相关 =====

  // 执行环境检测
  ipcMain.handle(ENVIRONMENT_IPC_CHANNELS.CHECK, async (): Promise<EnvironmentCheckResult> => {
    const result = await checkEnvironment()
    // 自动保存检测结果到设置
    await updateSettings({
      lastEnvironmentCheck: result,
    })
    return result
  })

  // ===== 第三方安装包（Git / Node.js）相关 =====

  ipcMain.handle(INSTALLER_IPC_CHANNELS.MANIFEST, async (): Promise<InstallerManifest> => {
    return fetchInstallerManifest()
  })

  ipcMain.handle(
    INSTALLER_IPC_CHANNELS.DOWNLOAD,
    async (event, req: InstallerDownloadRequest): Promise<InstallerDownloadResult> => {
      const manifest = await fetchInstallerManifest()
      const source = findInstallerSource(manifest, req.id, req.arch)
      if (!source) {
        throw new Error(`未找到安装包：id=${req.id}, arch=${req.arch}`)
      }
      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window) {
        throw new Error('发起下载的窗口已关闭')
      }
      const key = `${req.id}:${req.arch}`
      return downloadInstaller(source, key, window)
    }
  )

  ipcMain.handle(INSTALLER_IPC_CHANNELS.CANCEL, async (_event, key: string): Promise<boolean> => {
    return cancelInstallerDownload(key)
  })

  ipcMain.handle(INSTALLER_IPC_CHANNELS.LAUNCH, async (_event, filePath: string): Promise<void> => {
    await launchInstaller(filePath)
  })

  // ===== 代理配置相关 =====

  // 获取代理配置
  ipcMain.handle(PROXY_IPC_CHANNELS.GET_SETTINGS, async (): Promise<ProxyConfig> => {
    return getProxySettings()
  })

  // 更新代理配置
  ipcMain.handle(
    PROXY_IPC_CHANNELS.UPDATE_SETTINGS,
    async (_, config: ProxyConfig): Promise<void> => {
      await saveProxySettings(config)
    }
  )

  // 检测系统代理
  ipcMain.handle(PROXY_IPC_CHANNELS.DETECT_SYSTEM, async (): Promise<SystemProxyDetectResult> => {
    return detectSystemProxy()
  })

  // ===== Agent 会话管理相关 =====

  // 获取 Agent 会话列表
  ipcMain.handle(
    AGENT_IPC_CHANNELS.LIST_SESSIONS,
    async (_, mode?: 'general' | 'ta'): Promise<AgentSessionMeta[]> => {
      const sessions = listAgentSessions(mode)
      // 启动所有已有附加目录的文件监听
      for (const session of sessions) {
        if (session.attachedDirectories) {
          for (const dir of session.attachedDirectories) {
            watchAttachedDirectory(dir)
          }
        }
      }
      return sessions
    }
  )

  // 创建 Agent 会话
  ipcMain.handle(
    AGENT_IPC_CHANNELS.CREATE_SESSION,
    async (
      _,
      title?: string,
      channelId?: string,
      workspaceId?: string,
      mode?: 'general' | 'ta'
    ): Promise<AgentSessionMeta> => {
      const session = createAgentSession(title, channelId, workspaceId, mode)
      feishuBridgeManager.ensureSessionMirror(session).catch((error) => {
        console.error('[飞书 Session 镜像] 新会话建群失败:', error)
      })
      return session
    }
  )

  // 获取 Agent 会话 SDKMessage（Phase 4 新格式）
  ipcMain.handle(
    AGENT_IPC_CHANNELS.GET_SDK_MESSAGES,
    async (_, id: string): Promise<SDKMessage[]> => {
      return getAgentSessionSDKMessages(id)
    }
  )

  // 更新 Agent 会话标题
  ipcMain.handle(
    AGENT_IPC_CHANNELS.UPDATE_TITLE,
    async (_, id: string, title: string): Promise<AgentSessionMeta> => {
      return updateAgentSessionMeta(id, { title })
    }
  )

  // 生成 Agent 会话标题
  ipcMain.handle(
    AGENT_IPC_CHANNELS.GENERATE_TITLE,
    async (_, input: AgentGenerateTitleInput): Promise<string | null> => {
      return generateAgentTitle(input)
    }
  )

  // P1-3: 客户端主动压缩会话（UI 按钮触发 / LLM 工具失败时 fallback）
  ipcMain.handle(
    AGENT_IPC_CHANNELS.COMPACT_SESSION,
    async (_, sessionId: string, input: CompactSessionInput): Promise<CompactSessionResult> => {
      const { compactSession } = await import('./lib/agent-session-compactor')
      return compactSession(sessionId, input)
    }
  )

  ipcMain.handle(
    AGENT_IPC_CHANNELS.GET_CONTEXT_USAGE,
    async (_, sessionId: string): Promise<import('@tagent/shared').GetContextUsageResponse> => {
      return getAgentContextUsage(sessionId)
    }
  )

  ipcMain.handle(
    AGENT_IPC_CHANNELS.GET_CONTEXT_USAGE_CACHED,
    (_, sessionId: string): import('@tagent/shared').GetContextUsageResponse => {
      return getAgentContextUsageCached(sessionId)
    }
  )

  // 删除 Agent 会话
  ipcMain.handle(AGENT_IPC_CHANNELS.DELETE_SESSION, async (_, id: string): Promise<void> => {
    // 清理权限服务中该会话的白名单
    permissionService.clearSessionWhitelist(id)
    permissionService.clearSessionPending(id)
    // 清理 AskUser 服务中的待处理请求
    askUserService.clearSessionPending(id)
    // 清理 ExitPlanMode 服务中的待处理请求
    exitPlanService.clearSessionPending(id)
    return deleteAgentSession(id)
  })

  // 迁移 Chat 对话记录到 Agent 会话
  ipcMain.handle(
    AGENT_IPC_CHANNELS.MIGRATE_CHAT_TO_AGENT,
    async (_, conversationId: string, agentSessionId: string): Promise<void> => {
      migrateChatToAgentSession(conversationId, agentSessionId)
    }
  )

  // 切换 Agent 会话置顶状态
  ipcMain.handle(
    AGENT_IPC_CHANNELS.TOGGLE_PIN,
    async (_, id: string): Promise<AgentSessionMeta> => {
      const sessions = listAgentSessions()
      const current = sessions.find((s) => s.id === id)
      if (!current) throw new Error(`Agent session not found: ${id}`)
      const newPinned = !current.pinned
      // 置顶时自动取消归档
      const updates: Partial<AgentSessionMeta> = { pinned: newPinned }
      if (newPinned && current.archived) {
        updates.archived = false
      }
      return updateAgentSessionMeta(id, updates)
    }
  )

  // 切换 Agent 会话手动工作中状态
  ipcMain.handle(
    AGENT_IPC_CHANNELS.TOGGLE_MANUAL_WORKING,
    async (_, id: string): Promise<AgentSessionMeta> => {
      const sessions = listAgentSessions()
      const current = sessions.find((s) => s.id === id)
      if (!current) throw new Error(`Agent session not found: ${id}`)
      const newManualWorking = !current.manualWorking
      const updates: Partial<AgentSessionMeta> = { manualWorking: newManualWorking }
      if (newManualWorking && current.archived) {
        updates.archived = false
      }
      return updateAgentSessionMeta(id, updates)
    }
  )

  // 确认 Agent 会话已完成（清除 completedButUnconfirmed 和 manualWorking）
  ipcMain.handle(
    AGENT_IPC_CHANNELS.CONFIRM_WORKING_DONE,
    async (_, id: string): Promise<AgentSessionMeta> => {
      const sessions = listAgentSessions()
      const current = sessions.find((s) => s.id === id)
      if (!current) throw new Error(`Agent session not found: ${id}`)
      const updates: Partial<AgentSessionMeta> = {}
      if (current.manualWorking) updates.manualWorking = false
      if (current.completedButUnconfirmed) updates.completedButUnconfirmed = false
      if (Object.keys(updates).length === 0) return current
      return updateAgentSessionMeta(id, updates)
    }
  )

  // 切换 Agent 会话归档状态
  ipcMain.handle(
    AGENT_IPC_CHANNELS.TOGGLE_ARCHIVE,
    async (_, id: string): Promise<AgentSessionMeta> => {
      const sessions = listAgentSessions()
      const current = sessions.find((s) => s.id === id)
      if (!current) throw new Error(`Agent session not found: ${id}`)
      const newArchived = !current.archived
      // 归档时自动取消置顶
      const updates: Partial<AgentSessionMeta> = { archived: newArchived }
      if (newArchived && current.pinned) {
        updates.pinned = false
      }
      return updateAgentSessionMeta(id, updates)
    }
  )

  // 搜索 Agent 会话消息内容
  ipcMain.handle(AGENT_IPC_CHANNELS.SEARCH_MESSAGES, async (_, query: string) => {
    return searchAgentSessionMessages(query)
  })

  // 搜索当前工作区可引用的 Agent 会话
  ipcMain.handle(
    AGENT_IPC_CHANNELS.SEARCH_SESSION_REFERENCES,
    async (_, input: AgentSessionReferenceSearchInput) => {
      return searchAgentSessionReferences(input)
    }
  )

  // 迁移 Agent 会话到另一个工作区
  ipcMain.handle(
    AGENT_IPC_CHANNELS.MOVE_SESSION_TO_WORKSPACE,
    async (_, input: MoveSessionToWorkspaceInput): Promise<AgentSessionMeta> => {
      // 渲染进程的 running 状态可能比主进程 activeSessions 清理更早变为 false
      // （STREAM_COMPLETE 在 finally 之前发送），短暂等待后重试一次
      if (isAgentSessionActive(input.sessionId)) {
        await new Promise((r) => setTimeout(r, 500))
        if (isAgentSessionActive(input.sessionId)) {
          throw new Error('会话正在运行中，请停止后再迁移')
        }
      }
      return moveSessionToWorkspace(input.sessionId, input.targetWorkspaceId)
    }
  )

  // 分叉 Agent 会话
  ipcMain.handle(
    AGENT_IPC_CHANNELS.FORK_SESSION,
    async (_, input: ForkSessionInput): Promise<AgentSessionMeta> => {
      return forkAgentSession(input)
    }
  )

  // 快照回退（同一会话内回退到指定点）
  ipcMain.handle(
    AGENT_IPC_CHANNELS.REWIND_SESSION,
    async (_, input: RewindSessionInput): Promise<RewindSessionResult> => {
      return rewindAgentSession(input.sessionId, input.assistantMessageUuid)
    }
  )

  // ===== Agent 工作区管理相关 =====

  // 确保默认工作区存在
  ensureDefaultWorkspace()

  // 获取 Agent 工作区列表
  ipcMain.handle(AGENT_IPC_CHANNELS.LIST_WORKSPACES, async (): Promise<AgentWorkspace[]> => {
    return listAgentWorkspaces()
  })

  // 创建 Agent 工作区
  ipcMain.handle(
    AGENT_IPC_CHANNELS.CREATE_WORKSPACE,
    async (_, name: string): Promise<AgentWorkspace> => {
      return createAgentWorkspace(name)
    }
  )

  // 创建项目工作区（用户选择本地代码目录）
  ipcMain.handle(
    AGENT_IPC_CHANNELS.CREATE_PROJECT_WORKSPACE,
    async (_, projectDirectory: string): Promise<AgentWorkspace> => {
      return createProjectWorkspace(projectDirectory)
    }
  )

  // 更新 Agent 工作区
  ipcMain.handle(
    AGENT_IPC_CHANNELS.UPDATE_WORKSPACE,
    async (_, id: string, updates: { name: string }): Promise<AgentWorkspace> => {
      return updateAgentWorkspace(id, updates)
    }
  )

  // 删除 Agent 工作区
  ipcMain.handle(AGENT_IPC_CHANNELS.DELETE_WORKSPACE, async (_, id: string): Promise<void> => {
    return deleteAgentWorkspace(id)
  })

  // 重排工作区顺序
  ipcMain.handle(
    AGENT_IPC_CHANNELS.REORDER_WORKSPACES,
    async (_, orderedIds: string[]): Promise<AgentWorkspace[]> => {
      return reorderAgentWorkspaces(orderedIds)
    }
  )

  // ===== 工作区能力（MCP + Skill） =====

  // 获取工作区能力摘要
  ipcMain.handle(
    AGENT_IPC_CHANNELS.GET_CAPABILITIES,
    async (_, workspaceSlug: string): Promise<WorkspaceCapabilities> => {
      return getWorkspaceCapabilities(workspaceSlug)
    }
  )

  // 获取工作区 MCP 配置
  ipcMain.handle(
    AGENT_IPC_CHANNELS.GET_MCP_CONFIG,
    async (_, workspaceSlug: string): Promise<WorkspaceMcpConfig> => {
      return getWorkspaceMcpConfig(workspaceSlug)
    }
  )

  // 保存工作区 MCP 配置
  ipcMain.handle(
    AGENT_IPC_CHANNELS.SAVE_MCP_CONFIG,
    async (_, workspaceSlug: string, config: WorkspaceMcpConfig): Promise<void> => {
      return saveWorkspaceMcpConfig(workspaceSlug, config)
    }
  )

  // 测试 MCP 服务器连接
  ipcMain.handle(
    AGENT_IPC_CHANNELS.TEST_MCP_SERVER,
    async (
      _,
      name: string,
      entry: import('@tagent/shared').McpServerEntry
    ): Promise<{ success: boolean; message: string }> => {
      const { validateMcpServer } = await import('./lib/mcp-validator')
      const result = await validateMcpServer(name, entry)
      return {
        success: result.valid,
        message: result.valid ? '连接成功' : result.reason || '连接失败',
      }
    }
  )

  // 获取工作区 Skill 列表（含活跃和不活跃，设置页 UI 用）
  ipcMain.handle(
    AGENT_IPC_CHANNELS.GET_SKILLS,
    async (_, workspaceSlug: string): Promise<SkillMeta[]> => {
      return getAllWorkspaceSkills(workspaceSlug)
    }
  )

  // 获取工作区 Skills 目录绝对路径
  ipcMain.handle(
    AGENT_IPC_CHANNELS.GET_SKILLS_DIR,
    async (_, workspaceSlug: string): Promise<string> => {
      return getWorkspaceSkillsDir(workspaceSlug)
    }
  )

  // 删除工作区 Skill
  ipcMain.handle(
    AGENT_IPC_CHANNELS.DELETE_SKILL,
    async (_, workspaceSlug: string, skillSlug: string): Promise<void> => {
      return deleteWorkspaceSkill(workspaceSlug, skillSlug)
    }
  )

  // 切换工作区 Skill 启用/禁用
  ipcMain.handle(
    AGENT_IPC_CHANNELS.TOGGLE_SKILL,
    async (_, workspaceSlug: string, skillSlug: string, enabled: boolean): Promise<void> => {
      return toggleWorkspaceSkill(workspaceSlug, skillSlug, enabled)
    }
  )

  // 插件商店：获取目录
  ipcMain.handle(
    AGENT_IPC_CHANNELS.GET_PLUGIN_STORE_CATALOG,
    async (): Promise<import('@tagent/shared').PluginStoreCatalog> => {
      return getPluginStoreCatalog()
    }
  )

  // 插件商店：安装 Skill
  ipcMain.handle(
    AGENT_IPC_CHANNELS.INSTALL_STORE_SKILL,
    async (_, workspaceSlug: string, skillSlug: string): Promise<SkillMeta> => {
      return installStoreSkill(workspaceSlug, skillSlug)
    }
  )

  // 插件商店：安装整合包
  ipcMain.handle(
    AGENT_IPC_CHANNELS.INSTALL_STORE_BUNDLE,
    async (
      _,
      workspaceSlug: string,
      bundleId: string
    ): Promise<import('@tagent/shared').InstallStoreBundleResult> => {
      return installStoreBundle(workspaceSlug, bundleId)
    }
  )

  ipcMain.handle(
    AGENT_IPC_CHANNELS.READ_SKILL_CONTENT,
    async (_, workspaceSlug: string, skillSlug: string): Promise<string> => {
      return readWorkspaceSkillContent(workspaceSlug, skillSlug)
    }
  )

  ipcMain.handle(
    AGENT_IPC_CHANNELS.WRITE_SKILL_CONTENT,
    async (_, workspaceSlug: string, skillSlug: string, content: string): Promise<void> => {
      writeWorkspaceSkillContent(workspaceSlug, skillSlug, content)
    }
  )

  // ===== Skill 子文件管理 =====

  ipcMain.handle(
    AGENT_IPC_CHANNELS.LIST_SKILL_FILES,
    async (_, workspaceSlug: string, skillSlug: string) => {
      return listSkillFiles(workspaceSlug, skillSlug)
    }
  )

  ipcMain.handle(
    AGENT_IPC_CHANNELS.READ_SKILL_FILE,
    async (_, workspaceSlug: string, skillSlug: string, relativePath: string) => {
      return readSkillFile(workspaceSlug, skillSlug, relativePath)
    }
  )

  ipcMain.handle(
    AGENT_IPC_CHANNELS.WRITE_SKILL_FILE,
    async (
      _,
      workspaceSlug: string,
      skillSlug: string,
      relativePath: string,
      content: string
    ): Promise<void> => {
      writeSkillFile(workspaceSlug, skillSlug, relativePath, content)
    }
  )

  ipcMain.handle(
    AGENT_IPC_CHANNELS.CREATE_SKILL_ENTRY,
    async (
      _,
      workspaceSlug: string,
      skillSlug: string,
      relativePath: string,
      type: 'file' | 'directory'
    ): Promise<void> => {
      createSkillEntry(workspaceSlug, skillSlug, relativePath, type)
    }
  )

  ipcMain.handle(
    AGENT_IPC_CHANNELS.DELETE_SKILL_ENTRY,
    async (_, workspaceSlug: string, skillSlug: string, relativePath: string): Promise<void> => {
      deleteSkillEntry(workspaceSlug, skillSlug, relativePath)
    }
  )

  ipcMain.handle(
    AGENT_IPC_CHANNELS.RENAME_SKILL_ENTRY,
    async (
      _,
      workspaceSlug: string,
      skillSlug: string,
      fromRelative: string,
      toRelative: string
    ): Promise<void> => {
      renameSkillEntry(workspaceSlug, skillSlug, fromRelative, toRelative)
    }
  )

  // 发送 Agent 消息（触发 Agent SDK 流式响应）
  ipcMain.handle(
    AGENT_IPC_CHANNELS.SEND_MESSAGE,
    async (event, input: AgentSendInput): Promise<void> => {
      const session = getAgentSessionMeta(input.sessionId)
      if (session) {
        await feishuBridgeManager.startSessionMirrorRun(session).catch((error) => {
          console.error('[飞书 Session 镜像] 流式卡片初始化失败:', error)
        })
      }
      await runAgent(input, event.sender)
    }
  )

  // 中止 Agent 执行
  ipcMain.handle(AGENT_IPC_CHANNELS.STOP_AGENT, async (_, sessionId: string): Promise<void> => {
    feishuBridgeManager.stopSessionMirrorRun(sessionId)
    stopAgent(sessionId)
  })

  // ===== Agent 队列消息 =====

  // 排队发送消息
  ipcMain.handle(
    AGENT_IPC_CHANNELS.QUEUE_MESSAGE,
    async (event, input: import('@tagent/shared').AgentQueueMessageInput): Promise<string> => {
      return queueAgentMessage(input, event.sender)
    }
  )

  // ===== Agent 后台任务管理 =====

  // 获取任务输出（保留接口，供未来扩展）
  ipcMain.handle(
    AGENT_IPC_CHANNELS.GET_TASK_OUTPUT,
    async (_event, _input: GetTaskOutputInput): Promise<GetTaskOutputResult> => {
      try {
        // TODO: 实现通过 SDK 的 TaskOutput 获取任务输出
        console.warn('[IPC] GET_TASK_OUTPUT: 当前版本暂未实现，返回空输出')
        return {
          output: '',
          isComplete: false,
        }
      } catch (error) {
        console.error('[IPC] 获取任务输出失败:', error)
        throw error
      }
    }
  )

  // ===== Agent 权限系统 =====

  // 响应权限请求
  ipcMain.handle(
    AGENT_IPC_CHANNELS.PERMISSION_RESPOND,
    async (event, response: PermissionResponse): Promise<void> => {
      const { requestId, behavior, alwaysAllow, addDirectories } = response
      const sessionId = permissionService.respondToPermission(
        requestId,
        behavior,
        alwaysAllow,
        addDirectories
      )

      // 发送 permission_resolved 事件给渲染进程
      if (sessionId) {
        // 持久化批准的目录到会话元数据
        if (addDirectories?.length) {
          try {
            const session = getAgentSessionMeta(sessionId)
            const existing = session?.attachedDirectories ?? []
            const merged = [...new Set([...existing, ...addDirectories])]
            updateAgentSessionMeta(sessionId, { attachedDirectories: merged })
          } catch (err) {
            console.error('[IPC] 持久化 addDirectories 失败:', err)
          }
        }

        event.sender.send(AGENT_IPC_CHANNELS.STREAM_EVENT, {
          sessionId,
          payload: {
            kind: 'tagent_event',
            event: { type: 'permission_resolved', requestId, behavior },
          },
        })
      }
    }
  )

  // 停止任务
  ipcMain.handle(AGENT_IPC_CHANNELS.STOP_TASK, async (_, input: StopTaskInput): Promise<void> => {
    try {
      if (input.type === 'shell') {
        console.warn('[IPC] STOP_TASK: Shell 任务停止功能待实现')
      } else {
        console.warn('[IPC] STOP_TASK: Agent 任务暂不支持单独停止')
      }
    } catch (error) {
      console.error('[IPC] 停止任务失败:', error)
      throw error
    }
  })

  // 热切换指定会话的权限模式（运行中生效，不广播）
  ipcMain.handle(
    AGENT_IPC_CHANNELS.UPDATE_SESSION_PERMISSION_MODE,
    async (_, sessionId: string, mode: TAgentPermissionMode): Promise<void> => {
      if (!isTAgentPermissionMode(mode)) {
        throw new Error(`无效的权限模式: ${mode}`)
      }
      // 会话不存在时直接抛错（避免 updateAgentSessionMeta 的通用异常被降级为 warn）
      if (!getAgentSessionMeta(sessionId)) {
        throw new Error(`Agent 会话不存在: ${sessionId}`)
      }
      // 持久化到 session meta（重启后可恢复，即使 session 未运行也要写）。
      // 这里的 catch 仅用于兜底磁盘 I/O 类异常，不影响后续热切换。
      try {
        updateAgentSessionMeta(sessionId, { permissionMode: mode })
      } catch (err) {
        console.warn(`[IPC] 持久化 session 权限模式失败: sessionId=${sessionId}`, err)
      }
      // 若 session 正在跑，同步热切换运行时模式
      if (isAgentSessionActive(sessionId)) {
        await updateAgentPermissionMode(sessionId, mode).catch((err) => {
          console.warn(`[IPC] 运行中权限模式切换失败: sessionId=${sessionId}`, err)
          throw err
        })
      }
    }
  )

  // 全局记忆配置
  ipcMain.handle(MEMORY_IPC_CHANNELS.GET_CONFIG, async (): Promise<MemoryConfig> => {
    return getMemoryConfig()
  })

  ipcMain.handle(MEMORY_IPC_CHANNELS.SET_CONFIG, async (_, config: MemoryConfig): Promise<void> => {
    setMemoryConfig(config)
  })

  ipcMain.handle(
    MEMORY_IPC_CHANNELS.TEST_CONNECTION,
    async (): Promise<{ success: boolean; message: string }> => {
      const config = getMemoryConfig()
      if (!config.apiKey) {
        return { success: false, message: '请先填写 API Key' }
      }
      try {
        const { searchMemory } = await import('./lib/memos-client')
        const result = await searchMemory(
          {
            apiKey: config.apiKey,
            userId: config.userId?.trim() || 'tagent-user',
            baseUrl: config.baseUrl,
          },
          'test connection',
          1
        )
        return {
          success: true,
          message: `连接成功，已检索到 ${result.facts.length} 条事实、${result.preferences.length} 条偏好`,
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        return { success: false, message: `连接失败: ${msg}` }
      }
    }
  )

  // ===== Nudge 机制 =====

  // 获取待处理的 Nudge 候选项
  ipcMain.handle(
    MEMORY_IPC_CHANNELS.GET_PENDING_NUDGES,
    async (_, sessionId: string): Promise<NudgeCandidate[]> => {
      const { nudgeService } = await import('./lib/nudge-service')
      // 从 nudgeService 获取候选项（实际由 turn_start 触发）
      return []
    }
  )

  // 响应 Nudge
  ipcMain.handle(
    MEMORY_IPC_CHANNELS.RESPOND_NUDGE,
    async (
      _,
      sessionId: string,
      nudgeId: string,
      action: 'accept' | 'reject' | 'defer',
      mode: 'general' | 'ta'
    ): Promise<void> => {
      const { nudgeService } = await import('./lib/nudge-service')
      await nudgeService.handleNudgeResponse(sessionId, nudgeId, action, mode)
    }
  )

  // ===== AskUserQuestion 交互式问答 =====

  // 响应 AskUser 请求
  ipcMain.handle(
    AGENT_IPC_CHANNELS.ASK_USER_RESPOND,
    async (event, response: AskUserResponse): Promise<void> => {
      const { requestId, answers } = response
      const sessionId = askUserService.respondToAskUser(requestId, answers)

      if (sessionId) {
        event.sender.send(AGENT_IPC_CHANNELS.STREAM_EVENT, {
          sessionId,
          payload: { kind: 'tagent_event', event: { type: 'ask_user_resolved', requestId } },
        })
      }
    }
  )

  // ===== ExitPlanMode 计划审批 =====

  // 响应 ExitPlanMode 请求
  ipcMain.handle(
    AGENT_IPC_CHANNELS.EXIT_PLAN_MODE_RESPOND,
    async (event, response: ExitPlanModeResponse): Promise<void> => {
      const result = exitPlanService.respondToExitPlanMode(response)

      if (result) {
        const { sessionId, targetMode } = result

        // 通知渲染进程请求已处理
        event.sender.send(AGENT_IPC_CHANNELS.STREAM_EVENT, {
          sessionId,
          payload: {
            kind: 'tagent_event',
            event: { type: 'exit_plan_mode_resolved', requestId: response.requestId },
          },
        })

        // 如果用户选择了新的权限模式，通知渲染进程更新 UI
        if (targetMode) {
          const meta = getAgentSessionMeta(sessionId)
          // 持久化到 session meta，和 cycleMode 路径保持一致（重启后该 session 能恢复）
          if (meta) {
            try {
              updateAgentSessionMeta(sessionId, { permissionMode: targetMode })
            } catch (err) {
              console.warn(
                `[IPC] ExitPlanMode 持久化 session 权限模式失败: sessionId=${sessionId}`,
                err
              )
            }
          }
          event.sender.send(AGENT_IPC_CHANNELS.STREAM_EVENT, {
            sessionId,
            payload: {
              kind: 'tagent_event',
              event: { type: 'permission_mode_changed', mode: targetMode },
            },
          })
          console.log(`[IPC] ExitPlanMode 权限模式切换: ${targetMode}`)
        }
      }
    }
  )

  // ===== 待处理请求恢复 =====

  // 获取所有待处理的交互请求快照（渲染进程重载后恢复状态）
  ipcMain.handle(
    AGENT_IPC_CHANNELS.GET_PENDING_REQUESTS,
    async (): Promise<import('@tagent/shared').PendingRequestsSnapshot> => {
      return {
        permissions: permissionService.getPendingRequests(),
        askUsers: askUserService.getPendingRequests(),
        exitPlans: exitPlanService.getPendingRequests(),
      }
    }
  )

  // ===== Agent 附件 =====

  // 保存文件到 Agent session 工作目录
  ipcMain.handle(
    AGENT_IPC_CHANNELS.SAVE_FILES_TO_SESSION,
    async (_, input: AgentSaveFilesInput): Promise<AgentSavedFile[]> => {
      return saveFilesToAgentSession(input)
    }
  )

  // 保存文件到工作区文件目录
  ipcMain.handle(
    AGENT_IPC_CHANNELS.SAVE_FILES_TO_WORKSPACE,
    async (_, input: AgentSaveWorkspaceFilesInput): Promise<AgentSavedFile[]> => {
      return saveFilesToWorkspaceFiles(input)
    }
  )

  // 获取工作区文件目录路径
  ipcMain.handle(
    AGENT_IPC_CHANNELS.GET_WORKSPACE_FILES_PATH,
    async (_, workspaceSlug: string): Promise<string> => {
      return getWorkspaceFilesDir(workspaceSlug)
    }
  )

  // 打开文件夹选择对话框
  ipcMain.handle(
    AGENT_IPC_CHANNELS.OPEN_FOLDER_DIALOG,
    async (): Promise<{ path: string; name: string } | null> => {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (!win) return null

      const result = await dialog.showOpenDialog(win, {
        properties: ['openDirectory'],
        title: '选择文件夹',
      })

      if (result.canceled || result.filePaths.length === 0) return null

      const folderPath = result.filePaths[0]!
      const name = folderPath.split('/').filter(Boolean).pop() || 'folder'
      return { path: folderPath, name }
    }
  )

  // 附加外部目录到 Agent 会话
  ipcMain.handle(
    AGENT_IPC_CHANNELS.ATTACH_DIRECTORY,
    async (_, input: AgentAttachDirectoryInput): Promise<string[]> => {
      const meta = getAgentSessionMeta(input.sessionId)
      if (!meta) throw new Error(`会话不存在: ${input.sessionId}`)

      const existing = meta.attachedDirectories ?? []
      if (existing.includes(input.directoryPath)) return existing

      const updated = [...existing, input.directoryPath]
      updateAgentSessionMeta(input.sessionId, { attachedDirectories: updated })
      // 启动附加目录文件监听
      watchAttachedDirectory(input.directoryPath)
      return updated
    }
  )

  // 移除会话的附加目录
  ipcMain.handle(
    AGENT_IPC_CHANNELS.DETACH_DIRECTORY,
    async (_, input: AgentAttachDirectoryInput): Promise<string[]> => {
      const meta = getAgentSessionMeta(input.sessionId)
      if (!meta) throw new Error(`会话不存在: ${input.sessionId}`)

      const existing = meta.attachedDirectories ?? []
      const updated = existing.filter((d) => d !== input.directoryPath)
      updateAgentSessionMeta(input.sessionId, { attachedDirectories: updated })
      // 停止附加目录文件监听
      unwatchAttachedDirectory(input.directoryPath)
      return updated
    }
  )

  // 附加外部文件到 Agent 会话
  ipcMain.handle(
    AGENT_IPC_CHANNELS.ATTACH_FILE,
    async (_, input: AgentAttachFileInput): Promise<string[]> => {
      const meta = getAgentSessionMeta(input.sessionId)
      if (!meta) throw new Error(`会话不存在: ${input.sessionId}`)

      const { realpathSync, statSync } = await import('node:fs')
      const { resolve } = await import('node:path')
      const safePath = realpathSync(resolve(input.filePath))
      const stats = statSync(safePath)
      if (!stats.isFile()) throw new Error('只能附加文件')

      const existing = meta.attachedFiles ?? []
      if (existing.includes(safePath)) return existing

      const updated = [...existing, safePath]
      updateAgentSessionMeta(input.sessionId, { attachedFiles: updated })
      return updated
    }
  )

  // 移除会话的附加文件
  ipcMain.handle(
    AGENT_IPC_CHANNELS.DETACH_FILE,
    async (_, input: AgentAttachFileInput): Promise<string[]> => {
      const meta = getAgentSessionMeta(input.sessionId)
      if (!meta) throw new Error(`会话不存在: ${input.sessionId}`)

      const existing = meta.attachedFiles ?? []
      const updated = existing.filter((f) => f !== input.filePath)
      updateAgentSessionMeta(input.sessionId, { attachedFiles: updated })
      return updated
    }
  )

  // 附加外部目录到工作区（所有会话可访问）
  ipcMain.handle(
    AGENT_IPC_CHANNELS.ATTACH_WORKSPACE_DIRECTORY,
    async (_, input: WorkspaceAttachDirectoryInput): Promise<string[]> => {
      const updated = attachWorkspaceDirectory(input.workspaceSlug, input.directoryPath)
      watchAttachedDirectory(input.directoryPath)
      return updated
    }
  )

  // 移除工作区的附加目录
  ipcMain.handle(
    AGENT_IPC_CHANNELS.DETACH_WORKSPACE_DIRECTORY,
    async (_, input: WorkspaceAttachDirectoryInput): Promise<string[]> => {
      const updated = detachWorkspaceDirectory(input.workspaceSlug, input.directoryPath)
      unwatchAttachedDirectory(input.directoryPath)
      return updated
    }
  )

  // 附加外部文件到工作区（所有会话可访问）
  ipcMain.handle(
    AGENT_IPC_CHANNELS.ATTACH_WORKSPACE_FILE,
    async (_, input: WorkspaceAttachFileInput): Promise<string[]> => {
      const { realpathSync, statSync } = await import('node:fs')
      const { resolve } = await import('node:path')
      const safePath = realpathSync(resolve(input.filePath))
      const stats = statSync(safePath)
      if (!stats.isFile()) throw new Error('只能附加文件')

      return attachWorkspaceFile(input.workspaceSlug, safePath)
    }
  )

  // 移除工作区的附加文件
  ipcMain.handle(
    AGENT_IPC_CHANNELS.DETACH_WORKSPACE_FILE,
    async (_, input: WorkspaceAttachFileInput): Promise<string[]> => {
      return detachWorkspaceFile(input.workspaceSlug, input.filePath)
    }
  )

  // 获取工作区附加目录列表
  ipcMain.handle(
    AGENT_IPC_CHANNELS.GET_WORKSPACE_DIRECTORIES,
    async (_, workspaceSlug: string): Promise<string[]> => {
      return getWorkspaceAttachedDirectories(workspaceSlug)
    }
  )

  // 获取工作区附加文件列表
  ipcMain.handle(
    AGENT_IPC_CHANNELS.GET_WORKSPACE_ATTACHED_FILES,
    async (_, workspaceSlug: string): Promise<string[]> => {
      return getWorkspaceAttachedFiles(workspaceSlug)
    }
  )

  // ===== Worktree 仓库配置管理 =====

  ipcMain.handle(AGENT_IPC_CHANNELS.GET_WORKTREE_REPOS, async (_, workspaceSlug: string) => {
    return getWorktreeRepos(workspaceSlug)
  })

  ipcMain.handle(
    AGENT_IPC_CHANNELS.ADD_WORKTREE_REPO,
    async (_, workspaceSlug: string, repo: import('@tagent/shared').WorkspaceWorktreeRepo) => {
      return addWorktreeRepo(workspaceSlug, repo)
    }
  )

  ipcMain.handle(
    AGENT_IPC_CHANNELS.REMOVE_WORKTREE_REPO,
    async (_, workspaceSlug: string, repoPath: string) => {
      return removeWorktreeRepo(workspaceSlug, repoPath)
    }
  )

  // ===== Agent 文件系统操作 =====

  // 获取 session 工作路径（project 模式下返回 projectDirectory）
  ipcMain.handle(
    AGENT_IPC_CHANNELS.GET_SESSION_PATH,
    async (_, workspaceId: string, sessionId: string): Promise<string | null> => {
      const ws = getAgentWorkspace(workspaceId)
      if (!ws) return null
      if (ws.projectDirectory) {
        return ws.projectDirectory
      }
      return getAgentSessionWorkspacePath(ws.slug, sessionId)
    }
  )

  // 列出目录内容（浅层，安全校验）
  ipcMain.handle(
    AGENT_IPC_CHANNELS.LIST_DIRECTORY,
    async (_, dirPath: string): Promise<FileEntry[]> => {
      const { readdirSync, statSync } = await import('node:fs')
      const { resolve } = await import('node:path')

      // 安全校验：路径必须在 agent-workspaces 目录下或项目目录下
      const safePath = resolve(dirPath)
      ensureWithinWorkspacesOrProjects(safePath)

      const entries: FileEntry[] = []
      const items = readdirSync(safePath, { withFileTypes: true })

      for (const item of items) {
        if (HIDDEN_FS_ENTRIES.has(item.name)) continue
        const fullPath = resolve(safePath, item.name)
        const isDirectory = item.isDirectory()
        const size = isDirectory ? undefined : statSync(fullPath).size
        entries.push({
          name: item.name,
          path: fullPath,
          isDirectory,
          size,
        })
      }

      // 目录在前，文件在后；隐藏文件（.开头）排在同类末尾，各自按名称排序
      entries.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        const aHidden = a.name.startsWith('.')
        const bHidden = b.name.startsWith('.')
        if (aHidden !== bHidden) return aHidden ? 1 : -1
        return a.name.localeCompare(b.name)
      })

      return entries
    }
  )

  // 删除文件或目录
  ipcMain.handle(AGENT_IPC_CHANNELS.DELETE_FILE, async (_, filePath: string): Promise<void> => {
    const { rmSync } = await import('node:fs')
    const { resolve } = await import('node:path')

    // 安全校验：路径必须在 agent-workspaces 目录下或项目目录下
    const safePath = resolve(filePath)
    ensureWithinWorkspacesOrProjects(safePath)

    rmSync(safePath, { recursive: true, force: true })
    console.log(`[Agent 文件] 已删除: ${safePath}`)
  })

  // 用系统默认应用打开文件
  ipcMain.handle(AGENT_IPC_CHANNELS.OPEN_FILE, async (_, filePath: string): Promise<void> => {
    const { resolve } = await import('node:path')

    const safePath = resolve(filePath)
    ensureWithinWorkspacesOrProjects(safePath)

    await shell.openPath(safePath)
  })

  // 将剪贴板文本写入临时预览文件
  ipcMain.handle(
    AGENT_IPC_CHANNELS.WRITE_CLIPBOARD_PREVIEW,
    async (_, filename: string, content: string): Promise<string> => {
      if (typeof filename !== 'string' || !filename) {
        throw new Error('filename 必须是非空字符串')
      }
      if (typeof content !== 'string') {
        throw new Error('content 必须是字符串')
      }

      const { isAbsolute, join, relative, resolve } = await import('node:path')
      const { tmpdir } = await import('node:os')
      const { existsSync, mkdirSync } = await import('node:fs')
      const { writeFile } = await import('node:fs/promises')

      const tmpDir = join(tmpdir(), 'tagent-preview')
      if (!existsSync(tmpDir)) {
        mkdirSync(tmpDir, { recursive: true })
      }

      // 安全文件名：替换路径分隔符和特殊字符，防止目录穿越
      const safeFilename = filename.replace(/[<>:"/\\|?*]/g, '_').replace(/^\.+/, '_')
      const tmpPath = resolve(tmpDir, safeFilename)

      // 确保 resolve 后的路径仍在 tmpDir 内，兼容 Windows 路径分隔符
      const relativePath = relative(tmpDir, tmpPath)
      if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
        throw new Error('文件名越界')
      }

      await writeFile(tmpPath, content, 'utf-8')
      console.log(`[IPC] clipboard 预览文件已写入: ${tmpPath}`)
      return tmpPath
    }
  )

  // 在系统文件管理器中显示文件
  ipcMain.handle(AGENT_IPC_CHANNELS.SHOW_IN_FOLDER, async (_, filePath: string): Promise<void> => {
    const { resolve } = await import('node:path')

    const safePath = resolve(filePath)
    ensureWithinWorkspacesOrProjects(safePath)

    shell.showItemInFolder(safePath)
  })

  // 解析文件路径并读取内容（供内联预览使用）
  ipcMain.handle(
    'file:resolve-and-read',
    async (
      _,
      filePath: string,
      access?: FileAccessOptions | string[]
    ): Promise<{ resolvedPath: string; content: string } | null> => {
      const { resolveAndReadFile, resolveFilePath } = await import('./lib/file-preview-service')
      const options = normalizeFileAccessOptions(access)
      const allowedBasePaths = getAllowedCandidateBasePaths(options)
      const resolved = resolveFilePath(filePath, allowedBasePaths)
      if (!resolved || !isPathAllowed(resolved, options)) {
        console.warn('[IPC] file:resolve-and-read 拒绝越界路径:', resolved ?? filePath)
        return null
      }
      const result = resolveAndReadFile(resolved)
      return result
    }
  )

  // 写入文本文件（供 Markdown 内联编辑使用）
  ipcMain.handle(
    'file:write-text',
    async (
      _,
      filePath: string,
      content: string,
      access?: FileAccessOptions | string[]
    ): Promise<boolean> => {
      if (typeof content !== 'string') return false
      const { writeFileSync } = await import('node:fs')
      const { resolveFilePath } = await import('./lib/file-preview-service')
      const options = normalizeFileAccessOptions(access)
      const allowedBasePaths = getAllowedCandidateBasePaths(options)
      const resolved = resolveFilePath(filePath, allowedBasePaths)
      if (!resolved || !isPathAllowed(resolved, options)) {
        console.warn('[IPC] file:write-text 拒绝越界路径:', resolved ?? filePath)
        return false
      }
      writeFileSync(resolved, content, 'utf-8')
      return true
    }
  )

  // 仅解析文件路径（供 PDF/图片等用 file:// 加载）
  ipcMain.handle(
    'file:resolve-path',
    async (
      _,
      filePath: string,
      access?: FileAccessOptions | string[]
    ): Promise<ResolvedFileUrl | null> => {
      const { resolveFilePath } = await import('./lib/file-preview-service')
      const options = normalizeFileAccessOptions(access)
      const result = resolveFilePath(filePath, getAllowedCandidateBasePaths(options))
      if (result && !isPathAllowed(result, options)) {
        console.warn('[IPC] file:resolve-path 拒绝越界路径:', result)
        return null
      }
      return result ? { url: registerTAgentFilePath(result) } : null
    }
  )

  // 为内联 PDF 预览生成临时 HTML 文件，返回文件路径
  ipcMain.handle(
    'file:prepare-pdf-preview',
    async (
      _,
      filePath: string,
      access?: FileAccessOptions | string[]
    ): Promise<{ tmpHtmlUrl: string } | null> => {
      const { preparePdfPreview, resolveFilePath } = await import('./lib/file-preview-service')
      const options = normalizeFileAccessOptions(access)
      const allowedBasePaths = getAllowedCandidateBasePaths(options)
      const resolved = resolveFilePath(filePath, allowedBasePaths)
      if (!resolved || !isPathAllowed(resolved, options)) {
        console.warn('[IPC] file:prepare-pdf-preview 拒绝越界路径:', resolved ?? filePath)
        return null
      }
      const result = await preparePdfPreview(resolved)
      return result ? { tmpHtmlUrl: result.tmpHtmlUrl } : null
    }
  )

  // DOCX 转 HTML（内联预览使用 mammoth）
  ipcMain.handle(
    'file:docx-to-html',
    async (
      _,
      filePath: string,
      access?: FileAccessOptions | string[]
    ): Promise<{ resolvedPath: string; html: string } | null> => {
      const { convertDocxToHtml, resolveFilePath } = await import('./lib/file-preview-service')
      const options = normalizeFileAccessOptions(access)
      const allowedBasePaths = getAllowedCandidateBasePaths(options)
      const resolved = resolveFilePath(filePath, allowedBasePaths)
      if (!resolved || !isPathAllowed(resolved, options)) {
        console.warn('[IPC] file:docx-to-html 拒绝越界路径:', resolved ?? filePath)
        return null
      }
      const result = await convertDocxToHtml(resolved)
      return result
    }
  )

  // XLSX/PPTX 转 HTML（内联预览使用 OOXML 解析）
  ipcMain.handle(
    'file:office-to-html',
    async (
      _,
      filePath: string,
      access?: FileAccessOptions | string[]
    ): Promise<import('@tagent/shared').OfficePreviewResult | null> => {
      const { convertOfficeToHtml, resolveFilePath } = await import('./lib/file-preview-service')
      const options = normalizeFileAccessOptions(access)
      const allowedBasePaths = getAllowedCandidateBasePaths(options)
      const resolved = resolveFilePath(filePath, allowedBasePaths)
      if (!resolved || !isPathAllowed(resolved, options)) {
        console.warn('[IPC] file:office-to-html 拒绝越界路径:', resolved ?? filePath)
        return null
      }
      return convertOfficeToHtml(resolved)
    }
  )

  // 读取文件为 base64（带路径校验，供内联图片预览等使用）
  ipcMain.handle(
    'file:read-binary-base64',
    async (
      _,
      filePath: string,
      access?: FileAccessOptions | string[],
      maxSize?: number
    ): Promise<string | null> => {
      const { readFileSync, statSync } = await import('node:fs')
      const { resolveFilePath } = await import('./lib/file-preview-service')
      const options = normalizeFileAccessOptions(access)
      const resolved = resolveFilePath(filePath, getAllowedCandidateBasePaths(options))
      if (!resolved || !isPathAllowed(resolved, options)) return null
      const st = statSync(resolved)
      if (maxSize && st.size > maxSize) return null
      return readFileSync(resolved).toString('base64')
    }
  )

  // 重命名文件/目录
  ipcMain.handle(
    AGENT_IPC_CHANNELS.RENAME_FILE,
    async (_, filePath: string, newName: string): Promise<void> => {
      const { renameSync } = await import('node:fs')
      const { resolve, dirname, join, sep } = await import('node:path')

      if (
        newName.includes('/') ||
        newName.includes('\\') ||
        newName.includes('..') ||
        newName.includes(sep)
      ) {
        throw new Error('文件名不能包含路径分隔符或 ".."')
      }

      const safePath = resolve(filePath)
      ensureWithinWorkspacesOrProjects(safePath)

      const newPath = join(dirname(safePath), newName)
      renameSync(safePath, newPath)
      console.log(`[Agent 文件] 已重命名: ${safePath} → ${newPath}`)
    }
  )

  // 移动文件/目录到目标目录
  ipcMain.handle(
    AGENT_IPC_CHANNELS.MOVE_FILE,
    async (_, filePath: string, targetDir: string): Promise<void> => {
      const { renameSync } = await import('node:fs')
      const { resolve, basename, join } = await import('node:path')

      const safePath = resolve(filePath)
      const safeTarget = resolve(targetDir)
      if (!isWithinWorkspacesOrProjects(safePath) || !isWithinWorkspacesOrProjects(safeTarget)) {
        throw new Error('访问路径超出 Agent 工作区范围')
      }

      const newPath = join(safeTarget, basename(safePath))
      renameSync(safePath, newPath)
      console.log(`[Agent 文件] 已移动: ${safePath} → ${newPath}`)
    }
  )

  // 列出附加目录内容
  ipcMain.handle(
    AGENT_IPC_CHANNELS.LIST_ATTACHED_DIRECTORY,
    async (_, dirPath: string, access?: FileAccessOptions | string[]): Promise<FileEntry[]> => {
      const { readdirSync, statSync } = await import('node:fs')
      const { resolve } = await import('node:path')

      const safePath = resolve(dirPath)
      const options = normalizeFileAccessOptions(access)
      if (!isPathAllowed(safePath, options)) {
        throw new Error('访问路径不在允许范围内')
      }
      const entries: FileEntry[] = []
      const items = readdirSync(safePath, { withFileTypes: true })

      for (const item of items) {
        if (HIDDEN_FS_ENTRIES.has(item.name)) continue
        const fullPath = resolve(safePath, item.name)
        const isDirectory = item.isDirectory()
        const size = isDirectory ? undefined : statSync(fullPath).size
        entries.push({
          name: item.name,
          path: fullPath,
          isDirectory,
          size,
        })
      }

      // 目录在前，文件在后；隐藏文件（.开头）排在同类末尾
      entries.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        const aHidden = a.name.startsWith('.')
        const bHidden = b.name.startsWith('.')
        if (aHidden !== bHidden) return aHidden ? 1 : -1
        return a.name.localeCompare(b.name)
      })

      return entries
    }
  )

  // 读取附加目录文件内容为 base64（限制在已附加目录范围内，用于侧面板添加到聊天）
  ipcMain.handle(
    AGENT_IPC_CHANNELS.READ_ATTACHED_FILE,
    async (_, filePath: string, sessionId?: string, workspaceSlug?: string): Promise<string> => {
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('无效的文件路径')
      }

      const { resolve, sep } = await import('node:path')
      const { readFile, stat, realpath } = await import('node:fs/promises')

      // 使用 realpath 解析符号链接，防止 symlink 绕过路径检查
      const safePath = await realpath(resolve(filePath)).catch(() => {
        throw new Error(`文件不存在: ${filePath}`)
      })

      // 收集所有允许的路径：会话/工作区附加目录、附加文件 + 工作区文件目录
      const allowedDirs: string[] = []
      const allowedFiles: string[] = []

      if (sessionId) {
        const meta = getAgentSessionMeta(sessionId)
        if (meta?.attachedDirectories) {
          allowedDirs.push(...meta.attachedDirectories)
        }
        if (meta?.attachedFiles) {
          allowedFiles.push(...meta.attachedFiles)
        }
      }
      if (workspaceSlug) {
        allowedDirs.push(...getWorkspaceAttachedDirectories(workspaceSlug))
        allowedFiles.push(...getWorkspaceAttachedFiles(workspaceSlug))
        allowedDirs.push(getWorkspaceFilesDir(workspaceSlug))
      }

      // 还允许访问 agent-workspaces 根目录下的文件（session 文件等）
      allowedDirs.push(getAgentWorkspacesDir())

      const resolvedAllowedDirs = await Promise.all(
        allowedDirs.map((dir) => realpath(resolve(dir)).catch(() => resolve(dir)))
      )
      const resolvedAllowedFiles = await Promise.all(
        allowedFiles.map((file) => realpath(resolve(file)).catch(() => resolve(file)))
      )
      const isAllowed =
        resolvedAllowedDirs.some((dir) => safePath.startsWith(dir + sep) || safePath === dir) ||
        resolvedAllowedFiles.some((file) => safePath === file)
      if (!isAllowed) {
        throw new Error('访问路径不在允许范围内')
      }

      const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB
      const fileStat = await stat(safePath).catch(() => null)
      if (!fileStat) {
        throw new Error(`文件不存在: ${filePath}`)
      }
      if (fileStat.size > MAX_FILE_SIZE) {
        throw new Error(`文件过大（${Math.round(fileStat.size / 1024 / 1024)}MB），最大支持 20MB`)
      }

      const buffer = await readFile(safePath)
      return buffer.toString('base64')
    }
  )

  // 在文件管理器中显示附加目录文件
  ipcMain.handle(
    AGENT_IPC_CHANNELS.SHOW_ATTACHED_IN_FOLDER,
    async (_, filePath: string, access?: FileAccessOptions | string[]): Promise<void> => {
      const { resolve } = await import('node:path')
      const safePath = resolve(filePath)
      const options = normalizeFileAccessOptions(access)
      if (!isPathAllowed(safePath, options)) {
        console.warn('[IPC] show-attached-in-folder 拒绝越界路径:', safePath)
        return
      }
      shell.showItemInFolder(safePath)
    }
  )

  // 重命名附加目录文件/目录
  ipcMain.handle(
    AGENT_IPC_CHANNELS.RENAME_ATTACHED_FILE,
    async (
      _,
      filePath: string,
      newName: string,
      access?: FileAccessOptions | string[]
    ): Promise<void> => {
      const { renameSync } = await import('node:fs')
      const { resolve, dirname, join, sep } = await import('node:path')

      if (
        newName.includes('/') ||
        newName.includes('\\') ||
        newName.includes('..') ||
        newName.includes(sep)
      ) {
        throw new Error('文件名不能包含路径分隔符或 ".."')
      }
      const safePath = resolve(filePath)
      const options = normalizeFileAccessOptions(access)
      if (!isPathAllowed(safePath, options)) {
        throw new Error('访问路径不在允许范围内')
      }
      const newPath = join(dirname(safePath), newName)
      renameSync(safePath, newPath)
      console.log(`[附加目录] 已重命名: ${safePath} → ${newPath}`)
    }
  )

  // 移动附加目录文件/目录
  ipcMain.handle(
    AGENT_IPC_CHANNELS.MOVE_ATTACHED_FILE,
    async (
      _,
      filePath: string,
      targetDir: string,
      access?: FileAccessOptions | string[]
    ): Promise<void> => {
      const { renameSync } = await import('node:fs')
      const { resolve, basename, join } = await import('node:path')

      const safePath = resolve(filePath)
      const safeTarget = resolve(targetDir)
      const options = normalizeFileAccessOptions(access)
      if (!isPathAllowed(safePath, options) || !isPathAllowed(safeTarget, options)) {
        throw new Error('访问路径不在允许范围内')
      }
      const newPath = join(safeTarget, basename(safePath))
      renameSync(safePath, newPath)
      console.log(`[附加目录] 已移动: ${safePath} → ${newPath}`)
    }
  )

  // 检查路径类型（文件 or 目录），用于拖拽检测
  ipcMain.handle(
    AGENT_IPC_CHANNELS.CHECK_PATHS_TYPE,
    async (_, paths: string[]): Promise<{ directories: string[]; files: string[] }> => {
      const { statSync } = await import('node:fs')
      const directories: string[] = []
      const files: string[] = []
      for (const p of paths) {
        try {
          const stat = statSync(p)
          if (stat.isDirectory()) {
            directories.push(p)
          } else {
            files.push(p)
          }
        } catch {
          // 无法访问的路径忽略
        }
      }
      return { directories, files }
    }
  )

  // 搜索工作区文件（用于 @ 引用，递归扫描，支持附加目录）
  ipcMain.handle(
    AGENT_IPC_CHANNELS.SEARCH_WORKSPACE_FILES,
    async (
      _,
      rootPath: string,
      query: string,
      limit = 20,
      additionalPaths?: string[],
      sessionPaths?: string[]
    ): Promise<FileSearchResult> => {
      const { readdirSync, statSync } = await import('node:fs')
      const { resolve, relative, basename } = await import('node:path')

      const safeRoot = resolve(rootPath)
      const ignoreDirs = new Set([
        'node_modules',
        '.git',
        'dist',
        '.next',
        '__pycache__',
        '.venv',
        'build',
        '.cache',
      ])
      const ignoreFiles = new Set([
        '.DS_Store',
        '.Spotlight-V100',
        '.Trashes',
        'Thumbs.db',
        'desktop.ini',
      ])
      const BROWSE_LIMIT_PER_GROUP = 2000
      const BROWSE_TOTAL_CAP = 3000

      // 按来源分组收集文件
      type Entry = {
        name: string
        path: string
        type: 'file' | 'dir'
        source: 'session' | 'workspace'
      }
      const rootEntries: Entry[] = []
      const workspaceEntries: Entry[] = []

      function scan(
        dir: string,
        depth: number,
        baseRoot: string,
        target: Entry[],
        useAbsPath: boolean,
        source: 'session' | 'workspace'
      ): void {
        if (depth > 10) return
        try {
          const items = readdirSync(dir, { withFileTypes: true })
          for (const item of items) {
            if (ignoreFiles.has(item.name)) continue
            if (item.isDirectory() && ignoreDirs.has(item.name)) continue

            const fullPath = resolve(dir, item.name)
            const entryPath = useAbsPath ? fullPath : relative(baseRoot, fullPath)
            target.push({
              name: item.name,
              path: entryPath,
              type: item.isDirectory() ? 'dir' : 'file',
              source,
            })

            if (item.isDirectory()) {
              scan(fullPath, depth + 1, baseRoot, target, useAbsPath, source)
            }
          }
        } catch {
          // 忽略无权限的目录
        }
      }

      function addAttachedPath(
        pathValue: string,
        target: Entry[],
        source: 'session' | 'workspace'
      ): void {
        try {
          const attachedPath = resolve(pathValue)
          const name = basename(attachedPath)
          if (ignoreFiles.has(name)) return

          const stats = statSync(attachedPath)
          if (stats.isFile()) {
            target.push({
              name,
              path: attachedPath,
              type: 'file',
              source,
            })
            return
          }

          if (!stats.isDirectory()) return
          if (ignoreDirs.has(name)) return

          target.push({
            name: name === 'workspace-files' ? '工作文件' : name,
            path: attachedPath,
            type: 'dir',
            source,
          })
          scan(attachedPath, 0, attachedPath, target, true, source)
        } catch {
          // 忽略不存在或无权限的附加路径
        }
      }

      // session 目录：相对路径
      scan(safeRoot, 0, safeRoot, rootEntries, false, 'session')

      // 会话级附加路径：绝对路径，标记为 session（归入会话文件分组）
      if (sessionPaths && sessionPaths.length > 0) {
        for (const sp of sessionPaths) {
          addAttachedPath(sp, rootEntries, 'session')
        }
      }

      // 工作区文件 + 工作区级附加路径：绝对路径，标记为 workspace
      if (additionalPaths && additionalPaths.length > 0) {
        for (const addPath of additionalPaths) {
          addAttachedPath(addPath, workspaceEntries, 'workspace')
        }
      }

      // 组内排序：目录优先，前缀匹配优先，路径短优先
      function sortGroup(entries: Entry[], q: string): void {
        entries.sort((a, b) => {
          const aStartsWith = a.name.toLowerCase().startsWith(q) ? 0 : 1
          const bStartsWith = b.name.toLowerCase().startsWith(q) ? 0 : 1
          if (aStartsWith !== bStartsWith) return aStartsWith - bStartsWith
          if (a.type === 'dir' && b.type !== 'dir') return -1
          if (a.type !== 'dir' && b.type === 'dir') return 1
          return a.path.length - b.path.length
        })
      }

      function matchEntries(entries: Entry[], q: string): Entry[] {
        return entries.filter((entry) => {
          const nameLower = entry.name.toLowerCase()
          const pathLower = entry.path.toLowerCase()
          if (nameLower.startsWith(q)) return true
          if (nameLower.includes(q) || pathLower.includes(q)) return true
          let qi = 0
          for (let i = 0; i < nameLower.length && qi < q.length; i++) {
            if (nameLower[i] === q[qi]) qi++
          }
          return qi === q.length
        })
      }

      // 目录优先排序：确保截断前所有目录（特别是顶层目录）排在前面
      function sortDirsFirst(entries: Entry[]): void {
        entries.sort((a, b) => {
          if (a.type === 'dir' && b.type !== 'dir') return -1
          if (a.type !== 'dir' && b.type === 'dir') return 1
          return a.path.length - b.path.length || a.name.localeCompare(b.name)
        })
      }

      const q = query.toLowerCase()

      if (!q) {
        // 空 query：目录优先排序后再截断，保证文件夹结构完整可见
        sortDirsFirst(rootEntries)
        sortDirsFirst(workspaceEntries)
        const maxPerGroup = Math.max(limit, BROWSE_LIMIT_PER_GROUP)
        const sessionSlice = rootEntries.slice(0, maxPerGroup)
        const workspaceSlice = workspaceEntries.slice(0, maxPerGroup)
        const combined = [...sessionSlice, ...workspaceSlice]
        const capped =
          combined.length > BROWSE_TOTAL_CAP ? combined.slice(0, BROWSE_TOTAL_CAP) : combined
        return {
          entries: capped,
          total: rootEntries.length + workspaceEntries.length,
          sessionEntries: sessionSlice,
          workspaceEntries: workspaceSlice,
        }
      }

      const sessionMatched = matchEntries(rootEntries, q)
      const workspaceMatched = matchEntries(workspaceEntries, q)
      sortGroup(sessionMatched, q)
      sortGroup(workspaceMatched, q)

      const totalMatched = sessionMatched.length + workspaceMatched.length
      let sessionSlice: Entry[]
      let workspaceSlice: Entry[]
      if (totalMatched <= limit) {
        sessionSlice = sessionMatched
        workspaceSlice = workspaceMatched
      } else {
        const sessionQuota = Math.max(
          sessionMatched.length > 0 ? 1 : 0,
          Math.round((limit * sessionMatched.length) / totalMatched)
        )
        const workspaceQuota = Math.max(workspaceMatched.length > 0 ? 1 : 0, limit - sessionQuota)
        sessionSlice = sessionMatched.slice(0, sessionQuota)
        workspaceSlice = workspaceMatched.slice(0, workspaceQuota)
      }

      return {
        entries: [...sessionSlice, ...workspaceSlice],
        total: sessionMatched.length + workspaceMatched.length,
        sessionEntries: sessionSlice,
        workspaceEntries: workspaceSlice,
      }
    }
  )

  // ===== 系统提示词管理 =====

  // 获取系统提示词配置
  ipcMain.handle(SYSTEM_PROMPT_IPC_CHANNELS.GET_CONFIG, async (): Promise<SystemPromptConfig> => {
    return getSystemPromptConfig()
  })

  // 创建提示词
  ipcMain.handle(
    SYSTEM_PROMPT_IPC_CHANNELS.CREATE,
    async (_, input: SystemPromptCreateInput): Promise<SystemPrompt> => {
      return createSystemPrompt(input)
    }
  )

  // 更新提示词
  ipcMain.handle(
    SYSTEM_PROMPT_IPC_CHANNELS.UPDATE,
    async (_, id: string, input: SystemPromptUpdateInput): Promise<SystemPrompt> => {
      return updateSystemPrompt(id, input)
    }
  )

  // 删除提示词
  ipcMain.handle(SYSTEM_PROMPT_IPC_CHANNELS.DELETE, async (_, id: string): Promise<void> => {
    return deleteSystemPrompt(id)
  })

  // 更新追加日期时间和用户名开关
  ipcMain.handle(
    SYSTEM_PROMPT_IPC_CHANNELS.UPDATE_APPEND_SETTING,
    async (_, enabled: boolean): Promise<void> => {
      return updateAppendSetting(enabled)
    }
  )

  // 设置默认提示词
  ipcMain.handle(
    SYSTEM_PROMPT_IPC_CHANNELS.SET_DEFAULT,
    async (_, id: string | null): Promise<void> => {
      return setDefaultPrompt(id)
    }
  )

  // ===== SOUL.md 人格定义 =====

  // 获取 SOUL.md 内容
  ipcMain.handle(
    SOUL_IPC_CHANNELS.GET_CONTENT,
    async (): Promise<{ content: string; isDefault: boolean }> => {
      const { existsSync, readFileSync } = require('node:fs')
      const { getSoulPath } = require('./lib/config-paths')

      const soulPath = getSoulPath()
      if (existsSync(soulPath)) {
        const content = readFileSync(soulPath, 'utf-8').trim()
        return { content, isDefault: false }
      }
      // 返回默认内容
      const { DEFAULT_SOUL_MD } = require('./lib/agent-prompt-builder')
      return { content: DEFAULT_SOUL_MD, isDefault: true }
    }
  )

  // 保存 SOUL.md 内容
  ipcMain.handle(SOUL_IPC_CHANNELS.SAVE_CONTENT, async (_, content: string): Promise<void> => {
    const { writeFileSync } = require('node:fs')
    const { getSoulPath } = require('./lib/config-paths')

    const soulPath = getSoulPath()
    writeFileSync(soulPath, content, 'utf-8')
    console.log(`[SOUL] 已保存 SOUL.md: ${soulPath}`)
  })

  // 重置为默认内容
  ipcMain.handle(SOUL_IPC_CHANNELS.RESET_DEFAULT, async (): Promise<string> => {
    const { writeFileSync } = require('node:fs')
    const { getSoulPath } = require('./lib/config-paths')
    const { DEFAULT_SOUL_MD } = require('./lib/agent-prompt-builder')

    const soulPath = getSoulPath()
    writeFileSync(soulPath, DEFAULT_SOUL_MD, 'utf-8')
    console.log(`[SOUL] 已重置 SOUL.md 为默认内容`)
    return DEFAULT_SOUL_MD
  })

  // ===== GitHub Release =====

  // 获取最新 Release
  ipcMain.handle(
    GITHUB_RELEASE_IPC_CHANNELS.GET_LATEST_RELEASE,
    async (): Promise<GitHubRelease | null> => {
      return getLatestRelease()
    }
  )

  // 获取 Release 列表
  ipcMain.handle(
    GITHUB_RELEASE_IPC_CHANNELS.LIST_RELEASES,
    async (_, options?: GitHubReleaseListOptions): Promise<GitHubRelease[]> => {
      return listGitHubReleases(options)
    }
  )

  // 获取指定版本的 Release
  ipcMain.handle(
    GITHUB_RELEASE_IPC_CHANNELS.GET_RELEASE_BY_TAG,
    async (_, tag: string): Promise<GitHubRelease | null> => {
      return getReleaseByTag(tag)
    }
  )

  // ===== 飞书集成 =====

  // --- 旧 API（向后兼容，操作 bots[0]）---

  // 获取飞书配置
  ipcMain.handle(FEISHU_IPC_CHANNELS.GET_CONFIG, async (): Promise<FeishuConfig> => {
    return getFeishuConfig()
  })

  // 获取解密后的 App Secret
  ipcMain.handle(FEISHU_IPC_CHANNELS.GET_DECRYPTED_SECRET, async (): Promise<string> => {
    return getDecryptedAppSecret()
  })

  // 保存飞书配置（旧格式，操作 bots[0]）
  ipcMain.handle(
    FEISHU_IPC_CHANNELS.SAVE_CONFIG,
    async (_, input: FeishuConfigInput): Promise<FeishuConfig> => {
      const config = saveFeishuConfig(input)
      // 配置变更后，重启对应的 Bot
      const multi = getFeishuMultiBotConfig()
      const firstBot = multi.bots[0]
      if (firstBot) {
        if (input.enabled && input.appId && input.appSecret) {
          await feishuBridgeManager.restartBot(firstBot.id)
        } else if (!input.enabled) {
          feishuBridgeManager.stopBot(firstBot.id)
        }
      }
      return config
    }
  )

  // 启动飞书 Bridge（旧格式，启动所有 Bot）
  ipcMain.handle(FEISHU_IPC_CHANNELS.START_BRIDGE, async (): Promise<void> => {
    await feishuBridgeManager.startAll()
  })

  // 停止飞书 Bridge（旧格式，停止所有 Bot）
  ipcMain.handle(FEISHU_IPC_CHANNELS.STOP_BRIDGE, async (): Promise<void> => {
    feishuBridgeManager.stopAll()
  })

  // 获取飞书 Bridge 状态（旧格式，返回第一个 Bot 状态）
  ipcMain.handle(FEISHU_IPC_CHANNELS.GET_STATUS, async (): Promise<FeishuBridgeState> => {
    const states = feishuBridgeManager.getStates()
    const first = Object.values(states.bots)[0]
    return first ?? { status: 'disconnected', activeBindings: 0 }
  })

  // --- 新 API（多 Bot v2）---

  // 获取多 Bot 配置
  ipcMain.handle(FEISHU_IPC_CHANNELS.GET_MULTI_CONFIG, async () => {
    return getFeishuMultiBotConfig()
  })

  // 保存单个 Bot 配置
  ipcMain.handle(
    FEISHU_IPC_CHANNELS.SAVE_BOT_CONFIG,
    async (_, input: import('@tagent/shared').FeishuBotConfigInput) => {
      const saved = saveFeishuBotConfig(input)
      // 配置变更后自动重启或停止（不阻塞保存结果）
      if (saved.enabled && saved.appId && saved.appSecret) {
        feishuBridgeManager.restartBot(saved.id).catch((err) => {
          console.error(`[飞书 IPC] Bot "${saved.name}" 重启失败:`, err)
        })
      } else {
        feishuBridgeManager.stopBot(saved.id)
      }
      return saved
    }
  )

  // 删除 Bot
  ipcMain.handle(FEISHU_IPC_CHANNELS.REMOVE_BOT, async (_, botId: string) => {
    feishuBridgeManager.stopBot(botId)
    return removeFeishuBot(botId)
  })

  // 获取单个 Bot 解密 Secret
  ipcMain.handle(FEISHU_IPC_CHANNELS.GET_BOT_DECRYPTED_SECRET, async (_, botId: string) => {
    return getDecryptedBotAppSecret(botId)
  })

  // 启动单个 Bot
  ipcMain.handle(FEISHU_IPC_CHANNELS.START_BOT, async (_, botId: string) => {
    await feishuBridgeManager.startBot(botId)
  })

  // 停止单个 Bot
  ipcMain.handle(FEISHU_IPC_CHANNELS.STOP_BOT, async (_, botId: string) => {
    feishuBridgeManager.stopBot(botId)
  })

  // 获取多 Bot 状态
  ipcMain.handle(FEISHU_IPC_CHANNELS.GET_MULTI_STATUS, async () => {
    return feishuBridgeManager.getStates()
  })

  // 测试飞书连接
  ipcMain.handle(
    FEISHU_IPC_CHANNELS.TEST_CONNECTION,
    async (_, appId: string, appSecret: string): Promise<FeishuTestResult> => {
      return feishuBridgeManager.testConnection(appId, appSecret)
    }
  )

  // 获取活跃绑定列表
  ipcMain.handle(FEISHU_IPC_CHANNELS.LIST_BINDINGS, async (): Promise<FeishuChatBinding[]> => {
    return feishuBridgeManager.listAllBindings()
  })

  // 更新绑定（工作区/会话）
  ipcMain.handle(
    FEISHU_IPC_CHANNELS.UPDATE_BINDING,
    async (_, input: FeishuUpdateBindingInput): Promise<FeishuChatBinding | null> => {
      const bridge = feishuBridgeManager.findBridgeByChatId(input.chatId)
      return bridge?.updateBinding(input) ?? null
    }
  )

  // 移除绑定
  ipcMain.handle(
    FEISHU_IPC_CHANNELS.REMOVE_BINDING,
    async (_, chatId: string): Promise<boolean> => {
      const bridge = feishuBridgeManager.findBridgeByChatId(chatId)
      return bridge?.removeBinding(chatId) ?? false
    }
  )

  // 上报用户在场状态
  ipcMain.handle(
    FEISHU_IPC_CHANNELS.REPORT_PRESENCE,
    async (_, report: FeishuPresenceReport): Promise<void> => {
      presenceService.updatePresence(report)
    }
  )

  // ===== 飞书扫码注册 =====

  /** 当前进行中的注册流程的 AbortController（同一时间只允许一个） */
  let activeRegisterAbort: AbortController | null = null

  ipcMain.handle(
    FEISHU_IPC_CHANNELS.REGISTER_APP_START,
    async (event): Promise<FeishuRegisterAppResult> => {
      // 同一时间只允许一个注册流程
      if (activeRegisterAbort) {
        activeRegisterAbort.abort()
      }
      const abort = new AbortController()
      activeRegisterAbort = abort

      try {
        const lark = await import('@larksuiteoapi/node-sdk')
        const QRCode = (await import('qrcode')).default
        const result = await lark.registerApp({
          source: 'tagent',
          signal: abort.signal,
          onQRCodeReady: async (info) => {
            if (event.sender.isDestroyed()) return
            try {
              const dataUrl = await QRCode.toDataURL(info.url, {
                width: 280,
                margin: 2,
                errorCorrectionLevel: 'M',
              })
              if (event.sender.isDestroyed()) return
              const payload: FeishuRegisterAppQRCode = {
                url: info.url,
                dataUrl,
                expireIn: info.expireIn,
              }
              event.sender.send(FEISHU_IPC_CHANNELS.REGISTER_APP_QRCODE, payload)
            } catch (err) {
              console.error('[飞书扫码注册] QRCode 生成失败:', err)
              if (event.sender.isDestroyed()) return
              // 兜底：仍把 url 发过去，渲染层可用浏览器打开
              event.sender.send(FEISHU_IPC_CHANNELS.REGISTER_APP_QRCODE, {
                url: info.url,
                dataUrl: '',
                expireIn: info.expireIn,
              })
            }
          },
          onStatusChange: (info) => {
            if (event.sender.isDestroyed()) return
            const payload: FeishuRegisterAppStatus = {
              status: info.status,
              interval: info.interval,
            }
            event.sender.send(FEISHU_IPC_CHANNELS.REGISTER_APP_STATUS, payload)
          },
        })
        return {
          appId: result.client_id,
          appSecret: result.client_secret,
          tenantBrand: result.user_info?.tenant_brand,
          operatorOpenId: result.user_info?.open_id,
        }
      } finally {
        if (activeRegisterAbort === abort) {
          activeRegisterAbort = null
        }
      }
    }
  )

  ipcMain.handle(FEISHU_IPC_CHANNELS.REGISTER_APP_CANCEL, async (): Promise<void> => {
    activeRegisterAbort?.abort()
    activeRegisterAbort = null
  })

  // ===== 钉钉集成 =====

  // 获取钉钉配置（旧 API，向后兼容）
  ipcMain.handle(DINGTALK_IPC_CHANNELS.GET_CONFIG, async (): Promise<DingTalkConfig> => {
    return getDingTalkConfig()
  })

  // 获取解密后的 Client Secret（旧 API，向后兼容）
  ipcMain.handle(DINGTALK_IPC_CHANNELS.GET_DECRYPTED_SECRET, async (): Promise<string> => {
    return getDecryptedClientSecret()
  })

  // 保存钉钉配置（旧 API，向后兼容）
  ipcMain.handle(
    DINGTALK_IPC_CHANNELS.SAVE_CONFIG,
    async (_, input: DingTalkConfigInput): Promise<DingTalkConfig> => {
      return saveDingTalkConfig(input)
    }
  )

  // 测试钉钉连接
  ipcMain.handle(
    DINGTALK_IPC_CHANNELS.TEST_CONNECTION,
    async (_, clientId: string, clientSecret: string): Promise<DingTalkTestResult> => {
      return dingtalkBridgeManager.testConnection(clientId, clientSecret)
    }
  )

  // 启动钉钉 Bridge（旧 API，启动第一个 Bot）
  ipcMain.handle(DINGTALK_IPC_CHANNELS.START_BRIDGE, async (): Promise<void> => {
    await dingtalkBridgeManager.startAll()
  })

  // 停止钉钉 Bridge（旧 API，停止所有 Bot）
  ipcMain.handle(DINGTALK_IPC_CHANNELS.STOP_BRIDGE, async (): Promise<void> => {
    dingtalkBridgeManager.stopAll()
  })

  // 获取钉钉 Bridge 状态（旧 API，返回第一个 Bot 状态）
  ipcMain.handle(DINGTALK_IPC_CHANNELS.GET_STATUS, async (): Promise<DingTalkBridgeState> => {
    const states = dingtalkBridgeManager.getStates()
    const first = Object.values(states.bots)[0]
    return first ?? { status: 'disconnected' }
  })

  // --- 钉钉多 Bot v2 API ---

  // 获取多 Bot 配置
  ipcMain.handle(DINGTALK_IPC_CHANNELS.GET_MULTI_CONFIG, async () => {
    return getDingTalkMultiBotConfig()
  })

  // 保存单个 Bot 配置
  ipcMain.handle(
    DINGTALK_IPC_CHANNELS.SAVE_BOT_CONFIG,
    async (_, input: import('@tagent/shared').DingTalkBotConfigInput) => {
      const saved = saveDingTalkBotConfig(input)
      // 配置变更后自动重启或停止（不阻塞保存结果）
      if (saved.enabled && saved.clientId && saved.clientSecret) {
        dingtalkBridgeManager.restartBot(saved.id).catch((err) => {
          console.error(`[钉钉 IPC] Bot "${saved.name}" 重启失败:`, err)
        })
      } else {
        dingtalkBridgeManager.stopBot(saved.id)
      }
      return saved
    }
  )

  // 删除 Bot
  ipcMain.handle(DINGTALK_IPC_CHANNELS.REMOVE_BOT, async (_, botId: string) => {
    dingtalkBridgeManager.stopBot(botId)
    return removeDingTalkBot(botId)
  })

  // 获取单个 Bot 解密 Secret
  ipcMain.handle(DINGTALK_IPC_CHANNELS.GET_BOT_DECRYPTED_SECRET, async (_, botId: string) => {
    return getDecryptedBotClientSecret(botId)
  })

  // 启动单个 Bot
  ipcMain.handle(DINGTALK_IPC_CHANNELS.START_BOT, async (_, botId: string) => {
    await dingtalkBridgeManager.startBot(botId)
  })

  // 停止单个 Bot
  ipcMain.handle(DINGTALK_IPC_CHANNELS.STOP_BOT, async (_, botId: string) => {
    dingtalkBridgeManager.stopBot(botId)
  })

  // 获取多 Bot 状态
  ipcMain.handle(DINGTALK_IPC_CHANNELS.GET_MULTI_STATUS, async () => {
    return dingtalkBridgeManager.getStates()
  })

  // ===== 微信集成 =====

  // 获取微信配置
  ipcMain.handle(WECHAT_IPC_CHANNELS.GET_CONFIG, async (): Promise<WeChatConfig> => {
    return getWeChatConfig()
  })

  // 开始扫码登录
  ipcMain.handle(WECHAT_IPC_CHANNELS.START_LOGIN, async (): Promise<void> => {
    await wechatBridge.startLogin()
  })

  // 登出
  ipcMain.handle(WECHAT_IPC_CHANNELS.LOGOUT, async (): Promise<void> => {
    wechatBridge.logout()
  })

  // 启动 Bridge（用已有凭证）
  ipcMain.handle(WECHAT_IPC_CHANNELS.START_BRIDGE, async (): Promise<void> => {
    await wechatBridge.start()
  })

  // 停止 Bridge
  ipcMain.handle(WECHAT_IPC_CHANNELS.STOP_BRIDGE, async (): Promise<void> => {
    wechatBridge.stop()
  })

  // 获取 Bridge 状态
  ipcMain.handle(WECHAT_IPC_CHANNELS.GET_STATUS, async (): Promise<WeChatBridgeState> => {
    return wechatBridge.getStatus()
  })

  // ===== WPS 协作集成 =====

  ipcMain.handle(
    WPS_IPC_CHANNELS.GET_CONFIG,
    async (): Promise<import('@tagent/shared').WpsConfig> => {
      return getWpsConfig()
    }
  )

  ipcMain.handle(WPS_IPC_CHANNELS.GET_DECRYPTED_SECRET, async (): Promise<string> => {
    return getDecryptedWpsSecretKey()
  })

  ipcMain.handle(
    WPS_IPC_CHANNELS.SAVE_CONFIG,
    async (
      _,
      input: import('@tagent/shared').WpsConfigInput
    ): Promise<import('@tagent/shared').WpsConfig> => {
      const saved = saveWpsConfig(input)
      if (saved.enabled && saved.appId && getDecryptedWpsSecretKey()) {
        await wpsBridge.start().catch((error) => {
          console.error('[WPS IPC] 配置保存后启动失败:', error)
        })
      } else {
        wpsBridge.stop()
      }
      return saved
    }
  )

  ipcMain.handle(
    WPS_IPC_CHANNELS.TEST_CONNECTION,
    async (
      _,
      appId: string,
      secretKey: string,
      apiUrl: string
    ): Promise<import('@tagent/shared').WpsTestResult> => {
      return wpsBridge.testConnection(appId, secretKey, apiUrl)
    }
  )

  ipcMain.handle(WPS_IPC_CHANNELS.START_BRIDGE, async (): Promise<void> => {
    await wpsBridge.start()
  })

  ipcMain.handle(WPS_IPC_CHANNELS.STOP_BRIDGE, async (): Promise<void> => {
    wpsBridge.stop()
  })

  ipcMain.handle(
    WPS_IPC_CHANNELS.GET_STATUS,
    async (): Promise<import('@tagent/shared').WpsBridgeState> => {
      return wpsBridge.getStatus()
    }
  )

  console.log('[IPC] IPC 处理器注册完成')

  // 注册更新 IPC 处理器
  registerUpdaterIpc()

  // 启动时清理不存在的附加目录/文件（如已删除的 worktree）
  try {
    cleanupStaleAttachedPaths()
    cleanupStaleWorkspaceAttachedPaths()
  } catch (error) {
    console.error('[启动清理] 清理失效附加路径失败:', error)
  }

  // ===== 存储管理 =====

  ipcMain.handle(STORAGE_IPC_CHANNELS.GET_STATS, async () => {
    return calculateStorageStats()
  })

  ipcMain.handle(STORAGE_IPC_CHANNELS.CLEANUP, async (_, options: CleanupOptions) => {
    return cleanupStorage(options)
  })

  ipcMain.handle(STORAGE_IPC_CHANNELS.CLEANUP_TEMP, async () => {
    return cleanupTempFiles()
  })

  // 迁移取消时清理临时解压目录
  ipcMain.handle('migration:cancelImport', async (_, tempDir: string) => {
    if (tempDir && existsSync(tempDir) && tempDir.includes('tagent-import-')) {
      rmSync(tempDir, { recursive: true, force: true })
      console.log(`[迁移] 已清理临时目录: ${tempDir}`)
    }
  })

  // 启动时自动清理临时文件
  const runStartupCleanup = async (): Promise<void> => {
    try {
      const settings = getSettings()
      if (settings.autoCleanupTempOnStart !== false) {
        const result = await cleanupTempFiles()
        if (result.freedBytes > 0) {
          console.log(
            `[存储清理] 启动时清理了 ${(result.freedBytes / 1024 / 1024).toFixed(1)} MB 临时文件`
          )
        }
      }
      const archiveDays = settings.autoCleanupArchivedDays ?? 0
      if (archiveDays > 0) {
        const result = await cleanupStorage({
          categories: ['agent-sessions', 'sdk-config'],
          orphansOnly: false,
          archivedBeforeDays: archiveDays,
        })
        if (result.freedBytes > 0) {
          console.log(
            `[存储清理] 启动时清理了 ${(result.freedBytes / 1024 / 1024).toFixed(1)} MB 归档数据`
          )
        }
      }
    } catch (e) {
      console.error('[存储清理] 启动时清理失败:', e)
    }
  }
  runStartupCleanup()

  // ===== 快速任务窗口 =====

  // 提交快速任务 → 隐藏窗口 + 转发到主窗口（由渲染进程创建会话并发送消息）
  ipcMain.handle(
    QUICK_TASK_IPC_CHANNELS.SUBMIT,
    async (_, input: QuickTaskSubmitInput): Promise<void> => {
      const { hideQuickTaskWindow } = await import('./lib/quick-task-window')
      const { getMainWindow } = await import('./index')
      hideQuickTaskWindow()

      const mainWin = getMainWindow()
      if (mainWin && !mainWin.isDestroyed()) {
        // 转发到主窗口渲染进程，由 GlobalShortcuts 创建会话并触发发送
        mainWin.webContents.send('quick-task:open-session', {
          mode: input.mode,
          text: input.text,
          files: input.files,
        })
        mainWin.show()
        mainWin.focus()
      }
    }
  )

  // 隐藏快速任务窗口
  ipcMain.handle(QUICK_TASK_IPC_CHANNELS.HIDE, async (): Promise<void> => {
    const { hideQuickTaskWindow } = await import('./lib/quick-task-window')
    hideQuickTaskWindow()
  })

  // 重新注册全局快捷键（设置中修改快捷键后调用）
  ipcMain.handle(
    QUICK_TASK_IPC_CHANNELS.REREGISTER_GLOBAL_SHORTCUTS,
    async (): Promise<Record<string, boolean>> => {
      const { reregisterAllGlobalShortcuts } = await import('./lib/global-shortcut-service')
      return reregisterAllGlobalShortcuts()
    }
  )

  // ===== 语音输入 =====

  ipcMain.handle(
    VOICE_DICTATION_IPC_CHANNELS.GET_SETTINGS,
    async (): Promise<VoiceDictationSettings> => {
      const { getVoiceDictationSettings } = await import('./lib/voice-dictation-settings-service')
      return getVoiceDictationSettings()
    }
  )

  ipcMain.handle(
    VOICE_DICTATION_IPC_CHANNELS.UPDATE_SETTINGS,
    async (_, updates: VoiceDictationSettingsUpdate): Promise<VoiceDictationSettings> => {
      const { updateVoiceDictationSettings } =
        await import('./lib/voice-dictation-settings-service')
      return updateVoiceDictationSettings(updates)
    }
  )

  ipcMain.handle(
    VOICE_DICTATION_IPC_CHANNELS.TEST_CONNECTION,
    async (_, updates?: VoiceDictationSettingsUpdate): Promise<VoiceDictationTestResult> => {
      const { getVoiceDictationSettings } = await import('./lib/voice-dictation-settings-service')
      const { testDoubaoAsrConnection } = await import('./lib/doubao-asr-service')
      const settings = { ...getVoiceDictationSettings(), ...(updates ?? {}) }
      return testDoubaoAsrConnection(settings)
    }
  )

  ipcMain.handle(VOICE_DICTATION_IPC_CHANNELS.TOGGLE, async (event): Promise<void> => {
    const { toggleVoiceDictationWindow } = await import('./lib/voice-dictation-window')
    const sourceWindow = BrowserWindow.fromWebContents(event.sender)
    toggleVoiceDictationWindow({ targetIsTAgent: !!sourceWindow })
  })

  ipcMain.handle(
    VOICE_DICTATION_IPC_CHANNELS.START,
    async (event, input: VoiceDictationStartInput): Promise<void> => {
      const { getVoiceDictationSettings } = await import('./lib/voice-dictation-settings-service')
      const { startDoubaoAsrSession } = await import('./lib/doubao-asr-service')
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) throw new Error('语音输入窗口不存在')
      await startDoubaoAsrSession(input.sessionId, getVoiceDictationSettings(), win)
    }
  )

  ipcMain.handle(
    VOICE_DICTATION_IPC_CHANNELS.SEND_AUDIO,
    async (_, input: VoiceDictationAudioChunkInput): Promise<void> => {
      const { sendDoubaoAsrAudio } = await import('./lib/doubao-asr-service')
      sendDoubaoAsrAudio(input.sessionId, input.data)
    }
  )

  ipcMain.handle(
    VOICE_DICTATION_IPC_CHANNELS.STOP,
    async (_, input: VoiceDictationStopInput): Promise<void> => {
      const { stopDoubaoAsrSession } = await import('./lib/doubao-asr-service')
      await stopDoubaoAsrSession(input.sessionId)
    }
  )

  ipcMain.handle(
    VOICE_DICTATION_IPC_CHANNELS.CANCEL,
    async (_, input: VoiceDictationStopInput): Promise<void> => {
      const { cancelDoubaoAsrSession } = await import('./lib/doubao-asr-service')
      cancelDoubaoAsrSession(input.sessionId)
    }
  )

  ipcMain.handle(
    VOICE_DICTATION_IPC_CHANNELS.COMMIT,
    async (_, input: VoiceDictationCommitInput): Promise<VoiceDictationCommitResult> => {
      const { getVoiceDictationSettings } = await import('./lib/voice-dictation-settings-service')
      const { commitVoiceDictationText } = await import('./lib/text-output-service')
      return commitVoiceDictationText(input.text, getVoiceDictationSettings())
    }
  )

  ipcMain.handle(VOICE_DICTATION_IPC_CHANNELS.HIDE, async (): Promise<void> => {
    const { hideVoiceDictationWindow } = await import('./lib/voice-dictation-window')
    hideVoiceDictationWindow()
  })

  ipcMain.handle(
    VOICE_DICTATION_IPC_CHANNELS.RESIZE,
    async (_, input: VoiceDictationResizeInput): Promise<void> => {
      const { resizeVoiceDictationWindow } = await import('./lib/voice-dictation-window')
      resizeVoiceDictationWindow(input.height)
    }
  )

  ipcMain.handle(
    VOICE_DICTATION_IPC_CHANNELS.CHECK_MIC_PERMISSION,
    async (): Promise<MicPermissionResult> => {
      const { checkMicrophonePermission } = await import('./lib/microphone-permission-service')
      return checkMicrophonePermission()
    }
  )

  ipcMain.handle(
    VOICE_DICTATION_IPC_CHANNELS.REQUEST_MIC_PERMISSION,
    async (): Promise<MicPermissionResult> => {
      const { requestMicrophonePermission } = await import('./lib/microphone-permission-service')
      return requestMicrophonePermission()
    }
  )

  // ===== 数据迁移 =====

  ipcMain.handle('migration:getExportPreview', async (_, workspaceId: string) => {
    const { getExportPreview } = await import('./lib/migration-service')
    return getExportPreview(workspaceId)
  })

  ipcMain.handle('migration:getShareExportPreview', async () => {
    const { getShareExportPreview } = await import('./lib/migration-service')
    return getShareExportPreview()
  })

  ipcMain.handle('migration:export', async (_, options) => {
    const { exportData } = await import('./lib/migration-service')
    return exportData(options)
  })

  ipcMain.handle('migration:exportV2', async (_, options) => {
    const { exportDataV2 } = await import('./lib/migration-service')
    return exportDataV2(options)
  })

  ipcMain.handle('migration:parseImportFile', async (_, filePath: string) => {
    const { parseImportFile } = await import('./lib/migration-service')
    return parseImportFile(filePath)
  })

  ipcMain.handle('migration:confirmImport', async (_, options) => {
    const { confirmImport } = await import('./lib/migration-service')
    return confirmImport(options)
  })

  ipcMain.handle('migration:openFileDialog', async () => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog({
      title: '选择迁移文件',
      filters: [
        { name: 'TAgent 迁移文件', extensions: ['tagent-backup', 'tagent-share'] },
        { name: '所有文件', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('migration:saveFileDialog', async (_, mode: string) => {
    const { dialog } = await import('electron')
    const ext = mode === 'personal' ? 'tagent-backup' : 'tagent-share'
    const defaultName = `tagent-migration-${new Date().toISOString().slice(0, 10)}.${ext}`
    const result = await dialog.showSaveDialog({
      title: '保存迁移文件',
      defaultPath: defaultName,
      filters: [
        { name: mode === 'personal' ? 'TAgent 个人备份' : 'TAgent 分享包', extensions: [ext] },
      ],
    })
    return result.canceled ? null : result.filePath
  })

  // ===== 窗口控制（Windows 自定义标题栏按钮）=====

  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) win.minimize()
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      win.isMaximized() ? win.unmaximize() : win.maximize()
    }
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) win.close()
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win && !win.isDestroyed() ? win.isMaximized() : false
  })

  // ===== 窗口关闭确认 =====

  ipcMain.on(WINDOW_CLOSE_IPC_CHANNELS.RESPONSE, (_event, data: WindowCloseResponseData) => {
    console.info('[WindowClose] 收到 close-response:', data)
    const { action, remember } = data
    if (remember) {
      updateSettings({ closeAction: action })
      console.info('[WindowClose] 已保存 closeAction:', action)
    }
    if (action === 'quit') {
      requestApplicationQuit()
    } else {
      const win = BrowserWindow.getAllWindows()[0]
      if (win && !win.isDestroyed()) win.hide()
    }
  })

  // ===== TA MCP Server 管理 =====

  ipcMain.handle(AGENT_IPC_CHANNELS.GET_TA_MCP_STATUS, async () => {
    const { getTAMcpServerStatus } = await import('./lib/ta-mcp-service')
    return getTAMcpServerStatus()
  })

  ipcMain.handle(AGENT_IPC_CHANNELS.IS_TA_MCP_CONFIGURED, async (_, workspaceSlug: string) => {
    const { isTAMcpConfigured } = await import('./lib/ta-mcp-service')
    return isTAMcpConfigured(workspaceSlug)
  })

  ipcMain.handle(AGENT_IPC_CHANNELS.ENABLE_TA_MCP, async (_, workspaceSlug: string) => {
    const { enableTAMcpForWorkspace } = await import('./lib/ta-mcp-service')
    return enableTAMcpForWorkspace(workspaceSlug)
  })

  ipcMain.handle(AGENT_IPC_CHANNELS.DISABLE_TA_MCP, async (_, workspaceSlug: string) => {
    const { disableTAMcpForWorkspace } = await import('./lib/ta-mcp-service')
    return disableTAMcpForWorkspace(workspaceSlug)
  })

  // 一键安装 TA MCP Server（推流日志通过 TA_INSTALL_LOG 推给 renderer）
  ipcMain.handle(
    AGENT_IPC_CHANNELS.INSTALL_TA_MCP,
    async (event, options?: { forceOnline?: boolean }) => {
      const { installTAMcpServer } = await import('./lib/ta-mcp-service')
      return installTAMcpServer((chunk) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(AGENT_IPC_CHANNELS.TA_INSTALL_LOG, chunk)
        }
      }, options || {})
    }
  )

  // 取消正在进行的安装
  ipcMain.handle(AGENT_IPC_CHANNELS.CANCEL_TA_MCP_INSTALL, async () => {
    const { cancelTAMcpInstall } = await import('./lib/ta-mcp-service')
    cancelTAMcpInstall()
    return true
  })

  // 获取安装任务当前状态
  ipcMain.handle(AGENT_IPC_CHANNELS.GET_TA_INSTALL_PROGRESS, async () => {
    const { getInstallState } = await import('./lib/ta-mcp-service')
    return { state: getInstallState() }
  })

  // ===== kscc 内网渠道 =====

  ipcMain.handle(AGENT_IPC_CHANNELS.CHECK_KSCC_READINESS, async () => {
    const { checkKsccInstallReadiness } = await import('./lib/kscc-service')
    return checkKsccInstallReadiness()
  })

  ipcMain.handle(AGENT_IPC_CHANNELS.GET_KSCC_STATUS, async () => {
    const { getKsccStatus } = await import('./lib/kscc-service')
    return getKsccStatus()
  })

  ipcMain.handle(AGENT_IPC_CHANNELS.REFRESH_KSCC_STATUS, async () => {
    const { clearKsccCache, checkKsccInstallReadiness } = await import('./lib/kscc-service')
    clearKsccCache()
    return checkKsccInstallReadiness()
  })

  // ===== ModeManager 模式管理 =====

  ipcMain.handle(AGENT_IPC_CHANNELS.GET_MODE_STATUS, async () => {
    const { ModeManager } = await import('./lib/mode-manager')
    return ModeManager.getStatusSummary()
  })

  ipcMain.handle(
    AGENT_IPC_CHANNELS.SWITCH_MODE,
    async (
      _,
      request: {
        targetMode: 'general' | 'ta'
        source: 'user-click' | 'switch-tool' | 'api'
        force?: boolean
        reason?: string
        contextSummary?: string
      }
    ) => {
      const { ModeManager } = await import('./lib/mode-manager')
      return ModeManager.switchMode(request)
    }
  )

  ipcMain.handle(
    AGENT_IPC_CHANNELS.REGISTER_BACKGROUND_TASK,
    async (_, task: { id: string; mode: 'general' | 'ta'; description: string }) => {
      const { ModeManager } = await import('./lib/mode-manager')
      return ModeManager.registerBackgroundTask(task)
    }
  )

  ipcMain.handle(
    AGENT_IPC_CHANNELS.COMPLETE_BACKGROUND_TASK,
    async (_, taskId: string, mode: 'general' | 'ta') => {
      const { ModeManager } = await import('./lib/mode-manager')
      return ModeManager.completeBackgroundTask(taskId, mode)
    }
  )

  // ModeManager 事件转发到 Renderer
  const setupModeManagerForwarding = async (): Promise<void> => {
    const { ModeManager } = await import('./lib/mode-manager')

    ModeManager.on('mode-changed', (data: { previousMode: string; currentMode: string }) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) {
        win.webContents.send(AGENT_IPC_CHANNELS.MODE_CHANGED, data)
      }
    })

    ModeManager.on('task-notification', (data: { mode: string; message: string }) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) {
        win.webContents.send(AGENT_IPC_CHANNELS.TASK_NOTIFICATION, data)
      }
    })
  }

  // 在应用启动时调用
  setupModeManagerForwarding().catch(console.error)

  // ===== 资产库 IPC handlers =====

  ipcMain.handle(AGENT_IPC_CHANNELS.INIT_ASSET_STORE, async () => {
    const { assetStoreService } = await import('./lib/asset-store')
    return assetStoreService.initialize()
  })

  ipcMain.handle(AGENT_IPC_CHANNELS.CREATE_ASSET_STORE_DATABASE, async () => {
    const { assetStoreService } = await import('./lib/asset-store')
    return assetStoreService.createDatabase()
  })

  ipcMain.handle(AGENT_IPC_CHANNELS.GET_ASSET_STORE_STATUS, async () => {
    const { assetStoreService } = await import('./lib/asset-store')
    return {
      available: assetStoreService.isAvailable(),
      dbPath: assetStoreService.getDbPath(),
    }
  })

  ipcMain.handle(AGENT_IPC_CHANNELS.LIST_ASSETS, async (_, params) => {
    const { assetStoreService } = await import('./lib/asset-store')
    return assetStoreService.listAssets(params)
  })

  ipcMain.handle(AGENT_IPC_CHANNELS.SEARCH_ASSETS, async (_, params) => {
    const { assetStoreService } = await import('./lib/asset-store')
    return assetStoreService.searchAssets(params)
  })

  ipcMain.handle(AGENT_IPC_CHANNELS.GET_ASSET_DETAIL, async (_, assetId: string) => {
    const { assetStoreService } = await import('./lib/asset-store')
    return assetStoreService.getAssetById(assetId)
  })

  ipcMain.handle(AGENT_IPC_CHANNELS.GET_ASSET_STORE_STATS, async () => {
    const { assetStoreService } = await import('./lib/asset-store')
    return assetStoreService.getStats()
  })

  ipcMain.handle(AGENT_IPC_CHANNELS.LIST_PROJECTS, async () => {
    const { assetStoreService } = await import('./lib/asset-store')
    return assetStoreService.listProjects()
  })

  ipcMain.handle(AGENT_IPC_CHANNELS.GET_REVIEW_QUEUE, async (_, params) => {
    const { assetStoreService } = await import('./lib/asset-store')
    return assetStoreService.getReviewQueue(params)
  })

  ipcMain.handle(AGENT_IPC_CHANNELS.GET_REVIEW_STATS, async () => {
    const { assetStoreService } = await import('./lib/asset-store')
    return assetStoreService.getReviewStats()
  })

  // ===== 记忆层 IPC handlers =====

  ipcMain.handle(AGENT_IPC_CHANNELS.INIT_MEMORY_LAYERS, async () => {
    const { memoryLayerService } = await import('./lib/memory-layer-service')
    return memoryLayerService.initialize()
  })

  ipcMain.handle(AGENT_IPC_CHANNELS.GET_MEMORY_STATS, async (_, mode: 'general' | 'ta') => {
    const { memoryLayerService } = await import('./lib/memory-layer-service')
    return memoryLayerService.getStats(mode)
  })

  ipcMain.handle(
    AGENT_IPC_CHANNELS.SEARCH_MEMORY_SESSIONS,
    async (_, mode: 'general' | 'ta', query: string, limit?: number) => {
      const { memoryLayerService } = await import('./lib/memory-layer-service')
      return memoryLayerService.searchSessions(mode, query, limit)
    }
  )

  ipcMain.handle(
    AGENT_IPC_CHANNELS.LIST_RECENT_MEMORY_SESSIONS,
    async (_, mode: 'general' | 'ta', limit?: number) => {
      const { memoryLayerService } = await import('./lib/memory-layer-service')
      return memoryLayerService.listRecentSessions(mode, limit)
    }
  )

  ipcMain.handle(
    AGENT_IPC_CHANNELS.GET_MEMORY_MD_CONTENT,
    async (_, mode: 'general' | 'ta', layer: 'L0' | 'L1' | 'L2' | 'L5') => {
      const { memoryLayerService } = await import('./lib/memory-layer-service')
      return memoryLayerService.getMdContent(mode, layer)
    }
  )

  ipcMain.handle(
    AGENT_IPC_CHANNELS.GET_MEMORY_CORRECTIONS,
    async (_, mode: 'general' | 'ta', limit?: number) => {
      const { memoryLayerService } = await import('./lib/memory-layer-service')
      return memoryLayerService.getCorrections(mode, limit)
    }
  )

  // ===== Pipeline 流水线相关 =====

  // 获取流水线列表
  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.LIST,
    async (_, query?: import('@tagent/shared').PipelineListQuery) => {
      const { listPipelineRuns } = await import('./lib/pipeline-service')
      return listPipelineRuns(query)
    }
  )

  // 获取单个流水线
  ipcMain.handle(PIPELINE_IPC_CHANNELS.GET, async (_, id: string) => {
    const { getPipelineRun } = await import('./lib/pipeline-service')
    return getPipelineRun(id)
  })

  // 创建流水线
  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.CREATE,
    async (_, request: import('@tagent/shared').CreatePipelineRunRequest) => {
      const { createPipelineRun } = await import('./lib/pipeline-service')
      return createPipelineRun(request)
    }
  )

  // 更新流水线
  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.UPDATE,
    async (_, id: string, request: import('@tagent/shared').UpdatePipelineRunRequest) => {
      const { updatePipelineRun } = await import('./lib/pipeline-service')
      return updatePipelineRun(id, request)
    }
  )

  // 取消流水线
  ipcMain.handle(PIPELINE_IPC_CHANNELS.CANCEL, async (_, id: string) => {
    const { cancelPipelineRun } = await import('./lib/pipeline-service')
    return cancelPipelineRun(id)
  })

  // 获取流水线统计摘要
  ipcMain.handle(PIPELINE_IPC_CHANNELS.SUMMARY, async () => {
    const { getPipelineSummary } = await import('./lib/pipeline-service')
    return getPipelineSummary()
  })

  // 清理已完成的流水线记录
  ipcMain.handle(PIPELINE_IPC_CHANNELS.CLEANUP, async (_, daysToKeep?: number) => {
    const { cleanupPipelineRuns } = await import('./lib/pipeline-service')
    return cleanupPipelineRuns(daysToKeep)
  })

  // 使用统计
  ipcMain.handle(USAGE_STATS_IPC_CHANNELS.GET_OVERVIEW, async () => {
    const { usageStatsService } = await import('./lib/usage-stats-service')
    return usageStatsService.getOverview()
  })

  ipcMain.handle(
    USAGE_STATS_IPC_CHANNELS.GET_SESSION_TOKEN_STATS,
    async (_event, sessionId: string) => {
      const { usageStatsService } = await import('./lib/usage-stats-service')
      return usageStatsService.getSessionTokenStats(sessionId)
    }
  )

  ipcMain.handle(
    USAGE_STATS_IPC_CHANNELS.GET_SESSION_CONTEXT_STATUS,
    async (_event, sessionId: string) => {
      const { usageStatsService } = await import('./lib/usage-stats-service')
      return usageStatsService.getSessionContextStatus(sessionId)
    }
  )

  // ===== Btw 侧面提问 =====

  ipcMain.handle(
    BTW_IPC_CHANNELS.SEND_BTW,
    async (
      _event,
      input: { channelId: string; modelId: string; message: string; messageId: string }
    ) => {
      const { sendBtwMessage } = await import('./lib/btw-service')
      return sendBtwMessage(input)
    }
  )

  ipcMain.handle(BTW_IPC_CHANNELS.CANCEL_BTW, async () => {
    const { cancelBtw } = await import('./lib/btw-service')
    cancelBtw()
    return true
  })

  // ===== Ask 档位（Composer Ask/Agent 切换） =====

  // 获取 Ask 消息列表
  ipcMain.handle(
    ASK_IPC_CHANNELS.GET_MESSAGES,
    async (_event, agentSessionId: string): Promise<import('@tagent/shared').AskMessage[]> => {
      const { getAgentSessionAskMessages } = await import('./lib/ask-message-store')
      return getAgentSessionAskMessages(agentSessionId)
    }
  )

  // 发送 Ask 消息
  ipcMain.handle(
    ASK_IPC_CHANNELS.SEND_MESSAGE,
    async (event, input: import('@tagent/shared').AskSendInput): Promise<void> => {
      const { sendAskMessage } = await import('./lib/ask-service')
      await sendAskMessage(input, event.sender)
    }
  )

  // 中止 Ask 生成
  ipcMain.handle(
    ASK_IPC_CHANNELS.STOP_GENERATION,
    async (_event, agentSessionId: string): Promise<void> => {
      const { stopAskGeneration } = await import('./lib/ask-service')
      stopAskGeneration(agentSessionId)
    }
  )

  // 删除单条 Ask 消息（P1 留位）
  ipcMain.handle(
    ASK_IPC_CHANNELS.DELETE_MESSAGE,
    async (
      _event,
      agentSessionId: string,
      messageId: string
    ): Promise<import('@tagent/shared').AskMessage[]> => {
      const { deleteAskMessage } = await import('./lib/ask-message-store')
      return deleteAskMessage(agentSessionId, messageId)
    }
  )

  // 获取会话 Composer 档位
  ipcMain.handle(
    ASK_IPC_CHANNELS.GET_COMPOSER_MODE,
    async (_event, agentSessionId: string): Promise<import('@tagent/shared').ComposerMode> => {
      const { getAgentSessionMeta } = await import('./lib/agent-session-manager')
      const { DEFAULT_COMPOSER_MODE } = await import('@tagent/shared')
      const meta = getAgentSessionMeta(agentSessionId)
      return meta?.lastComposerMode ?? DEFAULT_COMPOSER_MODE
    }
  )

  // 设置会话 Composer 档位
  ipcMain.handle(
    ASK_IPC_CHANNELS.SET_COMPOSER_MODE,
    async (
      _event,
      agentSessionId: string,
      mode: import('@tagent/shared').ComposerMode
    ): Promise<void> => {
      const { updateAgentSessionMeta, getAgentSessionMeta } =
        await import('./lib/agent-session-manager')
      if (!getAgentSessionMeta(agentSessionId)) {
        throw new Error(`Agent 会话不存在: ${agentSessionId}`)
      }
      updateAgentSessionMeta(agentSessionId, { lastComposerMode: mode })
    }
  )

  // ===== Automation 定时任务 =====

  ipcMain.handle(AUTOMATION_IPC_CHANNELS.LIST, async () => {
    const { listAutomations } = await import('./lib/automation-manager')
    return listAutomations()
  })

  ipcMain.handle(AUTOMATION_IPC_CHANNELS.CREATE, async (_, input) => {
    const { createAutomation } = await import('./lib/automation-manager')
    const { broadcastChanged } = await import('./lib/automation-scheduler')
    const automation = createAutomation(input)
    broadcastChanged()
    return automation
  })

  ipcMain.handle(AUTOMATION_IPC_CHANNELS.UPDATE, async (_, input) => {
    const { updateAutomation } = await import('./lib/automation-manager')
    const { broadcastChanged } = await import('./lib/automation-scheduler')
    const automation = updateAutomation(input)
    broadcastChanged()
    return automation
  })

  ipcMain.handle(AUTOMATION_IPC_CHANNELS.DELETE, async (_, id: string) => {
    const { deleteAutomation } = await import('./lib/automation-manager')
    const { broadcastChanged } = await import('./lib/automation-scheduler')
    deleteAutomation(id)
    broadcastChanged()
  })

  ipcMain.handle(AUTOMATION_IPC_CHANNELS.TOGGLE, async (_, id: string) => {
    const { toggleAutomation } = await import('./lib/automation-manager')
    const { broadcastChanged } = await import('./lib/automation-scheduler')
    const automation = toggleAutomation(id)
    broadcastChanged()
    return automation
  })

  ipcMain.handle(AUTOMATION_IPC_CHANNELS.RUN_NOW, async (_, id: string) => {
    const { runAutomationNow } = await import('./lib/automation-scheduler')
    return runAutomationNow(id)
  })

  // ===== Draft 需求草稿 =====

  ipcMain.handle(DRAFT_IPC_CHANNELS.LIST, async () => {
    const { listDrafts } = await import('./lib/draft-manager')
    return listDrafts()
  })

  ipcMain.handle(DRAFT_IPC_CHANNELS.GET, async (_, id: string) => {
    const { getDraft } = await import('./lib/draft-manager')
    return getDraft(id)
  })

  ipcMain.handle(
    DRAFT_IPC_CHANNELS.CREATE,
    async (
      _,
      opts?: { title?: string; workspaceId?: string; mode?: 'general' | 'ta'; context?: string }
    ) => {
      const { createDraft } = await import('./lib/draft-manager')
      return createDraft(opts)
    }
  )

  ipcMain.handle(
    DRAFT_IPC_CHANNELS.UPDATE,
    async (_, id: string, partial: Record<string, unknown>) => {
      const { updateDraft } = await import('./lib/draft-manager')
      return updateDraft(id, partial)
    }
  )

  ipcMain.handle(DRAFT_IPC_CHANNELS.DELETE, async (_, id: string) => {
    const { deleteDraft } = await import('./lib/draft-manager')
    return deleteDraft(id)
  })

  ipcMain.handle(DRAFT_IPC_CHANNELS.MIGRATE_LEGACY, async () => {
    const { migrateLegacy } = await import('./lib/draft-manager')
    return migrateLegacy()
  })

  // ===== Kanban 看板 =====

  registerKanbanIpcHandlers()

  // ===== Agent 角色库 =====

  registerAgentRoleIpcHandlers()
}
