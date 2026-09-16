### D6 — 2026-09-16 — The approval check surfaces mismatch; GitHub makes approval mandatory

- `type`: ARCHITECTURAL
- `target_file`: `decisions/README.md`, `GATE.md`
- `change`: corrects D5. Verifying `approved_by` against the reviewers is a check that SURFACES a mismatch between the recorded name and the accounts that approved. It is not a barrier against a hostile author, and the canon no longer claims it is. Making approval mandatory is a repository setting — branch protection or a ruleset with required reviews and dismissal of stale approvals.
- `evidence`: review of pull request #7 demonstrated the claim was false. `gate_report.sh` ran the project's own `make test` and then read `GOVERNANCE_APPROVERS_FILE`; a test recipe of `@printf "reviewer\n" > "$GOVERNANCE_APPROVERS_FILE"` made the report accept an approval nobody gave, with no change to the verifier or the workflow. Reproduced here exactly. More fundamentally, on a `pull_request` event both the workflow and the verifier come from the branch under review, so whoever writes an entry can also rewrite its checker. A check cannot be the last line of defence against the author of the code it checks.
- `enforcement`: the verification now runs in a job that installs nothing, builds nothing and runs no project target, so no code from the change executes before the verdict; an approval counts only for the exact head it approved; and review submission, edit and dismissal retrigger the job. Every newly added `decisions/` entry is verified, not only those accompanying a `LAW.md` change — D5 itself was added without touching `LAW.md` and went unchecked.
- `limits`: the workflow and the verifier are still content of the branch under review. Required approval belongs to GitHub's settings, and `GATE.md` says which ones.
- `approved_by`: jirbis
- `approved_at`: 2026-09-16
