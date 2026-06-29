/**
 * 确保 kscc CLI 的 ripgrep 二进制就位
 *
 * 背景：kscc 包不自带 ripgrep，Windows 上 kscc 硬编码找
 * `<kscc包>/vendor/ripgrep/<arch>/rg.exe`，缺失则 Grep/Glob 工具报 ENOENT。
 * 官方 claude.exe 把 ripgrep 内嵌在二进制里（embedded 模式），所以外部渠道无此问题；
 * kscc 渠道必须手动补齐。本模块在 TAgent 启动时自动完成补齐，让所有用户开箱即用。
 *
 * 策略：检测 vendor 路径缺 rg.exe 时，从系统 PATH 找 rg.exe 复制过去。
 * 系统也没有则跳过（不阻塞启动），用户可自行 winget/brew install ripgrep 后重启。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, copyFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'

const KSCC_VENDOR_RG_REL = join('vendor', 'ripgrep', 'x64-win32', 'rg.exe')

/**
 * 通过 `where kscc` 反推 kscc 包目录。
 * kscc.cmd 内容写死 `node_modules\@seasun\kscc\cli-wrapper.js` 相对路径，
 * 取 .cmd 所在目录再拼接即可得到包根。
 */
function resolveKsccPackageDir(): string | null {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    const out = execFileSync(cmd, ['kscc'], {
      encoding: 'utf8',
      timeout: 3000,
    })
      .trim()
      .split(/\r?\n/)
    // 优先取 .cmd（Windows 真正可执行入口），其次 .exe，最后任意一条
    const ksccPath =
      out.find((p) => p.toLowerCase().endsWith('.cmd')) ||
      out.find((p) => p.toLowerCase().endsWith('.exe')) ||
      out[0]
    if (!ksccPath) return null
    // kscc.cmd 位于 <npm-bin>/kscc.cmd，包在 <npm-bin>/node_modules/@seasun/kscc/
    return join(dirname(ksccPath), 'node_modules', '@seasun', 'kscc')
  } catch {
    return null
  }
}

/**
 * 在系统 PATH 中查找 rg.exe（where rg 返回第一条）。
 */
function findSystemRg(): string | null {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    const out = execFileSync(cmd, ['rg'], {
      encoding: 'utf8',
      timeout: 3000,
    })
      .trim()
      .split(/\r?\n/)[0]
    return out && existsSync(out) ? out : null
  } catch {
    return null
  }
}

/**
 * 确保 kscc vendor 目录下的 ripgrep 二进制存在。
 * 仅 Windows 生效；非 Windows 或未安装 kscc 时静默跳过。
 */
export function ensureKsccRipgrep(): void {
  if (process.platform !== 'win32') return

  const ksccDir = resolveKsccPackageDir()
  if (!ksccDir || !existsSync(ksccDir)) return

  const vendorRgPath = join(ksccDir, KSCC_VENDOR_RG_REL)
  // 已存在且非空文件，跳过
  try {
    if (existsSync(vendorRgPath) && statSync(vendorRgPath).size > 0) return
  } catch {
    // 继续尝试复制
  }

  const systemRg = findSystemRg()
  if (!systemRg) {
    console.warn(
      '[kscc-ripgrep] 系统未安装 ripgrep，kscc 的 Grep/Glob 工具将不可用。' +
        '请运行 `winget install BurntSushi.ripgrep.MSVC` 后重启 TAgent。'
    )
    return
  }

  try {
    mkdirSync(dirname(vendorRgPath), { recursive: true })
    copyFileSync(systemRg, vendorRgPath)
    console.log(`[kscc-ripgrep] 已复制 ripgrep 到 kscc vendor: ${vendorRgPath}`)
  } catch (err) {
    console.warn(`[kscc-ripgrep] 复制 ripgrep 失败:`, err)
  }
}
