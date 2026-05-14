# One-Paper Writing

The paper is a record of finished thinking. It should make the decision easy to recover later.

## Content Bar

A useful paper answers six questions:

- What decision was made?
- Why is this the current recommendation?
- What evidence or observation supports it?
- What tradeoff was accepted?
- What assumption could break it?
- What is the next move?

## Structure

| Section | Job |
|---|---|
| Title | Name the decision or proposal |
| Subtitle | State the hidden decision in one sentence |
| Metrics | Show constraints, signals, dates, costs, scope, or target outcomes |
| Core judgment | Preserve the recommendation and strongest reason |
| Evidence | List facts, observations, examples, or codebase signals |
| Risks | Name failure modes and mitigations |
| Next move | Give one action with owner or trigger |

## Length

- Chinese: 400-600 characters.
- English: 200-350 words.
- Keep bullets short enough to scan.
- If content overflows, cut weaker evidence before shrinking type.

## Voice

- Write like an engineer preserving a decision for a teammate.
- Use numbers only when they came from the source or were checked.
- Keep uncertainty explicit.
- Prefer specific nouns and verbs.
- Remove empty strategy language.
- Do not fill template slots with invented proof.

## Source Handling

Check external facts when the paper mentions a company, product, person, version, funding round, release date, market number, technical spec, or current public claim.

Priority:
- User-provided material.
- Official docs, site, repository, release note, filing, or press release.
- Credible secondary source if official material is missing.

If sources conflict, name the conflict and ask.

## Diagram Writing

Use a diagram when it teaches structure faster than prose:

- Architecture: components and boundaries.
- Flowchart: decision paths.
- Quadrant: positioning or priority.
- Timeline: phases and milestones.
- Waterfall: contribution bridge.
- Donut or bar: share and comparison.
- Line: trend over time.

Captions should say what the reader should notice.

Avoid captions like "Architecture diagram" or "Timeline". Use lines like "The risky part is the handoff between capture and review."
