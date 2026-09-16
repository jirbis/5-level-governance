# 2026-09-15 — INSTALL PATH

Two further review findings on pull request #6, both verified and fixed, plus
the install path.

**Init missed nested files.** The REALITY template was fed `existingFiles` from
a scanner that reads only the root directory, so a project with `src/app.ts`
failed its own first gate: `REALITY.md is stale — unrecorded: src/app.ts`. The
integration test hid it by passing a complete list by hand.

The fix removes the guess rather than improving it. `vscode-extension/src/realityIo.ts`
derives the file list from git exactly as `scripts/reality_gen.sh` does, and init
now calls `regenerateReality` after writing the templates. The Update REALITY
command delegates to the same function, so there is one implementation. The
integration test now builds a project with nested sources and an ignored build
directory, runs the real chain, and asserts the nested files are recorded and
the ignored ones are not.

**A non-default file limit still diverged.** The shell generator read
`REALITY_FILE_LIMIT` from the environment; the extension hardcoded 200, so with
`REALITY_FILE_LIMIT=5` a generated REALITY passed one gate and failed the other.
`realityFileLimit()` now resolves the setting, then the environment variable,
then 200, and the parity suite covers it.

**The install path.** Initialization wrote the canon files but not the gate
runtime, so a new workspace had in-editor checks and no `make gate` and no CI.
`scripts/install.sh` (also `make install DEST=...`) writes the runtime, the
records, the doctrine and `governance.mk`, optionally the workflow.

It overwrites nothing: an existing file is skipped and reported, so re-running
to pick up a newer gate cannot destroy records or notes, and a project's own
`Makefile` is left alone with a one-line include to add. It refuses to install
into the governance repository itself.

`gate_report.sh` now reports a project with no `test` target as *not configured*
rather than FAIL. Reporting failure for tests that were never configured would
teach people to ignore the verdict.

Files: `scripts/install.sh`, `scripts/test_install.sh` (added);
`scripts/gate_report.sh`, `scripts/test_init_integration.mjs`,
`scripts/test_extension_parity.mjs`, `Makefile`, `README.md`,
`vscode-extension/src/realityIo.ts` (added),
`vscode-extension/src/{realityRules,gates,extension,traceAppend}.ts`,
`vscode-extension/package.json`, `PATH.md`, `REALITY.md`.

Deviations: none; scopes declared in steps P47-P54 before the work.

- `gate_1`: PASS — P47-P54 declared and bounded before any change
- `gate_2`: PASS — scope clean, records append-only, REALITY current

Evidence: 28 installer assertions, 30 scope, 23 REALITY, 19 report, 18 shard,
13 decision-log, parity and init integration, all PASS. An installed workspace
passes Gate 2 immediately and fails Gate 1 until its scope is filled in, which
is the intended state.
