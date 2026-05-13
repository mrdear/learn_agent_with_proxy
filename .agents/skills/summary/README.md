# Summary

`summary` is a companion skill for `think`. It turns a finished discussion, decision, or approved plan into a single A4 paper.

It keeps the useful part of the original paper design system: one-page templates, warm editorial styling, PDF generation, and a reusable diagram library.

## Scope

Included:
- Chinese / CJK one-paper template
- English one-paper template
- Fourteen SVG diagram templates
- PDF build and verification script
- Short design, writing, diagram, and production references

Excluded:
- Resume
- Letter
- Portfolio
- Slide deck
- Long document
- Changelog
- Equity report
- Public website and demo gallery

## Use

Typical prompts:

```text
把刚才 think 的结论总结成一页纸
生成一份 paper，保留风险和下一步
turn this approved plan into one paper
make a decision paper with one diagram
```

The skill should record the decision rather than reopen it. If the input is still undecided, continue with `think`.

## Commands

Run from `summary/`:

```bash
python3 scripts/build.py --verify
python3 scripts/build.py --verify one-pager
python3 scripts/build.py --verify one-pager-en
python3 scripts/build.py --verify diagram-flowchart
python3 scripts/build.py --check
python3 scripts/build.py --check-placeholders path/to/filled.html
```

## Files

- `SKILL.md` - agent behavior
- `assets/templates/one-pager.html` - Chinese / CJK template
- `assets/templates/one-pager-en.html` - English template
- `assets/diagrams/` - diagram templates
- `references/design.md` - visual constraints
- `references/writing.md` - one-paper writing rules
- `references/diagrams.md` - diagram selection guide
- `references/production.md` - build and rendering notes

## Design

The paper uses parchment background, ink-blue accent, warm neutral text, and serif-led hierarchy. Diagrams follow the same token set so they can sit inside the paper without feeling pasted in.

Chinese uses TsangerJinKai02 with CJK fallbacks. English uses Charter with Georgia-style fallback.
