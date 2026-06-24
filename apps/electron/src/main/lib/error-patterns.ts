/**
 * 瞬时网络错误模式
 *
 * 覆盖上游 API 偶发断流/抖动：API SSE 流中途 terminated、TCP 连接被重置、
 * DNS 抖动、fetch 层超时等。这些错误无 HTTP 状态码，SDK HTTP 客户端层
 * 内置的 2 次重试无法完全消化时，会穿透到 Orchestrator 应用层兜底。
 */
export const TRANSIENT_NETWORK_PATTERN =
  /terminated|socket hang up|ECONNRESET|ETIMEDOUT|EPIPE|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|fetch failed|network error|stream (?:closed|ended|disconnected) prematurely|premature close/i

/**
 * 上游响应体解析失败模式
 *
 * 覆盖上游网关返回的非 JSON 脏数据：HTML 错误页、SSE 流截断、代理脏数据等。
 * 这类错误本质是网关瞬时异常，重试通常能恢复，但 SDK HTTP 客户端层不会识别，
 * 默认当作致命错误抛出。归类为可重试的 service_error 后复用现有重试机制。
 */
export const MALFORMED_RESPONSE_PATTERN =
  /JSON Parse error|Unable to parse JSON string|Unexpected token|Unexpected end of JSON input|invalid json response body|failed to parse response body/i

/** 判断错误消息/stderr 是否为瞬时网络错误 */
export function isTransientNetworkError(message?: string, stderr?: string): boolean {
  if (!message && !stderr) return false
  return (
    (!!message && TRANSIENT_NETWORK_PATTERN.test(message)) ||
    (!!stderr && TRANSIENT_NETWORK_PATTERN.test(stderr))
  )
}

/** 判断错误消息/stderr 是否为上游响应体解析失败 */
export function isMalformedResponseError(message?: string, stderr?: string): boolean {
  if (!message && !stderr) return false
  return (
    (!!message && MALFORMED_RESPONSE_PATTERN.test(message)) ||
    (!!stderr && MALFORMED_RESPONSE_PATTERN.test(stderr))
  )
}
