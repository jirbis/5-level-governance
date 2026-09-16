# decisions/ — the record of rule changes

The record of changes to the rules. `TRACE.md` records what the work did;
this file records what changed the rules that govern the work.

## Rules
- One file per decision, named `YYYY-MM-DD-slug.md`. Never modify or delete
  an existing file: Gate 2 rejects anything but an addition.
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
- `approved_by`: the GitHub login of whoever approved it
- `approved_at`: when
```

Where CI can reach the pull request, `approved_by` must be the GitHub login of
someone who approved that exact head: the check compares the name against the
reviews rather than accepting the string, and every newly added entry is
checked, not only those accompanying a `LAW.md` change. Outside CI there is no
pull request to check, so `make gate` establishes only that an approval is
recorded.

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

### An approval is checked against the reviews, and required by the platform
`approved_by` inside a file proves only that someone typed a name. Where the
change arrives as a pull request, the name must match a GitHub account that
submitted an approving review of that exact head, and CI checks it.

That check SURFACES a mismatch. It does not make approval mandatory, and it is
not a barrier against a hostile author: the workflow and the verifier are both
content of the branch under review, so whoever writes an entry can rewrite its
checker. Requiring approval is the platform's job — branch protection or a
ruleset with required reviews and dismissal of stale approvals.

Only entries a change ADDS are verified. Entries already in the record were
approved under whatever rule applied then, and they are immutable — rewriting a
past entry to satisfy a newer rule is exactly what the append-only record exists
to prevent.

### A check that cannot verify must fail, not pass
When a check cannot perform its verification — a missing input, an unresolvable
reference, a command that errors — it reports FAIL. It never reports PASS, and
it never stays silent.

The failure mode is specific and recurring: an error is swallowed, the empty
result that follows is indistinguishable from a clean one, and the check
announces success precisely when it has verified nothing. A false alarm costs a
few minutes. A vacuous pass costs the reason the check exists.

Every check therefore needs a test for the case where verification is
impossible, not only for pass and fail. A suite that exercises only "the
condition held" and "the condition did not hold" leaves the third state
untested, and that is where this keeps hiding.

This rule is enforced by review, not by a gate: no mechanical check can
establish that another check fails closed. It is recorded in `REALITY.md` as an
unenforced rule, as the first standing rule requires.
