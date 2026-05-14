#!/usr/bin/env python3
"""summary build & check

Usage:
    python3 scripts/build.py
    python3 scripts/build.py one-pager
    python3 scripts/build.py diagram-flowchart
    python3 scripts/build.py --verify
    python3 scripts/build.py --verify one-pager-en
    python3 scripts/build.py --check
    python3 scripts/build.py --sync
    python3 scripts/build.py --check-placeholders path/to/filled.html
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

from shared import (
    COOL_GRAY_BLOCKLIST,
    DIAGRAM_TARGETS,
    DIAGRAMS,
    EXAMPLES,
    HTML_TARGETS,
    ROOT,
    TEMPLATES,
    TOKENS_FILE,
    configure_weasyprint_runtime,
)

PLACEHOLDER = re.compile(r"\{\{[^}]+\}\}")
ROOT_BLOCK = re.compile(r":root\s*\{([^}]*)\}", re.DOTALL)
CSS_VAR = re.compile(r"--([\w-]+)\s*:\s*([^;]+);")
RGBA_BG = re.compile(r"background(?:-color)?\s*:\s*[^;]*rgba\s*\(", re.IGNORECASE)
RGBA_BORDER = re.compile(r"border(?:-\w+)?\s*:\s*[^;]*rgba\s*\(", re.IGNORECASE)
LINE_HEIGHT_LOOSE = re.compile(r"line-height\s*:\s*1\.[6-9]\d*", re.IGNORECASE)
HEX_ANY = re.compile(r"#[0-9a-fA-F]{3,6}\b")
CN_PRIMARY_FONTS = {"TsangerJinKai02"}
EN_PRIMARY_FONTS = {"Charter"}


def infer_author() -> str:
    try:
        result = subprocess.run(
            ["git", "config", "user.name"],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except FileNotFoundError:
        pass

    return os.environ.get("SUMMARY_AUTHOR", "Summary")


def set_pdf_metadata(pdf_path: Path, author: str | None = None) -> None:
    try:
        from pypdf import PdfReader, PdfWriter
    except ImportError:
        return

    if not pdf_path.exists():
        return

    reader = PdfReader(str(pdf_path))
    existing = reader.metadata or {}
    metadata = dict(existing)
    needs_update = False

    if author and existing.get("/Author"):
        author_value = str(existing["/Author"])
        if "{{" in author_value and "}}" in author_value:
            metadata["/Author"] = author
            needs_update = True

    if metadata.get("/Producer") != "Summary":
        metadata["/Producer"] = "Summary"
        needs_update = True
    if metadata.get("/Creator") != "Summary":
        metadata["/Creator"] = "Summary"
        needs_update = True

    if not needs_update:
        return

    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    writer.add_metadata(metadata)
    with open(pdf_path, "wb") as f:
        writer.write(f)


def build_html(name: str, source: str, max_pages: int, src_dir: Path = TEMPLATES) -> bool:
    configure_weasyprint_runtime()
    try:
        from pypdf import PdfReader
        from weasyprint import HTML
    except ImportError:
        print("ERROR: missing deps: pip install weasyprint pypdf")
        return False

    src = src_dir / source
    if not src.exists():
        print(f"ERROR: {name}: source not found ({src})")
        return False

    EXAMPLES.mkdir(parents=True, exist_ok=True)
    out = EXAMPLES / f"{name}.pdf"
    HTML(str(src), base_url=str(src.parent)).write_pdf(str(out))
    set_pdf_metadata(out, author=infer_author())

    n = len(PdfReader(str(out)).pages)
    if max_pages and n > max_pages:
        print(f"ERROR: {name}: {n} pages (limit {max_pages})")
        return False

    print(f"OK: {name}: {n} pages")
    return True


def build_all() -> int:
    failures = 0
    for name, (source, max_pages) in HTML_TARGETS.items():
        if not build_html(name, source, max_pages):
            failures += 1
    for name, source in DIAGRAM_TARGETS.items():
        if not build_html(name, source, 0, src_dir=DIAGRAMS):
            failures += 1
    return failures


def build_single(name: str) -> int:
    if name in HTML_TARGETS:
        source, max_pages = HTML_TARGETS[name]
        return 0 if build_html(name, source, max_pages) else 1
    if name in DIAGRAM_TARGETS:
        return 0 if build_html(name, DIAGRAM_TARGETS[name], 0, src_dir=DIAGRAMS) else 1

    known = list(HTML_TARGETS) + list(DIAGRAM_TARGETS)
    print(f"ERROR: unknown target: {name}. Known: {', '.join(known)}")
    return 2


def _pdf_font_names(pdf_path: Path) -> set[str]:
    def resolve(obj):
        try:
            return obj.get_object() if hasattr(obj, "get_object") else obj
        except Exception:
            return obj

    try:
        from pypdf import PdfReader
        reader = PdfReader(str(pdf_path))
        fonts: set[str] = set()
        for page in reader.pages:
            resources = resolve(page.get("/Resources"))
            font_dict = resolve(resources.get("/Font")) if resources else None
            if not hasattr(font_dict, "values"):
                continue
            for obj in font_dict.values():
                font = resolve(obj)
                base = font.get("/BaseFont") if hasattr(font, "get") else None
                if base:
                    fonts.add(str(base).lstrip("/"))
        return fonts
    except Exception as exc:
        print(f"  WARN: could not read font names from PDF: {exc}")
        return set()


def verify_target(name: str, source: str, max_pages: int, src_dir: Path) -> list[str]:
    issues: list[str] = []
    if not build_html(name, source, max_pages, src_dir=src_dir):
        return ["build failed"]

    out = EXAMPLES / f"{name}.pdf"
    embedded = _pdf_font_names(out)
    fallback_present = any(
        kw in font
        for font in embedded
        for kw in ("Georgia", "Palatino", "TsangerJinKai", "YuMincho", "Hiragino", "SourceHan", "Noto", "Charter", "Songti")
    )

    if src_dir == DIAGRAMS:
        if not fallback_present:
            issues.append(f"no recognizable font embedded in {out.name}")
        return issues

    expected = EN_PRIMARY_FONTS if name.endswith("-en") else CN_PRIMARY_FONTS
    if not any(exp in font_name for exp in expected for font_name in embedded):
        primary = next(iter(expected))
        if not fallback_present:
            issues.append(f"no recognizable font embedded in {out.name}")
        else:
            issues.append(f"primary font ({primary}) not embedded; using fallback")

    return issues


def verify_all(target: str | None = None) -> int:
    targets: dict[str, tuple[str, int, Path]] = {}
    if target:
        if target in HTML_TARGETS:
            src, max_pages = HTML_TARGETS[target]
            targets[target] = (src, max_pages, TEMPLATES)
        elif target in DIAGRAM_TARGETS:
            targets[target] = (DIAGRAM_TARGETS[target], 0, DIAGRAMS)
        else:
            print(f"ERROR: unknown target: {target}")
            return 2
    else:
        for name, (src, max_pages) in HTML_TARGETS.items():
            targets[name] = (src, max_pages, TEMPLATES)
        for name, src in DIAGRAM_TARGETS.items():
            targets[name] = (src, 0, DIAGRAMS)

    failures = 0
    for name, (source, max_pages, src_dir) in targets.items():
        issues = verify_target(name, source, max_pages, src_dir)
        if issues:
            print(f"ERROR: {name}: {'; '.join(issues)}")
            failures += 1
        else:
            print(f"OK: {name}: verified")

    return 0 if failures == 0 else 1


def check_placeholders(paths: list[str]) -> int:
    if not paths:
        print("ERROR: provide at least one HTML file to scan")
        return 2

    failures = 0
    for raw in paths:
        path = Path(raw)
        if not path.is_absolute():
            path = ROOT / path
        if not path.exists():
            print(f"ERROR: {raw}: file not found")
            failures += 1
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        hits = list(dict.fromkeys(PLACEHOLDER.findall(text)))
        rel = path.relative_to(ROOT) if path.is_relative_to(ROOT) else path
        if hits:
            print(f"ERROR: {rel}: unfilled placeholder(s): {', '.join(hits)}")
            failures += 1
        else:
            print(f"OK: {rel}: no placeholders")

    return 0 if failures == 0 else 1


@dataclass
class Finding:
    file: Path
    line: int
    rule: str
    excerpt: str


def scan_file(path: Path) -> list[Finding]:
    findings: list[Finding] = []
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    for i, raw in enumerate(lines, start=1):
        line = raw.strip()
        if not line or line.startswith("//") or line.startswith("#"):
            continue
        if RGBA_BG.search(raw):
            findings.append(Finding(path, i, "rgba-background", "rgba() used on background"))
        if RGBA_BORDER.search(raw):
            findings.append(Finding(path, i, "rgba-border", "rgba() used on border"))
        if LINE_HEIGHT_LOOSE.search(raw):
            findings.append(Finding(path, i, "line-height-too-loose", "line-height exceeds 1.55"))
        for hex_match in HEX_ANY.finditer(raw):
            color = hex_match.group(0).lower()
            if color in COOL_GRAY_BLOCKLIST:
                findings.append(Finding(path, i, "cool-gray", f"{color} is cool / neutral gray"))
    return findings


def check_all(verbose: bool = False) -> int:
    targets = sorted(TEMPLATES.glob("*.html")) + sorted(DIAGRAMS.glob("*.html"))
    findings: list[Finding] = []
    for target in targets:
        current = scan_file(target)
        findings.extend(current)
        if verbose:
            print(f"scanned {target.relative_to(ROOT)}: {len(current)} finding(s)")

    if not findings:
        print(f"OK: no violations across {len(targets)} templates")
        return 0

    print(f"ERROR: {len(findings)} violation(s) across {len({f.file for f in findings})} file(s)")
    for finding in findings:
        rel = finding.file.relative_to(ROOT)
        print(f"  {rel}:{finding.line} [{finding.rule}] {finding.excerpt}")
    return 1


def sync_check(verbose: bool = False) -> int:
    if not TOKENS_FILE.exists():
        print(f"ERROR: tokens.json not found at {TOKENS_FILE.relative_to(ROOT)}")
        return 1

    canonical: dict[str, str] = json.loads(TOKENS_FILE.read_text())
    targets = sorted(TEMPLATES.glob("*.html")) + sorted(DIAGRAMS.glob("*.html"))
    drift: list[tuple[str, str, str, str]] = []

    for path in targets:
        text = path.read_text(encoding="utf-8", errors="replace")
        block_match = ROOT_BLOCK.search(text)
        if not block_match:
            if verbose:
                print(f"skip {path.relative_to(ROOT)}: no :root block")
            continue
        found = {m.group(1): m.group(2).strip() for m in CSS_VAR.finditer(block_match.group(1))}
        for token, expected in canonical.items():
            name = token.lstrip("-")
            actual = found.get(name)
            if actual is not None and actual.lower() != expected.lower():
                drift.append((str(path.relative_to(ROOT)), token, expected, actual))

    if not drift:
        print(f"OK: tokens in sync across {len(targets)} template(s)")
        return 0

    print(f"ERROR: {len(drift)} token drift(s)")
    for file, token, expected, actual in drift:
        print(f"  {file}: {token} expected {expected}, got {actual}")
    return 1


def main(argv: list[str]) -> int:
    args = argv[1:]
    if not args:
        return build_all()
    if args[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    if args[0] == "--check":
        verbose = "-v" in args[1:] or "--verbose" in args[1:]
        return max(check_all(verbose), sync_check(verbose))
    if args[0] == "--sync":
        verbose = "-v" in args[1:] or "--verbose" in args[1:]
        return sync_check(verbose)
    if args[0] == "--verify":
        target = args[1] if len(args) > 1 and not args[1].startswith("-") else None
        return verify_all(target)
    if args[0] in ("--check-placeholders", "--verify-filled"):
        return check_placeholders(args[1:])
    return build_single(args[0])


if __name__ == "__main__":
    sys.exit(main(sys.argv))
