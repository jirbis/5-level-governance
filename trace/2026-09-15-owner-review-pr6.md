# 2026-09-15 — OWNER REVIEW PR6

Four findings from the pull request owner, all verified and all correct.

**`--force` erased evidence.** `put()` disabled its own existing-file guard
globally under `--force`, so reinstalling on the same UTC date overwrote
`trace/YYYY-MM-DD-init.md` — contradicting the promise written at the top of the
same file. Records now go through `put_record()`, which never overwrites under
any flag and takes the next free name on a collision. `--force` still refreshes
doctrine, which is what it is for; it cannot touch evidence.

**A broken test target read as an absent one.** `make -n test` fails both when
the target does not exist and when it exists but cannot run, so a project whose
test setup was broken got `Tests — not configured` and a green verdict. That is
the same vacuous pass as the diff-base bug, in a different place. The two cases
are distinguishable — make names the missing target and adds "needed by" when it
is a prerequisite of an existing one — and a broken target now fails the report.

**`--with-ci` installed a workflow that could not run.** It copied this
repository's own workflow, which builds the VS Code extension from a directory
the installer deliberately does not create, so the job would have died before
reaching the gates. The installer now writes a workflow built for an installed
project: checkout with full history, resolve the merge-base, run the installed
runtime, comment, verdict. No node, no extension.

**The settings default masked the environment.** Callers read the limit with
`get()`, and `package.json` declares a default of 200, so an untouched setting
still supplied 200 and `REALITY_FILE_LIMIT` was never consulted.
`explicitFileLimit()` uses `inspect()` and returns a value only when one is
actually set somewhere in the hierarchy. Precedence is now explicit setting,
then environment, then 200, and the parity suite covers all three.

Files: `scripts/install.sh`, `scripts/gate_report.sh`, `scripts/test_install.sh`,
`scripts/test_extension_parity.mjs`,
`vscode-extension/src/{gates,traceAppend,realityRules}.ts`, `PATH.md`,
`REALITY.md`.

Deviations: none; scopes declared in steps P55-P60 before the work.

- `gate_1`: PASS — P55-P60 declared and bounded before any fix
- `gate_2`: PASS — scope clean, records append-only, REALITY current

Evidence: installer assertions up from 28 to 39, covering evidence surviving
`--force`, the installed workflow needing no extension build, and a broken test
target failing rather than passing; parity covers the limit precedence; 30
scope, 23 REALITY, 19 report, 18 shard, 13 decision-log and the init integration
suite all PASS.
