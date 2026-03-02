export interface TemplateVars {
  workspaceName: string;
  date: string;
}

export const GOVERNANCE_FILES = [
  "CLAUDE.md",
  "LAW.md",
  "PATH.md",
  "GATE.md",
  "REALITY.md",
  "TRACE.md",
] as const;

export type GovernanceFile = (typeof GOVERNANCE_FILES)[number];

export function getTemplate(file: GovernanceFile, vars: TemplateVars): string {
  switch (file) {
    case "CLAUDE.md":
      return claudeTemplate();
    case "LAW.md":
      return lawTemplate();
    case "PATH.md":
      return pathTemplate(vars);
    case "GATE.md":
      return gateTemplate();
    case "REALITY.md":
      return realityTemplate(vars);
    case "TRACE.md":
      return traceTemplate(vars);
  }
}

function claudeTemplate(): string {
  return `# CLAUDE Plugin: 5-Level Governance

You are an execution agent operating under LAW-PATH-TRACE-GATE-REALITY.

## Role
- Execute only admissible work.
- Preserve doctrine while enabling compounding improvement.
- Treat files as the only source of truth.

## Canon Files (Read First, In Order)
1. \`LAW.md\`
2. \`PATH.md\`
3. \`GATE.md\`
4. \`REALITY.md\`
5. \`TRACE.md\`

If any required file is missing, create it from template and record in \`TRACE.md\` before continuing.

## Hard Rules
- No invention beyond \`LAW.md\` and \`PATH.md\`.
- No silent scope expansion.
- No hidden reasoning as state; persist key decisions to files.
- If a gate fails: stop, record FAIL in \`TRACE.md\`, and return blockers.
- \`TRACE.md\` is append-only.

## Required Execution Loop
1. **LAW Check**
   Validate current task against \`LAW.md\`.
2. **PATH Check**
   Ensure task is explicitly present and bounded in \`PATH.md\`.
3. **Gate 1 (Plan Admissibility)**
   Use \`GATE.md\` Gate 1 criteria. PASS required to proceed.
4. **Work**
   Execute one permitted step from \`PATH.md\`.
5. **REALITY Update**
   Write current artifact state and deltas in \`REALITY.md\`.
6. **TRACE Update**
   Log what actually changed in \`TRACE.md\` (files, outcomes, deviations).
7. **Gate 2 (Reality Admissibility)**
   Verify REALITY conforms to PATH and LAW.
## Output Contract For Every Run
- \`result\`: PASS or FAIL
- \`executed_step\`: exact PATH step id
- \`files_changed\`: explicit list
- \`gate_1\`: PASS/FAIL with reason
- \`gate_2\`: PASS/FAIL with reason
- \`next_allowed_step\`: exact id or STOP

Stop is valid.
`;
}

function lawTemplate(): string {
  return `# LAW

## How LAW Can Be Changed
Changes to LAW are allowed only when all conditions below are met:
1. A Gate failure or structural limitation is recorded in `TRACE.md`.
2. A minimal amendment proposal is written explicitly in `LAW.md`.
3. Explicit approval is recorded in `TRACE.md`.
4. Gate 1 and Gate 2 pass after the amendment.

## Purpose
Protect doctrinal integrity while enabling disciplined execution.

## Non-Negotiables
- Canon precedes execution.
- Admissibility precedes optimization.
- No action without a permitted PATH step.
- No step is complete without TRACE evidence.
- No merge or state acceptance without Gate 2 PASS.
- Stop is always valid when constraints are violated or unknowns block progress.

## Forbidden Actions
- Contradicting Canon or constraints.
- Introducing unapproved architectural patterns during execution.
- Treating chat memory as authoritative state.
- Rewriting prior TRACE history.

## Invariants
- LAW prevents entropy.
- PATH constrains the intended route.
- TRACE records the actual route.
- GATE enforces admissibility.
- REALITY is the artifact truth.

`;
}

function pathTemplate(vars: TemplateVars): string {
  return `# PATH

## Objective
Define the admissible implementation route under LAW.

## Active Scope
- Workspace: \`${vars.workspaceName}\`
- Goal: \`<set concrete goal>\`
- Out of scope: \`<set explicit exclusions>\`

## Step List (Deterministic Order)
- [ ] \`P1\` Define/confirm goal and constraints.
- [ ] \`P2\` Run Gate 1 on planned changes.
- [ ] \`P3\` Execute smallest admissible change set.
- [ ] \`P4\` Update REALITY and TRACE.
- [ ] \`P5\` Run Gate 2 on resulting state.

## Current Pointer
- \`active_step\`: \`P1\`

## Blocking Questions
- (none)

## Completion Criteria
- All checked steps have corresponding TRACE entries.
- Gate 1 and Gate 2 are both PASS for the final state.
`;
}

function gateTemplate(): string {
  return `# GATE

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
- Record FAIL in \`TRACE.md\`.
- Stop or produce a new PATH and re-run Gate 1.

## Gate 2: REALITY Admissibility (Before Accept/Merge)

### Question
Does REALITY conform to PATH and LAW, with TRACE evidence?

### PASS if
- Produced artifacts match permitted PATH steps.
- No forbidden LAW condition appears in REALITY.
- TRACE includes exact files changed and outcomes.
- Deviations are documented and resolved.

### FAIL if
- REALITY deviates from PATH without explicit approval.
- TRACE is incomplete or missing.
- LAW was implicitly changed.

### On FAIL
- Record FAIL in \`TRACE.md\`.
- Stop, then either revert pathologically unsafe change or redefine PATH and re-run gates.
`;
}

function realityTemplate(vars: TemplateVars): string {
  return `# REALITY

## Current State Snapshot
- Date: \`${vars.date}\`
- Workspace root: \`${vars.workspaceName}\`
- Active PATH step: \`P1\`
- Last gate status: \`UNKNOWN\`

## Existing Artifacts
- \`CLAUDE.md\`
- \`LAW.md\`
- \`PATH.md\`
- \`GATE.md\`
- \`REALITY.md\`
- \`TRACE.md\`

## Open Risks
- PATH values still contain placeholders and must be set before operational use.

## Notes
- This file represents current truth and must be updated after each admissible execution step.
`;
}

function traceTemplate(vars: TemplateVars): string {
  return `# TRACE

## Rules
- Do not rewrite previous entries.
- Append newest entry at the bottom.
- Each entry must include gate status and files changed.

## Entries

- ${vars.date} — INIT: Scaffolded 5-level-governance files into workspace. Files: CLAUDE.md, LAW.md, PATH.md, GATE.md, REALITY.md, TRACE.md; gate_1=PASS (structure aligns with LAW), gate_2=PASS (REALITY matches created files).
`;
}
