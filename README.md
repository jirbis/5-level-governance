# 5-Level Governance Plugin

This folder is a Claude-compatible governance plugin.

It implements the LAW-PATH-TRACE-GATE-REALITY discipline as a strict artifact workflow.

## Included Files
- `CLAUDE.md`: plugin instruction prompt for Claude/Codex-style agents.
- `LAW.md`: non-negotiable doctrine and constraints.
- `PATH.md`: intended implementation route.
- `GATE.md`: admissibility checks (before work and before done).
- `REALITY.md`: current state of repo/artifacts.
- `TRACE.md`: append-only execution evidence.
- `DECISIONS.md`: append-only record of changes to the rules, with approvals.

## 7-Step Combined Loop
1. Validate against `LAW.md`.
2. Define or update `PATH.md`.
3. Run Gate 1 (PATH admissibility).
4. Execute work and update `REALITY.md`.
5. Append actual changes to `TRACE.md`.
6. Run Gate 2 (REALITY admissibility).
7. Record any rule change in `DECISIONS.md` with an approval.

## Usage
1. Open this folder as the working context.
2. Load `CLAUDE.md` as your runtime instruction.
3. Keep all state transitions in files, not chat.

Rule: if it is not written in `LAW.md`, `PATH.md`, `GATE.md`, `REALITY.md`, or `TRACE.md`, it does not exist.

## Gate Enforcement Command
- Run all checks: `make gate`
- Run Gate 1 only: `make gate1`
- Run Gate 2 only: `make gate2`
- Run the test suite: `make test`
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
verified is not scope. `REALITY.md` and `TRACE.md` are always writable because
the execution loop mandates writing them; `PATH.md` is not, so widening the
route is itself a visible, declared act.

Set `GOVERNANCE_DIFF_BASE` (or the `governance.diffBase` setting in the
extension) to control what the diff is taken against. The default is the
merge-base with the default branch, falling back to `HEAD`.

## Append-Only TRACE

`TRACE.md` is the audit trail, so Gate 2 verifies that it only ever grows.
Every version must have the previous version as an exact byte prefix:

```
FAIL: TRACE append-only: commit 9f3c1ab rewrites TRACE.md history
      (diverges at byte 214, line 6)
FAIL: TRACE append-only: working tree rewrites TRACE.md history
      (truncated from 1830 to 1204 bytes)
```

This catches editing an earlier entry, reordering, inserting in the middle,
truncating, and deleting the file outright.

The check walks the whole commit chain, not just the endpoints. A branch that
rewrites TRACE in one commit and restores it in the next has still destroyed
the trail, and an endpoint comparison would report it clean.

Creating `TRACE.md` where none existed is admissible — the empty prefix is a
prefix of anything. `DECISIONS.md` is held to the same rule.

## Policy Change Control

`LAW.md` is the policy, and it may not change without a recorded approval.
`TRACE.md` records what the work did; `DECISIONS.md` records what changed the
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
FAIL: DECISIONS: LAW.md changed with no new DECISIONS.md entry naming it
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
