# PATH

## Objective
Define the admissible implementation route under LAW.

## Active Scope
- Workspace: `5-level-governance`
- Goal: `Bind approved_by to the identity that actually approved the pull request, so a recorded approval becomes a verified one rather than a string anyone can type.`
- Out of scope: `Signed commits, CODEOWNERS enforcement, and any rewriting of historical decisions entries — those are immutable by rule and are never re-examined.`

## Step Schema
Each step declares the files it may touch. Gate 2 checks the real git diff
against these patterns, so an undeclared scope admits no change.

```
- [ ] `P3` Do the thing.
      allowed_paths: src/**, Makefile
      forbidden_paths: LAW.md
```

- Patterns are anchored at the workspace root and must match the whole path.
- `**` matches any number of path segments; `*` and `?` never cross `/`.
- A pattern ending in `/` means that directory and everything under it.
- `forbidden_paths` wins over `allowed_paths`.
- `REALITY.md` and `trace/**` are always writable: the loop mandates them.
- `PATH.md` is NOT implicitly writable. Widening the route must be declared.

## Step List (Deterministic Order)
- [x] `A1` Declare the route for verified approvals.
      allowed_paths: PATH.md
- [x] `A2` Add the approval verifier: newly added decisions entries naming LAW.md must be approved by someone who actually approved the pull request.
      allowed_paths: scripts/**, Makefile, PATH.md
      note: scope widened during execution to wire the new suite into `make test`; the gate caught the undeclared edit, and the widening is recorded here rather than taken silently.
- [x] `A3` Surface the result in the gate report, failing closed when the approver list is unavailable.
      allowed_paths: scripts/**, PATH.md
- [x] `A4` Fetch the approvers in CI, in this repository's workflow and in the one the installer ships.
      allowed_paths: .github/workflows/**, scripts/**, PATH.md
- [x] `A5` Record the rule change and document it.
      allowed_paths: decisions/**, GATE.md, README.md, PATH.md
- [x] `A6` Update REALITY, add a trace entry, run Gate 2.
      allowed_paths: PATH.md, trace/**, REALITY.md
- [x] `A7` Ship the approval verifier with the installed runtime, and assert the installed runtime is complete.
      allowed_paths: scripts/**, PATH.md, trace/**, REALITY.md
- [x] `A8` Declare the route for the four review findings on pull request #7.
      allowed_paths: PATH.md
- [x] `A9` Verify every newly added decisions entry, not only when LAW.md changed.
      allowed_paths: scripts/**, PATH.md
- [x] `A10` Bind an approval to the head it approved, so an older commit's approval cannot authorise later changes.
      allowed_paths: .github/workflows/**, scripts/**, PATH.md
- [x] `A11` Run the verification in a job that executes no code from the pull request, and recompute it when a review is submitted, edited or dismissed.
      allowed_paths: .github/workflows/**, scripts/**, PATH.md
- [x] `A12` State the trust boundary honestly: the check surfaces mismatches, GitHub settings make approval mandatory.
      allowed_paths: decisions/**, GATE.md, README.md, PATH.md
- [x] `A13` Update REALITY, add a trace entry, run Gate 2.
      allowed_paths: PATH.md, trace/**, REALITY.md

## Current Pointer
- `active_step`: `A13`

## Blocking Questions
- (none)

## Completion Criteria
- All checked steps have corresponding TRACE entries.
- Gate 1 and Gate 2 are both PASS for the final state.
- Gate 2 rejects a change that touches a file outside the active step's `allowed_paths`.
- Gate 2 rejects any history rewrite of `TRACE.md`: the recorded route may only grow.
- Gate 2 rejects a change to `LAW.md` that carries no new approved `DECISIONS.md` entry.
