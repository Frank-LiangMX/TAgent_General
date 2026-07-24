/**
 * 终端会话标识命名
 *
 * sessionId = `terminal:<workspaceHash>:<tabId>`，主进程按 sessionId 持有 PTY。
 * workspace 简化：cwd 用 TAgent 当前工作区目录或主进程 cwd，hash 函数保留，
 * 不搬 F:\Kun 的 workspace-path.ts。
 */

const TERMINAL_SESSION_PREFIX = 'terminal'

/** 工作区根目录的稳定 key；空目录回退 'no-workspace' */
export function terminalWorkspaceSessionKey(workspaceRoot: string): string {
  return workspaceRoot.trim() || 'no-workspace'
}

/** FNV-1a hash，给工作区目录生成短稳定 key */
function hashString(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

/** 按工作区 + tab 生成终端会话 id */
export function terminalSessionIdForWorkspace(workspaceRoot: string, tabId: string): string {
  const workspaceKey = terminalWorkspaceSessionKey(workspaceRoot)
  const tabKey = tabId.trim() || 'main'
  return `${TERMINAL_SESSION_PREFIX}:${hashString(workspaceKey)}:${tabKey}`
}
