import { atom } from 'jotai'

/** 按会话递增：仅刷新对应 ContextUsageBadge，避免全局 nonce 牵连所有会话 */
export const contextUsageRefreshNonceBySessionAtom = atom<Map<string, number>>(new Map())

/** 递增指定会话的 Context 分项刷新计数 */
export function bumpContextUsageRefreshNonce(
  prev: Map<string, number>,
  sessionId: string
): Map<string, number> {
  const map = new Map(prev)
  map.set(sessionId, (map.get(sessionId) ?? 0) + 1)
  return map
}
