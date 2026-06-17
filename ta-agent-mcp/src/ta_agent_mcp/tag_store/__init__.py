"""
tag_store 数据库模块

管理资产库 SQLite 数据库的创建和操作。
数据库位置: ~/.tagent/ta/tag_store/tags.db（或开发环境 ~/.tagent-dev/ta/tag_store/tags.db）

Schema 与 TAgent UI 的 schema.ts 保持一致：
- assets 表：资产元数据
- assets_fts：FTS5 全文搜索
- review_history：审核历史
"""

import json
import os
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

# ===== 数据库路径 =====


def get_tag_store_path() -> Path:
    """
    获取 tag_store 数据库路径

    开发环境使用 ~/.tagent-dev/ta/
    生产环境使用 ~/.tagent/ta/

    可通过环境变量 TA_AGENT_DATA_DIR 覆盖
    """
    # 环境变量覆盖
    data_dir = os.environ.get("TA_AGENT_DATA_DIR")
    if data_dir:
        return Path(data_dir) / "tag_store" / "tags.db"

    # 默认路径
    home = Path.home()
    # 检测开发模式（通过环境变量或目录存在性）
    is_dev = os.environ.get("TAGENT_DEV_MODE") == "true" or (home / ".tagent-dev").exists()
    base_dir = home / ("tagent-dev" if is_dev else "tagent") / "ta"

    return base_dir / "tag_store" / "tags.db"


# ===== 数据库初始化 =====


def init_database(db_path: Path) -> sqlite3.Connection:
    """
    初始化数据库

    创建 assets 表、FTS5 索引、review_history 表

    Args:
        db_path: 数据库文件路径

    Returns:
        数据库连接
    """
    # 确保目录存在
    db_path.parent.mkdir(parents=True, exist_ok=True)

    # 打开数据库
    conn = sqlite3.connect(str(db_path))

    # 设置 WAL 模式（支持并发读写）
    conn.execute("PRAGMA journal_mode = WAL")

    # 创建 assets 表
    conn.execute("""
        CREATE TABLE IF NOT EXISTS assets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'other',
            path TEXT NOT NULL,
            project TEXT,
            status TEXT DEFAULT 'active',
            tags TEXT,
            metadata TEXT,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
            analyzed_at INTEGER,
            review_status TEXT DEFAULT 'pending',
            review_notes TEXT
        )
    """)

    # 创建索引
    conn.execute("CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_assets_updated_at ON assets(updated_at DESC)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_assets_review_status ON assets(review_status)")

    # 创建 FTS5 全文搜索索引
    conn.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts USING fts5(
            name,
            path,
            tags,
            metadata,
            content='assets',
            content_rowid='rowid'
        )
    """)

    # 创建 FTS5 同步触发器
    conn.execute("""
        CREATE TRIGGER IF NOT EXISTS assets_ai AFTER INSERT ON assets BEGIN
            INSERT INTO assets_fts(rowid, name, path, tags, metadata)
            VALUES (new.rowid, new.name, new.path, new.tags, new.metadata);
        END
    """)

    conn.execute("""
        CREATE TRIGGER IF NOT EXISTS assets_ad AFTER DELETE ON assets BEGIN
            INSERT INTO assets_fts(assets_fts, rowid, name, path, tags, metadata)
            VALUES ('delete', old.rowid, old.name, old.path, old.tags, old.metadata);
        END
    """)

    conn.execute("""
        CREATE TRIGGER IF NOT EXISTS assets_au AFTER UPDATE ON assets BEGIN
            INSERT INTO assets_fts(assets_fts, rowid, name, path, tags, metadata)
            VALUES ('delete', old.rowid, old.name, old.path, old.tags, old.metadata);
            INSERT INTO assets_fts(rowid, name, path, tags, metadata)
            VALUES (new.rowid, new.name, new.path, new.tags, new.metadata);
        END
    """)

    # 创建 review_history 表
    conn.execute("""
        CREATE TABLE IF NOT EXISTS review_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            asset_id TEXT NOT NULL,
            action TEXT NOT NULL,
            reviewer TEXT,
            notes TEXT,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
            FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
        )
    """)

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_review_history_asset_id ON review_history(asset_id)"
    )

    conn.commit()

    return conn


def get_connection() -> sqlite3.Connection:
    """
    获取数据库连接

    如果数据库不存在，会自动创建
    """
    db_path = get_tag_store_path()

    if not db_path.exists():
        return init_database(db_path)

    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode = WAL")

    return conn


# ===== 资产操作 =====


def save_asset(
    name: str,
    type: str,
    path: str,
    project: Optional[str] = None,
    tags: Optional[List[str]] = None,
    metadata: Optional[Dict[str, Any]] = None,
    asset_id: Optional[str] = None,
) -> str:
    """
    保存资产到数据库

    Args:
        name: 资产名称
        type: 资产类型 (mesh, texture, material, animation, audio, other)
        path: 资产路径
        project: 项目名称
        tags: 标签列表
        metadata: 元数据字典
        asset_id: 资产ID（可选，不提供则自动生成）

    Returns:
        资产ID
    """
    conn = get_connection()

    # 生成 ID
    if not asset_id:
        asset_id = str(uuid.uuid4())

    # 当前时间戳（毫秒）
    now = int(time.time() * 1000)

    # 处理 tags 和 metadata
    tags_str = json.dumps(tags) if tags else None
    metadata_str = json.dumps(metadata) if metadata else None

    # 插入或更新
    conn.execute(
        """
        INSERT INTO assets (id, name, type, path, project, tags, metadata, created_at, updated_at, analyzed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            type = excluded.type,
            path = excluded.path,
            project = excluded.project,
            tags = excluded.tags,
            metadata = excluded.metadata,
            updated_at = excluded.updated_at,
            analyzed_at = excluded.analyzed_at
    """,
        (asset_id, name, type, path, project, tags_str, metadata_str, now, now, now),
    )

    conn.commit()
    conn.close()

    return asset_id


def save_assets_batch(assets: List[Dict[str, Any]]) -> int:
    """
    批量保存资产

    Args:
        assets: 资产列表，每个资产包含 name, type, path 等字段

    Returns:
        保存的资产数量
    """
    conn = get_connection()

    now = int(time.time() * 1000)
    count = 0

    for asset in assets:
        asset_id = asset.get("id") or str(uuid.uuid4())
        name = asset["name"]
        type = asset.get("type", "other")
        path = asset["path"]
        project = asset.get("project")
        tags_str = json.dumps(asset.get("tags")) if asset.get("tags") else None
        metadata_str = json.dumps(asset.get("metadata")) if asset.get("metadata") else None

        conn.execute(
            """
            INSERT INTO assets (id, name, type, path, project, tags, metadata, created_at, updated_at, analyzed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                type = excluded.type,
                path = excluded.path,
                project = excluded.project,
                tags = excluded.tags,
                metadata = excluded.metadata,
                updated_at = excluded.updated_at,
                analyzed_at = excluded.analyzed_at
        """,
            (asset_id, name, type, path, project, tags_str, metadata_str, now, now, now),
        )

        count += 1

    conn.commit()
    conn.close()

    return count


def update_asset(asset_id: str, **kwargs) -> bool:
    """
    更新资产属性

    Args:
        asset_id: 资产ID
        **kwargs: 要更新的字段

    Returns:
        是否成功
    """
    conn = get_connection()

    # 构建更新语句
    valid_fields = [
        "name",
        "type",
        "path",
        "project",
        "status",
        "tags",
        "metadata",
        "review_status",
        "review_notes",
    ]
    updates = {}

    for field in valid_fields:
        if field in kwargs:
            value = kwargs[field]
            if field in ["tags", "metadata"] and value is not None:
                value = json.dumps(value)
            updates[field] = value

    if not updates:
        conn.close()
        return False

    # 添加 updated_at
    updates["updated_at"] = int(time.time() * 1000)

    # 构建 SQL
    sql = "UPDATE assets SET " + ", ".join(f"{k} = ?" for k in updates.keys()) + " WHERE id = ?"
    values = list(updates.values()) + [asset_id]

    conn.execute(sql, values)
    conn.commit()

    # 检查是否更新成功
    affected = conn.total_changes
    conn.close()

    return affected > 0


def delete_asset(asset_id: str) -> bool:
    """
    删除资产（软删除，设置 status = 'deleted'）

    Args:
        asset_id: 资产ID

    Returns:
        是否成功
    """
    return update_asset(asset_id, status="deleted")


def get_asset_by_id(asset_id: str) -> Optional[Dict[str, Any]]:
    """
    获取资产详情

    Args:
        asset_id: 资产ID

    Returns:
        资产字典或 None
    """
    conn = get_connection()

    cursor = conn.execute("SELECT * FROM assets WHERE id = ?", (asset_id,))
    row = cursor.fetchone()

    conn.close()

    if row:
        return _row_to_dict(row)
    return None


def list_assets(
    type: Optional[str] = None,
    project: Optional[str] = None,
    review_status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """
    列出资产

    Args:
        type: 类型筛选
        project: 项目筛选
        review_status: 审核状态筛选
        limit: 每页数量
        offset: 偏移量

    Returns:
        资产列表
    """
    conn = get_connection()

    conditions = ["status = 'active'"]
    params = []

    if type:
        conditions.append("type = ?")
        params.append(type)

    if project:
        conditions.append("project = ?")
        params.append(project)

    if review_status:
        conditions.append("review_status = ?")
        params.append(review_status)

    sql = f"SELECT * FROM assets WHERE {' AND '.join(conditions)} ORDER BY updated_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cursor = conn.execute(sql, params)
    rows = cursor.fetchall()

    conn.close()

    return [_row_to_dict(row) for row in rows]


def count_assets(
    type: Optional[str] = None, project: Optional[str] = None, review_status: Optional[str] = None
) -> int:
    """
    统计资产数量

    Args:
        type: 类型筛选
        project: 项目筛选
        review_status: 审核状态筛选

    Returns:
        资产数量
    """
    conn = get_connection()

    conditions = ["status = 'active'"]
    params = []

    if type:
        conditions.append("type = ?")
        params.append(type)

    if project:
        conditions.append("project = ?")
        params.append(project)

    if review_status:
        conditions.append("review_status = ?")
        params.append(review_status)

    sql = f"SELECT COUNT(*) FROM assets WHERE {' AND '.join(conditions)}"

    cursor = conn.execute(sql, params)
    count = cursor.fetchone()[0]

    conn.close()

    return count


def _row_to_dict(row: tuple) -> Dict[str, Any]:
    """将数据库行转换为字典"""
    columns = [
        "id",
        "name",
        "type",
        "path",
        "project",
        "status",
        "tags",
        "metadata",
        "created_at",
        "updated_at",
        "analyzed_at",
        "review_status",
        "review_notes",
    ]

    result = {}
    for i, col in enumerate(columns):
        value = row[i]
        if col in ["tags", "metadata"] and value:
            try:
                value = json.loads(value)
            except (json.JSONDecodeError, TypeError):
                pass
        result[col] = value

    return result


# ===== 数据库状态 =====


def get_db_status() -> Dict[str, Any]:
    """
    获取数据库状态

    Returns:
        状态信息
    """
    db_path = get_tag_store_path()

    result = {
        "db_path": str(db_path),
        "exists": db_path.exists(),
    }

    if db_path.exists():
        try:
            conn = get_connection()

            # 统计
            cursor = conn.execute("SELECT COUNT(*) FROM assets WHERE status = 'active'")
            result["total_assets"] = cursor.fetchone()[0]

            # 按类型统计
            cursor = conn.execute(
                "SELECT type, COUNT(*) FROM assets WHERE status = 'active' GROUP BY type"
            )
            result["by_type"] = {row[0]: row[1] for row in cursor.fetchall()}

            # 按审核状态统计
            cursor = conn.execute(
                "SELECT review_status, COUNT(*) FROM assets WHERE status = 'active' GROUP BY review_status"
            )
            result["by_review_status"] = {row[0]: row[1] for row in cursor.fetchall()}

            conn.close()
        except Exception as e:
            result["error"] = str(e)

    return result
