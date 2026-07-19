/**
 * ComposerUnderlay — 输入框 focus 时展开的高级选项托盘（对齐 spatial-theme-study）
 *
 * 原型：.composer-underlay 四格
 *   推理强度 / 工具权限 / 记忆写入 / 上下文范围
 *
 * 生产映射：
 *   推理强度 → agentEffort
 *   工具权限 → permissionMode
 *   记忆写入 → 会话级展示（写入仍走 Nudge 体系，此处为范围意图）
 *   上下文范围 → 当前工作区/项目
 */

import { TAGENT_PERMISSION_MODE_CONFIG, TAGENT_PERMISSION_MODE_ORDER } from '@tagent/shared'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  Brain,
  Database,
  Gauge,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import * as React from 'react'

import type { AgentEffort, TAgentPermissionMode } from '@tagent/shared'
import { Popover, PopoverContent, PopoverTrigger } from '@tagent/ui'
import {
  agentDefaultPermissionModeAtom,
  agentEffortAtom,
  agentPermissionModeMapAtom,
  agentPlanModeSessionsAtom,
  agentWorkspacesAtom,
  currentAgentWorkspaceIdAtom,
  sessionPersistedPermissionModeAtom,
} from '@/atoms/agent-atoms'
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

/** 记忆写入范围（UI 意图；实际写入仍由 Nudge / 记忆系统执行） */
type MemoryWriteScope = 'session' | 'project' | 'off'

const MEMORY_WRITE_OPTIONS: { value: MemoryWriteScope; label: string; desc: string }[] = [
  { value: 'session', label: '会话', desc: '本会话内可写入记忆' },
  { value: 'project', label: '项目', desc: '写入当前工作区记忆' },
  { value: 'off', label: '关闭', desc: '本会话不主动写入' },
]

const MEMORY_WRITE_STORAGE_KEY = 'tagent-composer-memory-write-scope'

function readMemoryWriteScope(): MemoryWriteScope {
  try {
    const raw = localStorage.getItem(MEMORY_WRITE_STORAGE_KEY)
    if (raw === 'session' || raw === 'project' || raw === 'off') return raw
  } catch {
    /* ignore */
  }
  return 'session'
}

interface UnderlayCellProps {
  icon: LucideIcon
  label: string
  value: string
  disabled?: boolean
  children: React.ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
}

function UnderlayCell({
  icon: Icon,
  label,
  value,
  disabled,
  children,
  open,
  onOpenChange,
}: UnderlayCellProps): React.ReactElement {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'composer-underlay-cell',
            open && 'composer-underlay-cell--open',
            disabled && 'composer-underlay-cell--disabled'
          )}
        >
          <Icon className="composer-underlay-cell__icon" aria-hidden />
          <span className="composer-underlay-cell__label">{label}</span>
          <strong className="composer-underlay-cell__value">{value}</strong>
        </button>
      </PopoverTrigger>
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
  /** Ask 档位下禁用权限等 Agent 专属项 */
  askMode?: boolean
  className?: string
}

export function ComposerUnderlay({
  sessionId,
  askMode = false,
  className,
}: ComposerUnderlayProps): React.ReactElement {
  const [effort, setEffort] = useAtom(agentEffortAtom)
  const [modeMap, setModeMap] = useAtom(agentPermissionModeMapAtom)
  const setPlanModeSessions = useSetAtom(agentPlanModeSessionsAtom)
  const defaultMode = useAtomValue(agentDefaultPermissionModeAtom)
  const persistedMode = useAtomValue(sessionPersistedPermissionModeAtom(sessionId))
  const permissionMode = modeMap.get(sessionId) ?? persistedMode ?? defaultMode

  const workspaces = useAtomValue(agentWorkspacesAtom)
  const workspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const workspace = workspaces.find((w) => w.id === workspaceId)
  const contextLabel = workspace?.projectDirectory ? '项目' : '会话'

  const [memoryScope, setMemoryScope] = React.useState<MemoryWriteScope>(readMemoryWriteScope)
  const [openKey, setOpenKey] = React.useState<string | null>(null)

  const effectiveEffort = effort ?? 'medium'
  const effortLabel = EFFORT_LABEL[effectiveEffort]
  const permissionLabel = TAGENT_PERMISSION_MODE_CONFIG[permissionMode].label
  const memoryLabel =
    MEMORY_WRITE_OPTIONS.find((o) => o.value === memoryScope)?.label ?? '会话'

  const setCellOpen = React.useCallback((key: string, open: boolean) => {
    setOpenKey(open ? key : null)
  }, [])

  const handleEffort = React.useCallback(
    (next: AgentEffort) => {
      setEffort(next)
      window.electronAPI.updateSettings({ agentEffort: next }).catch(console.error)
      setOpenKey(null)
    },
    [setEffort]
  )

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

  const handleMemory = React.useCallback((next: MemoryWriteScope) => {
    setMemoryScope(next)
    try {
      localStorage.setItem(MEMORY_WRITE_STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
    setOpenKey(null)
  }, [])

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
        open={openKey === 'effort'}
        onOpenChange={(o) => setCellOpen('effort', o)}
      >
        <div className="flex flex-col gap-0.5">
          {EFFORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleEffort(opt.value)}
              className={cn(
                'agent-toolbar-popover-item flex items-center justify-between gap-3 px-2 py-1.5 rounded-md text-left',
                'hover:bg-accent hover:text-accent-foreground',
                effectiveEffort === opt.value && 'agent-toolbar-popover-item--active bg-accent/50'
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
        disabled={askMode}
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
        icon={Brain}
        label="记忆写入"
        value={memoryLabel}
        open={openKey === 'memory'}
        onOpenChange={(o) => setCellOpen('memory', o)}
      >
        <div className="flex flex-col gap-0.5">
          {MEMORY_WRITE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleMemory(opt.value)}
              className={cn(
                'agent-toolbar-popover-item flex items-center justify-between gap-3 px-2 py-1.5 rounded-md text-left',
                'hover:bg-accent hover:text-accent-foreground',
                memoryScope === opt.value && 'agent-toolbar-popover-item--active bg-accent/50'
              )}
            >
              <span className="text-xs">{opt.label}</span>
              <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
            </button>
          ))}
        </div>
      </UnderlayCell>

      <UnderlayCell
        icon={Database}
        label="上下文范围"
        value={contextLabel}
        open={openKey === 'context'}
        onOpenChange={(o) => setCellOpen('context', o)}
      >
        <div className="px-2 py-1.5 text-[11px] text-muted-foreground leading-relaxed max-w-[200px]">
          {workspace?.projectDirectory ? (
            <>
              当前按<strong className="text-foreground font-medium"> 项目工作区 </strong>
              注入上下文
              {workspace.name ? `（${workspace.name}）` : ''}。
            </>
          ) : (
            <>当前无绑定项目目录，上下文以会话与全局记忆为主。</>
          )}
        </div>
      </UnderlayCell>
    </div>
  )
}
