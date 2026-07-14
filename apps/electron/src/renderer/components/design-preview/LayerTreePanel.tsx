/**
 * LayerTreePanel — 画布左侧分层树面板（v2）
 *
 * 设计来源：docs/plans/2026-07-14-design-canvas-v2.md §4.1
 *
 * 数据源：canvasLayersAtom（iframe postMessage 上报的最新 layers）
 * 选中态：selectedElementIdsAtom
 * Hover：hoveredElementIdAtom（仅高亮，不影响选中）
 *
 * 视觉：与 design-preview 现有暗色玻璃风格保持一致
 */

import { useAtomValue, useSetAtom } from 'jotai'
import { ChevronDown, ChevronRight, Layers, Send } from 'lucide-react'
import * as React from 'react'

import {
  canvasLayersAtom,
  hoveredElementIdAtom,
  selectedElementIdsAtom,
  type CanvasElement,
  type CanvasElementRole,
} from '@/atoms/design-preview-atoms'
import { buildPromptFromSelection } from '@/lib/element-descriptor'
import { dispatchAppendChatInput } from '@/lib/chat-input-bridge'
import { cn } from '@/lib/utils'

const ROLE_LABEL: Record<CanvasElementRole, string> = {
  button: '按钮',
  input: '输入',
  image: '图片',
  heading: '标题',
  text: '文本',
  link: '链接',
  container: '容器',
  none: '元素',
}

/** 用 tag + text 给出简洁可读标签 */
function describe(el: CanvasElement): string {
  const role = el.role
  const base = ROLE_LABEL[role] || el.tag
  const text = el.text.trim()
  if (!text) return `<${el.tag.toLowerCase()}>`
  return `${base} · ${text.length > 18 ? text.slice(0, 18) + '…' : text}`
}

/** 递归树节点 */
interface TreeNodeProps {
  element: CanvasElement
  childMap: Map<string | null, CanvasElement[]>
  depth: number
  selectedIds: string[]
  hoveredId: string | null
  onSelect: (id: string, additive: boolean) => void
  onHover: (id: string | null) => void
  expanded: Set<string>
  toggleExpand: (id: string) => void
}

function TreeNode({
  element,
  childMap,
  depth,
  selectedIds,
  hoveredId,
  onSelect,
  onHover,
  expanded,
  toggleExpand,
}: TreeNodeProps): React.ReactElement {
  const isSelected = selectedIds.includes(element.id)
  const isHovered = hoveredId === element.id
  const children = childMap.get(element.id) ?? []
  const hasChildren = children.length > 0
  const isOpen = expanded.has(element.id)

  return (
    <>
      <div
        className={cn(
          'group flex items-center gap-1 rounded px-1.5 py-1 text-xs cursor-pointer select-none',
          isSelected && 'bg-primary/15 text-primary',
          !isSelected && isHovered && 'bg-muted/60',
          !isSelected && !isHovered && 'hover:bg-muted/40',
        )}
        style={{ paddingLeft: 4 + depth * 12 }}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(element.id, e.metaKey || e.ctrlKey || e.shiftKey)
        }}
        onMouseEnter={() => onHover(element.id)}
        onMouseLeave={() => onHover(null)}
      >
        {hasChildren ? (
          <button
            type="button"
            className="size-3.5 flex items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation()
              toggleExpand(element.id)
            }}
          >
            {isOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </button>
        ) : (
          <span className="size-3.5" />
        )}
        <span className="truncate">{describe(element)}</span>
      </div>
      {hasChildren && isOpen &&
        children.map((c) => (
          <TreeNode
            key={c.id}
            element={c}
            childMap={childMap}
            depth={depth + 1}
            selectedIds={selectedIds}
            hoveredId={hoveredId}
            onSelect={onSelect}
            onHover={onHover}
            expanded={expanded}
            toggleExpand={toggleExpand}
          />
        ))}
    </>
  )
}

export interface LayerTreePanelProps {
  className?: string
  /** 默认全部展开 */
  defaultExpanded?: boolean
}

export function LayerTreePanel({
  className,
  defaultExpanded = true,
}: LayerTreePanelProps): React.ReactElement {
  const layers = useAtomValue(canvasLayersAtom)
  const selectedIds = useAtomValue(selectedElementIdsAtom)
  const hoveredId = useAtomValue(hoveredElementIdAtom)
  const setSelected = useSetAtom(selectedElementIdsAtom)
  const setHovered = useSetAtom(hoveredElementIdAtom)

  // v2: 选中元素 → 描述 → 注入 chat input
  // 兜底：selectedIds 偶尔可能是非数组（HMR / localStorage 脏数据），强制按数组处理
  const safeSelectedIds = Array.isArray(selectedIds) ? selectedIds : []
  const selectedElements = React.useMemo<CanvasElement[]>(
    () => safeSelectedIds
      .map((id) => layers.find((l) => l.id === id))
      .filter((x): x is CanvasElement => !!x),
    [safeSelectedIds, layers],
  )
  const handleTellAgent = React.useCallback(() => {
    const prompt = buildPromptFromSelection(selectedElements)
    if (!prompt) return
    dispatchAppendChatInput(prompt)
  }, [selectedElements])

  // 收集 children 到 parentId 的反向映射
  const childMap = React.useMemo(() => {
    const map = new Map<string | null, CanvasElement[]>()
    for (const el of layers) {
      const arr = map.get(el.parentId) ?? []
      arr.push(el)
      map.set(el.parentId, arr)
    }
    return map
  }, [layers])

  // 默认展开：根节点 + 根的直系子节点
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set())
  React.useEffect(() => {
    if (layers.length === 0) return
    if (expanded.size > 0) return
    const roots = childMap.get(null) ?? []
    const next = new Set<string>()
    if (defaultExpanded) {
      for (const r of roots) {
        next.add(r.id)
        // 也展开第一层
        for (const c of childMap.get(r.id) ?? []) {
          next.add(c.id)
        }
      }
    }
    setExpanded(next)
  }, [layers, childMap, defaultExpanded, expanded.size])

  const toggleExpand = React.useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSelect = React.useCallback(
    (id: string, additive: boolean) => {
      setSelected((prev) => {
        if (additive) {
          return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        }
        return prev.includes(id) && prev.length === 1 ? [] : [id]
      })
    },
    [setSelected],
  )

  const roots = childMap.get(null) ?? []

  return (
    <div className={cn('flex h-full flex-col border-r border-border/40 bg-background/60 backdrop-blur', className)}>
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
        <div className="flex size-5 items-center justify-center rounded bg-primary/10">
          <Layers className="size-3 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-medium text-foreground truncate">分层</h3>
          <p className="text-[10px] text-muted-foreground">
            {layers.length > 0 ? `${layers.length} 个元素` : '等待画布内容'}
          </p>
        </div>
      </div>

      {/* v2: 选中后出现"告诉 Agent"按钮 */}
      {selectedIds.length > 0 && (
        <div className="border-b border-border/40 px-3 py-2">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 rounded bg-primary px-2 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
            onClick={handleTellAgent}
          >
            <Send className="size-3" />
            <span>把这 {selectedIds.length} 个元素告诉 Agent</span>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-1.5 py-2">
        {layers.length === 0 ? (
          <div className="flex h-full items-center justify-center px-3 text-center">
            <p className="text-[11px] text-muted-foreground">
              画布内有内容后，分层会自动出现
            </p>
          </div>
        ) : (
          roots.map((root) => (
            <TreeNode
              key={root.id}
              element={root}
              childMap={childMap}
              depth={0}
              selectedIds={selectedIds}
              hoveredId={hoveredId}
              onSelect={handleSelect}
              onHover={(id) => setHovered(id)}
              expanded={expanded}
              toggleExpand={toggleExpand}
            />
          ))
        )}
      </div>
    </div>
  )
}