/**
 * TASidebarSessions — TA 模式『会话』Tab 的 LeftSidebar 概览
 *
 * 显示：
 * - 顶部：新建会话按钮（点击 → 切到通用模式 + 打开新 TA 会话）
 * - 中部：TA 会话列表（来自 taSessionsAtom 派生 atom）
 * - 列表项：标题 + 相对时间，点击切到通用模式打开
 *
 * 数据隔离：taSessionsAtom 过滤 mode==='ta'，通用模式会话不会出现。
 */

import { useAtomValue, useSetAtom } from 'jotai'
import { MessageSquare, Plus, ChevronRight } from 'lucide-react'
import * as React from 'react'

import { taSessionsAtom } from '@/atoms/agent-atoms'
import { topLevelModeAtom } from '@/atoms/app-mode'
import { Button } from '@/components/ui/button'
import { useCreateSession } from '@/hooks/useCreateSession'
import { useOpenSession } from '@/hooks/useOpenSession'
import { cn } from '@/lib/utils'

/** 相对时间格式化（与 AssetLibraryPanel 中一致） */
function getTimeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return `${Math.floor(diff / 86_400_000)} 天前`
}

export function TASidebarSessions(): React.ReactElement {
  const sessions = useAtomValue(taSessionsAtom)
  const setTopLevelMode = useSetAtom(topLevelModeAtom)
  const createSession = useCreateSession()
  const openSession = useOpenSession()

  const handleNew = React.useCallback(async () => {
    const meta = await createSession.createAgent({ mode: 'ta' })
    if (!meta) return
    setTopLevelMode('general')
    openSession('agent', meta.id, meta.title)
  }, [createSession, openSession, setTopLevelMode])

  const handleOpen = React.useCallback(
    (id: string, title: string) => {
      setTopLevelMode('general')
      openSession('agent', id, title)
    },
    [openSession, setTopLevelMode]
  )

  return (
    <div className="px-3 py-3 flex flex-col gap-3">
      {/* 顶部：新建按钮 */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleNew}
        className="w-full justify-start gap-2 h-8 text-[13px] titlebar-no-drag"
      >
        <Plus size={14} />
        新建 TA 会话
      </Button>

      {/* 提示卡 */}
      <div className="rounded-lg bg-muted/40 border border-border/40 px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
        TA 会话与通用模式会话<strong className="text-foreground/80">数据隔离</strong>，
        会话中自动启用 TA 工具集（命名规范、目录检查等）。
      </div>

      {/* 列表 */}
      <div className="flex flex-col gap-1">
        {sessions.length === 0 ? (
          <div className="text-[12px] text-muted-foreground/60 text-center py-6">
            暂无 TA 会话
          </div>
        ) : (
          sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleOpen(s.id, s.title)}
              className={cn(
                'group flex items-center gap-2 px-2.5 py-2 rounded-md text-[13px] text-left',
                'hover:bg-foreground/[0.04] transition-colors duration-100'
              )}
            >
              <MessageSquare size={13} className="flex-shrink-0 text-foreground/45" />
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium text-foreground/85">{s.title}</div>
                <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {getTimeAgo(s.updatedAt)}
                </div>
              </div>
              <ChevronRight
                size={12}
                className="flex-shrink-0 text-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </button>
          ))
        )}
      </div>
    </div>
  )
}
