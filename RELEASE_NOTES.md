# Release Notes

发版时把对应版本的内容复制到 GitHub Release 的 body 字段。
`release.yml` 已配置 `body_path: RELEASE_NOTES.md`，CI 会自动读取本文件作为发版介绍。

**维护规则**：
- 每次发版前更新对应版本的内容
- 旧版本保留在下方"历史版本"区
- 适中详略：分类区块 + 每项 1 行，不提根因/代码路径

---

## v1.4.2（待发布）

稳定性补丁版本。落地 hermes-agent 借鉴清单首批 6 项，外加 4 项独立修复。

## ✨ 新功能
- 用户反馈入口 + 打开数据目录入口
- 工作区拖拽排序 + 批量删除会话
- 侧栏 / Tab / 设置页样式统一 + UI 库收口

## 🔒 安全
- Automation Prompt Injection 防护（扫描 + 拦截 + 历史记录）
- 看板 Worker Approval 防死锁（auto-deny 默认 + 可配置）

## 🧠 记忆系统修复
- L4 sessions.db 自动创建 + 会话结束写入
- 补全 6 个缺失 IPC 通道
- Reflect 有数据可提炼，L5 不再空转

## 📐 架构宪章
- Prompt Cache 不可侵犯原则写入 CLAUDE.md
- Footprint Ladder 能力阶梯 + command-registry

## 🐛 修复
- Windows 输入时附件卡片抖动 + 整个会话抖动
- session-not-found 卡死会话
- Context 压缩误删首尾关键消息（protect_first_n/last_n）
- sticky-message 输入时悬浮卡片抖动

## 🧹 清理
- 删除一次性 codemod 与 hooks 测试脚本
- ESLint 忽略 .tmp 目录 + prettier 统一

---

## v1.4.1

v1.4.0 发布后的两个紧急修复。

## 🐛 修复
- macOS 安装包"已损坏"（代码签名 ad-hoc fallback 回归）
- 自动更新"检查失败"看不到错误详情（AboutSettings 显示具体错误信息）

## 📋 已知限制
- 自动更新失败根因待用户日志确认，后续考虑加镜像下载源

---

## v1.4.0

看板多 Agent 协作系统正式落地，同时完成上游 Proma v0.13.4 全量对齐。TAgent 历史上最大一次更新。

## ✨ 新功能
- 看板多 Agent 协作系统（B1–B10）：看板内核 + worker 生命周期 + 6 个 Agent 工具 + 8 个 UI 组件 + 角色库
- 上游 Proma v0.13.4 对齐：bridge 自愈、headless registry、后台任务唤醒、qwen-anthropic provider、Automation MCP 工具
- Superpowers 全套 14 个 skill 收录
- auto-check PostToolUse 钩子（TAgent 独有）
- Context 分项 stale-while-revalidate

## 🎨 改进
- 消息布局瘦身 + 全局按钮圆角统一 + 过渡动画
- 关于页 logo 跟随主题切换 + 重做托盘图标
- 会话列表选中蒙版定位 + 跨面板可选择

## 🐛 修复
- P0 上游稳定性对齐
- CI 流水线：better-sqlite3 ABI 兼容、Electron 二进制下载
