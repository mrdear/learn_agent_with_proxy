---
name: summary
description: "Turn a finished think discussion, decision, or approved plan into a single-page paper with optional diagrams. Triggers on summary, one paper, 一页纸, 总结成纸面稿, 生成 paper, 把 think 总结一下."
when_to_use: "after think, approved plan, decision summary, one paper, paper, 一页纸, 总结, 沉淀, 纸面稿"
metadata:
  version: "1.0.0"
---

# Summary: One Paper After Think

Use this skill after `think` has shaped an idea, decision, evaluation, or plan. The job is to preserve the decision and make it easy to reread, share, print, or hand to another agent.

Output is a single A4 paper. Diagrams are allowed when a visual teaches the structure faster than prose.

## Relationship With Think

`think` explores and decides. `summary` records the finished thinking.

If the input is still fuzzy, ask the user to continue with `think`. Do not invent a decision just to fill a page.

Accept:
- Idea judgment from `think`
- Approved design summary
- Architecture or product decision
- Keep / remove evaluation
- Implementation handoff
- Meeting notes that already contain a clear conclusion

Do not handle:
- Resume, CV, portfolio, letter, changelog, slide deck
- Long white paper or multi-page report
- Open-ended brainstorming with no recommendation

## Language

Match the user's language.

| User language | Template |
|---|---|
| Chinese | `assets/templates/one-pager.html` |
| English | `assets/templates/one-pager-en.html` |
| Japanese or mixed CJK | `assets/templates/one-pager.html`, then visually verify line breaks |

## One-Paper Structure

Use this shape unless the user's material strongly suggests a better one-page order:

| Section | Content |
|---|---|
| Header | Decision name, one-line subtitle, date/context |
| Metrics | 3-4 constraints, signals, costs, milestones, or success measures |
| Core judgment | 1-2 short paragraphs naming the recommendation and reason |
| Evidence | 3-5 short bullets with facts, observations, or tradeoffs |
| Risks | 2-3 bullets, each paired with mitigation or owner |
| Next move | One concrete action with owner or trigger |

Length targets:
- Chinese: 400-600 characters
- English: 200-350 words
- Keep the PDF to exactly one page

## Content Rules

- Preserve the decision from `think`; do not reopen the argument.
- Keep the strongest reason and the highest-risk assumption.
- Use numbers only when they came from the source conversation or checked material.
- Mark gaps as `[缺口: ...]` or `[GAP: ...]`.
- Remove ceremonial openings and generic strategic language.
- Section headlines should read as a standalone outline.
- If a claim depends on current external facts, verify the source before writing.

## Diagrams

Use a diagram only when it reduces cognitive load. A paragraph is better when the relationship is linear or already obvious.

Diagram templates live in `assets/diagrams/`. Extract the `<svg>` block and place it inside a `<figure>` in the one-pager body, or build it separately when the user wants an image asset.

| Need | Diagram template |
|---|---|
| Components, system boundaries | `architecture.html` |
| Decisions, branches, workflow | `flowchart.html` |
| Priorities or positioning | `quadrant.html` |
| Category comparison | `bar-chart.html` |
| Trends over time | `line-chart.html` |
| Share of whole, up to 6 items | `donut-chart.html` |
| Lifecycle or state transitions | `state-machine.html` |
| Milestones, roadmap | `timeline.html` |
| Cross-role process | `swimlane.html` |
| Hierarchy | `tree.html` |
| Layered stack | `layer-stack.html` |
| Overlap between 2-3 sets | `venn.html` |
| OHLC / stock movement | `candlestick.html` |
| Contribution bridge | `waterfall.html` |

Rules:
- One paper usually gets zero or one diagram.
- Use two diagrams only when the paper is mostly visual and still fits one page.
- Captions state the insight, not the chart type.
- Redrawn third-party paper figures must be captioned as `示意重绘` / `Schematic redrawn`.

## Design Rules

Read `references/design.md` when editing layout or CSS. The short version:

- A4 parchment background `#f5f4ed`
- Ink blue `#1B365D` as the only accent
- Warm neutrals only; avoid cool gray
- Chinese uses TsangerJinKai02 with CJK fallbacks
- English uses Charter / Georgia-style serif
- Serif heading weight 500, body 400
- No italic
- Tags use solid hex backgrounds, never `rgba()`
- Depth uses quiet ring / whisper shadow, no hard drop shadows

## Build And Verify

From `summary/`:

```bash
python3 scripts/build.py --verify one-pager
python3 scripts/build.py --verify one-pager-en
python3 scripts/build.py --verify diagram-flowchart
python3 scripts/build.py --check
python3 scripts/build.py --check-placeholders path/to/filled.html
```

Default `python3 scripts/build.py --verify` checks both one-pagers and all diagram templates.

For a finished paper, run placeholder checking on the filled HTML, not on source templates.

## Handoff

Return the generated HTML/PDF paths and a one-sentence note naming the decision captured. If a diagram was used, name which template supplied it.
