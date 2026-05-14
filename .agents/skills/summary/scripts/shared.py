"""Shared constants and helpers for summary build scripts."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATES = ROOT / "assets" / "templates"
DIAGRAMS = ROOT / "assets" / "diagrams"
EXAMPLES = ROOT / "assets" / "examples"
TOKENS_FILE = ROOT / "references" / "tokens.json"
FONTCONFIG_CACHE = Path("/private/tmp/summary-fontconfig-cache")
_HOMEBREW_PREFIXES = (Path("/opt/homebrew"), Path("/usr/local"))

HTML_TARGETS: dict[str, tuple[str, int]] = {
    "one-pager": ("one-pager.html", 1),
    "one-pager-en": ("one-pager-en.html", 1),
}

DIAGRAM_TARGETS: dict[str, str] = {
    "diagram-architecture": "architecture.html",
    "diagram-flowchart": "flowchart.html",
    "diagram-quadrant": "quadrant.html",
    "diagram-bar-chart": "bar-chart.html",
    "diagram-line-chart": "line-chart.html",
    "diagram-donut-chart": "donut-chart.html",
    "diagram-state-machine": "state-machine.html",
    "diagram-timeline": "timeline.html",
    "diagram-swimlane": "swimlane.html",
    "diagram-tree": "tree.html",
    "diagram-layer-stack": "layer-stack.html",
    "diagram-venn": "venn.html",
    "diagram-candlestick": "candlestick.html",
    "diagram-waterfall": "waterfall.html",
}

COOL_GRAY_BLOCKLIST = {
    "#888", "#888888", "#666", "#666666", "#999", "#999999",
    "#ccc", "#cccccc", "#ddd", "#dddddd", "#eee", "#eeeeee",
    "#111", "#111111", "#222", "#222222", "#333", "#333333",
    "#444", "#444444", "#555", "#555555", "#777", "#777777",
    "#aaa", "#aaaaaa", "#bbb", "#bbbbbb",
    "#6b7280", "#9ca3af", "#d1d5db", "#e5e7eb", "#f3f4f6",
    "#4b5563", "#374151", "#1f2937", "#111827",
    "#f8f9fa", "#e9ecef", "#dee2e6", "#ced4da", "#adb5bd",
    "#6c757d", "#495057", "#343a40", "#212529",
}


def configure_weasyprint_runtime() -> None:
    """Make macOS Homebrew native libraries discoverable before importing WeasyPrint."""
    os.environ.setdefault("XDG_CACHE_HOME", str(FONTCONFIG_CACHE))

    if sys.platform != "darwin":
        return

    brew_lib = next(
        (p / "lib" for p in _HOMEBREW_PREFIXES if (p / "lib" / "libgobject-2.0.dylib").exists()),
        None,
    )
    if brew_lib is None:
        return

    existing = os.environ.get("DYLD_FALLBACK_LIBRARY_PATH", "")
    paths = [path for path in existing.split(":") if path]
    brew_lib_str = str(brew_lib)
    if brew_lib_str in paths:
        return

    os.environ["DYLD_FALLBACK_LIBRARY_PATH"] = ":".join([brew_lib_str, *paths])
