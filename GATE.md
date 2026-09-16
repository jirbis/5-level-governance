# GATE

## Gate 1: PATH Admissibility (Before Work)

### Question
Does the intended PATH conform to LAW?

### PASS if
- PATH does not contradict any LAW rule.
- Scope is explicit and bounded.
- No non-canonical or speculative rules were added.
- Required inputs are present or explicitly listed as blockers.

### FAIL if
- Any LAW contradiction exists.
- Scope creep is present.
- Required decisions are missing.
- PATH contains ambiguous action that can alter architecture without review.

### On FAIL
- Record FAIL in a new `trace/` entry.
- Stop or produce a new PATH and re-run Gate 1.

## Gate 2: REALITY Admissibility (Before Accept/Merge)

### Question
Does REALITY conform to PATH and LAW, with TRACE evidence?

### PASS if
- Produced artifacts match permitted PATH steps.
- Every changed file is inside the `allowed_paths` of the active step or of a
  completed step, verified against the real git diff.
- No changed file matches a `forbidden_paths` pattern.
- `trace/` and `decisions/` have only grown: every entry that existed at the
  base is byte-identical now, and was not touched in any commit on the way.
- Every `trace/` entry states `gate_1` and `gate_2`.
- `REALITY.md` matches the tree: its generated artifact region is exactly what
  regeneration would produce.
- If `LAW.md` changed, `decisions/` carries a new entry naming it with a
  recorded `approved_by`.
- No forbidden LAW condition appears in REALITY.
- TRACE includes exact files changed and outcomes.
- Deviations are documented and resolved.

### FAIL if
- REALITY deviates from PATH without explicit approval.
- A changed file falls outside every declared `allowed_paths` pattern.
- An entry in `trace/` or `decisions/` was modified, deleted, renamed or
  replaced.
- A legacy `TRACE.md` or `DECISIONS.md` is still present, unmigrated.
- `LAW.md` changed without a new approved `decisions/` entry naming it.
- `REALITY.md` is stale: a tracked file is unrecorded, or a recorded artifact is
  no longer tracked.
- The active step declares no scope at all, or the workspace is not a git
  repository: scope that cannot be verified is not scope.
- TRACE is incomplete or missing.
- LAW was implicitly changed.

### Scope Enforcement (Mechanical)
Gate 2 does not take the agent's word for scope. It computes the changed set
from git and matches it against the patterns declared in `PATH.md`:

- Changed set = `git diff <base>` + staged changes + untracked files, where
  `<base>` is `GOVERNANCE_DIFF_BASE`, else the merge-base with the default
  branch, else `HEAD`.
- Admissible surface = union of `allowed_paths` over every completed step and
  the active step, because a branch diff is the cumulative result of the steps
  already executed.
- `REALITY.md` and `trace/**` are always admissible; the loop mandates them.
- `PATH.md` is not. Widening the route is itself a declared act.

### Append-Only Enforcement (Mechanical)
`LAW.md` forbids rewriting prior history. The two records are directories of one
file per entry, so append-only is per-file immutability rather than a byte
prefix: an entry that existed at the base must be byte-identical now.

- Additions are the only admissible change. Modify, delete, rename, copy over or
  change the type of an existing entry and Gate 2 names the file.
- Every commit in `base..HEAD` is walked as well as the endpoints. A branch that
  rewrites an entry in one commit and restores it in the next has still tampered
  with the record, and comparing only the endpoints would call that clean.
- Only entries already in the record at the base are protected. An entry added
  on this branch may still be corrected before it merges.
- `README.md` in each directory holds that directory's rules, not an entry, and
  is exempt.

**Why a directory.** A single append-only file is correct but not usable: two
agents, or two branches, appending on the same day collide on the last line of
the same file every time. One file per entry removes the conflict by
construction — two additions to a directory do not touch the same bytes.

### Policy Change Control (Mechanical)
`LAW.md` is the policy. It may not change without a recorded approval:

- If the diff touches `LAW.md`, `decisions/` must carry a **newly added** file
  naming `LAW.md` with a non-empty `approved_by`. A pre-existing entry does not
  justify a later amendment, and an approval recorded in one entry does not
  carry over to a different entry's target.
- An `approved_by` that is empty, a placeholder or `TBD` is not an approval.

### REALITY Currency (Mechanical)
`REALITY.md` is the artifact truth, so it is generated rather than written. The
regions between `<!-- generated:snapshot -->` and `<!-- generated:artifacts -->`
markers are rewritten by `make reality`; everything else in the file is written
by hand and preserved across regeneration.

Gate 2 regenerates the artifact region and compares. This replaces two weaker
checks — that the file did not contain the word `UNKNOWN`, and that every
artifact it listed existed on disk. Neither could see a file that existed but
was never recorded, which is the drift this repository actually suffered twice.

Only the artifact region is compared. The snapshot carries the generation date
and HEAD, which move for reasons that are not drift; requiring them to be
current would turn every commit into a stale-REALITY failure.

### Approval Verification (CI only, and not a barrier)
Where the change arrives as a pull request, every **newly added** `decisions/`
entry must name a GitHub account that submitted an approving review **of that
exact head**. The check compares the recorded name against the reviews.

- `approved_by` must be the approver's GitHub login. `@` and case are tolerated.
- An approval is of a commit, not of a pull request. An approval of an earlier
  commit does not count, so an entry added after the reviewer looked is caught
  without relying on any repository setting.
- Review submission, edit and dismissal retrigger the check. Otherwise a run
  that went green before an approval was withdrawn would stay green.
- Only entries the change ADDS are checked. Entries already in the record are
  immutable and are never re-examined against a newer rule.
- It fails closed. An approver list that was never written means the query
  failed, which is not "nobody approved" and is never a pass.
- It runs in a job that installs nothing, builds nothing and runs no project
  target, so no code from the change executes before the verdict. The gate's own
  report deliberately does not perform it: that job runs the project's tests,
  and a test recipe could write the approver list it is judged by.

**What this is, and is not.** It SURFACES a mismatch between the name written in
the record and the accounts that approved. It does not make approval mandatory,
and it is not a defence against a hostile author: on a `pull_request` event the
workflow and the verifier are both content of the branch under review, so
whoever writes an entry can also rewrite its checker.

**Requiring approval is the platform's job.** Configure it on the default branch:

- a branch protection rule or ruleset requiring a pull request before merging;
- required approving reviews, from code owners where that fits;
- **dismiss stale approvals when new commits are pushed** — optional in GitHub,
  and the setting that makes "approved" mean "approved this change";
- the `approval` check required to pass;
- no bypass for administrators, or the whole arrangement is advisory.

A change pushed straight to the default branch has no pull request and no
reviews to check against. Only the settings above close that.

### REALITY Currency (Mechanical)
`REALITY.md` is the artifact truth, so it is generated rather than written. The
regions between `<!-- generated:snapshot -->` and `<!-- generated:artifacts -->`
markers are rewritten by `make reality`; everything else in the file is written
by hand and preserved across regeneration.

Gate 2 regenerates the artifact region and compares. This replaces two weaker
checks — that the file did not contain the word `UNKNOWN`, and that every
artifact it listed existed on disk. Neither could see a file that existed but
was never recorded, which is the drift this repository actually suffered twice.

Only the artifact region is compared. The snapshot carries the generation date
and HEAD, which move for reasons that are not drift; requiring them to be
current would turn every commit into a stale-REALITY failure.

### Approval Verification (Mechanical, CI only)
Where the change arrives as a pull request, `approved_by` is checked against the
GitHub accounts that submitted an approving review on it. The reviews are held
by the repository and cannot be written by whoever wrote the entry, so the
recorded approval becomes a verified one.

- `approved_by` must be the approver's GitHub login. The `@` prefix and case are
  tolerated.
- Only entries the change ADDS are verified. Entries already in the record are
  immutable and are never re-examined against a newer rule.
- An approval later dismissed or replaced by a request for changes does not
  count: the reviewer's latest state must be `APPROVED`.
- It fails closed. An approver list that was never written means the query
  failed, which is not the same as "nobody approved" and is never a pass.

**What this still cannot do.** A change pushed directly to the default branch
has no pull request and therefore no reviews to verify against. Closing that is
branch protection's job, not the gate's. Outside CI the local gate establishes
only that an approval is recorded — there is no pull request to check.

### On FAIL
- Record FAIL in a new `trace/` entry.
- Stop, then either revert pathologically unsafe change or redefine PATH and re-run gates.
