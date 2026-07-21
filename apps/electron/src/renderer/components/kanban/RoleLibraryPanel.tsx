/**
 * RoleLibraryPanel — 看板主区「角色库」
 *
 * 两个分段：我的角色 / 角色商店。
 * 视觉对齐工牌浮岛（kanban-crew-badge），不再用设置页边框工具条。
 */

import * as React from 'react'
import { useAtomValue } from 'jotai'
import { Check, Download, FileUp, RotateCcw, Search, Store, Users } from 'lucide-react'
import { toast } from 'sonner'

import type {
  AgentRoleProfile,
  Channel,
  KanbanCrewStats,
  RoleStoreCatalogEntry,
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
  ScrollArea,
  SearchInput,
  SegmentedTabs,
  SegmentedTabsItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@tagent/ui'

import {
  agentRolesAtom,
  roleStoreCatalogAtom,
  roleStoreLoadingAtom,
  roleStoreSourceAtom,
  useEnsureAgentRoles,
  useLoadRoleStoreCatalog,
  useRefreshAgentRoles,
} from '@/atoms/agent-role-atoms'
import { RoleCard } from '@/components/kanban/RoleCard'
import { RoleDetailDialog } from '@/components/kanban/RoleDetailDialog'
import { roleAvatarSpec } from '@/lib/kanban-crew-status'
import { markdownToHtml } from '@/lib/markdown-rich-text'
import { cn } from '@/lib/utils'

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

export function RoleLibraryPanel(): React.ReactElement {
  const [activeTab, setActiveTab] = React.useState<'mine' | 'store'>('mine')

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 px-5 pb-2 titlebar-no-drag">
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
        <p className="hidden text-[11px] text-foreground/50 sm:block">
          {activeTab === 'mine' ? '本地数字员工档案' : '从商店安装更多角色'}
        </p>
      </div>

      <div className="min-h-0 flex-1">
        {activeTab === 'mine' ? <MyRolesTab /> : <RoleStoreTab />}
      </div>
    </div>
  )
}

function MyRolesTab(): React.ReactElement {
  const { roles, loading } = useEnsureAgentRoles()
  const refreshAgentRoles = useRefreshAgentRoles()
  const [searchQuery, setSearchQuery] = React.useState('')
  const [editingRole, setEditingRole] = React.useState<AgentRoleProfile | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [channels, setChannels] = React.useState<Channel[]>([])
  const [crewStats, setCrewStats] = React.useState<KanbanCrewStats | null>(null)

  const loadCrewStats = React.useCallback(async () => {
    try {
      setCrewStats(await window.electronAPI.kanban.getCrewStats())
    } catch {
      // stats 辅助信息，失败不阻塞
    }
  }, [])

  React.useEffect(() => {
    void loadCrewStats()
  }, [loadCrewStats])

  React.useEffect(() => {
    return window.electronAPI.kanban.onChanged(() => {
      void loadCrewStats()
    })
  }, [loadCrewStats])

  React.useEffect(() => {
    window.electronAPI
      .listChannels()
      .then((list: Channel[]) => setChannels(list.filter((c) => c.enabled)))
      .catch(() => {})
  }, [])

  const statsByRole = React.useMemo(() => {
    if (!crewStats) return new Map<string, RoleWorkStats>()
    return new Map(crewStats.byRole.map((s) => [s.roleId, s]))
  }, [crewStats])

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

  const handleCardClick = (role: AgentRoleProfile): void => {
    setEditingRole({ ...role, modelPool: [...role.modelPool] })
    setDialogOpen(true)
  }

  const handleCloseDialog = (): void => {
    setDialogOpen(false)
    setEditingRole(null)
  }

  const handleFieldChange = (
    field: keyof AgentRoleProfile,
    value: string | string[] | number | boolean
  ): void => {
    if (!editingRole) return
    setEditingRole({ ...editingRole, [field]: value })
  }

  const handleAddModel = (modelId: string): void => {
    if (!modelId || !editingRole) return
    if (editingRole.modelPool.includes(modelId)) {
      toast.warning('该模型已在池中')
      return
    }
    setEditingRole({ ...editingRole, modelPool: [...editingRole.modelPool, modelId] })
  }

  const handleRemoveModel = (modelId: string): void => {
    if (!editingRole) return
    setEditingRole({
      ...editingRole,
      modelPool: editingRole.modelPool.filter((m) => m !== modelId),
    })
  }

  const handleSave = async (): Promise<void> => {
    if (!editingRole) return
    setSaving(true)
    try {
      await window.electronAPI.agentRole.save({ role: editingRole })
      refreshAgentRoles()
      toast.success(`已保存角色：${editingRole.displayName}`)
      handleCloseDialog()
    } catch (err) {
      toast.error('保存失败', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!editingRole) return
    if (BUILTIN_IDS.has(editingRole.id)) {
      toast.warning('内置角色不可删除，只能重置')
      return
    }
    if (!confirm(`确定删除角色「${editingRole.displayName}」？此操作不可恢复。`)) return
    try {
      await window.electronAPI.agentRole.deleteBatch([editingRole.id])
      refreshAgentRoles()
      toast.success(`已删除角色：${editingRole.displayName}`)
      handleCloseDialog()
    } catch (err) {
      toast.error('删除失败', { description: err instanceof Error ? err.message : undefined })
    }
  }

  const handleReset = async (): Promise<void> => {
    if (!confirm('确定重置所有角色为内置默认值？自定义角色将丢失。')) return
    try {
      await window.electronAPI.agentRole.resetDefault()
      refreshAgentRoles()
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
        <span className="size-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 px-5 pb-3">
        <SearchInput
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery('')}
          placeholder="搜索角色..."
          containerClassName="h-8 w-[220px]"
          showClear={searchQuery.length > 0}
        />
        <div className="ml-auto flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="size-[36px] rounded-full p-0 text-foreground/75 hover:text-foreground"
                onClick={() => void handleImportMd()}
                aria-label="导入"
              >
                <FileUp className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">从 .md 导入角色</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="size-[36px] rounded-full p-0 text-foreground/75 hover:text-foreground"
                onClick={() => void handleReset()}
                aria-label="重置"
              >
                <RotateCcw className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">重置为内置默认</TooltipContent>
          </Tooltip>
        </div>
        {searchQuery ? (
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {filteredRoles.length}/{roles.length}
          </span>
        ) : null}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {filteredRoles.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <Users className="mb-3 size-10 text-muted-foreground/30" />
            <p className="mb-1 text-sm text-muted-foreground">
              {searchQuery ? '未找到匹配角色' : '暂无角色'}
            </p>
            <p className="max-w-sm text-xs text-muted-foreground/70">
              导入 .md，或从角色商店安装；也可重置恢复内置角色。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,280px)] items-stretch gap-3 px-5 pb-8">
            {filteredRoles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                stats={statsByRole.get(role.id)}
                onClick={() => handleCardClick(role)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {editingRole ? (
        <RoleDetailDialog
          role={editingRole}
          stats={statsByRole.get(editingRole.id)}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          availableModels={availableModels}
          saving={saving}
          onSave={handleSave}
          onDelete={handleDelete}
          onFieldChange={handleFieldChange}
          onAddModel={handleAddModel}
          onRemoveModel={handleRemoveModel}
        />
      ) : null}
    </div>
  )
}

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

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="size-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 px-5 pb-2">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder="搜索商店..."
          containerClassName="h-8 w-[220px]"
          showClear={search.length > 0}
        />
        <span
          className={cn(
            'text-[11px] tabular-nums',
            source === 'remote' && 'text-emerald-600 dark:text-emerald-400',
            source === 'cached' && 'text-amber-600 dark:text-amber-400',
            source === 'builtin' && 'text-foreground/55'
          )}
        >
          {source === 'remote' ? '在线' : source === 'cached' ? '缓存' : '内置'} · {filtered.length}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 px-5 pb-3">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] transition-colors',
              category === cat
                ? 'bg-foreground/[0.1] font-medium text-foreground ring-1 ring-inset ring-foreground/10'
                : 'bg-foreground/[0.04] text-foreground/70 hover:bg-foreground/[0.07] hover:text-foreground'
            )}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="mb-3 size-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">未找到匹配角色</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,280px)] items-stretch gap-3 px-5 pb-8">
            {filtered.map((entry) => (
              <StoreRoleCard
                key={entry.id}
                entry={entry}
                isInstalled={installedIds.has(entry.id)}
                installing={installing === entry.id}
                onClick={() => {
                  setSelectedEntry(entry)
                  setDetailOpen(true)
                }}
                onInstall={() => void handleInstall(entry.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {selectedEntry ? (
        <StoreRoleDetailDialog
          entry={selectedEntry}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          isInstalled={installedIds.has(selectedEntry.id)}
          installing={installing === selectedEntry.id}
          onInstall={() => void handleInstall(selectedEntry.id)}
        />
      ) : null}
    </div>
  )
}

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
  const { wrap, Icon } = roleAvatarSpec(entry.id)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick()
      }}
      className="kanban-crew-badge group flex h-full cursor-pointer flex-col text-left titlebar-no-drag ui-pressable"
    >
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-2.5 p-3.5">
        <div className="flex items-start gap-3">
          <div
            className={cn('flex size-9 shrink-0 items-center justify-center rounded-[12px]', wrap)}
          >
            <Icon className="size-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-semibold tracking-tight text-foreground">
                {entry.displayName}
              </span>
              {entry.tier === 'recommended' ? (
                <span className="shrink-0 rounded-full bg-foreground/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-foreground/70">
                  荐
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">{entry.id}</p>
          </div>
        </div>

        <p className="line-clamp-3 flex-1 text-[11px] leading-relaxed text-muted-foreground">
          {entry.description}
        </p>

        <div className="mt-auto flex items-center gap-2 pt-0.5">
          {isInstalled ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
              <Check className="size-2.5" />
              已安装
            </span>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto size-7 rounded-full p-0 text-foreground/80 hover:bg-foreground/[0.06] hover:text-foreground"
                  disabled={installing}
                  aria-label="安装"
                  onClick={(e) => {
                    e.stopPropagation()
                    onInstall()
                  }}
                >
                  <Download className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">安装到本地</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  )
}

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
  const { wrap, Icon } = roleAvatarSpec(entry.id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px] gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-3 border-b border-border/40 px-5 py-4 pr-12">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-[12px]',
                wrap
              )}
            >
              <Icon className="size-4.5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex flex-wrap items-center gap-2 text-[15px]">
                <span>{entry.displayName}</span>
                {entry.tier === 'recommended' ? (
                  <Badge className="border-transparent bg-foreground/[0.06] px-1.5 py-0 text-[9px] text-foreground/70">
                    推荐
                  </Badge>
                ) : null}
              </DialogTitle>
              <DialogDescription className="mt-0.5 font-mono text-[11px]">
                {entry.id}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              分类
            </p>
            <Badge variant="outline" className="text-xs">
              {CATEGORY_LABELS[entry.category] ?? entry.category}
            </Badge>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              描述
            </p>
            <div
              className="text-sm leading-relaxed text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(entry.description) }}
            />
          </div>

          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              系统提示词预览
            </p>
            <ScrollArea className="h-[180px] rounded-glass-popover bg-foreground/[0.03]">
              <div
                className="p-3 text-xs leading-relaxed text-muted-foreground"
                dangerouslySetInnerHTML={{
                  __html: markdownToHtml(entry.role.systemPrompt.substring(0, 800)),
                }}
              />
            </ScrollArea>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              来源
            </p>
            <p className="text-xs text-muted-foreground">
              {entry.source}
              {entry.sourceUrl ? (
                <a
                  href={entry.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-primary hover:underline"
                >
                  查看源
                </a>
              ) : null}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/40 px-5 py-3">
          {isInstalled ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <Check className="size-3" />
              已安装
            </span>
          ) : (
            <Button size="sm" className="h-8 text-xs" disabled={installing} onClick={onInstall}>
              <Download className="mr-1 size-3" />
              {installing ? '安装中…' : '安装此角色'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
