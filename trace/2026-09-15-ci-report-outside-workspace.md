# 2026-09-15 — CI REPORT OUTSIDE WORKSPACE

The governance workflow's first real run, on pull request #6, failed — on
itself.

`bash ./scripts/gate_report.sh > report.md` redirects into the checkout, and the
shell creates `report.md` before `gate_report.sh` even starts. By the time the
gates ran, an untracked `report.md` sat in the repository root, so Gate 2
reported it twice and correctly:

    FAIL: PATH scope: out-of-scope file changed: report.md
    FAIL: REALITY: REALITY.md is stale; run `make reality` — unrecorded: report.md

Nothing was wrong with the checks. The harness was polluting the workspace it
was checking. This is the third instance of the same mistake in this repository
— test fixtures writing temp files into the repository under test were the first
two — and the first one found in production rather than by a test.

The workflow now writes to `${{ runner.temp }}/governance-report.md` and passes
that path to the comment step through `REPORT_PATH`. `README.md` records the
trap, because anyone redirecting `make report` to a file will hit it.

Verified by reproducing the failure locally (creating `report.md` in the root
reproduces both blockers exactly, removing it restores PASS), then simulating
the fixed CI path against the real merge-base: rc=0, 51 changed files in scope,
working tree clean.

Files: `.github/workflows/governance-gate.yml`, `README.md`, `PATH.md`,
`REALITY.md`.

Deviations: none; `.github/workflows/**` and `README.md` were declared for step
P39 before the work.

- `gate_1`: PASS — P39 declared and bounded before the fix
- `gate_2`: PASS — scope clean, records append-only, REALITY current
