/**
 * @tagent/ui - 共享 UI 组件和 Hooks
 */

// 基础组件（从 apps/electron/components/ui 迁移）
export * from './components/alert'
export * from './components/alert-dialog'
export * from './components/badge'
export * from './components/button'
export * from './components/collapsible'
export * from './components/command'
export * from './components/context-menu'
export * from './components/dialog'
export * from './components/dropdown-menu'
export * from './components/image-lightbox'
export * from './components/input'
export * from './components/label'
export * from './components/loading-indicator'
export * from './components/popover'
export * from './components/scroll-area'
export * from './components/scroll-progress-container'
export * from './components/search-input'
export * from './components/segmented-tabs'
export * from './components/select'
export * from './components/separator'
export * from './components/sheet'
export * from './components/slider'
export * from './components/sonner'
export * from './components/spinner'
export * from './components/switch'
export * from './components/tabs'
export * from './components/textarea'
export * from './components/three-petal-spiral'
export * from './components/tooltip'

// 富内容组件
export { CodeBlock } from './code-block/index.ts'
export { MermaidBlock } from './mermaid-block/index.ts'
export { useSmoothStream } from './hooks/index.ts'
