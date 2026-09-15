export interface TemplateVars {
  workspaceName: string;
  date: string;
  projectGoal?: string;
  outOfScope?: string;
  projectDescription?: string;
  // auto-discovered fields
  languages?: string[];
  testFrameworks?: string[];
  ciPlatforms?: string[];
  license?: string;
  repositoryUrl?: string;
  sourceDir?: string;
  testDir?: string;
  existingFiles?: string[];
  dockerized?: boolean;
}

export const GOVERNANCE_FILES = [
  "CLAUDE.md",
  "LAW.md",
  "PATH.md",
  "GATE.md",
  "REALITY.md",
  "TRACE.md",
  "DECISIONS.md",
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
    case "DECISIONS.md":
      return decisionsTemplate();
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
6. \`DECISIONS.md\`

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
8. **Decide**
   Apply the \`DECISIONS.md\` matrix to decide whether learning updates PATH, LAW, or agent instruction. Any change to \`LAW.md\` requires a new approved \`DECISIONS.md\` entry; Gate 2 rejects an amendment without one.

## Output Contract For Every Run
- \`result\`: PASS or FAIL
- \`executed_step\`: exact PATH step id
- \`files_changed\`: explicit list
- \`gate_1\`: PASS/FAIL with reason
- \`gate_2\`: PASS/FAIL with reason
- \`decision\`: NONE, or the \`DECISIONS.md\` entry id recorded this run
- \`next_allowed_step\`: exact id or STOP

Stop is valid.
`;
}

function lawTemplate(): string {
  return `# LAW

## Purpose
Protect doctrinal integrity while enabling disciplined execution.

## Non-Negotiables
- Canon precedes execution.
- Admissibility precedes optimization.
- No action without a permitted PATH step.
- No step is complete without TRACE evidence.
- No merge or state acceptance without Gate 2 PASS.
- No change is admissible outside a scope declared in \`PATH.md\`.
- No rule changes without an approved entry in \`DECISIONS.md\`.
- Stop is always valid when constraints are violated or unknowns block progress.

## Forbidden Actions
- Contradicting Canon or constraints.
- Introducing uncodified architectural patterns during execution.
- Treating chat memory as authoritative state.
- Rewriting prior TRACE history.
- Rewriting prior DECISIONS history.
- Changing files outside the scope declared for the active step.
- Amending this file without a recorded, approved \`DECISIONS.md\` entry.

## Invariants
- LAW prevents entropy.
- PATH constrains the intended route.
- TRACE records the actual route.
- GATE enforces admissibility.
- REALITY is the artifact truth.

## Amendment Rule
Changes to LAW require:
1. A recorded gate failure that motivates the change.
2. A proposed amendment in minimal form.
3. Explicit approval recorded in \`DECISIONS.md\`, which Gate 2 verifies.
`;
}

function pathTemplate(vars: TemplateVars): string {
  return `# PATH

## Objective
Define the admissible implementation route under LAW.

## Active Scope
- Workspace: \`${vars.workspaceName}\`
- Goal: \`${vars.projectGoal ?? '<set concrete goal>'}\`
- Out of scope: \`${vars.outOfScope ?? '<set explicit exclusions>'}\`
${vars.languages?.length ? `- Tech stack: ${vars.languages.join(", ")}${vars.testFrameworks?.length ? ` (tests: ${vars.testFrameworks.join(", ")})` : ""}` : ""}

## Step Schema
Each step declares the file scope it is permitted to touch. Gate 2 checks the
real git diff against these patterns, so an undeclared scope admits no change.

\`\`\`
- [ ] \`P3\` Do the thing.
      allowed_paths: src/**, Makefile
      forbidden_paths: LAW.md
\`\`\`

- Patterns are anchored at the workspace root and must match the whole path.
- \`**\` matches any number of path segments; \`*\` and \`?\` never cross \`/\`.
- A pattern ending in \`/\` means that directory and everything under it.
- \`forbidden_paths\` wins over \`allowed_paths\`.
- \`REALITY.md\` and \`TRACE.md\` are always writable: the loop mandates them.
- \`PATH.md\` is NOT implicitly writable. Widening the route must be declared.

## Step List (Deterministic Order)
- [ ] \`P1\` Define/confirm goal, constraints and per-step file scopes.
      allowed_paths: PATH.md
- [ ] \`P2\` Run Gate 1 on planned changes.
      allowed_paths: PATH.md
- [ ] \`P3\` Execute smallest admissible change set.
      allowed_paths: <set the files this step may touch>
- [ ] \`P4\` Update REALITY and TRACE.
      allowed_paths: PATH.md
- [ ] \`P5\` Run Gate 2 on resulting state.
      allowed_paths: PATH.md
- [ ] \`P6\` Apply the DECISIONS matrix and record any rule change.
      allowed_paths: PATH.md, DECISIONS.md

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
- Every changed file is inside the \`allowed_paths\` of the active step or of a
  completed step, verified against the real git diff.
- No changed file matches a \`forbidden_paths\` pattern.
- No forbidden LAW condition appears in REALITY.
- TRACE includes exact files changed and outcomes.
- Deviations are documented and resolved.

### FAIL if
- REALITY deviates from PATH without explicit approval.
- A changed file falls outside every declared \`allowed_paths\` pattern.
- The active step declares no scope at all, or the workspace is not a git
  repository: scope that cannot be verified is not scope.
- TRACE is incomplete or missing.
- LAW was implicitly changed.

### On FAIL
- Record FAIL in \`TRACE.md\`.
- Stop, then either revert pathologically unsafe change or redefine PATH and re-run gates.
`;
}

function realityTemplate(vars: TemplateVars): string {
  const artifactLines = [
    "- `CLAUDE.md`",
    "- `LAW.md`",
    "- `PATH.md`",
    "- `GATE.md`",
    "- `REALITY.md`",
    "- `TRACE.md`",
    "- `DECISIONS.md`",
  ];
  if (vars.existingFiles?.length) {
    const canon = ["CLAUDE.md","LAW.md","PATH.md","GATE.md","REALITY.md","TRACE.md","DECISIONS.md"];
    for (const f of vars.existingFiles) {
      if (!canon.includes(f)) {
        artifactLines.push(`- \`${f}\``);
      }
    }
  }

  const envLines: string[] = [];
  if (vars.languages?.length) {
    envLines.push(`- Languages: ${vars.languages.join(", ")}`);
  }
  if (vars.testFrameworks?.length) {
    envLines.push(`- Test frameworks: ${vars.testFrameworks.join(", ")}`);
  }
  if (vars.ciPlatforms?.length) {
    envLines.push(`- CI/CD: ${vars.ciPlatforms.join(", ")}`);
  }
  if (vars.license) {
    envLines.push(`- License: ${vars.license}`);
  }
  if (vars.repositoryUrl) {
    envLines.push(`- Repository: \`${vars.repositoryUrl}\``);
  }

  // The regions between the markers are rewritten by `make reality`; everything
  // else in this file is written by hand and preserved across regeneration.
  return `# REALITY

<!-- generated:snapshot -->
## Current State Snapshot
- Generated: \`${vars.date}\`
- Workspace root: \`${vars.workspaceName}\`
- Active PATH step: \`P1\`
- HEAD at generation: \`unknown\`
- Working tree at generation: \`unknown\`
<!-- /generated:snapshot -->

<!-- generated:artifacts -->
## Existing Artifacts
${artifactLines.join("\n")}
<!-- /generated:artifacts -->
${envLines.length ? `\n## Environment\n${envLines.join("\n")}\n` : ""}
## Open Risks
- PATH values still contain placeholders and must be set before operational use.

## Notes
- The generated regions above are rewritten by \`make reality\`. Everything else
  in this file is written by hand and survives regeneration.
`;
}

function traceTemplate(vars: TemplateVars): string {
  return `# TRACE

## Rules
- Do not rewrite previous entries.
- Append newest entry at the bottom.
- Each entry must include gate status and files changed.

## Entries

- ${vars.date} — INIT: Scaffolded 5-level-governance files into workspace${vars.projectGoal ? ` for goal: ${vars.projectGoal}` : ''}. Files: CLAUDE.md, LAW.md, PATH.md, GATE.md, REALITY.md, TRACE.md, DECISIONS.md; gate_1=PASS (structure aligns with LAW), gate_2=PASS (REALITY matches created files).
`;
}

function decisionsTemplate(): string {
  return `# DECISIONS (Append-Only)

The record of changes to the rules. \`TRACE.md\` records what the work did;
this file records what changed the rules that govern the work.

## Rules
- Append the newest entry at the bottom. Never rewrite an earlier entry.
- Every change to \`LAW.md\` requires a new entry here with a recorded approval.
  Gate 2 enforces this: an unexplained amendment is inadmissible.
- Do not amend \`LAW.md\` for convenience. Amend it when a recorded gate failure
  or structural limitation demands it.
- Do not codify a speculative pattern. Wait for repeated evidence.

## Entry Format
\`\`\`
### D<n> — <date> — <one-line title>
- \`type\`: LOCAL | ARCHITECTURAL | OPERATIONAL
- \`target_file\`: the file whose rules changed
- \`change\`: what changed, in one sentence
- \`evidence\`: the TRACE entries or gate failures that motivated it
- \`approved_by\`: who approved it
- \`approved_at\`: when
\`\`\`

An \`approved_by\` that is empty, a placeholder or \`TBD\` is not an approval.

## Decision Matrix
- \`LOCAL\` — learning is specific to the current task flow. Target \`PATH.md\`.
- \`ARCHITECTURAL\` — learning changes doctrine. Target \`LAW.md\`.
- \`OPERATIONAL\` — learning changes agent behaviour. Target \`CLAUDE.md\`.

## Standing Rules

### A prohibition without a check is decoration
Every \`Forbidden\` item in \`LAW.md\` must have a corresponding mechanical check
in \`GATE.md\`, or be recorded in \`REALITY.md\` as an unenforced rule.

### A check must read state the agent did not author
Prefer git history, exit codes and the file tree over prose in the canon files.

## Entries
`;
}

