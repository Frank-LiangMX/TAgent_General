# 为什么 TAgent 记忆系统用 .md 文件存储？

> **分析时间**: 2026-07-06  
> **核心问题**: 为什么 L0-L2 / L5 用 Markdown 文件，而 L3/L4 用 JSONL/SQLite？

---

## 📋 一、核心设计理念

### 1.1 异构存储策略

TAgent 记忆系统采用**异构存储**策略：不同层级用不同存储载体，兼顾"可读性"与"结构化"。

| 层级 | 存储载体 | 设计理念 |
|------|---------|---------|
| **L0-L2** | **Markdown (.md)** | **白盒可审计、人类可读、LLM 易注入** |
| **L3** | **JSONL (.jsonl)** | **结构化、易去重、机器友好** |
| **L4** | **SQLite + FTS5 (.db)** | **可索引、可查询、全文搜索** |
| **L5** | **Markdown (.md)** | **白盒可审计、人类可读** |

**异构存储的核心思想**：
- **顶层（L0/L1/L2/L5）**：Markdown → 人类可读、LLM 易注入、白盒可审计
- **底层（L3/L4）**：结构化（JSONL/SQLite）→ 易索引、易查询、机器友好

---

## 🎯 二、为什么顶层用 Markdown？

### 2.1 白盒可审计

**核心需求**：用户可以直接查看记忆内容，无需工具或数据库客户端

**对比**：

| 存储格式 | 用户查看方式 | 可审计性 |
|---------|-------------|---------|
| **Markdown (.md)** | ✅ 直接用文本编辑器打开（VS Code / Notepad / cat） | ⭐⭐⭐⭐⭐ |
| **JSONL (.jsonl)** | ⚠️ 需要理解 JSON 格式，或用工具美化 | ⭐⭐⭐ |
| **SQLite (.db)** | ❌ 需要数据库客户端（sqlite3 / DB Browser） | ⭐⭐ |
| **Vector DB** | ❌ 需要专用查询接口 | ⭐ |

**白盒可审计的价值**：

- ✅ 用户可以**直接查看** L0 用户画像（"不要 emoji" / "保持简洁"）
- ✅ 用户可以**直接编辑** L2 稳定事实（手动修正错误）
- ✅ 用户可以**直接删除**不需要的记忆条目
- ✅ **透明可信**：用户知道 AI 记住了什么，无需盲信

---

### 2.2 LLM 易注入

**核心需求**：记忆文件内容可以直接注入到 LLM 的 system prompt

**Markdown 的天然优势**：

- ✅ LLM 天生支持 Markdown 格式（训练数据大量 Markdown）
- ✅ Markdown 语义清晰：`# 标题` / `- 列表项` / `<!-- 注释 -->`
- ✅ 直接 prepend 到 system prompt（无需转换）

**对比**：

| 存储格式 | 注入方式 | LLM 友好度 |
|---------|---------|-----------|
| **Markdown (.md)** | ✅ 直接 prepend 到 system prompt | ⭐⭐⭐⭐⭐ |
| **JSONL (.jsonl)** | ⚠️ 需要解析 JSON → 转换为文本 | ⭐⭐⭐ |
| **SQLite (.db)** | ❌ 需要查询 → 格式化 → 注入 | ⭐⭐ |

**注入示例**：

```markdown
# L0 用户画像

## peer_view（用户偏好）

- [2026-07-06] 不要 emoji <!-- hit:3 last_ref:2026-07-06 src:abc12345 -->
- [2026-07-06] 保持简洁 <!-- hit:2 last_ref:2026-07-06 src:def67890 -->
```

**直接 prepend 到 system prompt**：

```typescript
systemPrompt += `
## 用户偏好（L0 记忆）

${l0Content}
`
```

---

### 2.3 人类可读性

**核心需求**：用户无需技术背景就能理解记忆内容

**Markdown 的可读性优势**：

- ✅ Markdown 格式直观（标题、列表、注释）
- ✅ 元数据用 HTML 注释 `<!-- ... -->`：渲染器忽略，但人类可读
- ✅ 时间戳、引用次数等信息清晰可见

**对比**：

| 存储格式 | 可读性 | 举例 |
|---------|--------|------|
| **Markdown** | ⭐⭐⭐⭐⭐ | `- [2026-07-06] 我叫 Frank <!-- hit:3 -->` |
| **JSONL** | ⭐⭐⭐ | `{"timestamp":1783332003,"pattern":"我叫 Frank","count":3}` |
| **SQLite** | ⭐⭐ | `SELECT * FROM sessions WHERE id=123` |

---

### 2.4 版本控制友好

**核心需求**：记忆文件可以纳入 Git 版本控制，追溯历史

**Markdown 的版本控制优势**：

- ✅ 文本格式 → Git diff 清晰可见
- ✅ 每次修改都能看到具体变更
- ✅ 可以回滚到历史版本

**对比**：

| 存储格式 | Git 友好度 | Git diff |
|---------|-----------|---------|
| **Markdown** | ⭐⭐⭐⭐⭐ | 清晰：`- [日期] 内容` 的变更一目了然 |
| **JSONL** | ⭐⭐⭐ | 需要理解 JSON diff |
| **SQLite** | ⭐ | Git diff 看不到具体变更（二进制） |

---

## 📊 三、为什么底层不用 Markdown？

### 3.1 L3 纠错记录：为什么用 JSONL？

**L3 存储需求**：

- ❌ **需要去重**：同一纠正可能多次出现
- ❌ **需要追加写入**：每次纠正追加一条记录
- ❌ **需要结构化查询**：按 pattern 分组、统计命中率

**JSONL 的优势**：

| 维度 | Markdown | JSONL |
|------|---------|-------|
| **追加写入** | ⚠️ 需要解析全文 + 检查去重 | ✅ 直接追加一行 JSON |
| **去重** | ⚠️ 需要手动检查 pattern | ✅ JSON 字段可索引 |
| **统计命中率** | ❌ 需要解析全文 | ✅ JSON 字段可聚合 |

**JSONL 格式示例**：

```jsonl
{"timestamp":1783332003,"correction":"不是 emoji，是 emoji-free","context":"AI: ..."}
{"timestamp":1783332005,"correction":"不是中文，是英文","context":"AI: ..."}
```

**追加写入**：

```typescript
// 直接追加一行 JSON
await fs.promises.appendFile(filePath, JSON.stringify(record) + '\n', 'utf-8')
```

---

### 3.2 L4 历史会话：为什么用 SQLite？

**L4 存储需求**：

- ❌ **需要全文搜索**：用户搜索历史会话（FTS5）
- ❌ **需要结构化查询**：按时间/模式/workspace 过滤
- ❌ **需要索引**：按 created_at / mode / workspace_slug 索引

**SQLite + FTS5 的优势**：

| 维度 | Markdown | SQLite + FTS5 |
|------|---------|---------------|
| **全文搜索** | ❌ 需要grep/ripgrep | ✅ FTS5 语义搜索 |
| **结构化查询** | ❌ 需要解析全文 | ✅ SQL 查询 |
| **索引** | ❌ 无索引 | ✅ B-tree 索引 |
| **并发读写** | ⚠️ 需要锁 | ✅ WAL 模式 |

**SQLite Schema**：

```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  session_slug TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  key_facts TEXT,
  created_at INTEGER NOT NULL,
  mode TEXT,
  workspace_slug TEXT
);

CREATE VIRTUAL TABLE sessions_fts USING fts5(
  title, summary, key_facts,
  content='sessions'
);
```

**全文搜索示例**：

```sql
SELECT * FROM sessions_fts WHERE sessions_fts MATCH 'Frank' ORDER BY rank;
```

---

## 🎯 四、设计哲学：上层可读，下层高效

### 4.1 TencentDB Agent Memory 的异构存储哲学

**借鉴 TencentDB 的设计理念**：

> **顶层承载结构**（Persona → Scenario → Atom → Conversation）
> **下层承载证据**（完整日志、原始消息、工具输出）

**异构存储的核心思想**：

- **顶层 Markdown**（L0-L2/L5）：白盒可审计、人类可读、LLM 易注入
- **底层结构化**（L3/L4）：易索引、易查询、机器友好

**对比腾讯设计**：

| TencentDB | TAgent |
|-----------|--------|
| L3 Persona → Markdown | L0-L2/L5 → Markdown |
| L2 Scenario → Markdown | - |
| L1 Atom → JSONL + Vector | L3 → JSONL |
| L0 Conversation → JSONL | L4 → SQLite + FTS5 |

---

### 4.2 GenericAgent 的 Markdown SOP 设计

**借鉴 GenericAgent 的 SOP 文件格式**：

- ✅ SOP 文件全部用 Markdown（`*_sop.md`）
- ✅ 极简清单（关键前置 + 典型坑）
- ✅ 人类可直接阅读

**示例**：

```markdown
# 定时任务 SOP

目录：`../sche_tasks/` 放任务定义 JSON

## 任务 JSON 格式
{"schedule":"08:00","repeat":"daily","enabled":true}

## 触发流程
1. scheduler.py 每 60 秒轮询
2. 条件全满足才触发
```

---

### 4.3 Hermes 的 Markdown 记忆文件

**借鉴 Hermes 的内置 Provider**：

- ✅ `MEMORY.md` / `USER.md` — Markdown 格式
- ✅ 直接 prepend 到 system prompt
- ✅ 用户可查看/编辑

---

## ⚖️ 五、Markdown 存储的权衡

### 5.1 优势

| 优势 | 说明 |
|------|------|
| **白盒可审计** | 用户直接查看，无需工具 |
| **LLM 易注入** | 天生支持 Markdown，直接 prepend |
| **人类可读** | 无需技术背景，直观理解 |
| **版本控制友好** | Git diff 清晰，可回滚 |
| **编辑友好** | 用户可直接编辑修正错误 |

### 5.2 劣势

| 劣势 | 说明 | 缓解措施 |
|------|------|---------|
| **无索引** | 搜索需要 grep/ripgrep | L4 单独用 SQLite + FTS5 |
| **并发写入风险** | 多进程同时写可能冲突 | 单进程写入（Nudge/Reflect） |
| **去重困难** | 需要解析全文检查 pattern | 写入前检查全文（代码实现） |
| **统计困难** | 需要解析全文聚合 | LRU / Self-Repair 定期统计 |

---

## 📊 六、总结：为什么顶层用 Markdown？

### 核心原因

| 原因 | 具体体现 |
|------|---------|
| **1. 白盒可审计** | 用户可直接打开 L0_user.md 查看"不要 emoji"偏好 |
| **2. LLM 易注入** | Markdown 直接 prepend 到 system prompt，无需转换 |
| **3. 人类可读** | 无需技术背景，直接理解 `- [日期] 内容` |
| **4. 版本控制友好** | Git diff 清晰，可追溯记忆变更历史 |
| **5. 用户编辑友好** | 用户可直接编辑 L2_facts.md 修正错误 |

### 异构存储的设计哲学

```
顶层（L0-L2/L5）：Markdown → 白盒可审计、人类可读
底层（L3/L4）：结构化 → 易索引、易查询、机器友好
```

**借鉴来源**：

- ✅ **TencentDB Agent Memory**：异构存储（顶层 Markdown，底层 SQLite + Vector）
- ✅ **GenericAgent**：SOP 文件全部 Markdown
- ✅ **Hermes Agent**：MEMORY.md / USER.md Markdown 格式

---

**结论**：

TAgent 选择 Markdown 存储顶层记忆（L0-L2/L5），核心原因是**白盒可审计 + LLM 易注入 + 人类可读**。这是一个**面向用户体验**的设计决策，而非纯粹的技术选型。

**如果记忆文件都用 SQLite**：
- ❌ 用户无法直接查看记忆内容
- ❌ 需要数据库客户端才能审计
- ❌ LLM 注入需要查询 + 格式化

**Markdown 的权衡**：
- ✅ 无索引 → L4 单独用 SQLite + FTS5
- ✅ 并发写入风险 → 单进程写入
- ✅ 去重困难 → 写入前检查全文

---

**分析完成时间**: 2026-07-06 19:57  
**报告位置**: `~/.proma/agent-workspaces/tagent/workspace-files/.context/Why_Markdown_for_Memory.md`