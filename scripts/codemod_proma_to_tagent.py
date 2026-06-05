#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
codemod_proma_to_tagent.py — 品牌替换 codemod (DRY-RUN by default)

**目的**：将 F:\Proma 中所有 @proma/* scope 和 "Proma" 品牌字符串替换为 @tagent/* / TAgent

**默认 dry-run**：不改任何文件，只输出"将会改什么"
**加 --apply 才真改**

**重要约束**（来自 docs/reports/2026-06-05-proma-scope-inventory.md §3）：
- 不动 bun.lock / package-lock.json（让 bun install 重新生成）
- 不动 release-notes/（历史记录）
- 不动 .git/（commit history）
- 不动 node_modules/

**用法**：
    # 仅查看
    python scripts/codemod_proma_to_tagent.py F:/Proma
    python scripts/codemod_proma_to_tagent.py F:/Proma --report-only

    # 真改（需要 --apply 标志 + 双重确认）
    python scripts/codemod_proma_to_tagent.py F:/Proma --apply

**风险等级**：高（影响 ~180 文件 400+ 引用）
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator

# Windows 兼容：让 print 能输出 emoji
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# ===== 排除路径（永远不动）=====
DEFAULT_EXCLUDE_DIRS = {
    "node_modules",
    ".git",
    "release",          # PyInstaller build 输出
    "dist",
    "out",
    "build",
    "__pycache__",
    ".ta_agent",        # 运行时数据
    "release-notes",    # 历史发布说明（不可改写）
    "coverage",
    ".venv", "venv",
}

DEFAULT_EXCLUDE_FILES = {
    "bun.lock",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "TAgent.spec",      # ta_agent 自己的 spec（不属 Proma）
    "poetry.lock",
}

# ===== 转换规则 =====

@dataclass
class Change:
    """单次改动记录"""
    file: Path
    line_no: int
    before: str
    after: str
    rule: str

@dataclass
class RuleResult:
    """一个规则应用后的统计"""
    rule: str
    matches: int = 0
    files_affected: set[Path] = field(default_factory=set)


# ===== 规则定义 =====

SCOPE_PATTERN = re.compile(r"@proma/([a-z0-9-]+)")
TYPE_PREFIX_PATTERN = re.compile(r"\bProma([A-Z][a-zA-Z0-9]*)\b")
BRAND_PATTERN = re.compile(r"\bProma\b")
PACKAGE_NAME_PATTERN = re.compile(r"^(\s*\"name\"\s*:\s*)\"proma\"")


def rule_scope(content: str, file: Path) -> Iterator[Change]:
    """@proma/X → @tagent/X"""
    for m in SCOPE_PATTERN.finditer(content):
        before = m.group(0)
        after = f"@tagent/{m.group(1)}"
        line_no = content[: m.start()].count("\n") + 1
        yield Change(file, line_no, before, after, "scope")


def rule_type_prefix(content: str, file: Path) -> Iterator[Change]:
    """PromaXxxType → TAgentXxxType（仅 PascalCase 跟着的情况）"""
    for m in TYPE_PREFIX_PATTERN.finditer(content):
        before = m.group(0)
        after = f"TAgent{m.group(1)}"
        line_no = content[: m.start()].count("\n") + 1
        yield Change(file, line_no, before, after, "type_prefix")


def rule_brand(content: str, file: Path) -> Iterator[Change]:
    """Proma → TAgent（仅裸词，不动 PromaXxxType 那个规则已处理）"""
    for m in BRAND_PATTERN.finditer(content):
        before = m.group(0)
        after = "TAgent"
        line_no = content[: m.start()].count("\n") + 1
        yield Change(file, line_no, before, after, "brand")


def rule_package_name(content: str, file: Path) -> Iterator[Change]:
    """package.json 的 "name": "proma" → "name": "tagent" """
    for m in PACKAGE_NAME_PATTERN.finditer(content):
        before = m.group(0)
        after = m.group(1) + '"tagent"'
        line_no = content[: m.start()].count("\n") + 1
        yield Change(file, line_no, before, after, "package_name")


# ===== 文件类型 → 启用的规则映射 =====

# 哪些文件类型启用哪些规则
# 文档类型（md/html/css）默认不处理 — 含"Proma"作为历史引用
# 需 --include-docs 标志才处理
RULE_MAP = {
    # 源代码
    ".ts": [rule_scope, rule_type_prefix, rule_brand],
    ".tsx": [rule_scope, rule_type_prefix, rule_brand],
    ".js": [rule_scope, rule_type_prefix, rule_brand],
    ".jsx": [rule_scope, rule_type_prefix, rule_brand],
    # 配置文件
    ".json": [rule_scope, rule_package_name],  # package.json 等
    # 文档（默认跳过，--include-docs 才处理）
    ".md": [rule_scope, rule_type_prefix, rule_brand],
    ".html": [rule_brand],
    ".css": [rule_brand],
}

DOC_EXTENSIONS = {".md", ".html", ".css"}

# package.json 特殊：name 字段已用 rule_package_name，无需 brand 替换
PACKAGE_JSON_RULES = [rule_scope, rule_package_name]


# ===== 文件扫描 =====

def should_process(file: Path, root: Path, include_docs: bool = False) -> bool:
    """决定是否处理这个文件"""
    rel = file.relative_to(root)

    # 排除目录中的文件
    for part in rel.parts:
        if part in DEFAULT_EXCLUDE_DIRS:
            return False

    # 排除特定文件
    if file.name in DEFAULT_EXCLUDE_FILES:
        return False

    # 文档类型默认跳过（除非 --include-docs）
    suffix = file.suffix.lower()
    if suffix in DOC_EXTENSIONS and not include_docs:
        return False

    # 只处理有规则映射的扩展名
    if file.name == "package.json":
        return True
    return suffix in RULE_MAP


def is_text_file(file: Path) -> bool:
    """粗略判断是否是文本文件（避免读二进制文件）"""
    try:
        with open(file, "rb") as f:
            chunk = f.read(8192)
        # 二进制文件含 NULL 字节
        return b"\x00" not in chunk
    except Exception:
        return False


def walk_target(root: Path, include_docs: bool = False) -> Iterator[Path]:
    """遍历 target 目录下所有应处理的文件"""
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if should_process(path, root, include_docs=include_docs):
            if is_text_file(path):
                yield path


# ===== 改动应用 =====

def apply_changes(content: str, changes: list[Change]) -> str:
    """按 line_no 倒序应用 changes（避免 offset 漂移）"""
    if not changes:
        return content
    lines = content.splitlines(keepends=True)
    # 按 line_no 倒序，从末尾改起
    sorted_changes = sorted(changes, key=lambda c: c.line_no, reverse=True)
    for change in sorted_changes:
        line_idx = change.line_no - 1
        if 0 <= line_idx < len(lines):
            old_line = lines[line_idx]
            new_line = old_line.replace(change.before, change.after, 1)
            lines[line_idx] = new_line
    return "".join(lines)


def scan_file(file: Path) -> tuple[str, list[Change]]:
    """扫描一个文件，收集所有 changes（不改文件）"""
    try:
        content = file.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        # fallback to latin-1
        content = file.read_text(encoding="latin-1")

    # 选规则集
    if file.name == "package.json":
        rules = PACKAGE_JSON_RULES
    else:
        rules = RULE_MAP.get(file.suffix.lower(), [])

    changes: list[Change] = []
    for rule in rules:
        changes.extend(rule(content, file))

    return content, changes


# ===== 报告输出 =====

def print_report(target: Path, all_changes: list[Change], results: list[RuleResult]):
    """打印 dry-run 报告"""
    by_rule: dict[str, list[Change]] = {}
    for c in all_changes:
        by_rule.setdefault(c.rule, []).append(c)

    by_file: dict[Path, list[Change]] = {}
    for c in all_changes:
        by_file.setdefault(c.file, []).append(c)

    print(f"\n{'=' * 60}")
    print(f"Codemod DRY-RUN Report")
    print(f"{'=' * 60}")
    print(f"Target:  {target}")
    print(f"Files scanned:   {len(by_file)}")
    print(f"Total changes:   {len(all_changes)}")
    print()

    print("By rule:")
    for r in results:
        print(f"  {r.rule:20s}  {r.matches:5d} matches in {len(r.files_affected):3d} files")
    print()

    if not all_changes:
        print("✅ No changes needed")
        return

    print(f"Top 20 files by change count:")
    sorted_files = sorted(by_file.items(), key=lambda x: -len(x[1]))[:20]
    for file, changes in sorted_files:
        rel = file.relative_to(target)
        print(f"  {len(changes):3d}  {rel}")
    print()

    print(f"Sample changes (first 30):")
    for c in all_changes[:30]:
        rel = c.file.relative_to(target)
        print(f"  {rel}:{c.line_no}  [{c.rule}]  {c.before!r}  →  {c.after!r}")
    if len(all_changes) > 30:
        print(f"  ... and {len(all_changes) - 30} more")
    print()

    print(f"{'=' * 60}")
    print(f"🔒  Dry-run 模式：未修改任何文件")
    print(f"    跑 --apply 才会真改")
    print(f"{'=' * 60}")


# ===== 主流程 =====

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Proma → TAgent 品牌替换 codemod (dry-run by default)"
    )
    parser.add_argument(
        "target",
        type=Path,
        help="目标目录（如 F:/Proma）",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="真改（默认 dry-run）",
    )
    parser.add_argument(
        "--report-only",
        action="store_true",
        help="只输出报告，不问确认",
    )
    parser.add_argument(
        "--include-docs",
        action="store_true",
        help="处理 .md/.html/.css 等文档（默认不碰，因含历史引用）",
    )
    args = parser.parse_args()

    target = args.target.resolve()
    if not target.exists() or not target.is_dir():
        print(f"Target not found or not a directory: {target}")
        return 1

    # 扫描
    print(f"Scanning {target} ...")
    all_changes: list[Change] = []
    results: dict[str, RuleResult] = {
        "scope": RuleResult("scope"),
        "type_prefix": RuleResult("type_prefix"),
        "brand": RuleResult("brand"),
        "package_name": RuleResult("package_name"),
    }

    file_count = 0
    for file in walk_target(target, include_docs=args.include_docs):
        file_count += 1
        content, changes = scan_file(file)
        for c in changes:
            all_changes.append(c)
            results[c.rule].matches += 1
            results[c.rule].files_affected.add(c.file)

    print(f"  Scanned {file_count} files")
    print(f"  Found {len(all_changes)} changes")

    # 报告
    print_report(target, all_changes, list(results.values()))

    # 应用（如果指定 --apply）
    if args.apply:
        print(f"\nWARNING: will modify {len(all_changes)} places!")

        if not args.report_only:
            confirm = input("Confirm? Type 'yes' to continue: ")
            if confirm != "yes":
                print("Cancelled")
                return 1

        # 按文件分组
        by_file: dict[Path, list[Change]] = {}
        for c in all_changes:
            by_file.setdefault(c.file, []).append(c)

        applied = 0
        for file, changes in by_file.items():
            content, _ = scan_file(file)  # re-read
            new_content = apply_changes(content, changes)
            file.write_text(new_content, encoding="utf-8")
            applied += 1
            print(f"  + {file.relative_to(target)}")

        print(f"\nApplied {applied} files, {len(all_changes)} changes")
        print(f"   Run `bun install` to regenerate lock file")
        print(f"   Run `bun run typecheck` to verify")
        return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())
