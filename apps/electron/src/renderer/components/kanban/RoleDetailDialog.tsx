/**
 * RoleDetailDialog — 数字员工档案详情弹窗
 *
 * 拟人化布局：
 * - 左侧：角色头像色块 + 基本信息 + 统计面板（从 getCrewStats 加载）
 * - 右侧：角色配置（systemPrompt / 模型池 / 权限 / 并发上限）
 *
 * 点击空白处或取消可关闭。
 */

import * as React from 'react'
import {
  Save,
  Plus,
  X,
  Users,
} from 'lucide-react'

import type {
  AgentRoleProfile,
  AgentRolePermissionMode,
  RoleWorkStats,
} from '@tagent/shared'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@tagent/ui'
import { RoleStatsCard } from './RoleStatsCard'
import { cn } from '@/lib/utils'

const PERMISSION_MODE_OPTIONS: Array<{ value: AgentRolePermissionMode; label: string; desc: string }> = [
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

/** 角色 ID → 小圆点颜色（中性简约） */
function roleDotColor(roleId: string): string {
  switch (roleId) {
    case 'coder': return 'bg-blue-400'
    case 'analyst': return 'bg-violet-400'
    case 'reviewer': return 'bg-amber-400'
    case 'writer': return 'bg-emerald-400'
    case 'doc-writer': return 'bg-teal-400'
    case 'data-analyst': return 'bg-cyan-400'
    case 'chat': return 'bg-pink-400'
    default: return 'bg-foreground/40'
  }
}

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
  onFieldChange: (field: keyof AgentRoleProfile, value: string | string[] | number | boolean) => void
  onAddModel: (modelId: string) => void
  onRemoveModel: (modelId: string) => void
}): React.ReactElement {
  const isBuiltin = BUILTIN_IDS.has(role.id)
  const dot = roleDotColor(role.id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[860px] h-[75vh] p-0 overflow-hidden flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{role.displayName}</DialogTitle>
          <DialogDescription>{role.description || `${role.displayName} 的角色配置与统计`}</DialogDescription>
        </DialogHeader>
        {/* 顶部：角色名 + 描述（右侧留空给关闭按钮） */}
        <div className="shrink-0 flex items-start gap-3 px-5 py-4 pr-12 border-b border-border/40">
          <span className={cn('size-3 rounded-full mt-1.5 shrink-0', dot)} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">{role.displayName}</div>
            <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {role.description}
            </div>
          </div>
        </div>

        {/* 主体：左侧统计 + 右侧配置 */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* 左侧：统计面板 + 基本信息 */}
          <div className="w-[280px] shrink-0 border-r border-border/40 flex flex-col overflow-hidden">
            {/* 统计区：可滚动 */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4">
                {/* 统计标题 */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={cn('size-2 rounded-full shrink-0', dot)} aria-hidden />
                  <span className="text-[11px] font-semibold text-foreground">员工档案</span>
                </div>
                {stats ? (
                  <RoleStatsCard stats={stats} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Users className="size-7 text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">暂无上岗记录</p>
                  </div>
                )}

                {/* 分隔线 */}
                <div className="my-3 border-t border-border/40" />

                {/* 基本信息 */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium text-foreground mb-2">基本信息</div>
                  <InfoRow label="角色 ID">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Badge variant="outline" className="text-[10px] font-mono">{role.id}</Badge>
                      {isBuiltin && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          内置
                        </Badge>
                      )}
                    </div>
                  </InfoRow>
                  <InfoRow label="权限">
                    <span className="text-xs">
                      {PERMISSION_MODE_OPTIONS.find((o) => o.value === role.permissionMode)?.label ?? role.permissionMode}
                    </span>
                  </InfoRow>
                  <InfoRow label="并发">
                    <span className="text-xs">{role.maxConcurrentPerModel}</span>
                  </InfoRow>
                  <InfoRow label="模型池">
                    <span className="text-xs">{role.modelPool.length} 个</span>
                  </InfoRow>
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* 右侧：配置编辑 */}
          <ScrollArea className="flex-1 min-w-0">
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <CfgField label="显示名">
                  <Input
                    value={role.displayName}
                    onChange={(e) => onFieldChange('displayName', e.target.value)}
                    className="h-8 text-xs"
                  />
                </CfgField>
                <CfgField label="职责描述">
                  <Input
                    value={role.description}
                    onChange={(e) => onFieldChange('description', e.target.value)}
                    className="h-8 text-xs"
                  />
                </CfgField>
              </div>

              <CfgField label="系统提示词（注入 worker 子会话）">
                <Textarea
                  value={role.systemPrompt}
                  onChange={(e) => onFieldChange('systemPrompt', e.target.value)}
                  className="min-h-[160px] text-xs font-mono"
                  placeholder="定义角色的专业能力边界、输出格式、约束..."
                />
              </CfgField>

              {/* 模型池 */}
              <CfgField label="模型池（优先级顺序）">
                <div className="space-y-1">
                  {role.modelPool.length === 0 ? (
                    <p className="py-2 text-center text-xs text-muted-foreground">
                      模型池为空，将使用渠道默认模型
                    </p>
                  ) : (
                    role.modelPool.map((modelId, idx) => {
                      const info = availableModels.find((m) => m.id === modelId)
                      return (
                        <div
                          key={modelId}
                          className="flex items-center gap-2 rounded-md bg-muted/30 px-2.5 py-1.5"
                        >
                          <span className="w-4 shrink-0 text-center text-[10px] tabular-nums text-muted-foreground">
                            {idx + 1}
                          </span>
                          <span className="flex-1 min-w-0 truncate text-xs font-mono text-foreground/80">
                            {info?.label ?? modelId}
                          </span>
                          <button
                            type="button"
                            onClick={() => onRemoveModel(modelId)}
                            className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 shrink-0"
                            title="移除"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
                <ModelPoolAddSelect
                  availableModels={availableModels}
                  currentPool={role.modelPool}
                  onAdd={onAddModel}
                />
              </CfgField>

              <div className="grid grid-cols-2 gap-4">
                <CfgField label="权限模式">
                  <Select
                    value={role.permissionMode}
                    onValueChange={(v) => onFieldChange('permissionMode', v as AgentRolePermissionMode)}
                  >
                    <SelectTrigger className="h-8 w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERMISSION_MODE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="text-xs">
                            <div>{opt.label}</div>
                            <div className="text-muted-foreground text-[10px]">{opt.desc}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CfgField>

                <CfgField label="单模型并发上限">
                  <Select
                    value={String(role.maxConcurrentPerModel)}
                    onValueChange={(v) => onFieldChange('maxConcurrentPerModel', Number(v))}
                  >
                    <SelectTrigger className="h-8 w-full text-xs">
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
                  <p className="mt-1 text-xs text-muted-foreground">避免同模型并行降智，默认 2</p>
                </CfgField>
              </div>

              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={role.fallbackToChannelDefault}
                  onChange={(e) => onFieldChange('fallbackToChannelDefault', e.target.checked)}
                  className="size-3.5 rounded border-muted-foreground/30"
                />
                模型池全满时回退到渠道默认模型
              </label>
            </div>
          </ScrollArea>
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between border-t border-border/40 px-5 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {isBuiltin ? '内置角色' : '自定义角色'}
            </span>
            {!isBuiltin && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 border-red-500/25 text-xs text-red-600 hover:bg-red-500/8 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                onClick={() => void onDelete()}
              >
                <X className="mr-1 size-3" />
                删除角色
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button size="sm" className="h-7 text-xs" disabled={saving} onClick={() => void onSave()}>
              <Save className="mr-1 size-3" />
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  )
}

function CfgField({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-foreground/80">{label}</label>
      {children}
    </div>
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
    <div className="mt-1.5 flex items-center gap-1.5">
      <Plus className="size-3 text-muted-foreground shrink-0" />
      <Select value="" onValueChange={(v) => v && onAdd(v)}>
        <SelectTrigger className="h-7 flex-1 text-xs text-muted-foreground hover:text-foreground">
          <SelectValue placeholder="添加模型到池..." />
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
