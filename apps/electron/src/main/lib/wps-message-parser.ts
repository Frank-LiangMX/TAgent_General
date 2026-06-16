/**
 * WPS 协作消息解析
 */

export interface WpsParsedMessage {
  text: string
  chatId: string
  chatType: 'p2p' | 'group'
  messageId: string
  isAtBot: boolean
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function parseWpsMessage(eventData: Record<string, unknown>): WpsParsedMessage {
  const chat = readRecord(eventData.chat)
  const message = readRecord(eventData.message)
  const content = readRecord(message.content)
  const textPart = readRecord(content.text)
  const textRaw = readString(textPart.content)
  const text = textRaw.replace(/<at[^>]*>.*?<\/at>/g, '').trim()

  const mentionsRaw = Array.isArray(message.mentions) ? message.mentions : []
  const isAtBot = mentionsRaw.some((item) => {
    const mention = readRecord(item)
    const identity = readRecord(mention.identity)
    return readString(identity.type) === 'app'
  })

  return {
    text,
    chatId: readString(chat.id),
    chatType: readString(chat.type) === 'group' ? 'group' : 'p2p',
    messageId: readString(message.id),
    isAtBot,
  }
}
