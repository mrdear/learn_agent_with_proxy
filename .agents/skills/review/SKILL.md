---
name: review
description: Use near the end of a task, PR, branch, or implementation session to assess whether the whole task is complete, safe, coherent, tested, and aligned with the author's coding taste. Spawns or uses the read-only reviewer subagent when available.
---

# Review

Use this skill near the end of a task. It checks whether the implementation actually satisfies the request, whether anything important is missing, and whether the final shape is reasonable.

`refactor` is for shaping code while writing. `review` is for final assessment after the implementation has a concrete shape.

The review should find real risks before style preferences.

## Subagent Workflow

When custom agents are available, spawn the `reviewer` subagent for an independent read-only pass.

Use these spawn settings by default:

```text
agent_type: reviewer
fork_context: false
```

Use `fork_context: false` by default. The reviewer should not inherit the parent conversation; the parent agent must pass a compact review packet with the exact task intent and evidence. This keeps the reviewer independent and prevents it from relying on hidden context.

Build the subagent prompt from this template:

```text
Review the completed task as a read-only reviewer.

Repository: <absolute repo path>
User request: <original request or acceptance criteria>
Change summary: <brief factual summary of what changed>

Scope:
- In scope: <changed files, modules, behavior, or commands to inspect>
- Out of scope: <known unrelated dirty files, or "none known">

Evidence:
- Diff: <paste the relevant diff, or give exact git/file commands to inspect it>
- Key files: <paths and line references when useful>
- Verification: <commands run and results>
- Not run: <commands skipped and why>

Review instructions:
Check whether the implementation satisfies the request, introduces regressions, misses tests, or leaves unreasonable design risks.
Use the author's taste: simple readable structure, explicit contracts, restrained abstraction, readable duplication over bad abstraction.
Return only actionable findings with severity, file/line, concrete risk, evidence, and focused fix direction.
If the packet lacks essential context, say exactly what is missing instead of guessing.
Do not edit files.
```

The parent agent should keep working locally while the review subagent runs when there is useful non-overlapping work, such as reading the diff, running tests, or checking changed files.

After the subagent returns:

- verify the finding against the code before presenting it
- discard speculative or style-only comments
- combine duplicate findings
- keep final judgment with the parent agent

## Assessment Priorities

Lead with findings in this order:

1. task requirement not fully satisfied
2. correctness bugs or behavior regressions
3. security, privacy, or data-loss risk
4. missing tests or weak verification for changed behavior
5. integration gaps, migration gaps, or broken workflows
6. maintainability risks likely to create bugs
7. personal taste issues that materially affect readability or boundaries

Style-only feedback should be rare. It belongs in the review only when it hides a real risk or violates the author's core taste strongly enough to make future changes harder.

## What To Inspect

- original user request and acceptance criteria
- changed files and nearby call sites
- tests added, removed, or skipped
- error handling and fallback paths
- state ownership and lifecycle boundaries
- public API or schema changes
- concurrency, caching, persistence, and async behavior
- configuration, environment, and migration paths
- places where the main path is hard to read
- abstractions introduced only to remove small duplication

## Output Format

For assessment tasks:

```markdown
## Judgment
One sentence on whether the task looks complete and safe.

## Findings
### <severity>: <short title>
- Location: <file:line>
- Risk: <concrete failure or maintenance risk>
- Evidence: <why this can happen>
- Fix: <focused direction>

## Tests
What was run, what failed, or what still needs coverage.

## Notes
Only include useful residual context.
```

If there are no findings, say that directly and mention remaining test gaps or uncertainty.

For fix tasks, use the review to choose what to change, then implement the smallest safe patch and run verification.
