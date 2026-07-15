# v1.6.0

画布沉浸式设计 + 设计系统材质全面重构 + CI 稳定性修复。

## 🎉 新功能

### Design Canvas 画布 v2
- **沉浸全屏模式**：画布可切换沉浸视图，最大化设计空间
- **Minimap 缩略图**：左下角实时缩略导航
- **分层/点选/指着说话**：节点树操作 + 元素高亮 + 自然语言交互
- **版本快照**：设计状态版本化管理，支持回溯
- **外部 HTML 导入**：支持拖拽导入 HTML 文件到画布
- **Design Preview 放大/沉浸布局**：会话列 + 画布双栏沉浸排版

### UI 材质系统全面重构（ADR-0005）
- **M3 Surface 角色体系**：引入 MD surface-container / primary-container 等角色 token
- **三材质正交架构**：frosted（默认实色）/ glass（高透液态）/ soft（轻拟态）
- **表面色跟随主题 hue**：去掉硬编码蓝与纯白，全部走 MD 角色 token
- **Glass 材质液态效果**：Switch + Sticky + Input 组件 neonav 风格
- **Soft Glass 表面重构**：data-material 架构 + rail/会话列表样式对齐设计原型
- **CopyButton / AttachmentPreviewItem**：迁入 @tagent/ui 统一管理

### 自动化意图检测（M4）
- **自然语言意图识别**：用户输入自动识别自动化创建意图

### 记忆系统增强
- **Idle Consolidation Pipeline**：空闲时自动记忆整理
- **ADR-0006**：记忆合并架构决策

## 🐛 修复

### UI/UX 修复
- **用户气泡融入主题色**：从 `--md-secondary-container` 改为 `--md-primary-container`，6 主题自动生效
- **Context 分项进度条去色块重复**：进度条改为中性色，不再与色块 swatch 撞色
- **模型选择器选中态**：补全列表背景、边框、阴影，glass/soft 材质适配
- **设置页主题色融入**：浮岛和卡片加主色微光渐变，与主界面对齐
- **会话视觉打磨**：session-list-row 样式优化 + streaming UX 修复

### CI/开发稳定性
- **TypeScript 0 error**：修复 shared/ui/electron 三包 30+ 处类型错误
- **ESLint 0 error**：修复 prototype placement 检查脚本缺失 + lint error 清零
- **Prettier 格式统一**：组件库格式化规范化

### Agent 稳定性
- **Agent Session Meta 持久化**：修复会话元数据不刷新顺序问题
- **Memory Reflection 可观测**：修复 reflection 结果统计 + 可靠性
- **Memory 前台调用放大**：修复辅助 LLM 调用在前台被放大
- **WPS CLI 集成修复**：多设备登录检测 + Secret Key 多层 fallback

---

## 🔧 重构

- **设置页浮岛布局重构**：统一设计语言，左导航 + 右内容双浮岛
- **会话信息流脚注重构**：token 统计 / context 用量 / 模型信息整合
- **@tagent/ui 组件库迁移**：统一 UI 库管理，颜色 token 集中化
- **原型文件归档**：前端原型统一迁入 `prototypes/` 目录

---

## 📝 文档

- Design Canvas v2 架构文档
- Liquid Glass UI Agent 参考文档
- Memory Idle Consolidation Pipeline 文档
- ADR-0005 Material Surface Token Architecture
- Glass Studio 原型 README

---

## 升级说明

1. 材质系统重构影响所有 UI 组件，升级后视觉效果更统一
2. 画布 v2 需要刷新页面才能加载新的沉浸布局
3. CI 流水线已全面修复，`bun run typecheck` + `bun run lint` 均 0 error
