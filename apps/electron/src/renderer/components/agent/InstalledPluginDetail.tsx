/**
 * InstalledPluginDetail — 已安装插件详情（轻量，对齐市场详情页）
 */

import { ArrowLeft, Loader2, Pencil, Plug, Sparkles, Trash2, Zap } from 'lucide-react'
import * as React from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'

import type { McpServerEntry, SkillMeta, WorkspaceMcpConfig } from '@tagent/shared'

import { workspaceCapabilitiesVersionAtom } from '@/atoms/agent-atoms'
import { McpServerForm } from '@/components/settings/McpServerForm'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button, Switch } from '@tagent/ui'
import { useSetAtom } from 'jotai'
import { cn } from '@/lib/utils'

import type { PluginListItem } from './installed-plugins-grouping'

interface InstalledPluginDetailProps {
  item: PluginListItem
  workspaceSlug: string
  onBack: () => void
}

function extractSkillBody(content: string): string {
  const match = content.match(/^---[\s\S]*?---\s*([\s\S]*)$/)
  return match?.[1]?.trim() ?? content
}

export function InstalledPluginDetail({
  item,
  workspaceSlug,
  onBack,
}: InstalledPluginDetailProps): React.ReactElement {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border/40 px-6 py-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          返回
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {item.kind === 'skill' ? (
          <InstalledSkillDetail
            skillSlug={item.id}
            workspaceSlug={workspaceSlug}
            fallbackTitle={item.title}
          />
        ) : (
          <InstalledMcpDetail
            serverName={item.id}
            workspaceSlug={workspaceSlug}
            onDeleted={onBack}
          />
        )}
      </div>
    </div>
  )
}

function InstalledSkillDetail({
  skillSlug,
  workspaceSlug,
  fallbackTitle,
}: {
  skillSlug: string
  workspaceSlug: string
  fallbackTitle: string
}): React.ReactElement {
  const bumpCapabilities = useSetAtom(workspaceCapabilitiesVersionAtom)
  const [skill, setSkill] = React.useState<SkillMeta | null>(null)
  const [body, setBody] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      window.electronAPI.getWorkspaceCapabilities(workspaceSlug),
      window.electronAPI.readSkillContent(workspaceSlug, skillSlug),
    ])
      .then(([capabilities, content]) => {
        if (!alive) return
        const found = capabilities.skills.find((s) => s.slug === skillSlug) ?? null
        setSkill(found)
        setBody(typeof content === 'string' ? extractSkillBody(content) : null)
      })
      .catch((err) => {
        console.error('[InstalledPluginDetail] 加载 Skill 失败:', err)
        if (alive) {
          setSkill(null)
          setBody(null)
        }
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [skillSlug, workspaceSlug])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[13px] text-muted-foreground">
        <Loader2 size={16} className="mr-2 animate-spin" />
        加载中…
      </div>
    )
  }

  const title = skill?.name ?? fallbackTitle
  const description = skill?.description ?? '暂无描述'

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-6 lg:flex-row lg:gap-10">
      <aside className="w-full shrink-0 space-y-4 lg:w-44">
        <div className="space-y-1 text-[11px]">
          <p className="text-muted-foreground">已安装 / Skill</p>
          <p className="text-foreground/80">{skill?.enabled ? '已启用' : '已禁用'}</p>
        </div>
        <dl className="space-y-2.5 text-[11px]">
          <MetaItem label="标识符" value={skillSlug} />
          <MetaItem label="位置" value={`skills/${skillSlug}`} />
          {skill?.version ? <MetaItem label="版本" value={skill.version} /> : null}
        </dl>
      </aside>

      <div className="min-w-0 flex-1 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-600 dark:text-amber-400">
              <Sparkles size={22} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{skillSlug}</p>
            </div>
          </div>
          {skill ? (
            <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/40 px-3 py-2">
              <span className="text-[11px] text-muted-foreground">启用</span>
              <Switch
                checked={skill.enabled}
                onCheckedChange={async (checked) => {
                  try {
                    await window.electronAPI.toggleWorkspaceSkill(
                      workspaceSlug,
                      skill.slug,
                      checked
                    )
                    setSkill({ ...skill, enabled: checked })
                    bumpCapabilities((v) => v + 1)
                  } catch (err) {
                    console.error('[InstalledPluginDetail] 切换 Skill 状态失败:', err)
                    toast.error('切换失败')
                  }
                }}
                className="scale-90"
              />
            </div>
          ) : null}
        </div>

        <section>
          <p className="text-[13px] leading-7 text-foreground/85">{description}</p>
        </section>

        {body ? (
          <section className="space-y-2">
            <h3 className="text-[12px] font-semibold text-foreground">说明预览</h3>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-border/50 bg-muted/10 p-4 scrollbar-thin">
              <div className="prose prose-sm dark:prose-invert max-w-none text-[12px] leading-6 text-foreground/85">
                <Markdown remarkPlugins={[remarkGfm]}>{body}</Markdown>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              完整编辑请在工作区 skills 目录中修改 SKILL.md，或使用「打开目录」。
            </p>
          </section>
        ) : null}
      </div>
    </div>
  )
}

function InstalledMcpDetail({
  serverName,
  workspaceSlug,
  onDeleted,
}: {
  serverName: string
  workspaceSlug: string
  onDeleted: () => void
}): React.ReactElement {
  const bumpCapabilities = useSetAtom(workspaceCapabilitiesVersionAtom)
  const [entry, setEntry] = React.useState<McpServerEntry | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [testing, setTesting] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const config = await window.electronAPI.getWorkspaceMcpConfig(workspaceSlug)
      setEntry(config.servers[serverName] ?? null)
    } catch (err) {
      console.error('[InstalledPluginDetail] 加载 MCP 失败:', err)
      setEntry(null)
    } finally {
      setLoading(false)
    }
  }, [serverName, workspaceSlug])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleToggle = async (checked: boolean): Promise<void> => {
    if (!entry) return
    try {
      const config = await window.electronAPI.getWorkspaceMcpConfig(workspaceSlug)
      const next: WorkspaceMcpConfig = {
        servers: {
          ...config.servers,
          [serverName]: { ...entry, enabled: checked },
        },
      }
      await window.electronAPI.saveWorkspaceMcpConfig(workspaceSlug, next)
      setEntry({ ...entry, enabled: checked })
      bumpCapabilities((v) => v + 1)
    } catch (err) {
      console.error('[InstalledPluginDetail] 切换 MCP 状态失败:', err)
      toast.error('切换失败')
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
      console.error('[InstalledPluginDetail] 测试 MCP 失败:', err)
      toast.error('测试失败')
    } finally {
      setTesting(false)
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!entry) return
    setDeleting(true)
    try {
      const config = await window.electronAPI.getWorkspaceMcpConfig(workspaceSlug)
      const newServers = { ...config.servers }
      delete newServers[serverName]
      await window.electronAPI.saveWorkspaceMcpConfig(workspaceSlug, { servers: newServers })
      bumpCapabilities((v) => v + 1)
      toast.success(`已删除 MCP：${serverName}`)
      onDeleted()
    } catch (err) {
      console.error('[InstalledPluginDetail] 删除 MCP 失败:', err)
      toast.error('删除失败')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[13px] text-muted-foreground">
        <Loader2 size={16} className="mr-2 animate-spin" />
        加载中…
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="flex items-center justify-center px-6 py-20 text-center">
        <p className="text-[13px] text-muted-foreground">MCP「{serverName}」未找到</p>
      </div>
    )
  }

  const connectionSummary =
    entry.type === 'stdio'
      ? [entry.command, ...(entry.args ?? [])].filter(Boolean).join(' ')
      : (entry.url ?? '—')

  return (
    <>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-6 lg:flex-row lg:gap-10">
        <aside className="w-full shrink-0 space-y-4 lg:w-44">
          <div className="space-y-1 text-[11px]">
            <p className="text-muted-foreground">已安装 / MCP</p>
            <p className="text-foreground/80">{entry.type.toUpperCase()}</p>
          </div>
          <dl className="space-y-2.5 text-[11px]">
            <MetaItem label="传输" value={entry.type} />
            {entry.isBuiltin ? <MetaItem label="类型" value="内置" /> : null}
            <MetaItem
              label="测试"
              value={
                entry.lastTestResult ? (entry.lastTestResult.success ? '通过' : '失败') : '未测试'
              }
            />
          </dl>
        </aside>

        <div className="min-w-0 flex-1 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                <Plug size={22} strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  {serverName}
                </h2>
                <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">
                  {connectionSummary}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/40 px-3 py-2">
              <span className="text-[11px] text-muted-foreground">启用</span>
              <Switch
                checked={entry.enabled}
                onCheckedChange={(checked) => void handleToggle(checked)}
                className="scale-90"
              />
            </div>
          </div>

          {entry.lastTestResult ? (
            <p
              className={cn(
                'text-[12px]',
                entry.lastTestResult.success
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-red-700 dark:text-red-300'
              )}
            >
              {entry.lastTestResult.message}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleTest()}
              disabled={testing}
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              <span className="ml-1">{testing ? '测试中' : '测试连接'}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil size={14} />
              <span className="ml-1">编辑连接</span>
            </Button>
            {!entry.isBuiltin ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={deleting}>
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
                    <AlertDialogAction onClick={() => void handleDelete()}>删除</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
        </div>
      </div>

      {editOpen ? (
        <McpEditDialog
          serverName={serverName}
          workspaceSlug={workspaceSlug}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={() => {
            setEditOpen(false)
            void load()
            bumpCapabilities((v) => v + 1)
          }}
        />
      ) : null}
    </>
  )
}

function McpEditDialog({
  serverName,
  workspaceSlug,
  open,
  onOpenChange,
  onSaved,
}: {
  serverName: string
  workspaceSlug: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}): React.ReactElement {
  const [entry, setEntry] = React.useState<McpServerEntry | null>(null)

  React.useEffect(() => {
    if (!open) return
    window.electronAPI
      .getWorkspaceMcpConfig(workspaceSlug)
      .then((config) => setEntry(config.servers[serverName] ?? null))
      .catch(() => setEntry(null))
  }, [open, serverName, workspaceSlug])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pb-4 pt-6">
          <DialogTitle>编辑 MCP：{serverName}</DialogTitle>
          <DialogDescription>修改连接配置后保存即可生效</DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(85vh-120px)] overflow-y-auto px-6 pb-6">
          {entry ? (
            <McpServerForm
              server={{ name: serverName, entry }}
              workspaceSlug={workspaceSlug}
              onSaved={onSaved}
              onCancel={() => onOpenChange(false)}
              hideTitleBar
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MetaItem({ label, value }: { label: string; value: React.ReactNode }): React.ReactElement {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-all text-foreground/90">{value}</dd>
    </div>
  )
}
