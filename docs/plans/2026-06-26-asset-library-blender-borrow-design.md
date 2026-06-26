# TA 资产库借鉴 Blender Asset Browser 设计

> 日期: 2026-06-26
> 状态: 设计探索阶段（开发待定）
> 关联: `docs/plans/2026-06-05-tagent-fusion-design.md` §5.5 / §14

## 背景

TA 模式的资产库当前是一个 SQLite 索引库（`~/.tagent/ta/tag_store/tags.db`），存储**原始美术资产的元数据**，而非 DCC 内部资产或引擎 uasset。Agent 在 TA 模式下需要查找、分析、入库美术资产，现有 schema 仅支持按类型/标签搜索，缺少：

- 逻辑目录树（Catalog）——美术资产物理路径混乱，但业务分类需求强烈
- 双路径追踪——同时展示原始资产路径与引擎入库路径
- 多库切换——项目库 / 团队共享库 / 个人临时库
- 入库状态机——原始资产变更后引擎侧未同步的可视化

Blender 的 Asset Browser 是 DCC 资产管理的事实标杆，但其设计前提是"DCC 内部资产容器"。TAgent 的场景是"原始美术资产索引 + 引擎入库路径追踪"，**不是同一个问题**。本文档讨论哪些设计可借鉴、哪些不适用、哪些需要 TAgent 独有扩展。

## 场景区分

| 维度 | Blender Asset Browser | TAgent TA 资产库 |
|------|----------------------|-----------------|
| 资产存放 | DCC 内部文件（.blend） | 原始美术文件（fbx/png/wav 等） |
| 引擎关系 | 无（Blender 本身就是 DCC） | 资产 → 引擎入库路径追踪 |
| 入库动作 | mark as asset（原地标记） | analyze_assets（扫描 + 写元数据 + 渲预览） |
| Spawn 体验 | 拖到 3D View 直接生成 | 不存在（库不存引擎资产） |
| 缩略图 | 视口渲染（按类型策略分发） | 原始资产预览（策略简单） |

**核心差异**：Blender 是"资产容器 + 编辑器一体化"，TAgent 是"索引台账 + 入库追踪"。借鉴时必须围绕后者场景。

## 当前 Schema 现状

**文件**: `F:/ta_agent/packages/tags/store.py:62`

```sql
CREATE TABLE assets (
    asset_id       TEXT PRIMARY KEY,
    asset_name     TEXT NOT NULL DEFAULT '',
    file_path      TEXT NOT NULL DEFAULT '',       -- 原始美术资产路径
    asset_type     TEXT NOT NULL DEFAULT '',
    category       TEXT NOT NULL DEFAULT '',
    subcategory    TEXT NOT NULL DEFAULT '',
    style          TEXT NOT NULL DEFAULT '',
    asset_condition TEXT NOT NULL DEFAULT '',
    tri_count      INTEGER NOT NULL DEFAULT 0,
    material_count INTEGER NOT NULL DEFAULT 0,
    has_materials  INTEGER NOT NULL DEFAULT 1,
    status         TEXT NOT NULL DEFAULT 'pending',
    analyzed_at    TEXT NOT NULL DEFAULT '',
    full_data      TEXT NOT NULL DEFAULT '{}'      -- 完整 AssetTags JSON
);
```

引擎入库路径当前由 `project_config.yaml` 的 `asset_types[].engine_path` 按类型推导，不在 `assets` 表中。

## 借鉴设计点

### 适用：值得借鉴

#### 1. Catalog 逻辑目录树（最高价值）

Blender 的 Catalog 独立于文件系统目录——一个资产可以属于 `Characters/Hero/Weapon`，物理文件可能在 `D:/Project/Raw/hero_sword.fbx`。

美术资产物理路径通常很乱（`D:/Art/Models/hero_v1.fbx`、`D:/Backup/old/hero_v2.fbx`），但业务上需要按 `Characters/Hero`、`Environment/Buildings` 等逻辑分类浏览。Catalog 树让用户按业务分类组织，不被物理路径绑架。

**特性**：
- Catalog 可拖拽重排，移动节点不动物理文件
- 一个资产只能属于一个 Catalog（Blender 实际支持多 catalog，但 TAgent 场景下单归属足够）
- Catalog 节点可被删除，下属资产回退到 `Uncategorized`

#### 2. 多 Library 切换

Blender 顶栏可切 `Current File / External / Custom Library`。映射到 TAgent：

- **项目库**：当前项目的资产索引（`~/.tagent/ta/tag_store/tags.db`）
- **团队共享库**：团队公共资产库（独立 SQLite 文件路径）
- **个人临时库**：临时扫描入库未归档

UI 顶部一个下拉切换，后端通过 SQLite 文件路径区分。

#### 3. 类型筛选

`assets.asset_type` 字段已存在，UI 加筛选 Tab/侧栏即可。Blender 左上角的 type 下拉就是这种交互——互斥筛选比 tag 叠加更清晰。

### 不适用：明确不借鉴

#### A. Append / Link 区分

Blender 区分"拷贝到当前文件"vs"引用外部文件"。UE5 资产全是 import，无此区分，强行加会困惑用户。

#### B. Library Overrides（关联编辑）

Blender 独有的关联资产就地覆盖机制，UE5 用 Material Instance / Blueprint 子类解决，机制完全不同。

#### C. Mark as Asset（手动标记）

Blender 让用户手动 mark object 为 asset。TAgent 的资产是 `analyze_assets` 自动扫描出来的，方向相反，**不可倒退成手动 mark**。

#### D. Drag & Drop Spawn 到 DCC

Blender 体验核心是拖到 3D View 直接 spawn。TAgent 库不存引擎资产，拖不到 UE5 Content Browser 直接 spawn。最多支持"复制原始路径"或"在 Content Browser 定位入库位置"。

#### E. 缩略图按类型复杂分发

原始美术资产的缩略图基本就是预览图（fbx 渲一张图、texture 直接用本身、audio 用波形），策略简单，不需要 Blender 那种"每种类型一个 ThumbnailGenerator 策略类"的复杂度。

### TAgent 独有扩展（Blender 没有，但本场景必需）

#### 4. Source Linked 双路径显示（最该学）

Blender Asset Browser 的核心 UX 是同时显示**资产本身**和**它的来源**。TAgent 场景下每个资产卡片同时显示两个路径：

```
┌─────────────────────────────────┐
│ [缩略图] HeroCharacter          │
│         SM_Hero_Main            │
│         ─────────────           │
│         📁 D:/Art/Models/hero.fbx │  ← 原始
│         🎮 /Game/Characters/Hero │  ← 引擎入库
└─────────────────────────────────┘
```

用户一眼看到"这个资产从哪来到哪去"。当前 schema 缺 `engine_path` 字段，需要加。

#### 5. Catalog → 引擎入库路径默认映射

这是 Blender 没有的、独属于"索引库"场景的设计：Catalog 逻辑路径可以默认映射到引擎入库路径前缀。

```
Catalog: Characters/Hero
  → 默认 engine_path: /Game/Characters/Hero/
  → 用户可覆盖单个资产的 engine_path
```

这样**移动 Catalog 节点时，新入库的资产自动落到对应引擎目录**。覆盖了"原始索引 + 引擎入库路径"的两个核心字段，且让两者保持逻辑一致。

`engine_path` 留空时用 Catalog 默认兜底——保留"按类型推导"的简单性，同时给单资产覆盖空间。

#### 6. Import Status 状态机

Blender 有 "Asset missing source" 状态。TAgent 库更需要——原始资产和引擎入库是两个独立文件，会脱钩：

| 状态 | 含义 | 触发条件 |
|------|------|---------|
| `not_imported` | 原始资产已分析，未入库 | analyze_assets 完成、未触发入库 |
| `imported` | 已入库，原始与引擎一致 | ue5_import_asset 成功后回写 |
| `source_changed` | 原始资产变更，引擎侧未同步 | 下次 analyze_assets 时 hash 不匹配 |
| `engine_path_moved` | 引擎侧资产被移动 | 引擎扫描时找不到原 path |
| `missing` | 原始资产文件丢失 | file_path 不存在 |

`analyze_assets` 时 hash 原始文件，下次扫描对比就能发现 `source_changed`。这是 Blender 没做的、但索引库必须做的。

## Schema 改动建议

```sql
-- assets 表新增字段
ALTER TABLE assets ADD COLUMN catalog_path TEXT NOT NULL DEFAULT '';
ALTER TABLE assets ADD COLUMN engine_path TEXT NOT NULL DEFAULT '';       -- 单资产覆盖，空则用 catalog 默认
ALTER TABLE assets ADD COLUMN source_hash TEXT NOT NULL DEFAULT '';       -- 原始文件 hash，用于检测变更
ALTER TABLE assets ADD COLUMN import_status TEXT NOT NULL DEFAULT 'not_imported';
ALTER TABLE assets ADD COLUMN thumbnail_path TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_catalog_path ON assets(catalog_path);
CREATE INDEX IF NOT EXISTS idx_import_status ON assets(import_status);

-- Catalog 表
CREATE TABLE IF NOT EXISTS catalogs (
    path TEXT PRIMARY KEY,                  -- 'Characters/Hero'
    default_engine_path TEXT NOT NULL DEFAULT '',  -- '/Game/Characters/Hero/'
    parent_path TEXT NOT NULL DEFAULT '',    -- 'Characters'，根为 ''
    display_name TEXT NOT NULL DEFAULT '',   -- 'Hero'
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_catalogs_parent ON catalogs(parent_path);
```

**字段说明**：

- `catalog_path`：资产的逻辑归属，空表示 `Uncategorized`
- `engine_path`：单资产覆盖的引擎路径，空时 UI 用 `catalogs.default_engine_path` 兜底
- `source_hash`：原始文件内容 hash（非路径 hash），用于检测 `source_changed`
- `import_status`：状态机字段
- `thumbnail_path`：缩略图缓存路径，与 `render_asset_preview` 工具产物对接

## UI 交互设计（草图）

```
┌──────────────────────────────────────────────────────────────────┐
│ [Library: MainProject ▾]  [Type: All ▾]  [搜索...]  [刷新]      │
├─────────────────┬────────────────────────────────────────────────┤
│ 📁 Catalogs     │  资产列表                                          │
│ ├ Characters    │  ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│ │ ├ Hero        │  │ [thumb]  │ │ [thumb]  │ │ [thumb]  │         │
│ │ └ NPC         │  │ Hero     │ │ NPC_Guard│ │ Weapon_Sword      │
│ ├ Environment   │  │ imported │ │ src_chg  │ │ not_imported      │
│ │ ├ Buildings   │  └─────────┘ └─────────┘ └─────────┘         │
│ │ └ Props       │                                                    │
│ ├ Weapons       │  状态徽章颜色：                                    │
│ └ Uncategorized │  🟢 imported  🟡 source_changed  🔵 not_imported  │
│                  │  🔴 missing   🟠 engine_path_moved                │
│ [+ New Catalog]  │                                                    │
│ [⚙ Config]      │                                                    │
└─────────────────┴────────────────────────────────────────────────┘
```

**资产详情面板**（点击资产卡片）：

```
┌──────────────────────────────────────────┐
│ [大缩略图]                                │
│                                          │
│ HeroCharacter                            │
│ Type: Skeletal Mesh                      │
│ Status: 🟢 imported                      │
│ Catalog: Characters/Hero                 │
│                                          │
│ ── 路径 ──                              │
│ 📁 D:/Art/Models/hero_v2.fbx            │
│ 🎮 /Game/Characters/Hero/SM_Hero_Main   │
│                                          │
│ ── 元数据 ──                            │
│ 三角面: 24,532                           │
│ 材质数: 3                                │
│ 风格: sci-fi                            │
│                                          │
│ [在 Content Browser 定位] [重新入库]    │
└──────────────────────────────────────────┘
```

**Catalog 树操作**：
- 拖拽节点重排（更新 `parent_path`）
- 右键菜单：New / Rename / Delete / Set Default Engine Path
- 拖拽资产到 Catalog 节点 → 更新 `assets.catalog_path`
- 删除 Catalog 节点 → 下属资产 `catalog_path` 清空，归到 `Uncategorized`

## 落地优先级（待开发时参考）

| 优先级 | 改动 | 工作量 | 价值 |
|--------|------|--------|------|
| P0 | `engine_path` + `import_status` 字段 + 双路径显示 | 1-2 天 | 高（覆盖核心 UX） |
| P0 | Import Status 状态机 + `source_hash` 检测 | 2-3 天 | 高（解决资产漂移痛点） |
| P1 | Catalog 表 + 树 UI + 拖拽 | 3-5 天 | 高（业务分类刚需） |
| P1 | Catalog → 引擎入库路径默认映射 | 1-2 天 | 中（依赖 P1 Catalog） |
| P2 | 多 Library 切换 | 2-3 天 | 中（团队协作场景） |
| P2 | 类型筛选 Tab | 0.5-1 天 | 低（基础设施已具备） |

**MVP 最小集**：P0 两项即可让现有库从"单路径索引"升级到"双路径追踪 + 状态机"，约 3-5 天。Catalog 相关 P1 留作下一阶段。

## 待定问题

1. **Catalog 是否支持多归属**：当前设计单归属（一个资产一个 `catalog_path`），是否需要多对多关系表？业务上是否有同一资产属于多个分类的需求？
2. **团队共享库同步机制**：多 Library 切换后，共享库是只读还是可写？写入如何同步给团队成员？
3. **`source_changed` 自动检测时机**：是每次打开资产库时全量扫描，还是 `analyze_assets` 工具显式调用时？前者体验好但耗性能。
4. **`engine_path_moved` 检测依赖**：需要 UE5 桥接定期扫描 Content Browser，频率如何？是否需要订阅 UE5 资产移动事件？
5. **Catalog 与 `project_config.yaml` 的关系**：现有 `asset_types[].engine_path` 是按类型推导，引入 Catalog 默认路径后，两者优先级如何？建议 Catalog 默认 > 类型默认 > 全局默认。

## 不在本设计范围

- 资产预览渲染策略（已有 `render_asset_preview` 工具）
- 资产分析 ML 模型（已有 `analyze_assets` 工具）
- UE5 桥接具体协议（已有 `ue5_import_asset` / `ue5_configure_asset` 工具）
- 资产审核工作流（独立模块）
- 资产版本控制（git-lfs 集成等）

## 参考

- Blender Asset Browser 设计：https://docs.blender.org/manual/en/latest/editors/asset_browser.html
- Blender 源码：https://projects.blender.org/blender/blender（`source/blender/editors/asset/`）
- 当前 schema：`F:/ta_agent/packages/tags/store.py:62`
- 项目配置：`F:/ta_agent/.ta_agent/configs/project/MainProject.yaml`
- 融合设计：`docs/plans/2026-06-05-tagent-fusion-design.md` §5.5 / §14
