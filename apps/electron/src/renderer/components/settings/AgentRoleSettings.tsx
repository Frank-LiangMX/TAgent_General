/**
 * AgentRoleSettings - 角色库设置页
 *
 * 两个 Tab：
 * - 我的角色：默认卡片铺满，点击后左缩卡片 + 右展详情
 * - 角色商店：浏览 250+ 个可安装角色
 *
 * 存储：~/.tagent/agent-roles.json
 */

import * as React from 'react'
import {
  RotateCcw,
  Save,
  ArrowLeft,
  Users,
  Lock,
  Plus,
  X,
  Store,
  Check,
  Download,
  Search,
  FileUp,
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
} from '@tagent/ui'
import { SettingsSection } from './primitives'
import {
  useRefreshAgentRoles,
  useLoadRoleStoreCatalog,
  roleStoreCatalogAtom,
  roleStoreLoadingAtom,
  roleStoreSourceAtom,
  agentRolesAtom,
} from '@/atoms/agent-role-atoms'
import { useAtomValue } from 'jotai'

const PERMISSION_MODE_OPTIONS: Array<{ value: AgentRolePermissionMode; label: string; desc: string }> = [
  { value: 'bypassPermissions', label: '自动放行', desc: '无人值守写操作必备' },
  { value: 'auto', label: '需审批', desc: '写操作走权限弹窗（审核角色用）' },
]

const MAX_CONCURRENT_OPTIONS = [1, 2, 3, 4, 5]
const BUILTIN_IDS = new Set(['analyst', 'coder', 'reviewer', 'writer'])

const CATEGORY_LABELS: Record<string, string> = {
  all: '全部', coding: '编码', analysis: '分析', writing: '撰写', review: '审核',
  design: '设计', management: '管理', devops: '运维', data: '数据',
  education: '教育', marketing: '营销', security: '安全', general: '通用',
}

export function AgentRoleSettings(): React.ReactElement {
  const [activeTab, setActiveTab] = React.useState<'mine' | 'store'>('mine')

  return (
    <div className="flex h-full flex-col px-1 py-4">
      <SettingsSection
        title={
          <span className="flex items-center gap-2">
            <Users className="size-4" />
            角色库
          </span>
        }
        description="定义看板 worker 的专业能力。任务绑定 roleId 后，worker 注入角色 systemPrompt + 模型池分配。"
      >
        <SegmentedTabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'mine' | 'store')}>
          <SegmentedTabsItem value="mine">
            <span className="flex items-center gap-1.5"><Users className="size-3.5" />我的角色</span>
          </SegmentedTabsItem>
          <SegmentedTabsItem value="store">
            <span className="flex items-center gap-1.5"><Store className="size-3.5" />角色商店</span>
          </SegmentedTabsItem>
        </SegmentedTabs>
      </SettingsSection>

      <div className="mt-3 flex-1 min-h-0">
        {activeTab === 'mine' ? <MyRolesTab /> : <RoleStoreTab />}
      </div>
    </div>
  )
}

// ─── 我的角色 Tab ────────────────────────────────────────────────

function MyRolesTab(): React.ReactElement {
  const [roles, setRoles] = React.useState<AgentRoleProfile[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<AgentRoleProfile | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [channels, setChannels] = React.useState<Channel[]>([])
  const [selectMode, setSelectMode] = React.useState(false)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const refreshAgentRoles = useRefreshAgentRoles()

  React.useEffect(() => {
    window.electronAPI.listChannels()
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

  React.useEffect(() => { void loadRoles() }, [loadRoles])

  /** 点击卡片：进入详情 */
  const handleCardClick = (roleId: string): void => {
    if (selectMode) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(roleId)) next.delete(roleId)
        else next.add(roleId)
        return next
      })
      return
    }
    setSelectedId(roleId)
    const role = roles.find((r) => r.id === roleId)
    if (role) setEditing({ ...role, modelPool: [...role.modelPool] })
  }

  /** 返回卡片视图 */
  const handleBack = (): void => {
    setSelectedId(null)
    setEditing(null)
  }

  const handleFieldChange = (field: keyof AgentRoleProfile, value: string | string[] | number | boolean): void => {
    if (!editing) return
    setEditing({ ...editing, [field]: value })
  }

  const handleAddModel = (modelId: string): void => {
    if (!modelId || !editing) return
    if (editing.modelPool.includes(modelId)) { toast.warning('该模型已在池中'); return }
    setEditing({ ...editing, modelPool: [...editing.modelPool, modelId] })
  }

  const handleRemoveModel = (modelId: string): void => {
    if (!editing) return
    setEditing({ ...editing, modelPool: editing.modelPool.filter((m) => m !== modelId) })
  }

  const handleSave = async (): Promise<void> => {
    if (!editing) return
    setSaving(true)
    try {
      const updated = await window.electronAPI.agentRole.save({ role: editing })
      setRoles(updated)
      refreshAgentRoles()
      toast.success(`已保存角色：${editing.displayName}`)
    } catch (err) {
      toast.error('保存失败', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async (): Promise<void> => {
    if (!confirm('确定重置所有角色为内置默认值？自定义角色将丢失。')) return
    try {
      const reset = await window.electronAPI.agentRole.resetDefault()
      setRoles(reset)
      refreshAgentRoles()
      setSelectedId(null)
      setEditing(null)
      toast.success('已重置为默认角色')
    } catch (err) {
      toast.error('重置失败', { description: err instanceof Error ? err.message : undefined })
    }
  }

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

  const handleSelectAll = (): void => {
    const customIds = roles.filter((r) => !BUILTIN_IDS.has(r.id)).map((r) => r.id)
    setSelectedIds(selectedIds.size === customIds.length ? new Set() : new Set(customIds))
  }

  const handleBatchDelete = async (): Promise<void> => {
    if (selectedIds.size === 0) return
    if (!confirm(`确定删除选中的 ${selectedIds.size} 个角色？内置角色会自动跳过。`)) return
    try {
      const result = await window.electronAPI.agentRole.deleteBatch([...selectedIds])
      if (result.deleted.length > 0) toast.success(`已删除 ${result.deleted.length} 个角色`)
      if (result.skipped.length > 0) toast.warning(`${result.skipped.length} 个角色已跳过`)
      setRoles(result.roles)
      setSelectedIds(new Set())
      setSelectMode(false)
      refreshAgentRoles()
      if (selectedId && result.deleted.includes(selectedId)) { setSelectedId(null); setEditing(null) }
    } catch (err) {
      toast.error('批量删除失败', { description: err instanceof Error ? err.message : undefined })
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">加载中...</div>
  }

  const isDirty = editing && roles.find((r) => r.id === editing.id)
    ? JSON.stringify(editing) !== JSON.stringify(roles.find((r) => r.id === editing.id))
    : false

  const isDetailMode = selectedId !== null && editing !== null

  return (
    <div className="flex h-full min-h-[420px] gap-3">
      {/* ── 左栏：卡片网格（detail 模式时收缩为窄列） ── */}
      <div
        className={
          'flex flex-col transition-all duration-200 ease-in-out ' +
          (isDetailMode ? 'w-[160px] shrink-0' : 'flex-1 min-w-0')
        }
      >
        {/* 工具栏 */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {selectMode ? (
            <>
              <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={handleSelectAll}>
                {selectedIds.size === roles.filter((r) => !BUILTIN_IDS.has(r.id)).length ? '取消全选' : '全选'}
              </Button>
              {selectedIds.size > 0 && (
                <Button variant="destructive" size="sm" className="h-7 text-[11px]" onClick={() => void handleBatchDelete()}>
                  删除 ({selectedIds.size})
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => { setSelectMode(false); setSelectedIds(new Set()) }}>
                取消
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setSelectMode(true)}>多选</Button>
              <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => void handleImportMd()}><FileUp className="mr-1 size-3" />导入</Button>
              <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => void handleReset()}><RotateCcw className="mr-1 size-3" /></Button>
            </>
          )}
        </div>

        {/* 卡片网格 */}
        <div
          className={
            'flex-1 overflow-auto ' +
            (isDetailMode
              ? 'space-y-1'
              : 'grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4')
          }
        >
          {roles.map((role) => {
            const isActive = selectedId === role.id
            const isCheckboxChecked = selectedIds.has(role.id)

            if (isDetailMode) {
              // 收缩模式：窄列表
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleCardClick(role.id)}
                  className={
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ' +
                    (isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground hover:bg-muted/30')
                  }
                >
                  {selectMode && (
                    <div
                      className={
                        'flex size-3 shrink-0 items-center justify-center rounded border ' +
                        (isCheckboxChecked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30')
                      }
                    >
                      {isCheckboxChecked && <Check className="size-2" />}
                    </div>
                  )}
                  <span className="truncate">{role.displayName}</span>
                </button>
              )
            }

            // 展开模式：完整卡片
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => handleCardClick(role.id)}
                className={
                  'settings-card flex flex-col gap-1.5 p-3 text-left transition-colors hover:bg-muted/20 ' +
                  (selectMode && isCheckboxChecked ? 'ring-2 ring-primary/50' : '')
                }
              >
                {selectMode && (
                  <div className="flex justify-end">
                    <div
                      className={
                        'flex size-4 items-center justify-center rounded border ' +
                        (isCheckboxChecked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30')
                      }
                    >
                      {isCheckboxChecked && <Check className="size-3" />}
                    </div>
                  </div>
                )}
                <div className="text-sm font-medium text-foreground truncate">{role.displayName}</div>
                <div className="text-[11px] text-muted-foreground line-clamp-2">{role.description}</div>
                <div className="flex items-center gap-1.5 mt-auto pt-1">
                  <Badge variant="outline" className="text-[10px] font-mono">{role.id}</Badge>
                  {BUILTIN_IDS.has(role.id) && <Badge variant="outline" className="text-[9px] px-1 py-0">内置</Badge>}
                  <span className="ml-auto text-[10px] text-muted-foreground">{role.modelPool.length} 模型</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 右栏：详情编辑（仅 detail 模式显示） ── */}
      {isDetailMode && editing && (
        <div className="flex flex-1 min-w-0 flex-col rounded-lg border border-border/40 overflow-hidden">
          {/* 详情头部 */}
          <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleBack}>
              <ArrowLeft className="size-4" />
            </Button>
            <span className="text-sm font-medium">{editing.displayName}</span>
            <Badge variant="outline" className="text-[10px] font-mono">{editing.id}</Badge>
            {BUILTIN_IDS.has(editing.id) && <Badge variant="outline" className="text-[9px] px-1 py-0">内置</Badge>}
          </div>

          {/* 详情内容 */}
          <div className="flex-1 overflow-auto p-4 space-y-4">
            <Field label="显示名">
              <Input value={editing.displayName} onChange={(e) => handleFieldChange('displayName', e.target.value)} className="h-8 text-xs" />
            </Field>

            <Field label="职责描述">
              <Input value={editing.description} onChange={(e) => handleFieldChange('description', e.target.value)} className="h-8 text-xs" />
            </Field>

            <Field label="系统提示词（注入 worker 子会话）">
              <Textarea
                value={editing.systemPrompt}
                onChange={(e) => handleFieldChange('systemPrompt', e.target.value)}
                className="min-h-[200px] text-xs font-mono"
                placeholder="定义角色的专业能力边界、输出格式、约束..."
              />
            </Field>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground/80">模型池（从上到下优先级递减）</label>
              <div className="space-y-1">
                {editing.modelPool.length === 0 ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">模型池为空，dispatcher 将用渠道默认模型</p>
                ) : (
                  editing.modelPool.map((modelId, idx) => {
                    const modelInfo = availableModels.find((m) => m.id === modelId)
                    return (
                      <div key={modelId} className="flex items-center gap-2 rounded-md bg-muted/30 px-2 py-1.5">
                        <span className="w-4 shrink-0 text-center text-[10px] tabular-nums text-muted-foreground">{idx + 1}</span>
                        <span className="flex-1 min-w-0 truncate text-xs font-mono text-foreground/80">{modelInfo?.label ?? modelId}</span>
                        <button type="button" onClick={() => handleRemoveModel(modelId)} className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-500" title="移除">
                          <X className="size-3" />
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
              <ModelPoolAddSelect availableModels={availableModels} currentPool={editing.modelPool} onAdd={handleAddModel} />
            </div>

            <Field label="权限模式">
              <Select value={editing.permissionMode} onValueChange={(v) => handleFieldChange('permissionMode', v as AgentRolePermissionMode)}>
                <SelectTrigger className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERMISSION_MODE_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">{PERMISSION_MODE_OPTIONS.find((o) => o.value === editing.permissionMode)?.desc}</p>
            </Field>

            <Field label="单模型并发上限">
              <Select value={String(editing.maxConcurrentPerModel)} onValueChange={(v) => handleFieldChange('maxConcurrentPerModel', Number(v))}>
                <SelectTrigger className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MAX_CONCURRENT_OPTIONS.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">避免同模型并行降智，默认 2</p>
            </Field>

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={editing.fallbackToChannelDefault}
                onChange={(e) => handleFieldChange('fallbackToChannelDefault', e.target.checked)}
                className="size-3.5 rounded border-muted-foreground/30"
              />
              模型池全满时回退到渠道默认模型
            </label>
          </div>

          {/* 底部保存栏 */}
          <div className="flex items-center justify-between border-t border-border/40 px-4 py-2">
            <span className="text-[11px] text-muted-foreground">{BUILTIN_IDS.has(editing.id) ? '内置角色' : '自定义角色'}</span>
            {isDirty && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-amber-600 dark:text-amber-400">有未保存的修改</span>
                <Button size="sm" className="h-7 text-xs" disabled={saving} onClick={() => void handleSave()}>
                  <Save className="mr-1 size-3" />{saving ? '保存中...' : '保存'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
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
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const installedIds = React.useMemo(() => new Set(installedRoles.map((r) => r.id)), [installedRoles])

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
      result = result.filter((e) => e.displayName.toLowerCase().includes(q) || e.description.toLowerCase().includes(q))
    }
    return result
  }, [entries, category, search])

  const selectedEntry = React.useMemo(() => filtered.find((e) => e.id === selectedId) ?? null, [filtered, selectedId])

  const handleInstall = async (roleId: string): Promise<void> => {
    setInstalling(roleId)
    try {
      const entry = entries.find((e) => e.id === roleId)
      if (entry) {
        const similar = await window.electronAPI.agentRole.findSimilar(entry.displayName)
        if (similar.length > 0) {
          const names = similar.map((r) => r.displayName).join('、')
          if (!confirm(`已存在相似角色：${names}\n\n是否仍要安装 "${entry.displayName}"？`)) { setInstalling(null); return }
        }
      }
      const result = await window.electronAPI.agentRole.storeInstall(roleId)
      if (result.installed) { toast.success(`已安装角色：${result.role?.displayName}`); refreshAgentRoles() }
      else toast.warning(result.reason || '安装失败')
    } catch (err) {
      toast.error('安装失败', { description: err instanceof Error ? err.message : undefined })
    } finally { setInstalling(null) }
  }

  if (loading && entries.length === 0) {
    return <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">加载角色商店...</div>
  }

  const isDetailMode = selectedId !== null && selectedEntry !== null

  return (
    <div className="flex h-full min-h-[420px] gap-3">
      {/* 左栏：搜索 + 分类 + 列表 */}
      <div className={'flex flex-col transition-all duration-200 ease-in-out ' + (isDetailMode ? 'w-[200px] shrink-0' : 'w-[260px] shrink-0')}>
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} onClear={() => setSearch('')} placeholder="搜索角色..." className="h-8 mb-2" showClear={search.length > 0} />
        <div className="mb-2 flex flex-wrap gap-1">
          {categories.map((cat) => (
            <button key={cat} type="button" onClick={() => setCategory(cat)}
              className={'rounded-full px-2 py-0.5 text-[11px] transition-colors ' + (category === cat ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground')}>
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>
        <Badge variant="outline" className={'mb-2 w-fit text-[10px] ' + (source === 'remote' ? 'text-green-600 dark:text-green-400' : source === 'cached' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
          {source === 'remote' ? '在线' : source === 'cached' ? '缓存' : '内置'} · {filtered.length} 个角色
        </Badge>

        <div className="flex-1 overflow-auto rounded-lg border border-border/40">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-xs text-muted-foreground"><Search className="mb-1 size-5 opacity-30" /><p>未找到匹配角色</p></div>
          ) : filtered.map((entry) => {
            const isInstalled = installedIds.has(entry.id)
            const isActive = selectedId === entry.id
            return (
              <div key={entry.id}
                onClick={() => setSelectedId(isActive ? null : entry.id)}
                className={'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors ' + (isActive ? 'bg-primary/10' : 'hover:bg-muted/20')}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className={'truncate text-xs ' + (isActive ? 'font-medium text-primary' : 'font-medium')}>{entry.displayName}</span>
                    {entry.tier === 'recommended' && <Badge className="text-[8px] px-1 py-0 bg-primary/10 text-primary border-primary/20">荐</Badge>}
                  </div>
                  <p className="truncate text-[10px] text-muted-foreground">{entry.description}</p>
                </div>
                {isInstalled ? (
                  <Badge variant="outline" className="shrink-0 text-[9px] text-green-600 dark:text-green-400 border-green-500/30"><Check className="mr-0.5 size-2.5" />已安装</Badge>
                ) : (
                  <Button size="sm" variant="outline" className="h-6 shrink-0 px-1.5 text-[10px]" disabled={installing === entry.id} onClick={(e) => { e.stopPropagation(); void handleInstall(entry.id) }}>
                    <Download className="size-3" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 右栏：详情或说明 */}
      {isDetailMode && selectedEntry ? (
        <div className="flex flex-1 min-w-0 flex-col rounded-lg border border-border/40 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelectedId(null)}><ArrowLeft className="size-4" /></Button>
            <span className="text-sm font-medium">{selectedEntry.displayName}</span>
            <Badge variant="outline" className="text-[10px] font-mono">{selectedEntry.id}</Badge>
            {selectedEntry.tier === 'recommended' && <Badge className="text-[9px] px-1 py-0 bg-primary/10 text-primary border-primary/20">推荐</Badge>}
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            <div><label className="text-[11px] font-medium text-foreground/80">描述</label><p className="text-xs text-muted-foreground mt-1">{selectedEntry.description}</p></div>
            <div><label className="text-[11px] font-medium text-foreground/80">分类</label><p className="text-xs text-muted-foreground mt-1">{CATEGORY_LABELS[selectedEntry.category] ?? selectedEntry.category}</p></div>
            <div><label className="text-[11px] font-medium text-foreground/80">系统提示词预览</label><div className="mt-1 max-h-[300px] overflow-auto rounded-md border border-border/40 bg-muted/10 p-3 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap">{selectedEntry.role.systemPrompt.substring(0, 800)}{selectedEntry.role.systemPrompt.length > 800 ? '...' : ''}</div></div>
            <div><label className="text-[11px] font-medium text-foreground/80">来源</label><p className="text-xs text-muted-foreground mt-1">{selectedEntry.source}{selectedEntry.sourceUrl && <a href={selectedEntry.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-primary hover:underline">查看源</a>}</p></div>
          </div>
          <div className="border-t border-border/40 px-4 py-2">
            {installedIds.has(selectedEntry.id) ? (
              <Badge variant="outline" className="text-[11px] text-green-600 dark:text-green-400 border-green-500/30"><Check className="mr-1 size-3" />已安装</Badge>
            ) : (
              <Button size="sm" className="h-8 text-xs" disabled={installing === selectedEntry.id} onClick={() => void handleInstall(selectedEntry.id)}>
                <Download className="mr-1 size-3" />{installing === selectedEntry.id ? '安装中...' : '安装此角色'}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="settings-card max-w-md p-4 bg-blue-500/5 border-blue-500/20">
            <div className="flex items-start gap-2">
              <Lock className="mt-0.5 size-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="text-[11px] text-foreground/70 space-y-2">
                <p><strong>角色商店</strong>包含来自 agency-agents-zh 的 250+ 个专业化角色，涵盖编码、设计、营销、安全等领域。</p>
                <p><strong>使用方式</strong>：点击左侧角色查看详情，点击下载按钮安装。安装后可在「我的角色」Tab 中编辑。</p>
                <p><strong>相似检测</strong>：安装时自动检测已有相似角色，避免重复。</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 辅助组件 ────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (<div><label className="mb-1 block text-[11px] font-medium text-foreground/80">{label}</label>{children}</div>)
}

function ModelPoolAddSelect({ availableModels, currentPool, onAdd }: {
  availableModels: Array<{ id: string; label: string }>
  currentPool: string[]
  onAdd: (modelId: string) => void
}): React.ReactElement {
  const options = React.useMemo(() => availableModels.filter((m) => !currentPool.includes(m.id)), [availableModels, currentPool])
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <Plus className="size-3 text-muted-foreground" />
      <Select value="" onValueChange={(v) => v && onAdd(v)}>
        <SelectTrigger className="h-7 flex-1 text-xs text-muted-foreground hover:text-foreground"><SelectValue placeholder="添加模型到池..." /></SelectTrigger>
        <SelectContent>
          {options.length === 0 ? <SelectItem value="__none__" disabled>（无可用模型）</SelectItem> : options.map((m) => <SelectItem key={m.id} value={m.id}>{m.label} ({m.id})</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}
