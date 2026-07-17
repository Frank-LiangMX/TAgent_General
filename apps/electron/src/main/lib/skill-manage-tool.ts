/**
 * skill_manage MCP 工具 — Agent 静默创建/编辑/归档 skill
 *
 * 形态对齐 kanban / automation：createSdkMcpServer 注入。
 * 实现落盘见 skill-manage-core.ts。
 */

import type { SkillScope } from '@tagent/shared'

import {
  archiveSkill,
  createSkill,
  deleteSkill,
  listSkillSlugs,
  patchSkill,
  restoreArchivedSkill,
  skillExistsAnywhere,
} from './skill-manage-core'
import { recordSkillUsage } from './skill-usage-tracker'

export interface SkillManageToolContext {
  sessionId: string
  workspaceSlug?: string
  /** 子会话防递归：kanban worker 等不注入 */
  triggeredBy?: string
}

interface ToolResult extends Record<string, unknown> {
  content: Array<{ type: 'text'; text: string }>
}

function textResult(payload: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  }
}

function errorResult(message: string): ToolResult {
  return textResult({ ok: false, error: message })
}

/**
 * 注入 tagent-skill-manage MCP Server（工具名 skill_manage）
 */
export async function injectSkillManageMcpServer(
  sdk: typeof import('@anthropic-ai/claude-agent-sdk'),
  mcpServers: Record<string, Record<string, unknown>>,
  ctx: SkillManageToolContext
): Promise<void> {
  const { z } = await import('zod')

  const actionSchema = z.enum([
    'create',
    'patch',
    'delete',
    'archive',
    'restore',
    'list',
    'exists',
  ])

  const inputSchema = {
    action: actionSchema.describe(
      '操作类型：create / patch / delete / archive / restore / list / exists'
    ),
    slug: z
      .string()
      .optional()
      .describe('skill slug（小写+连字符，如 weekly-speed-test）；list 可省略'),
    name: z.string().optional().describe('展示名称（create 推荐）'),
    description: z
      .string()
      .optional()
      .describe(
        '触发描述（create 必填）。写清 when to use；建议 ≤1024 字符，硬上限 2000'
      ),
    body: z.string().optional().describe('SKILL.md 正文（Markdown，不含 frontmatter）'),
    scope: z
      .enum(['global', 'workspace'])
      .optional()
      .describe('默认 global；workspace 需当前会话有工作区'),
    status: z
      .enum(['draft', 'active', 'stale', 'archived'])
      .optional()
      .describe('生命周期状态（create 默认 draft）'),
    pinned: z.boolean().optional().describe('钉住后 Curator 不自动变更状态'),
    version: z.string().optional().describe('semver，默认 0.1.0'),
    recordUsage: z
      .boolean()
      .optional()
      .describe('为 true 时对 slug 记一次 usage（用于验证埋点）'),
  }

  const server = sdk.createSdkMcpServer({
    name: 'tagent-skill-manage',
    version: '1.0.0',
    tools: [
      sdk.tool(
        'skill_manage',
        [
          '管理 TAgent Skills：静默创建/修补/归档/恢复/列出。',
          '用于把重复工作流固化为可复用 skill，或维护已有 skill 元数据。',
          '创建默认写入全局 skills（跨工作区复用），status=draft，provenance=background。',
          '禁止用于恶意、越权或写出 skill 目录以外的文件。',
        ].join(' '),
        inputSchema,
        async (args): Promise<ToolResult> => {
          try {
            const action = args.action as string
            const scope = (args.scope as SkillScope | undefined) ?? 'global'
            const workspaceSlug =
              scope === 'workspace' ? ctx.workspaceSlug?.trim() || undefined : undefined

            if (scope === 'workspace' && !workspaceSlug) {
              return errorResult('workspace scope 需要当前会话绑定工作区')
            }

            if (action === 'list') {
              const slugs = listSkillSlugs(scope, workspaceSlug)
              return textResult({ ok: true, scope, slugs, count: slugs.length })
            }

            const slug = typeof args.slug === 'string' ? args.slug.trim() : ''
            if (!slug && action !== 'list') {
              return errorResult('slug 必填')
            }

            if (args.recordUsage === true && slug) {
              recordSkillUsage(slug, scope, workspaceSlug)
            }

            switch (action) {
              case 'exists': {
                const exists = skillExistsAnywhere(slug, workspaceSlug)
                return textResult({ ok: true, slug, exists })
              }
              case 'create': {
                if (!args.description || String(args.description).trim().length === 0) {
                  return errorResult('create 需要 description')
                }
                const result = createSkill({
                  slug,
                  name: typeof args.name === 'string' ? args.name : slug,
                  description: String(args.description),
                  body: typeof args.body === 'string' ? args.body : undefined,
                  scope,
                  workspaceSlug,
                  provenance: 'background',
                  createdBy: 'agent',
                  status: (args.status as 'draft' | 'active' | undefined) ?? 'draft',
                  pinned: args.pinned === true,
                  version: typeof args.version === 'string' ? args.version : undefined,
                })
                return textResult(result)
              }
              case 'patch': {
                const result = patchSkill({
                  slug,
                  scope,
                  workspaceSlug,
                  name: typeof args.name === 'string' ? args.name : undefined,
                  description:
                    typeof args.description === 'string' ? args.description : undefined,
                  body: typeof args.body === 'string' ? args.body : undefined,
                  status: args.status as
                    | 'draft'
                    | 'active'
                    | 'stale'
                    | 'archived'
                    | undefined,
                  pinned: typeof args.pinned === 'boolean' ? args.pinned : undefined,
                  version: typeof args.version === 'string' ? args.version : undefined,
                })
                return textResult(result)
              }
              case 'delete': {
                return textResult(deleteSkill(slug, scope, workspaceSlug))
              }
              case 'archive': {
                return textResult(archiveSkill(slug, scope, workspaceSlug))
              }
              case 'restore': {
                return textResult(restoreArchivedSkill(slug, scope, workspaceSlug))
              }
              default:
                return errorResult(`未知 action: ${action}`)
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            console.error('[skill_manage] 失败:', message)
            return errorResult(message)
          }
        }
      ),
    ],
  })

  mcpServers['tagent-skill-manage'] = server as unknown as Record<string, unknown>
  console.log(
    `[Agent 编排] 已注入 skill_manage 工具（session=${ctx.sessionId}, ws=${ctx.workspaceSlug ?? '-'}）`
  )
}
