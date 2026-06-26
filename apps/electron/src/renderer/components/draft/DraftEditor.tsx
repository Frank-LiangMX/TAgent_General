/**
 * DraftEditor — 基于 TipTap 的富文本编辑器 + 需求列表
 *
 * 复用 ScratchPadView 的全部扩展（StarterKit, Placeholder, CodeBlockLowlight, 数学公式, 任务列表, 表格, RawHtml, 图片, 视频）。
 * 编辑 currentDraftContextAtom（HTML），同时在其下方展示需求块列表。
 */

import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Placeholder from '@tiptap/extension-placeholder'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useAtom, useAtomValue } from 'jotai'
import * as React from 'react'

import {
  currentDraftContextAtom,
  currentDraftRequirementsAtom,
  draftsLoadedAtom,
} from '@/atoms/draft-atoms'
import {
  MathBlock,
  MathInline,
  RawHtmlBlock,
  RawHtmlInline,
  TaskItem,
  TaskList,
  tableExtensions,
  createMarkdownImage,
  createMarkdownVideo,
} from '@/components/diff/markdown-preview-extensions'
import { lowlight } from '@/lib/lowlight'

import { RequirementList } from './RequirementList'

export function DraftEditor(): React.ReactElement {
  const [context, setContext] = useAtom(currentDraftContextAtom)
  const loaded = useAtomValue(draftsLoadedAtom)
  const requirements = useAtomValue(currentDraftRequirementsAtom)

  // 用 ref 追踪最新内容，避免 onUpdate → atom 变化 → 重新 setContent 死循环
  const contextRef = React.useRef(context)
  contextRef.current = context

  const extensions = React.useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: '描述你的需求背景、约束和目标… 支持 Markdown 快捷输入',
      }),
      CodeBlockLowlight.configure({ lowlight }),
      createMarkdownImage(null),
      createMarkdownVideo(null),
      RawHtmlBlock,
      RawHtmlInline,
      MathBlock,
      MathInline,
      TaskList,
      TaskItem,
      ...tableExtensions,
    ],
    []
  )

  const editor = useEditor({
    extensions,
    content: context || '',
    onUpdate: ({ editor }) => {
      setContext(editor.getHTML())
    },
    immediatelyRender: false,
  })

  // 仅在初始加载或编辑器重新挂载时同步内容
  React.useEffect(() => {
    if (!loaded || !editor) return
    const latest = contextRef.current
    if (latest && editor.getHTML() !== latest) {
      editor.commands.setContent(latest)
    }
  }, [loaded, editor])

  return (
    <div className="px-8 pt-6 pb-8">
      <div className="max-w-3xl mx-auto">
        {/* 背景上下文编辑器 */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-foreground/70 mb-2">背景上下文</h2>
          {loaded ? (
            <EditorContent
              editor={editor}
              className="prose prose-sm dark:prose-invert max-w-none [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:outline-none [&_.ProseMirror]:text-sm [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground/50 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
            />
          ) : (
            <div className="min-h-[120px] flex items-center justify-center">
              <span className="text-sm text-muted-foreground/40">加载中…</span>
            </div>
          )}
        </div>

        {/* 需求块列表 */}
        <RequirementList requirements={requirements} />
      </div>
    </div>
  )
}
