/**
 * WPS CLI 封装层
 *
 * 封装 WPS365 CLI 的高频命令为 TypeScript 函数，
 * 复用 TAgent 设置页配置的 App ID 和 Secret Key。
 *
 * CLI 下载地址：https://github.com/wps365-open/cli/releases
 */

import { app } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import { execFile as execFileAsync, exec as execAsync } from 'child_process'
import { promisify } from 'util'
import { getWpsConfig } from './wps-config'
import { getDecryptedWpsSecretKey, decryptText } from './wps-config'

const execFile = promisify(execFileAsync)
const exec = promisify(execAsync)

// CLI 版本
const CLI_VERSION = 'v0.2.0'
const CLI_RELEASES_BASE = 'https://github.com/wps365-open/cli/releases/download'

// CLI 安装目录
function getCliDir(): string {
  return path.join(app.getPath('userData'), 'wps-cli')
}

// 获取 CLI 可执行文件路径
async function getCliPath(): Promise<string> {
  const cliDir = getCliDir()
  const platform = process.platform
  const arch = process.arch

  // Windows
  if (platform === 'win32') {
    return path.join(cliDir, 'wps365-cli.exe')
  }
  // macOS / Linux
  return path.join(cliDir, 'wps365-cli')
}

// 映射平台到 CLI 二进制文件名
function getBinaryInfo(): { filename: string; url: string; extractor: string } {
  const platform = process.platform
  const arch = process.arch

  const binaries: Record<string, { filename: string; url: string; extractor: string }> = {
    'win32-x64': {
      filename: 'wps365-cli-x86_64-pc-windows-gnu.zip',
      url: `${CLI_RELEASES_BASE}/${CLI_VERSION}/wps365-cli-x86_64-pc-windows-gnu.zip`,
      extractor: 'tar',
    },
    'win32-arm64': {
      filename: 'wps365-cli-aarch64-pc-windows-gnu.zip',
      url: `${CLI_RELEASES_BASE}/${CLI_VERSION}/wps365-cli-aarch64-pc-windows-gnu.zip`,
      extractor: 'tar',
    },
    'darwin-x64': {
      filename: 'wps365-cli-x86_64-apple-darwin.tar.gz',
      url: `${CLI_RELEASES_BASE}/${CLI_VERSION}/wps365-cli-x86_64-apple-darwin.tar.gz`,
      extractor: 'tar',
    },
    'darwin-arm64': {
      filename: 'wps365-cli-aarch64-apple-darwin.tar.gz',
      url: `${CLI_RELEASES_BASE}/${CLI_VERSION}/wps365-cli-aarch64-apple-darwin.tar.gz`,
      extractor: 'tar',
    },
    'linux-x64': {
      filename: 'wps365-cli-x86_64-unknown-linux-gnu.tar.gz',
      url: `${CLI_RELEASES_BASE}/${CLI_VERSION}/wps365-cli-x86_64-unknown-linux-gnu.tar.gz`,
      extractor: 'tar',
    },
    'linux-arm64': {
      filename: 'wps365-cli-aarch64-unknown-linux-gnu.tar.gz',
      url: `${CLI_RELEASES_BASE}/${CLI_VERSION}/wps365-cli-aarch64-unknown-linux-gnu.tar.gz`,
      extractor: 'tar',
    },
  }

  const key = `${platform}-${arch}`
  const binary = binaries[key]

  if (!binary) {
    throw new Error(`不支持的平台: ${key}，请手动安装 WPS365 CLI`)
  }

  return binary
}

/**
 * 确保 CLI 已下载
 */
async function ensureCliInstalled(): Promise<void> {
  const cliDir = getCliDir()
  const cliPath = await getCliPath()

  // 检查是否已安装
  try {
    await fs.access(cliPath)
    return // 已安装
  } catch {
    // 未安装，开始下载
  }

  const binary = getBinaryInfo()
  const archivePath = path.join(cliDir, binary.filename)

  // 创建目录
  await fs.mkdir(cliDir, { recursive: true })

  console.log(`[WPS CLI] 正在下载 CLI...`)

  // 使用 fetch 下载（Node 18+）
  const response = await fetch(binary.url)
  if (!response.ok) {
    throw new Error(`下载失败: ${response.status} ${response.statusText}`)
  }

  const buffer = await response.arrayBuffer()
  await fs.writeFile(archivePath, Buffer.from(buffer))

  console.log(`[WPS CLI] 下载完成，正在解压...`)

  // 解压
  if (process.platform === 'win32') {
    // Windows: 使用 PowerShell 解压
    await exec(`powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${cliDir}' -Force"`, { cwd: cliDir })
  } else {
    // macOS/Linux: 使用 tar
    await exec(`tar -xzf "${archivePath}" -C "${cliDir}"`, { cwd: cliDir })
  }

  // 清理压缩包
  await fs.unlink(archivePath).catch(() => {})

  // Windows 不需要设置执行权限
  if (process.platform !== 'win32') {
    await fs.chmod(cliPath, 0o755)
  }

  console.log(`[WPS CLI] 安装完成: ${cliPath}`)
}

/**
 * 调用 WPS CLI 命令
 */
async function callWpsCli(args: string[]): Promise<string> {
  // 凭证解析优先级：环境变量 > 设置页配置
  let appId = process.env.WPS365_CLIENT_ID || ''
  let secretKey = process.env.WPS365_CLIENT_SECRET || ''

  // 环境变量未设置时，尝试从 TAgent 设置页读取
  if (!appId || !secretKey) {
    const config = await getWpsConfig()
    if (!appId) appId = config.appId
    if (!secretKey) secretKey = await getDecryptedWpsSecretKey()
  }

  if (!appId) {
    throw new Error('WPS 未配置 App ID。开发者可设置环境变量 WPS365_CLIENT_ID，或用户在设置页配置 WPS 协作。')
  }

  if (!secretKey) {
    throw new Error('WPS 未配置 Secret Key。开发者可设置环境变量 WPS365_CLIENT_SECRET，或用户在设置页配置。')
  }

  // 检查用户是否已 OAuth 登录（Delegated 模式）
  // 如果有用户 token，优先使用用户身份调用 API
  const config = await getWpsConfig()
  let userToken = ''
  if (
    config.userAccessToken &&
    config.userTokenExpiresAt &&
    config.userTokenExpiresAt > Date.now() + 5 * 60 * 1000
  ) {
    userToken = decryptText(config.userAccessToken)
  }

  // 确保 CLI 已安装
  await ensureCliInstalled()

  const cliPath = await getCliPath()

  // 构建环境变量
  // 优先级：用户 token > App 模式 > 系统环境变量
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    WPS365_OUTPUT: 'json',
    WPS365_QUIET: '1',
  }

  if (userToken) {
    // 用户身份（Delegated 模式）：注入 access token
    env.WPS365_ACCESS_TOKEN = userToken
  } else {
    // 应用身份（App 模式）：注入 client credentials
    env.WPS365_CLIENT_ID = appId
    env.WPS365_CLIENT_SECRET = secretKey
  }

  // 执行 CLI
  const { stdout, stderr } = await execFile(cliPath, args, { env })

  if (stderr && !stderr.includes('delegated token unavailable')) {
    console.warn('[WPS CLI] stderr:', stderr)
  }

  return stdout.trim()
}

/**
 * 解析 JSON 输出，处理错误
 */
async function callWpsCliJson<T = any>(args: string[]): Promise<T> {
  const output = await callWpsCli(args)

  try {
    const result = JSON.parse(output)
    if (result.code !== 0 && result.code !== undefined) {
      throw new Error(`WPS API 错误: ${result.code} ${result.msg || ''}`)
    }
    return result
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`解析 CLI 输出失败: ${output}`)
  }
}

export { callWpsCli, callWpsCliJson, ensureCliInstalled, getCliPath }

// ============================================================
// 工具函数封装
// ============================================================

// -------------------- 用户 --------------------

/**
 * 获取当前用户信息
 */
export async function wpsGetCurrentUser(): Promise<any> {
  return callWpsCliJson(['user', 'me'])
}

/**
 * 获取用户列表
 */
export async function wpsListUsers(params?: {
  status?: 'active' | 'notactive' | 'disabled'
  pageSize?: number
  pageToken?: string
}): Promise<any> {
  const args = ['user', 'list', '--status', params?.status || 'active']
  if (params?.pageSize) {
    args.push('--page-size', String(params.pageSize))
  }
  if (params?.pageToken) {
    args.push('--page-token', params.pageToken)
  }
  return callWpsCliJson(args)
}

/**
 * 搜索用户
 */
export async function wpsSearchUsers(query: string): Promise<any> {
  return callWpsCliJson(['user', 'search', '--query', query])
}

// -------------------- 日历 --------------------

/**
 * 获取日历列表
 */
export async function wpsListCalendars(): Promise<any> {
  return callWpsCliJson(['calendar', 'list'])
}

/**
 * 获取日程列表
 */
export async function wpsListEvents(
  calendarId: string,
  params?: {
    from?: string
    to?: string
    pageSize?: number
  }
): Promise<any> {
  const args = ['calendar', 'events', 'list', calendarId]
  if (params?.from) args.push('--start-time', params.from)
  if (params?.to) args.push('--end-time', params.to)
  if (params?.pageSize) args.push('--page-size', String(params.pageSize))
  return callWpsCliJson(args)
}

/**
 * 创建日程
 */
export async function wpsCreateEvent(params: {
  calendar_id: string
  summary: string
  from: string
  to: string
  description?: string
  attendees?: string[]
  location?: string
}): Promise<any> {
  const args = [
    'calendar', 'events', 'create', params.calendar_id,
    '--name', params.summary,
    '--from', params.from,
    '--to', params.to,
  ]
  if (params.description) args.push('--description', params.description)
  if (params.location) args.push('--location', params.location)
  return callWpsCliJson(args)
}

/**
 * 查询忙闲
 */
export async function wpsQueryFreebusy(params: {
  users: string[]
  from: string
  to: string
}): Promise<any> {
  const args = ['calendar', 'free-busy', 'list', '--from', params.from, '--to', params.to]
  for (const user of params.users) {
    args.push('--user', user)
  }
  return callWpsCliJson(args)
}

// -------------------- IM --------------------

/**
 * 发送消息
 */
export async function wpsSendMessage(params: {
  to: string[]
  text: string
}): Promise<any> {
  const args = ['im', 'messages', 'send']
  for (const recipient of params.to) {
    args.push('--to', recipient)
  }
  args.push('--text', params.text)
  return callWpsCliJson(args)
}

/**
 * 获取群聊列表
 */
export async function wpsListChats(): Promise<any> {
  return callWpsCliJson(['im', 'chats', 'list'])
}

/**
 * 创建群聊
 */
export async function wpsCreateChat(params: {
  name: string
  members?: string[]
}): Promise<any> {
  const args = ['im', 'chats', 'create', '--name', params.name]
  if (params.members) {
    for (const member of params.members) {
      args.push('--member', member)
    }
  }
  return callWpsCliJson(args)
}

/**
 * 获取群聊消息列表
 */
export async function wpsListChatMessages(chatId: string, params?: {
  pageSize?: number
}): Promise<any> {
  const args = ['im', 'chat-message', 'list', chatId]
  if (params?.pageSize) args.push('--page-size', String(params.pageSize))
  return callWpsCliJson(args)
}

// -------------------- 云文档 --------------------

/**
 * 获取文件列表
 */
export async function wpsListFiles(
  driveId: string,
  parentId: string,
  params?: {
    pageSize?: number
    pageToken?: string
  }
): Promise<any> {
  const args = ['drive', 'files', 'list', driveId, parentId]
  if (params?.pageSize) args.push('--page-size', String(params.pageSize))
  if (params?.pageToken) args.push('--page-token', params.pageToken)
  return callWpsCliJson(args)
}

/**
 * 搜索文件
 */
export async function wpsSearchFiles(params: {
  keyword: string
  driveIds?: string
  fileType?: string
  pageSize?: number
}): Promise<any> {
  const args = ['drive', 'files', 'search', '--type', 'all', '--keyword', params.keyword]
  if (params.driveIds) args.push('--drive-ids', params.driveIds)
  if (params.fileType) args.push('--file-type', params.fileType)
  if (params.pageSize) args.push('--page-size', String(params.pageSize))
  return callWpsCliJson(args)
}

/**
 * 获取文件信息
 */
export async function wpsGetFile(driveId: string, fileId: string): Promise<any> {
  return callWpsCliJson(['drive', 'files', 'get', driveId, fileId])
}

/**
 * 创建分享链接
 */
export async function wpsCreateShareLink(fileId: string, params?: {
  link_type?: 'view' | 'edit'
  expire_time?: string
}): Promise<any> {
  const args = ['drive', 'file-link', 'create', '--file-id', fileId]
  if (params?.link_type) args.push('--link-type', params.link_type)
  if (params?.expire_time) args.push('--expire-time', params.expire_time)
  return callWpsCliJson(args)
}

/**
 * 获取分享链接列表
 */
export async function wpsListShareLinks(fileId: string): Promise<any> {
  return callWpsCliJson(['drive', 'file-link', 'list', '--file-id', fileId])
}

// -------------------- 多维表 --------------------

/**
 * 获取多维表记录列表
 */
export async function wpsListRecords(
  fileId: string,
  sheetId: string,
  params?: {
    pageSize?: number
    pageToken?: string
  }
): Promise<any> {
  const args = ['dbsheet', 'records', 'list', fileId, sheetId]
  if (params?.pageSize) args.push('--page-size', String(params.pageSize))
  if (params?.pageToken) args.push('--page-token', params.pageToken)
  return callWpsCliJson(args)
}

/**
 * 创建多维表记录
 */
export async function wpsCreateRecord(params: {
  file_id: string
  sheet_id: string
  fields: Record<string, any>
}): Promise<any> {
  const recordsBody = JSON.stringify([{ fields_value: JSON.stringify(params.fields) }])
  const args = [
    'dbsheet', 'records', 'create',
    params.file_id,
    params.sheet_id,
    '--records-body', recordsBody,
  ]
  return callWpsCliJson(args)
}

/**
 * 更新多维表记录
 */
export async function wpsUpdateRecord(params: {
  file_id: string
  sheet_id: string
  record_id: string
  fields: Record<string, any>
}): Promise<any> {
  const args = [
    'dbsheet', 'record', 'update',
    '--file-id', params.file_id,
    '--sheet-id', params.sheet_id,
    '--record-id', params.record_id,
    '--fields', JSON.stringify(params.fields),
  ]
  return callWpsCliJson(args)
}

// -------------------- 会议 --------------------

/**
 * 获取会议列表
 */
export async function wpsListMeetings(): Promise<any> {
  return callWpsCliJson(['meeting', 'list'])
}

/**
 * 创建会议
 */
export async function wpsCreateMeeting(params: {
  subject: string
  from: string
  to: string
  attendees?: string[]
  description?: string
}): Promise<any> {
  const args = [
    'meeting', 'create',
    '--subject', params.subject,
    '--from', params.from,
    '--to', params.to,
  ]
  if (params.description) args.push('--description', params.description)
  if (params.attendees) {
    for (const attendee of params.attendees) {
      args.push('--attendee', attendee)
    }
  }
  return callWpsCliJson(args)
}

// -------------------- 通用 API --------------------

/**
 * 通用 GET 请求
 */
export async function wpsApiGet(endpoint: string): Promise<any> {
  return callWpsCliJson(['api', 'get', endpoint])
}

/**
 * 通用 POST 请求
 */
export async function wpsApiPost(endpoint: string, data: any): Promise<any> {
  return callWpsCliJson(['api', 'post', endpoint, '--data', JSON.stringify(data)])
}

// -------------------- 直接 HTTP API（跳过 CLI） --------------------

/**
 * 用用户 token 直接调用 WPS HTTP API，不受 CLI 路径白名单限制
 */
export async function wpsHttpRequest(params: {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  endpoint: string
  body?: any
}): Promise<any> {
  const config = await getWpsConfig()
  const apiUrl = config.apiUrl || 'https://openapi.wps.cn'

  // 优先用用户 token，其次是环境变量
  let token = process.env.WPS365_ACCESS_TOKEN || ''
  if (!token && config.userAccessToken && config.userTokenExpiresAt && config.userTokenExpiresAt > Date.now()) {
    token = decryptText(config.userAccessToken)
  }

  if (!token) {
    throw new Error('没有可用的用户 token，请先登录 WPS')
  }

  const url = `${apiUrl}${params.endpoint}`
  const options: RequestInit = {
    method: params.method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }

  if (params.body && params.method !== 'GET') {
    options.body = JSON.stringify(params.body)
  }

  const response = await fetch(url, options)
  const text = await response.text()

  if (!response.ok) {
    throw new Error(`WPS API 请求失败 [${response.status}]: ${text.slice(0, 300)}`)
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// -------------------- AirPage 智能文档 --------------------

const AIRPAGE_BASE = 'https://365.kdocs.cn'
const AIRPAGE_CRED_FILE = path.join(app.getPath('userData'), 'airpage-creds.json')

interface AirpageCreds {
  cookie: string
  csrf: string
  updatedAt?: string
  updated_at?: string
}

/**
 * 读取 AirPage 凭据（Cookie + CSRF）
 */
async function getAirpageCreds(): Promise<AirpageCreds> {
  try {
    const raw = await fs.readFile(AIRPAGE_CRED_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    // 也检查 WPS-AirPage-Skill 的凭据文件
    try {
      const raw = await fs.readFile(
        path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude', 'secrets', 'wps365.json'),
        'utf-8'
      )
      return JSON.parse(raw)
    } catch {
      throw new Error('AirPage 未登录，请先在设置页登录 WPS 智能文档')
    }
  }
}

/**
 * 保存 AirPage 凭据
 */
async function saveAirpageCreds(creds: AirpageCreds): Promise<void> {
  await fs.writeFile(AIRPAGE_CRED_FILE, JSON.stringify(creds, null, 2), 'utf-8')
}

/**
 * 发送 AirPage API 请求
 */
async function airpageFetch(endpoint: string, options: {
  method?: string
  body?: any
  needCsrf?: boolean
} = {}): Promise<any> {
  const creds = await getAirpageCreds()
  const url = `${AIRPAGE_BASE}${endpoint}`
  const headers: Record<string, string> = {
    Cookie: creds.cookie,
    'Accept-Encoding': 'identity',
  }

  if (options.needCsrf !== false) {
    if (!creds.csrf) throw new Error('缺少 CSRF token，AirPage 写操作需要 CSRF')
    headers['x-csrf-rand'] = creds.csrf
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const text = await res.text()
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`AirPage API 响应解析失败 [${res.status}]: ${text.substring(0, 200)}`)
  }
  return data
}

/**
 * AirPage API 请求（带 execute 命令）
 */
async function airpageExecute(fileId: string, command: object): Promise<any> {
  const data = await airpageFetch(`/api/v3/office/file/${fileId}/core/execute`, {
    method: 'POST',
    body: command,
  })
  if (data.result === 'ExecuteFailed') {
    throw new Error(`AirPage 操作失败: ${data.message || JSON.stringify(data)}`)
  }
  return data
}

/** AirPage 登录状态 */
export interface AirpageStatus {
  loggedIn: boolean
  loading?: boolean
  userName?: string
  updatedAt?: string
}

/**
 * 检查 AirPage 登录状态
 */
export async function airpageGetStatus(): Promise<AirpageStatus> {
  try {
    const creds = await getAirpageCreds()
    return {
      loggedIn: true,
      updatedAt: creds.updatedAt || creds.updated_at || undefined,
    }
  } catch {
    return { loggedIn: false }
  }
}

/**
 * AirPage 登出（清除凭据）
 */
export async function airpageLogout(): Promise<void> {
  try {
    await fs.unlink(AIRPAGE_CRED_FILE)
  } catch { /* 文件不存在忽略 */ }
}

// 暴露供内部使用
export { getAirpageCreds, saveAirpageCreds, airpageFetch, airpageExecute, AIRPAGE_CRED_FILE }

/**
 * 创建 AirPage 智能文档
 */
export async function airpageCreateDocument(name: string): Promise<{ fileid: string; doc_url: string }> {
  const data = await airpageFetch('/api/v3/office/new/o/file', {
    method: 'POST',
    body: { fname: name },
  })
  const fileId = String(data.fileid || data.data?.fileid || data.data?.file_id || data.file_id || '')
  if (!fileId) throw new Error(`创建 AirPage 失败: ${JSON.stringify(data)}`)

  // 设置文档标题
  try {
    const root = await airpageExecute(fileId, {
      command: 'http.otl.query',
      param: { name: 'block.query', params: { blockIds: ['doc'] } },
    })
    const children = root?.detail?.result?.blocks?.[0]?.content ?? []
    const titleBlock = children.find((b: any) => b.type === 'title')
    if (titleBlock?.id) {
      await airpageExecute(fileId, {
        command: 'http.otl.exec',
        param: {
          subtype: 'block.update',
          params: [{
            operation: 'update_content',
            blockId: titleBlock.id,
            content: [{ type: 'text', content: name }],
          }],
        },
      })
    }
  } catch { /* 标题设置失败不影响主流程 */ }

  const docUrl = `https://365.kdocs.cn/office/o/${fileId}`
  return { fileid: fileId, doc_url: docUrl }
}

/**
 * 向 AirPage 文档插入 Markdown 内容
 */
export async function airpageInsertContent(params: {
  fileId: string
  content: string
  pos?: 'begin' | 'end'
}): Promise<any> {
  return airpageExecute(params.fileId, {
    command: 'http.otl.exec',
    param: {
      subType: 'insertContent',
      params: {
        content: params.content,
        pos: params.pos || 'end',
      },
    },
  })
}

/**
 * 查询 AirPage 文档块结构
 */
export async function airpageQueryDocument(fileId: string, blockId = 'doc'): Promise<any> {
  return airpageExecute(fileId, {
    command: 'http.otl.query',
    param: { name: 'block.query', params: { blockIds: [blockId] } },
  })
}

/**
 * 搜索 AirPage 文档
 */
export async function airpageSearchDocuments(keyword: string, count = 10): Promise<any> {
  return airpageFetch(`/3rd/drive/api/v6/search/files?searchname=${encodeURIComponent(keyword)}&count=${count}`)
}

// -------------------- 可用性检查 --------------------

/**
 * 检查 WPS CLI 是否可用（App ID 已配置）
 *
 * 优先级：环境变量 > 设置页配置
 */
export function isWpsCliAvailable(): boolean {
  // 先检查环境变量（开发者在部署层面配置）
  if (process.env.WPS365_CLIENT_ID) return true

  // 再检查设置页配置
  try {
    const config = getWpsConfig()
    return !!config.appId
  } catch {
    return false
  }
}
