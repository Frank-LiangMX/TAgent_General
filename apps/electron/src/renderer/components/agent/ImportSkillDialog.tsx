/**
 * ImportSkillDialog - 从其他工作区导入 Skill 对话框
 *
 * 独立组件，封装「加载其他工作区 Skill 列表 + 选择 + 导入」完整流程。
 * 从原 AgentSettings 中的 ImportSkillFromWorkspaceDialog 重构而来。
 */

import { Sparkles } from 'lucide-react'
import * as React from 'react'

import type { OtherWorkspaceSkillsGroup, SkillMeta } from '@tagent/shared'

import { SettingsCard } from '@/components/settings/primitives'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ImportSkillDialogProps {
  /** 是否打开 */
  open: boolean
  /** 打开状态变化 */
  onOpenChange: (open: boolean) => void
  /** 目标工作区 slug */
  workspaceSlug: string
  /** 当前已安装的 Skill 列表（用于过滤） */
  currentSkills: SkillMeta[]
  /** 正在导入的 skill slug */
  importingSkill: string | null
  /** 导入回调 */
  onImport: (sourceSlug: string, skillSlug: string) => Promise<void>
}

export function ImportSkillDialog({
  open,
  onOpenChange,
  workspaceSlug,
  currentSkills,
  importingSkill,
  onImport,
}: ImportSkillDialogProps): React.ReactElement {
  const [otherWorkspaces, setOtherWorkspaces] = React.useState<OtherWorkspaceSkillsGroup[]>([])
  const [loading, setLoading] = React.useState(false)

  // 加载其他工作区的 Skill 列表
  React.useEffect(() => {
    if (!open || !workspaceSlug) return
    let alive = true
    setLoading(true)
    window.electronAPI.getOtherWorkspaceSkills(workspaceSlug)
      .then((groups) => {
        if (alive) setOtherWorkspaces(groups)
      })
      .catch((err) => {
        console.error('[ImportSkillDialog] 加载其他工作区失败:', err)
        if (alive) setOtherWorkspaces([])
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [open, workspaceSlug])

  // 过滤掉已安装的
  const installedSlugs = React.useMemo(
    () => new Set(currentSkills.map((s) => s.slug)),
    [currentSkills],
  )

  const availableWorkspaces = React.useMemo(
    () =>
      otherWorkspaces
        .map((workspace) => ({
          ...workspace,
          skills: workspace.skills.filter((skill) => !installedSlugs.has(skill.slug)),
        }))
        .filter((workspace) => workspace.skills.length > 0),
    [otherWorkspaces, installedSlugs],
  )

  const [selectedWorkspaceSlug, setSelectedWorkspaceSlug] = React.useState('')

  const selectedWorkspace = React.useMemo(
    () => availableWorkspaces.find((workspace) => workspace.workspaceSlug === selectedWorkspaceSlug) ?? null,
    [availableWorkspaces, selectedWorkspaceSlug],
  )

  React.useEffect(() => {
    if (!open || availableWorkspaces.length === 0) {
      setSelectedWorkspaceSlug('')
      return
    }
    setSelectedWorkspaceSlug((current) =>
      availableWorkspaces.some((workspace) => workspace.workspaceSlug === current)
        ? current
        : availableWorkspaces[0]?.workspaceSlug ?? '',
    )
  }, [availableWorkspaces, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pb-4 pt-6">
          <DialogTitle>从其他工作区导入 Skill</DialogTitle>
          <DialogDescription>
            从其他工作区中选择 Skill 导入到当前工作区。已安装的同名 Skill 会自动过滤。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-6 pb-6 max-h-[60vh]">
          {loading ? (
            <SettingsCard divided={false}>
              <div className="py-10 text-center text-sm text-muted-foreground">加载中...</div>
            </SettingsCard>
          ) : availableWorkspaces.length === 0 ? (
            <SettingsCard divided={false}>
              <div className="py-10 text-center text-sm text-muted-foreground">
                没有可导入的 Skill。其他工作区暂无 Skill，或者它们都已经安装到当前工作区了。
              </div>
            </SettingsCard>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">选择来源工作区</div>
                <Select value={selectedWorkspaceSlug} onValueChange={setSelectedWorkspaceSlug}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择来源工作区" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableWorkspaces.map((workspace) => (
                      <SelectItem key={workspace.workspaceSlug} value={workspace.workspaceSlug}>
                        {workspace.workspaceName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(selectedWorkspace ? [selectedWorkspace] : []).map((workspace) => (
                <div key={workspace.workspaceSlug}>
                  <div className="mb-3 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                    <span className="truncate">{workspace.workspaceName}</span>
                    <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-medium tabular-nums">
                      {workspace.skills.length} 个
                    </span>
                  </div>
                  <div className="pr-1">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {workspace.skills.map((skill) => (
                        <SettingsCard key={skill.slug} divided={false} className="overflow-hidden">
                          <div className="flex h-full flex-col gap-4 p-4">
                            <div className="flex items-start gap-3">
                              <div className="rounded-xl bg-amber-500/12 p-2 text-amber-500 shadow-sm">
                                <Sparkles size={18} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="truncate text-sm font-medium text-foreground">{skill.name}</div>
                                  {skill.version ? (
                                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                                      v{skill.version}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">{skill.slug}</div>
                              </div>
                            </div>
                            <div className="line-clamp-3 min-h-[40px] text-sm leading-6 text-muted-foreground">
                              {skill.description ?? '暂无描述'}
                            </div>
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={() => void onImport(workspace.workspaceSlug, skill.slug)}
                              disabled={importingSkill !== null}
                            >
                              {importingSkill === skill.slug ? '导入中...' : '导入'}
                            </Button>
                          </div>
                        </SettingsCard>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}