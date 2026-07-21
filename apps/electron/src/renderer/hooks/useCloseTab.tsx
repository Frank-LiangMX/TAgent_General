/**
 * useCloseTab — 统一的当前会话入口关闭逻辑
 *
 * 被 TabBar（×按钮/中键）和 GlobalShortcuts（Cmd+W）共用，
 *
 * 关键行为：
 * - 关闭当前会话入口只回到 Scratch Pad，不停止后台 Agent
 * - 运行中或阻塞中的会话继续通过左侧 Working 区恢复
 * - idle 状态的 Agent 会话在用户主动关闭 Tab 时自动从 Working 移除
 * - 真正删除/归档时由侧边栏路径负责清理 per-session 状态
 */

import { useAtom, useSetAtom, useStore } from 'jotai'
import * as React from 'react'

import {
  agentSessionsAtom,
  agentSessionIndicatorMapAtom,
  unviewedCompletedSessionIdsAtom,
  workingDoneSessionIdsAtom,
} from '@/atoms/agent-atoms'
import {
  tabsAtom,
  activeTabIdAtom,
  closeTab,
  getRailItemFromTab,
  isPreviewTab,
  sessionViewStateMapAtom,
} from '@/atoms/tab-atoms'
import { useSyncActiveTabSideEffects } from '@/hooks/useSyncActiveTabSideEffects'
import { flyRailGhost } from '@/lib/rail-tab-flight'

interface UseCloseTabReturn {
  /** 请求关闭当前会话入口 */
  requestClose: (tabId: string) => void
  /** 直接执行关闭 */
  executeClose: (tabId: string) => void
}

export function useCloseTab(): UseCloseTabReturn {
  const [tabs, setTabs] = useAtom(tabsAtom)
  const [activeTabId, setActiveTabId] = useAtom(activeTabIdAtom)
  const syncActiveTabSideEffects = useSyncActiveTabSideEffects()
  const store = useStore()
  const setUnviewedCompleted = useSetAtom(unviewedCompletedSessionIdsAtom)
  const setWorkingDone = useSetAtom(workingDoneSessionIdsAtom)
  const setAgentSessions = useSetAtom(agentSessionsAtom)
  const setViewStateMap = useSetAtom(sessionViewStateMapAtom)

  const removeIdleSessionFromWorking = React.useCallback(
    (sessionId: string) => {
      const indicatorMap = store.get(agentSessionIndicatorMapAtom)
      const status = indicatorMap.get(sessionId)
      // running 或 blocked 的会话不移除
      if (status === 'running' || status === 'blocked') return

      // 通过 IPC 清除持久化的 completedButUnconfirmed 和 manualWorking 状态
      window.electronAPI
        .confirmWorkingDoneAgentSession(sessionId)
        .then((updated) => {
          setAgentSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
        })
        .catch(console.error)

      setWorkingDone((prev) => {
        if (!prev.has(sessionId)) return prev
        const next = new Set(prev)
        next.delete(sessionId)
        return next
      })
      setUnviewedCompleted((prev) => {
        if (!prev.has(sessionId)) return prev
        const next = new Set(prev)
        next.delete(sessionId)
        return next
      })
    },
    [store, setAgentSessions, setWorkingDone, setUnviewedCompleted]
  )

  const executeClose = React.useCallback(
    (tabId: string) => {
      const closingTab = tabs.find((t) => t.id === tabId)

      // rail tab 关闭：先趁 DOM 还在取 tab 矩形，状态更新后 ghost 飞回右栏按钮
      let railFlightFrom: DOMRect | null = null
      const railItem = closingTab ? getRailItemFromTab(closingTab) : null
      if (railItem) {
        railFlightFrom =
          document
            .querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(tabId)}"]`)
            ?.getBoundingClientRect() ?? null
      }

      const result = closeTab(tabs, activeTabId, tabId)
      setTabs(result.tabs)
      setActiveTabId(result.activeTabId)

      if (railItem && railFlightFrom) {
        flyRailGhost(railFlightFrom, () =>
          document.querySelector<HTMLElement>(`[data-rail-item="${CSS.escape(railItem)}"]`)
        )
      }

      // 同步该会话的视图状态：
      // - 关闭预览 Tab → 预览不再打开（保留 lastView，切回不再重建预览）
      // - 关闭会话 Tab（连带其预览）→ 删除整条记录
      if (closingTab) {
        if (isPreviewTab(closingTab)) {
          setViewStateMap((prev) => {
            const current = prev.get(closingTab.sessionId)
            if (!current) return prev
            const next = new Map(prev)
            next.set(closingTab.sessionId, { previewTabOpen: false, lastView: current.lastView })
            return next
          })
        } else if (closingTab.type === 'agent') {
          setViewStateMap((prev) => {
            if (!prev.has(closingTab.sessionId)) return prev
            const next = new Map(prev)
            next.delete(closingTab.sessionId)
            return next
          })
        }
      }

      // 关闭父会话时可能连带移除当前激活的 rail / preview 子标签，
      // 因此按 activeTabId 是否实际变化判断，而不能只看被点关闭的标签是否 active。
      if (activeTabId !== result.activeTabId) {
        const newActiveTab = result.activeTabId
          ? (result.tabs.find((t) => t.id === result.activeTabId) ?? null)
          : null
        syncActiveTabSideEffects(newActiveTab)
      }

      // 用户主动关闭 idle 的 Agent Tab 时，从 Working 状态移除
      if (closingTab && closingTab.type === 'agent') {
        removeIdleSessionFromWorking(closingTab.sessionId)
      }
    },
    [
      tabs,
      activeTabId,
      setTabs,
      setActiveTabId,
      setViewStateMap,
      syncActiveTabSideEffects,
      removeIdleSessionFromWorking,
    ]
  )

  const requestClose = React.useCallback(
    (tabId: string) => {
      executeClose(tabId)
    },
    [executeClose]
  )

  return { requestClose, executeClose }
}
