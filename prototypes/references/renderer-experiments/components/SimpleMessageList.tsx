/**
 * 简化的消息列表组件
 *
 * 直接渲染 SDKMessage 数组，不依赖复杂的 atoms
 */

import React, { useEffect, useRef } from 'react'

interface SDKMessage {
  type: 'message' | 'result' | 'system'
  role?: 'user' | 'assistant'
  content?: string
  message?: {
    role?: 'user' | 'assistant'
    content?: string | any[]
  }
}

interface SimpleMessageListProps {
  messages: SDKMessage[]
}

export function SimpleMessageList({ messages }: SimpleMessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages])

  // 提取消息内容
  const extractContent = (msg: SDKMessage): string => {
    // 直接 content 字段
    if (typeof msg.content === 'string') {
      return msg.content
    }

    // message.content 字段
    if (msg.message?.content) {
      if (typeof msg.message.content === 'string') {
        return msg.message.content
      }
      if (Array.isArray(msg.message.content)) {
        // content block 数组
        return msg.message.content
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text || '')
          .join('\n')
      }
    }

    return ''
  }

  // 获取角色
  const getRole = (msg: SDKMessage): 'user' | 'assistant' => {
    if (msg.role) return msg.role
    if (msg.message?.role) return msg.message.role
    return msg.type === 'message' ? 'assistant' : 'assistant'
  }

  return (
    <div className="messages" ref={containerRef}>
      {messages.map((msg, i) => {
        const content = extractContent(msg)
        const role = getRole(msg)

        return (
          <div key={i} className={`msg ${role === 'user' ? 'msg-user' : ''}`}>
            {content}
          </div>
        )
      })}
    </div>
  )
}
