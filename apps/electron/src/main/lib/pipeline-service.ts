/**
 * PipelineService - 流水线服务
 *
 * 负责管理 TA 模式的流水线执行记录。
 * - 存储位置: ~/.tagent/ta/pipeline_runs.jsonl
 * - 格式: JSONL（每行一个 JSON 记录）
 *
 * 设计原则：
 * - 追加写入，不频繁重写整个文件
 * - 按需加载，支持分页查询
 * - 统计缓存，避免全量扫描
 */

import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { app } from 'electron'

import type {
  PipelineRun,
  PipelineRunStatus,
  CreatePipelineRunRequest,
  UpdatePipelineRunRequest,
  PipelineSummary,
  PipelineListQuery,
} from '@tagent/shared'

/**
 * 获取流水线数据文件路径
 *
 * 根据设计文档 §3.3：
 * - 生产环境: ~/.tagent/ta/pipeline_runs.jsonl
 * - 开发环境: ~/.tagent-dev/ta/pipeline_runs.jsonl
 */
function getPipelineRunsPath(): string {
  const isDev = !app.isPackaged
  const baseDir = isDev
    ? path.join(app.getPath('home'), '.tagent-dev')
    : path.join(app.getPath('home'), '.tagent')
  return path.join(baseDir, 'ta', 'pipeline_runs.jsonl')
}

/**
 * 确保数据目录存在
 */
function ensureDataDir(): void {
  const filePath = getPipelineRunsPath()
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/**
 * 读取所有流水线记录
 *
 * 如果文件不存在，返回空数组。
 */
function readAllRuns(): PipelineRun[] {
  const filePath = getPipelineRunsPath()
  if (!fs.existsSync(filePath)) {
    return []
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.trim().split('\n').filter(Boolean)

  return lines
    .map((line) => {
      try {
        return JSON.parse(line) as PipelineRun
      } catch {
        console.warn('[PipelineService] 解析行失败:', line.slice(0, 100))
        return null
      }
    })
    .filter((run): run is PipelineRun => run !== null)
}

/**
 * 写入所有流水线记录（全量覆盖）
 *
 * 用于清理等场景。
 */
function writeAllRuns(runs: PipelineRun[]): void {
  ensureDataDir()
  const filePath = getPipelineRunsPath()
  const content = runs.map((run) => JSON.stringify(run)).join('\n')
  fs.writeFileSync(filePath, content + '\n', 'utf-8')
}

/**
 * 追加一条流水线记录
 */
function appendRun(run: PipelineRun): void {
  ensureDataDir()
  const filePath = getPipelineRunsPath()
  const line = JSON.stringify(run) + '\n'
  fs.appendFileSync(filePath, line, 'utf-8')
}

/**
 * 创建流水线
 */
export function createPipelineRun(request: CreatePipelineRunRequest): PipelineRun {
  const now = Date.now()
  const run: PipelineRun = {
    id: `pipeline-${randomUUID().slice(0, 8)}`,
    name: request.name,
    status: 'pending',
    createdAt: now,
    startTime: null,
    endTime: null,
    itemsProcessed: 0,
    itemsTotal: request.itemsTotal ?? null,
    error: null,
    type: request.type,
    triggeredBy: request.triggeredBy ?? 'user',
    sessionId: request.sessionId,
    metadata: request.metadata,
  }

  appendRun(run)
  return run
}

/**
 * 获取流水线列表
 *
 * 支持按状态、类型筛选，以及分页。
 */
export function listPipelineRuns(query: PipelineListQuery = {}): PipelineRun[] {
  let runs = readAllRuns()

  // 按状态筛选
  if (query.status && query.status.length > 0) {
    const statusSet = new Set(query.status)
    runs = runs.filter((run) => statusSet.has(run.status))
  }

  // 按类型筛选
  if (query.type && query.type.length > 0) {
    const typeSet = new Set(query.type)
    runs = runs.filter((run) => typeSet.has(run.type))
  }

  // 按创建时间倒序（最新的在前）
  runs.sort((a, b) => b.createdAt - a.createdAt)

  // 分页
  const offset = query.offset ?? 0
  const limit = query.limit ?? 50
  return runs.slice(offset, offset + limit)
}

/**
 * 获取单个流水线
 */
export function getPipelineRun(id: string): PipelineRun | null {
  const runs = readAllRuns()
  return runs.find((run) => run.id === id) ?? null
}

/**
 * 更新流水线状态
 *
 * 返回更新后的流水线，如果不存在则返回 null。
 */
export function updatePipelineRun(
  id: string,
  request: UpdatePipelineRunRequest
): PipelineRun | null {
  const runs = readAllRuns()
  const index = runs.findIndex((run) => run.id === id)

  if (index === -1) {
    return null
  }

  const run = runs[index]!

  // 更新字段
  if (request.status !== undefined) {
    run.status = request.status

    // 状态变更时自动设置时间戳
    if (request.status === 'running' && run.startTime === null) {
      run.startTime = Date.now()
    } else if (['completed', 'failed', 'cancelled'].includes(request.status)) {
      run.endTime = Date.now()
    }
  }

  if (request.itemsProcessed !== undefined) {
    run.itemsProcessed = request.itemsProcessed
  }

  if (request.itemsTotal !== undefined) {
    run.itemsTotal = request.itemsTotal
  }

  if (request.error !== undefined) {
    run.error = request.error
  }

  if (request.metadata !== undefined) {
    run.metadata = { ...run.metadata, ...request.metadata }
  }

  // 全量覆盖写入
  writeAllRuns(runs)

  return run
}

/**
 * 取消流水线
 *
 * 如果流水线正在运行或等待中，将其标记为已取消。
 */
export function cancelPipelineRun(id: string): PipelineRun | null {
  const run = getPipelineRun(id)

  if (!run) {
    return null
  }

  if (!['pending', 'running'].includes(run.status)) {
    // 无法取消已完成的流水线
    return run
  }

  return updatePipelineRun(id, { status: 'cancelled' })
}

/**
 * 获取流水线统计摘要
 */
export function getPipelineSummary(): PipelineSummary {
  const runs = readAllRuns()

  const summary: PipelineSummary = {
    running: 0,
    pending: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    total: runs.length,
  }

  for (const run of runs) {
    summary[run.status]++
  }

  return summary
}

/**
 * 清理已完成的流水线记录
 *
 * 删除指定天数之前的已完成/失败/取消记录。
 * 默认清理 7 天前的记录。
 */
export function cleanupPipelineRuns(daysToKeep: number = 7): number {
  const runs = readAllRuns()
  const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000

  const remainingRuns = runs.filter((run) => {
    // 保留运行中和等待中的
    if (['pending', 'running'].includes(run.status)) {
      return true
    }

    // 保留最近 N 天的
    if (run.endTime !== null && run.endTime > cutoffTime) {
      return true
    }

    return false
  })

  const removedCount = runs.length - remainingRuns.length

  if (removedCount > 0) {
    writeAllRuns(remainingRuns)
  }

  return removedCount
}

/**
 * 启动流水线（将 pending 改为 running）
 */
export function startPipelineRun(id: string): PipelineRun | null {
  const run = getPipelineRun(id)

  if (!run || run.status !== 'pending') {
    return null
  }

  return updatePipelineRun(id, { status: 'running' })
}

/**
 * 完成流水线（将 running 改为 completed）
 */
export function completePipelineRun(id: string, itemsProcessed?: number): PipelineRun | null {
  const run = getPipelineRun(id)

  if (!run || run.status !== 'running') {
    return null
  }

  const update: UpdatePipelineRunRequest = { status: 'completed' }
  if (itemsProcessed !== undefined) {
    update.itemsProcessed = itemsProcessed
  }

  return updatePipelineRun(id, update)
}

/**
 * 标记流水线失败
 */
export function failPipelineRun(id: string, error: string): PipelineRun | null {
  const run = getPipelineRun(id)

  if (!run || !['pending', 'running'].includes(run.status)) {
    return null
  }

  return updatePipelineRun(id, { status: 'failed', error })
}

/**
 * 更新流水线进度
 */
export function updatePipelineProgress(
  id: string,
  itemsProcessed: number,
  itemsTotal?: number
): PipelineRun | null {
  const run = getPipelineRun(id)

  if (!run || run.status !== 'running') {
    return null
  }

  const update: UpdatePipelineRunRequest = { itemsProcessed }
  if (itemsTotal !== undefined) {
    update.itemsTotal = itemsTotal
  }

  return updatePipelineRun(id, update)
}
