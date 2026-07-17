/**
 * TabContent — 标签内容渲染器
 *
 * 根据标签类型渲染参数化的 AgentView 或其他视图。
 * P3: Chat 模式已退役，不再渲染 ChatView。
 */

import { useAtom, useAtomValue } from 'jotai'
import * as React from 'react'

import { TabErrorBoundary } from './TabErrorBoundary'

import { sessionPresentationAtomFamily } from '@/atoms/session-presentation-atoms'
import { tabsAtom } from '@/atoms/tab-atoms'
import { AgentView } from '@/components/agent'
import { SessionPresentationToggle } from '@/components/agent/SessionPresentationToggle'
import { DraftView } from '@/components/draft'
import { PreviewTabContent } from '@/components/diff/PreviewTabContent'

const OfficeSessionView = React.lazy(() =>
  import('@/components/ai-office/OfficeSessionView').then((module) => ({
    default: module.OfficeSessionView,
  }))
)

function OfficeLoadingState(): React.ReactElement {
  return (
    <div
      className="flex h-full items-center justify-center bg-background/35"
      role="status"
      aria-label="正在加载 AI Office"
    >
      <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/80 px-4 py-3 text-sm text-muted-foreground shadow-lg backdrop-blur-xl">
        <span className="size-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        正在布置办公室…
      </div>
    </div>
  )
}

export interface TabContentProps {
  tabId: string
}

export function TabContent({ tabId }: TabContentProps): React.ReactElement {
  const tabs = useAtomValue(tabsAtom)
  const tab = tabs.find((t) => t.id === tabId)
  const [presentation, setPresentation] = useAtom(
    sessionPresentationAtomFamily(tab?.type === 'agent' ? tab.sessionId : '__none__')
  )

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

  if (presentation === 'office') {
    return (
      <TabErrorBoundary
        key={`${tab.sessionId}:office`}
        sessionId={tab.sessionId}
        fallbackAction={{
          label: '返回经典工作台',
          onClick: () => setPresentation('classic'),
        }}
      >
        <React.Suspense fallback={<OfficeLoadingState />}>
          <OfficeSessionView sessionId={tab.sessionId} />
        </React.Suspense>
      </TabErrorBoundary>
    )
  }

  // agent 类型（P3: chat 已退役，不再支持）；classic 始终是默认展示。
  return (
    <TabErrorBoundary key={`${tab.sessionId}:classic`} sessionId={tab.sessionId}>
      <AgentView
        sessionId={tab.sessionId}
        headerActions={<SessionPresentationToggle sessionId={tab.sessionId} />}
      />
    </TabErrorBoundary>
  )
}
