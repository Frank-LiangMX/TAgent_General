# TAgent 项目进度追踪

> **单文件持续更新** — 新 Agent 读此文件即可了解项目状态
> **设计文档**：`docs/plans/2026-06-05-tagent-fusion-design.md`

---

## 当前状态（2026-06-07）

**阶段**：MVP 设计已拍板，实施进行中

**已完成**：
- ✅ Tier 1+2 品牌清理（全清 "proma" 标识 → "tagent"）
- ✅ §8.4 Context 管理 **7/7 项全部实现**
- ✅ ESLint 9 升级 + 434 warnings 清理
- ✅ 93 + 16 = 109 个单元测试
- ✅ 图标清理（删除 proma 旧 logo 变体，重画 icon.svg）
- ✅ dev-stop.bat + dev.bat 修复（中文乱码问题）
- ✅ 文档更新（CLAUDE.md 品牌/命名修正，PROGRESS.md 创建）

**剩余任务**：
- 🟢 起 dev 验证功能（验证 P1-3 客户端压缩按钮）
- 🟢 单测补充（P1-1 / P1-2）

---

## 历史进度

### 2026-06-07

**产出**：P1-3 完成 + 图标清理 + 文档更新

| 任务 | 内容 |
|------|------|
| P1-3 客户端压缩 | ✅ 已完整实现（压缩逻辑 + IPC + UI + 16 单测）|
| 图标清理 | 删除 16 个 proma 旧 logo 变体，重画 icon.svg（icosahedron），重打包 icon.icns |
| dev-stop.bat | 中文注释改英文，解决 CMD 编码乱码问题 |
| dev.bat | 同上 |
| 文档更新 | CLAUDE.md 修正品牌命名，创建 PROGRESS.md |

### 2026-06-06

**产出**：26 个 commit，10 个设计章节，93 个单元测试

#### 1. Tier 1+T2 品牌清理（10 commit）

| Commit | 改动 | 文件数 |
|---|---|---|
| `8e5e9ab` | `proma-file://` → `tagent-file://` | 6 |
| `05c525c` | `~/.proma-dev/` → `~/.tagent-dev/` | 4 |
| `d6c4e32` | `appId: com.proma.app` → `com.tagent.app` | 1 |
| `935064e` | 扩展名 `proma-*` → `tagent-*` | 8 |
| `7018bba` | skill `proma-coach` → `tagent-coach` | 1 |
| `9b81d9e` | in-app state / DOM / URL | 51 |
| `7c56f97` | Logo 资源文件 | 19 |
| `8baaee2` | yml + package.json | 5 |
| `e9d05d9` | `~/.proma/` → `~/.tagent/` | 45 |

#### 2. 设计文档补完（6 commit, 决策 #7-#12）

| 决策 | 内容 |
|------|------|
| #7 | TA 模式数据布局（`~/.tagent/ta/`）|
| #8 | 缓存机制 + 目录规范 |
| #9 | 缓存层 C1-C5 命名 |
| #10 | 记忆自进化（L0-L5）|
| #11 | 工作区 UI 重构（D 方案 v2）|
| #12 | Context 管理机制（7 项）|

#### 3. §8.4 Context 管理 6/7 实现

| 优先级 | 改动 | 状态 |
|--------|------|------|
| P0-1 | 动态 token 预算 | ✅ |
| P0-2 | model 验证（启动 hook + UI 按钮）| ✅ |
| P1-1 | tool summary 截断 | ✅ |
| P1-2 | 图片 placeholder | ✅ |
| P2-1 | Nudges 80%/90% | ✅ |
| P2-2 | 圆环 3 态颜色 | ✅ |
| **P1-3** | **客户端 compact_session 工具** | ❌ 待做 |

---

## 关键设计决策

### 命名空间
- **L0-L5**：记忆层
- **C1-C5**：缓存层（避免与 L 冲突）

### 数据目录
- 通用模式：`~/.tagent/`
- TA 模式：`~/.tagent/ta/`
- Electron userData：`~/.tagent[-dev]/electron-userdata/`

### 品牌约束
- 产品名：**TAgent**
- 包名：`@tagent/*`
- 数据目录：`~/.tagent/`
- ❌ 永不使用 "Proma"

---

## 关键代码位置

| 内容 | 位置 |
|------|------|
| model 验证 | `main/lib/channel-manager.ts` |
| 启动 hook | `main/lib/runtime-init.ts` |
| 动态 token 预算 | `main/lib/agent-context-utils.ts` |
| Agent 编排 | `main/lib/agent-orchestrator.ts` |
| 单测 | `main/lib/*.test.ts` |

---

## 用户已拍板决策（不可逆）

| 决策 | 内容 |
|------|------|
| 品牌策略 | 全清 "proma" 标识 |
| 数据丢失 | 接受（不做迁移脚本）|
| 目录名 | `F:\TAgent_General\` |
| TA 数据根 | `~/.tagent/ta/` |
| 命名空间 | 记忆 L / 缓存 C 分开 |
| context 验证 | 启动时 + UI 双触发 |
| 工作区 UI | D 方案 v2 |

---

## 不要碰的清单

- ❌ `proma-thinking/` 目录
- ❌ Tier 2 注释里 125+ 处 "Proma" 引用
- ❌ F:\Proma 拉新东西（legacy 仓库）

---

## 新 Agent 上手流程

1. 读 `CLAUDE.md` — 项目身份、架构、约束
2. 读本文件 — 当前进度
3. 读 `docs/plans/2026-06-05-tagent-fusion-design.md` — 完整设计
4. 问用户确认下一步

**第一句话**：
```
我已读完 CLAUDE.md 和 PROGRESS.md，了解项目当前状态。
请问接下来需要我做什么？
```