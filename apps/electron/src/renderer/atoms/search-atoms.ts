/**
 * 会话搜索状态 Atoms
 *
 * 侧栏内联搜索（无弹窗）：快捷键只负责 focus 输入框。
 */

import { atom } from 'jotai'

/**
 * 递增后侧栏 SessionSearchInline 会 focus 输入框。
 * 快捷键 Ctrl/Cmd+Shift+F 写入。
 */
export const sessionSearchFocusTokenAtom = atom(0)

/**
 * @deprecated 弹窗已退役；保留别名避免外部误引用瞬时崩溃。
 * 新代码请用 sessionSearchFocusTokenAtom。
 */
export const searchDialogOpenAtom = atom(false)
