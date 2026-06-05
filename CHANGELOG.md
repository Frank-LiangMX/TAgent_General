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
