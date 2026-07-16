/**
 * import-html.ts — Design Preview 外部导入（v2）
 *
 * 设计来源：docs/plans/2026-07-14-design-canvas-v2.md §4.5
 *
 * 支持：
 *  - .html  → 直接解析（提取 <style> 块；body innerHTML）
 *  - .zip   → 找主 HTML（启发式：最外层 / 含 <body>）
 *  - .png/.jpg/.jpeg/.webp → 转 dataURL，dispatch Agent 复刻
 *
 * 限制：
 *  - 文件 >2MB 拒绝；500KB-2MB 警告
 *  - 复杂 Figma 导出的多文件 zip：第一版"解压后让用户选主 HTML"
 */

export const MAX_HTML_BYTES = 2 * 1024 * 1024 // 2MB
export const WARN_HTML_BYTES = 500 * 1024 // 500KB

export type ImportKind = 'html' | 'zip' | 'image' | 'unknown'

export function detectImportKind(file: File): ImportKind {
  const name = file.name.toLowerCase()
  if (name.endsWith('.html') || name.endsWith('.htm')) return 'html'
  if (name.endsWith('.zip')) return 'zip'
  if (
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp') ||
    name.endsWith('.gif')
  ) {
    return 'image'
  }
  return 'unknown'
}

export interface ParsedHtml {
  html: string
  css: string | null
  /** 简单元信息：title / lang / viewport */
  meta: { title: string | null; lang: string | null }
}

const STYLE_BLOCK_RE = /<style[^>]*>([\s\S]*?)<\/style>/gi
const META_VIEWPORT_RE = /<meta[^>]+name=["']viewport["'][^>]*>/i
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i
const HTML_RE = /<html([^>]*)>/i
const BODY_RE = /<body([^>]*)>([\s\S]*?)<\/body>/i

/** 从 .html 文本中提取 css + body 内的 html */
export function parseHtmlDocument(text: string): ParsedHtml {
  // 1) 收集所有 <style> 块
  const cssChunks: string[] = []
  let m: RegExpExecArray | null
  const styleRe = new RegExp(STYLE_BLOCK_RE.source, STYLE_BLOCK_RE.flags)
  while ((m = styleRe.exec(text)) !== null) {
    cssChunks.push(m[1]!)
  }
  const css = cssChunks.length > 0 ? cssChunks.join('\n\n') : null

  // 2) 取 <body> 内部
  const bodyMatch = BODY_RE.exec(text)
  const html = bodyMatch ? bodyMatch[2] : text

  // 3) 元信息
  const title = TITLE_RE.exec(text)?.[1]?.trim() ?? null
  const langMatch = HTML_RE.exec(text)
  const langAttr = langMatch?.[1] ?? ''
  const langMatch2 = /lang=["']([^"']+)/i.exec(langAttr)
  const lang = langMatch2?.[1] ?? null

  return { html: html!.trim(), css, meta: { title, lang } }
}

// ==================== ZIP 解压（最小实现） ====================

/** 单个 ZIP 内文件 */
export interface ZipEntry {
  name: string
  /** 解压后的文本（仅文本类文件用） */
  text: string
}

/**
 * 用浏览器 DecompressionStream 解压 zip。
 * 严格来说 zip 不是 gzip 压缩，需要自己写一个 minimal central directory parser。
 * 第一版只支持 store（method 0）和 deflate（method 8）单文件场景。
 * 对真实 Figma 导出的 zip（一般是多文件 store 模式），可能失败并报错让用户手动解压。
 */
export async function unzipFirstHtml(
  file: File
): Promise<{ html: ParsedHtml; candidates: ZipEntry[] }> {
  // 不引入新依赖：直接交给用户提示"请先解压 zip"作为降级路径
  // ——否则要自己实现完整的 zip reader（PKWARE 格式：local file header + central directory），
  // 工作量大且与本期目标不符。
  throw new ImportError(
    'ZIP 导入在第一版暂未实现，请先解压 zip 后导入主 HTML 文件',
    'zip-not-supported'
  )
}

export class ImportError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

// ==================== 通用：把文件读成文本 ====================

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_HTML_BYTES) {
      reject(
        new ImportError(
          `文件过大（${(file.size / 1024 / 1024).toFixed(2)}MB > 2MB），跳过`,
          'too-large'
        )
      )
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new ImportError('文件读取失败', 'read-failed'))
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.readAsText(file)
  })
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_HTML_BYTES) {
      reject(
        new ImportError(
          `图片过大（${(file.size / 1024 / 1024).toFixed(2)}MB > 2MB），跳过`,
          'too-large'
        )
      )
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new ImportError('图片读取失败', 'read-failed'))
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.readAsDataURL(file)
  })
}

/** 完整导入入口：根据 file 类型自动路由 */
export interface ImportResult {
  kind: ImportKind
  /** kind === 'html' 时返回 */
  parsed?: ParsedHtml
  /** kind === 'image' 时返回 dataURL */
  imageDataUrl?: string
  warnings: string[]
  errors: string[]
}

export async function importDesignFile(file: File): Promise<ImportResult> {
  const kind = detectImportKind(file)
  const warnings: string[] = []
  const errors: string[] = []

  if (file.size > WARN_HTML_BYTES && kind !== 'image') {
    warnings.push(`文件较大（${(file.size / 1024).toFixed(0)}KB），可能影响渲染性能`)
  }

  if (kind === 'html') {
    try {
      const text = await readFileAsText(file)
      const parsed = parseHtmlDocument(text)
      return { kind, parsed, warnings, errors }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`HTML 解析失败：${msg}`)
      return { kind, warnings, errors }
    }
  }

  if (kind === 'zip') {
    try {
      const r = await unzipFirstHtml(file)
      return { kind, parsed: r.html, warnings, errors }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(msg)
      return { kind, warnings, errors }
    }
  }

  if (kind === 'image') {
    try {
      const dataUrl = await readFileAsDataURL(file)
      return { kind, imageDataUrl: dataUrl, warnings, errors }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`图片读取失败：${msg}`)
      return { kind, warnings, errors }
    }
  }

  errors.push(`不支持的文件类型：${file.name}`)
  return { kind, warnings, errors }
}
