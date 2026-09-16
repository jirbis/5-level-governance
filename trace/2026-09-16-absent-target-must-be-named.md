# 2026-09-16 — ABSENT TARGET MUST BE NAMED

Third defect in `test_target_state`, third of the same shape, reported by the
owner and reproduced exactly.

A missing required `include` makes make fail with `No rule to make target
'missing-test-config.mk'` — no `needed by`, and the named target is not `test`.
The previous condition asked only whether the failure "looked like" an absent
target, so a project whose test setup could not be evaluated at all reported
`Tests — not configured` and an overall PASS while `make test` exited 2.

The fix is not another exclusion. Absence must be POSITIVELY ESTABLISHED: make
has to name `test` itself as the thing it cannot build. Everything else — a
missing prerequisite, a missing include, a parse error, any failure to evaluate
the makefile — is `broken` and fails the report.

That this took three rounds is the point. `decisions/` D4 says a check that
cannot verify must fail rather than pass, and each previous attempt kept
inferring a verdict from the shape of an error instead of requiring positive
evidence. Two exclusions were added and both were incomplete, because the space
of ways make can fail is open and the space of ways it says "no target named
test" is not.

Verified against four fixtures — present, missing prerequisite, missing include,
genuinely absent — giving `✅ PASS / 🟢`, `❌ FAIL / 🔴`, `❌ FAIL / 🔴`,
`— not configured / 🟢`. Three assertions added to `scripts/test_install.sh`,
including that a genuinely absent target is still reported as not configured, so
the fix cannot be "make everything FAIL".

Files: `scripts/gate_report.sh`, `scripts/test_install.sh`, `PATH.md`,
`REALITY.md`.

Deviations: none; scopes declared in steps P63-P64 before the work.

- `gate_1`: PASS — P63-P64 declared and bounded before the fix
- `gate_2`: PASS — scope clean, records append-only, REALITY current
