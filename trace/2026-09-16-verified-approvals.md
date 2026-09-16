# 2026-09-16 — VERIFIED APPROVALS

Closed the largest limit the decision log carried since it was created:
`approved_by` proved an approval was RECORDED, not that it was GIVEN.

Nothing inside a file establishes who wrote it, so the name had to be bound to
something the author of the entry cannot write. The reviews on a pull request
are held by the repository, so `scripts/verify_approval.sh` now requires
`approved_by` to name a GitHub account that submitted an approving review on the
change carrying the entry. CI collects the approvers and the gate report carries
the verdict.

Design points, each of which could have been got wrong quietly:

- **Fails closed, per D4.** An approver list that was never written means the
  query failed — not "nobody approved" — and is never a pass. The workflow step
  that collects the reviewers carries no `continue-on-error`, so a failed query
  fails the job rather than falling through to an unverified green.
- **Only added entries are verified.** Entries already in the record were
  approved under the rule that applied then and are immutable. Re-examining them
  against a newer rule would force rewriting history, which is precisely what
  the append-only record exists to prevent. The historical entries here name an
  email address and are left exactly as they are.
- **The latest review state wins.** An approval later dismissed or replaced by a
  request for changes is not an approval.
- **Outside CI there is nothing to verify against**, so the report says
  `— not available outside CI` rather than showing a check that never ran.

Recorded as `decisions/2026-09-16-approvals-verified-against-reviewers.md` (D5),
which is itself the first entry written under the new rule: it names a GitHub
login rather than an email.

Remaining and recorded rather than papered over: a change pushed straight to the
default branch has no pull request and no reviews to verify against. That is
branch protection's job, not the gate's.

Files: `scripts/verify_approval.sh`, `scripts/test_verify_approval.sh` (added),
`scripts/gate_report.sh`, `scripts/install.sh`,
`.github/workflows/governance-gate.yml`, `decisions/README.md`,
`decisions/2026-09-16-approvals-verified-against-reviewers.md` (added),
`GATE.md`, `README.md`, `Makefile`, `PATH.md`, `REALITY.md`.

Deviations: none; scopes declared in steps A1-A6 before the work.

- `gate_1`: PASS — A1-A6 declared and bounded before the work
- `gate_2`: PASS — scope clean, records append-only, REALITY current

Evidence: 11 approval assertions, of which four cover the unverifiable cases the
standing rule demands; 42 installer, 30 scope, 23 REALITY, 19 report, 18 shard,
13 decision-log, parity and init integration all PASS.
