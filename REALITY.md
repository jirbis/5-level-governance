# REALITY

<!-- generated:snapshot -->
## Current State Snapshot
- Generated: `2026-09-15`
- Workspace root: `5-level-governance`
- Active PATH step: `P38`
- HEAD at generation: `07b7878`
- Working tree at generation: `dirty`
<!-- /generated:snapshot -->
<!-- generated:artifacts -->
## Existing Artifacts
- `.github/workflows/build-vsix.yml`
- `.github/workflows/governance-gate.yml`
- `CLAUDE.md`
- `GATE.md`
- `LAW.md`
- `Makefile`
- `PATH.md`
- `README.md`
- `REALITY.md`
- `decisions/2026-09-15-declared-scope-is-a-precondition-of-admissibility.md`
- `decisions/2026-09-15-records-become-directories.md`
- `decisions/2026-09-15-the-record-of-rule-changes-becomes-an-enforced-artifact.md`
- `decisions/README.md`
- `scripts/decision_log.sh`
- `scripts/gate_enforce.sh`
- `scripts/gate_report.sh`
- `scripts/path_scope.sh`
- `scripts/reality_gen.sh`
- `scripts/reality_update.sh`
- `scripts/shard_migrate.sh`
- `scripts/shard_store.sh`
- `scripts/test_decision_log.sh`
- `scripts/test_extension_parity.mjs`
- `scripts/test_gate_report.sh`
- `scripts/test_path_scope.sh`
- `scripts/test_reality_gen.sh`
- `scripts/test_shard_store.sh`
- `trace/2026-02-18-add-gate-commands.md`
- `trace/2026-02-18-fix-gate-script.md`
- `trace/2026-02-18-init.md`
- `trace/2026-09-15-ci-gate.md`
- `trace/2026-09-15-codify-2.md`
- `trace/2026-09-15-codify.md`
- `trace/2026-09-15-decisions-log.md`
- `trace/2026-09-15-generated-reality.md`
- `trace/2026-09-15-reality-working-tree.md`
- `trace/2026-09-15-scope-enforcement.md`
- `trace/2026-09-15-shard-records.md`
- `trace/2026-09-15-trace-append-only.md`
- `trace/README.md`
- `vscode-extension/.gitignore`
- `vscode-extension/.vscodeignore`
- `vscode-extension/esbuild.mjs`
- `vscode-extension/package-lock.json`
- `vscode-extension/package.json`
- `vscode-extension/resources/governance.svg`
- `vscode-extension/src/diagnostics.ts`
- `vscode-extension/src/extension.ts`
- `vscode-extension/src/gates.ts`
- `vscode-extension/src/parsers.ts`
- `vscode-extension/src/realityRules.ts`
- `vscode-extension/src/scanner.ts`
- `vscode-extension/src/shardRules.ts`
- `vscode-extension/src/templates.ts`
- `vscode-extension/src/traceAppend.ts`
- `vscode-extension/src/traceRules.ts`
- `vscode-extension/src/treeView.ts`
- `vscode-extension/src/wizard.ts`
- `vscode-extension/tsconfig.json`
<!-- /generated:artifacts -->
## Deltas This Run
- `TRACE.md` and `DECISIONS.md` are gone, replaced by `trace/` and `decisions/`,
  one file per entry. Append-only became per-file immutability: an entry that
  existed at the base must be byte-identical now, and every commit in the range
  is walked so a rewrite restored later is still caught.
- Two agents adding entries on the same day now merge cleanly. That was the last
  open risk blocking parallel work, and there is a merge test for it.
- The byte-prefix machinery became dead code once the gate stopped calling it
  and was removed rather than left behind.

- `REALITY.md` is generated, not written. `scripts/reality_gen.sh` rewrites the
  regions between the `generated:` markers from the tree; hand-written sections
  are spliced around and preserved. `make reality` applies it.
- Gate 2 replaced two weak REALITY checks — that the file did not say `UNKNOWN`,
  and that everything it listed existed — with a staleness comparison against
  regeneration. The old checks were blind to a tracked file that was never
  recorded, which is the drift this file actually suffered twice.
- The ripgrep-free gate, the generated REALITY and the report renderer are all
  mirrored in the extension and pinned by the parity test.
- The gates now run in CI. `.github/workflows/governance-gate.yml` executes both
  gates and the test suite on every pull request and posts the verdict as a
  comment, updated in place rather than appended per push.
- The report is rendered by `scripts/gate_report.sh` rather than by the workflow
  YAML, so the rendering is testable; `scripts/test_gate_report.sh` covers the
  passing verdict, the failing verdict, attribution of a Gate 1 failure to
  Gate 1, and the presence of the marker the comment updater keys on.
- The ripgrep dependency is gone from `scripts/gate_enforce.sh`, replaced by
  `grep`. Under `set -e` a missing `rg` aborted the gate instead of reporting a
  clean FAIL, which in CI would have looked like a broken job rather than a
  failed gate.

## Deltas From Earlier Runs
- `CODIFY.md` is gone, replaced by `DECISIONS.md`: an append-only record of rule
  changes rather than a procedure document. It was the only canon artifact with
  no mechanical check, and the single decision it produced targeted itself.
- Gate 2 now enforces two things about it: the log is append-only, and any change
  to `LAW.md` requires a newly appended entry naming it with a recorded
  `approved_by`. A pre-existing entry does not justify a later amendment.
- `LAW.md` was amended under that rule, with `DECISIONS.md` D1 and D2 as the
  recorded approvals: declared scope and recorded rule changes are now
  Non-Negotiables, and amending `LAW.md` without an approved entry is Forbidden.
- Gate 2 caught the stale `CODIFY.md` entry in this file during the rename,
  which is the artifact list drifting exactly as the open risk predicted.
- Gate 2 now verifies that `TRACE.md` only grows: every version must have the
  previous version as an exact byte prefix. The whole commit chain is walked,
  then the working tree, so a rewrite that is later restored is still caught.
- The pure prefix rule was extracted to `vscode-extension/src/traceRules.ts` so
  both gate implementations can be compared directly; the parity test now
  asserts byte-identical violation messages, not merely the same verdict.
- Adding the new module broke the scope test fixtures, which copied gate
  dependencies by name. They now copy `scripts/*.sh` wholesale. The test suite
  caught this, which is the first time the suite has paid for itself.
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
- The gates still do not consult the host project's own test or build exit
  codes, only this repository's.
- The pull request comment cannot be posted from a fork, where the token is
  read-only. The job summary and the failing verdict still apply, but a fork
  contributor sees no comment.
- The `push` run on `main` diffs against the previous commit, so it assumes the
  merged `PATH.md` still describes the work that produced that commit. A stale
  PATH on `main` would show as a scope failure there.
- The approval check verifies that an approval is recorded, not that it was
  given. Binding `approved_by` to a real identity needs signed commits or a
  reviewed pull request. It is tamper-evidence, not authentication.
- REALITY is still hand-maintained, so the artifact list can drift again. It
  should be generated from the tree rather than written.
- Gate checks still do not consult the project's own test or build exit codes.
- A single `TRACE.md` file will conflict under parallel agents or branches.

## Notes
- This file represents current truth and must be updated after each admissible
  execution step.
