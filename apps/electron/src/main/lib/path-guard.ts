/**
 * 路径边界守卫 — 判断路径是否落在授权根目录内
 *
 * Windows 文件系统大小写不敏感，但 Node realpathSync / resolve 会保留输入盘符大小写。
 * 用 path.relative 做包含判断（win32 下大小写不敏感），避免 `f:\proj\a` 对 `F:/proj` 误判越界。
 */

import { isAbsolute, relative, resolve } from 'node:path'

/**
 * 判断 child 是否位于 root 内（含 root 自身）。
 *
 * 两侧路径应已 resolve / realpath；本函数不再访问磁盘。
 *
 * @param resolvedChild - 已规范化的目标路径
 * @param resolvedRoot - 已规范化的根目录
 * @returns 是否在根目录内
 */
export function isPathInsideResolved(resolvedChild: string, resolvedRoot: string): boolean {
  const rel = relative(resolvedRoot, resolvedChild)
  // relative 在不同盘符时返回绝对路径；在父级之外时以 `..` 开头
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/**
 * 判断 filePath 是否位于 rootPath 内（含 root 自身）。
 * 使用 path.resolve 规范化，不做 realpath（调用方可先 realpath）。
 */
export function isPathInside(filePath: string, rootPath: string): boolean {
  return isPathInsideResolved(resolve(filePath), resolve(rootPath))
}
