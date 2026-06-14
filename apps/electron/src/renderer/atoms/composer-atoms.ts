/**
 * Composer 档位 Atoms
 *
 * per-session 缓存 Composer 档位（'ask' | 'agent'），切换会话时保留各自档位。
 * 持久化通过 IPC 写入 AgentSessionMeta.lastComposerMode（见 ASK_IPC_CHANNELS.SET_COMPOSER_MODE）。
 *
 * 渲染层维护 Map 作为本地缓存（避免每次读取都走 IPC），
 * 启动时由 AgentView 加载并填充，切换时同步落盘。
 */

import { atom } from 'jotai'
import { DEFAULT_COMPOSER_MODE, type ComposerMode } from '@tagent/shared'

import { currentAgentSessionIdAtom } from './agent-atoms'

/** Per-session Composer 档位 Map — sessionId → ComposerMode */
export const composerModeMapAtom = atom<Map<string, ComposerMode>>(new Map())

/**
 * 当前会话的 Composer 档位（派生只读）
 *
 * 读：当前 Agent 会话 ID 的档位，找不到时回落到默认档位
 *    （避免在 session meta 尚未加载到本地时显示异常）
 */
export const currentComposerModeAtom = atom<ComposerMode>((get) => {
  const sessionId = get(currentAgentSessionIdAtom)
  if (!sessionId) return DEFAULT_COMPOSER_MODE
  return get(composerModeMapAtom).get(sessionId) ?? DEFAULT_COMPOSER_MODE
})

/**
 * Composer 档位是否在写回主进程（防止初次同步期间重复 IPC）
 *
 * 标记「本地缓存与主进程一致」的 sessionId 集合
 * — 写完回执后再 add，避免外部 effect 在收到 STREAM_COMPLETE 等事件时
 * 误判为「需要回灌」
 */
export const composerModeSyncedSessionsAtom = atom<Set<string>>(new Set<string>())
