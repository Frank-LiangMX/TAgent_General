/**
 * WPS CLI MCP Server
 *
 * 基于 WPS365 CLI 的内置 MCP 服务器。
 * 通过 sdk.createSdkMcpServer() 创建，注入到每个 Agent 会话。
 * 复用 WPS Bridge 的 App ID 和 Secret Key。
 */

import type { ToolDefinition } from '@tagent/core'
import * as wpsCliTools from '../wps-cli-tools'

// ===== MCP Server 注入 =====

export async function injectWpsCliMcpServer(
  sdk: typeof import('@anthropic-ai/claude-agent-sdk'),
  mcpServers: Record<string, Record<string, unknown>>,
  sessionId: string
): Promise<void> {
  // 检查是否可用（App ID 已配置）
  if (!wpsCliTools.isWpsCliAvailable?.()) {
    console.log('[WPS CLI MCP] WPS 未配置 App ID，跳过注入')
    return
  }

  const { z } = await import('zod')

  const server = sdk.createSdkMcpServer({
    name: 'tagent-wps',
    version: '1.0.0',
    tools: [
      sdk.tool(
        'wps_send_message',
        'Send a message to a WPS user or chat.',
        {
          to: z.array(z.string()).describe('List of recipient user IDs or chat IDs'),
          text: z.string().describe('Message content'),
        },
        async (args: { to: string[]; text: string }) => {
          try {
            const result = await wpsCliTools.wpsSendMessage({ to: args.to, text: args.text })
            return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            console.error('[WPS CLI MCP] wps_send_message failed:', error)
            return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true }
          }
        }
      ),
      sdk.tool(
        'wps_search_users',
        'Search for users in the WPS directory.',
        {
          query: z.string().describe('Search keyword'),
        },
        async (args: { query: string }) => {
          try {
            const result = await wpsCliTools.wpsSearchUsers(args.query)
            return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            console.error('[WPS CLI MCP] wps_search_users failed:', error)
            return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true }
          }
        }
      ),
      sdk.tool('wps_list_calendars', 'List all calendars for the current user.', {}, async () => {
        try {
          const result = await wpsCliTools.wpsListCalendars()
          return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          console.error('[WPS CLI MCP] wps_list_calendars failed:', error)
          return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true }
        }
      }),
      sdk.tool(
        'wps_create_event',
        'Create a calendar event.',
        {
          calendar_id: z.string().describe('Calendar ID (use "primary" for primary calendar)'),
          summary: z.string().describe('Event title'),
          from: z.string().describe('Start time in ISO 8601 format'),
          to: z.string().describe('End time in ISO 8601 format'),
          description: z.string().optional().describe('Event description'),
          location: z.string().optional().describe('Meeting location'),
          attendees: z.array(z.string()).optional().describe('List of attendee user IDs'),
        },
        async (args: {
          calendar_id: string
          summary: string
          from: string
          to: string
          description?: string
          location?: string
          attendees?: string[]
        }) => {
          try {
            const result = await wpsCliTools.wpsCreateEvent(args)
            return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            console.error('[WPS CLI MCP] wps_create_event failed:', error)
            return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true }
          }
        }
      ),
      sdk.tool(
        'wps_query_freebusy',
        'Query user availability during a time range.',
        {
          users: z.array(z.string()).describe('List of user IDs'),
          from: z.string().describe('Start time in ISO 8601 format'),
          to: z.string().describe('End time in ISO 8601 format'),
        },
        async (args: { users: string[]; from: string; to: string }) => {
          try {
            const result = await wpsCliTools.wpsQueryFreebusy(args)
            return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            console.error('[WPS CLI MCP] wps_query_freebusy failed:', error)
            return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true }
          }
        }
      ),
      sdk.tool(
        'wps_search_files',
        'Search for files in WPS cloud drive by keyword.',
        {
          keyword: z.string().describe('Search keyword'),
          drive_ids: z.string().optional().describe('Drive IDs, comma separated'),
          file_type: z.string().optional().describe('File type filter'),
        },
        async (args: { keyword: string; drive_ids?: string; file_type?: string }) => {
          try {
            const result = await wpsCliTools.wpsSearchFiles(args)
            return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            console.error('[WPS CLI MCP] wps_search_files failed:', error)
            return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true }
          }
        }
      ),
      sdk.tool(
        'wps_create_record',
        'Create a new record in a multi-dimensional table.',
        {
          file_id: z.string().describe('File ID'),
          sheet_id: z.string().describe('Sheet ID'),
          fields: z.record(z.string(), z.any()).describe('Field values as key-value pairs'),
        },
        async (args: { file_id: string; sheet_id: string; fields: Record<string, any> }) => {
          try {
            const result = await wpsCliTools.wpsCreateRecord(args)
            return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            console.error('[WPS CLI MCP] wps_create_record failed:', error)
            return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true }
          }
        }
      ),
      sdk.tool(
        'wps_http_request',
        'Call any WPS API directly using the user access token (bypasses CLI path restrictions). Use this for AirPage document creation, file management, and any API not exposed via CLI commands.',
        {
          method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).describe('HTTP method'),
          endpoint: z.string().describe('API endpoint path, e.g. /v7/airpage/create'),
          body: z.any().optional().describe('Request body (for POST/PUT/PATCH)'),
        },
        async (args: {
          method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
          endpoint: string
          body?: any
        }) => {
          try {
            const result = await wpsCliTools.wpsHttpRequest(args)
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            console.error('[WPS CLI MCP] wps_http_request failed:', error)
            return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true }
          }
        }
      ),
      // ===== AirPage 智能文档工具 =====
      sdk.tool(
        'wps_create_document',
        'Create a new AirPage smart document. Returns file_id and document URL. Requires AirPage login (Cookie auth via 365.kdocs.cn).',
        {
          name: z.string().describe('Document title'),
        },
        async (args: { name: string }) => {
          try {
            const result = await wpsCliTools.airpageCreateDocument(args.name)
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            console.error('[WPS CLI MCP] airpage_create failed:', error)
            return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true }
          }
        }
      ),
      sdk.tool(
        'wps_insert_content',
        'Insert Markdown content into an AirPage document. Content is converted to native blocks (headings, paragraphs, tables, lists).',
        {
          file_id: z.string().describe('File ID from wps_create_document'),
          content: z.string().describe('Markdown content to insert'),
          pos: z.enum(['begin', 'end']).optional().describe('Insert position, defaults to end'),
        },
        async (args: { file_id: string; content: string; pos?: 'begin' | 'end' }) => {
          try {
            const result = await wpsCliTools.airpageInsertContent({
              fileId: args.file_id,
              content: args.content,
              pos: args.pos,
            })
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            console.error('[WPS CLI MCP] airpage_insert_content failed:', error)
            return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true }
          }
        }
      ),
      sdk.tool(
        'wps_query_document',
        'Query the block structure of an AirPage document. Returns the full block tree.',
        {
          file_id: z.string().describe('File ID of the document'),
        },
        async (args: { file_id: string }) => {
          try {
            const result = await wpsCliTools.airpageQueryDocument(args.file_id)
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            console.error('[WPS CLI MCP] airpage_query failed:', error)
            return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true }
          }
        }
      ),
      sdk.tool(
        'wps_search_documents',
        'Search for AirPage documents by keyword.',
        {
          keyword: z.string().describe('Search keyword'),
        },
        async (args: { keyword: string }) => {
          try {
            const result = await wpsCliTools.airpageSearchDocuments(args.keyword)
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            console.error('[WPS CLI MCP] airpage_search failed:', error)
            return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true }
          }
        }
      ),
    ],
  })

  mcpServers['tagent-wps'] = server as unknown as Record<string, unknown>
  console.log('[WPS CLI MCP] 已注入 WPS CLI 工具 (tagent-wps)')
}
