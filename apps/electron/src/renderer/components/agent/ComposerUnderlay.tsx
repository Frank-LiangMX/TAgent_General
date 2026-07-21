/**
 * ComposerUnderlay — 输入框 focus 时展开的高级选项托盘
 *
 * 四格：推理强度（含关闭思考）/ 工具权限 / SubAgent 派发 / 显示选项
 * （记忆写入、上下文范围不在会话内改，已从托盘移除）
 */

import { TAGENT_PERMISSION_MODE_CONFIG, TAGENT_PERMISSION_MODE_ORDER } from '@tagent/shared'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Bot, Eye, Gauge, ShieldCheck, type LucideIcon } from 'lucide-react'
import * as React from 'react'

import type { AgentEffort, TAgentPermissionMode } from '@tagent/shared'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@tagent/ui'
import {
  agentDefaultPermissionModeAtom,
  agentEffortAtom,
  agentPermissionModeMapAtom,
  agentPlanModeSessionsAtom,
  agentProcessGroupsKeepExpandedAtom,
  agentThinkingAtom,
  sessionPersistedPermissionModeAtom,
  subagentEagernessAtom,
  type SubagentEagerness,
} from '@/atoms/agent-atoms'
import { thinkingExpandedAtom } from '@/atoms/model-atoms'
import { autoPreviewEnabledAtom } from '@/atoms/preview-atoms'
import { updatePlanModeSessionSet } from '@/lib/agent-plan-mode'
import { cn } from '@/lib/utils'

const EFFORT_OPTIONS: { value: AgentEffort; label: string; desc: string }[] = [
  { value: 'low', label: '低', desc: '少推理，更快' },
  { value: 'medium', label: '标准', desc: '均衡' },
  { value: 'high', label: '高', desc: '更深推理' },
  { value: 'max', label: '最大', desc: '最强推理' },
]

const EFFORT_LABEL: Record<AgentEffort, string> = {
  low: '低',
  medium: '标准',
  high: '高',
  max: '最大',
}

const SUBAGENT_EAGERNESS_OPTIONS: {
  value: SubagentEagerness
  label: string
  desc: string
}[] = [
  { value: 'never', label: '从不派发', desc: '主 Agent 干所有事' },
  { value: 'conservative', label: '保守', desc: '批量 ≥ 5 才派' },
  { value: 'balanced', label: '平衡', desc: '批量 ≥ 3 即派' },
  { value: 'aggressive', label: '积极', desc: '能派就派' },
]

interface UnderlayCellProps {
  icon: LucideIcon
  label: string
  value: string
  /** hover 说明（字号偏小，靠 tooltip 补全） */
  tooltip: string
  disabled?: boolean
  disabledHint?: string
  children: React.ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
}

function UnderlayCell({
  icon: Icon,
  label,
  value,
  tooltip,
  disabled,
  disabledHint,
  children,
  open,
  onOpenChange,
}: UnderlayCellProps): React.ReactElement {
  const tip = disabled && disabledHint ? disabledHint : tooltip

  if (disabled) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled
              className="composer-underlay-cell composer-underlay-cell--disabled"
            >
              <Icon className="composer-underlay-cell__icon" aria-hidden />
              <span className="composer-underlay-cell__label">{label}</span>
              <strong className="composer-underlay-cell__value">{value}</strong>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[220px]">
            <p className="font-medium">{label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{tip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <TooltipProvider delayDuration={300}>
        <Tooltip open={open ? false : undefined}>
          <PopoverTrigger asChild>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  'composer-underlay-cell',
                  open && 'composer-underlay-cell--open'
                )}
              >
                <Icon className="composer-underlay-cell__icon" aria-hidden />
                <span className="composer-underlay-cell__label">{label}</span>
                <strong className="composer-underlay-cell__value">{value}</strong>
              </button>
            </TooltipTrigger>
          </PopoverTrigger>
          <TooltipContent side="top" className="max-w-[220px]">
            <p className="font-medium">{label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{tip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={8}
        className="agent-toolbar-popover w-auto min-w-[168px] p-2"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}

interface ComposerUnderlayProps {
  sessionId: string
  /** Ask 档位下禁用权限 / SubAgent 等 Agent 专属项 */
  askMode?: boolean
  className?: string
}

export function ComposerUnderlay({
  sessionId,
  askMode = false,
  className,
}: ComposerUnderlayProps): React.ReactElement {
  const [effort, setEffort] = useAtom(agentEffortAtom)
  const [agentThinking, setAgentThinking] = useAtom(agentThinkingAtom)
  const [modeMap, setModeMap] = useAtom(agentPermissionModeMapAtom)
  const setPlanModeSessions = useSetAtom(agentPlanModeSessionsAtom)
  const defaultMode = useAtomValue(agentDefaultPermissionModeAtom)
  const persistedMode = useAtomValue(sessionPersistedPermissionModeAtom(sessionId))
  const permissionMode = modeMap.get(sessionId) ?? persistedMode ?? defaultMode

  const [subagentEagerness, setSubagentEagerness] = useAtom(subagentEagernessAtom)
  const [autoPreviewEnabled, setAutoPreviewEnabled] = useAtom(autoPreviewEnabledAtom)
  const [processGroupsKeepExpanded, setProcessGroupsKeepExpanded] = useAtom(
    agentProcessGroupsKeepExpandedAtom
  )
  const [thinkingExpanded, setThinkingExpanded] = useAtom(thinkingExpandedAtom)

  const [openKey, setOpenKey] = React.useState<string | null>(null)

  const thinkingOff = agentThinking?.type === 'disabled'
  const effectiveEffort = effort ?? 'medium'
  const effortLabel = thinkingOff ? '关闭' : EFFORT_LABEL[effectiveEffort]
  const permissionLabel = TAGENT_PERMISSION_MODE_CONFIG[permissionMode].label
  const subagentLabel =
    SUBAGENT_EAGERNESS_OPTIONS.find((o) => o.value === subagentEagerness)?.label ?? '保守'
  const displayValue = [
    autoPreviewEnabled ? '预览' : null,
    processGroupsKeepExpanded ? '展开' : null,
    thinkingExpanded ? '思考' : null,
  ]
    .filter(Boolean)
    .join('·') || '默认'

  const setCellOpen = React.useCallback((key: string, open: boolean) => {
    setOpenKey(open ? key : null)
  }, [])

  const handleEffort = React.useCallback(
    (next: AgentEffort) => {
      const thinking = { type: 'adaptive' as const }
      setEffort(next)
      setAgentThinking(thinking)
      window.electronAPI
        .updateSettings({ agentEffort: next, agentThinking: thinking })
        .catch(console.error)
      setOpenKey(null)
    },
    [setEffort, setAgentThinking]
  )

  /** 关闭思考输出（强度设置保留，下次选档位时一并恢复自适应） */
  const handleThinkingOff = React.useCallback(() => {
    const next = { type: 'disabled' as const }
    setAgentThinking(next)
    window.electronAPI.updateSettings({ agentThinking: next }).catch(console.error)
    setOpenKey(null)
  }, [setAgentThinking])

  const handlePermission = React.useCallback(
    async (nextMode: TAgentPermissionMode) => {
      if (askMode) return
      const prevMode = permissionMode
      setOpenKey(null)
      setModeMap((prev) => {
        const next = new Map(prev)
        next.set(sessionId, nextMode)
        return next
      })
      setPlanModeSessions((prev) => updatePlanModeSessionSet(prev, sessionId, nextMode === 'plan'))
      try {
        await window.electronAPI.updateSessionPermissionMode(sessionId, nextMode)
      } catch (error) {
        console.error('[ComposerUnderlay] 权限模式切换失败，回滚:', error)
        setModeMap((prev) => {
          const next = new Map(prev)
          next.set(sessionId, prevMode)
          return next
        })
        setPlanModeSessions((prev) =>
          updatePlanModeSessionSet(prev, sessionId, prevMode === 'plan')
        )
      }
    },
    [askMode, permissionMode, sessionId, setModeMap, setPlanModeSessions]
  )

  const handleSubagent = React.useCallback(
    (next: SubagentEagerness) => {
      if (askMode) return
      setSubagentEagerness(next)
      window.electronAPI.updateSettings({ subagentEagerness: next }).catch(console.error)
      setOpenKey(null)
    },
    [askMode, setSubagentEagerness]
  )

  return (
    <div
      className={cn('composer-underlay', className)}
      aria-label="高级输入选项"
      data-composer-underlay=""
    >
      <UnderlayCell
        icon={Gauge}
        label="推理强度"
        value={effortLabel}
        tooltip={
          thinkingOff
            ? '当前已关闭思考输出。点击选择档位可重新开启。'
            : `当前：${effortLabel}。控制模型思考深度，下次发送生效。`
        }
        open={openKey === 'effort'}
        onOpenChange={(o) => setCellOpen('effort', o)}
      >
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={handleThinkingOff}
            className={cn(
              'agent-toolbar-popover-item flex items-center justify-between gap-3 px-2 py-1.5 rounded-md text-left',
              'hover:bg-accent hover:text-accent-foreground',
              thinkingOff && 'agent-toolbar-popover-item--active bg-accent/50'
            )}
          >
            <span className="text-xs">关闭</span>
            <span className="text-[10px] text-muted-foreground">不输出思考</span>
          </button>
          {EFFORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleEffort(opt.value)}
              className={cn(
                'agent-toolbar-popover-item flex items-center justify-between gap-3 px-2 py-1.5 rounded-md text-left',
                'hover:bg-accent hover:text-accent-foreground',
                !thinkingOff &&
                  effectiveEffort === opt.value &&
                  'agent-toolbar-popover-item--active bg-accent/50'
              )}
            >
              <span className="text-xs">{opt.label}</span>
              <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
            </button>
          ))}
        </div>
      </UnderlayCell>

      <UnderlayCell
        icon={ShieldCheck}
        label="工具权限"
        value={askMode ? 'Ask' : permissionLabel}
        tooltip={
          askMode
            ? 'Ask 档位不能写文件或执行命令。'
            : `当前：${permissionLabel}。控制工具调用是否需要确认。`
        }
        disabled={askMode}
        disabledHint="Ask 档位不适用权限模式。"
        open={openKey === 'permission'}
        onOpenChange={(o) => setCellOpen('permission', o)}
      >
        <div className="flex flex-col gap-0.5">
          {TAGENT_PERMISSION_MODE_ORDER.map((mode) => {
            const cfg = TAGENT_PERMISSION_MODE_CONFIG[mode]
            return (
              <button
                key={mode}
                type="button"
                onClick={() => void handlePermission(mode)}
                className={cn(
                  'agent-toolbar-popover-item flex flex-col items-start gap-0.5 px-2 py-1.5 rounded-md text-left',
                  'hover:bg-accent hover:text-accent-foreground',
                  permissionMode === mode && 'agent-toolbar-popover-item--active bg-accent/50'
                )}
              >
                <span className="text-xs">{cfg.label}</span>
                <span className="text-[10px] text-muted-foreground">{cfg.description}</span>
              </button>
            )
          })}
        </div>
      </UnderlayCell>

      <UnderlayCell
        icon={Bot}
        label="SubAgent"
        value={askMode ? '—' : subagentLabel}
        tooltip={
          askMode
            ? 'Ask 档位不派发 SubAgent。'
            : `当前：${subagentLabel}。控制主 Agent 派发子任务的积极性。`
        }
        disabled={askMode}
        disabledHint="Ask 档位不适用 SubAgent 派发。"
        open={openKey === 'subagent'}
        onOpenChange={(o) => setCellOpen('subagent', o)}
      >
        <div className="flex flex-col gap-0.5">
          {SUBAGENT_EAGERNESS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSubagent(opt.value)}
              className={cn(
                'agent-toolbar-popover-item flex items-center justify-between gap-3 px-2 py-1.5 rounded-md text-left',
                'hover:bg-accent hover:text-accent-foreground',
                subagentEagerness === opt.value && 'agent-toolbar-popover-item--active bg-accent/50'
              )}
            >
              <span className="text-xs">{opt.label}</span>
              <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
            </button>
          ))}
        </div>
      </UnderlayCell>

      <UnderlayCell
        icon={Eye}
        label="显示选项"
        value={displayValue}
        tooltip="预览修改中文件、过程组展开、思考内容默认展开。"
        open={openKey === 'display'}
        onOpenChange={(o) => setCellOpen('display', o)}
      >
        <div className="flex min-w-[190px] flex-col gap-1.5 px-0.5">
          <div className="flex items-center justify-between gap-4 px-1.5 py-0.5">
            <span className="text-xs text-foreground/70">自动预览修改中文件</span>
            <Switch
              size="sm"
              checked={autoPreviewEnabled}
              onCheckedChange={setAutoPreviewEnabled}
            />
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between gap-4 px-1.5 py-0.5">
            <span className="text-xs text-foreground/70">输出完保持展开</span>
            <Switch
              size="sm"
              checked={processGroupsKeepExpanded}
              onCheckedChange={setProcessGroupsKeepExpanded}
            />
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between gap-4 px-1.5 py-0.5">
            <span className="text-xs text-foreground/70">展开思考内容</span>
            <Switch size="sm" checked={thinkingExpanded} onCheckedChange={setThinkingExpanded} />
          </div>
        </div>
      </UnderlayCell>
    </div>
  )
}
