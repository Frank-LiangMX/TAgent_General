/**
 * Agent ????????
 *
 * ?? SDK MCP Server ?? TAgent Automation ??????????????
 * ??????? Agent ?????????? IPC???????????????
 */

import {
  type Automation,
  type AutomationPermissionMode,
  type AutomationScheduleType,
  type CreateAutomationInput,
  type UpdateAutomationInput,
} from '@tagent/shared'
import {
  createAutomation,
  deleteAutomation,
  getAutomation,
  listAutomations,
  updateAutomation,
} from './automation-manager'
import {
  broadcastChanged as broadcastAutomationsChanged,
  runAutomationNow,
} from './automation-scheduler'
import { getAgentSessionMeta } from './agent-session-manager'

interface AutomationAgentToolContext {
  sessionId: string
  channelId: string
  modelId?: string
  workspaceId?: string
  triggeredBy?: 'user' | 'automation' | 'delegation'
}

interface AutomationToolResult extends Record<string, unknown> {
  content: Array<{ type: 'text'; text: string }>
}

type ZodModule = typeof import('zod')

const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
/** ??????? Unix ????????? 1000 ??? */
const SCHEDULED_AT_MS_THRESHOLD = 1_000_000_000_000

function validScheduleType(v: unknown): v is AutomationScheduleType {
  return v === 'interval' || v === 'daily' || v === 'weekly' || v === 'monthly' || v === 'once'
}

function validPermissionMode(v: unknown): v is AutomationPermissionMode {
  return v === 'auto' || v === 'bypassPermissions'
}

function isFiniteInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v)
}

function assertNonBlank(value: string | undefined, field: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`${field} ????`)
  }
  return value.trim()
}

/** Agent ?? date +%s ?????????? scheduledAt ??? */
function normalizeScheduledAtMs(value: number): number {
  if (value > 0 && value < SCHEDULED_AT_MS_THRESHOLD) {
    return value * 1000
  }
  return value
}

function resolveAutomationContext(ctx: AutomationAgentToolContext): {
  channelId: string
  modelId?: string
  workspaceId?: string
} {
  const meta = getAgentSessionMeta(ctx.sessionId)
  const channelId = ctx.channelId?.trim() || meta?.channelId?.trim() || ''
  const workspaceId = ctx.workspaceId?.trim() || meta?.workspaceId?.trim() || undefined
  const modelId = ctx.modelId?.trim() || undefined
  return { channelId, modelId, workspaceId }
}

function validateScheduleFields(
  input: Partial<CreateAutomationInput | UpdateAutomationInput>,
  options?: { requireFutureOnce?: boolean }
): void {
  if (input.scheduleType !== undefined && !validScheduleType(input.scheduleType)) {
    throw new Error(`??? scheduleType: ${String(input.scheduleType)}`)
  }
  if (
    input.intervalMinutes !== undefined &&
    (!isFiniteInt(input.intervalMinutes) || input.intervalMinutes < 1)
  ) {
    throw new Error(`??? intervalMinutes: ${String(input.intervalMinutes)}`)
  }
  if (input.timeOfDay !== undefined && !TIME_OF_DAY_PATTERN.test(input.timeOfDay)) {
    throw new Error(`??? timeOfDay: ${String(input.timeOfDay)}`)
  }
  if (
    input.dayOfWeek !== undefined &&
    (!isFiniteInt(input.dayOfWeek) || input.dayOfWeek < 0 || input.dayOfWeek > 6)
  ) {
    throw new Error(`??? dayOfWeek: ${String(input.dayOfWeek)}`)
  }
  if (
    input.dayOfMonth !== undefined &&
    (!isFiniteInt(input.dayOfMonth) || input.dayOfMonth < 1 || input.dayOfMonth > 31)
  ) {
    throw new Error(`??? dayOfMonth: ${String(input.dayOfMonth)}`)
  }
  if (input.scheduledAt !== undefined) {
    if (
      typeof input.scheduledAt !== 'number' ||
      !Number.isFinite(input.scheduledAt) ||
      input.scheduledAt <= 0
    ) {
      throw new Error(`??? scheduledAt: ${String(input.scheduledAt)}?????????`)
    }
    const normalized = normalizeScheduledAtMs(input.scheduledAt)
    if (normalized !== input.scheduledAt) {
      input.scheduledAt = normalized
    }
    if (options?.requireFutureOnce && input.scheduledAt <= Date.now()) {
      throw new Error(
        `scheduledAt ??????????? ${input.scheduledAt}?? ${new Date(input.scheduledAt).toLocaleString('zh-CN')}?????????? daily + timeOfDay???? date +%s ?????`
      )
    }
  }
  if (input.maxRuns !== undefined && (!isFiniteInt(input.maxRuns) || input.maxRuns < 1)) {
    throw new Error(`??? maxRuns: ${String(input.maxRuns)}??? ?1 ????`)
  }
  if (input.permissionMode !== undefined && !validPermissionMode(input.permissionMode)) {
    throw new Error(`??? permissionMode: ${String(input.permissionMode)}`)
  }
  if (
    input.sessionMode !== undefined &&
    input.sessionMode !== 'daily' &&
    input.sessionMode !== 'reuse'
  ) {
    throw new Error(`??? sessionMode: ${String(input.sessionMode)}`)
  }
}

function summarizeAutomation(a: Automation, includeHistory: boolean): Record<string, unknown> {
  return {
    id: a.id,
    name: a.name,
    active: a.enabled,
    scheduleType: a.scheduleType,
    intervalMinutes: a.intervalMinutes,
    timeOfDay: a.timeOfDay,
    dayOfWeek: a.dayOfWeek,
    dayOfMonth: a.dayOfMonth,
    scheduledAt: a.scheduledAt,
    scheduledAtIso: a.scheduledAt ? new Date(a.scheduledAt).toISOString() : undefined,
    maxRuns: a.maxRuns,
    runCount: a.runCount ?? 0,
    completedAt: a.completedAt,
    permissionMode: a.permissionMode,
    sessionMode: a.sessionMode,
    workspaceId: a.workspaceId,
    channelId: a.channelId,
    sourceSessionId: a.sourceSessionId,
    lastSessionId: a.lastSessionId,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    nextRunAt: a.nextRunAt,
    nextRunAtIso: a.nextRunAt ? new Date(a.nextRunAt).toISOString() : undefined,
    lastRunAt: a.lastRunAt,
    consecutiveFailures: a.consecutiveFailures ?? 0,
    prompt: a.prompt,
    ...(includeHistory && { runHistory: a.runHistory }),
  }
}

function jsonResult(payload: unknown): AutomationToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2),
      },
    ],
  }
}

function getCurrentAutomationId(ctx: AutomationAgentToolContext): string | undefined {
  return getAgentSessionMeta(ctx.sessionId)?.sourceAutomationId
}

function buildAutomationSchemas(z: ZodModule['z']) {
  const scheduleType = z.enum(['interval', 'daily', 'weekly', 'monthly', 'once'])
  const permissionMode = z.enum(['auto', 'bypassPermissions'])
  const sessionMode = z.enum(['daily', 'reuse'])
  return {
    list: {
      active: z.boolean().optional().describe('??????????????????'),
      includeHistory: z.boolean().optional().describe('??????????? false'),
    },
    get: {
      id: z.string().optional().describe('???? ID????????????????????'),
    },
    create: {
      name: z.string().describe('?????????????????'),
      prompt: z.string().describe('???????? Agent ?????????'),
      scheduleType: scheduleType.describe(
        '?????interval ?????daily ?????weekly ?????monthly ?????once ?????????'
      ),
      intervalMinutes: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe('????????scheduleType=interval ??????????? 10-30 ???? 1440=???10080=??'),
      timeOfDay: z.string().optional().describe('??/??/???????24 ??? HH:MM'),
      dayOfWeek: z.number().int().min(0).max(6).optional().describe('??????0=???1=???...?6=??'),
      dayOfMonth: z
        .number()
        .int()
        .min(1)
        .max(31)
        .optional()
        .describe('??????1-31?scheduleType=monthly ???'),
      scheduledAt: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          '????????????????????? date +%s ?????scheduleType=once ????????????? daily + timeOfDay'
        ),
      maxRuns: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe('????????????????????+??????????????????=???'),
      active: z.boolean().optional().describe('?????????? true'),
      permissionMode: permissionMode
        .optional()
        .describe('??????????? bypassPermissions???????? auto'),
      sessionMode: sessionMode
        .optional()
        .describe('?????daily=???????????????????????????reuse=??????????'),
    },
    update: {
      id: z.string().optional().describe('???? ID????????????????????'),
      name: z.string().optional().describe('?????'),
      prompt: z.string().optional().describe('???????'),
      scheduleType: scheduleType.optional().describe('??????'),
      intervalMinutes: z.number().int().min(1).optional().describe('?????????'),
      timeOfDay: z.string().optional().describe('????/??/???????24 ??? HH:MM'),
      dayOfWeek: z.number().int().min(0).max(6).optional().describe('????????0=???...?6=??'),
      dayOfMonth: z.number().int().min(1).max(31).optional().describe('????????1-31'),
      scheduledAt: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('?????????????????scheduleType=once ???'),
      maxRuns: z.number().int().min(1).optional().describe('?????????????????????????????????'),
      active: z.boolean().optional().describe('???????'),
      permissionMode: permissionMode.optional().describe('??????????'),
      sessionMode: sessionMode.optional().describe('???????daily=??????????????reuse=??????????'),
    },
    delete: {
      id: z.string().describe('???????? ID'),
    },
    runNow: {
      id: z.string().optional().describe('?????????? ID????????????????????'),
    },
  }
}

export async function injectAutomationMcpServer(
  sdk: typeof import('@anthropic-ai/claude-agent-sdk'),
  mcpServers: Record<string, Record<string, unknown>>,
  ctx: AutomationAgentToolContext
): Promise<void> {
  const { z } = await import('zod')
  const schemas = buildAutomationSchemas(z)

  const server = sdk.createSdkMcpServer({
    name: 'automation',
    version: '1.0.0',
    tools: [
      sdk.tool(
        'list_automations',
        '?? TAgent ??????????????????????????????????????????????',
        schemas.list,
        async (args) => {
          const items = listAutomations()
            .filter((a) => args.active === undefined || a.enabled === args.active)
            .map((a) => summarizeAutomation(a, args.includeHistory === true))
          return jsonResult({ automations: items })
        },
        { annotations: { readOnlyHint: true } }
      ),
      sdk.tool(
        'get_automation',
        '???? TAgent ????????????????????????? id ?????????????????',
        schemas.get,
        async (args) => {
          const id = args.id?.trim() || getCurrentAutomationId(ctx)
          if (!id) throw new Error('id ??????????????????? id')
          const automation = getAutomation(id)
          if (!automation) throw new Error(`???????: ${id}`)
          return jsonResult({ automation: summarizeAutomation(automation, true) })
        },
        { annotations: { readOnlyHint: true } }
      ),
      sdk.tool(
        'create_automation',
        '?? TAgent ??????????????????????????????????interval/daily/weekly/monthly????????????????????once + scheduledAt?????????????maxRuns?????/???????????????????????????????',
        schemas.create,
        async (args) => {
          if (ctx.triggeredBy === 'automation' || getCurrentAutomationId(ctx)) {
            throw new Error('???????????????????????????? update_automation ??????')
          }
          const { channelId, modelId, workspaceId } = resolveAutomationContext(ctx)
          if (!channelId) {
            throw new Error('??????????????????????????? API ??')
          }
          if (!workspaceId) {
            throw new Error('????????????????????????????')
          }
          const input: CreateAutomationInput = {
            name: assertNonBlank(args.name, 'name'),
            prompt: assertNonBlank(args.prompt, 'prompt'),
            scheduleType: args.scheduleType,
            intervalMinutes: args.intervalMinutes ?? 10,
            timeOfDay: args.timeOfDay,
            dayOfWeek: args.dayOfWeek,
            dayOfMonth: args.dayOfMonth,
            scheduledAt: args.scheduledAt,
            maxRuns: args.maxRuns,
            channelId,
            modelId,
            workspaceId,
            permissionMode: args.permissionMode,
            sessionMode: args.sessionMode,
            sourceSessionId: ctx.sessionId,
            active: args.active ?? true,
          }
          validateScheduleFields(input, {
            requireFutureOnce: input.scheduleType === 'once',
          })
          if (input.scheduleType === 'interval' && args.intervalMinutes === undefined) {
            throw new Error('scheduleType=interval ? intervalMinutes ??')
          }
          if (
            (input.scheduleType === 'daily' ||
              input.scheduleType === 'weekly' ||
              input.scheduleType === 'monthly') &&
            !input.timeOfDay
          ) {
            throw new Error('scheduleType=daily/weekly/monthly ? timeOfDay ??')
          }
          if (input.scheduleType === 'weekly' && input.dayOfWeek === undefined) {
            throw new Error('scheduleType=weekly ? dayOfWeek ??')
          }
          if (input.scheduleType === 'monthly' && input.dayOfMonth === undefined) {
            throw new Error('scheduleType=monthly ? dayOfMonth ??')
          }
          if (input.scheduleType === 'once' && input.scheduledAt === undefined) {
            throw new Error('scheduleType=once ? scheduledAt???????????')
          }
          const automation = createAutomation(input)
          broadcastAutomationsChanged()
          return jsonResult({ automation: summarizeAutomation(automation, true) })
        }
      ),
      sdk.tool(
        'update_automation',
        '?? TAgent ?????????????????????????????????????????? id ????????',
        schemas.update,
        async (args) => {
          const id = args.id?.trim() || getCurrentAutomationId(ctx)
          if (!id) throw new Error('id ??????????????????? id')
          const input: UpdateAutomationInput = {
            id,
            name: args.name?.trim(),
            prompt: args.prompt?.trim(),
            scheduleType: args.scheduleType,
            intervalMinutes: args.intervalMinutes,
            timeOfDay: args.timeOfDay,
            dayOfWeek: args.dayOfWeek,
            dayOfMonth: args.dayOfMonth,
            scheduledAt: args.scheduledAt,
            maxRuns: args.maxRuns,
            enabled: args.active,
            permissionMode: args.permissionMode,
            sessionMode: args.sessionMode,
          }
          if (input.name !== undefined) assertNonBlank(input.name, 'name')
          if (input.prompt !== undefined) assertNonBlank(input.prompt, 'prompt')
          validateScheduleFields(input, {
            requireFutureOnce: input.scheduleType === 'once' && input.scheduledAt !== undefined,
          })
          if (input.scheduleType === 'once' && input.scheduledAt === undefined) {
            const existing = getAutomation(id)
            if (!existing?.scheduledAt) {
              throw new Error('scheduleType ?? once ????? scheduledAt?????????')
            }
          }
          const automation = updateAutomation(input)
          if (!automation) throw new Error(`???????: ${id}`)
          broadcastAutomationsChanged()
          return jsonResult({ automation: summarizeAutomation(automation, true) })
        }
      ),
      sdk.tool(
        'delete_automation',
        '?? TAgent ???????????????????????????????????',
        schemas.delete,
        async (args) => {
          const id = assertNonBlank(args.id, 'id')
          const existed = getAutomation(id) !== undefined
          deleteAutomation(id)
          if (existed) broadcastAutomationsChanged()
          return jsonResult({ deleted: existed })
        }
      ),
      sdk.tool(
        'run_automation_now',
        '???? TAgent ?????????????????????????????????????????????????',
        schemas.runNow,
        async (args) => {
          const id = args.id?.trim() || getCurrentAutomationId(ctx)
          if (!id) throw new Error('id ??????????????????? id')
          if (ctx.triggeredBy === 'automation' && id === getCurrentAutomationId(ctx)) {
            throw new Error('???????????????????')
          }
          await runAutomationNow(id)
          return jsonResult({ started: true, id })
        }
      ),
    ],
  })

  mcpServers.automation = server as unknown as Record<string, unknown>
  console.log('[Agent ??] ??????????? (automation)')
}
