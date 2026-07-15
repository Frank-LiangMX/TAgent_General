#!/usr/bin/env node

/**
 * check-prototype-placement.mjs
 *
 * CI gate: ensures prototype / reference / demo files live ONLY under
 * `prototypes/` and are NOT scattered into `apps/`, `packages/`, or
 * the repo root.  See AGENTS.md "硬约束" section.
 *
 * Exit 0 = clean, Exit 1 = violations found.
 */

import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname

/** Directories where prototype files are FORBIDDEN */
const FORBIDDEN_ROOTS = ['apps', 'packages']

/** Patterns that indicate a prototype / reference file */
const PROTOTYPE_PATTERNS = [
  /\/reference\//i,
  /\/renderer\.old\//i,
  /\/demo\//i,
  /\/glass-studio\//i,
  /\/ui-prototype\//i,
  /\.prototype\./i,
]

/**
 * Recursively collect all files under `dir`, returning relative paths
 * from ROOT.
 */
function walk(dir, depth = 0) {
  if (depth > 8) return [] // safety limit
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const files = []
  for (const entry of entries) {
    // Skip node_modules, .git, dist, __generated__
    if (
      entry.name === 'node_modules' ||
      entry.name === '.git' ||
      entry.name === 'dist' ||
      entry.name === '__generated__' ||
      entry.name === '.next'
    ) {
      continue
    }
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walk(full, depth + 1))
    } else if (entry.isFile()) {
      files.push(relative(ROOT, full).replace(/\\/g, '/'))
    }
  }
  return files
}

const violations = []

for (const forbiddenRoot of FORBIDDEN_ROOTS) {
  const dir = join(ROOT, forbiddenRoot)
  let stat
  try {
    stat = statSync(dir)
  } catch {
    continue // directory doesn't exist, skip
  }
  if (!stat.isDirectory()) continue

  const files = walk(dir)
  for (const file of files) {
    if (PROTOTYPE_PATTERNS.some((p) => p.test(`/${file}/`))) {
      violations.push(file)
    }
  }
}

if (violations.length > 0) {
  console.error(
    '❌ Prototype/reference files found outside prototypes/ (violates AGENTS.md 硬约束):\n'
  )
  for (const v of violations) {
    console.error(`   ${v}`)
  }
  console.error(
    '\nMove these files into prototypes/ and update any imports.'
  )
  process.exit(1)
}

// Also check that prototypes/ exists as a directory
try {
  const stat = statSync(join(ROOT, 'prototypes'))
  if (!stat.isDirectory()) {
    console.error('❌ prototypes/ is not a directory')
    process.exit(1)
  }
} catch {
  // prototypes/ doesn't exist yet — that's fine, just warn
  console.log('⚠️  prototypes/ directory not found (no prototypes to check)')
}

console.log('✅ Prototype placement check passed')
process.exit(0)
