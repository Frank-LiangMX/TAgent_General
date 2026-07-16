/**
 * AgentRoleSettings - 角色库（看板页子功能）
 *
 * 两个 Tab：
 * - 我的角色：卡片网格铺满，点击弹出 Dialog 详情
 * - 角色商店：浏览 250+ 个可安装角色
 *
 * 2026-07-07 重构：从左右两栏改为卡片网格 + 弹窗详情，布局更清爽。
 * 存储：~/.tagent/agent-roles.json
 */

import * as React from 'react'
import {
  RotateCcw,
  Save,
  Users,
  Lock,
  Plus,
  X,
  Store,
  Check,
  Download,
  Search,
  FileUp,
  Pencil,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import type {
  AgentRoleProfile,
  AgentRolePermissionMode,
  RoleStoreCatalogEntry,
  RoleStoreCategory,
  Channel,
} from '@tagent/shared'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  SearchInput,
  SegmentedTabs,
  SegmentedTabsItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@tagent/ui'
import {
  useRefreshAgentRoles,
  useLoadRoleStoreCatalog,
  roleStoreCatalogAtom,
  roleStoreLoadingAtom,
  roleStoreSourceAtom,
  agentRolesAtom,
} from '@/atoms/agent-role-atoms'
import { useAtomValue } from 'jotai'
import { cn } from '@/lib/utils'
import { markdownToHtml } from '@/lib/markdown-rich-text'

const PERMISSION_MODE_OPTIONS: Array<{
  value: AgentRolePermissionMode
  label: string
  desc: string
}> = [
  { value: 'bypassPermissions', label: '自动放行', desc: '无人值守写操作必备' },
  { value: 'auto', label: '需审批', desc: '写操作走权限弹窗（审核角色用）' },
]

const MAX_CONCURRENT_OPTIONS = [1, 2, 3, 4, 5]
const BUILTIN_IDS = new Set(['analyst', 'coder', 'reviewer', 'writer'])

const CATEGORY_LABELS: Record<string, string> = {
  all: '全部',
  coding: '编码',
  analysis: '分析',
  writing: '撰写',
  review: '审核',
  design: '设计',
  management: '管理',
  devops: '运维',
  data: '数据',
  education: '教育',
  marketing: '营销',
  security: '安全',
  general: '通用',
}

export function AgentRoleSettings(): React.ReactElement {
  const [activeTab, setActiveTab] = React.useState<'mine' | 'store'>('mine')

  return (
    <div className="flex h-full flex-col">
      {/* Tab 切换器 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
        <SegmentedTabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'mine' | 'store')}>
          <SegmentedTabsItem value="mine">
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5" />
              我的角色
            </span>
          </SegmentedTabsItem>
          <SegmentedTabsItem value="store">
            <span className="flex items-center gap-1.5">
              <Store className="size-3.5" />
              角色商店
            </span>
          </SegmentedTabsItem>
        </SegmentedTabs>
      </div>

      {/* Tab 内容 */}
      <div className="flex-1 min-h-0">
        {activeTab === 'mine' ? <MyRolesTab /> : <RoleStoreTab />}
      </div>
    </div>
  )
}

// ─── 我的角色 Tab ────────────────────────────────────────────────

function MyRolesTab(): React.ReactElement {
  const [roles, setRoles] = React.useState<AgentRoleProfile[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [editingRole, setEditingRole] = React.useState<AgentRoleProfile | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [channels, setChannels] = React.useState<Channel[]>([])
  const refreshAgentRoles = useRefreshAgentRoles()

  React.useEffect(() => {
    window.electronAPI
      .listChannels()
      .then((list: Channel[]) => setChannels(list.filter((c) => c.enabled)))
      .catch(() => {})
  }, [])

  const availableModels = React.useMemo(() => {
    const seen = new Set<string>()
    const result: Array<{ id: string; label: string }> = []
    for (const ch of channels) {
      for (const m of ch.models) {
        if (!m.enabled || seen.has(m.id)) continue
        seen.add(m.id)
        result.push({ id: m.id, label: m.name || m.id })
      }
    }
    return result
  }, [channels])

  const loadRoles = React.useCallback(async () => {
    setLoading(true)
    try {
      const list = await window.electronAPI.agentRole.list()
      setRoles(list)
    } catch (err) {
      toast.error('加载角色库失败', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadRoles()
  }, [loadRoles])

  // 搜索过滤
  const filteredRoles = React.useMemo(() => {
    if (!searchQuery.trim()) return roles
    const q = searchQuery.toLowerCase().trim()
    return roles.filter(
      (r) =>
        r.displayName.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
    )
  }, [roles, searchQuery])

  // 点击卡片：打开详情弹窗
  const handleCardClick = (role: AgentRoleProfile): void => {
    setEditingRole({ ...role, modelPool: [...role.modelPool] })
    setDialogOpen(true)
  }

  // 关闭弹窗
  const handleCloseDialog = (): void => {
    setDialogOpen(false)
    setEditingRole(null)
  }

  // 字段修改
  const handleFieldChange = (
    field: keyof AgentRoleProfile,
    value: string | string[] | number | boolean
  ): void => {
    if (!editingRole) return
    setEditingRole({ ...editingRole, [field]: value })
  }

  // 添加模型
  const handleAddModel = (modelId: string): void => {
    if (!modelId || !editingRole) return
    if (editingRole.modelPool.includes(modelId)) {
      toast.warning('该模型已在池中')
      return
    }
    setEditingRole({ ...editingRole, modelPool: [...editingRole.modelPool, modelId] })
  }

  // 移除模型
  const handleRemoveModel = (modelId: string): void => {
    if (!editingRole) return
    setEditingRole({
      ...editingRole,
      modelPool: editingRole.modelPool.filter((m) => m !== modelId),
    })
  }

  // 保存角色
  const handleSave = async (): Promise<void> => {
    if (!editingRole) return
    setSaving(true)
    try {
      const updated = await window.electronAPI.agentRole.save({ role: editingRole })
      setRoles(updated)
      refreshAgentRoles()
      toast.success(`已保存角色：${editingRole.displayName}`)
      handleCloseDialog()
    } catch (err) {
      toast.error('保存失败', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  // 删除角色
  const handleDelete = async (): Promise<void> => {
    if (!editingRole) return
    if (BUILTIN_IDS.has(editingRole.id)) {
      toast.warning('内置角色不可删除，只能重置')
      return
    }
    if (!confirm(`确定删除角色「${editingRole.displayName}」？此操作不可恢复。`)) return
    try {
      const result = await window.electronAPI.agentRole.deleteBatch([editingRole.id])
      setRoles(result.roles)
      refreshAgentRoles()
      toast.success(`已删除角色：${editingRole.displayName}`)
      handleCloseDialog()
    } catch (err) {
      toast.error('删除失败', { description: err instanceof Error ? err.message : undefined })
    }
  }

  // 重置为默认
  const handleReset = async (): Promise<void> => {
    if (!confirm('确定重置所有角色为内置默认值？自定义角色将丢失。')) return
    try {
      const reset = await window.electronAPI.agentRole.resetDefault()
      setRoles(reset)
      refreshAgentRoles()
      toast.success('已重置为默认角色')
    } catch (err) {
      toast.error('重置失败', { description: err instanceof Error ? err.message : undefined })
    }
  }

  // 导入 .md
  const handleImportMd = async (): Promise<void> => {
    try {
      const result = await window.electronAPI.agentRole.importMd()
      if (result.imported && result.role) {
        toast.success(`已导入角色：${result.role.displayName}`)
        await loadRoles()
        refreshAgentRoles()
      } else if (result.reason !== '已取消') {
        toast.warning(result.reason || '导入失败')
      }
    } catch (err) {
      toast.error('导入失败', { description: err instanceof Error ? err.message : undefined })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="size-5 animate-spin border-2 border-muted-foreground border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 px-4 py-3">
        <SearchInput
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery('')}
          placeholder="搜索角色..."
          className="h-8 w-[200px]"
          showClear={searchQuery.length > 0}
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => void handleImportMd()}
        >
          <FileUp className="mr-1 size-3" />
          导入
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => void handleReset()}
        >
          <RotateCcw className="mr-1 size-3" />
          重置
        </Button>
        {searchQuery && (
          <Badge variant="outline" className="text-[10px]">
            {filteredRoles.length} / {roles.length}
          </Badge>
        )}
      </div>

      {/* 卡片网格 */}
      <ScrollArea className="flex-1 min-h-0">
        {filteredRoles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="size-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              {searchQuery ? '未找到匹配角色' : '暂无角色'}
            </p>
            <p className="text-xs text-muted-foreground/70 max-w-sm">
              点击「导入」从 .md 文件添加角色，或点击「重置」恢复内置角色。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 px-4 pb-4">
            {filteredRoles.map((role) => (
              <RoleCard key={role.id} role={role} onClick={() => handleCardClick(role)} />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* 详情弹窗 */}
      {editingRole && (
        <RoleDetailDialog
          role={editingRole}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onClose={handleCloseDialog}
          availableModels={availableModels}
          saving={saving}
          onSave={handleSave}
          onDelete={handleDelete}
          onFieldChange={handleFieldChange}
          onAddModel={handleAddModel}
          onRemoveModel={handleRemoveModel}
        />
      )}
    </div>
  )
}

// ─── 角色卡片 ────────────────────────────────────────────────

function RoleCard({
  role,
  onClick,
}: {
  role: AgentRoleProfile
  onClick: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="session-list-item-active group flex flex-col gap-2 p-3 text-left transition-colors hover:bg-primary/5"
    >
      {/* 标题行：名称 + 内置标记 */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm font-medium text-foreground truncate flex-1">
          {role.displayName}
        </span>
        {BUILTIN_IDS.has(role.id) && (
          <Badge
            variant="outline"
            className="text-[9px] px-1 py-0 shrink-0 border-blue-500/30 text-blue-600 dark:text-blue-400"
          >
            内置
          </Badge>
        )}
      </div>

      {/* 描述 */}
      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">{role.description}</p>

      {/* 底部信息：ID + 模型数 */}
      <div className="flex items-center gap-1.5 mt-auto pt-1">
        <Badge variant="outline" className="text-[10px] font-mono">
          {role.id}
        </Badge>
        <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
          {role.modelPool.length} 模型
        </span>
      </div>
    </button>
  )
}

// ─── 角色详情弹窗 ────────────────────────────────────────────────

function RoleDetailDialog({
  role,
  open,
  onOpenChange,
  onClose,
  availableModels,
  saving,
  onSave,
  onDelete,
  onFieldChange,
  onAddModel,
  onRemoveModel,
}: {
  role: AgentRoleProfile
  open: boolean
  onOpenChange: (open: boolean) => void
  onClose: () => void
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
  const isDirty = JSON.stringify(role) !== JSON.stringify(role) // 简化：始终可保存
  const isBuiltin = BUILTIN_IDS.has(role.id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[800px] h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <span>{role.displayName}</span>
            <Badge variant="outline" className="text-[10px] font-mono">
              {role.id}
            </Badge>
            {isBuiltin && (
              <Badge
                variant="outline"
                className="text-[9px] px-1 py-0 border-blue-500/30 text-blue-600 dark:text-blue-400"
              >
                内置
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* 内容区 */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-4 p-2">
            <Field label="显示名">
              <Input
                value={role.displayName}
                onChange={(e) => onFieldChange('displayName', e.target.value)}
                className="h-8 text-xs"
              />
            </Field>

            <Field label="职责描述">
              <Input
                value={role.description}
                onChange={(e) => onFieldChange('description', e.target.value)}
                className="h-8 text-xs"
              />
            </Field>

            <Field label="系统提示词（注入 worker 子会话）">
              <Textarea
                value={role.systemPrompt}
                onChange={(e) => onFieldChange('systemPrompt', e.target.value)}
                className="min-h-[200px] text-xs font-mono"
                placeholder="定义角色的专业能力边界、输出格式、约束..."
              />
            </Field>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground/80">
                模型池（从上到下优先级递减）
              </label>
              <div className="space-y-1">
                {role.modelPool.length === 0 ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    模型池为空，dispatcher 将用渠道默认模型
                  </p>
                ) : (
                  role.modelPool.map((modelId, idx) => {
                    const modelInfo = availableModels.find((m) => m.id === modelId)
                    return (
                      <div
                        key={modelId}
                        className="flex items-center gap-2 rounded-md bg-muted/30 px-2 py-1.5"
                      >
                        <span className="w-4 shrink-0 text-center text-[10px] tabular-nums text-muted-foreground">
                          {idx + 1}
                        </span>
                        <span className="flex-1 min-w-0 truncate text-xs font-mono text-foreground/80">
                          {modelInfo?.label ?? modelId}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveModel(modelId)}
                          className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
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
            </div>

            <Field label="权限模式">
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
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {PERMISSION_MODE_OPTIONS.find((o) => o.value === role.permissionMode)?.desc}
              </p>
            </Field>

            <Field label="单模型并发上限">
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
            </Field>

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

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between border-t border-border/40 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {isBuiltin ? '内置角色' : '自定义角色'}
            </span>
            {!isBuiltin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10"
                    onClick={() => void onDelete()}
                  >
                    <Trash2 className="mr-1 size-3" />
                    删除
                  </Button>
                </TooltipTrigger>
                <TooltipContent>删除此角色（不可恢复）</TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onClose}>
              取消
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={saving}
              onClick={() => void onSave()}
            >
              <Save className="mr-1 size-3" />
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── 角色商店 Tab ────────────────────────────────────────────────

function RoleStoreTab(): React.ReactElement {
  useLoadRoleStoreCatalog()
  const entries = useAtomValue(roleStoreCatalogAtom)
  const loading = useAtomValue(roleStoreLoadingAtom)
  const source = useAtomValue(roleStoreSourceAtom)
  const installedRoles = useAtomValue(agentRolesAtom)
  const refreshAgentRoles = useRefreshAgentRoles()

  const [search, setSearch] = React.useState('')
  const [category, setCategory] = React.useState('all')
  const [installing, setInstalling] = React.useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = React.useState<RoleStoreCatalogEntry | null>(null)
  const [detailOpen, setDetailOpen] = React.useState(false)

  const installedIds = React.useMemo(
    () => new Set(installedRoles.map((r) => r.id)),
    [installedRoles]
  )

  const categories = React.useMemo(() => {
    const cats = new Set<string>()
    for (const e of entries) cats.add(e.category)
    return ['all', ...Array.from(cats).sort()]
  }, [entries])

  const filtered = React.useMemo(() => {
    let result = entries
    if (category !== 'all') result = result.filter((e) => e.category === category)
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter(
        (e) => e.displayName.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
      )
    }
    return result
  }, [entries, category, search])

  const handleInstall = async (roleId: string): Promise<void> => {
    setInstalling(roleId)
    try {
      const entry = entries.find((e) => e.id === roleId)
      if (entry) {
        const similar = await window.electronAPI.agentRole.findSimilar(entry.displayName)
        if (similar.length > 0) {
          const names = similar.map((r) => r.displayName).join('、')
          if (!confirm(`已存在相似角色：${names}\n\n是否仍要安装 "${entry.displayName}"？`)) {
            setInstalling(null)
            return
          }
        }
      }
      const result = await window.electronAPI.agentRole.storeInstall(roleId)
      if (result.installed) {
        toast.success(`已安装角色：${result.role?.displayName}`)
        refreshAgentRoles()
      } else {
        toast.warning(result.reason || '安装失败')
      }
    } catch (err) {
      toast.error('安装失败', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setInstalling(null)
    }
  }

  // 点击卡片查看详情
  const handleCardClick = (entry: RoleStoreCatalogEntry): void => {
    setSelectedEntry(entry)
    setDetailOpen(true)
  }

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="size-5 animate-spin border-2 border-muted-foreground border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 px-4 py-3">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder="搜索角色..."
          className="h-8 w-[200px]"
          showClear={search.length > 0}
        />
        <Badge
          variant="outline"
          className={cn(
            'text-[10px]',
            source === 'remote' && 'text-green-600 dark:text-green-400',
            source === 'cached' && 'text-amber-600 dark:text-amber-400',
            source === 'builtin' && 'text-muted-foreground'
          )}
        >
          {source === 'remote' ? '在线' : source === 'cached' ? '缓存' : '内置'} · {filtered.length}{' '}
          个
        </Badge>
      </div>

      {/* 分类标签 */}
      <div className="flex flex-wrap gap-1 px-4 pb-2">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] transition-colors',
              category === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            )}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* 卡片网格 */}
      <ScrollArea className="flex-1 min-h-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="size-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">未找到匹配角色</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 px-4 pb-4">
            {filtered.map((entry) => {
              const isInstalled = installedIds.has(entry.id)
              return (
                <StoreRoleCard
                  key={entry.id}
                  entry={entry}
                  isInstalled={isInstalled}
                  installing={installing === entry.id}
                  onClick={() => handleCardClick(entry)}
                  onInstall={() => void handleInstall(entry.id)}
                />
              )
            })}
          </div>
        )}
      </ScrollArea>

      {/* 详情弹窗 */}
      {selectedEntry && (
        <StoreRoleDetailDialog
          entry={selectedEntry}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          isInstalled={installedIds.has(selectedEntry.id)}
          installing={installing === selectedEntry.id}
          onInstall={() => void handleInstall(selectedEntry.id)}
        />
      )}
    </div>
  )
}

// ─── 商店角色卡片 ────────────────────────────────────────────────

function StoreRoleCard({
  entry,
  isInstalled,
  installing,
  onClick,
  onInstall,
}: {
  entry: RoleStoreCatalogEntry
  isInstalled: boolean
  installing: boolean
  onClick: () => void
  onInstall: () => void
}): React.ReactElement {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick()
      }}
      className="session-list-item-active flex flex-col gap-2 p-3 text-left transition-colors hover:bg-primary/5 cursor-pointer"
    >
      {/* 标题行：名称 + 推荐标记 */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm font-medium text-foreground truncate flex-1">
          {entry.displayName}
        </span>
        {entry.tier === 'recommended' && (
          <Badge className="text-[9px] px-1 py-0 bg-primary/10 text-primary border-primary/20 shrink-0">
            荐
          </Badge>
        )}
      </div>

      {/* 描述 */}
      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">{entry.description}</p>

      {/* 底部：ID + 安装按钮 */}
      <div className="flex items-center gap-1.5 mt-auto pt-1">
        <Badge variant="outline" className="text-[10px] font-mono">
          {entry.id}
        </Badge>
        <div className="ml-auto">
          {isInstalled ? (
            <Badge
              variant="outline"
              className="text-[10px] text-green-600 dark:text-green-400 border-green-500/30"
            >
              <Check className="mr-0.5 size-2.5" />
              已安装
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-1.5 text-[10px]"
              disabled={installing}
              onClick={(e) => {
                e.stopPropagation()
                onInstall()
              }}
            >
              <Download className="size-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 商店角色详情弹窗 ────────────────────────────────────────────────

function StoreRoleDetailDialog({
  entry,
  open,
  onOpenChange,
  isInstalled,
  installing,
  onInstall,
}: {
  entry: RoleStoreCatalogEntry
  open: boolean
  onOpenChange: (open: boolean) => void
  isInstalled: boolean
  installing: boolean
  onInstall: () => void
}): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{entry.displayName}</span>
            <Badge variant="outline" className="text-[10px] font-mono">
              {entry.id}
            </Badge>
            {entry.tier === 'recommended' && (
              <Badge className="text-[9px] px-1 py-0 bg-primary/10 text-primary border-primary/20">
                推荐
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* 分类 */}
          <div>
            <label className="text-xs font-medium text-foreground/80">分类</label>
            <Badge variant="outline" className="mt-1 text-xs">
              {CATEGORY_LABELS[entry.category] ?? entry.category}
            </Badge>
          </div>

          {/* 完整描述 */}
          <div>
            <label className="text-xs font-medium text-foreground/80">描述</label>
            <div
              className="mt-1 text-sm text-muted-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(entry.description) }}
            />
          </div>

          {/* 系统提示词预览 */}
          <div>
            <label className="text-xs font-medium text-foreground/80">系统提示词预览</label>
            <ScrollArea className="mt-1 h-[200px] rounded-md border border-border/40 bg-muted/10">
              <div
                className="p-3 text-xs text-muted-foreground leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: markdownToHtml(entry.role.systemPrompt.substring(0, 800)),
                }}
              />
            </ScrollArea>
          </div>

          {/* 来源 */}
          <div>
            <label className="text-xs font-medium text-foreground/80">来源</label>
            <p className="mt-1 text-xs text-muted-foreground">
              {entry.source}
              {entry.sourceUrl && (
                <a
                  href={entry.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-primary hover:underline"
                >
                  查看源
                </a>
              )}
            </p>
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-end border-t border-border/40 pt-3">
          {isInstalled ? (
            <Badge
              variant="outline"
              className="text-xs text-green-600 dark:text-green-400 border-green-500/30"
            >
              <Check className="mr-1 size-3" />
              已安装
            </Badge>
          ) : (
            <Button size="sm" className="h-8 text-xs" disabled={installing} onClick={onInstall}>
              <Download className="mr-1 size-3" />
              {installing ? '安装中...' : '安装此角色'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── 辅助组件 ────────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-foreground/80">{label}</label>
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
  const options = React.useMemo(
    () => availableModels.filter((m) => !currentPool.includes(m.id)),
    [availableModels, currentPool]
  )
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <Plus className="size-3 text-muted-foreground" />
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
