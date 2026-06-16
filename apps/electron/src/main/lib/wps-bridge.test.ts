import { describe, expect, it } from 'bun:test'

import { calculateEventSignature, verifyEventSignature } from './wps-crypto'
import { parseWpsMessage } from './wps-message-parser'

describe('wps-crypto', () => {
  it('calculateEventSignature 与 verifyEventSignature 一致', () => {
    const appId = 'app_test'
    const secretKey = 'secret_test'
    const topic = 'kso.app_chat.message'
    const nonce = 'nonce1234567890ab'
    const time = Math.floor(Date.now() / 1000)
    const encryptedData = 'dGVzdA=='

    const signature = calculateEventSignature(appId, secretKey, topic, nonce, time, encryptedData)
    expect(verifyEventSignature(appId, secretKey, topic, nonce, time, encryptedData, signature)).toBe(true)
  })

  it('过期时间戳应校验失败', () => {
    const appId = 'app_test'
    const secretKey = 'secret_test'
    const topic = 'kso.app_chat.message'
    const nonce = 'nonce1234567890ab'
    const time = Math.floor(Date.now() / 1000) - 600
    const encryptedData = 'dGVzdA=='
    const signature = calculateEventSignature(appId, secretKey, topic, nonce, time, encryptedData)
    expect(verifyEventSignature(appId, secretKey, topic, nonce, time, encryptedData, signature)).toBe(false)
  })
})

describe('wps-message-parser', () => {
  it('解析文本消息并识别 @Bot', () => {
    const parsed = parseWpsMessage({
      chat: { id: 'chat_1', type: 'group' },
      message: {
        id: 'msg_1',
        type: 'text',
        content: { text: { content: '<at>bot</at> 你好', type: 'plain' } },
        mentions: [{ identity: { type: 'app', id: 'bot_1', name: 'Bot' } }],
      },
    })

    expect(parsed.chatId).toBe('chat_1')
    expect(parsed.chatType).toBe('group')
    expect(parsed.isAtBot).toBe(true)
    expect(parsed.text).toBe('你好')
    expect(parsed.messageId).toBe('msg_1')
  })

  it('单聊消息默认可处理', () => {
    const parsed = parseWpsMessage({
      chat: { id: 'chat_p2p', type: 'p2p' },
      message: {
        id: 'msg_2',
        type: 'text',
        content: { text: { content: 'ping', type: 'plain' } },
      },
    })

    expect(parsed.chatType).toBe('p2p')
    expect(parsed.text).toBe('ping')
    expect(parsed.isAtBot).toBe(false)
  })
})
