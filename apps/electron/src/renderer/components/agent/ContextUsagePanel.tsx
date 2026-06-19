import type { ContextUsageSnapshot } from '@tagent/shared'
import * as React from 'react'

import {
  categoryPercentOfWindow,
  formatContextTokens,
  isFreeSpaceCategory,
} from '@/lib/context-usage-format'
import { cn } from '@/lib/utils'

import { ContextUsageCategoryGroup } from './ContextUsageCategoryGroup'
import { ContextUsageCategoryRow } from './ContextUsageCategoryRow'
import { ContextUsageSegmentBar } from './ContextUsageSegmentBar'

interface ContextUsagePanelProps {
  snapshot: ContextUsageSnapshot
}

function formatCompactThreshold(threshold: number): string {
  if (threshold > 0 && threshold <= 1) {
    return `${Math.round(threshold * 100)}%`
  }
  return formatContextTokens(threshold)
}

function usageToneClass(percent: number): string {
  if (percent >= 90) return 'text-red-500 dark:text-red-400'
  if (percent >= 70) return 'text-amber-500 dark:text-amber-400'
  return 'text-foreground/75'
}

function DetailLine({
  label,
  value,
  muted,
  title,
}: {
  label: string
  value: string
  muted?: boolean
  title?: string
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <span
        className={cn('min-w-0 truncate text-muted-foreground', muted && 'opacity-70')}
        title={title ?? label}
      >
        {label}
      </span>
      <span className="shrink-0 tabular-nums text-foreground/85">{value}</span>
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
              label={shortPath}
              title={file.path}
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

export function ContextUsagePanel({ snapshot }: ContextUsagePanelProps): React.ReactElement {
  const percent = Math.round(snapshot.percentage)
  const sortedCategories = React.useMemo(() => sortCategories(snapshot), [snapshot])
  const topCategoryName = sortedCategories.find((c) => !isFreeSpaceCategory(c.name))?.name

  const metaParts: string[] = []
  if (snapshot.isAutoCompactEnabled) {
    metaParts.push(
      snapshot.autoCompactThreshold != null
        ? `自动压缩 ${formatCompactThreshold(snapshot.autoCompactThreshold)}`
        : '自动压缩已开启'
    )
  }
  metaParts.push('分项为 SDK 估算')

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-medium text-foreground/80">Context 占用</p>
          <span className={cn('text-sm font-semibold tabular-nums', usageToneClass(percent))}>
            {percent}%
          </span>
        </div>
        <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
          {formatContextTokens(snapshot.totalTokens)} / {formatContextTokens(snapshot.maxTokens)}
          {snapshot.model ? ` · ${snapshot.model}` : ''}
        </p>
      </div>

      <ContextUsageSegmentBar
        categories={snapshot.categories}
        totalTokens={snapshot.totalTokens}
        maxTokens={snapshot.maxTokens}
        showLegend={false}
      />

      {snapshot.rawMaxTokens < snapshot.maxTokens && (
        <p className="text-[10px] leading-snug text-muted-foreground/65">
          SDK 窗口 {formatContextTokens(snapshot.rawMaxTokens)}，展示按模型 {formatContextTokens(snapshot.maxTokens)}
        </p>
      )}

      <div className="flex flex-col">
        {sortedCategories.map((category) => {
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
        })}
      </div>

      <p className="text-[10px] leading-snug text-muted-foreground/55">{metaParts.join(' · ')}</p>
    </div>
  )
}
