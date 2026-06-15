/**
 * TutorialViewer - 教程入口
 *
 * 教程现在是独立 HTML 页面（resources/index.html），
 * 点击按钮通过 shell.openExternal 在系统默认浏览器中打开。
 *
 * 路径与 file:// 协议由主进程根据 'tutorial://' 哨兵拼装，
 * 渲染端不接触磁盘路径，避免安全与可移植性顾虑。
 */

import { BookOpen, ExternalLink, Sparkles } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'

export function TutorialViewer(): React.ReactElement {
  const [opening, setOpening] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleOpen = async (): Promise<void> => {
    setOpening(true)
    setError(null)
    try {
      // 'tutorial://' 哨兵：主进程识别后拼装本地 file:// URL 并打开
      const result = (await window.electronAPI.openExternal('tutorial://')) as
        | { opened: boolean; reason?: string }
        | undefined
      if (result && result.opened === false) {
        setError(result.reason ?? '打开失败')
      }
    } catch (err) {
      console.error('[TutorialViewer] 打开教程失败:', err)
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
          <BookOpen size={36} className="text-primary" />
        </div>
        <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
          <Sparkles size={14} className="text-white" />
        </div>
      </div>

      <h2 className="text-xl font-semibold text-foreground mb-2">TAgent 使用教程</h2>
      <p className="text-sm text-muted-foreground max-w-md leading-relaxed mb-8">
        教程已迁移为独立网页，在浏览器中打开以获得最佳阅读体验，包含完整的双模式介绍、安装配置与最佳实践。
      </p>

      <Button onClick={handleOpen} disabled={opening} size="lg" className="gap-2 px-6">
        <ExternalLink size={16} />
        {opening ? '正在打开…' : '在浏览器中打开教程'}
      </Button>

      {error && (
        <p className="mt-4 text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          打开失败：{error}
        </p>
      )}

      <p className="mt-6 text-[11px] text-muted-foreground/60 max-w-sm">
        提示：教程网页会使用系统默认浏览器打开。如需修改默认浏览器，请在系统设置中调整。
      </p>
    </div>
  )
}
