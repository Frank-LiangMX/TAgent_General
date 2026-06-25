/**
 * AutomationFormView - 定时任务编辑器
 */

import { useAtomValue } from 'jotai'
import { Loader2, Save } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import type {
  Automation,
  AutomationNotificationTrigger,
  AutomationPermissionMode,
  AutomationSessionMode,
  CreateAutomationInput,
  UpdateAutomationInput,
} from '@tagent/shared'
import {
  AUTOMATION_DEFAULT_PERMISSION_MODE,
  AUTOMATION_DEFAULT_SESSION_MODE,
  computeNextRunAt,
  formatScheduleLabel,
} from '@tagent/shared'

import {
  agentChannelIdAtom,
  agentModelIdAtom,
  agentWorkspacesAtom,
  currentAgentWorkspaceIdAtom,
} from '@/atoms/agent-atoms'
import { channelsAtom } from '@/atoms/model-atoms'
import { createAutomation, updateAutomation } from '@/atoms/automation-atoms'
import { RunHistoryPanel } from '@/components/automation/RunHistoryPanel'
import { ScrollProgressContainer } from '@/components/ui/scroll-progress-container'
import { ScheduleEditor, type ScheduleEditorValue } from '@/components/automation/ScheduleEditor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useOpenSession } from '@/hooks/useOpenSession'
import { cn } from '@/lib/utils'

export type AutomationSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export interface AutomationFormDraft {
  name: string
  prompt: string
  schedule: ScheduleEditorValue
  channelId: string
  modelId?: string
  workspaceId: string
  sessionMode: AutomationSessionMode
  permissionMode: AutomationPermissionMode
  maxRuns?: number
  notificationSystem: boolean
  notificationFeishuEnabled: boolean
  notificationFeishuChatId: string
  notificationTrigger: AutomationNotificationTrigger
}

function buildNotificationFromDraft(
  draft: AutomationFormDraft
): CreateAutomationInput['notification'] {
  return {
    system: draft.notificationSystem,
    trigger: draft.notificationTrigger,
    feishu: draft.notificationFeishuEnabled
      ? { enabled: true, chatId: draft.notificationFeishuChatId.trim() || undefined }
      : { enabled: false },
  }
}

interface AutomationFormViewProps {
  mode: 'create' | 'edit'
  automation?: Automation
  onSaved: (automation: Automation) => void
  onCancelCreate?: () => void
}

export function createEmptyDraft(defaults: {
  channelId: string
  modelId?: string
  workspaceId: string
}): AutomationFormDraft {
  return {
    name: '',
    prompt: '',
    schedule: {
      scheduleType: 'daily',
      intervalMinutes: 60,
      timeOfDay: '20:00',
      dayOfWeek: 1,
      dayOfMonth: 1,
    },
    channelId: defaults.channelId,
    modelId: defaults.modelId,
    workspaceId: defaults.workspaceId,
    sessionMode: AUTOMATION_DEFAULT_SESSION_MODE,
    permissionMode: AUTOMATION_DEFAULT_PERMISSION_MODE,
    notificationSystem: true,
    notificationFeishuEnabled: false,
    notificationFeishuChatId: '',
    notificationTrigger: 'always',
  }
}

export function automationToDraft(automation: Automation): AutomationFormDraft {
  return {
    name: automation.name,
    prompt: automation.prompt,
    schedule: {
      scheduleType: automation.scheduleType,
      intervalMinutes: automation.intervalMinutes,
      timeOfDay: automation.timeOfDay,
      dayOfWeek: automation.dayOfWeek,
      dayOfMonth: automation.dayOfMonth,
      scheduledAt: automation.scheduledAt,
    },
    channelId: automation.channelId,
    modelId: automation.modelId,
    workspaceId: automation.workspaceId ?? '',
    sessionMode: automation.sessionMode ?? AUTOMATION_DEFAULT_SESSION_MODE,
    permissionMode: automation.permissionMode ?? AUTOMATION_DEFAULT_PERMISSION_MODE,
    maxRuns: automation.maxRuns,
    notificationSystem: automation.notification?.system ?? true,
    notificationFeishuEnabled: automation.notification?.feishu?.enabled ?? false,
    notificationFeishuChatId: automation.notification?.feishu?.chatId ?? '',
    notificationTrigger: automation.notification?.trigger ?? 'always',
  }
}

export function AutomationFormView({
  mode,
  automation,
  onSaved,
  onCancelCreate,
}: AutomationFormViewProps): React.ReactElement {
  const channels = useAtomValue(channelsAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const defaultChannelId = useAtomValue(agentChannelIdAtom)
  const defaultModelId = useAtomValue(agentModelIdAtom)
  const defaultWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const openSession = useOpenSession()

  const [draft, setDraft] = React.useState<AutomationFormDraft>(() =>
    mode === 'edit' && automation
      ? automationToDraft(automation)
      : createEmptyDraft({
          channelId: defaultChannelId ?? '',
          modelId: defaultModelId ?? undefined,
          workspaceId: defaultWorkspaceId ?? '',
        })
  )
  const [saveState, setSaveState] = React.useState<AutomationSaveState>('idle')
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (mode === 'edit' && automation) {
      setDraft(automationToDraft(automation))
      setSaveState('idle')
      setErrorMessage(null)
    }
  }, [mode, automation])

  const markDirty = (): void => {
    setSaveState((prev) => (prev === 'saving' ? prev : 'dirty'))
    setErrorMessage(null)
  }

  const patchDraft = (partial: Partial<AutomationFormDraft>): void => {
    setDraft((prev) => ({ ...prev, ...partial }))
    markDirty()
  }

  const channelModels = React.useMemo(() => {
    const channel = channels.find((c) => c.id === draft.channelId)
    return channel?.models.filter((m) => m.enabled) ?? []
  }, [channels, draft.channelId])

  const previewNextRunAt = React.useMemo(() => {
    const ts = computeNextRunAt(
      {
        scheduleType: draft.schedule.scheduleType,
        intervalMinutes: draft.schedule.intervalMinutes,
        timeOfDay: draft.schedule.timeOfDay,
        dayOfWeek: draft.schedule.dayOfWeek,
        dayOfMonth: draft.schedule.dayOfMonth,
        scheduledAt: draft.schedule.scheduledAt,
        enabled: true,
        runCount: automation?.runCount ?? 0,
        maxRuns: draft.maxRuns,
      },
      Date.now()
    )
    return ts > 0 ? new Date(ts).toLocaleString('zh-CN') : '—'
  }, [draft, automation?.runCount])

  const handleSave = async (): Promise<void> => {
    if (!draft.name.trim()) {
      setErrorMessage('请填写任务名称')
      setSaveState('error')
      return
    }
    if (!draft.prompt.trim()) {
      setErrorMessage('请填写任务指令')
      setSaveState('error')
      return
    }
    if (!draft.channelId) {
      setErrorMessage('请选择 AI 渠道')
      setSaveState('error')
      return
    }
    if (!draft.workspaceId) {
      setErrorMessage('请选择工作区')
      setSaveState('error')
      return
    }

    setSaveState('saving')
    setErrorMessage(null)

    try {
      const schedule = draft.schedule
      if (mode === 'create') {
        const input: CreateAutomationInput = {
          name: draft.name.trim(),
          prompt: draft.prompt.trim(),
          scheduleType: schedule.scheduleType,
          intervalMinutes: schedule.intervalMinutes,
          timeOfDay: schedule.timeOfDay,
          dayOfWeek: schedule.dayOfWeek,
          dayOfMonth: schedule.dayOfMonth,
          scheduledAt: schedule.scheduledAt,
          maxRuns: draft.maxRuns,
          channelId: draft.channelId,
          modelId: draft.modelId,
          workspaceId: draft.workspaceId,
          sessionMode: draft.sessionMode,
          permissionMode: draft.permissionMode,
          notification: buildNotificationFromDraft(draft),
        }
        const created = await createAutomation(input)
        setSaveState('saved')
        toast.success('定时任务已创建')
        onSaved(created)
        return
      }

      if (!automation) return
      const input: UpdateAutomationInput = {
        id: automation.id,
        name: draft.name.trim(),
        prompt: draft.prompt.trim(),
        scheduleType: schedule.scheduleType,
        intervalMinutes: schedule.intervalMinutes,
        timeOfDay: schedule.timeOfDay,
        dayOfWeek: schedule.dayOfWeek,
        dayOfMonth: schedule.dayOfMonth,
        scheduledAt: schedule.scheduledAt,
        maxRuns: draft.maxRuns,
        channelId: draft.channelId,
        modelId: draft.modelId,
        workspaceId: draft.workspaceId,
        sessionMode: draft.sessionMode,
        permissionMode: draft.permissionMode,
        notification: buildNotificationFromDraft(draft),
      }
      const updated = await updateAutomation(input)
      setSaveState('saved')
      toast.success('已保存')
      onSaved(updated)
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存失败'
      setErrorMessage(message)
      setSaveState('error')
      toast.error(message)
    }
  }

  const saveLabel = getSaveLabel(saveState)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <ScrollProgressContainer className="min-h-0 flex-1" contentClassName="px-5 py-5">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <section className="rounded-2xl bg-card/50 p-4 shadow-sm">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-foreground/80">任务名称</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => patchDraft({ name: e.target.value })}
                  placeholder="例如：每天整理今日会话"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-foreground/80">任务指令</Label>
                <Textarea
                  value={draft.prompt}
                  onChange={(e) => patchDraft({ prompt: e.target.value })}
                  placeholder="触发时发送给 Agent 的指令（支持 Markdown）"
                  className="min-h-[140px] resize-y text-sm leading-relaxed"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-card/50 p-4 shadow-sm">
            <h3 className="mb-3 text-xs font-medium text-foreground/80">调度</h3>
            <ScheduleEditor
              value={draft.schedule}
              onChange={(schedule) => {
                setDraft((prev) => ({ ...prev, schedule }))
                markDirty()
              }}
            />
            <p className="mt-3 text-[10px] text-muted-foreground">
              预览下次运行：{previewNextRunAt}（
              {formatScheduleLabel({ ...draft.schedule, enabled: true })}）
            </p>
          </section>

          <section className="rounded-2xl bg-card/50 p-4 shadow-sm">
            <h3 className="mb-3 text-xs font-medium text-foreground/80">执行环境</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldSelect
                label="AI 渠道"
                value={draft.channelId}
                onValueChange={(channelId) => {
                  const channel = channels.find((c) => c.id === channelId)
                  const firstModel = channel?.models.find((m) => m.enabled)
                  patchDraft({ channelId, modelId: firstModel?.id })
                }}
                options={channels
                  .filter((c) => c.enabled)
                  .map((c) => ({ value: c.id, label: c.name }))}
                placeholder="选择渠道"
              />
              <FieldSelect
                label="模型"
                value={draft.modelId ?? ''}
                onValueChange={(modelId) => patchDraft({ modelId: modelId || undefined })}
                options={channelModels.map((m) => ({ value: m.id, label: m.name }))}
                placeholder="继承渠道默认"
              />
              <FieldSelect
                label="工作区"
                value={draft.workspaceId}
                onValueChange={(workspaceId) => patchDraft({ workspaceId })}
                options={workspaces.map((w) => ({ value: w.id, label: w.name }))}
                placeholder="选择工作区"
              />
              <FieldSelect
                label="会话模式"
                value={draft.sessionMode}
                onValueChange={(v) => patchDraft({ sessionMode: v as AutomationSessionMode })}
                options={[
                  { value: 'daily', label: '同日复用（推荐）' },
                  { value: 'reuse', label: '始终复用' },
                ]}
              />
              <FieldSelect
                label="权限模式"
                value={draft.permissionMode}
                onValueChange={(v) => patchDraft({ permissionMode: v as AutomationPermissionMode })}
                options={[
                  { value: 'bypassPermissions', label: '无人值守（自动允许）' },
                  { value: 'auto', label: '自动审批' },
                ]}
              />
              <div className="space-y-2">
                <Label className="text-xs text-foreground/80">最大运行次数（可选）</Label>
                <Input
                  type="number"
                  min={1}
                  value={draft.maxRuns ?? ''}
                  placeholder="不限"
                  className="h-9 text-xs"
                  onChange={(e) => {
                    const raw = e.target.value
                    patchDraft({ maxRuns: raw ? Number(raw) : undefined })
                  }}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl bg-card/50 p-4 shadow-sm">
            <p className="text-xs font-medium text-foreground/80">运行通知</p>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-foreground/80">系统通知</p>
                <p className="text-[10px] text-muted-foreground">运行完成后发送桌面通知</p>
              </div>
              <Switch
                checked={draft.notificationSystem}
                onCheckedChange={(checked) => patchDraft({ notificationSystem: checked })}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-foreground/80">飞书通知</p>
                <p className="text-[10px] text-muted-foreground">向指定群聊发送卡片消息</p>
              </div>
              <Switch
                checked={draft.notificationFeishuEnabled}
                onCheckedChange={(checked) => patchDraft({ notificationFeishuEnabled: checked })}
              />
            </div>
            {draft.notificationFeishuEnabled ? (
              <div className="space-y-2">
                <Label className="text-xs text-foreground/80">飞书 chat_id</Label>
                <Input
                  value={draft.notificationFeishuChatId}
                  onChange={(e) => patchDraft({ notificationFeishuChatId: e.target.value })}
                  placeholder="oc_xxx 或群聊 ID"
                  className="h-9 text-xs"
                />
              </div>
            ) : null}
            <FieldSelect
              label="通知时机"
              value={draft.notificationTrigger}
              onValueChange={(v) =>
                patchDraft({ notificationTrigger: v as AutomationNotificationTrigger })
              }
              options={[
                { value: 'always', label: '每次运行' },
                { value: 'success', label: '仅成功' },
                { value: 'error', label: '仅失败' },
              ]}
            />
          </section>

          {mode === 'edit' && automation ? (
            <section className="rounded-2xl bg-card/50 p-4 shadow-sm">
              <h3 className="mb-3 text-xs font-medium text-foreground/80">运行历史</h3>
              <RunHistoryPanel
                runs={automation.runHistory}
                onOpenSession={(sessionId) => {
                  openSession('agent', sessionId, automation.name)
                }}
              />
            </section>
          ) : null}
        </div>
      </ScrollProgressContainer>

      <div className="shrink-0 border-t border-border/40 bg-background/80 px-5 py-3 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0 text-[10px] text-muted-foreground">
            {errorMessage ? <span className="text-destructive">{errorMessage}</span> : null}
            {!errorMessage && saveState === 'saved' ? (
              <span className="text-emerald-600">已保存</span>
            ) : null}
            {!errorMessage && saveState === 'dirty' ? <span>有未保存的更改</span> : null}
          </div>
          <div className="flex items-center gap-2">
            {mode === 'create' && onCancelCreate ? (
              <Button type="button" variant="ghost" size="sm" onClick={onCancelCreate}>
                取消
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={saveState === 'saving'}
              onClick={() => void handleSave()}
              className={cn(saveState === 'dirty' && 'shadow-sm')}
            >
              {saveState === 'saving' ? (
                <Loader2 size={14} className="mr-1.5 animate-spin" />
              ) : (
                <Save size={14} className="mr-1.5" />
              )}
              {saveLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FieldSelect({
  label,
  value,
  onValueChange,
  options,
  placeholder,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  placeholder?: string
}): React.ReactElement {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-foreground/80">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-9 text-xs">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-xs">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function getSaveLabel(state: AutomationSaveState): string {
  switch (state) {
    case 'saving':
      return '保存中…'
    case 'saved':
      return '已保存'
    case 'error':
      return '重试保存'
    case 'dirty':
      return '保存更改'
    default:
      return '保存'
  }
}
