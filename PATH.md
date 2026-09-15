# PATH

## Objective
Define the admissible implementation route under LAW.

## Active Scope
- Workspace: `5-level-governance`
- Goal: `Bind PATH steps to concrete file scopes (allowed_paths) and enforce them in Gate 2 against the real git diff, so that "no silent scope expansion" becomes a mechanical check instead of a declaration.`
- Out of scope: `TRACE append-only enforcement, generated REALITY snapshots, test-suite exit-code gating, multi-agent TRACE sharding. These are recorded as open items, not executed here.`

## Step Schema
Each step may declare the file scope it is permitted to touch:

```
- [ ] `P3` Do the thing.
      allowed_paths: scripts/**, Makefile
      forbidden_paths: LAW.md
```

- Patterns are anchored at the workspace root and must match the whole path.
- `**` matches any number of path segments, `*` matches within one segment, `?` matches one character; neither `*` nor `?` crosses `/`.
- A pattern ending in `/` is shorthand for that directory and everything under it.
- `forbidden_paths` wins over `allowed_paths`.
- `REALITY.md` and `TRACE.md` are always writable: the execution loop mandates them.
- `PATH.md` is NOT implicitly writable. Changing the route must itself be declared in scope.

## Step List (Deterministic Order)
- [x] `P1` Declare goal, constraints and per-step file scopes.
      allowed_paths: PATH.md
- [x] `P2` Run Gate 1 on the planned change set.
      allowed_paths: PATH.md
- [x] `P3` Implement allowed_paths parsing and git-diff scope enforcement in the shell gate, with tests.
      allowed_paths: scripts/**, Makefile, PATH.md
      note: scope widened during execution to expose the new tests as `make test`; widening is recorded here rather than taken silently.
- [x] `P4` Mirror the same enforcement in the VS Code extension and its emitted templates.
      allowed_paths: vscode-extension/src/*.ts, vscode-extension/package.json, PATH.md
      note: scope widened during execution to declare the governance.diffBase setting; widening is recorded here rather than taken silently.
- [x] `P5` Document the new Gate 2 criterion in GATE.md and README.md.
      allowed_paths: GATE.md, README.md, PATH.md
- [x] `P6` Update REALITY and append TRACE.
      allowed_paths: PATH.md
- [x] `P7` Run Gate 2 on the resulting state and apply the CODIFY decision.
      allowed_paths: PATH.md, CODIFY.md

## Current Pointer
- `active_step`: `P7`

## Blocking Questions
- (none)

## Completion Criteria
- All checked steps have corresponding TRACE entries.
- Gate 1 and Gate 2 are both PASS for the final state.
- Gate 2 rejects a change that touches a file outside the active step's `allowed_paths`.
