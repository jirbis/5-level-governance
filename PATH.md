# PATH

## Objective
Define the admissible implementation route under LAW.

## Active Scope
- Workspace: `<set workspace root>`
- Goal: `<set concrete goal>`
- Out of scope: `<set explicit exclusions>`

## Step List (Deterministic Order)
- [ ] `P1` Define/confirm goal and constraints.
- [ ] `P2` Run Gate 1 on planned changes.
- [ ] `P3` Execute smallest admissible change set.
- [ ] `P4` Update REALITY and TRACE.
- [ ] `P5` Run Gate 2 on resulting state.
- [ ] `P6` Apply CODIFY decision.

## Current Pointer
- `active_step`: `P1`

## Blocking Questions
- (none)

## Completion Criteria
- All checked steps have corresponding TRACE entries.
- Gate 1 and Gate 2 are both PASS for the final state.
