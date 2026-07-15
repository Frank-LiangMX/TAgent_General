/**
 * agent-ops-bridge.ts — agent 输出 ShapeOps 的接入层（v3）
 *
 * 替换 v2 的 setDesignHtmlAtom：agent 不再输出 HTML，
 * 改为输出 ShapeOp[] → executeOps → 更新 document → 建快照。
 *
 * 使用方式（在 AgentView 或 useGlobalAgentListeners 中订阅）：
 *   1. agent 输出 shape ops JSON
 *   2. 调 applyShapeOpsAtom({ ops, trigger: "..." })
 *   3. 自动执行、更新文档、建快照、清除选中
 */

import { atom } from 'jotai'

import type { ShapeOp } from './shape-ops'
import { executeOps } from './shape-ops'
import { currentAgentSessionIdAtom } from '@/atoms/agent-atoms'
import { canvasDocumentFamily, setDocumentAtom } from './canvas-shape-store'
import { addCanvasSnapshotAtom } from './canvas-snapshot'
import { clearSelectionAtom } from './canvas-selection-store'

export interface ApplyOpsPayload {
  ops: ShapeOp[]
  trigger?: string
}

/**
 * 执行 shape ops 并更新文档 + 建快照。
 *
 * 用法：
 *   const applyOps = useSetAtom(applyShapeOpsAtom)
 *   applyOps({ ops: [...], trigger: '登录页初稿' })
 */
export const applyShapeOpsAtom = atom(null, (get, set, payload: ApplyOpsPayload) => {
  const sessionId = get(currentAgentSessionIdAtom)
  if (!sessionId || payload.ops.length === 0) return

  // 读当前文档
  const doc = get(canvasDocumentFamily(sessionId))

  // 执行 ops
  const { doc: newDoc, results } = executeOps(doc, payload.ops)

  // 检查执行结果
  const failed = results.find((r) => !r.success)
  if (failed) {
    console.warn('[agent-ops] shape op failed:', failed.error)
  }

  // 更新文档
  set(setDocumentAtom, { key: sessionId, doc: newDoc })

  // 建快照
  set(addCanvasSnapshotAtom, { document: newDoc, trigger: payload.trigger })

  // 清空选中
  set(clearSelectionAtom)
})
