/**
 * 工作区文件检视 — 侧栏 Navigator 与主区 Inspector 共享选中态
 */

import { atom } from 'jotai'

/** 当前在文件功能区选中的绝对路径（文件） */
export const workspaceSelectedFileAtom = atom<string | null>(null)

/** 当前选中的目录路径（仅展开/浏览，主区显示目录概览） */
export const workspaceSelectedDirectoryAtom = atom<string | null>(null)
