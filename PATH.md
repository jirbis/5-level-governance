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
- [x] `P8` Declare scope for TRACE append-only enforcement.
      allowed_paths: PATH.md
- [x] `P9` Implement TRACE append-only verification in the shell gate, with tests.
      allowed_paths: scripts/**, Makefile, PATH.md
- [x] `P10` Mirror TRACE append-only verification in the VS Code extension.
      allowed_paths: vscode-extension/src/*.ts, PATH.md
- [x] `P11` Document the criterion in GATE.md and README.md.
      allowed_paths: GATE.md, README.md, PATH.md
- [x] `P12` Update REALITY, append TRACE, run Gate 2 and apply CODIFY.
      allowed_paths: PATH.md, CODIFY.md
- [x] `P13` Declare scope for turning CODIFY into an enforced policy change log.
      allowed_paths: PATH.md
- [x] `P14` Replace `CODIFY.md` with append-only `DECISIONS.md` and record the approved LAW amendment as its first entry.
      allowed_paths: DECISIONS.md, CODIFY.md, LAW.md, CLAUDE.md, PATH.md
- [x] `P15` Enforce the log in Gate 2: DECISIONS is append-only, and a change to LAW.md requires a new approved entry.
      allowed_paths: scripts/**, Makefile, PATH.md
- [x] `P16` Mirror the enforcement in the VS Code extension and its emitted templates.
      allowed_paths: vscode-extension/src/*.ts, PATH.md
- [x] `P17` Document the artifact and the criterion.
      allowed_paths: GATE.md, README.md, PATH.md
- [x] `P18` Update REALITY, append TRACE, run Gate 2.
      allowed_paths: PATH.md, DECISIONS.md
- [x] `P19` Declare scope for running the gates in CI.
      allowed_paths: PATH.md
- [x] `P20` Remove the undeclared ripgrep dependency from the shell gate, which would abort the gate in CI rather than report a clean FAIL.
      allowed_paths: scripts/**, PATH.md
- [x] `P21` Render gate and test results as a Markdown report, with tests.
      allowed_paths: scripts/**, Makefile, PATH.md
- [x] `P22` Add the GitHub Actions workflow that runs the gates and posts the report to the pull request.
      allowed_paths: .github/workflows/**, PATH.md
- [x] `P23` Document the workflow and its fork limitation.
      allowed_paths: README.md, PATH.md
- [x] `P24` Update REALITY, append TRACE, run Gate 2.
      allowed_paths: PATH.md, DECISIONS.md
- [x] `P25` Declare scope for generating REALITY instead of writing it.
      allowed_paths: PATH.md
- [x] `P26` Generate the mechanical sections of REALITY from the tree, preserving hand-written sections, with tests.
      allowed_paths: scripts/**, Makefile, REALITY.md, PATH.md
- [x] `P27` Replace the weak REALITY checks in Gate 2 with a staleness check against the regenerated content.
      allowed_paths: scripts/**, PATH.md
- [x] `P28` Mirror the staleness check in the VS Code extension and its emitted template.
      allowed_paths: vscode-extension/src/*.ts, PATH.md
- [x] `P29` Document the generated artifact and the criterion.
      allowed_paths: GATE.md, README.md, PATH.md
- [x] `P30` Update REALITY, append TRACE, run Gate 2.
      allowed_paths: PATH.md, DECISIONS.md
- [x] `P31` Declare scope for sharding the two append-only records.
      allowed_paths: PATH.md
- [x] `P32` Implement the shard store and its immutability rule, with tests.
      allowed_paths: scripts/**, Makefile, PATH.md
- [x] `P33` Migrate `TRACE.md` and `DECISIONS.md` into `trace/` and `decisions/`.
      allowed_paths: trace/**, decisions/**, TRACE.md, DECISIONS.md, scripts/**, PATH.md
- [x] `P34` Replace the byte-prefix checks in Gate 2 with shard immutability.
      allowed_paths: scripts/**, PATH.md
- [x] `P35` Update the canon file list and the agent loop.
      allowed_paths: CLAUDE.md, PATH.md
- [x] `P36` Mirror the shard rules in the VS Code extension, including the append command and tree view.
      allowed_paths: vscode-extension/src/*.ts, PATH.md
- [x] `P37` Document the layout, the migration and the criterion.
      allowed_paths: GATE.md, README.md, PATH.md
- [x] `P38` Update REALITY, record the decision, append TRACE.
      allowed_paths: PATH.md, decisions/**, trace/**
- [x] `P39` Stop the CI workflow writing its report inside the workspace it is checking.
      allowed_paths: .github/workflows/**, README.md, PATH.md
- [x] `P40` Declare scope for the review findings on pull request #6.
      allowed_paths: PATH.md
- [x] `P41` Fail closed on an unresolvable diff base instead of treating it as an empty diff.
      allowed_paths: scripts/**, vscode-extension/src/*.ts, PATH.md
- [x] `P42` Make the extension's Update REALITY command splice the generated regions instead of overwriting the file.
      allowed_paths: vscode-extension/src/*.ts, PATH.md
- [x] `P43` Implicitly allow `trace/**` rather than the removed `TRACE.md`, in both implementations.
      allowed_paths: scripts/**, vscode-extension/src/*.ts, PATH.md
- [x] `P44` Finish the record migration inside the emitted templates.
      allowed_paths: vscode-extension/src/*.ts, PATH.md
- [x] `P45` Share the artifact-listing rules, including the file-count threshold, between both implementations.
      allowed_paths: scripts/**, vscode-extension/src/*.ts, PATH.md
- [x] `P46` Update REALITY, record the fixes, run Gate 2.
      allowed_paths: PATH.md, trace/**

## Current Pointer
- `active_step`: `P46`

## Blocking Questions
- (none)

## Completion Criteria
- All checked steps have corresponding TRACE entries.
- Gate 1 and Gate 2 are both PASS for the final state.
- Gate 2 rejects a change that touches a file outside the active step's `allowed_paths`.
- Gate 2 rejects any history rewrite of `TRACE.md`: the recorded route may only grow.
- Gate 2 rejects a change to `LAW.md` that carries no new approved `DECISIONS.md` entry.
