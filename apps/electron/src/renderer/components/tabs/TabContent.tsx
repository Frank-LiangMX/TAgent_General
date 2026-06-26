/**
 * TabContent — 标签内容渲染器
 *
 * 根据标签类型渲染参数化的 AgentView 或其他视图。
 * P3: Chat 模式已退役，不再渲染 ChatView。
 */

import { useAtomValue } from 'jotai'
import * as React from 'react'

import { TabErrorBoundary } from './TabErrorBoundary'

import { tabsAtom } from '@/atoms/tab-atoms'
import { AgentView } from '@/components/agent'
import { DraftView } from '@/components/draft'
import { PreviewTabContent } from '@/components/diff/PreviewTabContent'

export interface TabContentProps {
  tabId: string
}

export function TabContent({ tabId }: TabContentProps): React.ReactElement {
  const tabs = useAtomValue(tabsAtom)
  const tab = tabs.find((t) => t.id === tabId)

  // [FLASH-DEBUG] 监控 tab 查找失败（说明 tabId 指向了不存在的标签）
  React.useEffect(() => {
    if (!tab) {
      console.warn(`[FLASH-DEBUG] TabContent: tab not found for tabId="${tabId}"`, {
        tabIds: tabs.map((t) => t.id),
      })
    }
  }, [tab, tabId, tabs])

  if (!tab) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        标签页不存在
      </div>
    )
  }

  if (tab.type === 'draft') {
    return (
      <TabErrorBoundary key={tab.id} sessionId={tab.sessionId}>
        <DraftView draftId={tab.sessionId} />
      </TabErrorBoundary>
    )
  }

  if (tab.type === 'preview') {
    return (
      <TabErrorBoundary key={tab.id} sessionId={tab.sessionId}>
        <PreviewTabContent sessionId={tab.sessionId} />
      </TabErrorBoundary>
    )
  }

  // agent 类型（P3: chat 已退役，不再支持）
  return (
    <TabErrorBoundary key={tab.sessionId} sessionId={tab.sessionId}>
      <AgentView sessionId={tab.sessionId} />
    </TabErrorBoundary>
  )
}
