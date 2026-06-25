# TAgent Server 设计文档

> **状态**：Draft v0.1  
> **日期**：2026-06-05  
> **作者**：Proma Agent（与用户 Frank Danny 共同设计）  
> **路径**：`F:\TAgent_General\docs\plans\2026-06-05-tagent-server-design.md`  
> **关联设计**：`docs/plans/2026-06-05-tagent-fusion-design.md`（TAgent Desktop）

---

## 1. 目标

为 TAgent Desktop 提供**公司内网部署的 metadata 同步服务**：

- 多个员工的 TA 模式共享资产元数据
- SSO 复用公司现有账号体系
- 资产文件仍由 SVN 管理，server **不碰文件**
- Local 优先，server 是 metadata 权威源

**不是目标**：

- ❌ 替换 SVN
- ❌ 上传 / 存储资产文件本体
- ❌ 多人协作编辑（实时合并 / OT / CRDT）
- ❌ 通用多租户 SaaS

---

## 2. 已拍板的关键决策

| #   | 决策点      | 选择                                                                                  |
| --- | ----------- | ------------------------------------------------------------------------------------- |
| 1   | 鉴权        | **复用公司内部 SSO**（`<INTERNAL_SSO_DOMAIN>`，AES 加密本地配置）            |
| 2   | 同步范型    | **Server 是 metadata 权威源**（client push → server 确认 → 通知其他 client pull）     |
| 3   | 资产文件    | **不上传**（SVN 管文件本体）                                                          |
| 4   | 资产 ID     | **SVN 路径 + 文件 hash 前缀**（`"Assets/Hero/SK_Hero_01.fbx::a3f2e1"`，本地可独立算） |
| 5   | 项目结构    | **独立项目**（与 TAgent Desktop 并行）                                                |
| 6   | Server 形态 | **Python FastAPI + Postgres + Docker**（公司内网单机部署）                            |
| 7   | 实时性      | **WebSocket 推送变更通知**（不是轮询）                                                |
| 8   | 冲突解决    | **Server-wins**（按 metadata updated_at；状态机强顺序）                               |
| 9   | Sync 位置   | **嵌入 TAgent Desktop 主进程**（不独立打包，共享 Python 虚拟环境）                    |
| 10  | 通用模式    | **不参与**（通用模式永远离线）                                                        |

---

## 3. 架构总览

```
┌─────────────────────────────────────────────────────────┐
│ 公司内网: TAgent Server (Docker)                         │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  FastAPI                                            │ │
│  │  ├─ /api/auth/*  (SSO 验 token)                     │ │
│  │  ├─ /api/sync/*  (push/pull/full)                   │ │
│  │  ├─ /api/asset/* (CRUD + search, 部分走 MCP)       │ │
│  │  ├─ /api/convention/* (版本化)                      │ │
│  │  ├─ /api/project/* (项目列表, 来自 SSO 用户组)      │ │
│  │  └─ /ws         (WebSocket 推送)                    │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Postgres                                            │ │
│  │  ├─ asset_metadata (含 svn_path)                     │ │
│  │  ├─ asset_search_vector (tsvector + GIN)             │ │
│  │  ├─ convention_versions (版本化)                    │ │
│  │  ├─ sync_state (每个 user+device 一行)               │ │
│  │  └─ audit_log (所有变更审计)                         │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Blob 存储 (本地挂载 volume)                         │ │
│  │  ├─ previews/{asset_id}.png                        │ │
│  │  └─ 缩略图, 几 KB ~ 几百 KB                         │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
              ▲  ▲  ▲ HTTPS + WebSocket (内网)
              │  │  │
   ┌──────────┘  │  └──────────┐
   │             │             │
┌──┴──────────┐ ┌┴────────────┐ ┌┴────────────┐
│ 员工 A PC   │ │ 员工 B PC   │ │ 员工 C PC   │
│ TAgent      │ │ TAgent      │ │ TAgent      │
│ Desktop     │ │ Desktop     │ │ Desktop     │
│ + 内嵌      │ │ + 内嵌      │ │ + 内嵌      │
│ SyncEngine  │ │ SyncEngine  │ │ SyncEngine  │
│ + 本地      │ │ + 本地      │ │ + 本地      │
│ SQLite      │ │ SQLite      │ │ SQLite      │
└─────────────┘ └─────────────┘ └─────────────┘
```

**Server 不存储**：

- ❌ 资产文件本体（FBX / 贴图）—— SVN 管
- ❌ 资产文件夹结构 —— 推算自 svn_path
- ❌ 用户表 —— 复用 SSO
- ❌ 项目成员表 —— 复用 SSO 用户组

**Server 存储**：

- ✅ Asset metadata（tags、分类、审核状态、关联关系）
- ✅ Convention 文档（带版本）
- ✅ Preview 缩略图（小文件）
- ✅ Sync state（每员工/每设备的 cursor）
- ✅ Audit log

---

## 4. 核心组件

### 4.1 服务端组件

```
TAgent Server (Python FastAPI)
├─ api/
│   ├─ auth.py                # SSO 验 token, 解析 user_id + groups
│   ├─ sync.py                # push/pull/full 三个端点
│   ├─ asset.py               # asset CRUD + 搜索
│   ├─ convention.py          # 规范版本化
│   ├─ project.py             # 项目列表 (从 SSO 拿)
│   └─ ws.py                  # WebSocket 推送
├─ services/
│   ├─ sso_client.py          # 调公司 SSO 验 token
│   ├─ conflict_resolver.py   # server-wins + 状态机
│   ├─ search_index.py        # Postgres tsvector 维护
│   ├─ audit_logger.py        # 所有变更写日志
│   └─ notifier.py            # WebSocket 广播
├─ models/
│   ├─ asset.py               # SQLAlchemy model
│   ├─ convention.py
│   ├─ sync_state.py
│   └─ audit.py
├─ db/
│   └─ migrations/            # Alembic
├─ auth/
│   ├─ sso_*.py               # 借鉴 truedepth/account_auth.py
│   └─ permissions.py         # 角色判定 (从 SSO groups 映射)
└─ main.py                    # FastAPI 入口
```

### 4.2 客户端组件（嵌入 TAgent Desktop）

```
TAgent Desktop (Electron)
└─ main process (TS)
    └─ SyncEngine (NEW, TS 调 Python 复用 ta_agent)
        ├─ SsoAuthenticator  # 调 SSO 拿 token
        ├─ ApiClient         # HTTPS REST 客户端
        ├─ WsSubscriber      # WebSocket 长连
        ├─ ChangeWatcher     # SQLite 触发器 → 队列
        ├─ Pusher            # 30s debounce 推增量
        ├─ Puller            # 收到 WS 通知 → 拉变更
        ├─ ConflictHandler   # 应用 server-wins
        └─ StatusReporter    # UI 状态栏 (offline/syncing/synced/conflict)
```

**为什么用 TS 调 Python，而不是直接 Python daemon**：

- TAgent Desktop 主进程已是 TS，main 进程管理 Electron
- SyncEngine 是个 TS 模块，**调用** ta_agent 已有 Python 代码（通过 IPC 或 subprocess）
- 不需要新开 daemon 进程（OS 进程数 -1）
- 用户在 TAgent Desktop 设置页配置 server URL，无需单独装包

---

## 5. 数据模型

### 5.1 asset_metadata（核心表）

```sql
CREATE TABLE asset_metadata (
  asset_id           TEXT PRIMARY KEY,        -- "<svn_path>::<file_hash_prefix>"
  svn_path           TEXT NOT NULL UNIQUE,   -- SVN 相对路径
  file_hash          TEXT,                   -- 完整 hash (冲突检测)
  file_size          BIGINT,

  -- 业务字段 (从 ta_agent AssetTags 迁过来)
  asset_name         TEXT,
  asset_type         TEXT,                   -- static_mesh / skeletal_mesh / texture / animation / material
  category           TEXT,                   -- 分类 (从 X-2 词表: character/weapon/...)
  subcategory        TEXT,
  style              TEXT,
  condition          TEXT,

  -- 三层 tags (JSONB, 灵活)
  geometry_tags      JSONB DEFAULT '{}',
  texture_tags       JSONB DEFAULT '{}',
  material_tags      JSONB DEFAULT '{}',
  visual_tags        JSONB DEFAULT '{}',

  -- 审核状态
  review_status      TEXT DEFAULT 'pending',  -- pending / approved / rejected / imported
  review_confidence  REAL,
  reviewer_id        TEXT,
  reviewed_at        TIMESTAMPTZ,

  -- 元数据
  created_by_user    TEXT NOT NULL,           -- SSO user_id
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_by_user    TEXT NOT NULL,
  updated_at         TIMESTAMPTZ DEFAULT NOW(),

  -- 软删除
  deleted_at         TIMESTAMPTZ,
  deleted_by_user    TEXT,

  -- 防冲突
  version            BIGINT NOT NULL DEFAULT 1  -- 每次更新 +1, 用于乐观锁
);

-- 全文搜索 (Postgres tsvector)
ALTER TABLE asset_metadata ADD COLUMN search_vector TSVECTOR;
CREATE INDEX idx_asset_search ON asset_metadata USING GIN(search_vector);

-- 项目过滤 (从 SSO 决定, 但缓存到本地)
CREATE INDEX idx_asset_type ON asset_metadata(asset_type);
CREATE INDEX idx_asset_category ON asset_metadata(category);
CREATE INDEX idx_asset_review ON asset_metadata(review_status);
```

**asset_id 怎么算**（客户端本地）：

```python
import hashlib

def compute_asset_id(svn_path: str, file_content: bytes) -> str:
    """客户端独立算。不需要 server 分配。"""
    file_hash = hashlib.sha256(file_content).hexdigest()[:8]
    return f"{svn_path}::{file_hash}"
```

### 5.2 convention_versions

```sql
CREATE TABLE convention_versions (
  id                BIGSERIAL PRIMARY KEY,
  project_id        TEXT NOT NULL,         -- 来自 SSO group
  file_path         TEXT NOT NULL,         -- 规范文件路径
  version           INT NOT NULL,          -- 单调递增
  content           TEXT NOT NULL,         -- markdown 内容
  content_hash      TEXT NOT NULL,
  created_by_user   TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  published_at      TIMESTAMPTZ,           -- null = 草稿
  UNIQUE(project_id, file_path, version)
);

CREATE TABLE convention_published (
  project_id        TEXT NOT NULL,
  file_path         TEXT NOT NULL,
  current_version   INT NOT NULL,
  PRIMARY KEY (project_id, file_path),
  FOREIGN KEY (current_version) REFERENCES convention_versions(id)
);
```

### 5.3 sync_state

```sql
CREATE TABLE sync_state (
  user_id           TEXT NOT NULL,           -- SSO user_id
  device_id         TEXT NOT NULL,           -- 客户端生成的 UUID
  last_push_cursor  BIGINT,                  -- 最后成功 push 的 audit id
  last_pull_at      TIMESTAMPTZ,
  last_sync_at      TIMESTAMPTZ,
  PRIMARY KEY (user_id, device_id)
);
```

### 5.4 audit_log

```sql
CREATE TABLE audit_log (
  id                BIGSERIAL PRIMARY KEY,
  ts                TIMESTAMPTZ DEFAULT NOW(),
  user_id           TEXT NOT NULL,
  device_id         TEXT,
  action            TEXT NOT NULL,           -- asset.create / asset.update / asset.delete / ...
  table_name        TEXT,
  record_id         TEXT,
  old_payload       JSONB,
  new_payload       JSONB,
  conflict_resolved TEXT                    -- server-wins / 3-way-merge / manual
);

-- 用于 client pull 增量 (按 cursor 拉)
CREATE INDEX idx_audit_cursor ON audit_log(id);
```

---

## 6. API 设计

### 6.1 鉴权

所有 API 必须带 `Authorization: Bearer <token>` 头。Token 是 SSO 颁发的短期 JWT（15min）+ refresh（7d）。

```python
# main.py
from fastapi import Depends, HTTPException
from services.sso_client import verify_token

async def current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """验 SSO token, 返回 user 信息。"""
    user = await verify_token(token)
    if not user:
        raise HTTPException(401, "Invalid token")
    return user  # {user_id, name, email, groups: [...], roles: [...]}
```

### 6.2 同步端点（核心）

#### `POST /api/sync/push`

```python
class PushRequest(BaseModel):
    device_id: str
    since_cursor: int                 # 0 = 首次
    changes: List[Change]             # 增量

class Change(BaseModel):
    op: Literal['create', 'update', 'delete']
    table: Literal['asset_metadata', 'convention_versions']
    record_id: str                    # asset_id 或 convention (project_id, file_path)
    payload: dict | None              # null for delete
    client_version: int | None        # for update
    client_updated_at: str            # ISO timestamp

class PushResponse(BaseModel):
    applied: List[AppliedChange]
    conflicts: List[Conflict]
    server_cursor: int                # 下次 push/pull 用
    server_time: str

class AppliedChange(BaseModel):
    record_id: str
    new_server_version: int

class Conflict(BaseModel):
    record_id: str
    conflict_type: Literal['version_mismatch', 'already_deleted', 'state_machine_violation']
    server_value: dict | None
    your_value: dict | None
    resolution: Literal['server_wins', 'client_wins', 'manual_needed']
```

#### `GET /api/sync/pull`

```
GET /api/sync/pull?since_cursor=<int>&limit=<int=100>

Response:
{
  "changes": [
    {
      "audit_id": 12345,
      "ts": "2026-06-05T12:00:00Z",
      "user_id": "frank",
      "action": "asset.update",
      "table": "asset_metadata",
      "record_id": "...",
      "payload": {...}
    }
  ],
  "server_cursor": 12350,
  "has_more": false
}
```

#### `GET /api/sync/full`（首次接入 / 长期断网后）

```
GET /api/sync/full?since=<iso_date>&tables=asset_metadata,convention_versions

Response: 同 push 格式, 但 server 把所有变更打包返回
```

### 6.3 资源端点

#### `GET /api/asset/search?q=...&type=...&category=...&limit=50`

```
使用 Postgres tsvector 全文搜索 + 业务字段过滤
```

#### `GET /api/asset/{asset_id}`

```
返回单个 asset_metadata 完整记录 + preview_url
```

#### `POST /api/asset` （创建，等同 push 一个 create）

```
通常 push 已经够用。POST 用于 UI 主动操作。
```

#### `GET /api/convention/{project_id}?file_path=...`

```
返回当前发布版本的规范内容
```

#### `POST /api/convention/{project_id}/publish`

```
发布新版本
{
  "file_path": "naming-convention.md",
  "content": "...",
  "version_comment": "..."
}
```

#### `GET /api/project/list`

```
返回当前用户能访问的项目列表 (从 SSO groups 映射)
```

### 6.4 WebSocket

#### `WS /ws/sync?token=<token>`

```
连接时验 token
连接后订阅当前用户能访问的所有项目的变更
server 主动推送:
  {"type": "asset.updated", "asset_id": "...", "user_id": "...", "ts": "..."}
  {"type": "asset.deleted", "asset_id": "...", "user_id": "...", "ts": "..."}
  {"type": "convention.published", "project_id": "...", "file_path": "...", "version": 3}
client 收到后:
  - 看是否本地有 (按 asset_id)
  - 有 → 拉 server 完整值, 应用 (server-wins)
  - 无 → 直接应用
  - 应用后, 通过 SQLite 触发器让本地 UI 更新
```

---

## 7. 同步协议详解

### 7.1 client 启动时的同步

```
[App 启动]
  ├─ 读本地 sync_state.json (last_cursor, last_pull_at, device_id)
  ├─ 读本地 server_url 配置
  └─ 启 SyncEngine
      ├─ if no token → 调 SSO 登录 (UI 弹登录框)
      ├─ 启 WebSocket 连接
      └─ 立刻触发一次 full_sync (或增量 pull, 看断网时长)
```

### 7.2 client 推本地变更

```
[用户在 TAgent 改了一个 asset 的 tag]
  ├─ SQLite trigger 触发
  ├─ ChangeWatcher 收到事件
  ├─ 加入 pending_pushes 队列
  └─ 30s debounce timer
      └─ fire → 批量调 push
          ├─ POST /api/sync/push
          ├─ server 处理:
          │   ├─ 验 token
          │   ├─ 验 permission (SSO roles)
          │   ├─ 验 version (乐观锁, 冲突则 conflicts[])
          │   ├─ 写入 DB
          │   ├─ 写 audit_log
          │   ├─ 更新 search_vector
          │   └─ WebSocket 广播给其他 clients
          └─ client 收到 applied[] + conflicts[]
              ├─ applied: 记录新 server_version
              └─ conflicts: 标记本地为 stale, UI 提示 "X 资产被他人改了"
```

### 7.3 client 收 server 变更

```
[WebSocket 收到 asset.updated]
  ├─ Puller 收到事件
  ├─ 调 GET /api/asset/{asset_id}
  ├─ 与本地对比:
  │   ├─ 本地无 → INSERT
  │   ├─ 本地有但 server_updated_at > local_updated_at → UPDATE
  │   └─ 本地有且本地更新 → 标记 conflict, 推下一次 push 时解
  └─ 写 SQLite (通过触发器让 UI 自动更新)
```

### 7.4 冲突场景

| 场景                             | 检测                            | 解决                              |
| -------------------------------- | ------------------------------- | --------------------------------- |
| A 改 tag, B 同时改 tag           | push 时 version 不匹配          | server-wins, A 收到 conflicts[]   |
| A 审核通过, B 同时改状态         | push 时状态机违例               | 拒绝 B, 返回 conflict             |
| A 删, B 同时改                   | push 时 server 是 deleted       | B 收到 conflict, B 选择是否恢复   |
| A 改名 (svn_path 变了), B 改 tag | asset_id 变了, B 的旧 ID 不存在 | B 收到 conflict, 提示资产已重命名 |

### 7.5 离线场景

```
[网络断]
  ├─ WebSocket 自动重连
  ├─ 本地变更继续入 pending_pushes (无界? 设上限 1000 条)
  └─ 离线时, TAgent 仍可用本地 SQLite

[网络恢复]
  ├─ WebSocket 重连
  ├─ 立刻调 pull (since=last_pull_at)
  ├─ 然后批量调 push (清空 pending_pushes)
  └─ 若 pending > 1000, 提示用户手动确认
```

---

## 8. 鉴权（MVP 简化版）

**2026-06-05 决策**：MVP 阶段**不接 SSO**。理由：TAgent 自己的 `appid/appsecret/aes_key/aes_iv` 还没向 SSO 管理员申请，现有 truedepth 的凭证（`appid="blender"`）不能用在 TAgent 上。

**MVP 简化鉴权**：

- 每个 API 请求带 `X-Username: <工号>` 头
- Server 不验证（内网信任）
- 业务代码用 `Depends(current_user)`，鉴权实现可后续替换

**升级到 SSO 路径**（M1+ 阶段）：

1. 找 SSO 管理员申请 TAgent 的 appid（`tagent-desktop` 和 `tagent-server`）
2. 拿到 `appsecret / aes_key / aes_iv`
3. 复用 truedepth 的 SSO 客户端代码（抽出 `tagent_sso` Python 包）
4. 改 `current_user` 内部实现：调 SSO 验 token
5. Desktop 加 SSO 登录 UI

业务代码（API 端点）零修改，只需改 auth 层。

**详细 SSO 集成方案**（已讨论，**待 SSO appid 申请下来后**再实施）：

- 借鉴 `C:\Users\liangmingxuan\AppData\Roaming\Blender Foundation\Blender\4.3\extensions\user_default\truedepth\account_auth.py` 的 XSJSSO 模式
- 复用其 AES-CBC 密码加密 + xsjsso_md5 签名
- 12 小时 token 失效
- 客户端 token 加密存盘（用 username+computername 派生 keystream）
- Server 端 lru_cache 5min 缓存 SSO validate 结果

---

## 9. 实施计划

### 9.1 阶段

| 阶段                             | 内容                                                         | 估时       |
| -------------------------------- | ------------------------------------------------------------ | ---------- |
| **S0 设计细化**                  | 本设计文档细化、Postgres schema 评审、SSO 客户端复用代码抽出 | 1 周       |
| **S1 TAgent Server 基础**        | FastAPI 骨架 + Postgres + Docker + Alembic 迁移              | 1 周       |
| **S2 鉴权 + API 骨架**           | SSO 集成、auth 依赖、project/asset/convention 基础 CRUD      | 1.5 周     |
| **S3 同步协议**                  | push/pull/full 端点 + 冲突解决 + audit_log                   | 1.5 周     |
| **S4 WebSocket**                 | 实时推送 + 客户端订阅                                        | 0.5 周     |
| **S5 TAgent Desktop SyncEngine** | 嵌入 TS SyncEngine + SSO 登录 UI + 状态栏                    | 2 周       |
| **S6 集成测试**                  | 多客户端同步、断网/重连、冲突场景                            | 1 周       |
| **合计**                         |                                                              | **8-9 周** |

### 9.2 MVP 边界

- ✅ 1 个项目（其他项目未来加）
- ✅ Asset metadata 同步（不包含 preview 缩略图，**仅路径引用**）
- ✅ Convention 文档版本化（不包含实际内容同步，仅 publish 通知）
- ✅ 软删除（30 天保留）
- ❌ 多人同时编辑冲突 UI（先 server-wins + toast，后续加）
- ❌ MCP 远程端点（MVP 后加）
- ❌ 审计日志查询 UI（仅存不展示）

### 9.3 与 TAgent Desktop 实施的关系

| 阶段                              | TAgent Desktop 端    | TAgent Server 端 |
| --------------------------------- | -------------------- | ---------------- |
| P0 品牌替换 + ta_agent MCP server | ✅ 必做              | —                |
| P1 ModeManager + 模式切换         | ✅ 必做              | —                |
| P2 资产库 SQLite 直读             | ✅ 必做              | —                |
| S0-S4 Server 基础                 | —                    | ✅ 必做          |
| S5 Desktop 加 SyncEngine          | ✅ Server 端必须先好 | ✅               |
| S6 集成测试                       | ✅ 一起做            | ✅ 一起做        |

---

## 10. 风险与缓解

| 风险                             | 影响               | 缓解                                        |
| -------------------------------- | ------------------ | ------------------------------------------- |
| SSO 服务挂了                     | 整 server 不可用   | TAgent Desktop 降级纯本地                   |
| Postgres 写满了 / 备份失败       | 数据丢失           | 每日 pg_dump + 30 天滚动                    |
| WebSocket 长连不稳               | 推送延迟           | 客户端 30s 心跳 + 断线重连 + 60s 强制 pull  |
| 网络分区下多人改冲突             | 数据不一致         | server-wins + audit_log 可追溯              |
| 客户端时钟漂移导致 updated_at 错 | 冲突解决错         | server 写 `server_updated_at`, 客户端不参与 |
| 预览图 blob 大量占用             | 存储满             | 缩略图限 256KB, 每日清理孤儿                |
| 员工离职 SSO 关停                | 其 push token 失效 | 自动清理 sync_state 标记                    |
| 大批量首次同步卡                 | 用户体验差         | 分页 + 进度条 + 后台跑                      |

---

## 11. 待澄清问题

1. **Preview 缩略图是否同步？**（M3 我先不算）
2. **Convention 内容是否同步全文？**（还是只同步"已发布"事件，让客户端按需拉）
3. **多项目怎么选？** SSO groups 怎么映射到 project_id？
4. **审计日志 UI 是否需要？** MVP 暂不做
5. **数据保留策略？** 删除的资产 30 天后真删，还是永久保留（GDPR？）？
6. **SSO token 失效怎么办？** refresh 流程？

---

## 12. 引用

- `F:\ta_agent\apps\server/` — TAgent 已有"中心服务器"规划代码（可参考目录结构）
- `F:\TAgent_General\docs\plans\2026-06-05-tagent-fusion-design.md` — TAgent Desktop 设计
- `C:\Users\liangmingxuan\AppData\Roaming\Blender Foundation\Blender\4.3\extensions\user_default\truedepth\account_auth.py` — SSO 客户端参考实现
- `C:\Users\liangmingxuan\AppData\Roaming\Blender Foundation\Blender\4.3\extensions\user_default\truedepth\account_login_flow.py` — SSO 登录流程
- `C:\Users\liangmingxuan\AppData\Roaming\Blender Foundation\Blender\4.3\extensions\user_default\truedepth\account_internal_config.json` — SSO 配置（appid/secret/aes_key/iv）
- `F:\ta_agent\packages\tools\registry.py` — TAgent 工具 schema（Server 端 MCP 端点的数据源）
- `F:\ta_agent\packages\tags\schema.py` — AssetTags schema（asset_metadata 表的字段来源）
- `F:\Proma\apps\electron\src\renderer\hooks\useGlobalAgentListeners.ts` — Proma token 统计模式（可参考做 Server 端 audit）
