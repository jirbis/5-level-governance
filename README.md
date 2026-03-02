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

## 6-Step Combined Loop
1. Validate against `LAW.md`.
2. Define or update `PATH.md`.
3. Run Gate 1 (PATH admissibility).
4. Execute work and update `REALITY.md`.
5. Append actual changes to `TRACE.md`.
6. Run Gate 2 (REALITY admissibility).

## Usage
1. Open this folder as the working context.
2. Load `CLAUDE.md` as your runtime instruction.
3. Keep all state transitions in files, not chat.

Rule: if it is not written in `LAW.md`, `PATH.md`, `GATE.md`, `REALITY.md`, or `TRACE.md`, it does not exist.

## Gate Enforcement Command
- Run all checks: `make gate`
- Run Gate 1 only: `make gate1`
- Run Gate 2 only: `make gate2`
- Direct script usage: `bash ./scripts/gate_enforce.sh [gate1|gate2|all]`
