# GATE

## Gate 1: PATH Admissibility (Before Work)

### Question
Does the intended PATH conform to LAW?

### PASS if
- PATH does not contradict any LAW rule.
- Scope is explicit and bounded.
- No non-canonical or speculative rules were added.
- Required inputs are present or explicitly listed as blockers.

### FAIL if
- Any LAW contradiction exists.
- Scope creep is present.
- Required decisions are missing.
- PATH contains ambiguous action that can alter architecture without review.

### On FAIL
- Record FAIL in `TRACE.md`.
- Stop or produce a new PATH and re-run Gate 1.

## Gate 2: REALITY Admissibility (Before Accept/Merge)

### Question
Does REALITY conform to PATH and LAW, with TRACE evidence?

### PASS if
- Produced artifacts match permitted PATH steps.
- Every changed file is inside the `allowed_paths` of the active step or of a
  completed step, verified against the real git diff.
- No changed file matches a `forbidden_paths` pattern.
- `TRACE.md` and `DECISIONS.md` have only grown: every version has the previous
  one as an exact byte prefix.
- If `LAW.md` changed, `DECISIONS.md` carries a new entry naming it with a
  recorded `approved_by`.
- No forbidden LAW condition appears in REALITY.
- TRACE includes exact files changed and outcomes.
- Deviations are documented and resolved.

### FAIL if
- REALITY deviates from PATH without explicit approval.
- A changed file falls outside every declared `allowed_paths` pattern.
- Any version of `TRACE.md` or `DECISIONS.md` in the range rewrote, reordered,
  truncated or deleted an earlier entry.
- `LAW.md` changed without a new approved `DECISIONS.md` entry naming it.
- The active step declares no scope at all, or the workspace is not a git
  repository: scope that cannot be verified is not scope.
- TRACE is incomplete or missing.
- LAW was implicitly changed.

### Scope Enforcement (Mechanical)
Gate 2 does not take the agent's word for scope. It computes the changed set
from git and matches it against the patterns declared in `PATH.md`:

- Changed set = `git diff <base>` + staged changes + untracked files, where
  `<base>` is `GOVERNANCE_DIFF_BASE`, else the merge-base with the default
  branch, else `HEAD`.
- Admissible surface = union of `allowed_paths` over every completed step and
  the active step, because a branch diff is the cumulative result of the steps
  already executed.
- `REALITY.md` and `TRACE.md` are always admissible; the loop mandates them.
- `PATH.md` is not. Widening the route is itself a declared act.

### Append-Only Enforcement (Mechanical)
`LAW.md` forbids rewriting prior TRACE history. Gate 2 verifies it rather than
trusting it: every version of `TRACE.md` must have the previous version as an
exact byte prefix.

- The whole commit chain `base..HEAD` is walked, then the working tree. A
  branch that rewrites TRACE in one commit and restores it in the next has
  still destroyed the audit trail, and comparing only the endpoints would
  miss it.
- A file absent at a revision counts as empty, so deleting `TRACE.md` reports
  as truncation.
- Creating the file where none existed is admissible; the empty prefix is a
  prefix of anything.
- The same rule applies to `DECISIONS.md`.

### Policy Change Control (Mechanical)
`LAW.md` is the policy. It may not change without a recorded approval:

- If the diff touches `LAW.md`, `DECISIONS.md` must carry a **newly appended**
  entry naming `LAW.md` with a non-empty `approved_by`. A pre-existing entry
  does not justify a later amendment, and an approval recorded in one entry does
  not carry over to a different entry's target.
- An `approved_by` that is empty, a placeholder or `TBD` is not an approval.

**What this check cannot do.** It verifies that an approval is *recorded*, not
that it was *given*. Nothing inside a file can prove who wrote it. Binding
`approved_by` to a real identity requires signed commits or a reviewed pull
request: a property of the repository, not of the canon. Treat the check as
tamper-evidence, not authentication.

### On FAIL
- Record FAIL in `TRACE.md`.
- Stop, then either revert pathologically unsafe change or redefine PATH and re-run gates.
