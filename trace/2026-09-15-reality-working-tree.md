# 2026-09-15 — REALITY WORKING TREE

Fixed a chicken-and-egg flaw in REALITY generation, found by the gate itself
immediately after the sharding commit.

`reality_artifacts_block` listed `git ls-files`, which reports the index only.
A newly created file was therefore absent from a freshly generated REALITY,
and the moment it was staged the file became stale again — generate, stage,
stale, forever one step behind. The gate caught this on the first run after a
commit that added seven files.

The artifact list now unions tracked files with untracked-but-not-ignored ones,
so it reflects the working tree as a developer sees it rather than the index.
Mirrored in the extension and pinned by the parity test.

Knock-on: with untracked files counted, three test fixtures were caught writing
temp files inside the repository under test, which were then listed as artifacts
and vanished on the next move. They now write outside it.

Files: `scripts/reality_gen.sh`, `vscode-extension/src/gates.ts`,
`scripts/test_extension_parity.mjs`, `scripts/test_gate_report.sh`,
`scripts/test_reality_gen.sh`, `REALITY.md`.

Deviations: none; `scripts/**`, `vscode-extension/src/*.ts` and `REALITY.md`
were already inside the scopes declared for steps P26-P36.

- `gate_1`: PASS — change inside already-declared scope
- `gate_2`: PASS — REALITY current, records append-only, evidence on every entry

Evidence: `make gate` PASS, full suite PASS, and the failure that prompted this
no longer reproduces after staging.
