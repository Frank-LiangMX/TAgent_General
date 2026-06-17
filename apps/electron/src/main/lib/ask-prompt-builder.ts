/**
 * Ask 档位系统提示构建器
 *
 * 为每次 Ask 请求组装完整 system prompt：
 * 1. **Ask 权限契约**：明确边界（不能写文件、不能执行命令、不能 MCP/Skills）
 * 2. **越界引导**：检测到需要动手 → 调 suggest_agent_switch
 * 3. **主会话上下文注入**：从 SDK 历史抽取最近 N 轮，转换为 ChatMessage history
 * 4. **可选工具说明**：当前只开放 suggest_agent_switch（P1 补 web-search/memory）
 *
 * 与 btw-service 共用 convertSDKMessagesToChatHistory 抽取逻辑。
 */

import { getAgentSessionSDKMessages } from './agent-session-manager'
import { convertSDKMessagesToChatHistory } from './btw-service'

/** Ask 默认上下文轮数（与 BTW 对齐，20 轮） */
export const ASK_DEFAULT_CONTEXT_TURNS = 20

/**
 * Ask 权限契约的静态部分（与上下文无关）
 *
 * 注入到主 system prompt 中，控制模型行为：
 * - 知道边界
 * - 越界时引导切换 Agent
 * - 不假装已经完成文件操作/命令执行
 */
export const ASK_PERMISSION_CONTRACT = `<ask_mode_contract>
你现在处于 **Ask 档位**（Composer 档位），不是 Agent 档位。这是用户明确选择的轻量对话模式。

## 你能做的事

- 阅读并理解用户提供的文本、图片、文件附件（用户已上传的内容）
- 基于上下文回答问题、解释概念、总结内容、给出建议
- 调用 \`suggest_agent_switch\` 工具，引导用户切到 Agent 档位（用于需要动手的任务）
- （可选）调用 \`web-search\` 进行联网检索，调用 \`memory\` 检索相关记忆

## 你不能做的事

- **不能读写文件**：不能创建、修改、删除任何文件
- **不能执行命令**：不能运行 shell、不能安装依赖、不能调用构建/测试工具
- **不能使用 MCP**：不能连接任何外部数据源、API、数据库
- **不能使用 Skills**：不能执行工作区里注册的 Skills
- **不能运行 TA 工具**：任何 \`ta-*\` 工具在 Ask 下都不可用

## 越界时怎么办

当你判断用户的任务**必须**动手才能完成（写代码、跑命令、查数据库、生成图片…）时：

1. 先用一句话告诉用户：「这个任务需要 Agent 档位才能完成（具体原因）」
2. 调用 \`suggest_agent_switch\` 工具，传入：
   - \`reason\`：具体说明 Agent 档位如何帮用户达成目标（结合用户的任务，不要泛泛而谈）
   - \`suggestedPrompt\`：把用户的核心诉求整理成一条 Agent 初始提示
3. **仍然给用户文字版的思路或方案**，并在末尾标注「（未实际执行）」

## 不要假装

- 不要描述自己"刚刚修改了文件"——Ask 下你根本没这个权限
- 不要伪造命令执行结果
- 不要假装调用了你没有的工具

违反这些约定会破坏用户对系统的信任。
</ask_mode_contract>`

/**
 * 构建 Ask 上下文 prompt（动态部分：上下文窗口说明 + 历史摘要）
 */
function buildContextPrompt(agentSessionId: string, maxContextTurns: number): string {
  const contextLines: string[] = []

  try {
    const sdkMessages = getAgentSessionSDKMessages(agentSessionId)
    const history = convertSDKMessagesToChatHistory(sdkMessages, maxContextTurns)
    if (history.length > 0) {
      const lastN = history.slice(-maxContextTurns * 2)
      const summary = lastN
        .map((m) => `[${m.role}] ${m.content.slice(0, 800)}${m.content.length > 800 ? '…' : ''}`)
        .join('\n\n')
      contextLines.push(
        `<agent_session_history agentSessionId="${agentSessionId}">\n以下是该 Agent 会话最近 ${maxContextTurns} 轮对话（用于上下文理解，Ask 不能直接复用这些工具调用）：\n\n${summary}\n</agent_session_history>`
      )
    }
  } catch (err) {
    console.warn(`[Ask Prompt] 读取主会话上下文失败:`, err)
  }

  return contextLines.join('\n\n')
}

/**
 * 构建完整的 Ask system prompt
 */
export function buildAskSystemPrompt(agentSessionId: string, override?: string): string {
  if (override && override.trim()) {
    return override
  }

  const contextPrompt = buildContextPrompt(agentSessionId, ASK_DEFAULT_CONTEXT_TURNS)

  return [ASK_PERMISSION_CONTRACT, contextPrompt].filter(Boolean).join('\n\n')
}

/**
 * 暴露给单元测试的纯函数版本（不依赖 getAgentSessionSDKMessages）
 */
export function buildAskSystemPromptWithHistory(
  sdkMessages: ReadonlyArray<unknown>,
  maxContextTurns: number,
  override?: string
): string {
  if (override && override.trim()) {
    return override
  }

  // 将 SDKMessage[] 视为 unknown[] 交给 convertSDKMessagesToChatHistory
  const history = convertSDKMessagesToChatHistory(
    sdkMessages as Parameters<typeof convertSDKMessagesToChatHistory>[0],
    maxContextTurns
  )
  let contextPrompt = ''
  if (history.length > 0) {
    const lastN = history.slice(-maxContextTurns * 2)
    const summary = lastN
      .map((m) => `[${m.role}] ${m.content.slice(0, 800)}${m.content.length > 800 ? '…' : ''}`)
      .join('\n\n')
    contextPrompt = `<agent_session_history>\n以下是该 Agent 会话最近 ${maxContextTurns} 轮对话：\n\n${summary}\n</agent_session_history>`
  }

  return [ASK_PERMISSION_CONTRACT, contextPrompt].filter(Boolean).join('\n\n')
}

/**
 * Ask 启动提示：告知用户这是 Ask 档位
 *
 * 单独发到对话开头，避免影响 LLM 行为（让契约在 system prompt 里约束 LLM，而不是用户消息里）。
 * 保留此函数供后续 UI 提示用。
 */
export const ASK_MODE_GREETING_HINT =
  '当前为 Ask 档位：只对话，不修改文件或执行命令。需要动手请切到 Agent 档位。'
