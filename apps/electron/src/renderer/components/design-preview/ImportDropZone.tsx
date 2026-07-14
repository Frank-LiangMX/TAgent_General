/**
 * ImportDropZone — Design Preview 顶部导入按钮 + 拖拽（v2）
 *
 * 设计来源：docs/plans/2026-07-14-design-canvas-v2.md §4.5
 */

import { useSetAtom } from 'jotai'
import { Upload } from 'lucide-react'
import * as React from 'react'

import { setDesignHtmlAtom, toggleDesignEnabledAtom } from '@/atoms/design-preview-atoms'
import { dispatchAppendChatInput } from '@/lib/chat-input-bridge'
import { importDesignFile } from '@/lib/import-html'
import { cn } from '@/lib/utils'

export interface ImportDropZoneProps {
  className?: string
}

export function ImportDropZone({ className }: ImportDropZoneProps): React.ReactElement {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [warning, setWarning] = React.useState<string | null>(null)
  const setHtml = useSetAtom(setDesignHtmlAtom)
  const setEnabled = useSetAtom(toggleDesignEnabledAtom)

  const handleFile = React.useCallback(
    async (file: File) => {
      setError(null)
      setWarning(null)
      setBusy(true)
      try {
        const r = await importDesignFile(file)
        if (r.warnings.length > 0) setWarning(r.warnings.join('；'))
        if (r.errors.length > 0) {
          setError(r.errors.join('；'))
          return
        }
        if (r.kind === 'html' && r.parsed) {
          setHtml({ html: r.parsed.html, css: r.parsed.css ?? undefined })
          setEnabled(true)
        } else if (r.kind === 'image' && r.imageDataUrl) {
          // 截图：把图片作为附件描述追加到 chat input（Agent 会调用 image-to-code skill）
          dispatchAppendChatInput(
            `\n[我上传了一张设计稿，请按这张图复刻为 HTML/CSS]`,
          )
          // 暂不直接渲染图到画布（agent 复刻后会注入）
        } else {
          setError('导入后未产生可用的画布内容')
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [setHtml, setEnabled],
  )

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
    e.target.value = '' // 允许选同一个文件
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        type="button"
        className="flex items-center gap-1.5 rounded border border-border/40 bg-background/60 px-2 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-50"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        onDrop={onDrop}
        onDragOver={onDragOver}
        title="导入 HTML / 截图（拖拽到此处也可）"
      >
        <Upload className="size-3.5" />
        <span>{busy ? '导入中…' : '导入'}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".html,.htm,.png,.jpg,.jpeg,.webp,.gif,.zip"
        className="hidden"
        onChange={onChange}
      />
      {warning && (
        <span className="text-[10px] text-amber-600 dark:text-amber-400">{warning}</span>
      )}
      {error && (
        <span className="text-[10px] text-red-600 dark:text-red-400" title={error}>
          ⚠ {error.slice(0, 60)}
        </span>
      )}
    </div>
  )
}