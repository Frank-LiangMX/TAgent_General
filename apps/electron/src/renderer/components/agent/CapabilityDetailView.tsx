/**
 * CapabilityDetailView - 能力详情主区域视图
 *
 * 左侧 PluginsPanel 选中插件后，右侧展示完整详情。
 * 这里保留现有数据和编辑能力，但把视觉结构重排成更清晰的概览卡 + 分区内容。
 */

import { useAtom, useAtomValue } from 'jotai'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  LayoutGrid,
  Loader2,
  Pencil,
  Plug,
  Save,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import * as React from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'

import type {
  McpServerEntry,
  McpTransportType,
  SkillMeta,
  WorkspaceMcpConfig,
} from '@tagent/shared'

import { agentWorkspacesAtom, currentAgentWorkspaceIdAtom } from '@/atoms/agent-atoms'
import { selectedCapabilityAtom } from '@/atoms/app-mode'
import { McpServerForm } from '@/components/settings/McpServerForm'
import { SettingsCard } from '@/components/settings/primitives'
import { SkillFilesPanel } from '@/components/settings/SkillFilesPanel'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

function extractSkillBody(content: string): string {
  const match = content.match(/^---[\s\S]*?---\s*([\s\S]*)$/)
  return match?.[1]?.trim() ?? content
}

function rebuildSkillMd(
  content: string,
  patch: { name?: string; description?: string; body?: string }
): string {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (!frontmatterMatch) return content

  let fm = frontmatterMatch[1]!
  if (patch.name !== undefined) {
    fm = /^name:/m.test(fm)
      ? fm.replace(/^name:.*$/m, `name: ${patch.name}`)
      : `name: ${patch.name}\n${fm}`
  }
  if (patch.description !== undefined) {
    if (/^description:/m.test(fm)) {
      fm = fm.replace(/^description:.*$/m, `description: ${patch.description}`)
    } else {
      fm += `\ndescription: ${patch.description}`
    }
  }

  const newBody = patch.body !== undefined ? patch.body : extractSkillBody(content)
  return `---\n${fm}\n---\n\n${newBody}`
}

interface CapabilityDetailViewProps {
  /** inspector：主从布局主区，隐藏返回按钮（选中在侧栏） */
  variant?: 'default' | 'inspector'
}

export function CapabilityDetailView({
  variant = 'default',
}: CapabilityDetailViewProps): React.ReactElement {
  const hideBackButton = variant === 'inspector'
  const [selectedCapability, setSelectedCapability] = useAtom(selectedCapabilityAtom)
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)

  const workspaceSlug = React.useMemo(
    () => workspaces.find((w) => w.id === currentWorkspaceId)?.slug ?? null,
    [workspaces, currentWorkspaceId]
  )

  const handleBack = React.useCallback(() => {
    setSelectedCapability(null)
  }, [setSelectedCapability])

  if (!selectedCapability || !workspaceSlug) {
    return <EmptyCapabilityState />
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin">
      {selectedCapability.type === 'skill' ? (
        <SkillCapabilityDetail
          skillSlug={selectedCapability.key}
          workspaceSlug={workspaceSlug}
          onBack={handleBack}
          hideBackButton={hideBackButton}
          compact={hideBackButton}
        />
      ) : (
        <McpCapabilityDetail
          serverName={selectedCapability.key}
          workspaceSlug={workspaceSlug}
          onBack={handleBack}
          hideBackButton={hideBackButton}
          compact={hideBackButton}
        />
      )}
    </div>
  )
}

function SkillCapabilityDetail({
  skillSlug,
  workspaceSlug,
  onBack,
  hideBackButton,
  compact = false,
}: {
  skillSlug: string
  workspaceSlug: string
  onBack: () => void
  hideBackButton?: boolean
  compact?: boolean
}): React.ReactElement {
  const [content, setContent] = React.useState<string | null>(null)
  const [loadingContent, setLoadingContent] = React.useState(false)
  const [isEditingMeta, setIsEditingMeta] = React.useState(false)
  const [isEditingBody, setIsEditingBody] = React.useState(false)
  const [editName, setEditName] = React.useState('')
  const [editDescription, setEditDescription] = React.useState('')
  const [editBody, setEditBody] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [detailTab, setDetailTab] = React.useState<'body' | 'files'>('body')
  const [fileCount, setFileCount] = React.useState<number | null>(null)
  const [skill, setSkill] = React.useState<SkillMeta | null>(null)

  React.useEffect(() => {
    let alive = true
    setLoadingContent(true)
    setIsEditingMeta(false)
    setIsEditingBody(false)
    setDetailTab('body')
    setFileCount(null)

    window.electronAPI
      .getWorkspaceCapabilities(workspaceSlug)
      .then((capabilities) => {
        if (!alive) return
        const found = capabilities.skills.find((item) => item.slug === skillSlug) ?? null
        setSkill(found)
        return window.electronAPI.readSkillContent(workspaceSlug, skillSlug)
      })
      .then((text) => {
        if (!alive) return
        setContent(typeof text === 'string' ? text : null)
      })
      .catch((err) => {
        if (!alive) return
        console.error('[CapabilityDetail] 加载 Skill 详情失败:', err)
        setSkill(null)
        setContent(null)
      })
      .finally(() => {
        if (alive) setLoadingContent(false)
      })

    return () => {
      alive = false
    }
  }, [skillSlug, workspaceSlug])

  const body = React.useMemo(() => extractSkillBody(content ?? ''), [content])
  const sourceLabel = skill?.importSource
    ? `从 ${skill.importSource.sourceWorkspaceName} 导入`
    : '当前工作区'

  const saveMeta = async (): Promise<void> => {
    if (!content || !skill) return
    setSaving(true)
    try {
      const next = rebuildSkillMd(content, { name: editName, description: editDescription })
      await window.electronAPI.writeSkillContent(workspaceSlug, skill.slug, next)
      setContent(next)
      setIsEditingMeta(false)
      toast.success('元数据已保存')
    } catch (err) {
      console.error('[CapabilityDetail] 保存 Skill 元数据失败:', err)
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const saveBody = async (): Promise<void> => {
    if (!content || !skill) return
    setSaving(true)
    try {
      const next = rebuildSkillMd(content, { body: editBody })
      await window.electronAPI.writeSkillContent(workspaceSlug, skill.slug, next)
      setContent(next)
      setIsEditingBody(false)
      toast.success('说明已保存')
    } catch (err) {
      console.error('[CapabilityDetail] 保存 Skill 正文失败:', err)
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loadingContent) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        加载中...
      </div>
    )
  }

  if (!skill) {
    return (
      <CapabilityNotFound
        type="插件"
        name={skillSlug}
        onBack={onBack}
        hideBackButton={hideBackButton}
      />
    )
  }

  const metaTags = [
    { label: '标识符', value: skill.slug },
    { label: '位置', value: `skills/${skill.slug}` },
    { label: '来源', value: sourceLabel },
    { label: '版本', value: skill.version ?? '—' },
  ]

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-4', compact ? 'px-5 py-3' : 'px-5 py-5')}>
      <div
        className={cn(
          'rounded-2xl border border-border/50 bg-card/80 shadow-sm shadow-foreground/5',
          compact ? 'p-3.5' : 'p-4'
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {!compact ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {!hideBackButton ? (
                    <button
                      type="button"
                      onClick={onBack}
                      className="inline-flex h-8 items-center justify-center rounded-full border border-border/60 bg-muted/35 px-3 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ArrowLeft size={12} className="mr-1.5" />
                      返回
                    </button>
                  ) : null}
                  <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground">
                    指令插件
                  </span>
                  <h3 className="truncate text-base font-semibold text-foreground">{skill.name}</h3>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                      skill.enabled
                        ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border border-border/60 bg-muted/60 text-muted-foreground'
                    )}
                  >
                    {skill.enabled ? '已启用' : '已禁用'}
                  </span>
                </div>
                <p className="mt-2 max-w-[68ch] text-sm leading-6 text-muted-foreground">
                  {skill.description ?? '暂无描述'}
                </p>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                  Skill
                </span>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                    skill.enabled
                      ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'border border-border/60 bg-muted/60 text-muted-foreground'
                  )}
                >
                  {skill.enabled ? '已启用' : '已禁用'}
                </span>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!isEditingMeta ? (
              <button
                type="button"
                onClick={() => {
                  setEditName(skill.name)
                  setEditDescription(skill.description ?? '')
                  setIsEditingMeta(true)
                }}
                className="inline-flex h-8 items-center justify-center rounded-full border border-border/60 bg-muted/35 px-3 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
              >
                <Pencil size={12} className="mr-1.5" />
                编辑元数据
              </button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditingMeta(false)}
                  disabled={saving}
                >
                  <X size={14} /> 取消
                </Button>
                <Button size="sm" onClick={() => void saveMeta()} disabled={saving}>
                  <Save size={14} /> {saving ? '保存中...' : '保存'}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className={cn('mt-4 grid gap-2', compact ? 'grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4')}>
          {metaTags.map((item) => (
            <SummaryCard key={item.label} label={item.label} value={item.value} />
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2">
          <span className="text-xs text-muted-foreground">状态</span>
          <Switch
            checked={skill.enabled}
            onCheckedChange={async (checked) => {
              try {
                await window.electronAPI.toggleWorkspaceSkill(workspaceSlug, skill.slug, checked)
                setSkill((prev) => (prev ? { ...prev, enabled: checked } : prev))
              } catch (err) {
                console.error('[CapabilityDetail] 切换 Skill 状态失败:', err)
                toast.error('切换失败')
              }
            }}
            className="scale-75 origin-left"
          />
          <span className="text-xs text-muted-foreground">
            {skill.enabled ? '已启用' : '未启用'}
          </span>
        </div>
      </div>

      <Tabs
        value={detailTab}
        onValueChange={(v) => setDetailTab(v as 'body' | 'files')}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="self-start rounded-full border border-border/60 bg-muted/40 p-1">
          <TabsTrigger value="body">说明</TabsTrigger>
          <TabsTrigger value="files">
            资源文件
            {fileCount !== null && (
              <span className="ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-muted-foreground/15 px-1 text-[10px] font-medium tabular-nums">
                {fileCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="body" className="flex-1 min-h-0 pt-3">
          <SettingsCard divided={false} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  SKILL.md
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  这里适合写 Skill 的用途、边界和使用说明。
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isEditingBody ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditBody(body)
                      setIsEditingBody(true)
                    }}
                    className="inline-flex h-8 items-center justify-center rounded-full border border-border/60 bg-muted/35 px-3 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Pencil size={12} className="mr-1.5" />
                    编辑正文
                  </button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditingBody(false)}
                      disabled={saving}
                    >
                      <X size={14} /> 取消
                    </Button>
                    <Button size="sm" onClick={() => void saveBody()} disabled={saving}>
                      <Save size={14} /> {saving ? '保存中...' : '保存'}
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="p-4">
              {isEditingBody ? (
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="min-h-[360px] w-full resize-y rounded-xl border border-border/70 bg-muted/15 p-4 text-sm font-mono leading-6 text-foreground outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
                  placeholder="输入 Skill 说明内容（支持 Markdown）..."
                />
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <Markdown remarkPlugins={[remarkGfm]}>{body || '暂无说明内容'}</Markdown>
                </div>
              )}
            </div>
          </SettingsCard>
        </TabsContent>

        <TabsContent value="files" className="flex-1 min-h-0 pt-3">
          <SkillFilesPanel
            workspaceSlug={workspaceSlug}
            skillSlug={skill.slug}
            onFileCountChange={setFileCount}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function McpCapabilityDetail({
  serverName,
  workspaceSlug,
  onBack,
  hideBackButton,
  compact = false,
}: {
  serverName: string
  workspaceSlug: string
  onBack: () => void
  hideBackButton?: boolean
  compact?: boolean
}): React.ReactElement {
  const [loading, setLoading] = React.useState(true)
  const [isEditing, setIsEditing] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [testing, setTesting] = React.useState(false)
  const [entry, setEntry] = React.useState<McpServerEntry | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const config = await window.electronAPI.getWorkspaceMcpConfig(workspaceSlug)
      setEntry(config.servers[serverName] ?? null)
    } catch (err) {
      console.error('[CapabilityDetail] 加载 MCP 详情失败:', err)
      setEntry(null)
    } finally {
      setLoading(false)
    }
  }, [serverName, workspaceSlug])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleDelete = async (): Promise<void> => {
    if (!entry) return
    setDeleting(true)
    try {
      const config = await window.electronAPI.getWorkspaceMcpConfig(workspaceSlug)
      const newServers = { ...config.servers }
      delete newServers[serverName]
      const newConfig: WorkspaceMcpConfig = { servers: newServers }
      await window.electronAPI.saveWorkspaceMcpConfig(workspaceSlug, newConfig)
      toast.success(`已删除 MCP 服务器：${serverName}`)
      onBack()
    } catch (err) {
      console.error('[CapabilityDetail] 删除 MCP 服务器失败:', err)
      toast.error('删除失败')
    } finally {
      setDeleting(false)
    }
  }

  const handleTest = async (): Promise<void> => {
    if (!entry || testing) return
    setTesting(true)
    try {
      const result = await window.electronAPI.testMcpServer(serverName, entry)
      setEntry((prev) =>
        prev
          ? {
              ...prev,
              lastTestResult: {
                success: result.success,
                message: result.message,
                timestamp: Date.now(),
              },
            }
          : prev
      )
      if (result.success) {
        toast.success('测试成功', { description: result.message })
      } else {
        toast.error('测试失败', { description: result.message })
      }
    } catch (err) {
      console.error('[CapabilityDetail] 测试 MCP 连接失败:', err)
      toast.error('测试失败')
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        加载中...
      </div>
    )
  }

  if (!entry) {
    return (
      <CapabilityNotFound
        type="插件"
        name={serverName}
        onBack={onBack}
        hideBackButton={hideBackButton}
      />
    )
  }

  const envCount = entry.env ? Object.keys(entry.env).length : 0
  const headerCount = entry.headers ? Object.keys(entry.headers).length : 0

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-4', compact ? 'px-5 py-3' : 'px-5 py-5')}>
      <div
        className={cn(
          'rounded-2xl border border-border/50 bg-card/80 shadow-sm shadow-foreground/5',
          compact ? 'p-3.5' : 'p-4'
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {!compact ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {!hideBackButton ? (
                    <button
                      type="button"
                      onClick={onBack}
                      className="inline-flex h-8 items-center justify-center rounded-full border border-border/60 bg-muted/35 px-3 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ArrowLeft size={12} className="mr-1.5" />
                      返回
                    </button>
                  ) : null}
                  <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground">
                    连接插件
                  </span>
                  <h3 className="truncate text-base font-semibold text-foreground">{serverName}</h3>
                  {entry.isBuiltin && (
                    <span className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                      内置
                    </span>
                  )}
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                      entry.enabled
                        ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border border-border/60 bg-muted/60 text-muted-foreground'
                    )}
                  >
                    {entry.enabled ? '已启用' : '已禁用'}
                  </span>
                </div>
                <p className="mt-2 max-w-[72ch] text-sm leading-6 text-muted-foreground">
                  {entry.type === 'stdio'
                    ? (entry.command ?? 'stdio 服务器')
                    : (entry.url ?? '远程 MCP 服务器')}
                </p>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                  MCP
                </span>
                {entry.isBuiltin ? (
                  <span className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                    内置
                  </span>
                ) : null}
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                    entry.enabled
                      ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'border border-border/60 bg-muted/60 text-muted-foreground'
                  )}
                >
                  {entry.enabled ? '已启用' : '已禁用'}
                </span>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              <span className="ml-1">刷新</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleTest()}
              disabled={testing || loading}
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              <span className="ml-1">{testing ? '测试中' : '测试连接'}</span>
            </Button>
            {!isEditing && (
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Pencil size={14} />
                <span className="ml-1">编辑</span>
              </Button>
            )}
            {!entry.isBuiltin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm" disabled={deleting}>
                    <Trash2 size={14} />
                    <span className="ml-1">删除</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>删除 MCP 服务器</AlertDialogTitle>
                    <AlertDialogDescription>
                      确定删除「{serverName}」吗？此操作不可恢复。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      删除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <div className={cn('mt-4 grid gap-2', compact ? 'grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4')}>
          <SummaryCard label="传输" value={TRANSPORT_LABELS[entry.type]} />
          <SummaryCard label="环境变量" value={envCount > 0 ? `${envCount} 项` : '无'} />
          <SummaryCard label="请求头" value={headerCount > 0 ? `${headerCount} 项` : '无'} />
          <SummaryCard label="超时" value={entry.timeout != null ? `${entry.timeout}s` : '默认'} />
        </div>
      </div>

      {isEditing ? (
        <div className="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm shadow-foreground/5">
          <McpServerForm
            server={{ name: serverName, entry }}
            workspaceSlug={workspaceSlug}
            onSaved={async () => {
              await load()
              setIsEditing(false)
            }}
            onCancel={() => setIsEditing(false)}
            hideTitleBar
          />
        </div>
      ) : (
        <>
          <SettingsCard divided={false} className="overflow-hidden">
            <div className="border-b border-border/60 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                连接配置
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                这里显示连接方式和可直接修改的关键字段。
              </div>
            </div>
            <div className="divide-y divide-border/60">
              <div className="flex items-center gap-4 px-4 py-2.5">
                <span className="w-20 shrink-0 text-xs text-muted-foreground">状态</span>
                <Switch
                  checked={entry.enabled}
                  onCheckedChange={async (checked) => {
                    try {
                      const config = await window.electronAPI.getWorkspaceMcpConfig(workspaceSlug)
                      const newConfig: WorkspaceMcpConfig = {
                        servers: {
                          ...config.servers,
                          [serverName]: { ...entry, enabled: checked },
                        },
                      }
                      await window.electronAPI.saveWorkspaceMcpConfig(workspaceSlug, newConfig)
                      setEntry((prev) => (prev ? { ...prev, enabled: checked } : prev))
                    } catch (err) {
                      console.error('[CapabilityDetail] 切换 MCP 状态失败:', err)
                      toast.error('切换失败')
                    }
                  }}
                  className="scale-75 origin-left"
                />
                <span className="text-xs text-muted-foreground">
                  {entry.enabled ? '已启用' : '未启用'}
                </span>
              </div>
              <MetadataRow label="类型" value={TRANSPORT_LABELS[entry.type]} />
              {entry.type === 'stdio' && (
                <>
                  <MetadataRow label="命令" value={entry.command ?? '—'} />
                  {entry.args && entry.args.length > 0 && (
                    <MetadataRow label="参数" value={entry.args.join(' ')} />
                  )}
                </>
              )}
              {(entry.type === 'http' || entry.type === 'sse') && (
                <MetadataRow label="URL" value={entry.url ?? '—'} />
              )}
              {entry.timeout != null && <MetadataRow label="超时" value={`${entry.timeout}s`} />}
            </div>
          </SettingsCard>

          {entry.env && Object.keys(entry.env).length > 0 && (
            <SettingsCard divided={false} className="overflow-hidden">
              <div className="border-b border-border/60 px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  环境变量
                </div>
              </div>
              <div className="divide-y divide-border/60">
                {Object.entries(entry.env).map(([key, value]) => (
                  <MetadataRow key={key} label={key} value={value} />
                ))}
              </div>
            </SettingsCard>
          )}

          {entry.headers && Object.keys(entry.headers).length > 0 && (
            <SettingsCard divided={false} className="overflow-hidden">
              <div className="border-b border-border/60 px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  请求头
                </div>
              </div>
              <div className="divide-y divide-border/60">
                {Object.entries(entry.headers).map(([key, value]) => (
                  <MetadataRow key={key} label={key} value={value} />
                ))}
              </div>
            </SettingsCard>
          )}

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <SettingsCard divided={false} className="overflow-hidden">
              <div className="border-b border-border/60 px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  连接测试
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  这里显示最近一次连通性测试的结果。
                </div>
              </div>
              <div className="p-4">
                {entry.lastTestResult ? (
                  <div
                    className={cn(
                      'rounded-xl border p-3',
                      entry.lastTestResult.success
                        ? 'border-emerald-500/20 bg-emerald-500/5'
                        : 'border-red-500/20 bg-red-500/5'
                    )}
                  >
                    <div className="flex items-start gap-2 text-sm">
                      {entry.lastTestResult.success ? (
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                      ) : (
                        <XCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
                      )}
                      <div className="min-w-0">
                        <div
                          className={
                            entry.lastTestResult.success
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : 'text-red-700 dark:text-red-300'
                          }
                        >
                          {entry.lastTestResult.message}
                        </div>
                        {entry.lastTestResult.timestamp != null && (
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {new Date(entry.lastTestResult.timestamp).toLocaleString('zh-CN')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                    <span className="text-xs leading-5 text-amber-700 dark:text-amber-300">
                      还没有测试过这条连接。点击刷新旁边的测试按钮后，可以快速确认配置是否可用。
                    </span>
                  </div>
                )}
              </div>
            </SettingsCard>

            {entry.isBuiltin && (
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 text-foreground">
                  <ShieldCheck size={14} className="text-blue-500" />
                  <span className="text-sm font-medium">内置服务器</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  这类 MCP 不可删除，只能调整连接可用性和环境变量。
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function MetadataRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}): React.ReactElement {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 px-4 py-2.5">
      <span className="pt-0.5 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-sm text-foreground">{value}</span>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  )
}

const TRANSPORT_LABELS: Record<McpTransportType, string> = {
  stdio: 'stdio',
  http: 'HTTP',
  sse: 'SSE',
}

function EmptyCapabilityState(): React.ReactElement {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-sm rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-8 text-center">
        <LayoutGrid size={32} className="mx-auto text-muted-foreground/30" strokeWidth={1.5} />
        <h4 className="mt-4 text-sm font-medium text-foreground">选择一个插件查看详情</h4>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          从左侧列表点击具体插件，右侧会显示配置、状态、测试结果和编辑入口。
        </p>
      </div>
    </div>
  )
}

function CapabilityNotFound({
  type,
  name,
  onBack,
  hideBackButton,
}: {
  type: string
  name: string
  onBack: () => void
  hideBackButton?: boolean
}): React.ReactElement {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-sm rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-8 text-center">
        <p className="text-sm font-medium text-foreground">
          {type}「{name}」未找到
        </p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          可能是它已经被删除，或者列表还没有刷新。
        </p>
        {!hideBackButton ? (
          <button
            type="button"
            onClick={onBack}
            className="mt-4 inline-flex h-8 items-center justify-center rounded-full border border-border/60 bg-background px-3 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
          >
            返回列表
          </button>
        ) : null}
      </div>
    </div>
  )
}
