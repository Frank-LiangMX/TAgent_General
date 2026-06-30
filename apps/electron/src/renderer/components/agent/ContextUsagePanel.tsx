import type { ContextUsageSnapshot } from '@tagent/shared'
import * as React from 'react'

import {
  categoryPercentOfWindow,
  formatContextTokens,
  isFreeSpaceCategory,
} from '@/lib/context-usage-format'
import { cn } from '@/lib/utils'

import { ContextUsageTermHint } from './ContextUsageTermHint'
import { ContextUsageCategoryGroup } from './ContextUsageCategoryGroup'
import { ContextUsageCategoryRow } from './ContextUsageCategoryRow'
import { ContextUsageSegmentBar } from './ContextUsageSegmentBar'

interface ContextUsagePanelProps {
  snapshot: ContextUsageSnapshot
  /** 分项明细仍在加载（摘要已展示） */
  detailsLoading?: boolean
  /** 当前展示的是流式估算摘要，非 SDK 分项 */
  isStreamPreview?: boolean
}

function CategoryBreakdownSkeleton(): React.ReactElement {
  return (
    <div className="space-y-1.5 px-1 py-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-7 animate-pulse rounded-xl bg-muted/35" />
      ))}
    </div>
  )
}

function formatCompactThreshold(threshold: number): string {
  if (threshold > 0 && threshold <= 1) {
    return `${Math.round(threshold * 100)}%`
  }
  return formatContextTokens(threshold)
}

function thresholdPercent(snapshot: ContextUsageSnapshot): number | undefined {
  const threshold = snapshot.autoCompactThreshold
  if (threshold == null || threshold <= 0) return undefined
  if (threshold <= 1) return threshold * 100
  if (snapshot.maxTokens <= 0) return undefined
  return (threshold / snapshot.maxTokens) * 100
}

function usageToneClass(percent: number): string {
  if (percent >= 90) return 'text-red-500 dark:text-red-400'
  if (percent >= 70) return 'text-amber-500 dark:text-amber-400'
  return 'text-foreground/75'
}

function usageStatusText(percent: number): string {
  if (percent >= 90) return '上下文危险，建议立即压缩'
  if (percent >= 70) return '接近压缩区间，建议留意'
  return '容量健康'
}

function DetailLine({
  term,
  label,
  value,
  muted,
}: {
  /** 说明 lookup key，默认与 label 相同 */
  term?: string
  label: string
  value: string
  muted?: boolean
}): React.ReactElement {
  const lookup = term ?? label
  return (
    <div className="grid grid-cols-[1fr_auto_42px] items-center gap-2 text-[11px]">
      <ContextUsageTermHint
        term={lookup}
        display={label}
        inline
        className={cn(
          'ml-5 min-w-0 truncate border-l border-foreground/10 pl-2.5 text-muted-foreground',
          muted && 'opacity-70'
        )}
      />
      <span className="shrink-0 text-xs tabular-nums text-foreground/90">{value}</span>
      <span aria-hidden="true" />
    </div>
  )
}

interface CategoryDrillDown {
  itemCount?: number
  content: React.ReactNode
}

function getCategoryDrillDown(
  snapshot: ContextUsageSnapshot,
  categoryName: string
): CategoryDrillDown | null {
  switch (categoryName) {
    case 'System tools':
    case 'Tool definitions':
      if (!snapshot.systemTools || snapshot.systemTools.length === 0) return null
      return {
        itemCount: snapshot.systemTools.length,
        content: snapshot.systemTools.map((tool) => (
          <DetailLine key={tool.name} label={tool.name} value={formatContextTokens(tool.tokens)} />
        )),
      }
    case 'System prompt':
      if (!snapshot.systemPromptSections || snapshot.systemPromptSections.length === 0) {
        return null
      }
      return {
        itemCount: snapshot.systemPromptSections.length,
        content: snapshot.systemPromptSections.map((section) => (
          <DetailLine
            key={section.name}
            label={section.name}
            value={formatContextTokens(section.tokens)}
          />
        )),
      }
    case 'MCP tools':
      if (snapshot.mcpTools.length === 0) return null
      return {
        itemCount: snapshot.mcpTools.length,
        content: snapshot.mcpTools.map((tool) => (
          <DetailLine
            key={`${tool.serverName}:${tool.name}`}
            label={`${tool.serverName} / ${tool.name}`}
            value={formatContextTokens(tool.tokens)}
            muted={tool.isLoaded === false}
          />
        )),
      }
    case 'Skills':
      if (!snapshot.skills || snapshot.skills.skillFrontmatter.length === 0) return null
      return {
        itemCount: snapshot.skills.includedSkills,
        content: snapshot.skills.skillFrontmatter.map((skill) => (
          <DetailLine
            key={`${skill.source}:${skill.name}`}
            label={skill.name}
            value={formatContextTokens(skill.tokens)}
          />
        )),
      }
    case 'Memory':
      if (snapshot.memoryFiles.length === 0) return null
      return {
        itemCount: snapshot.memoryFiles.length,
        content: snapshot.memoryFiles.map((file) => {
          const shortPath = file.path.split('/').pop() ?? file.path
          return (
            <DetailLine
              key={file.path}
              term={shortPath}
              label={shortPath}
              value={formatContextTokens(file.tokens)}
            />
          )
        }),
      }
    case 'Messages':
    case 'Conversation':
      if (!snapshot.messageBreakdown) return null
      return {
        content: (
          <>
            <DetailLine
              label="用户消息"
              value={formatContextTokens(snapshot.messageBreakdown.userMessageTokens)}
            />
            <DetailLine
              label="助手消息"
              value={formatContextTokens(snapshot.messageBreakdown.assistantMessageTokens)}
            />
            <DetailLine
              label="工具调用"
              value={formatContextTokens(snapshot.messageBreakdown.toolCallTokens)}
            />
            <DetailLine
              label="工具结果"
              value={formatContextTokens(snapshot.messageBreakdown.toolResultTokens)}
            />
            <DetailLine
              term="附件明细"
              label="附件"
              value={formatContextTokens(snapshot.messageBreakdown.attachmentTokens)}
            />
          </>
        ),
      }
    case 'Custom agents':
    case 'Agents':
      if (snapshot.agents.length === 0) return null
      return {
        itemCount: snapshot.agents.length,
        content: snapshot.agents.map((agent) => (
          <DetailLine
            key={`${agent.agentType}:${agent.source}`}
            label={agent.agentType}
            value={formatContextTokens(agent.tokens)}
          />
        )),
      }
    default:
      return null
  }
}

function sortCategories(snapshot: ContextUsageSnapshot): ContextUsageSnapshot['categories'] {
  const used = snapshot.categories.filter(
    (category) => category.tokens > 0 && !isFreeSpaceCategory(category.name)
  )
  const freeSpace = snapshot.categories.filter(
    (category) => category.tokens > 0 && isFreeSpaceCategory(category.name)
  )
  used.sort((a, b) => b.tokens - a.tokens)
  return [...used, ...freeSpace]
}

export function ContextUsagePanel({
  snapshot,
  detailsLoading = false,
  isStreamPreview = false,
}: ContextUsagePanelProps): React.ReactElement {
  const percent = Math.round(snapshot.percentage)
  const sortedCategories = React.useMemo(() => sortCategories(snapshot), [snapshot])
  const topCategoryName = sortedCategories.find((c) => !isFreeSpaceCategory(c.name))?.name
  const threshold = thresholdPercent(snapshot)
  const hasCategoryBreakdown = sortedCategories.length > 0

  const metaParts: React.ReactNode[] = []
  if (isStreamPreview) {
    metaParts.push(
      <ContextUsageTermHint
        key="stream"
        term="流式估算"
        display="摘要为流式估算，分项加载中"
        inline
      />
    )
  } else if (detailsLoading) {
    metaParts.push(<ContextUsageTermHint key="refresh" term="分项刷新中" inline />)
  }
  if (snapshot.isAutoCompactEnabled) {
    metaParts.push(
      <ContextUsageTermHint
        key="compact"
        term="自动压缩"
        display={
          snapshot.autoCompactThreshold != null
            ? `自动压缩 ${formatCompactThreshold(snapshot.autoCompactThreshold)}`
            : '自动压缩已开启'
        }
        inline
      />
    )
  }
  metaParts.push(<ContextUsageTermHint key="sdk" term="分项为SDK估算" inline />)

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-background/20 p-3 shadow-[inset_0_1px_0_hsl(var(--glass-shine)/0.18)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground/90">
              <ContextUsageTermHint
                term="Context 容量"
                className="font-medium text-foreground/90"
              />
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {snapshot.model || '当前模型'}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div
              className={cn(
                'text-lg font-semibold tabular-nums leading-none',
                usageToneClass(percent)
              )}
            >
              {percent}%
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">{usageStatusText(percent)}</div>
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-3 text-[11px]">
          <ContextUsageTermHint term="已用 / 窗口" className="text-muted-foreground" inline />
          <span className="tabular-nums font-medium text-foreground/85">
            {formatContextTokens(snapshot.totalTokens)} / {formatContextTokens(snapshot.maxTokens)}
          </span>
        </div>

        <ContextUsageSegmentBar
          categories={snapshot.categories}
          totalTokens={snapshot.totalTokens}
          maxTokens={snapshot.maxTokens}
          thresholdPercent={threshold}
          showLegend={false}
          className="mt-2"
        />

        {detailsLoading && !hasCategoryBreakdown ? (
          <div className="mt-2 h-1.5 animate-pulse rounded-full bg-muted/40" />
        ) : null}

        <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground/70">
          <ContextUsageTermHint
            term="自动压缩"
            display={snapshot.isAutoCompactEnabled ? '自动压缩已开启' : '自动压缩未开启'}
            inline
          />
          {snapshot.autoCompactThreshold != null ? (
            <ContextUsageTermHint
              term="自动压缩阈值"
              display={`阈值 ${formatCompactThreshold(snapshot.autoCompactThreshold)}`}
              inline
            />
          ) : null}
        </div>
      </div>

      {snapshot.rawMaxTokens < snapshot.maxTokens && (
        <p className="rounded-xl bg-background/14 px-2.5 py-2 text-[10px] leading-snug text-muted-foreground/65">
          <ContextUsageTermHint term="SDK窗口差异" inline>
            <>
              SDK 窗口 {formatContextTokens(snapshot.rawMaxTokens)}，展示按模型{' '}
              {formatContextTokens(snapshot.maxTokens)}
            </>
          </ContextUsageTermHint>
        </p>
      )}

      <div className="rounded-2xl bg-background/14 p-1.5 shadow-[inset_0_1px_0_hsl(var(--glass-shine)/0.12)]">
        <div className="grid grid-cols-[1fr_auto_42px] gap-2 px-2 pb-1 text-[10px] text-muted-foreground/70">
          <ContextUsageTermHint term="分类" inline />
          <ContextUsageTermHint term="Token" inline />
          <ContextUsageTermHint term="占比" display="占比" inline className="text-right" />
        </div>
        {detailsLoading && !hasCategoryBreakdown ? (
          <CategoryBreakdownSkeleton />
        ) : (
          sortedCategories.map((category) => {
            const drillDown = getCategoryDrillDown(snapshot, category.name)
            const barPercent = categoryPercentOfWindow(category.tokens, snapshot.maxTokens)

            if (drillDown) {
              return (
                <ContextUsageCategoryGroup
                  key={category.name}
                  category={category}
                  itemCount={drillDown.itemCount}
                  barPercent={barPercent}
                  defaultOpen={category.name === topCategoryName}
                >
                  {drillDown.content}
                </ContextUsageCategoryGroup>
              )
            }
            return (
              <ContextUsageCategoryRow
                key={category.name}
                category={category}
                maxTokens={snapshot.maxTokens}
              />
            )
          })
        )}
        {detailsLoading && hasCategoryBreakdown ? (
          <p className="px-2 py-1 text-[10px] text-muted-foreground/60">正在刷新分项…</p>
        ) : null}
      </div>

      <p className="flex flex-wrap items-center gap-x-1 text-[10px] leading-snug text-muted-foreground/55">
        {metaParts.map((part, index) => (
          <React.Fragment key={index}>
            {index > 0 ? <span aria-hidden="true">·</span> : null}
            {part}
          </React.Fragment>
        ))}
      </p>
    </div>
  )
}
