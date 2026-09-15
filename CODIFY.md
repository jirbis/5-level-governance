# CODIFY

## Purpose
Convert learning into stable rules without doctrine drift.

## Decision Matrix
- Update `PATH.md` when learning is local to current task flow.
- Update `LAW.md` when learning changes architectural doctrine.
- Update `CLAUDE.md` when learning is operational behavior for the agent.

## Standing Rules (Codified From Repeated Evidence)

### A prohibition without a check is decoration
Every `Forbidden` item in `LAW.md` must have a corresponding mechanical check in
`GATE.md`, or be recorded in `REALITY.md` as an unenforced rule. A rule the agent
attests to itself constrains nothing: the agent writes both the work and the
evidence.

Evidence: `No silent scope expansion` and `Rewriting prior TRACE history` were
both doctrine for the whole life of this repo while Gate 2 checked neither. Both
were passable by writing plausible text.

### A check must read state the agent did not author
Prefer git history, exit codes and the file tree over prose in the canon files.
When a check can only read agent-authored prose, say so where it is defined.

### One rule, one implementation
When a gate criterion exists in more than one runtime, pin the implementations
to each other with a test that compares their output, not just their verdict.
Two gates that word the same finding differently are already drifting.

## Codify Procedure
1. Identify observed issue from TRACE.
2. Classify issue type: `LOCAL`, `ARCHITECTURAL`, `OPERATIONAL`.
3. Propose minimal rule change in the matching file.
4. Re-run Gate 1 and Gate 2.
5. Append codify result to TRACE.

## Constraints
- Do not patch LAW for convenience.
- Do not skip TRACE evidence.
- Do not codify speculative patterns without repeated evidence.

## Codify Output Format
- `type`: LOCAL | ARCHITECTURAL | OPERATIONAL
- `target_file`: PATH.md | LAW.md | CLAUDE.md
- `change_summary`: one sentence
- `gate_status_after_change`: Gate1=<PASS/FAIL>, Gate2=<PASS/FAIL>
