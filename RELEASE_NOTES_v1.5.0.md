# v1.5.0 Release Notes

## 🎉 New Features

### Memory System v2.0 — 全面改造
- **静默记忆机制**：后台自动沉淀，不再干扰主对话流
- **Frozen Snapshot**：关键记忆冻结保存，防止误覆盖
- **Memory Graph**：知识图谱可视化，L0-L5 层级联动
- **自进化机制**：contradiction_check（矛盾检测）、Nudge 结构化写入、Self-Repair（自我修复）、project_repeat（重复检测）
- **记忆页面重设计**：左栏会话搜索 + 主区 L4 高亮 + 点击定位滚动
- **玻璃浮岛卡片**：session-list-row 风格统一

### Kanban 看板增强
- **Worker 中断机制**：支持中途打断并恢复
- **项目根注入 D+1**：自动注入项目根目录上下文
- **Blackboard D+2**：看板全局黑板共享
- **IM 通知渠道 Phase C**：微信/WPS 消息推送 + Bridge 入站控制
- **跨渠道模型分配**：worker 可绑定不同模型
- **v1 产品化验收手册**：配套文档完善

### Agent Role 角色库商店
- **角色商店入口**：浏览预置角色模板
- **.md 导入**：从 Markdown 文件导入角色定义
- **内置角色升级**：升级现有角色配置

### UI/UX 改进
- **右侧 Rail 重设计**：镜像左侧 NavIsland 浮岛布局
- **BTW 按钮位置调整**：旁注触发按钮移至 RightPanelRail
- **拖拽文件夹 Chip**：蓝色标识 + 可删除
- **权限模式胶囊选择器**：图标+文字样式
- **草稿模式 UI 优化**：看板团队 Tab 体验改进

---

## 🐛 Bug Fixes

### Agent 稳定性修复
- **kscc 报错反映**：正确展示错误信息
- **sessionId 错乱**：修复会话 ID 传递问题
- **prompt_too_long 兜底**：超长提示容错处理
- **会话模型/渠道选择重置**：防止默认值回退
- **SDK auto-memory 入侵**：根治 memory 劫持问题

### Context 上下文修复
- **模型 context window 映射**：修正 glm-5.1 等模型上下文窗口值
- **切换会话上下文警告误触发**：修复警告误报
- **1M 模型映射确认**：补充已确认的 1M 上下文模型

### Streaming 流式输出
- **kscc 渠道流式文本冻结**：启用 SDK includePartialMessages
- **透传修复**：流式内容实时显示

### Memory 记忆系统
- **project_repeat 跨 session 重复触发**：修复跨会话误检测
- **Self-Repair 定时器溢出**：32 位整数溢出导致无限循环
- **Nudge toast 不弹**：根因修复 + 玻璃卡片样式

### UI 样式修复
- **FilePathChip 抖动**：三态统一预留 border 占位
- **圆角统一**：rounded-md / rounded-lg 标准化
- **Toast 圆角覆盖**：--border-radius 变量覆盖 sonner 默认值
- **RightRail 显示错位**：跟随主面板 tab 类型
- **Windows rail 按钮**：与窗口控件间距调整
- **默认主题**：改为浅色模式
- **托盘图标**：简化为五边形轮廓（macOS）

---

## 🔧 Refactor / Chore

- **右侧 rail 简化**：单按钮 + 浮岛布局
- **记忆左栏重构**：会话搜索 + L4 高亮
- **BTW 触发按钮重构**：移至 RightPanelRail
- **清理废弃文件**：项目归档整理
- **版本号升级**：v1.4.2 → v1.5.0

---

## 📝 Documentation

- 记忆系统实现现状文档 + CLAUDE.md 链接
- 自进化机制同步到 PROGRESS.md
- Agent 稳定性诊断文档
- Ask 模式重构设计（独立会话类型）
- 微信/WPS 通知配置说明

---

## Upgrade Notes

本次版本包含记忆系统重大改造，升级后：
1. 首次启动会自动迁移旧记忆数据
2. 新的静默记忆机制默认启用
3. Memory Graph 可在左侧栏「记忆」入口查看
4. 自进化检测（矛盾/重复/修复）后台自动运行