# Release Notes

当前要发布的版本发版介绍。`release.yml` 已配置 `body_path: RELEASE_NOTES.md`，CI 自动读取本文件作为 GitHub Release 的 body。

**维护规则**：
- 发版前更新本文件为当前要发的版本内容
- 发版后清空内容或写下一版待定（历史版本在 GitHub Release 页面永久可见）
- 适中详略：分类区块 + 每项 1 行，不提根因/代码路径

---

## v1.4.2

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
