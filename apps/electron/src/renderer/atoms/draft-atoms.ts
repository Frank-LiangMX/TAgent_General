/**
 * Draft Atoms — 需求草稿 Jotai 状态管理
 */

import { atom } from 'jotai'

import type { DraftDocument, RequirementBlock, DraftStatus, AgentSendInput } from '@tagent/shared'

import {
  agentChannelIdAtom,
  currentAgentSessionIdAtom,
  agentSessionsAtom,
  currentAgentWorkspaceIdAtom,
} from './agent-atoms'
import { selectedModelAtom } from './model-atoms'
import { buildAgentPrompt } from '@/lib/draft-prompt-builder'

/** 草稿列表（从 IPC 加载） */
export const draftsAtom = atom<DraftDocument[]>([])
/** 草稿列表是否已加载 */
export const draftsLoadedAtom = atom(false)
/** 当前激活草稿 ID */
export const currentDraftIdAtom = atom<string | null>(null)

/** 草稿搜索 Dialog 开关 */
export const draftSearchOpenAtom = atom(false)

/** 当前草稿（派生） */
export const currentDraftAtom = atom<DraftDocument | null>((get) => {
  const id = get(currentDraftIdAtom)
  if (!id) return null
  return get(draftsAtom).find((d) => d.id === id) ?? null
})

/** 当前草稿需求块读写（派生） */
export const currentDraftRequirementsAtom = atom(
  (get) => get(currentDraftAtom)?.requirements ?? [],
  (get, set, update: RequirementBlock[] | ((prev: RequirementBlock[]) => RequirementBlock[])) => {
    const id = get(currentDraftIdAtom)
    if (!id) return
    set(draftsAtom, (prev) => {
      const next = prev.map((d) =>
        d.id === id
          ? {
              ...d,
              requirements: typeof update === 'function' ? update(d.requirements) : update,
              updatedAt: Date.now(),
            }
          : d
      )
      void persistDraft(id, next.find((d) => d.id === id)!)
      return next
    })
  }
)

/** 当前草稿背景上下文读写（派生） */
export const currentDraftContextAtom = atom(
  (get) => get(currentDraftAtom)?.context ?? '',
  (get, set, newContext: string) => {
    const id = get(currentDraftIdAtom)
    if (!id) return
    set(draftsAtom, (prev) => {
      const next = prev.map((d) =>
        d.id === id ? { ...d, context: newContext, updatedAt: Date.now() } : d
      )
      void persistDraft(id, next.find((d) => d.id === id)!)
      return next
    })
  }
)

/** 当前草稿标题读写 */
export const currentDraftTitleAtom = atom(
  (get) => get(currentDraftAtom)?.title ?? '',
  (get, set, newTitle: string) => {
    const id = get(currentDraftIdAtom)
    if (!id) return
    set(draftsAtom, (prev) => {
      const next = prev.map((d) =>
        d.id === id ? { ...d, title: newTitle, updatedAt: Date.now() } : d
      )
      void persistDraft(id, next.find((d) => d.id === id)!)
      return next
    })
  }
)

/** 创建草稿 */
export const createDraftAtom = atom(
  null,
  async (get, set, opts?: Parameters<typeof window.electronAPI.draft.create>[0]) => {
    const doc = await window.electronAPI.draft.create(opts)
    set(draftsAtom, (prev) => [doc, ...prev])
    set(currentDraftIdAtom, doc.id)
    return doc
  }
)

/** 删除草稿 */
export const deleteDraftAtom = atom(null, async (get, set, id: string) => {
  await window.electronAPI.draft.delete(id)
  set(draftsAtom, (prev) => prev.filter((d) => d.id !== id))
  if (get(currentDraftIdAtom) === id) {
    set(currentDraftIdAtom, null)
  }
})

/** 加载草稿列表 */
export const loadDraftsAtom = atom(null, async (get, set) => {
  const docs = await window.electronAPI.draft.list()
  set(draftsAtom, docs)
  set(draftsLoadedAtom, true)
})

/** 推进草稿状态 */
export const setDraftStatusAtom = atom(
  null,
  async (get, set, { id, status }: { id: string; status: DraftStatus }) => {
    const updated = await window.electronAPI.draft.update(id, { status })
    if (updated) {
      set(draftsAtom, (prev) => prev.map((d) => (d.id === id ? updated : d)))
    }
  }
)

/** 升级草稿到 ready */
export const upgradeToReadyAtom = atom(null, async (get, set) => {
  const draft = get(currentDraftAtom)
  if (!draft || draft.status !== 'draft') return
  await set(setDraftStatusAtom, { id: draft.id, status: 'ready' })
})

/** 升级草稿到 Agent 执行 */
export const upgradeToAgentAtom = atom(null, async (get, set) => {
  const draft = get(currentDraftAtom)
  if (!draft || draft.status !== 'ready') return

  const channelId = get(agentChannelIdAtom) ?? undefined
  const modelId = get(selectedModelAtom)?.modelId ?? undefined
  const workspaceId = draft.workspaceId ?? get(currentAgentWorkspaceIdAtom) ?? undefined

  // 1. 创建 Agent 会话
  const meta = await window.electronAPI.createAgentSession(
    draft.title,
    channelId,
    workspaceId,
    draft.mode
  )
  if (!meta) return

  // 2. 发送草稿上下文作为初始消息
  const prompt = buildAgentPrompt(draft)
  const input: AgentSendInput = {
    sessionId: meta.id,
    userMessage: prompt,
    channelId: meta.channelId ?? channelId ?? '',
    modelId,
    workspaceId,
  }
  await window.electronAPI.sendAgentMessage(input)

  // 3. 更新草稿状态
  const updated = await window.electronAPI.draft.update(draft.id, {
    status: 'executing',
    agentSessionId: meta.id,
  })
  if (updated) {
    set(draftsAtom, (prev) => prev.map((d) => (d.id === draft.id ? updated : d)))
  }

  // 4. 切换到 Agent 会话标签页
  set(currentAgentSessionIdAtom, meta.id)
  set(agentSessionsAtom, (prev) => {
    if (prev.some((s) => s.id === meta.id)) return prev
    return [meta, ...prev]
  })

  return meta
})

/** 迁移旧版 scratch-pad.md */
export const migrateLegacyAtom = atom(null, async (get, set) => {
  const draft = await window.electronAPI.draft.migrateLegacy()
  if (draft) {
    set(draftsAtom, (prev) => [draft, ...prev])
  }
  return draft
})

/** 持久化单个草稿到 IPC */
async function persistDraft(id: string, doc: DraftDocument): Promise<void> {
  await window.electronAPI.draft.update(id, doc)
}
