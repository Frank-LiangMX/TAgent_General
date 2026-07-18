# Agent Runtime 双核与 Pi 迁移路线

> **状态**：Proposed（架构决策已对齐方向，实现未开始）  
> **日期**：2026-07-18  
> **目标**：在不牺牲公司内网 kscc 推广与稳定性的前提下，将 TAgent Agent 内核从「Claude Agent SDK 单核」演进为「Pi 自管内核」；kscc 降级为可选的公司额度通道，而非定义产品形态的平台。  
> **关联 ADR**：[`docs/decisions/0008-agent-runtime-dual-core-pi-migration.md`](../decisions/0008-agent-runtime-dual-core-pi-migration.md)  
> **关联文档**：  
> - [`2026-06-25-kscc-internal-provider-design.md`](./2026-06-25-kscc-internal-provider-design.md)（kscc 渠道现状）  
> - [`2026-07-01-kscc-streaming-and-stuck-analysis.md`](./2026-07-01-kscc-streaming-and-stuck-analysis.md)（kscc 流式）  
> - [`2026-06-13-context-compaction-architecture.md`](./2026-06-13-context-compaction-architecture.md)（context 自管方向）  
> - 上游参考：`F:\Proma` 双 runtime（Claude + Pi），默认仍 Claude，长期倾向 Pi  
> **分支建议**：  
> - 阶段 1：`feature/agent-runtime-pi-external`  
> - 阶段 2：`feature/agent-runtime-kscc-bare-pump`（独立分支，默认不合并到生产默认路径）

---

## 0. Handoff 摘要

**你要做什么**：按「双核 → kscc-bare 验证 → 全 Pi」三阶段改造 TAgent Agent Runtime。短期**禁止**用不确定的 `kscc --bare` 替换生产 kscc 路径。

**已拍板的方向**：

1. **产品内核目标** = Pi agent loop（自管 tool / context / 权限策略 / 模型路由）。  
2. **kscc 的产品定位** = 公司内部**推广与额度通道**（量大、免费），**不是**必须绑定的 Agent 平台。  
3. **短期（阶段 1）** = **双核运行**：  
   - 外部渠道（自备 Key / 公网 Provider）→ **Pi**  
   - `kscc-internal` → **保持现状**（Claude Agent SDK + spawn 完整 kscc）  
4. **中期（阶段 2）** = 独立分支把 kscc 改为 **Pi + `kscc -p --bare` 模型泵**，只验证「额度通道」是否可用。  
5. **长期（阶段 3）** = 过门禁后全量 Pi；具备条件时再移除 Claude Agent SDK 依赖。  
6. **与 Proma 的关系** = 走 Pi 内核后，TAgent **实质上与 Proma 分道扬镳**，以**自研产品**为主叙事，不再以「持续对齐 Proma Agent Runtime」为默认义务（详见 §1.5）。

**不要做的事（阶段 1）**：

- ❌ 不要把生产默认 kscc 切到 `--bare`  
- ❌ 不要假设可直连公司 `BASE_API`（实测 `ClientForbidden`）  
- ❌ 不要在双核期给 Claude 路径继续堆新的「仅 Claude 可做」能力  
- ❌ 不要让 Pi 与 kscc 完整 Agent **同时**执行 tool（双环）  
- ❌ 不要为绕过网关客户端白名单去逆向/伪造官方客户端指纹  

**先读**：本文 §1–§4、§7 门禁；实现阶段 1 再读 §5–§6。

---

## 1. 背景与问题

### 1.1 现状

TAgent Agent 模式单一依赖：

```text
AgentOrchestrator
  → ClaudeAgentAdapter
  → @anthropic-ai/claude-agent-sdk
  → spawn(CLI)
       ├ 外网：SDK 自带 claude binary + ANTHROPIC_* env
       └ kscc-internal：系统 PATH 的 kscc + CLI 自管认证
```

kscc 渠道设计见 `2026-06-25-kscc-internal-provider-design.md`：  
**换 executable，不换 Agent 形态**——权限、MCP、流式、resume 等与 Claude Code 平台一体。

### 1.2 核心痛点

| 痛点 | 说明 |
|------|------|
| **臃肿** | Agent 能力绑在 Claude Code CLI 运行时（子进程 + 大系统提示 + 内置工具环） |
| **黑盒** | compact / context 分项 / auto-memory 等策略不可精细自管；`getContextUsage` 曾因副作用被拆除 |
| **难调控** | 产品层大量 recovery（resume 失效、thinking signature、prompt_too_long） |
| **定位错位** | 业务上只要公司**模型额度**；架构上却租用了整台 **Claude Code 平台** |

### 1.3 期望定位（产品叙事）

| 层 | 角色 | 是否必须 |
|----|------|----------|
| **Pi** | Agent **内核**（loop、工具、context、权限策略） | ✅ 必须（目标态） |
| **外网/自备渠道** | HTTP 模型 Provider | 主路径之一 |
| **kscc** | 公司内**额度 + 推广**入口 | ❌ 非内核必须；增长杠杆 |

一句话：

> **TAgent = Pi 内核 + 成熟外围；kscc = 可选的公司额度通道，不定义 TAgent 是什么。**

### 1.4 为何不能「明天全切 Pi + bare」

`kscc --bare` 作为模型泵的**生产表现尚未充分验证**（见 §3）。  
内网是推广主战场，**不能用不确定路径赌生产体验**。

因此采用：**信息不足时用双核换时间；用分支验证 bare；门禁通过再全 Pi。**

### 1.5 与 Proma 分道：从「同源跟进」到「自研产品」

#### 事实判断

TAgent 基座历史上来自 Proma（融合架构见 ADR-0001），但演进至今：

| 层次 | 现状（2026-07 认知） |
|------|----------------------|
| **外围 / 产品** | 已大幅自研或重写：记忆 L0–L5 与自进化、看板与 worker、TA 模式与工具链、kscc 内网渠道、Design Preview / 画布、Automation、多 IM 桥、UI 与 `@tagent/ui` 材质体系、权限与 Composer 体验等 |
| **底层 / 运行时** | 仍大量共用「Claude Agent SDK + Orchestrator 形状」这一类基座假设；部分打包、适配器模式可参考 Proma |
| **品牌与数据** | 早已是 TAgent / `~/.tagent/`，文档与代码禁止 Proma 品牌串 |

也就是说：**产品身份早已不是「套壳 Proma」**；尚未彻底独立的，主要是 **Agent Runtime 内核**。

#### 走 Pi 意味着什么

选择 Pi 为内核、并逐步放弃「整核 Claude Agent SDK」，在工程上等于：

1. **不再默认跟进** Proma 对 Claude Agent SDK 版本、CLI 行为、SDK-only 能力的同步节奏。  
2. **不再把**「与 Proma Agent 路径行为一致」当作发布门槛（kscc 过渡期除外）。  
3. 上游（含 Proma）仅作 **可选参考**：工具思路、UI 模式、双 runtime 路由形状等可 **借鉴**，但 **不承诺** 合并回馈或长期 API 对齐。  
4. 对外与对内叙事转为：**TAgent 自研 Agent 产品**（领域 + 桌面体验 + 自管内核），基座历史仅作溯源说明。

#### 仍允许的「弱耦合」

| 可做 | 不可做 |
|------|--------|
| 只读参考 `F:\Proma` 某次提交的适配器结构 | 把 TAgent 路线图绑死在 Proma release |
| 吸收单个 bugfix / 交互灵感（注明来源） | 要求每个 TAgent PR「对齐 Proma 主分支」 |
| 阶段 1 双核时 Claude 路径与历史实现兼容 | 以 Proma 是否上 Pi 决定 TAgent 是否上 Pi |
| 开源协议与法律义务范围内的合规使用 | 品牌、包名、用户数据路径回退到 Proma |

#### 对双核策略的含义

- **阶段 1 双核** 是 **自研迁移的缓冲**，不是「继续当 Proma 双轨下游」。  
- Proma 若继续双 runtime 或最终全 Pi，与 TAgent **无关强制同步**；TAgent 按本文门禁走自己的阶段 2–4。  
- 文档与 CODEOWNERS 层面：Agent Runtime 变更以 **TAgent 设计文档 + 本 ADR** 为准，不以 Proma CLAUDE.md 为准。

#### 一句话

> **外围已经是 TAgent；换 Pi 内核是补上「真正自研」的最后一跃。与 Proma 分道是预期结果，不是意外副作用。**

---

## 2. 决策

### 2.1 路线总览

```text
阶段 0  现状
  └ 全量 Claude Agent SDK（含 kscc）

阶段 1  短期双核（默认交付）  ← 当前应执行
  ├ 外部渠道 → Pi runtime
  └ kscc-internal → Claude runtime（现状，零行为回归目标）

阶段 2  分支实验（默认不进生产主路径）
  └ kscc → Pi + KsccBareProvider（kscc -p --bare …）

阶段 3  dogfood / 内测
  └ 过 §7 门禁

阶段 4  全 Pi
  └ kscc 默认走 bare 泵（或未来 HTTP 白名单）
  └ 可移除 Claude Agent SDK（或留紧急回退一版）

产品身份（全程）
  └ 与 Proma Agent Runtime 分道；TAgent 按自研产品演进（§1.5）
```

### 2.2 阶段 1 硬规则

| 规则 | 说明 |
|------|------|
| **按渠道路由 runtime** | `kscc-internal` → `claude`；其余 Agent 兼容渠道 → `pi`（可配置覆盖，但 kscc 默认锁定 claude） |
| **会话元数据** | 持久化 `agentRuntime: 'claude' \| 'pi'`；切换 runtime 必须清除旧 `sdkSessionId` / Pi session id，历史 JSONL 可回填 |
| **新能力默认只加 Pi** | 双核期禁止在 Claude 路径堆新的仅 Claude 能力；Claude/kscc 只修 bug 与兼容 |
| **SDKMessage 兼容层** | 渲染层 / Jotai / 持久化继续吃统一消息协议，避免 UI 分叉 |
| **kscc 行为冻结** | 阶段 1 不改 kscc spawn 语义、不改「完整 Agent」假设 |
| **不锁步 Proma Runtime** | 排期与验收不以「对齐 Proma」为条件；见 §1.5 / §4.7 |

### 2.3 阶段 2+ 目标形态（kscc 泵）

```text
Pi loop（唯一 Agent 环）
  ├ tools / permissions / memory / compact → TAgent + Pi
  └ model completion:
       KsccBareProvider
         spawn: kscc -p --bare --verbose
                --max-turns 1
                --tools <显式零工具，参数以实测钉死为准>
                --output-format stream-json
         parse: thinking / text / usage / result
```

**硬约束**：Tool use 只在 Pi；kscc 不得再执行 Bash/Read/Edit 等内置工具环。

---

## 3. 调研结论（2026-07-18 本机试探，摘要）

> 细节与命令可复现；**禁止在文档或提交中写入真实 token**。

### 3.1 公司网关

| 发现 | 结论 |
|------|------|
| 本地 `~/.claude/settings.json` 含 `BASE_API`、`ANTHROPIC_AUTH_TOKEN` / `KSCC_AUTH_TOKEN` | 额度与入口配置存在 |
| 直连 `BASE_API` + token → `POST /v1/messages` | **403 `ClientForbidden`（客户端禁用）** |
| 仅 `x-api-key` | **403 `ApiKeyForbidden`** |
| 多种 User-Agent / 客户端头伪装 | 仍 403 |
| `kscc -p` 同模型短问答 | **成功**（额度可用） |

**含义**：不能假设 Pi 可像普通 Anthropic 兼容网关一样 HTTP 直连；在获管理员**客户端/应用白名单**前，**必须经 kscc 官方客户端**入网。

### 3.2 `kscc --bare` 泵能力

| 项 | 结果 |
|----|------|
| `--bare` 可用性 | ✅ 可用；系统注入明显轻于非 bare |
| `stream-json` | ✅ 需同时 `--verbose`，否则报错 |
| thinking | ✅ 有 `thinking` content block + `thinking_tokens` 系统事件 |
| 流式粒度 | ⚠️ **事件/块级**为主；本机粗测 `text_delta` / `content_block_delta` ≈ 0，**弱于**当前 TAgent SDK `includePartialMessages` 打字机 |
| 默认 tools | ⚠️ init 仍见 `Bash` / `Edit` / `Read`；要求「列目录」时 **仍走 tool 路径** |
| 与「纯 LLM」差距 | `--bare` ≠ 无工具；必须再 **显式关工具 + max-turns 1** |

### 3.3 与「当下 TAgent 调用」对照（摘要）

| 维度 | 当下 TAgent（kscc） | bare 泵（目标） |
|------|---------------------|-----------------|
| 入口 | Claude Agent SDK `query` | 薄 Provider spawn CLI |
| Agent 环主人 | kscc / Claude Code | **Pi** |
| Tool 主人 | kscc + MCP（`canUseTool` 问 TAgent） | **仅 Pi** |
| 流式 | SDK partial / text_delta | NDJSON 块事件（待优化） |
| 系统开销 | 重（MCP/resume/大 prompt） | 较轻（仍 > 真 HTTP） |
| 与「只要额度」 | 低匹配 | 高匹配 |

### 3.4 方案对比（为何短期选双核）

| 方案 | 优势 | 劣势 | 短期采用？ |
|------|------|------|------------|
| **A 双核**：外 Pi / kscc 现状 | 内网零回归、推广稳、Pi 可先外网验证 | 双栈维护税、自管只完成一半 | ✅ **阶段 1** |
| **B 全 Pi + bare** | 架构统一、真自管、可删 SDK | bare 未验证、流式/零工具风险、内网回归大 | ⏳ **阶段 2–4** |
| 永久双核无终点 | 看似稳 | 双栈永久化、新功能加倍 | ❌ 禁止 |

---

## 4. 架构设计

### 4.1 目标分层

```text
┌─────────────────────────────────────────────┐
│ TAgent 产品外壳                              │
│ 记忆 L0–L5 / 看板 / 权限 UI / IPC / Jotai…   │
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│ AgentOrchestrator（统一编排，尽量 runtime 无关）│
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│ RuntimeRoutingAgentAdapter                   │
│   agentRuntime: 'claude' | 'pi'              │
├──────────────────┬──────────────────────────┤
│ ClaudeAgentAdapter│ PiAgentAdapter            │
│ (现状，kscc 用)   │ (新建，外网阶段 1 用)     │
└────────┬─────────┴────────────┬─────────────┘
         │                      │
    spawn kscc/claude      Pi loop + HTTP providers
    完整 Agent 平台         (+ 阶段 2: KsccBareProvider)
         │                      │
         └──────────┬───────────┘
                    ▼
         统一 SDKMessage 兼容流 → EventBus / UI
```

参考上游：`F:\Proma` 的 `RuntimeRoutingAgentAdapter` + `PiAgentAdapter`（`@earendil-works/pi-*`），**可借鉴形状，不可照搬品牌/路径/kscc 假设**。

### 4.2 Runtime 选择规则（阶段 1）

```text
function resolveAgentRuntime(channel, sessionMeta, settings):
  if sessionMeta.agentRuntime locked by user experiment flag:
    return that  # 仅开发/旗标
  if channel.provider == 'kscc-internal':
    return 'claude'   # 硬默认，阶段 1 不可被静默改成 pi
  return settings.defaultAgentRuntime ?? 'pi'
```

### 4.3 会话与 resume

| 事件 | 行为 |
|------|------|
| 新建会话 | 写入 `agentRuntime` |
| 同 runtime 续聊 | 使用对应 resume / session 机制 |
| 切换 runtime | **清除**旧 runtime 的 session id；可选把近期消息回填为上下文 |
| 切换渠道跨越 kscc↔外网 | 建议提示「内核可能变化」；默认按新渠道路由 |

### 4.4 消息协议

- 对内继续 **SDKMessage 兼容形态**（与现 JSONL / 渲染一致）。  
- Pi 适配器负责 Pi 事件 → SDKMessage。  
- bare 泵（阶段 2）负责 CLI NDJSON → 增量 assistant / thinking / result。

### 4.5 外围能力归属（阶段 1）

| 能力 | Claude/kscc 路径 | Pi 路径 |
|------|------------------|---------|
| 权限 UI / canUseTool | 现状 | Pi 需桥接同等体验（P0） |
| 工作区 MCP | SDK `mcpServers` | Pi custom tools / MCP 桥（对齐外网能力清单） |
| 记忆 L0–L5 / Nudge | 编排层注入 prompt（两边共用策略） | 同左；注意 Prompt 组装顺序与 cache 约束在 Pi 侧重新定义 |
| 看板 / SubAgent | SDK agents + 编排 | Pi 侧等价或分阶段降级（文档化差距） |
| Context 圆环 | 流式 usage 近似 | Pi 侧自有 ledger（推荐） |
| 压缩 | SDK + 客户端兜底 | Pi 原生 compact + 客户端策略 |

**允许的能力差距**：阶段 1 允许 Pi 路径在 SubAgent/部分 MCP 上弱于 Claude，但必须在 UI/文档标明；**不允许** kscc 路径回归。

### 4.6 新功能纪律（防双核永久化）

1. 新 Agent 能力 **默认只实现 Pi**。  
2. Claude 路径仅：安全修复、kscc 兼容、崩溃级 bug。  
3. 每个双核相关 PR 描述必须写：`runtime: pi | claude | both`。  
4. 阶段 1 完成时在 PROGRESS 登记「双核债务清单」。

### 4.7 与 Proma 协作纪律（分道后）

1. **默认不跟** Proma Agent Runtime 升级；若借鉴，在 PR 中写清参考的 Proma commit/PR，并声明行为以 TAgent 为准。  
2. **禁止**将「Proma 已合并」单独作为 TAgent 必做理由；必须有 TAgent 用户价值或 kscc/安全理由。  
3. 融合期遗留的 `align upstream` / borrow-list 类任务：**Runtime 相关项重新分级**——仅工具/体验灵感可保留，SDK 锁步项标记为 **won't track** 或迁出默认路线图。  
4. 对外说明可用简式：TAgent 曾融合 Proma 基座；产品层已自研；Agent 内核迁移至 Pi 后独立演进。

---



## 5. 阶段 1 实现范围（外部 Pi + kscc 现状）

### 5.1 建议工作包

| ID | 工作包 | 说明 |
|----|--------|------|
| P1-1 | 类型与元数据 | `AgentRuntime`、`session.agentRuntime`、settings 默认值 |
| P1-2 | RuntimeRouting | Orchestrator 只依赖 `AgentProviderAdapter` |
| P1-3 | Pi 依赖与打包 | `@earendil-works/pi-*` external + `sync:runtime-deps` / electron-builder 规则 |
| P1-4 | PiAgentAdapter | query / abort / interrupt / 权限桥 / 基础 tools |
| P1-5 | 模型 registry | 外网渠道 → Pi provider（OpenAI/Anthropic/…） |
| P1-6 | 路由策略 | kscc 强制 claude；其它默认 pi |
| P1-7 | UI | 可选：runtime 标识（开发者可见）；用户侧可先隐藏 |
| P1-8 | 测试 | 路由单测 + 外网冒烟清单；**kscc 回归清单全绿** |
| P1-9 | 文档 | 本文 + ADR + PROGRESS 入口 |

### 5.2 阶段 1 非目标

- KsccBareProvider  
- 删除 Claude Agent SDK  
- 改变 kscc 安装/认证模型  
- 强制所有历史会话迁移到 Pi  

### 5.3 验收（阶段 1）

- [ ] 非 kscc 渠道默认走 Pi，主路径：对话、流式、取消、基础读改、权限弹窗  
- [ ] kscc 渠道行为与改前一致（权限 / MCP / 流式 / resume 抽检）  
- [ ] 切换 runtime 不串 session id  
- [ ] typecheck / 关键单测通过  
- [ ] PROGRESS 与 ADR 已链到本文  

---

## 6. 阶段 2 实现范围（分支：kscc bare 泵）

### 6.1 Provider 职责

`KsccBareProvider`（名称可调整）**只做**：

1. 解析本地 kscc 可用性（复用 `kscc-service`）  
2. 组装 CLI 参数（bare / verbose / stream-json / model / max-turns / 零工具）  
3. spawn + 解析 NDJSON  
4. 映射 thinking / text / usage / 错误  
5. 支持 abort（杀子进程）  

**不做**：Agent 多 turn、MCP、权限环、resume 长会话、SubAgent。

### 6.2 必须先钉死的 CLI 契约

在合并默认路径前，用固定脚本锁定：

| 契约 | 要求 |
|------|------|
| 零工具 | 要求「执行 Bash 列目录」时 **无 tool 执行**；仅文本拒绝或 Pi 侧 tool |
| thinking | stream 中可解析 thinking 或明确降级策略 |
| 流式 | 定义可接受延迟与 UI 策略（块显示 / 本地平滑） |
| 取消 | 用户停止后进程退出、无僵尸 |
| 并发 | 多会话同时泵的资源上限 |

### 6.3 与「申请 HTTP 白名单」并行（可选加速终点）

若公司开放应用客户端或机器凭证直连 `BASE_API`：

- Pi 可对 kscc 额度走 **真 HTTP SSE**（优于 bare）  
- bare 泵可退役  

该路径依赖组织协作，**不阻塞阶段 1**。

---

## 7. 门禁（阶段 2 → 默认 kscc=Pi 泵 → 全 Pi）

以下全部满足才允许将 kscc 默认从 Claude 现状切到 Pi+bare（或 HTTP）：

| # | 门禁 | 过线标准 |
|---|------|----------|
| G1 | 零工具 | 自动化/手工用例证明 kscc 侧不执行内置 tool |
| G2 | 流式可接受 | 内测评分或对照：不低于「可日常使用」阈值；thinking 可见策略明确 |
| G3 | 主路径等价 | 读改文件、权限拒绝、取消、常见 MCP（已迁 Pi 的）不阻断工作 |
| G4 | 稳定性 | 约定 dogfood 窗口（建议 ≥ 5–10 个工作日）无 P0 挂死 |
| G5 | 资源 | 无进程泄漏；异常退出可回收 |
| G6 | 文档 | 用户/内部说明：内网通道能力与外网 Pi 差异（若有） |
| G7 | 回退 | 一键或设置项可退回 kscc=Claude 现状（至少一个版本） |

**任一门禁不过 → kscc 保持 Claude 现状。**

全 Pi 并移除 SDK 额外要求：

- G1–G7 已通过且默认 kscc 已是 Pi 路径  
- 外网 Pi 已成为主力且稳定  
- 打包体积与启动路径验证完成  

---

## 8. 风险与缓解

| 风险 | 阶段 | 缓解 |
|------|------|------|
| 双核永久化 | 1 | 新能力只加 Pi；设阶段 2 日程与门禁，不设「无限双轨」 |
| Pi 外网能力弱于 Claude | 1 | 差距清单 + UI 标明；P0 能力对齐优先 |
| bare 流式差导致内网体感回退 | 2 | 门禁 G2；UI 平滑；并行申请 HTTP |
| bare 仍执行 tool | 2 | G1 阻断合并；CLI 参数矩阵测试 |
| 维护两套 prompt | 1–2 | 共享业务规则段落；runtime 专用段隔离 |
| 打包双 runtime 体积 | 1 | 对齐 Proma external + sync 策略 |
| 合规：伪造客户端 | 全程 | **禁止**；只走官方 CLI 或正式白名单 |

---

## 9. 对现有子系统的影响

| 子系统 | 阶段 1 | 阶段 2+ |
|--------|--------|---------|
| kscc 安装引导 | 不变 | 文案可增加「额度通道」表述 |
| 记忆系统 | prompt 注入共用；Pi 侧遵守自管 context | 同左 |
| 看板 / worker | 可暂留 Claude 或分 runtime | worker 优先 Pi |
| BTW / Ask | 各跟其 runtime 规则；kscc 会话 BTW 仍可走 Claude 栈 | 随全 Pi 统一 |
| Prompt Cache 宪章 | Claude 路径仍适用；Pi 路径另建「前缀稳定」规范 | 以 Pi 为准 |
| 自动更新 / 打包 | 增加 Pi native/依赖规则 | 可移除 Claude binary |

---

## 10. 测试策略

### 10.1 阶段 1

- 单元：runtime 路由、session 元数据、切换清 id  
- 集成：Mock adapter 两套  
- 手工：  
  - 外网 Pi 主路径冒烟  
  - **kscc 回归清单**（权限、MCP、长回复流式、中断、resume）  

### 10.2 阶段 2

- CLI 契约脚本（零工具 / stream / abort）  
- Provider 解析 golden files（脱敏 NDJSON 样例）  
- 对照同一任务：Claude-kscc vs Pi-bare 的 turns / 体感 / 错误率  

---

## 11. 里程碑建议（可调）

| 里程碑 | 内容 | 退出标准 |
|--------|------|----------|
| M1 | 本文 + ADR 评审通过 | 方向锁定 |
| M2 | 阶段 1 双核可跑（默认外 Pi / 内 Claude） | §5.3 验收 |
| M3 | 外网 Pi 稳定 dogfood | 无 P0；能力差距可接受 |
| M4 | 阶段 2 分支 bare 泵可演示 | G1 至少通过 |
| M5 | bare dogfood | G1–G6 |
| M6 | kscc 默认切换 + 回退开关 | G7 |
| M7 | 全 Pi / 移除 SDK（可选拆 PR） | §7 全量条件 |

---

## 12. 开放问题

1. 阶段 1 外网是否 **强制** Pi，还是设置里可切回 Claude（非 kscc）？  
   - 建议：默认 Pi，高级设置可回退 Claude 一版，便于对比。  
2. 看板 worker 在双核期是否允许「父 Pi / 子 Claude」混跑？  
   - 建议：阶段 1 同会话 runtime 一致，降低复杂度。  
3. `--tools` 零工具的最终 CLI 写法以何为准？  
   - 阶段 2 启动时用矩阵脚本钉死，写入本文附录。  
4. 公司 HTTP 白名单推进 owner 是谁？  
   - 产品/接口人待填。  

---

## 13. 附录

### 13.1 复现命令（脱敏）

```bash
# 额度可用（完整 CLI）
kscc -p --output-format json --model <model> "reply with pong"

# 轻量（仍可能带 tools）
kscc -p --bare --output-format json --model <model> "..."

# 流式事件（必须 verbose）
kscc -p --bare --verbose --output-format stream-json --model <model> "..."
```

### 13.2 关键代码锚点（现状）

| 路径 | 职责 |
|------|------|
| `apps/electron/src/main/lib/agent-orchestrator.ts` | 编排、kscc cliPath、MCP、thinking/effort |
| `apps/electron/src/main/lib/adapters/claude-agent-adapter.ts` | SDK query、spawn、partial |
| `apps/electron/src/main/lib/kscc-service.ts` / `kscc-config.ts` | 安装检测、模型列表 |
| `packages/shared/src/types/channel.ts` | `kscc-internal` provider |

### 13.3 上游可参考文件（只读 `F:\Proma`）

| 路径 | 用途 |
|------|------|
| `apps/electron/src/main/lib/adapters/runtime-routing-agent-adapter.ts` | 路由形状 |
| `apps/electron/src/main/lib/adapters/pi-agent-adapter.ts` | Pi session / 事件 |
| `apps/electron/src/main/lib/adapters/pi-model-registry.ts` | 渠道映射 |
| `apps/electron/src/main/lib/adapters/pi-mcp-tools.ts` | MCP 桥 |

---

## 14. 变更记录

| 日期 | 变更 |
|------|------|
| 2026-07-18 | 初稿：双核短期策略、bare 调研摘要、阶段门禁、与现状调用对照 |
| 2026-07-18 | 补充 §1.5 / §2.1.6 / §4.7：走 Pi 后与 Proma 分道、自研产品叙事与协作纪律 |
