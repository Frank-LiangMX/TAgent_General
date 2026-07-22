# CSV 数据分析看板工具设计

> 状态：Draft
> 日期：2026-07-22
> 关联：TAgent Desktop, TAgent Inspector
> 参考：F:\StatsCheckBorad（现有资产分析看板项目）

## 1. 目标

让 TAgent 的 agent 能够：

1. 读取任意格式的 CSV 文件，自动理解列结构和数据特征
2. 根据数据特征和用户意图，智能决定分析维度
3. 生成交互式 Web 数据看板（图表 + 可筛选表格 + 分页浏览）
4. 支持 100 万行级别的大数据 CSV（SQLite 加速）
5. 多轮对话中持续查询和更新看板
6. 不同用户关注不同维度，agent 实时生成对应看板

### 1.1 不做什么

- 不做固定模板 — agent 根据 CSV 结构动态决定看什么
- 不做 Streamlit 依赖 — 生成自包含 HTML，无需额外服务器
- 不做实时数据同步 — CSV 是静态快照，变更后重建缓存
- **P0 不做全局角色卡** — 角色切换机制独立设计，本阶段通过 agent 内部约束实现

## 2. 架构概览

```
用户对话: "分析 xxx.csv"
        ↓
   Agent 意图理解
        ↓
   ┌─ csv_prepare ─→ SQLite 建库 + 列分析
   │
   ├─ csv_query ───→ 按维度聚合/筛选/排序
   │
   └─ csv_dashboard → 生成 HTML 看板 → Inspector 预览 tab 显示
```

### 2.1 工具清单

| 工具 | 层 | 功能 |
|------|---|------|
| `csv_prepare` | TAgent TypeScript | CSV → SQLite，建索引，返回结构摘要 |
| `csv_query` | TAgent TypeScript | 按 agent 指定维度查询/聚合 |
| `csv_dashboard` | TAgent TypeScript | 接收配置 → 生成 HTML 看板 |

### 2.2 数据流

```
CSV 文件 (磁盘)
    ↓ csv_prepare (pandas + sqlite3)
SQLite 数据库 (%LOCALAPPDATA%/TAgent/csv-cache/{session_id}/)
    ↓ csv_query (SQL)
聚合结果 JSON (agent context)
    ↓ csv_dashboard (模板渲染)
自包含 HTML 文件 (磁盘)
    ↓ Inspector BrowserPanel 显示
浏览器展示
```

## 3. 工具详细设计

### 3.1 csv_prepare

**职责**：读取 CSV，建立 SQLite 数据库，返回结构信息。

**输入**：

```json
{
  "path": "C:\\Users\\xxx\\Downloads\\进包被引用资源.csv",
  "session_id": "ses_abc123"
}
```

**处理流程**：

1. 检查缓存：`%LOCALAPPDATA%/TAgent/csv-cache/{session_id}/meta.json`
   - 存在且 CSV 修改时间未变 → 直接返回缓存摘要
   - 不存在或 CSV 已变 → 进入步骤 2
2. 读取 CSV（pandas，自动检测编码和分隔符）
3. 自动推断列类型：
   - 字符串列 → 分类维度（可 groupby）
   - 数值列 → 度量（可 sum/avg/max/min）
   - 布尔/0-1 列 → 标记
4. 建 SQLite 数据库，列名标准化
5. 建索引：每个分类列 + compress 列
6. 计算统计摘要
7. 写入缓存 meta.json

**输出**：

```json
{
  "status": "ready",
  "row_count": 1000000,
  "file_size_mb": 123.0,
  "columns": [
    {"name": "path", "type": "text", "role": "dimension", "unique_count": 998234},
    {"name": "owner", "type": "text", "role": "dimension", "unique_count": 5, "values": ["场景数据", "程序资产", "美术资产"]},
    {"name": "fcat", "type": "text", "role": "dimension", "unique_count": 12, "top_values": {"贴图": 450000, "模型": 200000}},
    {"name": "mod", "type": "text", "role": "dimension", "unique_count": 38},
    {"name": "scene_count", "type": "integer", "role": "metric", "min": 0, "max": 156, "mean": 3.2},
    {"name": "compress", "type": "integer", "role": "metric", "min": 0, "max": 115614000, "sum": 128000000000}
  ],
  "overview": {
    "total_assets": 1000000,
    "total_bytes": 128000000000,
    "single_use_count": 230000,
    "reused_count": 450000
  },
  "db_path": "C:\\Users\\xxx\\AppData\\Local\\TAgent\\csv-cache\\ses_abc123\\data.sqlite3"
}
```

### 3.2 csv_query

**职责**：按 agent 指定的维度对 SQLite 数据进行聚合、筛选、排序。

**聚合查询输入**：

```json
{
  "session_id": "ses_abc123",
  "groupby": "fcat",
  "agg": ["count", "sum(compress)", "avg(compress)"],
  "filters": [
    {"column": "owner", "op": "=", "value": "场景数据"},
    {"column": "compress", "op": ">", "value": 1048576}
  ],
  "sort": "sum_compress",
  "sort_dir": "desc",
  "limit": 20
}
```

**明细查询输入**（不 groupby）：

```json
{
  "session_id": "ses_abc123",
  "filters": [
    {"column": "fcat", "op": "=", "value": "贴图"},
    {"column": "compress", "op": ">", "value": 10485760}
  ],
  "select": ["path", "owner", "fcat", "mod", "scene_count", "compress"],
  "sort": "compress",
  "sort_dir": "desc",
  "limit": 50,
  "offset": 0
}
```

**输出**：

```json
{
  "query": "SELECT fcat, COUNT(*) AS count, SUM(compress) AS sum_compress FROM assets WHERE owner='场景数据' AND compress>1048576 GROUP BY fcat ORDER BY sum_compress DESC LIMIT 20",
  "row_count": 12,
  "columns": ["fcat", "count", "sum_compress"],
  "rows": [
    {"fcat": "贴图", "count": 180000, "sum_compress": 45000000000},
    {"fcat": "模型", "count": 85000, "sum_compress": 28000000000}
  ],
  "total_before_limit": 12
}
```

### 3.3 csv_dashboard

**职责**：接收看板配置，生成自包含 HTML 文件。

**action 说明**：

| action | 说明 |
|--------|------|
| `create` | 创建新的单页看板（含总览视图） |
| `add_view` | 向现有看板追加一个视图（聚焦/钻取） |
| `replace_view` | 替换现有视图的内容 |

**支持的 section 类型**：

| type | 说明 | 图表库 |
|------|------|--------|
| `stats` | 顶部统计卡片 | 纯 HTML |
| `chart.pie` | 饼图/环形图 | Chart.js |
| `chart.bar` | 柱状图 | Chart.js |
| `chart.horizontal_bar` | 水平柱状图 | Chart.js |
| `chart.stacked_bar` | 堆叠柱状图 | Chart.js |
| `table` | 可排序/分页表格 | 纯 JS |

**输出**：

```json
{
  "status": "ok",
  "file_path": "C:\\Users\\xxx\\AppData\\Local\\TAgent\\csv-cache\\ses_abc123\\dashboard.html",
  "url": "file:///C:/Users/xxx/AppData/Local/TAgent/csv-cache/ses_abc123/dashboard.html",
  "view_count": 2
}
```

## 4. 数据管理

### 4.1 缓存目录结构

```
%LOCALAPPDATA%/TAgent/csv-cache/
  ├── {session_id}/
  │   ├── data.sqlite3          ← SQLite 数据库
  │   ├── data.sqlite3-wal      ← WAL 日志
  │   ├── meta.json             ← 缓存元信息 + 已生成视图列表
  │   └── dashboard.html        ← 单页看板（SPA，含多视图）
```

每个 session 只有一个 `dashboard.html`，通过 `add_view` 持续追加视图。

### 4.2 缓存失效条件

- CSV 文件修改时间变化 → 重建
- schema_version 变化 → 重建
- 用户手动清理 → 删除

### 4.3 SQLite 表结构

```sql
CREATE TABLE assets (
    id INTEGER PRIMARY KEY,
    -- 动态列，由 csv_prepare 根据 CSV 结构创建
    -- 分类列: TEXT 类型
    -- 数值列: INTEGER 类型
);
CREATE INDEX idx_assets_{col} ON assets({col});
CREATE TABLE meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

## 5. 看板架构

### 5.1 单页应用（SPA）架构

总览看板和聚焦视图在同一个 HTML 文件中，通过 JS 切换视图。左侧导航栏按维度分组（按模块/按类型/按归属），点击切换。

### 5.2 图表点击钻取

总览图表的 segment 可点击，预埋数据，点击后切换到对应聚焦视图。图表使用 Chart.js，通过 onClick 事件处理钻取。

### 5.3 视图生成策略

| 视图类型 | 生成策略 |
|---------|---------|
| 总览 | 首次 create 时预生成 |
| Top-N 聚焦 | 预生成前 5-10 个分类 |
| 剩余分类 | 按需生成，首次点击时调 agent 生成，之后缓存 |
| 优化机会 | 按需生成 |

## 6. TAgent 内交互设计

### 6.1 两种看板类型

| | 持久看板（SPA） | 临时 AI 画布 |
|---|---|---|
| 生成方式 | `csv_dashboard` 工具生成 HTML | Agent 直接输出 markdown 文本 |
| 内容 | 多 section：图表 + 可排序表格 | 单个图表/表格/文字描述 |
| 交互 | 排序、筛选、分页、图表点击 | 无 |
| 生命周期 | 持久，可反复查看 | 临时，随对话消失 |

Agent 自动判断用哪个：维度少（1-2 个聚合）→ markdown；维度多（3+ 聚合）→ HTML 看板。

### 6.2 典型对话流程

```
用户: "帮我分析 C:\Users\xxx\Downloads\进包被引用资源.csv"
Agent: [调 csv_prepare] → 返回列信息 + 统计摘要
Agent: "已加载 100 万行。可用维度: owner/fcat/mod/scene_count/compress
        总体积 122MB，23% 资源仅单场景使用。你想看什么？"

用户: "出个总览看板"
Agent: [调 csv_query × 3-4 次] → 各维度聚合数据
Agent: [调 csv_dashboard action="create"] → 生成 HTML
Agent: "看板已生成: [链接]  摘要：贴图占比 45%，小地图体积最高..."

用户: "看看植被所有维度"
Agent: [并行调 csv_query × 5，filter mod=植被] → 各维度聚合
Agent: [调 csv_dashboard action="add_view" view_id="focus-植被"]
Agent: "已添加植被聚焦视图，点击左侧导航切换"

用户: "把资源类型分布改成柱状图"
Agent: [读取当前 config] → 修改 chart_type
Agent: [调 csv_dashboard action="replace_view" view_id="overview"]
Agent: "已更新，刷新页面查看"

用户: "列出所有贴图类超过 10MB 的"
Agent: [调 csv_query filter={fcat=贴图, compress>10MB}] → 明细
Agent: "共 47 个，最大: data/.../map_a.tga 15.2MB [查看明细看板]"
```

### 6.3 修改看板策略

全量重新生成，不增量编辑 HTML。生成完整看板 <1 秒，每次生成新文件（覆盖 dashboard.html）。

## 7. 数据严谨性

### 7.1 反幻觉机制

数据问题不能有幻觉。agent 必须通过 `csv_query` 查询真实数据，不能估算或猜测数字。

**强制约束**：
1. 所有涉及数据的问题必须调用 `csv_query` 查询
2. 不得使用"大概"、"估计"、"可能"等模糊词描述数据
3. 回答必须包含查询语句和查询结果
4. 无法回答时说"需要查询数据"而不是猜测

### 7.2 实现方式

P0 阶段通过 agent 系统提示词约束实现（csv_prepare 成功后追加数据模式指令）。P1 阶段通过全局角色卡机制实现（加载数据分析师角色）。

## 8. 集成点

### 8.1 TAgent Desktop 工具层

CSV 分析是**通用功能**，不绑定 TA 模式。作为独立的内置工具注册，和 web-search、nano-banana 同级：

```
apps/electron/src/main/lib/tools/
  ├── csv-prepare-tool.ts      ← 新建
  ├── csv-query-tool.ts        ← 新建
  └── csv-dashboard-tool.ts    ← 新建
```

在 `tool-registry.ts` 的 `BUILTIN_TOOLS` 数组中注册，Chat 模式和 Agent 模式都可用。

### 8.2 Inspector 集成（P2 阶段才需要）

P0-P1 阶段不需要改 Inspector 代码。P2 阶段需要：

- `apps/electron/src/main/lib/hooks/useGlobalAgentListeners.ts` — 监听 `csv_dashboard_open` 事件
- Inspector BrowserPanel 加载看板 URL

### 8.3 看板显示

- **阶段 1（MVP）**：外部浏览器打开
- **阶段 2**：BrowserPanel 集成（Inspector 预览 tab）
- **阶段 3**：专用 Dashboard Tab

## 9. 实现阶段

### P0：核心工具 + 基础看板

**目标**：agent 能加载任意 CSV 并生成可浏览的 HTML 看板

**工作项**：

| # | 工作 | 说明 |
|---|------|------|
| 1 | `csv-prepare-tool.ts` | CSV 读取、列类型推断、SQLite 建库、建索引、缓存管理 |
| 2 | `csv-query-tool.ts` | SQL 查询构建（groupby/filter/sort/limit/offset） |
| 3 | `csv-dashboard-tool.ts` | HTML 模板渲染（stats/chart/table sections）、SPA 架构 |
| 4 | tool-registry.ts 注册 | 注册到 BUILTIN_TOOLS，Chat/Agent 模式都可用 |
| 5 | agent 系统提示词约束 | csv_prepare 成功后追加数据严谨性指令 |

**验收标准**：

```
✅ 输入: csv_prepare(path="进包被引用资源.csv", session_id="test")
   期望: 返回 columns + overview，耗时 <5s（100万行）

✅ 输入: csv_query(session_id="test", groupby="fcat", agg=["count","sum(compress)"])
   期望: 返回聚合结果 JSON，耗时 <200ms

✅ 输入: csv_dashboard(action="create", title="资源分析", views=[...])
   期望: 生成 dashboard.html，浏览器打开可看到图表+表格

✅ 重复加载同一 CSV → 命中缓存，<100ms 返回

✅ Agent 调用工具后不出现幻觉数字（回答包含查询依据）
```

**产出物**：
- `apps/electron/src/main/lib/tools/csv-prepare-tool.ts`
- `apps/electron/src/main/lib/tools/csv-query-tool.ts`
- `apps/electron/src/main/lib/tools/csv-dashboard-tool.ts`
- 更新 `apps/electron/src/main/lib/tool-registry.ts`（注册新工具）

---

### P1：交互增强 + 多视图

**目标**：看板支持浏览器端交互，支持聚焦视图追加

**工作项**：

| # | 工作 | 说明 |
|---|------|------|
| 1 | 表格排序/分页/搜索 | 纯 JS 实现，列头点击排序、分页导航、路径搜索框 |
| 2 | add_view / replace_view | csv_dashboard 支持向现有 HTML 追加/替换视图 |
| 3 | 图表点击钻取 | 总览图表 segment 点击 → 切换到聚焦视图 |
| 4 | 侧边栏导航 | 按维度分组的可折叠导航（按模块/按类型/按归属） |
| 5 | 多视图状态管理 | meta.json 记录已生成视图，避免重复生成 |

**验收标准**：

```
✅ 总览看板表格可排序（点击列头）、可翻页（上一页/下一页）、可搜索（输入路径过滤）

✅ 用户说"看看植被" → agent 调 add_view → 侧边栏出现"植被"导航项 → 点击切换

✅ 总览饼图点击"植被"切片 → 自动切换到植被聚焦视图

✅ 已生成的聚焦视图再次点击 → 直接显示，不重新生成

✅ Dashboard HTML 在浏览器中可独立运行（不依赖后端服务器）
```

**产出物**：
- 更新 `csv_dashboard.py`（add_view/replace_view 逻辑）
- 更新 HTML 模板（JS 交互代码）
- 更新 `meta.json` 视图追踪

---

### P2：Desktop 集成 + 临时画布

**目标**：看板在 TAgent Inspector 内显示，支持临时 AI 画布

**工作项**：

| # | 工作 | 说明 |
|---|------|------|
| 1 | BrowserPanel 集成 | agent 触发时自动切换 Inspector 预览 tab 并加载 URL |
| 2 | agent 事件处理 | useGlobalAgentListeners 监听 csv_dashboard_open 事件 |
| 3 | 临时 AI 画布 | Agent 直接输出 markdown → 渲染到 Inspector 某面板 |
| 4 | markdown 渲染器 | Agent 返回的 markdown 转 HTML（表格、代码块、列表） |

**验收标准**：

```
✅ agent 调用 csv_dashboard 后 → Inspector 预览 tab 自动切换到看板页面

✅ 用户问"植被大文件都有哪些" → Agent 返回 markdown 表格 → Inspector 内渲染

✅ 临时 AI 画布的 markdown 包含表格时 → 表格正确渲染

✅ 用户关闭 Inspector 预览 tab → 不影响看板文件
```

**产出物**：
- 更新 `useGlobalAgentListeners.ts`
- 更新 `BrowserPanel.tsx`（支持 agent 设置 URL）
- markdown 渲染组件

---

### P3：全局角色卡（独立设计）

**目标**：主会话支持角色切换，数据处理时自动加载数据分析师角色

**工作项**：

| # | 工作 | 说明 |
|---|------|------|
| 1 | 主会话角色卡 UI | 界面常驻角色卡片，显示当前角色图标+名称 |
| 2 | 角色切换 API | switch_role(role_id) → 重组 system prompt |
| 3 | 数据分析师角色增强 | 补充 CSV 工具使用的具体约束 |
| 4 | 角色切换检测 | Agent 检测用户意图切换角色 |
| 5 | 会话状态管理 | 角色切换时保持上下文连续 |

**验收标准**：

```
✅ 新建会话 → 默认显示"通用执行者"角色卡

✅ 加载 CSV 后 → 角色卡切换为"数据分析师"，agent 行为变化

✅ 用户说"切换回通用模式" → 角色卡恢复，agent 恢复通用行为

✅ 角色切换不丢失已加载的 CSV 数据
```

**注意**：P3 依赖角色库扩展，独立于 P0-P2，可以并行设计。
