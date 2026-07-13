/**
 * 消息流渲染组件
 *
 * 完全对照 glass-studio/tagent.html 的消息格式实现
 * 支持：
 * - 用户消息（msg-user）
 * - Assistant Turn：执行过程（process-group）+ 最终回答（answer）
 * - 思考块（think-block）
 * - 工具调用行（tool-row）
 * - Markdown 回答流（answer-stream）
 * - 文件变更（turn-footer）
 */

import React, { useState, useEffect, useRef } from 'react'

// ===== 类型定义 =====

export interface ToolCall {
  id: string
  type: 'read' | 'edit' | 'bash' | 'search' | 'write' | 'other'
  status: 'running' | 'done' | 'error'
  phrase: string
  file?: string
  diffStats?: { additions: number; deletions: number }
  duration?: number
}

export interface ThinkBlock {
  id: string
  state: string
  content: string
}

export interface AnswerBlock {
  type: 'paragraph' | 'list' | 'code' | 'table' | 'blockquote' | 'file-chips'
  content: any
}

export interface FileChange {
  file: string
  additions: number
  deletions: number
}

export interface Turn {
  id: string
  type: 'user' | 'assistant'
  content?: string // for user message

  // for assistant turn
  process?: {
    isOpen: boolean
    thinkBlock?: ThinkBlock
    toolCalls: ToolCall[]
    duration: number
    toolCount: number
  }
  answer?: {
    blocks: AnswerBlock[]
    isStreaming: boolean
  }
  fileChanges?: FileChange[]
}

// ===== 主组件 =====

interface MessageStreamProps {
  turns: Turn[]
  isStreaming?: boolean
}

export function MessageStream({ turns, isStreaming }: MessageStreamProps) {
  const messagesRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [turns])

  return (
    <div className="messages" ref={messagesRef}>
      {turns.map((turn, i) => (
        turn.type === 'user' ? (
          <div key={turn.id || i} className="msg msg-user">
            {turn.content}
          </div>
        ) : (
          <AssistantTurn key={turn.id || i} turn={turn} />
        )
      ))}
    </div>
  )
}

// ===== Assistant Turn 组件 =====

interface AssistantTurnProps {
  turn: Turn
}

function AssistantTurn({ turn }: AssistantTurnProps) {
  const [processOpen, setProcessOpen] = useState(turn.process?.isOpen ?? true)

  if (!turn.process) {
    // 简单回答，无执行过程
    return (
      <div className="turn">
        <div className="answer">
          <div className="answer-stream">
            {turn.content}
          </div>
        </div>
      </div>
    )
  }

  const { process, answer, fileChanges } = turn
  const runningTools = process.toolCalls.filter(t => t.status === 'running')

  return (
    <div className="turn">
      {/* 执行过程 */}
      <div className={`process-group ${processOpen ? 'is-open' : ''}`}>
        <button
          type="button"
          className="process-summary"
          aria-expanded={processOpen}
          onClick={() => setProcessOpen(!processOpen)}
        >
          <span className="process-caret" aria-hidden="true"></span>
          <span className="process-label">
            执行过程：{process.toolCount || process.toolCalls.length} 次工具调用
            {process.thinkBlock && '，1 条思考'}
          </span>
          <span className="process-meta">{process.duration}s</span>
        </button>

        <div className="process-body">
          {/* 思考块 */}
          {process.thinkBlock && (
            <ThinkBlockComponent block={process.thinkBlock} />
          )}

          {/* 工具调用列表 */}
          {process.toolCalls.map(tool => (
            <ToolRow key={tool.id} tool={tool} />
          ))}
        </div>
      </div>

      {/* 最终回答 */}
      <div className="answer">
        <div className={`answer-stream ${answer?.isStreaming ? 'is-typing' : ''}`}>
          {answer?.blocks.map((block, i) => (
            <AnswerBlockComponent key={i} block={block} />
          ))}
        </div>

        {/* Turn 底部：文件变更 + 操作 */}
        {(fileChanges && fileChanges.length > 0) && (
          <div className="turn-footer">
            <div className="file-changes">
              {fileChanges.map(change => (
                <span key={change.file} className="change-chip">
                  {change.file}
                  <em>+{change.additions}</em>
                  <i>-{change.deletions}</i>
                </span>
              ))}
            </div>
            <div className="turn-actions">
              {runningTools.length > 0 && (
                <span className="running-badge">
                  <span className="tool-spinner sm"></span>
                  运行中 {process.duration}s
                </span>
              )}
              <button type="button">复制</button>
              <button type="button">分叉</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ===== 思考块组件 =====

interface ThinkBlockComponentProps {
  block: ThinkBlock
}

function ThinkBlockComponent({ block }: ThinkBlockComponentProps) {
  return (
    <div className="think-block">
      <div className="think-head">
        <span className="think-badge">思考</span>
        <span className="think-state shiny">{block.state}</span>
      </div>
      <div className="think-content">
        {block.content}
      </div>
    </div>
  )
}

// ===== 工具行组件 =====

interface ToolRowProps {
  tool: ToolCall
}

function ToolRow({ tool }: ToolRowProps) {
  return (
    <div className={`tool-row ${tool.status === 'running' ? 'is-running' : 'is-done'}`}>
      {tool.status === 'running' ? (
        <span className="tool-spinner" aria-hidden="true"></span>
      ) : (
        <span className="tool-icon" aria-hidden="true">
          {getToolIcon(tool.type)}
        </span>
      )}
      <span className={`tool-phrase ${tool.status === 'running' ? 'shiny' : ''}`}>
        {tool.phrase}
        {tool.file && <button type="button" className="file-chip">{tool.file}</button>}
      </span>
      {tool.diffStats && tool.status === 'running' && (
        <span className="diff-stats">
          <em>+{tool.diffStats.additions}</em>
          <i>-{tool.diffStats.deletions}</i>
        </span>
      )}
    </div>
  )
}

function getToolIcon(type: ToolCall['type']) {
  switch (type) {
    case 'read':
      return <svg viewBox="0 0 24 24" fill="none"><path d="M5 7.5A1.5 1.5 0 0 1 6.5 6H10l2 2h5.5A1.5 1.5 0 0 1 19 9.5v7A1.5 1.5 0 0 1 17.5 18h-11A1.5 1.5 0 0 1 5 16.5v-9Z" stroke="currentColor" strokeWidth="1.5"/></svg>
    case 'edit':
      return <svg viewBox="0 0 24 24" fill="none"><path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5M18.5 2.5a2.121 2.121 0 0 1 3 3L12 17l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.5"/></svg>
    case 'bash':
      return <svg viewBox="0 0 24 24" fill="none"><path d="M7 7h10M7 12h7M7 17h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5"/></svg>
    case 'search':
      return <svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="M16 16l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    default:
      return <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5"/></svg>
  }
}

// ===== 回答块组件 =====

interface AnswerBlockComponentProps {
  block: AnswerBlock
}

function AnswerBlockComponent({ block }: AnswerBlockComponentProps) {
  switch (block.type) {
    case 'paragraph':
      return <p>{block.content}</p>

    case 'list':
      return (
        <>
          {block.content.items.map((item: string, i: number) => (
            <li key={i}>{item}</li>
          ))}
        </>
      )

    case 'code':
      return (
        <div className="code-block">
          <div className="code-head">
            <span>{block.content.language}</span>
            <button type="button" className="code-copy">复制</button>
          </div>
          <pre><code>{block.content.code}</code></pre>
        </div>
      )

    case 'table':
      return (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {block.content.headers.map((h: string, i: number) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.content.rows.map((row: string[], i: number) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )

    case 'blockquote':
      return <blockquote>{block.content}</blockquote>

    case 'file-chips':
      return (
        <p>
          相关文件：
          {block.content.map((file: string, i: number) => (
            <button key={i} type="button" className="file-chip">{file}</button>
          ))}
        </p>
      )

    default:
      return null
  }
}