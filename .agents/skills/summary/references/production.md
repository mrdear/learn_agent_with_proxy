# Production Notes

The summary skill ships HTML source and PDF output. Diagrams can also be built as standalone PDFs for inspection.

## Commands

```bash
python3 scripts/build.py --verify
python3 scripts/build.py --verify one-pager
python3 scripts/build.py --verify one-pager-en
python3 scripts/build.py --verify diagram-flowchart
python3 scripts/build.py --check
python3 scripts/build.py --check-placeholders path/to/filled.html
```

## Dependencies

PDF rendering needs:

- `weasyprint`
- `pypdf`
- macOS Homebrew native libraries when WeasyPrint needs `libgobject`

Chinese rendering is best with:

- `assets/fonts/TsangerJinKai02-W04.ttf`
- `assets/fonts/TsangerJinKai02-W05.ttf`

Run this if font files are missing:

```bash
bash scripts/ensure-fonts.sh
```

## Verification

For source templates:

- `python3 scripts/build.py --check`
- `python3 scripts/build.py --verify`

For a filled paper:

- `python3 scripts/build.py --check-placeholders path/to/filled.html`
- Build the matching one-pager target.
- Open the generated PDF and inspect page count, line breaks, chart labels, and caption placement.

## Common Failures

Placeholder text:
- Source templates intentionally contain `{{...}}`.
- Filled documents must not contain placeholders.

Page overflow:
- Cut weaker evidence first.
- Shorten metric labels.
- Remove one diagram before reducing font size.

Font fallback:
- If TsangerJinKai02 is missing, Chinese may still render through CJK fallbacks.
- If glyph boxes appear, run `ensure-fonts.sh` and rebuild.

Tag double rectangle:
- Do not use `rgba()` for tag backgrounds.
- Use a solid hex token such as `#E4ECF5`.

Diagram crowding:
- Shorten labels.
- Reduce node count.
- Move details into the caption or evidence bullets.
