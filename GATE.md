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
- No forbidden LAW condition appears in REALITY.
- TRACE includes exact files changed and outcomes.
- Deviations are documented and resolved.

### FAIL if
- REALITY deviates from PATH without explicit approval.
- A changed file falls outside every declared `allowed_paths` pattern.
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

### On FAIL
- Record FAIL in `TRACE.md`.
- Stop, then either revert pathologically unsafe change or redefine PATH and re-run gates.
