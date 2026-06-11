# Changelog

All notable changes to TAgent will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Project governance scaffolding (this changelog, AGENTS.md, CONTRIBUTING.md, etc.)
- Design docs:
  - `docs/plans/2026-06-05-tagent-fusion-design.md` — TAgent Desktop (13 sections)
  - `docs/plans/2026-06-05-tagent-server-design.md` — TAgent Server (12 sections)
- Architecture Decision Records:
  - `docs/decisions/0001-fusion-architecture.md` — Fusion of Proma + ta_agent
- Pre-commit hooks (ruff + mypy for Python, eslint + prettier for TypeScript)
- CI workflows (ci.yml, release.yml)
- Conventional Commits + 80% coverage gate
- **`/btw` side question** — quick aside that doesn't enter main conversation history (no tool access, reuses main session's channel/model). Floating right-side panel with frosted glass background, `scrollbar-thin`, `rounded-[17px]` matching the main input design. Triggered either by typing `/btw <question>` in the Agent input or by clicking the "旁注" button that appears next to the input during AI streaming / 8s post-stream.
- **`/btw` context sharing** — by-the-way questions now have full visibility into the main conversation (matching Claude Code native semantics). On send, the main session's last 20 user/assistant turns are converted from `SDKMessage[]` to `ChatMessage[]` and injected as LLM history. Tool-use blocks are downgraded to `[调用工具 X]` text; tool-result blocks are skipped. Lets users ask "刚才那个文件名是啥" and get a contextually correct answer.
- **`/btw` fork to new session** — `↗` button in the panel header forks the side Q&A into a new Agent session. New session inherits the parent conversation context (via `&session:` reference) plus the btw transcript, so users can continue with full tool access.

### Changed
- `/btw` panel UI refined: resized to a floating card (`top-[10vh] bottom-[10vh]`), frosted glass (`bg-background/70 backdrop-blur-xl`), custom thin scrollbar, no longer overlaps window control buttons.

### Changed
- (none yet)

### Deprecated
- (none yet)

### Removed
- (none yet)

### Fixed
- (none yet)

### Security
- (none yet)

---

## How to update this file

When you make a PR that affects users, add an entry under `[Unreleased]` in the appropriate subsection:

- **Added** — new features
- **Changed** — changes in existing functionality
- **Deprecated** — soon-to-be-removed features
- **Removed** — now-removed features
- **Fixed** — bug fixes
- **Security** — vulnerability fixes

The release script (`scripts/release.py ship X.Y.Z`) will:
1. Move `[Unreleased]` entries to a new `[X.Y.Z]` section with today's date
2. Reset `[Unreleased]` to empty
3. Commit + tag + push

**Do not manually edit versioned sections** — let the release script handle it.
