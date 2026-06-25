/**
 * useOpenSession — 统一的"打开/聚焦会话 Tab"操作
 *
 * 封装 openTab + setTabs + setActiveTabId + setAppMode + setCurrentXxxId，
 * 确保所有打开会话的入口都能正确同步 appMode 和 currentSessionId。
 */

import { useAtom, useAtomValue, useSetAtom, useStore } from 'jotai'
import * as React from 'react'

import {
  currentAgentSessionIdAtom,
  agentSessionsAtom,
  currentAgentWorkspaceIdAtom,
  unviewedCompletedSessionIdsAtom,
} from '@/atoms/agent-atoms'
import { appModeAtom } from '@/atoms/app-mode'
import { previewFileMapAtom } from '@/atoms/preview-atoms'
import {
  tabsAtom,
  activeTabIdAtom,
  openTab,
  buildOpenTabRestore,
  sessionViewStateMapAtom,
  type TabType,
} from '@/atoms/tab-atoms'

type OpenSessionFn = (
  type: TabType,
  sessionId: string,
  title: string,
  mode?: 'general' | 'ta'
) => void

export function useOpenSession(): OpenSessionFn {
  const store = useStore()
  const [tabs, setTabs] = useAtom(tabsAtom)
  const setActiveTabId = useSetAtom(activeTabIdAtom)
  const setAppMode = useSetAtom(appModeAtom)
  const setCurrentAgentSessionId = useSetAtom(currentAgentSessionIdAtom)
  const agentSessions = useAtomValue(agentSessionsAtom)
  const setCurrentAgentWorkspaceId = useSetAtom(currentAgentWorkspaceIdAtom)
  const setUnviewedCompleted = useSetAtom(unviewedCompletedSessionIdsAtom)

  return React.useCallback(
    (type: TabType, sessionId: string, title: string, mode?: 'general' | 'ta'): void => {
      // 优先用调用方传入的 mode（新建场景），否则从 agentSessionsAtom 查（已存在场景）
      const session = agentSessions.find((s) => s.id === sessionId)
      const resolvedMode = mode ?? session?.mode ?? 'general'

      // 切回 agent 会话时，若该会话上次开着预览 Tab 则一并重建并回到上次视图
      const restore =
        type === 'agent'
          ? buildOpenTabRestore(
              sessionId,
              store.get(sessionViewStateMapAtom),
              store.get(previewFileMapAtom)
            )
          : undefined
      const result = openTab(tabs, { type, sessionId, title, mode: resolvedMode }, restore)
      setTabs(result.tabs)
      setActiveTabId(result.activeTabId)

      // P3: chat 已退役，仅处理 agent / preview / scratch
      if (type === 'agent' || type === 'preview') {
        setAppMode('agent')
        setCurrentAgentSessionId(sessionId)

        // 用户打开查看后只清除未读角标；是否完成由用户通过对勾确认。
        setUnviewedCompleted((prev) => {
          if (!prev.has(sessionId)) return prev
          const next = new Set(prev)
          next.delete(sessionId)
          return next
        })

        // 同步 workspaceId，确保与 TabBar 切换行为一致
        if (session?.workspaceId) {
          setCurrentAgentWorkspaceId(session.workspaceId)
          window.electronAPI
            .updateSettings({
              agentWorkspaceId: session.workspaceId,
            })
            .catch(console.error)
        }
      } else {
        // scratch
        setAppMode('scratch')
        setCurrentAgentSessionId(null)
      }
    },
    [
      tabs,
      setTabs,
      setActiveTabId,
      setAppMode,
      setCurrentAgentSessionId,
      agentSessions,
      setCurrentAgentWorkspaceId,
      setUnviewedCompleted,
    ]
  )
}
