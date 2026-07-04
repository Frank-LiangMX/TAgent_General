# 看板 v1 端到端验收手册

> **状态**：Draft v1.0 — 手动验证指引
> **日期**：2026-07-04
> **目标**：验证看板多 Agent 协作系统的端到端流程

---

## 0. 验收前置条件

### 环境准备

```bash
# 1. 进入项目目录
cd /Users/frank/Downloads/TAgent_General

# 2. 确保依赖完整
bun install

# 3. 确保 native 模块正确编译（Electron ABI）
cd apps/electron && bun run rebuild:native && cd ../..

# 4. 启动开发模式
bun run dev
```

### 渠道配置

确保至少有一个可用渠道：
- **推荐**：kscc-internal（内网免费）
- 或者：OpenAI / DeepSeek / Claude 等外部渠道

检查渠道配置：
1. 打开应用 → 设置 → 渠道管理
2. 确保至少一个渠道已启用且有可用模型

---

## 1. 验收场景清单

### 场景 1：草稿升级 → 自动建板 → 团队 Tab 显示

**步骤**：

1. **创建草稿**
   - 左侧 rail 点击「草稿」
   - 点击「+ 新建草稿」
   - 输入标题：「登录重构」
   - 添加 3 个需求块：
     - R-1：前端登录页面
     - R-2：后端 API 接口
     - R-3：单元测试
   - 每个需求块填写标题 + 描述 + 验收标准

2. **升级到 Agent**
   - 草稿状态改为「ready」（点击「标记为就绪」）
   - 点击「交给 Agent」按钮
   - 等待主会话创建

3. **验证团队 Tab**
   - 主会话顶部应出现二级 Tab：`[ 对话 ] [ 团队 · 0/3 ]`
   - 点击「团队」Tab
   - 左栏应显示 3 个任务卡片（状态：待派工）
   - 侧栏主会话项应显示徽标：「登录重构 · 团队 0/3」

**预期结果**：
- ✅ 主会话出现「团队」Tab
- ✅ 团队 Tab 左栏显示 3 个任务
- ✅ 任务状态为「待派工」或「执行中」（调度器已启动）

**截图位置**：
- 团队 Tab 左栏任务列表
- 侧栏主会话徽标

---

### 场景 2：调度器派工 → 任务状态变化

**步骤**：

1. 在团队 Tab 左栏观察任务状态
2. 等待 30s（调度器 tick 周期）
3. 观察状态变化：
   - 待派工 → 执行中（派工成功）
   - 或直接显示「执行中」（已派工）

**预期结果**：
- ✅ 至少 1 个任务进入「执行中」状态
- ✅ 任务卡片显示模型 ID（如 glm-5.1）
- ✅ 任务卡片显示橙色进度指示器（执行中）

**日志验证**：
打开终端，观察输出：
```
[看板] 调度器 tick：派工 X 个任务
[看板] 任务 t_xxx 开始执行，modelId=glm-5.1
```

---

### 场景 3：点击任务 → 嵌套 AgentView 显示工人对话

**步骤**：

1. 在团队 Tab 左栏点击一个「执行中」的任务
2. 右侧应显示嵌套的 AgentView（工人子会话对话）
3. 观察工人对话内容：
   - 工人正在执行任务
   - 有工具调用（Read / Write / Bash 等）
   - 有 Assistant 回复

**预期结果**：
- ✅ 右侧显示完整 AgentView（非空白）
- ✅ AgentView 内无二级「团队」Tab（避免递归）
- ✅ 工人对话正常流式输出

**注意**：
如果右侧空白，说明 `assigneeSessionId` 未正确写入，需要检查：
- `kanban-worker-service.ts` 是否正确创建子会话
- `db.updateTaskStatus` 是否写入 `assigneeSessionId`

---

### 场景 4：跨渠道模型分配验证

**前提**：配置多个外部渠道（openai / deepseek / claude）

**步骤**：

1. 创建一个外部渠道看板（如 OpenAI）
2. 添加 3 个任务（不指定 roleId / modelId）
3. 观察任务分配的模型 ID

**预期结果**：
- ✅ 3 个任务分配不同渠道模型（轮询）
  - 任务1 → gpt-4o（OpenAI）
  - 任务2 → deepseek-chat（DeepSeek）
  - 任务3 → claude-sonnet（Claude）

**日志验证**：
```
[看板] 任务 t_xxx 分配模型：openai/gpt-4o
[看板] 任务 t_yyy 分配模型：deepseek/deepseek-chat
```

---

### 场景 5：kscc 看板禁止跳外部验证

**前提**：只有一个 kscc 渠道，无外部渠道

**步骤**：

1. 创建 kscc 看板
2. 尝试手动指定外部模型（在创建任务时填 modelId='gpt-4o'）
3. 观察日志

**预期结果**：
- ✅ 日志显示：`[看板] kscc 任务禁止用外部模型 gpt-4o，忽略显式指定`
- ✅ 实际分配 kscc 模型（如 glm-5.1）

---

### 场景 6：依赖链验证（B 依赖 A）

**步骤**：

1. 创建看板，添加 2 个任务：
   - 任务 A：前端页面（无依赖）
   - 任务 B：后端接口（依赖 A）
2. 在团队 Tab 观察执行顺序

**预期结果**：
- ✅ 任务 A 先执行（status=running）
- ✅ 任务 B 保持待办（status=pending，依赖未满足）
- ✅ 任务 A 完成后，任务 B 自动提升为 ready → running

**日志验证**：
```
[看板] 任务 t_A 完成，提升依赖任务 t_B 为 ready
```

---

### 场景 7：关主窗口 → 托盘后台运行

**步骤**：

1. 创建看板，启动任务执行
2. 关闭主窗口（点击关闭按钮 ×）
3. 检查托盘图标（任务栏右下角）
4. 点击托盘图标 → 应显示「进行中看板数」

**预期结果**：
- ✅ 应用不退出（托盘图标仍在）
- ✅ 任务继续执行（日志继续输出）
- ✅ 托盘菜单显示看板进度

**验证方式**：
观察终端日志，应继续输出：
```
[看板] 调度器 tick：派工 X 个任务
```

---

### 场景 8：重启应用 → 恢复 interrupted 任务

**步骤**：

1. 创建看板，启动任务执行（至少 1 个 running）
2. 强制关闭应用（Ctrl+C 或 kill 进程）
3. 重新启动应用（`bun run dev`）
4. 观察团队 Tab

**预期结果**：
- ✅ 启动日志显示：`[看板] 启动恢复：X 个残留 running 任务已重置为 ready`
- ✅ 团队 Tab 任务状态为「待派工」或「执行中」（重新派工）
- ✅ 任务继续执行直到完成

---

## 2. 问题排查清单

### 问题 1：团队 Tab 不显示

**可能原因**：
- `sessionMeta.boardId` 未写入
- 草稿升级建板失败
- `sessionBoardIdAtomFamily` 未正确派生

**排查步骤**：
1. 打开浏览器 DevTools（Ctrl+Shift+I）
2. Console 输入：
   ```javascript
   window.electronAPI.kanban.getBoard('board_xxx')
   ```
3. 检查返回的 `board.parentSessionId` 是否等于当前 sessionId

---

### 问题 2：任务一直「待派工」不执行

**可能原因**：
- 调度器未启动
- 渠道无可用模型
- maxConcurrent 上限已满

**排查步骤**：
1. 检查终端日志，搜索 `[看板] 调度器 tick`
2. 检查渠道是否有可用模型：
   ```javascript
   // DevTools
   const channel = await window.electronAPI.getChannel('kscc-internal')
   console.log(channel.models.filter(m => m.enabled))
   ```
3. 检查并发上限：
   ```javascript
   // DevTools
   const settings = await window.electronAPI.getSettings()
   console.log(settings.agentBehavior?.maxConcurrentPerModel)
   ```

---

### 问题 3：点击任务右侧空白

**可能原因**：
- `assigneeSessionId` 未写入
- 子会话未创建
- 子会话已创建但无消息

**排查步骤**：
1. 检查任务的 `assigneeSessionId`：
   ```javascript
   const task = await window.electronAPI.kanban.listTasks('board_xxx')
   console.log(task.find(t => t.id === 't_xxx').assigneeSessionId)
   ```
2. 如果为 undefined，检查 `kanban-worker-service.ts` 是否正确调用 `createAgentSession`

---

### 问题 4：跨渠道分配不符合预期

**可能原因**：
- `channelModelsGetter` 未正确注入
- `isKsccChannel` 判断错误
- `findModelChannel` 未实现

**排查步骤**：
1. 检查日志中的模型分配信息
2. 检查渠道配置：
   ```javascript
   const channels = await window.electronAPI.listChannels()
   console.log(channels.filter(ch => ch.enabled && ch.provider !== 'kscc-internal'))
   ```

---

## 3. 验收通过标准

| 场景 | 通过标准 | 备注 |
|------|---------|------|
| 草稿升级 → 团队 Tab | ✅ 左栏显示任务列表 | 核心功能 |
| 调度器派工 | ✅ 任务状态变化 | 30s tick |
| 点击任务 → AgentView | ✅ 显示工人对话 | 嵌套视图 |
| 跨渠道轮询 | ✅ 不同任务不同模型 | 外部看板 |
| kscc 禁止跳外部 | ✅ 拦截 + 回退 | 合规检查 |
| 依赖链 | ✅ A→B 顺序执行 | pending → ready |
| 托盘后台 | ✅ 关窗不停 | 长任务支持 |
| 重启恢复 | ✅ interrupted → ready | 持久化 |

---

## 4. 验收完成后

### 更新文档

```bash
# 更新 PROGRESS.md
在"当前状态"部分标注：
- ✅ 看板 v1 端到端验收通过
- ✅ Phase B 产品闭环完成
```

### 创建发布 PR

```bash
git add .
git commit -m "feat(kanban): v1 产品化完成 + 跨渠道模型分配改进"
git push origin feature/kanban-v1-productization
# 创建 PR 合入 main
```

---

## 5. 后续工作（Phase C）

验收通过后，下一步：

| 项 | 预估工时 |
|---|---------|
| kanban-notification-service | 1 天 |
| IM 里程碑推送 | 0.5 天 |
| Bridge 入站控制 | 0.5 天 |
| 角色库设置页完善 | 0.5 天 |

---

**最后更新**：2026-07-04 — 验收手册 v1.0，供后续工作日验证使用。