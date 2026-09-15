# DECISIONS (Append-Only)

The record of changes to the rules. `TRACE.md` records what the work did;
this file records what changed the rules that govern the work.

## Rules
- Append the newest entry at the bottom. Never rewrite an earlier entry.
- Every change to `LAW.md` requires a new entry here with a recorded approval.
  Gate 2 enforces this: an unexplained amendment is inadmissible.
- Do not amend `LAW.md` for convenience. Amend it when a recorded gate failure
  or structural limitation demands it.
- Do not codify a speculative pattern. Wait for repeated evidence.

## Entry Format
```
### D<n> — <date> — <one-line title>
- `type`: LOCAL | ARCHITECTURAL | OPERATIONAL
- `target_file`: the file whose rules changed
- `change`: what changed, in one sentence
- `evidence`: the TRACE entries or gate failures that motivated it
- `approved_by`: who approved it
- `approved_at`: when
```

## Decision Matrix
- `LOCAL` — learning is specific to the current task flow. Target `PATH.md`.
- `ARCHITECTURAL` — learning changes doctrine. Target `LAW.md`.
- `OPERATIONAL` — learning changes agent behaviour. Target `CLAUDE.md`.

## Standing Rules

### A prohibition without a check is decoration
Every `Forbidden` item in `LAW.md` must have a corresponding mechanical check in
`GATE.md`, or be recorded in `REALITY.md` as an unenforced rule. A rule the agent
attests to itself constrains nothing: the agent writes both the work and the
evidence.

### A check must read state the agent did not author
Prefer git history, exit codes and the file tree over prose in the canon files.
Where a check can only read agent-authored prose, say so where it is defined.

### One rule, one implementation
When a gate criterion exists in more than one runtime, pin the implementations
to each other with a test that compares their output, not just their verdict.
Two gates that word the same finding differently are already drifting.

## Entries

### D1 — 2026-09-15 — Declared scope is a precondition of admissibility
- `type`: ARCHITECTURAL
- `target_file`: `LAW.md`
- `change`: added the Non-Negotiable "No change is admissible outside a scope declared in `PATH.md`", and the Forbidden item "Changing files outside the scope declared for the active step".
- `evidence`: `TRACE.md` 2026-09-15 SCOPE ENFORCEMENT — "No silent scope expansion" had been doctrine since the repository was created while neither Gate 2 implementation looked at what actually changed; the rule became enforceable once Gate 2 began matching the git diff against declared `allowed_paths`.
- `approved_by`: gregory.kneller@gmail.com
- `approved_at`: 2026-09-15

### D2 — 2026-09-15 — The record of rule changes becomes an enforced artifact
- `type`: ARCHITECTURAL
- `target_file`: `CLAUDE.md`, `LAW.md`
- `change`: replaced `CODIFY.md`, a procedure document with no gate, by this append-only log; `LAW.md` gains "No rule changes without an approved entry in `DECISIONS.md`" and forbids amending `LAW.md` without one.
- `evidence`: `CODIFY.md` was the only canon artifact with no mechanical check, and the one codify decision it produced targeted itself, because the file it should have written to was not in the declared scope. A procedure nobody verifies is not a control.
- `approved_by`: gregory.kneller@gmail.com
- `approved_at`: 2026-09-15
