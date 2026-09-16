# 2026-09-15 — REVIEW FINDINGS PR6

Five findings from the review of pull request #6, all verified before fixing and
all correct.

**P1 — an unresolvable diff base disabled every check.** `GOVERNANCE_DIFF_BASE`
was used without validation and git errors were swallowed with `|| true`, so a
failed diff was indistinguishable from a clean tree: no changed files, nothing
out of scope, nothing to check. Reproduced an overall PASS with an out-of-scope
edit present. `scope_base_resolves` now validates, `scope_changed_files`
propagates failure, and all three callers fail closed and name the base. The
extension's `diffBase` returns null and its callers refuse the same way. The
worst failure mode for a gate is not a false alarm, it is a vacuous pass.

**P1 — the extension's Update REALITY command destroyed hand-written content.**
It still wrote the pre-generation template wholesale, removing the
`generated:` markers and every hand-written section, after which Gate 2 fails.
It now uses `renderReality`, which splices only the marked regions and returns
null when there are none, so the command refuses rather than overwrites.

**P2 — `TRACE.md` was still the implicitly allowed path, not `trace/**`.** In
both implementations. This branch hid it because its own migration step
explicitly permits `trace/**`; any normal workspace would have had required
trace entries rejected as out of scope. The earlier edit that was supposed to
change the shell constant silently failed to match and was reported as applied —
that patch, unlike its neighbours, carried no assertion.

**P2 — the emitted templates still prescribed the removed records.** Init
created `trace/` and `decisions/` while the instructions it wrote told agents to
record in `TRACE.md`, which the shell gate rejects as unmigrated. Fourteen
substitutions across the CLAUDE, LAW, GATE and PATH templates, plus a generated
REALITY that listed files init never creates and omitted the ones it seeds.

**P2 — the two implementations disagreed above 200 files.** The shell generator
collapses to directory counts; the extension always expected individual
filenames, so a freshly generated REALITY passed one gate and failed the other.
The threshold and the collapse now live in `artifactLines`, shared.

The review's closing point was the sharpest: the parity suite compared selected
helpers, not whole workflows. `scripts/test_init_integration.mjs` now scaffolds
a workspace exactly as the extension does and runs the shell gate against it. It
immediately found a sixth defect nobody had reported — the REALITY template
emitted its artifact list unsorted, so the very first `make reality` in a new
workspace would call the file stale over ordering alone.

Files: `scripts/path_scope.sh`, `scripts/gate_enforce.sh`,
`scripts/test_path_scope.sh`, `scripts/test_extension_parity.mjs`,
`scripts/test_init_integration.mjs` (added), `Makefile`,
`vscode-extension/src/{gates,parsers,realityRules,traceAppend,templates}.ts`,
`PATH.md`, `REALITY.md`.

Deviations: none; scopes declared in steps P40-P46 before the work.

- `gate_1`: PASS — P40-P46 declared and bounded before any fix
- `gate_2`: PASS — scope clean, records append-only, REALITY current

Evidence: 30 scope assertions (3 new, covering the vacuous pass), 18 shard, 23
REALITY, 19 report, 13 decision-log, 55 parity and the new init integration
suite, all PASS; `tsc --noEmit` clean; extension build clean; the bad-base
reproduction now fails the gate with the base named, and a freshly initialized
workspace passes Gate 2.
