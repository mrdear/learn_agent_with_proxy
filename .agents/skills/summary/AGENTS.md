# Summary Agent Guide

## Project

`summary` is a small companion skill for `think`. It turns a finished discussion, decision, or approved plan into a single A4 paper. It keeps the one-pager templates and the diagram library; everything else is out of scope.

## Repository Map

- `SKILL.md` - skill routing and operating rules.
- `assets/templates/one-pager.html` - Chinese / CJK one-paper template.
- `assets/templates/one-pager-en.html` - English one-paper template.
- `assets/diagrams/` - reusable SVG diagram templates for paper bodies or standalone assets.
- `assets/fonts/` - local fonts for stable preview and PDF rendering.
- `references/design.md` - paper design constraints.
- `references/writing.md` - one-paper writing rules.
- `references/production.md` - build and verification notes.
- `references/tokens.json` - canonical color tokens used by checks.
- `scripts/build.py` - PDF build, placeholder check, CSS check, token sync, and verification.
- `scripts/shared.py` - shared paths and target constants.
- `scripts/ensure-fonts.sh` - font recovery helper.

## Commands

```bash
python3 scripts/build.py --verify
python3 scripts/build.py --verify one-pager
python3 scripts/build.py --verify one-pager-en
python3 scripts/build.py --verify diagram-flowchart
python3 scripts/build.py --check
python3 scripts/build.py --check-placeholders path/to/filled.html
bash scripts/ensure-fonts.sh
```

## Working Rules

- Keep output to one A4 page.
- Keep diagrams as supporting material inside the paper, not a separate document type.
- Do not add back resume, letter, portfolio, slide, changelog, long-doc, or equity-report workflows.
- Style changes must update `references/design.md` and matching template tokens.
- Content changes should avoid CSS churn unless layout behavior is part of the task.
- Use `OK:` and `ERROR:` for status text in scripts.
- Chinese templates use TsangerJinKai02 W04/W05. Commercial use requires the appropriate font license.
- If TsangerJinKai is unavailable, run `bash scripts/ensure-fonts.sh` or rely on the CJK fallback stack.

## Verification

- Template, CSS, or script changes: run `python3 scripts/build.py --check` and `python3 scripts/build.py --verify`.
- Finished paper: run `python3 scripts/build.py --check-placeholders path/to/filled.html`, then build the selected template.
- Diagram changes: run `python3 scripts/build.py --verify diagram-name` and inspect the generated PDF.
