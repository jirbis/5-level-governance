# 2026-09-15 — CODIFY FAIL CLOSED

Recorded the standing rule "A check that cannot verify must fail, not pass" in
`decisions/README.md`, with `decisions/2026-09-15-checks-fail-closed.md` (D4) as
the approved decision.

The rule exists because the same defect appeared three times in this branch, and
review caught all three, never the suite:

- an unresolvable `GOVERNANCE_DIFF_BASE` swallowed every git error, so an
  out-of-scope edit, a rewritten record and an unapproved `LAW.md` amendment
  together produced an overall PASS;
- a failing `make -n test` was read as "no test target", so a broken test setup
  got `Tests — not configured` and a green verdict — introduced while fixing an
  unrelated complaint;
- a settings default of 200 was indistinguishable from a real choice, so
  `REALITY_FILE_LIMIT` was never consulted and a generated REALITY passed one
  gate while failing the other.

In each the check announced success at exactly the moment it had verified
nothing. The suites missed all three because they tested only "the condition
held" and "the condition did not hold", never "the condition could not be
evaluated". The rule therefore requires a test for that third state.

It is enforced by review, not by a gate: no mechanical check can establish that
another check fails closed. Per the first standing rule, an unenforced rule is
recorded as such, so it is listed in `REALITY.md` under Open Risks rather than
given enforcement theatre it cannot have.

Files: `decisions/README.md`, `decisions/2026-09-15-checks-fail-closed.md`
(added), `PATH.md`, `REALITY.md`.

Deviations: none; scopes declared in steps P61-P62 before the work.

- `gate_1`: PASS — P61-P62 declared and bounded before the change
- `gate_2`: PASS — scope clean, records append-only, REALITY current, the policy
  change recorded and approved
