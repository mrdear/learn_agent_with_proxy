---
name: refactor
description: "Use while implementing code to continuously improve structure, naming, contracts, boundaries, and local design through the author's personal taste: simple readable code, restrained abstraction, design patterns only when helpful, and case-based style memory across any programming language."
---

# Refactor

Use this skill while coding. It guides small refactors, naming choices, boundary cleanup, and design summaries as the implementation evolves.

The examples may use Java, but the taste is language-agnostic. Apply the same thinking to Swift, TypeScript, Python, Go, Rust, or any other language.

The goal is not to pause work for a big redesign. The goal is to keep the code easy to read, easy to change, and hard to misuse while the feature is being built.

## Relationship To Review

`refactor` is used during implementation. It helps shape the code as it is written.

`review` is used near the end of a task. It checks whether the task is complete, safe, tested, and coherent.

When both apply, use `refactor` for local structure and taste decisions, then use `review` for final assessment.

## Core Taste

Prefer:

- code that is easy to read in one pass
- a clear main path before clever abstraction
- explicit contracts over hidden recovery
- stable responsibility boundaries over casual coordination
- domain language over technical filler names
- protected invariants over public mutable state
- small direct code until a real variation point appears
- patterns that clarify extension, not patterns that decorate code
- a little duplication when the abstraction would make reading harder
- focused refactors that preserve behavior and reduce accidental complexity

Avoid:

- cleverness that makes the reader reconstruct intent
- fallback logic inside trusted internals
- defensive checks that hide broken contracts
- vague `Manager`, `Provider`, `Helper`, `Util`, `Context`, or `Data` objects
- interfaces without stable variation
- public fields, public setters, and mutable collections that leak invariants
- generic frameworks created before the second concrete use case
- abstractions whose only purpose is to remove two similar lines
- broad rewrites that mix design cleanup with unrelated behavior changes

## Smell Map

| Smell | Look For | Preferred Move | Case |
| --- | --- | --- | --- |
| Hidden fallback | Required dependencies are recreated, guessed, auto-initialized, or silently repaired | Move validation to the boundary and fail fast inside trusted internals | [hidden-fallback.md](cases/hidden-fallback.md) |
| Unreadable main path | Core behavior is buried under branches, callbacks, adapters, defensive checks, or setup noise | Make the happy path visible first; push details behind named helpers only when that helps reading | [readable-main-path.md](cases/readable-main-path.md) |
| Bad abstraction from duplication | Similar code is merged too early and the shared abstraction hides intent | Keep duplication until the variation is stable and nameable | [duplication-over-abstraction.md](cases/duplication-over-abstraction.md) |
| Wrong pattern use | Repeated branching has no extension point, or pattern layers exist only to look architectural | Name the variation first, then choose Strategy, Command, Factory, Template Method, or direct code | [wrong-pattern-use.md](cases/wrong-pattern-use.md) |
| Messy fields and interfaces | Random mutable fields, broad interfaces, thin interfaces, parameter drift, unclear ownership | Make required state explicit; keep interfaces around stable capabilities | [messy-fields-interface.md](cases/messy-fields-interface.md) |
| Domain exposure | Public setters, leaked mutable collections, data bags, invariants enforced by callers | Expose behavior; keep mutation and lifecycle ownership inside the domain object | [domain-exposure.md](cases/domain-exposure.md) |
| Over-engineering | Managers, registries, providers, factories, and generic layers before real repetition exists | Collapse fake flexibility; keep clean boundaries around current behavior | [over-engineering.md](cases/over-engineering.md) |
| Scattered lifecycle | Setup, validation, execution, cleanup, and error policy are spread across unrelated classes | Centralize lifecycle ownership and make each phase explicit | [scattered-lifecycle.md](cases/scattered-lifecycle.md) |
| Primitive obsession | Strings, maps, booleans, and loose enums carry domain meaning everywhere | Introduce small value objects or domain types only where they protect meaning | [primitive-obsession.md](cases/primitive-obsession.md) |

## Pattern Taste

Use design patterns when they make the code easier to read or localize change:

- Strategy when behavior varies by a stable axis.
- Command when an action needs to be queued, logged, retried, undone, or passed around.
- Factory when creation has real policy, dependency choice, or invariant setup.
- Template Method when lifecycle order is stable and steps vary.
- Value Object when a primitive carries validation, identity, formatting, or comparison rules.

Prefer direct code when the variation is vague, the call chain gets longer, or the abstraction mainly exists to remove duplication.

## During-Coding Workflow

1. Understand the local intent before changing structure.
2. Keep the first working version simple.
3. Watch for smells from the table while editing.
4. Load only the matching case files when a smell appears.
5. Make the smallest refactor that improves readability or boundary clarity.
6. Preserve behavior unless the user asked for behavior change.
7. Summarize the refactor reason when it reflects a reusable taste rule.

Do not spawn a review subagent from this skill. If the task needs final assessment, switch to the `review` skill.

## Review Heuristics

Ask these questions while reading:

- Can I understand the main path without jumping across many files?
- What contract does this code assume but not say?
- Which class owns this state or lifecycle?
- Is this abstraction paying rent today?
- Is this duplication actually clearer than the proposed abstraction?
- Is a caller allowed to put the model into an invalid state?
- Is this branch real domain variation or defensive uncertainty?
- Would a future change happen in one place or scatter across the system?

## Output

When reporting refactor work, keep it concise:

```markdown
## Refactor Summary
- What changed:
- Why this shape is clearer:
- Case used or case candidate:

## Verification
- What was run:
```

When the refactor reveals a new personal style rule, propose a small case file instead of expanding this SKILL.md.
