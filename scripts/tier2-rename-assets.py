#!/usr/bin/env python3
"""
Tier 2.3: git mv proma-*.png -> tagent-*.png in assets dirs
Then update import paths in 4 source files.
"""
import subprocess
from pathlib import Path

ROOT = Path(r"F:\TAgent_General")


def __replace_substr(content, old, new):
    return content.replace(old, new), content.count(old)

# Collect all proma-*.png files in tagent-logos/ and proma.png in models/
ASSET_DIRS = [
    ROOT / "apps/electron/src/renderer/assets/bots/tagent-logos",
    ROOT / "apps/electron/src/renderer/assets/models",
]

RENAMES = []  # (old_abs, new_abs)
for d in ASSET_DIRS:
    for f in d.iterdir():
        if f.is_file() and f.name.startswith("proma"):
            new_name = f.name.replace("proma", "tagent", 1)
            if not new_name.startswith("tagent"):
                continue
            new = f.with_name(new_name)
            if new.exists():
                print(f"  SKIP (target exists): {f.name}")
                continue
            RENAMES.append((f, new))

print(f"准备 git mv {len(RENAMES)} 个文件：")
for old, new in RENAMES:
    print(f"  {old.relative_to(ROOT)}  ->  {new.relative_to(ROOT)}")

# git mv each (this preserves history)
for old, new in RENAMES:
    if not old.exists():
        print(f"  SKIP (already moved): {old.name}")
        continue
    rel_old = str(old.relative_to(ROOT)).replace("\\", "/")
    rel_new = str(new.relative_to(ROOT)).replace("\\", "/")
    result = subprocess.run(
        ["git", "mv", rel_old, rel_new],
        cwd=ROOT, capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"  FAIL: {rel_old} -> {rel_new}: {result.stderr.strip()}")
    else:
        print(f"  OK: {rel_old} -> {rel_new}")

# Now update import paths in source files
# Pattern: 'proma-...'  ->  'tagent-...'  (only in the asset import contexts)
# Use simple string replace: "proma-" -> "tagent-" in 4 files
SOURCE_FILES = [
    ROOT / "apps/electron/src/renderer/components/settings/TAgentLogoSettings.tsx",
    ROOT / "apps/electron/src/renderer/components/settings/AppearanceSettings.tsx",
    ROOT / "apps/electron/src/renderer/components/settings/BotHubSettings.tsx",
    ROOT / "apps/electron/src/renderer/lib/model-logo.ts",
]

total_source_changes = 0
for f in SOURCE_FILES:
    if not f.exists():
        print(f"  SKIP (not found): {f}")
        continue
    content = f.read_text(encoding="utf-8")
    original = content
    file_changes = 0

    # Replace in import statements: 'proma-...' -> 'tagent-...'
    # Replace in resourcePath: 'tagent-logos/proma-...' -> 'tagent-logos/tagent-...'
    # Replace variable names: promaXxxLogo -> tagentXxxLogo (where Xxx matches a color/style)
    # Replace model path: '@/assets/models/proma.png' -> '@/assets/models/tagent.png'

    # 1. Asset path strings
    content, n = __replace_substr(content, "'@/assets/bots/tagent-logos/proma-", "'@/assets/bots/tagent-logos/tagent-")
    file_changes += n
    content, n = __replace_substr(content, "'@/assets/models/proma.png'", "'@/assets/models/tagent.png'")
    file_changes += n
    content, n = __replace_substr(content, 'tagent-logos/proma-', 'tagent-logos/tagent-')
    file_changes += n

    # 2. Variable names: promaXxxLogo -> tagentXxxLogo (for all the logo files)
    # Match the specific pattern
    content, n = __replace_substr(content, "promaBlackLogo", "tagentBlackLogo")
    file_changes += n
    content, n = __replace_substr(content, "promaWhiteLogo", "tagentWhiteLogo")
    file_changes += n
    content, n = __replace_substr(content, "promaBlueLogo", "tagentBlueLogo")
    file_changes += n
    content, n = __replace_substr(content, "promaPurpleLogo", "tagentPurpleLogo")
    file_changes += n
    content, n = __replace_substr(content, "promaGradientLogo", "tagentGradientLogo")
    file_changes += n
    content, n = __replace_substr(content, "promaTransparentLogo", "tagentTransparentLogo")
    file_changes += n
    content, n = __replace_substr(content, "promaCoralLogo", "tagentCoralLogo")
    file_changes += n
    content, n = __replace_substr(content, "promaVeriPeriLogo", "tagentVeriPeriLogo")
    file_changes += n
    content, n = __replace_substr(content, "promaVivaMagentaLogo", "tagentVivaMagentaLogo")
    file_changes += n
    content, n = __replace_substr(content, "promaMochaMousseLogo", "tagentMochaMousseLogo")
    file_changes += n
    content, n = __replace_substr(content, "promaEmeraldLogo", "tagentEmeraldLogo")
    file_changes += n
    content, n = __replace_substr(content, "proma8bitLogo", "tagent8bitLogo")
    file_changes += n
    content, n = __replace_substr(content, "promaCyberpunkLogo", "tagentCyberpunkLogo")
    file_changes += n
    content, n = __replace_substr(content, "promaFuturisticLogo", "tagentFuturisticLogo")
    file_changes += n
    content, n = __replace_substr(content, "promaLogo", "tagentLogo")
    file_changes += n
    content, n = __replace_substr(content, "TAgentLogo from '@/assets/models/proma.png'", "TAgentLogo from '@/assets/models/tagent.png'")
    file_changes += n

    if file_changes > 0:
        f.write_text(content, encoding="utf-8")
        total_source_changes += file_changes
        print(f"  {f.relative_to(ROOT)}: {file_changes} 处替换")

print(f"\n总：{len(RENAMES)} 个 git mv，{total_source_changes} 处源码替换")
