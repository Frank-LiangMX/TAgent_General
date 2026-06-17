/**
 * WPS 协作加解密与签名工具
 */

import { createHash, createHmac, createDecipheriv, timingSafeEqual } from 'node:crypto'

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    return false
  }
}

export function calculateEventSignature(
  appId: string,
  secretKey: string,
  topic: string,
  nonce: string,
  time: number,
  encryptedData: string
): string {
  const content = `${appId}:${topic}:${nonce}:${time}:${encryptedData}`
  return createHmac('sha256', secretKey)
    .update(content, 'utf8')
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

export function verifyEventSignature(
  appId: string,
  secretKey: string,
  topic: string,
  nonce: string,
  time: number,
  encryptedData: string,
  receivedSignature: string
): boolean {
  const nowSec = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSec - time) > 300) return false
  const expected = calculateEventSignature(appId, secretKey, topic, nonce, time, encryptedData)
  return safeCompare(expected, receivedSignature)
}

export function decryptEventData(secretKey: string, encryptedData: string, nonce: string): string {
  if (!secretKey || !encryptedData || !nonce) {
    throw new Error('解密参数不完整')
  }
  if (nonce.length < 16) {
    throw new Error('nonce 长度不足 16 字节')
  }

  const encryptedBuffer = Buffer.from(encryptedData, 'base64')
  const keyHex = createHash('md5').update(secretKey, 'utf8').digest('hex')
  const key = Buffer.from(keyHex, 'utf8')
  const iv = Buffer.from(nonce, 'utf8').subarray(0, 16)
  const decipher = createDecipheriv('aes-256-cbc', key, iv)
  decipher.setAutoPadding(true)
  return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]).toString('utf8')
}

export function generateKso1AuthHeader(
  appId: string,
  method: string,
  requestUri: string,
  contentType: string,
  ksoDate: string,
  requestBody: string,
  secretKey: string
): string {
  const bodyHash = requestBody ? createHash('sha256').update(requestBody, 'utf8').digest('hex') : ''
  const signContent = `KSO-1${method}${requestUri}${contentType}${ksoDate}${bodyHash}`
  const signature = createHmac('sha256', secretKey).update(signContent, 'utf8').digest('hex')
  return `KSO-1 ${appId}:${signature}`
}
