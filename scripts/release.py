#!/usr/bin/env python3
"""TAgent GitHub release helper.

This tool intentionally does not commit to main, push tags, or upload files
directly. It orchestrates the repository's GitHub Actions release workflow.

Examples:
    python scripts/release.py status v1.0.0
    python scripts/release.py publish 1.0.1 --yes
    python scripts/release.py publish v1.0.1 --no-watch
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_REMOTE = "origin"
DEFAULT_REF = "main"
DEFAULT_WORKFLOW = "release.yml"
REPO_SLUG = "Frank-LiangMX/TAgent_General"
SEMVER_RE = re.compile(r"^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$")
RUN_URL_RE = re.compile(r"/actions/runs/(\d+)")


class ReleaseError(RuntimeError):
    """Raised for expected release-tool failures."""


@dataclass(frozen=True)
class CommandResult:
    returncode: int
    stdout: str
    stderr: str


def run(
    cmd: list[str],
    *,
    check: bool = True,
    capture: bool = True,
    cwd: Path = REPO_ROOT,
) -> CommandResult:
    process = subprocess.run(
        cmd,
        cwd=cwd,
        check=False,
        capture_output=capture,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    result = CommandResult(process.returncode, process.stdout or "", process.stderr or "")
    if check and result.returncode != 0:
        rendered = " ".join(cmd)
        detail = (result.stderr or result.stdout).strip()
        raise ReleaseError(f"Command failed ({result.returncode}): {rendered}\n{detail}")
    return result


def require_tool(name: str) -> None:
    if shutil.which(name) is None:
        raise ReleaseError(f"Required command not found: {name}")


def normalize_tag(version_or_tag: str) -> str:
    value = version_or_tag.strip()
    if not SEMVER_RE.match(value):
        raise ReleaseError(f"Invalid semver tag: {version_or_tag!r}")
    return value if value.startswith("v") else f"v{value}"


def gh_json(args: list[str], *, check: bool = True) -> Any:
    result = run(["gh", *args], check=check)
    if not result.stdout.strip():
        return None
    return json.loads(result.stdout)


def git_current_branch() -> str:
    return run(["git", "rev-parse", "--abbrev-ref", "HEAD"]).stdout.strip()


def git_short_status() -> str:
    return run(["git", "status", "--short"], check=False).stdout.strip()


def git_fetch_ref(remote: str, ref: str) -> None:
    run(["git", "fetch", remote, f"{ref}:refs/remotes/{remote}/{ref}"])


def remote_ref_exists(remote: str, ref: str) -> bool:
    result = run(["git", "rev-parse", "--verify", f"{remote}/{ref}"], check=False)
    return result.returncode == 0


def release_view(tag: str) -> dict[str, Any] | None:
    result = run(
        [
            "gh",
            "release",
            "view",
            tag,
            "--json",
            "tagName,url,isDraft,isPrerelease,name,assets,body",
        ],
        check=False,
    )
    if result.returncode != 0:
        return None
    return json.loads(result.stdout)


def print_release_summary(release: dict[str, Any]) -> None:
    assets = release.get("assets") or []
    body = (release.get("body") or "").strip()
    print(f"Release: {release.get('url')}")
    print(f"Name: {release.get('name')}  Tag: {release.get('tagName')}")
    print(f"Draft: {release.get('isDraft')}  Prerelease: {release.get('isPrerelease')}")
    print(f"Notes: {'present' if body else 'EMPTY (missing RELEASE_NOTES body!)'}")
    print(f"Assets: {len(assets)}")
    for asset in assets:
        size_mb = int(asset.get("size") or 0) / 1024 / 1024
        print(f"  - {asset.get('name')} ({size_mb:.1f} MB)")


def sync_release_notes(tag: str) -> None:
    """Force GitHub Release body from RELEASE_NOTES.md.

    softprops/action-gh-release may create a release with empty body when the
    workflow job did not checkout the repo (historical bug) or when updating
    an existing release. Always re-apply notes after a successful publish.
    """
    notes_file = REPO_ROOT / "RELEASE_NOTES.md"
    if not notes_file.exists():
        raise ReleaseError("RELEASE_NOTES.md missing; cannot sync release body")
    notes_text = notes_file.read_text(encoding="utf-8").strip()
    if not notes_text:
        raise ReleaseError("RELEASE_NOTES.md is empty; refuse to publish blank notes")
    expected_title = f"# {tag}"
    if expected_title not in notes_text:
        raise ReleaseError(
            f"RELEASE_NOTES.md must contain {expected_title!r} before syncing release body"
        )
    print(f"[postflight] Syncing GitHub Release notes from RELEASE_NOTES.md → {tag}")
    run(["gh", "release", "edit", tag, "--notes-file", str(notes_file)])
    release = release_view(tag)
    body = ((release or {}).get("body") or "").strip()
    if not body:
        raise ReleaseError(f"Release {tag} body is still empty after notes sync")
    print("  ✓ Release notes synced")


def latest_workflow_runs(workflow: str, limit: int) -> list[dict[str, Any]]:
    result = gh_json(
        [
            "run",
            "list",
            "--workflow",
            workflow,
            "--limit",
            str(limit),
            "--json",
            "databaseId,status,conclusion,createdAt,url,displayTitle,headBranch,event",
        ],
        check=False,
    )
    return result or []


def cmd_status(args: argparse.Namespace) -> int:
    require_tool("git")
    require_tool("gh")

    tag = normalize_tag(args.tag) if args.tag else None
    print("TAgent release status")
    print(f"Repository: {REPO_SLUG}")
    print(f"Branch: {git_current_branch()}")

    status = git_short_status()
    if status:
        print("Working tree: dirty")
        print(status)
    else:
        print("Working tree: clean")

    auth = run(["gh", "auth", "status"], check=False)
    print(f"GitHub auth: {'ok' if auth.returncode == 0 else 'not authenticated'}")

    if tag:
        release = release_view(tag)
        if release is None:
            print(f"Release {tag}: not found")
        else:
            print_release_summary(release)

    runs = latest_workflow_runs(args.workflow, args.limit)
    if runs:
        print()
        print(f"Recent {args.workflow} runs:")
        for item in runs:
            conclusion = item.get("conclusion") or item.get("status")
            print(
                f"  - {item.get('databaseId')} {conclusion} "
                f"{item.get('createdAt')} {item.get('url')}"
            )

    return 0


def confirm_or_abort(args: argparse.Namespace, tag: str) -> None:
    if args.yes:
        return
    print()
    answer = input(f"Trigger release workflow for {tag} on {args.ref}? [y/N] ").strip().lower()
    if answer not in {"y", "yes"}:
        raise ReleaseError("Aborted.")


def preflight_checks(tag: str) -> None:
    """发布前自动检查，不通过则中止。

    检查项：
    1. apps/electron/package.json 版本号与 tag 匹配
    2. bun run typecheck 通过（0 error）
    3. bun run eslint . --quiet 通过（0 error）
    4. RELEASE_NOTES.md 包含当前版本标题
    """
    errors: list[str] = []

    # --- 1. 版本号匹配 ---
    print("[preflight] 检查版本号匹配...")
    electron_pkg = REPO_ROOT / "apps" / "electron" / "package.json"
    if electron_pkg.exists():
        pkg = json.loads(electron_pkg.read_text(encoding="utf-8"))
        pkg_version = pkg.get("version", "")
        tag_version = tag.lstrip("v")
        if pkg_version != tag_version:
            errors.append(
                f"版本号不匹配: apps/electron/package.json={pkg_version!r}, tag={tag_version!r}\n"
                f"  → 修复: 将 apps/electron/package.json 的 version 改为 {tag_version}"
            )
        else:
            print(f"  ✓ 版本号匹配: {pkg_version}")
    else:
        errors.append(f"找不到 {electron_pkg}")

    # --- 2. Release notes 存在且包含版本标题，且正文非空 ---
    print("[preflight] 检查 release notes...")
    notes_file = REPO_ROOT / "RELEASE_NOTES.md"
    if notes_file.exists():
        notes_text = notes_file.read_text(encoding="utf-8")
        expected_title = f"# {tag}"
        version_headings = re.findall(
            r"^# v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$",
            notes_text,
            flags=re.MULTILINE,
        )
        if expected_title not in notes_text:
            errors.append(
                f"RELEASE_NOTES.md 中未找到 {expected_title!r} 标题\n"
                f"  → 修复: 在 RELEASE_NOTES.md 中添加 {expected_title} 段落"
            )
        elif len(notes_text.strip()) < 40:
            errors.append(
                "RELEASE_NOTES.md 内容过短，疑似未写完整发布说明\n"
                "  → 修复: 补齐本版新功能 / 修复 / 清理条目"
            )
        elif version_headings != [expected_title]:
            errors.append(
                f"RELEASE_NOTES.md 必须只包含当前版本一个标题，当前为 {version_headings!r}\n"
                f"  → 修复: 删除历史版本段落，只保留 {expected_title}（防止嵌套旧版说明写进 Release body）"
            )
        else:
            print(f"  ✓ RELEASE_NOTES.md 仅包含 {expected_title}")
    else:
        errors.append("RELEASE_NOTES.md 文件不存在")

    # --- 3. TypeScript 类型检查 ---
    print("[preflight] 运行 typecheck...")
    result = subprocess.run(
        ["bun", "run", "typecheck"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        # 提取 error 行
        error_lines = [l for l in result.stdout.splitlines() if "error TS" in l]
        errors.append(
            f"typecheck 失败 ({len(error_lines)} errors):\n"
            + "\n".join(error_lines[:10])
            + ("\n  ..." if len(error_lines) > 10 else "")
        )
    else:
        print("  ✓ typecheck 通过")

    # --- 4. ESLint 检查 ---
    print("[preflight] 运行 eslint...")
    result = subprocess.run(
        ["bun", "run", "eslint", ".", "--quiet"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        error_lines = [l for l in result.stdout.splitlines() if " error " in l]
        errors.append(
            f"eslint 失败 ({len(error_lines)} errors):\n"
            + "\n".join(error_lines[:10])
            + ("\n  ..." if len(error_lines) > 10 else "")
        )
    else:
        print("  ✓ eslint 通过（0 errors）")

    # --- 汇总 ---
    if errors:
        print("\n" + "=" * 60)
        print(f"preflight 失败: {len(errors)} 项不通过")
        print("=" * 60)
        for i, err in enumerate(errors, 1):
            print(f"\n[{i}] {err}")
        print()
        raise ReleaseError(
            "发布前检查未通过，请修复上述问题后重新运行。"
            "如确认跳过，可使用 --skip-preflight。"
        )
    print("\n✓ 所有 preflight 检查通过\n")


def dispatch_workflow(workflow: str, ref: str, tag: str, dry_run: bool) -> tuple[str | None, str | None]:
    cmd = ["gh", "workflow", "run", workflow, "--ref", ref, "-f", f"tag_name={tag}"]
    if dry_run:
        print("[dry-run] " + " ".join(cmd))
        return None, None

    result = run(cmd)
    url = result.stdout.strip().splitlines()[-1] if result.stdout.strip() else None
    match = RUN_URL_RE.search(url or "")
    run_id = match.group(1) if match else None
    return run_id, url


def find_recent_run(workflow: str, tag: str, attempts: int = 20) -> tuple[str, str]:
    for _ in range(attempts):
        runs = latest_workflow_runs(workflow, 5)
        for item in runs:
            if item.get("event") != "workflow_dispatch":
                continue
            run_id = str(item.get("databaseId"))
            url = str(item.get("url"))
            if run_id and url:
                return run_id, url
        time.sleep(3)
    raise ReleaseError(f"Could not find the dispatched workflow run for {tag}.")


def watch_run(run_id: str, timeout_minutes: int) -> None:
    deadline = time.monotonic() + timeout_minutes * 60
    print(f"Watching run {run_id} for up to {timeout_minutes} minutes...")

    while True:
        result = gh_json(
            [
                "run",
                "view",
                run_id,
                "--repo",
                REPO_SLUG,
                "--json",
                "status,conclusion,url",
            ]
        )
        status = result.get("status")
        conclusion = result.get("conclusion")
        url = result.get("url")
        print(f"  {status} {conclusion or ''} {url}")

        if status == "completed":
            if conclusion == "success":
                return
            raise ReleaseError(f"Release workflow failed: {url}")

        if time.monotonic() > deadline:
            raise ReleaseError(f"Timed out while waiting for run {run_id}: {url}")

        time.sleep(30)


def cmd_publish(args: argparse.Namespace) -> int:
    require_tool("git")
    require_tool("gh")

    tag = normalize_tag(args.version)
    print(f"Preparing release {tag}")
    print(f"Workflow: {args.workflow}")
    print(f"Ref: {args.ref}")

    auth = run(["gh", "auth", "status"], check=False)
    if auth.returncode != 0:
        raise ReleaseError("GitHub CLI is not authenticated. Run: gh auth login")

    git_fetch_ref(args.remote, args.ref)
    if not remote_ref_exists(args.remote, args.ref):
        raise ReleaseError(f"Remote ref not found: {args.remote}/{args.ref}")

    current_branch = git_current_branch()
    if current_branch != args.ref:
        print(f"Note: current local branch is {current_branch!r}; dispatching remote {args.ref!r}.")

    status = git_short_status()
    if status:
        print("Note: local working tree is dirty; this does not affect workflow dispatch.")

    release = release_view(tag)
    if release is not None and not args.allow_existing_release:
        print_release_summary(release)
        raise ReleaseError(
            f"Release {tag} already exists. Use --allow-existing-release only if you really "
            "intend to rerun and overwrite assets."
        )

    if not args.skip_preflight:
        preflight_checks(tag)

    confirm_or_abort(args, tag)

    run_id, run_url = dispatch_workflow(args.workflow, args.ref, tag, args.dry_run)
    if args.dry_run:
        return 0

    if run_id is None:
        run_id, run_url = find_recent_run(args.workflow, tag)

    print(f"Triggered: {run_url}")

    if args.watch:
        watch_run(run_id, args.timeout_minutes)
        # softprops 历史上可能写出空 body；成功后强制用 RELEASE_NOTES.md 覆盖一次
        sync_release_notes(tag)
        final_release = release_view(tag)
        if final_release is None:
            raise ReleaseError(f"Workflow succeeded, but release {tag} was not found.")
        print_release_summary(final_release)
        if not (final_release.get("body") or "").strip():
            raise ReleaseError(
                f"Release {tag} has empty body after sync. Fix RELEASE_NOTES.md and run:\n"
                f"  gh release edit {tag} --notes-file RELEASE_NOTES.md"
            )
    else:
        print("Not watching run. Check it here:")
        print(run_url)
        print(
            f"After the workflow finishes, sync notes with:\n"
            f"  gh release edit {tag} --notes-file RELEASE_NOTES.md"
        )

    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="TAgent GitHub release helper")
    sub = parser.add_subparsers(dest="cmd", required=True)

    status = sub.add_parser("status", help="Show release readiness and recent runs")
    status.add_argument("tag", nargs="?", help="Optional tag to inspect, e.g. v1.0.0")
    status.add_argument("--workflow", default=DEFAULT_WORKFLOW)
    status.add_argument("--limit", type=int, default=5)
    status.set_defaults(func=cmd_status)

    publish = sub.add_parser("publish", help="Trigger the GitHub Actions release workflow")
    publish.add_argument("version", help="Semver version or tag, e.g. 1.0.1 or v1.0.1")
    publish.add_argument("--workflow", default=DEFAULT_WORKFLOW)
    publish.add_argument("--ref", default=DEFAULT_REF)
    publish.add_argument("--remote", default=DEFAULT_REMOTE)
    publish.add_argument("--yes", action="store_true", help="Skip interactive confirmation")
    publish.add_argument("--dry-run", action="store_true", help="Print the dispatch command only")
    publish.add_argument("--watch", dest="watch", action="store_true", default=True)
    publish.add_argument("--no-watch", dest="watch", action="store_false")
    publish.add_argument("--timeout-minutes", type=int, default=75)
    publish.add_argument(
        "--allow-existing-release",
        action="store_true",
        help="Allow dispatch when the GitHub Release already exists.",
    )
    publish.add_argument(
        "--skip-preflight",
        action="store_true",
        help="Skip preflight checks (typecheck, eslint, version match, release notes).",
    )
    publish.set_defaults(func=cmd_publish)

    ship = sub.add_parser("ship", help="Alias for publish")
    ship.add_argument("version", help="Semver version or tag, e.g. 1.0.1 or v1.0.1")
    ship.add_argument("--workflow", default=DEFAULT_WORKFLOW)
    ship.add_argument("--ref", default=DEFAULT_REF)
    ship.add_argument("--remote", default=DEFAULT_REMOTE)
    ship.add_argument("--yes", action="store_true")
    ship.add_argument("--dry-run", action="store_true")
    ship.add_argument("--watch", dest="watch", action="store_true", default=True)
    ship.add_argument("--no-watch", dest="watch", action="store_false")
    ship.add_argument("--timeout-minutes", type=int, default=75)
    ship.add_argument("--allow-existing-release", action="store_true")
    ship.add_argument("--skip-preflight", action="store_true")
    ship.set_defaults(func=cmd_publish)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return int(args.func(args))
    except KeyboardInterrupt:
        print("\nInterrupted.")
        return 130
    except ReleaseError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
