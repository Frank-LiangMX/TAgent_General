/**
 * AgentRoleSettings - 角色库设置页
 *
 * 管理看板 worker 的角色定义（systemPrompt + 模型池 + 权限模式）。
 * 与 SOUL.md 分层：SOUL.md 是全局身份层，角色库是任务职责层。
 *
 * 4 个内置角色（analyst/coder/reviewer/writer）可编辑 systemPrompt 和模型池。
 * 内置角色不可删除，可重置。
 *
 * 存储：~/.tagent/agent-roles.json（通过 IPC 调用 agent-role-service）
 */

import * as React from 'react'
import {
  RotateCcw,
  Save,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Users,
  Lock,
  Plus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import type { AgentRoleProfile, AgentRolePermissionMode, Channel } from '@tagent/shared'
import { Button, Badge, Input, Textarea } from '@tagent/ui'
import { cn } from '@/lib/utils'
import { useRefreshAgentRoles } from '@/atoms/agent-role-atoms'

/** 权限模式选项 */
const PERMISSION_MODE_OPTIONS: Array<{
  value: AgentRolePermissionMode
  label: string
  desc: string
}> = [
  { value: 'bypassPermissions', label: '自动放行', desc: '无人值守写操作必备' },
  { value: 'auto', label: '需审批', desc: '写操作走权限弹窗（审核角色用）' },
]

/** 单模型并发上限选项 */
const MAX_CONCURRENT_OPTIONS = [1, 2, 3, 4, 5]

export function AgentRoleSettings(): React.ReactElement {
  const [roles, setRoles] = React.useState<AgentRoleProfile[]>([])
  const [loading, setLoading] = React.useState(true)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<Record<string, AgentRoleProfile>>({})
  const [saving, setSaving] = React.useState<string | null>(null)
  const [channels, setChannels] = React.useState<Channel[]>([])
  const refreshAgentRoles = useRefreshAgentRoles()

  // 加载渠道列表（用于模型池下拉选项）
  React.useEffect(() => {
    window.electronAPI
      .listChannels()
      .then((list: Channel[]) => setChannels(list.filter((c) => c.enabled)))
      .catch((err) => console.error('[角色库] 加载渠道失败:', err))
  }, [])

  /** 所有启用渠道的可用模型列表（去重，用于模型池下拉选项） */
  const availableModels = React.useMemo(() => {
    const seen = new Set<string>()
    const result: Array<{ id: string; label: string }> = []
    for (const ch of channels) {
      for (const m of ch.models) {
        if (!m.enabled) continue
        if (seen.has(m.id)) continue
        seen.add(m.id)
        result.push({ id: m.id, label: m.name || m.id })
      }
    }
    return result
  }, [channels])

  // 加载角色列表
  const loadRoles = React.useCallback(async () => {
    setLoading(true)
    try {
      const list = await window.electronAPI.agentRole.list()
      setRoles(list)
      // 初始化编辑态（深拷贝，避免直接改原数据）
      const editMap: Record<string, AgentRoleProfile> = {}
      for (const r of list) {
        editMap[r.id] = { ...r, modelPool: [...r.modelPool] }
      }
      setEditing(editMap)
    } catch (err) {
      toast.error('加载角色库失败', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadRoles()
  }, [loadRoles])

  const handleToggleExpand = (roleId: string): void => {
    setExpandedId((prev) => (prev === roleId ? null : roleId))
  }

  const handleFieldChange = (
    roleId: string,
    field: keyof AgentRoleProfile,
    value: string | string[] | number | boolean
  ): void => {
    const role = editing[roleId]
    if (!role) return
    setEditing((prev) => ({
      ...prev,
      [roleId]: { ...role, [field]: value },
    }))
  }

  /** 添加模型到池（追加到末尾，优先级最低） */
  const handleAddModel = (roleId: string, modelId: string): void => {
    if (!modelId) return
    const role = editing[roleId]
    if (!role) return
    if (role.modelPool.includes(modelId)) {
      toast.warning('该模型已在池中')
      return
    }
    setEditing((prev) => ({
      ...prev,
      [roleId]: { ...role, modelPool: [...role.modelPool, modelId] },
    }))
  }

  /** 从池中移除模型 */
  const handleRemoveModel = (roleId: string, modelId: string): void => {
    const role = editing[roleId]
    if (!role) return
    setEditing((prev) => ({
      ...prev,
      [roleId]: { ...role, modelPool: role.modelPool.filter((m) => m !== modelId) },
    }))
  }

  /** 上移模型（提高优先级） */
  const handleMoveUp = (roleId: string, index: number): void => {
    if (index === 0) return
    const role = editing[roleId]
    if (!role) return
    const pool = [...role.modelPool]
    ;[pool[index - 1]!, pool[index]!] = [pool[index]!, pool[index - 1]!]
    setEditing((prev) => ({ ...prev, [roleId]: { ...role, modelPool: pool } }))
  }

  /** 下移模型（降低优先级） */
  const handleMoveDown = (roleId: string, index: number): void => {
    const role = editing[roleId]
    if (!role) return
    const pool = [...role.modelPool]
    if (index >= pool.length - 1) return
    ;[pool[index + 1]!, pool[index]!] = [pool[index]!, pool[index + 1]!]
    setEditing((prev) => ({ ...prev, [roleId]: { ...role, modelPool: pool } }))
  }

  const handleSave = async (roleId: string): Promise<void> => {
    const role = editing[roleId]
    if (!role) return
    setSaving(roleId)
    try {
      const updated = await window.electronAPI.agentRole.save({ role })
      setRoles(updated)
      refreshAgentRoles() // 刷新看板任务卡片的角色映射缓存
      toast.success(`已保存角色：${role.displayName}`)
    } catch (err) {
      toast.error('保存失败', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSaving(null)
    }
  }

  const handleReset = async (): Promise<void> => {
    if (!confirm('确定重置所有角色为内置默认值？自定义角色将丢失。')) return
    try {
      const reset = await window.electronAPI.agentRole.resetDefault()
      setRoles(reset)
      refreshAgentRoles() // 刷新看板任务卡片的角色映射缓存
      const editMap: Record<string, AgentRoleProfile> = {}
      for (const r of reset) {
        editMap[r.id] = { ...r, modelPool: [...r.modelPool] }
      }
      setEditing(editMap)
      toast.success('已重置为默认角色')
    } catch (err) {
      toast.error('重置失败', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        加载中...
      </div>
    )
  }

  return (
    <div className="space-y-4 px-1 py-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Users className="size-4" />
            角色库
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            定义看板 worker 的专业能力。任务绑定 roleId 后，worker 注入角色 systemPrompt +
            模型池分配。
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-8" onClick={() => void handleReset()}>
          <RotateCcw className="mr-1.5 size-3" />
          重置默认
        </Button>
      </div>

      {/* 角色卡片列表 */}
      <div className="space-y-2">
        {roles.map((role) => {
          const editRole = editing[role.id] ?? role
          const isExpanded = expandedId === role.id
          const isDirty = JSON.stringify(editRole) !== JSON.stringify(role)

          return (
            <div
              key={role.id}
              className="session-glass rounded-glass-popover border border-border/40 overflow-hidden"
            >
              {/* 卡片头 */}
              <button
                type="button"
                onClick={() => handleToggleExpand(role.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
              >
                {isExpanded ? (
                  <ChevronDown className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-4 text-muted-foreground" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {editRole.displayName}
                    </span>
                    <Badge variant="outline" className="text-[9px] font-mono text-muted-foreground">
                      {editRole.id}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[9px]',
                        editRole.permissionMode === 'auto'
                          ? 'border-amber-500/30 text-amber-600 dark:text-amber-400'
                          : 'border-blue-500/30 text-blue-600 dark:text-blue-400'
                      )}
                    >
                      {editRole.permissionMode === 'auto' ? '需审批' : '自动放行'}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {editRole.description}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="font-mono">{editRole.modelPool.length}</span>
                  <span>模型</span>
                </div>
              </button>

              {/* 卡片体（展开时） */}
              {isExpanded && (
                <div className="border-t border-border/40 px-4 py-3 space-y-3 bg-muted/10">
                  {/* 显示名 */}
                  <Field label="显示名">
                    <Input
                      value={editRole.displayName}
                      onChange={(e) => handleFieldChange(role.id, 'displayName', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </Field>

                  {/* 描述 */}
                  <Field label="职责描述">
                    <Input
                      value={editRole.description}
                      onChange={(e) => handleFieldChange(role.id, 'description', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </Field>

                  {/* systemPrompt */}
                  <Field label="系统提示词（注入 worker 子会话）">
                    <Textarea
                      value={editRole.systemPrompt}
                      onChange={(e) => handleFieldChange(role.id, 'systemPrompt', e.target.value)}
                      className="min-h-[120px] text-xs font-mono"
                      placeholder="定义角色的专业能力边界、输出格式、约束..."
                    />
                  </Field>

                  {/* 模型池：列表 + 下拉添加（每行一个，从上到下优先级递减） */}
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-foreground/80">
                      模型池（从上到下优先级递减，上面的优先用）
                    </label>
                    <div className="space-y-1 rounded-glass-popover border border-border/40 bg-background/40 p-2">
                      {editRole.modelPool.length === 0 ? (
                        <p className="py-2 text-center text-[11px] text-muted-foreground">
                          模型池为空，dispatcher 将用渠道默认模型
                        </p>
                      ) : (
                        editRole.modelPool.map((modelId, idx) => {
                          const modelInfo = availableModels.find((m) => m.id === modelId)
                          return (
                            <div
                              key={modelId}
                              className="flex items-center gap-1.5 rounded-md bg-muted/30 px-2 py-1"
                            >
                              <span className="w-5 shrink-0 text-center text-[10px] tabular-nums text-muted-foreground">
                                {idx + 1}
                              </span>
                              <span className="flex-1 min-w-0 truncate text-xs font-mono text-foreground/80">
                                {modelInfo?.label ?? modelId}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleMoveUp(role.id, idx)}
                                disabled={idx === 0}
                                className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
                                title="上移（提高优先级）"
                              >
                                <ChevronUp className="size-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveDown(role.id, idx)}
                                disabled={idx === editRole.modelPool.length - 1}
                                className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
                                title="下移（降低优先级）"
                              >
                                <ChevronDown className="size-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveModel(role.id, modelId)}
                                className="rounded p-0.5 text-muted-foreground hover:text-red-500"
                                title="移除"
                              >
                                <X className="size-3" />
                              </button>
                            </div>
                          )
                        })
                      )}
                    </div>
                    {/* 添加模型下拉 */}
                    <ModelPoolAddSelect
                      availableModels={availableModels}
                      currentPool={editRole.modelPool}
                      onAdd={(modelId) => handleAddModel(role.id, modelId)}
                    />
                  </div>

                  {/* 权限模式 + 并发上限 */}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="权限模式">
                      <select
                        value={editRole.permissionMode}
                        onChange={(e) =>
                          handleFieldChange(
                            role.id,
                            'permissionMode',
                            e.target.value as AgentRolePermissionMode
                          )
                        }
                        className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                      >
                        {PERMISSION_MODE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {
                          PERMISSION_MODE_OPTIONS.find((o) => o.value === editRole.permissionMode)
                            ?.desc
                        }
                      </p>
                    </Field>

                    <Field label="单模型并发上限">
                      <select
                        value={String(editRole.maxConcurrentPerModel)}
                        onChange={(e) =>
                          handleFieldChange(
                            role.id,
                            'maxConcurrentPerModel',
                            Number(e.target.value)
                          )
                        }
                        className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                      >
                        {MAX_CONCURRENT_OPTIONS.map((n) => (
                          <option key={n} value={String(n)}>
                            {n}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        避免同模型并行降智，默认 2
                      </p>
                    </Field>
                  </div>

                  {/* 回退开关 */}
                  <label className="flex items-center gap-2 text-xs text-foreground/80">
                    <input
                      type="checkbox"
                      checked={editRole.fallbackToChannelDefault}
                      onChange={(e) =>
                        handleFieldChange(role.id, 'fallbackToChannelDefault', e.target.checked)
                      }
                      className="size-3.5 rounded"
                    />
                    模型池全满时回退到渠道默认模型
                  </label>

                  {/* 保存按钮 */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    {isDirty && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400">
                        有未保存的修改
                      </span>
                    )}
                    <Button
                      size="sm"
                      className="h-7 text-[11px]"
                      disabled={!isDirty || saving === role.id}
                      onClick={() => void handleSave(role.id)}
                    >
                      <Save className="mr-1 size-3" />
                      {saving === role.id ? '保存中...' : '保存'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 说明区 */}
      <div className="rounded-glass-popover bg-blue-500/5 p-3 border border-blue-500/20">
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 size-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="text-[11px] text-foreground/70 space-y-1">
            <p>
              <strong>与 SOUL.md 的关系</strong>：SOUL.md
              是全局身份层（主会话「我是谁」），角色库是任务职责层（worker「这个任务交给谁干」），两者正交。
            </p>
            <p>
              <strong>使用方式</strong>：Agent 建任务时传{' '}
              <code className="rounded bg-muted/50 px-1 py-0.5 font-mono">roleId</code>{' '}
              参数绑定角色。未绑定的任务用渠道默认模型。
            </p>
            <p>
              <strong>模型池</strong>：严格用渠道已有模型（kscc:
              glm-5.1/5.2、kimi-k2.5/2.6、mimo-v2.5/pro）。前面的优先用，满了才换下一个。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** 字段包装：label + content */
function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-foreground/80">{label}</label>
      {children}
    </div>
  )
}

/**
 * 模型池添加下拉
 *
 * 过滤掉已在池中的模型，只展示可选的。
 * 选中后触发 onAdd 并重置为占位态。
 */
function ModelPoolAddSelect({
  availableModels,
  currentPool,
  onAdd,
}: {
  availableModels: Array<{ id: string; label: string }>
  currentPool: string[]
  onAdd: (modelId: string) => void
}): React.ReactElement {
  const [value, setValue] = React.useState('')

  const options = React.useMemo(
    () => availableModels.filter((m) => !currentPool.includes(m.id)),
    [availableModels, currentPool]
  )

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const modelId = e.target.value
    if (modelId) {
      onAdd(modelId)
      setValue('')
    }
  }

  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <Plus className="size-3 text-muted-foreground" />
      <select
        value={value}
        onChange={handleChange}
        className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <option value="">添加模型到池...</option>
        {options.length === 0 ? (
          <option value="" disabled>
            （无可用模型，全部已添加或渠道未配置）
          </option>
        ) : (
          options.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} ({m.id})
            </option>
          ))
        )}
      </select>
    </div>
  )
}
