import type { TAgentPermissionMode } from '../types/agent'

/**
 * 工具分类规则 — Agent 权限系统
 *
 * 定义安全工具白名单、安全 Bash 命令模式和危险命令列表。
 * 用于智能模式下的自动允许/询问判断。
 */

/** 始终安全的工具（免询问） */
export const SAFE_TOOLS: readonly string[] = [
  'Read', // 文件读取
  'Glob', // 文件名搜索
  'Grep', // 内容搜索
  'WebSearch', // 网络搜索
  'WebFetch', // 网页获取
  'TodoRead', // Todo 列表读取
  'TodoWrite', // Todo 列表写入（无安全风险）
  'TaskOutput', // 后台任务输出
  // 注意：AskUserQuestion 不在此列表 — 由 canUseTool 拦截并展示交互式 UI
]

/** 安全的 Bash 命令模式（只读操作） */
export const SAFE_BASH_PATTERNS: readonly RegExp[] = [
  /^git\s+(status|log|diff|show|branch|remote|tag)\b/,
  /^ls\b/,
  /^head\b/,
  /^tail\b/,
  /^grep\b/,
  /^rg\b/,
  /^which\b/,
  /^pwd$/,
  /^env$/,
  /^whoami$/,
  /^uname\b/,
  /^tree\b/,
  /^wc\b/,
  /^file\b/,
  /^stat\b/,
  /^du\b/,
  /^df\b/,
  /^node\s+--version$/,
  /^bun\s+--version$/,
  /^npm\s+(list|ls|view|info|outdated)\b/,
  /^bun\s+(pm\s+ls)\b/,
  // 注意：cat/echo/find 不在此列表中
  // - cat 可读取敏感文件（~/.ssh/id_rsa 等）
  // - echo 可通过重定向写入文件
  // - find 的 -exec/-delete 可执行任意命令/删除文件
]

/** 危险命令前缀（需特别标记⚠️） */
export const DANGEROUS_COMMANDS: readonly string[] = [
  'rm',
  'rmdir',
  'sudo',
  'su',
  'chmod',
  'chown',
  'mv',
  'dd',
  'kill',
  'killall',
  'pkill',
  'git push',
  'git reset',
  'git rebase',
  'git checkout',
  'git clean',
  'git branch -D',
  'git branch -d',
  'npm publish',
  'curl',
  'wget',
  'ssh',
  'scp',
]

/**
 * 检测 Bash 命令是否包含危险结构
 *
 * 检测管道、输出重定向、exec 子命令等危险模式。
 * MVP 阶段使用简单字符串检测，后续可升级为 shell AST 解析。
 */
export function hasDangerousStructure(command: string): boolean {
  // 管道操作
  if (/[|]/.test(command)) return true
  // 输出重定向
  if (/>{1,2}/.test(command)) return true
  // find -exec / -delete（可执行任意命令/删除文件）
  if (/\b-exec\b/.test(command) || /\b-delete\b/.test(command)) return true
  // 命令链接操作符（&&、;）
  if (/[;&]/.test(command)) return true
  // 子 shell / 命令替换（$(...) 和反引号）
  if (/\$\(/.test(command) || /`/.test(command)) return true
  return false
}

/**
 * 判断 Bash 命令是否匹配安全模式
 */
export function isSafeBashCommand(command: string): boolean {
  const trimmed = command.trim()
  if (hasDangerousStructure(trimmed)) return false
  return SAFE_BASH_PATTERNS.some((pattern) => pattern.test(trimmed))
}

/**
 * 判断命令是否为危险命令
 */
export function isDangerousCommand(command: string): boolean {
  const trimmed = command.trim().toLowerCase()
  return DANGEROUS_COMMANDS.some((dc) => trimmed.startsWith(dc.toLowerCase()))
}

/** 写操作工具名称 */
export const WRITE_TOOLS: readonly string[] = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit']

/** automation MCP 只读工具（auto 模式下免确认） */
export const AUTOMATION_MCP_READ_TOOLS: readonly string[] = [
  'mcp__automation__list_automations',
  'mcp__automation__get_automation',
]

/** automation MCP 写操作工具（auto 模式下需用户确认） */
export const AUTOMATION_MCP_MUTATION_TOOLS: readonly string[] = [
  'mcp__automation__create_automation',
  'mcp__automation__update_automation',
  'mcp__automation__delete_automation',
  'mcp__automation__run_automation_now',
]

/** 解析 MCP 工具名：mcp__server__tool → { server, tool } */
export function parseMcpToolName(toolName: string): { server: string; tool: string } | null {
  const parts = toolName.split('__')
  if (parts[0] !== 'mcp' || parts.length < 3) return null
  return { server: parts[1]!, tool: parts.slice(2).join('__') }
}

export function isAutomationReadTool(toolName: string): boolean {
  return AUTOMATION_MCP_READ_TOOLS.includes(toolName)
}

export function isAutomationMutationTool(toolName: string): boolean {
  return AUTOMATION_MCP_MUTATION_TOOLS.includes(toolName)
}

/**
 * 判断工具是否为写操作（auto 模式下需用户确认）
 */
export function isWriteTool(toolName: string, input: Record<string, unknown>): boolean {
  if (WRITE_TOOLS.includes(toolName)) return true
  if (toolName === 'Bash') {
    const command = typeof input.command === 'string' ? input.command : ''
    return !isSafeBashCommand(command)
  }
  return false
}

/** 会话外影响 / 后台执行类工具（自动审批模式下需用户确认） */
export const HIGH_RISK_PROACTIVE_TOOLS: readonly string[] = [
  'Task',
  'REPL',
  'Workflow',
  'ScheduleWakeup',
  'Monitor',
  'PushNotification',
  'CronCreate',
  'CronDelete',
  'RemoteTrigger',
]

/** 只读类内置工具（自动审批模式下免确认） */
export const AUTO_MODE_READ_ONLY_TOOLS: readonly string[] = [
  'Skill',
  'TaskList',
  'TaskGet',
  'ListMcpResourcesTool',
  'ReadMcpResourceTool',
]

/**
 * 自动审批模式下是否可静默放行（只读查询 + 安全 Bash）
 *
 * 其余工具（写文件、MCP 变更、子任务、定时唤醒等）一律走 PermissionBanner。
 */
export function isAutoModeAutoAllowTool(toolName: string, input: Record<string, unknown>): boolean {
  if (SAFE_TOOLS.includes(toolName)) return true
  if (AUTO_MODE_READ_ONLY_TOOLS.includes(toolName)) return true
  if (isAutomationReadTool(toolName)) return true
  if (toolName === 'Bash') {
    const command = typeof input.command === 'string' ? input.command : ''
    return isSafeBashCommand(command)
  }
  return false
}

/**
 * 自动审批模式下是否必须弹出 TAgent 权限横幅
 */
export function requiresAutoModeConfirmation(
  toolName: string,
  input: Record<string, unknown>
): boolean {
  if (toolName === 'AskUserQuestion') return false
  return !isAutoModeAutoAllowTool(toolName, input)
}

/**
 * TAgent 权限模式 → 传给 Claude Agent SDK 的 permissionMode
 *
 * 「自动审批」与「完全自动」的决策全部由 TAgent canUseTool 完成。
 * 若 SDK 仍用原生 auto，内置 classifier 可能在 canUseTool 之前硬拒高风险工具并终止任务。
 * 因此这两档统一映射为 default，保证每次工具调用都先进入 TAgent 审批链路。
 */
export function resolveSdkPermissionModeForTAgent(
  mode: TAgentPermissionMode
): TAgentPermissionMode | 'default' {
  if (mode === 'auto' || mode === 'bypassPermissions') {
    return 'default'
  }
  return mode
}
