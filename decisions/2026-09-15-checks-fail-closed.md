### D4 — 2026-09-15 — A check that cannot verify must fail, not pass

- `type`: ARCHITECTURAL
- `target_file`: `decisions/README.md`
- `change`: added the standing rule "A check that cannot verify must fail, not pass", requiring every check to report FAIL when verification is impossible, and requiring a test for that third state alongside pass and fail.
- `evidence`: three instances of the same defect in one branch, each found by review rather than by the suite. `GOVERNANCE_DIFF_BASE=no-such-ref` made every git error a swallowed empty diff, so an out-of-scope edit, a rewritten record and an unapproved `LAW.md` amendment together produced an overall PASS. `make -n test` failing was read as "no test target", so a project whose test setup was broken got `Tests — not configured` and a green verdict — and that one was introduced while fixing an unrelated complaint. The VS Code settings default of 200 was indistinguishable from a real choice, so `REALITY_FILE_LIMIT` was never consulted and a generated REALITY passed one gate while failing the other. In all three the check announced success at exactly the moment it had verified nothing. The suites missed all three because they exercised only "the condition held" and "the condition did not hold", never "the condition could not be evaluated".
- `enforcement`: review only. No mechanical check can establish that another check fails closed, so this is recorded in `REALITY.md` as an unenforced rule rather than given a gate it cannot have.
- `approved_by`: gregory.kneller@gmail.com
- `approved_at`: 2026-09-15
