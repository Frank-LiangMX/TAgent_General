/**
 * RoleDetailDialog — 角色库档案详情
 *
 * 与 Worker 详情同壳：头栏 + 左栏档案 + 右栏配置 + 底栏操作。
 * 表面用沉底色，避免模型池 / 输入框像白卡片发亮。
 */

import * as React from 'react'
import { Plus, Save, Trash2, Users, X } from 'lucide-react'

import type { AgentRoleProfile, AgentRolePermissionMode, RoleWorkStats } from '@tagent/shared'
import { estimateTokenCount } from '@tagent/shared'
import {
  Button,
  Dialog,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@tagent/ui'
import { RoleStatsCard } from './RoleStatsCard'
import { roleAvatarSpec } from '@/lib/kanban-crew-status'
import { cn } from '@/lib/utils'

import {
  KanbanDetailA11yTitle,
  KanbanDetailBody,
  KanbanDetailContent,
  KanbanDetailField,
  KanbanDetailFooter,
  KanbanDetailHeader,
  KanbanDetailMain,
  KanbanDetailMetaItem,
} from './kanban-detail-shell'

const PERMISSION_MODE_OPTIONS: Array<{
  value: AgentRolePermissionMode
  label: string
  desc: string
}> = [
  { value: 'bypassPermissions', label: '自动放行', desc: '无人值守写操作必备' },
  { value: 'auto', label: '需审批', desc: '写操作走权限弹窗（审核角色用）' },
]
const MAX_CONCURRENT_OPTIONS = [1, 2, 3, 4, 5]
const BUILTIN_IDS = new Set([
  'analyst',
  'coder',
  'reviewer',
  'writer',
  'generalist',
  'data-analyst',
  'chat',
  'doc-writer',
])

/** 详情表单控件：沉底、无投影，避免浅色主题下发白 */
const fieldControlClass =
  'border-foreground/[0.08] bg-foreground/[0.04] shadow-none focus-visible:ring-foreground/15'

export function RoleDetailDialog({
  role,
  stats,
  open,
  onOpenChange,
  availableModels,
  saving,
  onSave,
  onDelete,
  onFieldChange,
  onAddModel,
  onRemoveModel,
}: {
  role: AgentRoleProfile
  stats?: RoleWorkStats
  open: boolean
  onOpenChange: (open: boolean) => void
  availableModels: Array<{ id: string; label: string }>
  saving: boolean
  onSave: () => Promise<void>
  onDelete: () => Promise<void>
  onFieldChange: (
    field: keyof AgentRoleProfile,
    value: string | string[] | number | boolean
  ) => void
  onAddModel: (modelId: string) => void
  onRemoveModel: (modelId: string) => void
}): React.ReactElement {
  const isBuiltin = BUILTIN_IDS.has(role.id)
  const { wrap: avatarWrap, Icon: RoleIcon } = roleAvatarSpec(role.id)
  const permissionLabel =
    PERMISSION_MODE_OPTIONS.find((o) => o.value === role.permissionMode)?.label ??
    role.permissionMode
  const systemPromptTokens = estimateTokenCount(role.systemPrompt ?? '')

  const aside = (
    <>
      {stats ? (
        <RoleStatsCard stats={stats} />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-[14px] border border-foreground/[0.06] bg-foreground/[0.03] py-8 text-center">
          <Users className="mb-2 size-6 text-foreground/25" />
          <p className="text-[12px] text-foreground/45">暂无上岗记录</p>
        </div>
      )}

      <div className="space-y-3">
        <KanbanDetailMetaItem label="角色 ID" value={role.id} mono />
        <KanbanDetailMetaItem label="权限" value={permissionLabel} />
        <KanbanDetailMetaItem label="并发" value={String(role.maxConcurrentPerModel)} />
        <KanbanDetailMetaItem label="模型池" value={`${role.modelPool.length} 个`} />
      </div>
    </>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <KanbanDetailContent
        className="h-[78vh] max-w-[920px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <KanbanDetailA11yTitle
          title={role.displayName}
          description={role.description || `${role.displayName} 的角色配置与统计`}
        />
        <KanbanDetailHeader
          icon={
            <div
              className={cn(
                'flex size-10 items-center justify-center rounded-[12px]',
                avatarWrap
              )}
            >
              <RoleIcon className="size-4" strokeWidth={1.75} />
            </div>
          }
          title={role.displayName}
          description={role.description}
          meta={
            <span className="rounded-full bg-foreground/[0.06] px-1.5 py-0.5 text-[9px] text-foreground/50">
              {isBuiltin ? '内置' : '自定义'}
            </span>
          }
        />

        <KanbanDetailBody aside={aside}>
          <KanbanDetailMain className="space-y-5">
            <section className="space-y-3">
              <KanbanDetailField label="显示名">
                <Input
                  value={role.displayName}
                  onChange={(e) => onFieldChange('displayName', e.target.value)}
                  className={cn('h-8 text-xs', fieldControlClass)}
                />
              </KanbanDetailField>
              <KanbanDetailField label="职责描述">
                <Input
                  value={role.description}
                  onChange={(e) => onFieldChange('description', e.target.value)}
                  className={cn('h-8 text-xs', fieldControlClass)}
                />
              </KanbanDetailField>
            </section>

            <KanbanDetailField
              label="系统提示词"
              hint={`约 ${systemPromptTokens.toLocaleString()} tokens · 注入 worker`}
            >
              <Textarea
                value={role.systemPrompt}
                onChange={(e) => onFieldChange('systemPrompt', e.target.value)}
                className={cn(
                  'min-h-[160px] resize-y font-mono text-[11px] leading-relaxed',
                  fieldControlClass
                )}
                placeholder="定义角色的专业能力边界、输出格式、约束…"
              />
            </KanbanDetailField>

            <section className="space-y-3">
              <KanbanDetailField label="模型池" hint="优先级从上到下">
                <div className="overflow-hidden rounded-[12px] border border-foreground/[0.08] bg-foreground/[0.03]">
                  {role.modelPool.length === 0 ? (
                    <p className="py-5 text-center text-[12px] text-foreground/40">
                      池为空时使用渠道默认模型
                    </p>
                  ) : (
                    role.modelPool.map((modelId, idx) => {
                      const info = availableModels.find((m) => m.id === modelId)
                      return (
                        <div
                          key={modelId}
                          className="flex items-center gap-2 border-b border-foreground/[0.05] px-2.5 py-1.5 last:border-b-0"
                        >
                          <span className="w-4 shrink-0 text-center text-[10px] tabular-nums text-foreground/35">
                            {idx + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-foreground/80">
                            {info?.label ?? modelId}
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => onRemoveModel(modelId)}
                                className="shrink-0 rounded-full p-1 text-foreground/35 hover:bg-red-500/10 hover:text-red-500"
                                aria-label="移除"
                              >
                                <X className="size-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">移除</TooltipContent>
                          </Tooltip>
                        </div>
                      )
                    })
                  )}
                  <div className="border-t border-foreground/[0.05] px-2 py-1.5">
                    <ModelPoolAddSelect
                      availableModels={availableModels}
                      currentPool={role.modelPool}
                      onAdd={onAddModel}
                    />
                  </div>
                </div>
              </KanbanDetailField>

              <div className="grid grid-cols-2 gap-3">
                <KanbanDetailField label="权限模式">
                  <Select
                    value={role.permissionMode}
                    onValueChange={(v) =>
                      onFieldChange('permissionMode', v as AgentRolePermissionMode)
                    }
                  >
                    <SelectTrigger className={cn('h-8 w-full text-xs', fieldControlClass)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERMISSION_MODE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="text-xs">
                            <div>{opt.label}</div>
                            <div className="text-[10px] text-foreground/45">{opt.desc}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </KanbanDetailField>

                <KanbanDetailField label="单模型并发" hint="默认 2">
                  <Select
                    value={String(role.maxConcurrentPerModel)}
                    onValueChange={(v) => onFieldChange('maxConcurrentPerModel', Number(v))}
                  >
                    <SelectTrigger className={cn('h-8 w-full text-xs', fieldControlClass)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MAX_CONCURRENT_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </KanbanDetailField>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-[12px] border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-foreground/90">回退渠道默认模型</div>
                  <div className="text-[11px] text-foreground/45">模型池全满时允许使用渠道默认</div>
                </div>
                <Switch
                  checked={role.fallbackToChannelDefault}
                  onCheckedChange={(v) => onFieldChange('fallbackToChannelDefault', v)}
                />
              </label>
            </section>
          </KanbanDetailMain>
        </KanbanDetailBody>

        <KanbanDetailFooter
          left={
            !isBuiltin ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 rounded-full px-3 text-xs text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400"
                onClick={() => void onDelete()}
              >
                <Trash2 className="size-3" />
                删除角色
              </Button>
            ) : (
              <span className="text-[11px] text-foreground/40">内置角色不可删除</span>
            )
          }
          right={
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1 rounded-full px-3.5 text-xs"
                disabled={saving}
                onClick={() => void onSave()}
              >
                <Save className="size-3" />
                {saving ? '保存中…' : '保存'}
              </Button>
            </>
          }
        />
      </KanbanDetailContent>
    </Dialog>
  )
}

function ModelPoolAddSelect({
  availableModels,
  currentPool,
  onAdd,
}: {
  availableModels: Array<{ id: string; label: string }>
  currentPool: string[]
  onAdd: (modelId: string) => void
}): React.ReactElement {
  const options = availableModels.filter((m) => !currentPool.includes(m.id))
  return (
    <div className="flex items-center gap-1.5">
      <Plus className="size-3 shrink-0 text-foreground/30" />
      <Select value="" onValueChange={(v) => v && onAdd(v)}>
        <SelectTrigger className="h-7 flex-1 border-0 bg-transparent text-xs text-foreground/50 shadow-none hover:text-foreground focus:ring-0">
          <SelectValue placeholder="添加模型到池…" />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <SelectItem value="__none__" disabled>
              （无可用模型）
            </SelectItem>
          ) : (
            options.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label} ({m.id})
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
