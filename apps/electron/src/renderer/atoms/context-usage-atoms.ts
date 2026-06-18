import { atom } from 'jotai'

/** complete 后触发 Context 分项刷新（防抖消费方读取） */
export const contextUsageRefreshNonceAtom = atom(0)
