/**
 * canvas-types.ts — 节点树画布数据模型（v3）
 *
 * 设计来源：F:/Kun 的 canvas-types.ts（概念参考，独立实现）
 *
 * 与 v2 的关系：
 *  - 取代 v2 的 HTML/iframe 渲染路线
 *  - 保留 v2 的 UI 组件（LayerTreePanel, VersionTimeline 等）
 *  - 数据层从「DOM 逆向」变成「节点树第一类对象」
 */

/** 形状类型 */
export type ShapeType =
  | 'frame' // 容器/页面
  | 'rect' // 矩形
  | 'ellipse' // 椭圆
  | 'text' // 文本
  | 'image' // 图片
  | 'group' // 编组
  | 'line' // 线条
  | 'arrow' // 箭头

/** 填充类型 */
export type Fill = { type: 'solid'; color: string; opacity: number }
export type GradientStop = { offset: number; color: string; opacity?: number }
export type GradientFill = {
  type: 'linear' | 'radial'
  stops: GradientStop[]
  angle?: number
  opacity: number
}

/** 描边 */
export interface Stroke {
  color: string
  width: number
  opacity: number
  style: 'solid' | 'dashed' | 'dotted'
}

/** 阴影 */
export interface Shadow {
  offsetX: number
  offsetY: number
  blur: number
  color: string
  opacity: number
}

/** 坐标、尺寸、旋转 */
export interface BoxBounds {
  x: number
  y: number
  width: number
  height: number
}

/** 单个形状节点 */
export interface CanvasShape {
  /** 唯一 id，形如 "s-xxx" */
  id: string
  type: ShapeType
  name: string
  parentId: string | null
  children: string[] // 子节点 id 列表（有序）
  bounds: BoxBounds
  rotation: number // 度
  opacity: number
  visible: boolean
  locked: boolean
  fills: Fill[]
  strokes: Stroke[]
  cornerRadius: number
  /** 文本形状专属 */
  text?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: number
  textColor?: string
  textAlign?: 'left' | 'center' | 'right'
  /** 图片形状专属 */
  imageSrc?: string
  /** 自定义数据（agent 可以写额外元数据） */
  attrs?: Record<string, unknown>
}

/** 根 id */
export const ROOT_SHAPE_ID = '__root__'

/** 完整画本文档 */
export interface CanvasDocument {
  shapes: Record<string, CanvasShape>
  rootIds: string[] // 顶层节点 id 列表（通常只有一个 "__root__"）
}

/** 创建空文档 */
export function createEmptyDocument(): CanvasDocument {
  return {
    shapes: {
      [ROOT_SHAPE_ID]: {
        id: ROOT_SHAPE_ID,
        type: 'frame',
        name: 'Root',
        parentId: null,
        children: [],
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: true,
        fills: [],
        strokes: [],
        cornerRadius: 0,
      },
    },
    rootIds: [ROOT_SHAPE_ID],
  }
}

/** 生成唯一 id */
let _idCounter = 0
export function createShapeId(): string {
  _idCounter += 1
  return 's-' + Date.now().toString(36) + '-' + _idCounter
}

/** 获取形状的所有后代 id（包含自身） */
export function getDescendantIds(shape: CanvasShape, doc: CanvasDocument): string[] {
  const result: string[] = [shape.id]
  for (const cid of shape.children) {
    const child = doc.shapes[cid]
    if (child) result.push(...getDescendantIds(child, doc))
  }
  return result
}

/** 判断形状是否包含目标点（hit test） */
export function shapeContainsPoint(shape: CanvasShape, px: number, py: number): boolean {
  const b = shape.bounds
  return px >= b.x && px <= b.x + b.width && py >= b.y && py <= b.y + b.height
}

/** 从文档中删除形状及其所有后代 */
export function removeShapeTree(id: string, doc: CanvasDocument): CanvasDocument {
  const shape = doc.shapes[id]
  if (!shape) return doc
  const idsToRemove = getDescendantIds(shape, doc)
  const newShapes = { ...doc.shapes }
  for (const rid of idsToRemove) {
    delete newShapes[rid]
  }
  // 从父节点的 children 中移除
  if (shape.parentId && newShapes[shape.parentId]) {
    const parent = newShapes[shape.parentId]!
    newShapes[shape.parentId] = {
      ...parent,
      children: parent.children.filter((c) => c !== id),
    }
  }
  const newRootIds = doc.rootIds.filter((r) => r !== id)
  return { shapes: newShapes, rootIds: newRootIds }
}
