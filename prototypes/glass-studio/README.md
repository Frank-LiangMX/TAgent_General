# Glass Studio - TAgent 前端原型

Soft Glass 浮岛壳层前端原型，用于 TAgent 功能页面的视觉设计和交互验证。

## 项目概述

Glass Studio 是 TAgent 的前端原型系统，采用玻璃拟态（Glassmorphism）设计语言，提供：
- 4 大主题家族（Mist/Ocean/Moss/Dusk）
- 2 种界面材质（Soft Glass / Liquid Glass）
- 完整的功能页面原型

## 页面结构

```
pages/
├── chat.html       # 会话页（Tab 栏 + 消息流 + 会话列表）
├── kanban.html     # 看板页（看板列表 + 任务卡片）
├── draft.html      # 草稿页（草稿列表 + 需求块编辑）
├── memory.html     # 记忆页（记忆卡片网格 + 类型筛选）
├── automation.html # 自动任务页（任务列表 + 状态筛选）
└── settings.html   # 设置入口（重定向到 chat.html?settings）
```

## 核心组件

```
components/
├── shared.js       # 共享 JS 模块（主题、导航、模态框、设置弹窗）
├── shared.css       # 共享样式（模态框、Toast、按钮、表单）
└── settings-dialog.css  # 设置弹窗专用样式
```

## 样式系统

```
themes.css      # 主题定义（颜色、渐变）
materials.css   # 材质定义（Soft / Liquid）
tagent.css      # 核心布局（浮岛、导航、卡片）
styles.css      # 基础样式
```

## 使用方式

### 本地预览

直接用浏览器打开 `index.html` 或各功能页面即可预览。

### 主题切换

页面右上角的主题 Dock 提供：
- 4 种主题色选择
- 浅色/深色模式切换
- Soft/Liquid 材质切换

### 设置弹窗

点击任意页面左下角的设置按钮（头像/F按钮）打开设置弹窗。

## 布局规范

### 左侧浮岛

所有功能页面统一使用左侧浮岛布局：
- **Nav Rail** (60px) - 功能导航按钮
- **Sidebar** (240px) - 功能列表区域
- **红绿灯** - 位于浮岛顶部，与 Nav Rail 对齐

### 主内容区

- `chat.html` 使用 Tab 栏的 padding 让出左侧空间
- 其他页面使用 `has-left-sidebar` 类偏移整个内容区

## 设置功能

设置弹窗包含完整的配置选项：

| 分类 | 功能 |
|-----|------|
| 通用 | 语言、自动归档、桌面通知、消息置顶、Token Plan 提醒、通知提示音 |
| AI 渠道 | Claude/OpenAI/Kscc 渠道配置 |
| 提示词 | 提示词模板管理 |
| Agent 偏好 | 自动检查、SubAgent 派发、看板 worker 模型分配 |
| 远程 | Bot Hub 配置 |
| 语音 | 语音输入设置 |
| 代理 | HTTP/HTTPS/SOCKS5 代理 |
| 快捷键 | 完整快捷键列表 |
| 数据 | 使用量统计 |
| 外观 | 主题、材质、字号 |
| 关于 | 版本信息 |

## 技术栈

- 纯 HTML/CSS/JS
- 无框架依赖
- CSS 变量驱动主题系统
- 玻璃拟态视觉效果

## 后端接入

前端原型已完成，后续接入后端时需要：
1. 将静态数据替换为 API 调用
2. 实现真实的 CRUD 操作
3. 接入 TAgent 后端服务
4. 添加实时数据同步

## 相关项目

- [TAgent](../) - 主应用（Electron + React）
- [design-system](./design-system/) - 设计系统文档

## 更新日志

### 2026-07-10
- 完成所有功能页面布局
- 统一红绿灯和侧边栏位置
- 重构设置弹窗为玻璃拟态风格
- 补全所有设置功能选项