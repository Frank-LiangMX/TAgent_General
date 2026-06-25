/**
 * DraftManager — 需求草稿持久化 CRUD
 *
 * 存储布局：
 *   索引：~/.tagent/drafts.json — DraftDocument[]（轻量元数据数组）
 *   内容：~/.tagent/drafts/{id}.json — 完整 DraftDocument
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, rmSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

import type { DraftDocument } from '@tagent/shared'

import { getDraftsIndexPath, getDraftsDir, getDraftPath, getScratchPadPath } from './config-paths'

function readIndex(): DraftDocument[] {
  const indexPath = getDraftsIndexPath()
  if (!existsSync(indexPath)) return []
  try {
    return JSON.parse(readFileSync(indexPath, 'utf-8'))
  } catch {
    return []
  }
}

function writeIndex(drafts: DraftDocument[]): void {
  const indexPath = getDraftsIndexPath()
  mkdirSync(join(indexPath, '..'), { recursive: true })
  writeFileSync(indexPath, JSON.stringify(drafts, null, 2), 'utf-8')
}

function readDraftFile(id: string): DraftDocument | null {
  const path = getDraftPath(id)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

function writeDraftFile(doc: DraftDocument): void {
  const dir = getDraftsDir()
  mkdirSync(dir, { recursive: true })
  writeFileSync(getDraftPath(doc.id), JSON.stringify(doc, null, 2), 'utf-8')
}

function removeDraftFile(id: string): void {
  const path = getDraftPath(id)
  if (existsSync(path)) unlinkSync(path)
}

export function listDrafts(): DraftDocument[] {
  return readIndex()
}

export function getDraft(id: string): DraftDocument | null {
  return readDraftFile(id)
}

export interface CreateDraftOptions {
  title?: string
  workspaceId?: string
  mode?: 'general' | 'ta'
  context?: string
}

export function createDraft(opts: CreateDraftOptions = {}): DraftDocument {
  const now = Date.now()
  const doc: DraftDocument = {
    id: randomUUID(),
    title: opts.title || '未命名草稿',
    workspaceId: opts.workspaceId,
    mode: opts.mode,
    context: opts.context || '',
    requirements: [],
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  }

  writeDraftFile(doc)

  const index = readIndex()
  index.unshift(doc)
  writeIndex(index)

  return doc
}

export function updateDraft(id: string, partial: Partial<DraftDocument>): DraftDocument | null {
  const existing = readDraftFile(id)
  if (!existing) return null

  const updated: DraftDocument = {
    ...existing,
    ...partial,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
  }

  writeDraftFile(updated)

  const index = readIndex()
  const i = index.findIndex((d) => d.id === id)
  if (i !== -1) {
    index[i] = { ...updated, requirements: [], context: '' }
    writeIndex(index)
  }

  return updated
}

export function deleteDraft(id: string): boolean {
  removeDraftFile(id)

  const index = readIndex()
  const newIdx = index.filter((d) => d.id !== id)
  if (newIdx.length === index.length) return false
  writeIndex(newIdx)
  return true
}

export function migrateLegacy(): DraftDocument | null {
  const scratchPath = getScratchPadPath()
  if (!existsSync(scratchPath)) return null

  try {
    const md = readFileSync(scratchPath, 'utf-8')
    const doc = createDraft({
      title: '从草稿本迁移',
      context: md,
    })
    return doc
  } catch {
    return null
  }
}
