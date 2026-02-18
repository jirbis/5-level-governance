# CODIFY

## Purpose
Convert learning into stable rules without doctrine drift.

## Decision Matrix
- Update `PATH.md` when learning is local to current task flow.
- Update `LAW.md` when learning changes architectural doctrine.
- Update `CLAUDE.md` when learning is operational behavior for the agent.

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
