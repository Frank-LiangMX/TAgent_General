/**
 * LayerTreePanel — 左侧分层树面板
 *
 * 双数据源：
 *  - v3 优先：currentDocumentAtom（CanvasDocument.shapes）
 *  - v2 回退：canvasLayersAtom（iframe postMessage）
 */

import { useAtomValue, useSetAtom } from 'jotai'
import { ChevronDown, ChevronRight, ChevronUp, Layers, Send } from 'lucide-react'
import * as React from 'react'

import { currentDocumentAtom } from '@/design/canvas-shape-store'
import { buildLayerTree, type LayerTreeNode } from '@/design/canvas-layer-tree'
import { selectedShapeIdsAtom, selectShapeAtom } from '@/design/canvas-selection-store'
import {
  canvasLayersAtom,
  selectedElementIdsAtom,
  type CanvasElement,
} from '@/atoms/design-preview-atoms'
import { dispatchAppendChatInput } from '@/lib/chat-input-bridge'
import { cn } from '@/lib/utils'

const TYPE_LABEL: Record<string, string> = {
  frame: '页面',
  rect: '矩形',
  ellipse: '椭圆',
  text: '文本',
  image: '图片',
  group: '编组',
  line: '线条',
  arrow: '箭头',
  button: '按钮',
  input: '输入',
  heading: '标题',
  link: '链接',
  container: '容器',
  none: '元素',
}

function describeTag(tag: string, role: string, text: string): string {
  const label = TYPE_LABEL[role] || role || tag.toLowerCase()
  if (!text) return `<${tag.toLowerCase()}>`
  return `${label} · ${text.length > 18 ? text.slice(0, 18) + '…' : text}`
}

function buildPromptFromText(elements: Array<{ name: string }>): string {
  if (elements.length === 0) return ''
  const names = elements.map((e) => `"${e.name}"`).join('、')
  return `把${names}改一下：`
}

interface TreeItem {
  id: string
  name: string
  children: string[]
  depth: number
}

function TreeView({
  items,
  selectedIds,
  onSelect,
  expanded,
  toggleExpand,
}: {
  items: TreeItem[]
  selectedIds: string[]
  onSelect: (id: string) => void
  expanded: Set<string>
  toggleExpand: (id: string) => void
}): React.ReactElement {
  const itemMap = React.useMemo(() => {
    const m = new Map(items.map((i) => [i.id, i]))
    return m
  }, [items])

  const roots = items.filter((i) => i.depth === 0)

  function renderNode(item: TreeItem): React.ReactElement {
    const isSelected = selectedIds.includes(item.id)
    const hasChildren = item.children.length > 0
    const isOpen = expanded.has(item.id)

    return (
      <React.Fragment key={item.id}>
        <div
          className={cn(
            'group flex items-center gap-1 rounded px-1.5 py-1 text-xs cursor-pointer select-none',
            isSelected && 'bg-primary/15 text-primary',
            !isSelected && 'hover:bg-muted/40'
          )}
          style={{ paddingLeft: 4 + item.depth * 12 }}
          onClick={() => onSelect(item.id)}
        >
          {hasChildren ? (
            <button
              type="button"
              className="size-3.5 flex items-center justify-center text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                toggleExpand(item.id)
              }}
            >
              {isOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            </button>
          ) : (
            <span className="size-3.5" />
          )}
          <span className="truncate">{item.name}</span>
        </div>
        {hasChildren &&
          isOpen &&
          item.children.map((cid) => {
            const child = itemMap.get(cid)
            return child ? renderNode(child) : null
          })}
      </React.Fragment>
    )
  }

  return <>{roots.map(renderNode)}</>
}

export interface LayerTreePanelProps {
  className?: string
  /** 浮岛展开态（false 时只显示 Layers 把手行） */
  open?: boolean
  /** 点击把手行切换展开/收起 */
  onToggle?: () => void
}

export function LayerTreePanel({
  className,
  open = true,
  onToggle,
}: LayerTreePanelProps): React.ReactElement | null {
  // v3 数据源
  const doc = useAtomValue(currentDocumentAtom)
  const v3Nodes = React.useMemo(() => buildLayerTree(doc), [doc])
  const v3Selected = useAtomValue(selectedShapeIdsAtom)
  const v3Select = useSetAtom(selectShapeAtom)

  // v2 数据源
  const v2Layers = useAtomValue(canvasLayersAtom)
  const v2Selected = useAtomValue(selectedElementIdsAtom)
  const v2SetSelected = useSetAtom(selectedElementIdsAtom)

  const hasV3 = Object.keys(doc.shapes).length > 1

  // 根据数据源决定内容
  const items = React.useMemo<TreeItem[]>(() => {
    if (hasV3) {
      return v3Nodes.map((n) => ({
        id: n.id,
        name: n.name,
        children: n.childIds,
        depth: n.depth,
      }))
    }
    // v2: 从 CanvasElement[] 构建树
    if (v2Layers.length === 0) return []
    const v2Items: TreeItem[] = []
    function walk(id: string, depth: number, visited: Set<string>) {
      if (visited.has(id)) return
      visited.add(id)
      const el = v2Layers.find((l) => l.id === id)
      if (!el) return
      v2Items.push({
        id: el.id,
        name: describeTag(el.tag, el.role, el.text),
        children: el.childIds,
        depth,
      })
      for (const cid of el.childIds) walk(cid, depth + 1, visited)
    }
    const roots = v2Layers.filter((l) => l.parentId === null)
    const visited = new Set<string>()
    for (const r of roots) walk(r.id, 0, visited)
    return v2Items
  }, [hasV3, v3Nodes, v2Layers])

  const selectedIds = hasV3 ? v3Selected : v2Selected
  const handleSelect = hasV3 ? v3Select : (id: string) => v2SetSelected([id])

  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set())
  React.useEffect(() => {
    if (items.length === 0 || expanded.size > 0) return
    const next = new Set<string>()
    for (const item of items.slice(0, 3)) {
      next.add(item.id)
    }
    setExpanded(next)
  }, [items, expanded.size])

  const toggleExpand = React.useCallback((id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }, [])

  const selectedNames = React.useMemo(
    () => items.filter((i) => selectedIds.includes(i.id)).map((i) => ({ name: i.name })),
    [items, selectedIds]
  )

  const handleTellAgent = React.useCallback(() => {
    const prompt = buildPromptFromText(selectedNames)
    if (!prompt) return
    dispatchAppendChatInput(prompt)
  }, [selectedNames])

  if (items.length === 0) return null

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-xl border border-border/50 bg-background/70 backdrop-blur',
        className
      )}
    >
      {/* 把手行：Layers 浮岛的常驻头（点击展开/收起，同一个浮窗） */}
      <button
        type="button"
        className="flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? '收起分层' : '展开分层'}
      >
        <Layers className={cn('size-3.5', open && 'text-primary')} />
        <span className={cn(open && 'text-foreground')}>Layers</span>
        <span className="text-[10px]">{items.length}</span>
        {open ? (
          <ChevronUp className="ml-auto size-3" />
        ) : (
          <ChevronDown className="ml-auto size-3" />
        )}
      </button>

      {open && (
        <>
          {selectedIds.length > 0 && (
            <div className="px-2.5 pb-1.5">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-2 py-1.5 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                onClick={handleTellAgent}
              >
                <Send className="size-3" />
                <span>把这 {selectedIds.length} 个元素告诉 Agent</span>
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-1.5 pb-2">
            <TreeView
              items={items}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              expanded={expanded}
              toggleExpand={toggleExpand}
            />
          </div>
        </>
      )}
    </div>
  )
}
