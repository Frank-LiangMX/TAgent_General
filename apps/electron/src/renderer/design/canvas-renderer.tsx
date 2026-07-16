/**
 * canvas-renderer.tsx — SVG 节点画布渲染（v3）
 *
 * 从 CanvasDocument → SVG，取代 v2 的 iframe + HtmlRenderer。
 */

import * as React from 'react'

import type { CanvasDocument, CanvasShape } from './canvas-types'

export interface CanvasRendererProps {
  document: CanvasDocument
  selectedIds: string[]
  hoveredId: string | null
  onShapeClick: (id: string, e: React.MouseEvent) => void
  onShapeHover: (id: string | null) => void
  className?: string
}

/** 计算文档的总边界（用于 SVG viewBox） */
function computeDocBounds(doc: CanvasDocument) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const shape of Object.values(doc.shapes)) {
    const b = shape.bounds
    if (b.width === 0 && b.height === 0) continue
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.width)
    maxY = Math.max(maxY, b.y + b.height)
  }
  if (!isFinite(minX)) return { x: 0, y: 0, width: 390, height: 844 }
  return { x: minX, y: minY, width: maxX - minX + 200, height: maxY - minY + 200 }
}

function ShapeNode({
  shape,
  selected,
  hovered,
  onClick,
  onHover,
}: {
  shape: CanvasShape
  selected: boolean
  hovered: boolean
  onClick: (id: string, e: React.MouseEvent) => void
  onHover: (id: string | null) => void
}): React.ReactElement | null {
  if (!shape.visible) return null
  const { x, y, width, height } = shape.bounds

  const fillColor = shape.fills?.[0]?.color ?? 'transparent'
  const strokeColor = shape.strokes?.[0]?.color ?? 'none'
  const strokeWidth = shape.strokes?.[0]?.width ?? 0
  const fillOpacity = shape.fills?.[0]?.opacity ?? 1

  const isSelected = selected
  const isHovered = hovered && !isSelected

  const baseProps = {
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation()
      onClick(shape.id, e)
    },
    onMouseEnter: () => onHover(shape.id),
    onMouseLeave: () => onHover(null),
    style: { cursor: 'pointer' as const },
  }

  const children = shape.children.map((cid) => ({}) as CanvasShape)
  void children

  switch (shape.type) {
    case 'rect':
    case 'frame':
    case 'group':
      return (
        <g key={shape.id} {...baseProps}>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            rx={shape.cornerRadius}
            ry={shape.cornerRadius}
            fill={fillColor}
            fillOpacity={fillOpacity}
            stroke={isSelected ? '#3b82f6' : isHovered ? '#94a3b8' : strokeColor}
            strokeWidth={isSelected ? 2 : isHovered ? 1.5 : strokeWidth}
            strokeDasharray={isHovered && !isSelected ? '4 2' : 'none'}
          />
          {shape.text && (
            <text
              x={x + 12}
              y={y + (shape.fontSize ?? 14) + 4}
              fontSize={shape.fontSize ?? 14}
              fontFamily={shape.fontFamily ?? 'system-ui'}
              fontWeight={shape.fontWeight ?? 400}
              fill={shape.textColor ?? '#1a1a1a'}
            >
              {shape.text}
            </text>
          )}
        </g>
      )

    case 'ellipse':
      return (
        <g key={shape.id} {...baseProps}>
          <ellipse
            cx={x + width / 2}
            cy={y + height / 2}
            rx={width / 2}
            ry={height / 2}
            fill={fillColor}
            fillOpacity={fillOpacity}
            stroke={isSelected ? '#3b82f6' : isHovered ? '#94a3b8' : strokeColor}
            strokeWidth={isSelected ? 2 : isHovered ? 1.5 : strokeWidth}
            strokeDasharray={isHovered && !isSelected ? '4 2' : 'none'}
          />
        </g>
      )

    case 'text':
      return (
        <g key={shape.id} {...baseProps}>
          <text
            x={x}
            y={y + (shape.fontSize ?? 14)}
            fontSize={shape.fontSize ?? 14}
            fontFamily={shape.fontFamily ?? 'system-ui'}
            fontWeight={shape.fontWeight ?? 400}
            fill={shape.textColor ?? '#1a1a1a'}
          >
            {shape.text ?? ''}
          </text>
        </g>
      )

    case 'image':
      return shape.imageSrc ? (
        <g key={shape.id} {...baseProps}>
          <image
            href={shape.imageSrc}
            x={x}
            y={y}
            width={width}
            height={height}
            preserveAspectRatio="xMidYMid slice"
          />
        </g>
      ) : (
        <g key={shape.id} {...baseProps}>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill="#e2e8f0"
            stroke="#94a3b8"
            strokeWidth={1}
            strokeDasharray="4 2"
          />
          <text x={x + 8} y={y + height / 2 + 6} fontSize={12} fill="#64748b">
            Image
          </text>
        </g>
      )

    case 'line':
      return (
        <line
          key={shape.id}
          x1={x}
          y1={y}
          x2={x + width}
          y2={y + height}
          stroke={strokeColor || '#1a1a1a'}
          strokeWidth={strokeWidth || 2}
          {...baseProps}
        />
      )

    case 'arrow':
      return (
        <g key={shape.id} {...baseProps}>
          <line
            x1={x}
            y1={y}
            x2={x + width}
            y2={y + height}
            stroke={strokeColor || '#1a1a1a'}
            strokeWidth={strokeWidth || 2}
            markerEnd="url(#arrowhead)"
          />
        </g>
      )

    default:
      return null
  }
}

export function CanvasRenderer({
  document: doc,
  selectedIds,
  hoveredId,
  onShapeClick,
  onShapeHover,
  className,
}: CanvasRendererProps): React.ReactElement {
  const bounds = React.useMemo(() => computeDocBounds(doc), [doc])
  const hasContent = Object.keys(doc.shapes).length > 1 // 多于 __root__

  if (!hasContent) {
    return (
      <div
        className={className ?? ''}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#94a3b8',
          fontSize: 14,
        }}
      >
        等待 agent 生成设计
      </div>
    )
  }

  return (
    <svg
      className={className ?? ''}
      viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
      style={{ width: '100%', height: '100%', background: '#f8fafc' }}
      onClick={() => onShapeClick('__background__', {} as React.MouseEvent)}
    >
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#1a1a1a" />
        </marker>
      </defs>
      {doc.rootIds.map((rootId) => {
        const root = doc.shapes[rootId]
        if (!root) return null
        return (
          <ShapeNode
            key={root.id}
            shape={root}
            selected={selectedIds.includes(root.id)}
            hovered={hoveredId === root.id}
            onClick={onShapeClick}
            onHover={onShapeHover}
          />
        )
      })}
    </svg>
  )
}
