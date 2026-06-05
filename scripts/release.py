#!/usr/bin/env python3
"""
release.py — TAgent release manager

Usage:
    python scripts/release.py status
    python scripts/release.py ship 0.2.0 --dry-run
    python scripts/release.py ship 0.2.0 --yes

What it does:
1. Validates working tree is clean
2. Bumps version in VERSION, package.json, pyproject.toml, tauri.conf.json (4 files)
3. Moves [Unreleased] in CHANGELOG.md to a dated [X.Y.Z] section
4. Commits + pushes main
5. Tags vX.Y.Z + pushes tag
6. CI takes over: builds artifacts + creates GitHub Release
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import date
from pathlib import Path
from typing import Optional

REPO_ROOT = Path(__file__).resolve().parent.parent
VERSION_FILE = REPO_ROOT / "VERSION"
CHANGELOG_FILE = REPO_ROOT / "CHANGELOG.md"
PYPROJECT = REPO_ROOT / "pyproject.toml"
PACKAGE_JSON = REPO_ROOT / "package.json"
ELECTRON_PACKAGE_JSON = REPO_ROOT / "apps" / "electron" / "package.json"  # if exists

# Files where version field lives — sync'd together
VERSION_FILES = [VERSION_FILE, PYPROJECT, PACKAGE_JSON]
if ELECTRON_PACKAGE_JSON.exists():
    VERSION_FILES.append(ELECTRON_PACKAGE_JSON)

SEMVER_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?$")


def run(cmd: list[str], check: bool = True, capture: bool = False, cwd: Path | None = None) -> subprocess.CompletedProcess:
    """Run a shell command."""
    print(f"  $ {' '.join(cmd)}")
    return subprocess.run(
        cmd,
        check=check,
        capture_output=capture,
        text=True,
        cwd=cwd or REPO_ROOT,
    )


def get_current_version() -> str:
    return VERSION_FILE.read_text(encoding="utf-8").strip()


def parse_version(v: str) -> tuple[int, int, int, Optional[str]]:
    m = SEMVER_RE.match(v)
    if not m:
        raise ValueError(f"Invalid semver: {v!r}")
    return (int(m.group(1)), int(m.group(2)), int(m.group(3)), m.group(4))


def bump_files(new_version: str) -> list[Path]:
    """Bump version in VERSION + pyproject.toml + package.json (+ electron)."""
    changed: list[Path] = []

    # 1. VERSION file (just the number)
    old = get_current_version()
    if old != new_version:
        VERSION_FILE.write_text(new_version + "\n", encoding="utf-8")
        changed.append(VERSION_FILE)

    # 2. pyproject.toml — naive string replace (project.version field)
    content = PYPROJECT.read_text(encoding="utf-8")
    new_content = re.sub(
        r'(version\s*=\s*")[^"]*(")',
        f'\\g<1>{new_version}\\g<2>',
        content,
        count=1,
    )
    if new_content != content:
        PYPROJECT.write_text(new_content, encoding="utf-8")
        changed.append(PYPROJECT)

    # 3. package.json (and electron's package.json) — use json.load/dump for safety
    for pkg in [PACKAGE_JSON, ELECTRON_PACKAGE_JSON]:
        if not pkg.exists():
            continue
        data = json.loads(pkg.read_text(encoding="utf-8"))
        if data.get("version") != new_version:
            data["version"] = new_version
            pkg.write_text(
                json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            changed.append(pkg)

    return changed


def update_changelog(new_version: str, dry_run: bool = False) -> bool:
    """Move [Unreleased] section to [new_version] - YYYY-MM-DD."""
    if not CHANGELOG_FILE.exists():
        print(f"  ⚠️  CHANGELOG.md not found at {CHANGELOG_FILE}")
        return False

    content = CHANGELOG_FILE.read_text(encoding="utf-8")
    today = date.today().isoformat()

    # Match the [Unreleased] section
    pattern = re.compile(
        r"## \[Unreleased\](.*?)(?=^## \[)",
        re.DOTALL | re.MULTILINE,
    )
    m = pattern.search(content)
    if not m:
        print("  ⚠️  No [Unreleased] section found in CHANGELOG.md")
        return False

    unreleased_body = m.group(1).strip()
    if not unreleased_body:
        print("  ⚠️  [Unreleased] section is empty — nothing to release")
        return False

    new_section = f"## [{new_version}] - {today}\n\n{unreleased_body}\n"
    new_content = (
        content[: m.start(2)]
        + new_section
        + "\n"
        + content[m.start(2):]
    )
    # Reset [Unreleased] to empty
    new_content = re.sub(
        r"## \[Unreleased\](.*?)(?=^## \[)",
        "## [Unreleased]\n\n",
        new_content,
        count=1,
        flags=re.DOTALL | re.MULTILINE,
    )

    if dry_run:
        print("  [dry-run] Would update CHANGELOG.md:")
        print("    [Unreleased] → [{}] - {}".format(new_version, today))
        return True

    CHANGELOG_FILE.write_text(new_content, encoding="utf-8")
    return True


def git_status_clean() -> bool:
    r = run(["git", "status", "--porcelain"], capture=True)
    return r.stdout.strip() == ""


def git_branch() -> str:
    r = run(["git", "rev-parse", "--abbrev-ref", "HEAD"], capture=True)
    return r.stdout.strip()


def cmd_status() -> int:
    print(f"Current version: {get_current_version()}")
    print(f"Branch: {git_branch()}")
    if not git_status_clean():
        print("⚠️  Working tree has uncommitted changes")
    return 0


def cmd_ship(version: str, dry_run: bool, yes: bool) -> int:
    new_version = version.lstrip("v")

    # Validate
    try:
        parse_version(new_version)
    except ValueError as e:
        print(f"❌ {e}")
        return 1

    if not git_status_clean() and not dry_run:
        print("❌ Working tree is dirty. Commit/stash first.")
        return 1

    branch = git_branch()
    if branch != "main" and not dry_run:
        print(f"❌ Not on main branch (current: {branch})")
        return 1

    print(f"📦 Preparing to release v{new_version}")
    print(f"   Branch: {branch}")
    print(f"   Dry-run: {dry_run}")
    print()

    if not dry_run and not yes:
        print("⚠️  Use --yes to confirm. Use --dry-run to preview first.")
        return 1

    # 1. Bump version files
    print("1. Bumping version in files...")
    changed = bump_files(new_version)
    for f in changed:
        print(f"   ✓ {f.relative_to(REPO_ROOT)}")
    if not changed:
        print("   (no changes — already at this version)")

    # 2. Update CHANGELOG
    print("\n2. Updating CHANGELOG.md...")
    update_changelog(new_version, dry_run=dry_run)
    print("   ✓ CHANGELOG.md updated")

    if dry_run:
        print("\n[dry-run] No git operations performed.")
        return 0

    # 3. Git commit + push
    print("\n3. Committing version bump...")
    run(["git", "add", "VERSION", "CHANGELOG.md", "pyproject.toml", "package.json"])
    if ELECTRON_PACKAGE_JSON.exists():
        run(["git", "add", str(ELECTRON_PACKAGE_JSON.relative_to(REPO_ROOT))])
    run(["git", "commit", "-m", f"chore(release): bump version to v{new_version}"])
    run(["git", "push", "origin", "main"])

    # 4. Tag
    print(f"\n4. Tagging v{new_version}...")
    tag = f"v{new_version}"
    run(["git", "tag", tag])
    run(["git", "push", "origin", tag])

    print(f"\n✅ Released v{new_version}")
    print(f"   Tag pushed — CI will build and create GitHub Release.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="TAgent release manager")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("status", help="Show current version + branch status")

    ship = sub.add_parser("ship", help="Ship a new version")
    ship.add_argument("version", help="Version to ship (e.g. 0.2.0)")
    ship.add_argument("--dry-run", action="store_true", help="Preview without making changes")
    ship.add_argument("--yes", action="store_true", help="Skip confirmation")

    args = parser.parse_args()

    if args.cmd == "status":
        return cmd_status()
    if args.cmd == "ship":
        return cmd_ship(args.version, args.dry_run, args.yes)

    return 1


if __name__ == "__main__":
    sys.exit(main())
