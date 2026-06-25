/**
 * ScratchPadView — 草稿编辑器（遗留组件，待 DraftView 替换）
 *
 * 基于 TipTap 的轻量 Markdown 编辑器，内容持久化到 ~/.tagent/scratch-pad.md。
 * 自动保存由 DraftPersistence 组件通过监听 removed_scratchPadContentAtom 统一管理。
 *
 * 支持：Markdown 快捷输入、图片粘贴、Todo 列表（- [ ] 触发）、代码高亮（lowlight）、数学公式（$..$ / $$..$$ 触发）
 */

import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Placeholder from '@tiptap/extension-placeholder'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useAtom, useAtomValue } from 'jotai'
import * as React from 'react'

import {
  draftPlaceholderAtom as removed_scratchPadContentAtom,
  draftPlaceholderLoadedAtom as removed_scratchPadLoadedAtom,
} from '@/atoms/tab-atoms'
import { SpeechButton } from '@/components/ai-elements/speech-button'
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
import { htmlToMarkdown, markdownToHtml } from '@/lib/markdown-rich-text'
import {
  SCRATCH_PAD_VOICE_INPUT_ID,
  VOICE_DICTATION_INSERT_EVENT,
  getLastFocusedVoiceInputId,
  setLastFocusedVoiceInputId,
} from '@/lib/voice-input-focus'

export function ScratchPadView(): React.ReactElement {
  const [content, setContent] = useAtom(removed_scratchPadContentAtom)
  const loaded = useAtomValue(removed_scratchPadLoadedAtom)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // 用 ref 追踪最新内容，避免在 useEffect deps 里包含 content 导致循环
  const contentRef = React.useRef(content)
  contentRef.current = content

  const extensions = React.useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false, // 用 CodeBlockLowlight 替代：支持 ``` 触发、可编辑、可删除
      }),
      Placeholder.configure({
        placeholder: '在此随意书写… 支持 Markdown 快捷输入',
      }),
      CodeBlockLowlight.configure({ lowlight }),
      // ScratchPad 无会话/文件上下文，传 null 跳过路径解析（仅支持 data-URL / 外链 / file: 协议）
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
    content: content || '',
    onUpdate: ({ editor }) => {
      setContent(editor.getHTML())
    },
    immediatelyRender: false,
  })

  // ===== 内容同步 =====

  // 仅在初始加载或编辑器重新挂载时同步内容到编辑器。
  // content 不加入 deps：用户每次输入都会更新 atom，若加入 deps 会导致
  // setContent → onUpdate → atom 变化 → setContent 死循环，
  // HTML 规范化解析会吞掉尾部空格和空段落，并重置光标位置。
  React.useEffect(() => {
    if (!loaded || !editor) return
    const latestContent = contentRef.current
    if (latestContent && editor.getHTML() !== latestContent) {
      editor.commands.setContent(latestContent)
    }
  }, [loaded, editor])

  // ===== 语音输入路由 =====

  // 编辑器获得焦点时，把"语音输入目标"标记为 Scratch Pad；点击语音按钮 / 触发快捷键时编辑器会失焦，
  // 但 ID 保持不变，从而确保识别完成回填的文本会路由到这里而不是被 RichTextInput / agent draft 抢走。
  React.useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom
    const handleFocus = (): void => {
      setLastFocusedVoiceInputId(SCRATCH_PAD_VOICE_INPUT_ID)
    }
    dom.addEventListener('focus', handleFocus, true)
    return () => dom.removeEventListener('focus', handleFocus, true)
  }, [editor])

  // 监听语音输入回填事件：仅在"上次聚焦目标"是 Scratch Pad 时消费，插入到当前光标位置
  React.useEffect(() => {
    if (!editor) return
    const handler = (event: Event): void => {
      if (getLastFocusedVoiceInputId() !== SCRATCH_PAD_VOICE_INPUT_ID) return
      const customEvent = event as CustomEvent<{ text?: string }>
      const text = customEvent.detail?.text?.trim()
      if (!text) return
      editor.chain().focus().insertContent({ type: 'text', text }).run()
      event.preventDefault()
    }
    window.addEventListener(VOICE_DICTATION_INSERT_EVENT, handler)
    return () => window.removeEventListener(VOICE_DICTATION_INSERT_EVENT, handler)
  }, [editor])

  // ===== 粘贴处理 =====

  // 粘贴时：图片转 data URL 插入；含 markdown 标记的文本走 markdownToHtml 转 HTML 注入
  React.useEffect(() => {
    const el = containerRef.current
    if (!el || !editor) return

    const handlePaste = (e: ClipboardEvent): void => {
      // 检测剪贴板中的图片
      const items = e.clipboardData?.items
      if (items) {
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            e.preventDefault()
            e.stopPropagation()
            const file = item.getAsFile()
            if (!file) return
            const reader = new FileReader()
            reader.onload = () => {
              editor
                .chain()
                .focus()
                .insertContent({
                  type: 'markdownImage',
                  attrs: { src: reader.result as string, alt: '', title: '' },
                })
                .run()
            }
            reader.readAsDataURL(file)
            return
          }
        }
      }

      const text = e.clipboardData?.getData('text/plain')
      if (!text) return
      // markdown 触发字符：#标题 *强调 >引用 -列表 `代码 [链接 ~删除 |表格 $公式
      if (!/[#*>\-`[\]~|$]/.test(text)) return

      e.preventDefault()
      e.stopPropagation()
      try {
        const html = markdownToHtml(text)
        editor.chain().focus().insertContent(html).run()
      } catch {
        // 转换失败，回退到纯文本插入
        editor.chain().focus().insertContent(text).run()
      }
    }

    el.addEventListener('paste', handlePaste, true)
    return () => el.removeEventListener('paste', handlePaste, true)
  }, [editor])

  return (
    <div ref={containerRef} className="relative flex flex-col h-full">
      <div className="flex-1 overflow-auto scrollbar-thin px-8 pt-6 pb-20">
        <div className="max-w-3xl mx-auto h-full">
          <div className="mb-5 flex flex-col gap-2">
            <div>
              <h1 className="text-xl font-semibold tracking-normal text-foreground">草稿页</h1>
              <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                临时记录内容、整理 Todo、暂存剪贴板文本，稍后再导出到会话或工作区。
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground/80">
              <span className="rounded-md bg-muted px-2 py-1">临时笔记</span>
              <span className="rounded-md bg-muted px-2 py-1">Todo 草稿</span>
              <span className="rounded-md bg-muted px-2 py-1">剪贴板暂存</span>
            </div>
          </div>
          {loaded ? (
            <EditorContent
              editor={editor}
              className="prose prose-sm dark:prose-invert max-w-none h-full [&_.ProseMirror]:min-h-full [&_.ProseMirror]:outline-none [&_.ProseMirror]:text-sm [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground/50 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
            />
          ) : (
            <div className="min-h-[200px] flex items-center justify-center">
              <span className="text-sm text-muted-foreground/40">加载中…</span>
            </div>
          )}
        </div>
      </div>
      {/* 底部居中悬浮：圆形语音输入按钮 */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-10 z-20">
        <SpeechButton className="size-11 rounded-full bg-background/95 border border-border/60 shadow-md backdrop-blur hover:bg-accent text-foreground/80" />
      </div>
      <div className="h-[28px] border-t border-border/40 px-4 flex items-center">
        <span className="text-[11px] text-muted-foreground/60">
          Scratch Pad — 内容自动保存到本地
        </span>
      </div>
    </div>
  )
}
