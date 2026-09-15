# REALITY

## Current State Snapshot
- Date: `2026-09-15`
- Workspace root: `5-level-governance` (repository root; previously pinned to a stale absolute path)
- Active PATH step: `P12`
- Last gate status: `PASS`

## Existing Artifacts
- `README.md`
- `CLAUDE.md`
- `LAW.md`
- `PATH.md`
- `GATE.md`
- `REALITY.md`
- `TRACE.md`
- `CODIFY.md`
- `Makefile`
- `scripts/gate_enforce.sh`
- `scripts/path_scope.sh`
- `scripts/trace_append_only.sh`
- `scripts/test_path_scope.sh`
- `scripts/test_trace_append_only.sh`
- `scripts/test_extension_parity.mjs`
- `.github/workflows/build-vsix.yml`
- `vscode-extension/package.json`
- `vscode-extension/src/extension.ts`
- `vscode-extension/src/gates.ts`
- `vscode-extension/src/parsers.ts`
- `vscode-extension/src/traceRules.ts`
- `vscode-extension/src/templates.ts`
- `vscode-extension/src/treeView.ts`
- `vscode-extension/src/diagnostics.ts`
- `vscode-extension/src/traceAppend.ts`
- `vscode-extension/src/scanner.ts`
- `vscode-extension/src/wizard.ts`

## Deltas This Run
- Gate 2 now verifies that `TRACE.md` only grows: every version must have the
  previous version as an exact byte prefix. The whole commit chain is walked,
  then the working tree, so a rewrite that is later restored is still caught.
- The pure prefix rule was extracted to `vscode-extension/src/traceRules.ts` so
  both gate implementations can be compared directly; the parity test now
  asserts byte-identical violation messages, not merely the same verdict.
- Adding the new module broke the scope test fixtures, which copied gate
  dependencies by name. They now copy `scripts/*.sh` wholesale. The test suite
  caught this, which is the first time the suite has paid for itself.

## Deltas From The Previous Run
- Gate 2 gained a mechanical scope check: the git diff is matched against the
  `allowed_paths` declared by PATH steps. Enforcement exists in both gate
  implementations (`scripts/path_scope.sh` and `vscode-extension/src/gates.ts`)
  and the two are held in agreement by a parity test.
- `PATH.md` carries a real route with per-step scopes instead of placeholders.
- The step parser now skips fenced code blocks and reads only the Step List
  section, so documented examples cannot be mistaken for executable steps.
- The artifact list above was previously incomplete: `Makefile`, `scripts/` and
  the whole `vscode-extension/` tree existed on disk but were unrecorded.

## Open Risks
- REALITY is still hand-maintained, so the artifact list can drift again. It
  should be generated from the tree rather than written.
- Gate checks still do not consult the project's own test or build exit codes.
- `scripts/gate_enforce.sh` depends on `rg` being installed; absence of
  ripgrep aborts the gate under `set -e` rather than reporting a clean FAIL.
- A single `TRACE.md` file will conflict under parallel agents or branches.

## Notes
- This file represents current truth and must be updated after each admissible
  execution step.
