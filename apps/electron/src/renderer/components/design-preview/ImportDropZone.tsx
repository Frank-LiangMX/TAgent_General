/**
 * ImportDropZone — Design Preview 外部导入（v3）
 *
 * 设计来源：docs/plans/2026-07-14-design-canvas-v3.md
 *
 * v3 变化：不再直接设置 HTML，而是通过 shape ops 在节点树上创建元素
 *
 * 支持：
 *  - .html → 创建 text shape 并在 agent prompt 中附上 HTML
 *  - .png/.jpg → dispatch agent 消息提示"按图复刻"
 */

import { useSetAtom } from 'jotai'
import { Upload } from 'lucide-react'
import * as React from 'react'

import { applyShapeOpsAtom } from '@/design/agent-ops-bridge'
import { dispatchAppendChatInput } from '@/lib/chat-input-bridge'
import { detectImportKind, readFileAsText } from '@/lib/import-html'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@tagent/ui'

export interface ImportDropZoneProps {
  className?: string
}

export function ImportDropZone({ className }: ImportDropZoneProps): React.ReactElement {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const applyOps = useSetAtom(applyShapeOpsAtom)

  const handleFile = React.useCallback(
    async (file: File) => {
      setError(null)
      setBusy(true)
      try {
        const kind = detectImportKind(file)

        if (kind === 'html') {
          const text = await readFileAsText(file)
          // 创建一个 frame 形状，在 agent prompt 里附上 HTML 内容
          applyOps({
            ops: [
              {
                type: 'addShape',
                shapeType: 'frame',
                name: '导入: ' + file.name,
                bounds: { x: 50, y: 50, width: 390, height: 844 },
                fills: [{ type: 'solid', color: '#ffffff', opacity: 1 }],
              },
            ],
            trigger: `导入设计稿 ${file.name}`,
          })
          // 把 HTML 内容注入 chat input 让 agent 读取
          const snippet = text.length > 2000 ? text.slice(0, 2000) + '\n\n...(截断)' : text
          dispatchAppendChatInput(
            `\n[我导入了一个 HTML 文件 "${file.name}"，内容如下：]\n\`\`\`html\n${snippet}\n\`\`\`\n请根据这个复刻为一个节点树设计`
          )
        } else if (kind === 'image') {
          dispatchAppendChatInput(
            `\n[我上传了一张设计稿 "${file.name}"，请按这张图复刻为节点树设计]`
          )
        } else {
          setError('不支持的文件类型，请使用 .html / .png / .jpg')
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [applyOps]
  )

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
    e.target.value = ''
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="flex h-7 items-center gap-1.5 rounded-glass-popover border border-border/45 bg-background/50 px-2.5 text-xs text-muted-foreground transition-colors hover:bg-background/75 hover:text-foreground disabled:pointer-events-none disabled:opacity-45"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              aria-label="导入 HTML / 截图"
            >
              <Upload className="size-3.5" />
              <span>{busy ? '导入中…' : '导入'}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            导入 HTML / 截图
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <input
        ref={inputRef}
        type="file"
        accept=".html,.htm,.png,.jpg,.jpeg,.webp,.gif"
        className="hidden"
        onChange={onChange}
      />
      {error && <span className="text-[10px] text-red-600 dark:text-red-400">{error}</span>}
    </div>
  )
}
