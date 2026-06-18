import type { ContextUsageSnapshot } from '@tagent/shared'
import { ChevronDown } from 'lucide-react'
import * as React from 'react'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

import { ContextUsageCategoryRow } from './ContextUsageCategoryRow'
import { ContextUsageSegmentBar } from './ContextUsageSegmentBar'

interface ContextUsagePanelProps {
  snapshot: ContextUsageSnapshot
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`
  return `${tokens}`
}

interface DetailSectionProps {
  title: string
  count?: number
  children: React.ReactNode
}

function DetailSection({ title, count, children }: DetailSectionProps): React.ReactElement {
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-xs text-foreground/80 hover:bg-muted/50">
        <span className="font-medium">
          {title}
          {count != null ? ` (${count})` : ''}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 flex flex-col gap-1 pl-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

function DetailLine({
  label,
  value,
  muted,
}: {
  label: string
  value: string
  muted?: boolean
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <span className={cn('truncate text-muted-foreground', muted && 'opacity-70')}>{label}</span>
      <span className="shrink-0 tabular-nums text-foreground/85">{value}</span>
    </div>
  )
}

export function ContextUsagePanel({ snapshot }: ContextUsagePanelProps): React.ReactElement {
  const percent = Math.round(snapshot.percentage)
  const categories = snapshot.categories.filter((category) => category.tokens > 0)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground/80">Context Usage</p>
        <span className="text-[10px] text-muted-foreground">{percent}%</span>
      </div>

      <ContextUsageSegmentBar categories={snapshot.categories} totalTokens={snapshot.totalTokens} />

      <p className="text-[10px] text-muted-foreground tabular-nums">
        {formatTokens(snapshot.totalTokens)} / {formatTokens(snapshot.maxTokens)} tokens
        {snapshot.model ? ` · ${snapshot.model}` : ''}
      </p>

      <div className="flex flex-col gap-1">
        {categories.map((category) => (
          <ContextUsageCategoryRow key={category.name} category={category} />
        ))}
      </div>

      {snapshot.mcpTools.length > 0 && (
        <DetailSection title="MCP 工具" count={snapshot.mcpTools.length}>
          {snapshot.mcpTools.map((tool) => (
            <DetailLine
              key={`${tool.serverName}:${tool.name}`}
              label={`${tool.serverName} / ${tool.name}`}
              value={formatTokens(tool.tokens)}
              muted={tool.isLoaded === false}
            />
          ))}
        </DetailSection>
      )}

      {snapshot.memoryFiles.length > 0 && (
        <DetailSection title="记忆文件" count={snapshot.memoryFiles.length}>
          {snapshot.memoryFiles.map((file) => (
            <DetailLine
              key={file.path}
              label={file.path}
              value={formatTokens(file.tokens)}
            />
          ))}
        </DetailSection>
      )}

      {snapshot.skills && snapshot.skills.skillFrontmatter.length > 0 && (
        <DetailSection title="技能" count={snapshot.skills.includedSkills}>
          {snapshot.skills.skillFrontmatter.map((skill) => (
            <DetailLine
              key={`${skill.source}:${skill.name}`}
              label={skill.name}
              value={formatTokens(skill.tokens)}
            />
          ))}
        </DetailSection>
      )}

      {snapshot.messageBreakdown && (
        <DetailSection title="对话构成">
          <DetailLine label="用户消息" value={formatTokens(snapshot.messageBreakdown.userMessageTokens)} />
          <DetailLine
            label="助手消息"
            value={formatTokens(snapshot.messageBreakdown.assistantMessageTokens)}
          />
          <DetailLine
            label="工具调用"
            value={formatTokens(snapshot.messageBreakdown.toolCallTokens)}
          />
          <DetailLine
            label="工具结果"
            value={formatTokens(snapshot.messageBreakdown.toolResultTokens)}
          />
          <DetailLine
            label="附件"
            value={formatTokens(snapshot.messageBreakdown.attachmentTokens)}
          />
        </DetailSection>
      )}

      {snapshot.isAutoCompactEnabled && (
        <p className="text-[10px] text-muted-foreground">
          自动压缩已开启
          {snapshot.autoCompactThreshold != null
            ? `（阈值 ${Math.round(snapshot.autoCompactThreshold * 100)}%）`
            : ''}
        </p>
      )}

      <p className="text-[10px] text-muted-foreground/80">
        分项由 SDK 估算，圆环为 API 汇总用量，二者可能略有差异。
      </p>
    </div>
  )
}
