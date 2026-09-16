# 5-Level Governance Plugin

This folder is a Claude-compatible governance plugin.

It implements the LAW-PATH-TRACE-GATE-REALITY discipline as a strict artifact workflow.

## Included Files
- `CLAUDE.md`: plugin instruction prompt for Claude/Codex-style agents.
- `LAW.md`: non-negotiable doctrine and constraints.
- `PATH.md`: intended implementation route.
- `GATE.md`: admissibility checks (before work and before done).
- `REALITY.md`: current state of repo/artifacts; generated sections kept current by `make reality`.
- `trace/`: append-only execution evidence, one file per entry.
- `decisions/`: append-only record of changes to the rules, with approvals.

## 7-Step Combined Loop
1. Validate against `LAW.md`.
2. Define or update `PATH.md`.
3. Run Gate 1 (PATH admissibility).
4. Execute work and update `REALITY.md`.
5. Add a new entry under `trace/` recording the actual changes.
6. Run Gate 2 (REALITY admissibility).
7. Record any rule change as a new file under `decisions/` with an approval.

## Install Into Your Project

```bash
git clone https://github.com/jirbis/5-level-governance
bash 5-level-governance/scripts/install.sh /path/to/your/project --with-ci
```

That writes the canon files, the `trace/` and `decisions/` records, the gate
runtime under `scripts/`, and `governance.mk`. With `--with-ci` it also installs
the GitHub Actions workflow.

**Nothing is overwritten.** An existing file is left alone and reported as
skipped, so re-running the installer to pick up a newer gate cannot destroy your
records or your notes. If you already have a `Makefile`, yours is untouched and
you add one line to it:

```make
include governance.mk
```

Then:

1. Fill in the Active Scope and the per-step `allowed_paths` in `PATH.md`.
2. Run `make gate`. **Gate 1 fails until the `<set ...>` placeholders are
   gone** — an installed but unconfigured workspace is not admissible, and
   saying so is the point.
3. Load `CLAUDE.md` as your agent's instructions.

`make report` renders the same verdict CI posts. A project with no `test` target
is reported as *not configured* rather than failed; add one and it is run.

## Daily Use

You write `PATH.md`. Everything else is generated or checked.

| Command | When |
| --- | --- |
| `make gate` | before committing |
| `make reality` | after adding or removing files |
| `make trace` | read the execution record in order |
| `make decisions` | read the record of rule changes |
| `make report` | the verdict as Markdown |

What an agent cannot do quietly: touch a file outside `allowed_paths`, edit a
past `trace/` entry, change `LAW.md` without an approved `decisions/` entry, or
leave `REALITY.md` disagreeing with the tree.

## Usage In This Repository
1. Open this folder as the working context.
2. Load `CLAUDE.md` as your runtime instruction.
3. Keep all state transitions in files, not chat.

Rule: if it is not written in `LAW.md`, `PATH.md`, `GATE.md`, `REALITY.md`, or `trace/`, it does not exist.

## Continuous Integration

`.github/workflows/governance-gate.yml` runs both gates and the test suite on
every pull request and posts the verdict as a comment, updating it in place so a
busy pull request does not collect one comment per push:

> ## 🟢 Governance Gate — PASS
>
> | Check | Result |
> | --- | --- |
> | Gate 1 · PATH admissibility | ✅ PASS |
> | Gate 2 · REALITY admissibility | ✅ PASS |
> | Tests | ✅ PASS |
>
> Active step `P24` · diffed against `e3e9438756e1` · 25 passed, 0 failed

On failure the comment leads with the blockers — the out-of-scope path, the
rewritten TRACE entry, the unrecorded policy change — and the job fails.

Two details that decide whether the check means anything:

- The workflow checks out with `fetch-depth: 0`. Gate 2 diffs against the
  merge-base, so a shallow clone would leave it with nothing to compare and the
  scope check would pass vacuously.
- It diffs against the **merge-base** with the target branch, not the base
  branch tip. Changes that landed on the base branch after this one forked are
  not this change's scope.

Render the same report locally with `make report`, which writes to stdout.

If you redirect it to a file, write that file **outside the workspace**. A
report written into the checkout is an untracked file that exists before the
gates run, and they will correctly report it as out of scope and as REALITY
drift — the harness failing the very check it exists to run. This is not
hypothetical: it is how the workflow's own first run on a pull request failed.

**Fork limitation.** A `pull_request` run from a fork gets a read-only
`GITHUB_TOKEN`, so the comment step cannot post and is marked
`continue-on-error`. The report is always written to the job summary, and the
verdict step still fails the run, so the gate is never silently skipped. If you
need comments on fork pull requests, split the workflow: run the gates on
`pull_request` and upload the report as an artifact, then post it from a
separate `workflow_run` workflow that has write permission. Do not reach for
`pull_request_target` — it runs with a writable token against untrusted code.

## Generated REALITY

`REALITY.md` is supposed to be the artifact truth, and a hand-written list
drifts — this repository twice carried a REALITY that omitted files sitting on
disk. So the mechanical parts are generated and the rest is not:

```markdown
<!-- generated:snapshot -->     ← rewritten by `make reality`
<!-- generated:artifacts -->    ← rewritten by `make reality`

## Deltas This Run              ← yours, preserved verbatim
## Open Risks                   ← yours, preserved verbatim
```

`make reality` splices only between the markers. A file with no markers is left
untouched and the command fails rather than replacing your prose with a
template.

Gate 2 then regenerates the artifact region and compares:

```
FAIL: REALITY: REALITY.md is stale; run `make reality` — unrecorded: scripts/new.sh
```

This catches a tracked file that was never recorded — the direction the old
"do all listed artifacts exist?" check was blind to.

Only the artifact region is compared. The snapshot carries the generation date
and HEAD, which move for reasons that are not drift, and requiring them to be
current would make every commit a stale-REALITY failure.

Workspaces above `REALITY_FILE_LIMIT` tracked files (200 by default) are listed
by directory with counts instead of file by file: a record nobody can read is
not a record.

## Gate Enforcement Command
- Run all checks: `make gate`
- Run Gate 1 only: `make gate1`
- Run Gate 2 only: `make gate2`
- Run the test suite: `make test`
- Regenerate REALITY: `make reality`
- Render the records: `make trace`, `make decisions`
- Render the Markdown report: `make report`
- Direct script usage: `bash ./scripts/gate_enforce.sh [gate1|gate2|all]`

## Scope Enforcement

`No silent scope expansion` is a mechanical check, not a promise. Each PATH step
declares the files it may touch, and Gate 2 matches the real git diff against it:

```markdown
- [ ] `P3` Replace the retry backoff.
      allowed_paths: src/net/**, tests/net/**
      forbidden_paths: src/net/legacy.rs
```

Touch anything outside that set and Gate 2 fails with the offending path:

```
FAIL: PATH scope: out-of-scope file changed: src/auth/session.rs
      (not matched by any allowed_paths of step 'P3' or completed steps)
```

Pattern rules:

| Pattern | Matches |
| --- | --- |
| `src/**` | everything under `src/`, at any depth |
| `src/*.ts` | `.ts` files directly in `src/`, not in subdirectories |
| `**/test.py` | `test.py` at any depth, including the root |
| `docs/` | shorthand for `docs/**` |

Patterns are anchored at the workspace root and must match the whole path.
`forbidden_paths` beats `allowed_paths`.

The check fails closed. If the active step declares no `allowed_paths`, or the
workspace is not a git repository, no change is admissible: scope that cannot be
verified is not scope. `REALITY.md` and `trace/**` are always writable because
the execution loop mandates writing them; `PATH.md` is not, so widening the
route is itself a visible, declared act.

Set `GOVERNANCE_DIFF_BASE` (or the `governance.diffBase` setting in the
extension) to control what the diff is taken against. The default is the
merge-base with the default branch, falling back to `HEAD`.

## Append-Only Records

`trace/` records what the work did. `decisions/` records what changed the rules.
Both are directories of one file per entry:

```
trace/2026-09-15-scope-enforcement.md
trace/2026-09-15-ci-gate.md
decisions/2026-09-15-declared-scope.md
```

**Why not one file.** A single append-only file is correct but not usable: two
agents, or two branches, appending on the same day collide on the last line of
the same file every time. One file per entry removes the conflict by
construction — two additions to a directory do not touch the same bytes. This is
the difference between a discipline one person can keep and one a team can.

Append-only becomes per-file immutability, which is sharper: an entry that
existed at the base must be byte-identical now.

```
FAIL: TRACE append-only: modified: trace/2026-02-18-init.md
FAIL: TRACE append-only: touched in commit 9f3c1ab: trace/2026-02-18-init.md
```

Gate 2 walks every commit in the range, not just the endpoints: a branch that
rewrites an entry and restores it later has still tampered with the record. Only
entries already in the record are protected — an entry added on this branch can
still be corrected before it merges.

Each directory's `README.md` holds that directory's rules, not an entry, and is
exempt. Render the whole record in order with `make trace` or `make decisions`.

### Migrating from a single file

```
bash scripts/shard_migrate.sh            # dry run: shows the filenames
bash scripts/shard_migrate.sh --apply    # writes the shards
```

The legacy `TRACE.md` and `DECISIONS.md` are left in place; removing them is a
separate, deliberate commit, because a record is not something a script should
delete on its own. Gate 2 fails while they are still present, so an unmigrated
workspace is told rather than silently passing.

## Policy Change Control

`LAW.md` is the policy, and it may not change without a recorded approval.
`trace/` records what the work did; `decisions/` records what changed the
rules that govern the work.

If a diff touches `LAW.md`, Gate 2 requires a newly appended entry naming it:

```markdown
### D1 — 2026-09-15 — Declared scope is a precondition of admissibility
- `type`: ARCHITECTURAL
- `target_file`: `LAW.md`
- `change`: added the Non-Negotiable "No change is admissible outside a scope
  declared in `PATH.md`".
- `evidence`: TRACE 2026-09-15 SCOPE ENFORCEMENT
- `approved_by`: someone@example.com
- `approved_at`: 2026-09-15
```

Otherwise:

```
FAIL: DECISIONS: LAW.md changed with no new decisions/ entry naming it
      and carrying a recorded approved_by
```

A pre-existing entry does not justify a later amendment, the target and the
approval must be in the same entry, and an `approved_by` that is empty, a
placeholder or `TBD` is not an approval.

**What this cannot do.** It verifies that an approval is *recorded*, not that it
was *given* — nothing inside a file can prove who wrote it. Binding `approved_by`
to a real identity needs signed commits or a reviewed pull request, which is a
property of the repository rather than of the canon. It is tamper-evidence, not
authentication.
