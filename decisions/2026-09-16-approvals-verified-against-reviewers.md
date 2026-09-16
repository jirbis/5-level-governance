### D5 — 2026-09-16 — An approval is verified against the approving reviewer

- `type`: ARCHITECTURAL
- `target_file`: `decisions/README.md`, `GATE.md`
- `change`: `approved_by` must name the GitHub login of someone who submitted an approving review on the pull request carrying the entry, and CI verifies it against the reviews. Only entries the change adds are verified; entries already in the record are immutable and are never re-examined.
- `evidence`: `REALITY.md` recorded, from the first version of the decision log, that the approval check proves an approval was RECORDED and not that it was GIVEN — tamper-evidence rather than authentication. That limit was the largest remaining gap for using the log as change-control evidence, since nothing inside a file can establish who wrote it. The reviews on a pull request are held by the repository and cannot be written by the author of the entry, which makes them the identity to bind to.
- `enforcement`: `scripts/verify_approval.sh`, run by CI where the approvers can be established. It fails closed per D4: an approver list that was never written means the query failed, which is not "nobody approved" and is never a pass.
- `limits`: a change pushed directly to the default branch has no pull request and therefore no reviews to verify against. That is branch protection's job, not the gate's, and is recorded in `REALITY.md` rather than papered over.
- `approved_by`: jirbis
- `approved_at`: 2026-09-16
