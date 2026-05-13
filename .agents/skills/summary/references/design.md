# Paper Design

The summary skill uses one visual language: warm paper, ink-blue emphasis, serif hierarchy, restrained diagrams.

## Core Tokens

```css
--parchment: #f5f4ed;
--ivory: #faf9f5;
--sand: #e8e6dc;
--near-black: #141413;
--dark-warm: #3d3d3a;
--olive: #504e49;
--stone: #6b6a64;
--brand: #1B365D;
--border: #e8e6dc;
--border-soft: #e5e3d8;
--tag-bg: #E4ECF5;
```

Rules:
- Page background is parchment, never pure white.
- Ink blue is the only chromatic accent.
- Warm neutrals only. Avoid blue-gray and neutral gray.
- Brand color should stay under 5% of the page area.
- Tags use solid hex backgrounds, never `rgba()`.

## Typography

Chinese / CJK:

```css
font-family: "TsangerJinKai02",
             "Source Han Serif SC", "Noto Serif CJK SC",
             "Songti SC", "STSong",
             Georgia, serif;
```

English:

```css
font-family: Charter, Georgia, Palatino,
             "Times New Roman", serif;
```

Rules:
- Body weight 400, heading weight 500.
- No italic.
- Dense body line-height: 1.4-1.45.
- Reading paragraph line-height: 1.5-1.55.
- English body letter spacing is 0.
- Chinese body letter spacing may use 0.1-0.3pt.

## Page

One-paper output is A4 with `15mm 18mm` margins. The page must fit exactly one sheet.

Use:
- Header with left ink-blue rule.
- 3-4 baseline metrics.
- Two-column body only when the content is naturally scannable.
- One callout or one diagram when it clarifies the decision.

Avoid:
- Nested cards.
- Hard drop shadows.
- Decorative gradients.
- Multiple accent colors.
- Dense tables that force font sizes below 9pt.

## Diagram Style

Diagrams inherit paper tokens. They should feel like part of the page, not a pasted dashboard.

Rules:
- Use ink blue for the main path or highlight only.
- Use warm borders and ivory fills.
- Keep labels short enough to read at A4 scale.
- Captions state the insight.
- One paper usually has zero or one diagram.
