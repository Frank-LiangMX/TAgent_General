#!/usr/bin/env python3
"""
Tier 2.4-B: ~/.proma/ -> ~/.tagent/ (production config dir rename)

Accepts data loss (no live users yet).
"""
from pathlib import Path

ROOT = Path(r"F:\TAgent_General")

# 1) Bulk JSDoc/comment replace: ~/.proma/ -> ~/.tagent/
JSDOC_REPLACE = [
    ("~/.proma/", "~/.tagent/"),         # JSDoc / comments
    ("~\\.proma/", "~\\.tagent/"),       # escaped path in JSDoc (rare)
]

# 2) Functional string literal replace (only in 3 files)
LITERAL_FILES = [
    ROOT / "apps/electron/src/main/lib/config-paths.ts",
    ROOT / "apps/electron/src/renderer/components/app-shell/SearchDialog.tsx",
    ROOT / "apps/electron/src/renderer/components/settings/AgentSettings.tsx",
]
LITERAL_REPLACE = [
    ("'.proma'", "'.tagent'"),
    ('".proma"', '".tagent'),
]

# 3) User-visible error message
INDEX_TS = ROOT / "apps/electron/src/main/index.ts"
ERROR_MSG_REPLACES = [
    ("2. ~/.proma/ 配置损坏（重命名 ~/.proma 后重启）\\n",
     "2. ~/.tagent/ 配置损坏（重命名 ~/.tagent 后重启）\\n"),
    ("3. 系统 Keychain 无法解密保存的凭证（删除 ~/.proma/feishu.json 等后重新登录）\\n\\n",
     "3. 系统 Keychain 无法解密保存的凭证（删除 ~/.tagent/feishu.json 等后重新登录）\\n\\n"),
]


def main():
    # Pass 1: bulk JSDoc replace across all .ts/.tsx/.html files
    targets = []
    for p in ROOT.rglob("*"):
        if not p.is_file():
            continue
        if p.suffix not in (".ts", ".tsx", ".html", ".yml", ".yaml", ".css"):
            continue
        s = str(p).replace("\\", "/")
        # skip docs/releases/node_modules/etc
        if any(x in s for x in ["/node_modules/", "/dist/", "/out/", "/.git/",
                                 "/docs/", "/release-notes/", "/proma-thinking/"]):
            continue
        # skip scripts/ (where the rename scripts live)
        if "/scripts/" in s:
            continue
        # skip the codemod script
        if s.endswith("codemod_proma_to_tagent.py"):
            continue
        # skip README/CHANGELOG/AGENTS
        if p.name in ("README.md", "CHANGELOG.md", "AGENTS.md", "CLAUDE.md", "SOUL.md"):
            continue
        # skip .md
        if p.suffix == ".md":
            continue
        targets.append(p)
    print(f"Pass 1: {len(targets)} files for JSDoc sweep")

    total_j = 0
    for f in targets:
        try:
            content = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        original = content
        for old, new in JSDOC_REPLACE:
            content = content.replace(old, new)
        if content != original:
            f.write_text(content, encoding="utf-8")
            n = original.count(JSDOC_REPLACE[0][0])
            total_j += n
            print(f"  {n:3d}  {f.relative_to(ROOT)}")

    # Pass 2: literal replace in 3 specific files
    print(f"\nPass 2: literal replace in {len(LITERAL_FILES)} files")
    total_l = 0
    for f in LITERAL_FILES:
        content = f.read_text(encoding="utf-8")
        original = content
        for old, new in LITERAL_REPLACE:
            content = content.replace(old, new)
        if content != original:
            f.write_text(content, encoding="utf-8")
            n = original.count(LITERAL_REPLACE[0][0])
            total_l += n
            print(f"  {n:3d}  {f.relative_to(ROOT)}")

    # Pass 3: user-visible error message in index.ts
    print(f"\nPass 3: error message in index.ts")
    content = INDEX_TS.read_text(encoding="utf-8")
    original = content
    for old, new in ERROR_MSG_REPLACES:
        content = content.replace(old, new)
    if content != original:
        INDEX_TS.write_text(content, encoding="utf-8")
        print(f"  {len(ERROR_MSG_REPLACES)} replacements")

    print(f"\n总：JSDoc {total_j} + literal {total_l} = {total_j + total_l} 处")


if __name__ == "__main__":
    main()
