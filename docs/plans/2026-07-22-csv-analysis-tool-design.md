# CSV 数据分析看板工具设计

> 状态：**Implemented**（2026-07-22 收尾）
> 分支：`feature/csv-analysis-tool`
> 关联：TAgent Desktop 统一预览 / 右栏 Inspector
> 参考：内网看板 `prototypes/ref-stats-dashboard.html`（原 StatsCheckBorad）

## 1. 目标

让 Agent 能：

1. 读取任意 CSV → SQLite 缓存（百万行级）
2. 一键生成多视图交互看板（总览 / 交叉 / 明细）
3. 多轮对话中改单位、加临时专注页、固化视图，而**不考古 HTML**
4. 在统一预览（分屏 Preview + 右栏「预览」）中打开 live URL

### 1.1 不做什么

- 不做固定业务模板（维度由 `preset=auto` + 列语义打分推断）
- 不做 Streamlit / 独立前端工程
- 不做 CSV 实时同步（mtime 变则 `csv_prepare` 重建）
- **不做全局角色卡**（原 P3，独立路线）
- **不做临时 markdown 画布**（原 P2 可选；表格答案走聊天气泡即可）
- 图表点击**不**切独立 focus 视图：钻取 = 明细 filter + drill-bar（见 §5）

## 2. 架构

```
用户对话
   ↓
csv_prepare  →  ~/.tagent(-dev)/csv-cache/{csvSessionId}/data.sqlite3 + meta.json
csv_query    →  聚合 JSON（定制分析时）
csv_dashboard→  {csvSessionId}-dashboard/dashboard.html + live server
   ↓
openCsvDashboard → PreviewFile(kind=web) / UniversalPreviewPanel
```

### 2.1 工具

| 工具 | 职责 |
|------|------|
| `csv_prepare` | CSV → SQLite；同 path+mtime 命中缓存 |
| `csv_query` | groupby / filter / agg / sort |
| `csv_dashboard` | create / patch / live_tab / slice / add_view / replace_view |

### 2.2 路径约定

| 用途 | 路径 |
|------|------|
| CSV 缓存 | `~/.tagent(-dev)/csv-cache/{csvSessionId}/` |
| 看板 HTML | `~/.tagent(-dev)/csv-cache/{csvSessionId}-dashboard/dashboard.html` |
| 产物记忆 | `~/.tagent(-dev)/agent-sessions/csv-artifacts/{agentSessionId}.json` |
| Live sticky | 缓存目录内 `live.json`（端口） |

开发模式 `TAGENT_DEV=1` → `.tagent-dev`。

### 2.3 Prompt Cache

- 工具说明进 tool schema / `systemPromptAppend`（稳定）
- **动态**产物列表只进 user message：`buildDynamicContext` → `<csv_artifacts>`
- 禁止为 CSV 中途改 system prompt / 增删工具集

## 3. `csv_dashboard` 动作分流

| 用户意图 | Action | 落盘？ |
|----------|--------|--------|
| 首次分析 / 重建底盘 | `create` + `preset=auto` + `live=true` | ✅ HTML |
| 改单位 / 标题 | `patch` + `byte_unit` | ✅ 重刷展示，**不** prepare |
| 「看贴图 / 专注植被」 | `live_tab` 或 `slice`（默认） | ❌ 内存 AI Tab |
| 「固化到看板」 | `slice(persist=true)` | ✅ add_view / replace_view |
| 改某一落盘页结构 | `replace_view` / 合法 `create` | ✅ |
| 删临时页 | `live_tab_action=remove\|clear_all` | 内存 |

**硬规则：**

- create 的 `*_json` 必须是 **sections**（stats/chart/table…），禁止塞 query 风格对象；不合规则报错且**不覆盖**已有 HTML
- 禁止为「改成 MB」Read/Edit `dashboard.html`
- 不确定改底盘还是临时页 → **先问用户**

### 3.1 内存 AI Tab

- 实现：`csv-live-tabs.ts` + live `/api/live-tabs`
- 底盘 HTML 挂载 `#ai-live-tabs` / `#ai-live-views`；load 时 fetch
- 用户手动刷新清空；程序化 reload 带 `?keep_live=1` 保留
- Tab 软上限与落盘视图共用 `MAX_DASHBOARD_VIEWS`（10）

### 3.2 产物记忆

- `csv-artifact-service`：每 Agent 会话最近 5 个看板摘要
- 删 Agent 会话 → `clearAgentSessionCsvCache`（停 live + 删索引中的 cache/dashboard 目录）

## 4. 预览集成

- 身份：`csvSessionId` + `file_path`；URL 由 `csv:ensure-live-server` 派生
- 入口：`openCsvDashboard()` → `openUrlPreview`（分屏与右栏读同一 `previewFileMapAtom`）
- webview：`WebPreviewFrame`（ERR_ABORTED 恢复、同 base URL 不 thrash `src`）
- 右栏布局按 **Agent sessionId** 持久化（开合 / 宽度 / 独占等）

## 5. 看板交互（已实现）

- 多视图 Tab + 侧栏导航
- 明细 live `/api/rows` + 筛选面板
- **热力图**（`type=heatmap`）格子/行头点击钻取
- **多级钻取**：图表/卡片/热力图点击 → `drillStack` 合并 filter → 明细表；`#drill-bar` 面包屑 + 清除
- 字节列按 `body[data-byte-unit]` 格式化

> 钻取语义定稿：过滤明细，**不是**打开独立 focus 视图。临时分类页用 `live_tab`。

## 6. 验收清单（收尾）

```
✅ csv_prepare → 缓存命中 / mtime 变更重建（单测）
✅ create(preset=auto|standard, live) → 多视图 + /api/rows
✅ create 拒绝 query 风格 sections，且不覆盖已有 HTML
✅ slice 默认 ephemeral live_tab；persist=true 落盘且同 id replace
✅ patch 改 byte_unit，hint 标明未 prepare
✅ 产物记忆 + 删会话清缓存
✅ 统一预览打开 live URL
✅ 图表/热力图钻取 + drill-bar

⏭ 可选（非本阶段）：临时 markdown 画布、百万行 CI 门槛、角色卡
```

## 7. 关键文件

| 区域 | 路径 |
|------|------|
| 工具 | `apps/electron/src/main/lib/tools/csv-*.ts` |
| 产物记忆 | `apps/electron/src/main/lib/csv-artifact-service.ts` |
| MCP schema | `apps/electron/src/main/lib/agent-orchestrator.ts` |
| 提示词 | `apps/electron/src/main/lib/agent-prompt-builder.ts`（`CSV_ANALYSIS_INSTRUCTIONS`） |
| 打开预览 | `apps/electron/src/renderer/lib/open-csv-dashboard.ts` |
| 结果卡 | `.../tool-result-renderers/csv-dashboard-result.tsx` |
| 测试 | `csv-shared.test.ts` / `csv-prepare-tool.test.ts` / `csv-*-*.test.ts` |

## 8. 历史阶段（归档）

原 Draft 把工作拆成 P0 核心工具 / P1 增量视图 / P2 Desktop / P3 角色卡。  
P0–P1 与 P2 预览部分已落地；P2 markdown 画布与 P3 角色卡移出本能力范围。
