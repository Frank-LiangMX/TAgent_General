# v1.6.0

画布沉浸式设计 + 材质系统全面重构 + CI 稳定性修复。

## ✨ 新功能
- Design Canvas 画布 v2 — 沉浸全屏 + Minimap + 分层/点选/指着说话 + 版本快照
- 外部 HTML 导入到画布
- M3 Surface 角色体系 — 三材质正交架构（frosted/glass/soft）
- Glass 材质液态效果 — Switch + Sticky + Input 组件
- Soft Glass 表面重构 + data-material 架构
- 自动化意图检测（M4）
- 记忆系统 Idle Consolidation Pipeline

## 🐛 修复
- 用户气泡融入主题色 — 6 主题 × light/dark 自动生效
- Context 分项进度条去色块重复
- 模型选择器列表选中态补全
- 设置页浮岛/卡片主题色融入
- Agent Session Meta 持久化修复
- Memory Reflection 可靠性修复
- TypeScript 30+ 处类型错误清零（shared/ui/electron 三包 0 error）
- ESLint 0 error — prototype placement 脚本 + lint 规则修复
- electron-builder theme-icons EEXIST 打包冲突

## 🧹 清理
- 设置页浮岛布局重构，统一设计语言
- 前端原型统一迁入 prototypes/ 目录
- @tagent/ui 组件库迁移 — 颜色 token 集中化
- CopyButton / AttachmentPreviewItem 迁入 @tagent/ui
