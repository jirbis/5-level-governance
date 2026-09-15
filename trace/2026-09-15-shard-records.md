# 2026-09-15 — SHARD RECORDS

Split the two append-only records into directories of one file per entry, which
was the last open risk blocking parallel agents and branches.

`TRACE.md` and `DECISIONS.md` became `trace/` and `decisions/`, migrated by
`scripts/shard_migrate.sh` (10 trace entries, 2 decisions, verified lossless
against the originals before removal). Append-only became per-file immutability
in `scripts/shard_store.sh`: additions are the only admissible change, every
commit in the range is walked as well as the endpoints so a rewrite that is
later restored is still caught, and only entries already in the record at the
base are protected so a not-yet-merged entry can still be corrected. Each
directory's `README.md` holds its rules and is exempt.

Gate 2 gained per-entry evidence checking — a shard per entry can be asked
whether it states its gates, where the single file could only be asked whether
some line somewhere did — and a legacy-record check, so a workspace that never
migrated is told rather than silently passing. The byte-prefix machinery
(`scripts/trace_append_only.sh`, `prefixViolation`) became dead code and was
removed rather than left to rot.

Mirrored in the extension: `vscode-extension/src/shardRules.ts`, the Gate 2
implementation, the init flow, the append command (which now writes a new file
instead of editing one) and the tree view. `parseTraceMd` reads both the shard
and the legacy form.

Files: `scripts/shard_store.sh`, `scripts/shard_migrate.sh`,
`scripts/test_shard_store.sh` (added); `scripts/gate_enforce.sh`,
`scripts/decision_log.sh`, `scripts/path_scope.sh`, `Makefile`, `CLAUDE.md`,
`GATE.md`, `README.md`, `PATH.md`, `REALITY.md`, the test fixtures;
`vscode-extension/src/{shardRules,gates,templates,extension,traceAppend,treeView,parsers,traceRules}.ts`;
`scripts/trace_append_only.sh`, `scripts/test_trace_append_only.sh`,
`TRACE.md`, `DECISIONS.md` (removed).

Deviations: none, all changes fell inside scopes declared before work in steps
P31-P38.

Three bugs found and fixed during implementation, all before any commit: the
same-line `local a="$1" b="$a"` expansion trap that bit `reality_gen.sh`
recurred in the migration's name reservation; the reservation was then lost
because a command substitution runs in a subshell; and the new per-entry
evidence check flagged a migrated entry that states its gates in the older
`Gate1=`/`Gate2=` CODIFY spelling — relaxed to accept both rather than rewrite a
historical record, which is what append-only exists to prevent.

- `gate_1`: PASS — scope declared before work in steps P31-P38
- `gate_2`: PASS — records append-only, REALITY current, evidence on every entry

Evidence: 18 shard assertions, 23 REALITY, 19 report, 13 decision-log, 27 scope
and 44 parity assertions PASS; `tsc --noEmit` clean; extension build clean; the
merge test confirms two agents adding entries on the same day merge cleanly,
which is the whole point.
