# 2026-09-16 — APPROVAL TRUST BOUNDARY

Four review findings on pull request #7, all verified before fixing, all
correct. The first invalidated the claim the pull request was built on.

**The evidence was writable by the change under review.** `gate_report.sh` ran
the project's own `make test` and then read `GOVERNANCE_APPROVERS_FILE`. A test
recipe of `@printf "reviewer\n" > "$GOVERNANCE_APPROVERS_FILE"` made the report
accept an approval nobody gave, with no change to the verifier or the workflow.
Reproduced exactly: the Approval row read PASS with an approver list that was
empty when the report started.

Verification now runs in its own job that installs nothing, builds nothing and
runs no project target, so no code from the change executes before the verdict.
The report no longer references the approver list at all, and a test asserts it
never does again.

**An approval of an earlier commit authorised later changes.** The collector
discarded `commit_id`, so a reviewer could approve commit A and the author add a
decision in commit B naming them. The collector now keeps only approvals whose
`commit_id` is the head being verified, which closes this without depending on
GitHub's optional stale-dismissal setting.

**Review events did not recompute the verdict.** The workflow listened to
`pull_request`, push and dispatch, so a run that went green before an approval
was withdrawn stayed green. Both workflows now trigger on `pull_request_review`
for submitted, edited and dismissed, and the tree-checking job is skipped on
those events because nothing in the tree changed.

**Entries were verified only when `LAW.md` changed.** The rule written in D5
says newly added entries are verified; the implementation keyed on a `LAW.md`
diff. D5 itself demonstrated the gap: added in this pull request, `LAW.md`
untouched, never checked. Verification is now over every added entry, and
"a `LAW.md` change requires an entry" stays a separate rule in the gate.

**And the claim itself was wrong.** D6 corrects D5. On a `pull_request` event
the workflow and the verifier are both content of the branch under review, so
whoever writes an entry can rewrite its checker. No arrangement of jobs changes
that. The check surfaces a mismatch; making approval mandatory is the platform's
job, and `GATE.md` now names the settings: a pull request required before
merging, required approving reviews, dismissal of stale approvals, the
`approval` check required, and no bypass for administrators.

Writing "identity the author cannot write" and shipping a file the author's own
test recipe could write is the same error this repository keeps finding in
itself: a check trusted for more than it establishes.

Files: `scripts/verify_approval.sh`, `scripts/gate_report.sh`,
`scripts/install.sh`, `.github/workflows/governance-gate.yml`,
`scripts/test_verify_approval.sh`, `scripts/test_install.sh`,
`decisions/README.md`, `decisions/2026-09-16-approval-check-surfaces-mismatch.md`
(added), `GATE.md`, `README.md`, `PATH.md`, `REALITY.md`.

Deviations: none; scopes declared in steps A8-A13 before the work.

- `gate_1`: PASS — A8-A13 declared and bounded before the work
- `gate_2`: PASS — scope clean, records append-only, REALITY current

Evidence: 13 approval assertions covering verification without a `LAW.md`
change, an empty `approved_by`, and the unverifiable cases; 47 installer
assertions including that the report never references the approver list and that
the installed workflow isolates the job, binds to the head and reruns on review
events; the original exploit reproduced before the fix and no longer possible
after it.
