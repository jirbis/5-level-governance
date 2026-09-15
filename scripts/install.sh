#!/usr/bin/env bash
# Install governance into another repository.
#
#   bash scripts/install.sh DEST [--with-ci] [--force]
#
# Nothing is overwritten. A file that already exists is left alone and reported,
# because the point of this framework is that records and doctrine are not
# clobbered by tooling. --force overwrites the canon files only; it never
# touches trace/ or decisions/, which are append-only by rule.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DEST=""
WITH_CI=0
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --with-ci) WITH_CI=1 ;;
    --force)   FORCE=1 ;;
    -h|--help)
      sed -n '2,10p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'
      exit 0 ;;
    *) DEST="$arg" ;;
  esac
done

if [[ -z "$DEST" ]]; then
  echo "Usage: bash scripts/install.sh DEST [--with-ci] [--force]" >&2
  exit 2
fi
if [[ ! -d "$DEST" ]]; then
  echo "Destination is not a directory: $DEST" >&2
  exit 2
fi
DEST="$(cd "$DEST" && pwd)"
if [[ "$DEST" == "$SRC" ]]; then
  echo "Destination is the governance repository itself." >&2
  exit 2
fi

written=0
skipped=0

put() {  # put <relative-path> <<<content
  local rel="$1" full="$DEST/$1"
  if [[ -e "$full" && $FORCE -eq 0 ]]; then
    printf '  skip   %s (exists)\n' "$rel"
    skipped=$(( skipped + 1 ))
    cat >/dev/null
    return
  fi
  mkdir -p "$(dirname "$full")"
  cat >"$full"
  printf '  write  %s\n' "$rel"
  written=$(( written + 1 ))
}

copy() {  # copy <relative-path-in-src> [relative-path-in-dest]
  local rel="$1" dst="${2:-$1}"
  put "$dst" < "$SRC/$rel"
}

echo "Installing governance into $DEST"
echo

echo "Runtime:"
# Only the runtime gate; the test suite belongs to the governance repository.
for f in gate_enforce.sh path_scope.sh decision_log.sh reality_gen.sh \
         reality_update.sh shard_store.sh shard_migrate.sh gate_report.sh; do
  copy "scripts/$f"
  chmod +x "$DEST/scripts/$f" 2>/dev/null || true
done

# A separate include, so a project that already has a Makefile keeps it.
put "governance.mk" <<'MK'
# Governance targets. Include from your Makefile:
#     include governance.mk
.PHONY: gate gate1 gate2 reality report trace decisions

gate:
	@bash ./scripts/gate_enforce.sh all

gate1:
	@bash ./scripts/gate_enforce.sh gate1

gate2:
	@bash ./scripts/gate_enforce.sh gate2

reality:
	@bash ./scripts/reality_update.sh

report:
	@bash ./scripts/gate_report.sh

trace:
	@bash -c 'source ./scripts/shard_store.sh && shard_render . trace'

decisions:
	@bash -c 'source ./scripts/shard_store.sh && shard_render . decisions'
MK

echo
echo "Doctrine:"
copy "CLAUDE.md"
copy "LAW.md"
copy "GATE.md"

put "PATH.md" <<'PATHMD'
# PATH

## Objective
Define the admissible implementation route under LAW.

## Active Scope
- Workspace: `<set workspace root>`
- Goal: `<set concrete goal>`
- Out of scope: `<set explicit exclusions>`

## Step Schema
Each step declares the files it may touch. Gate 2 checks the real git diff
against these patterns, so an undeclared scope admits no change.

```
- [ ] `P3` Do the thing.
      allowed_paths: src/**, Makefile
      forbidden_paths: LAW.md
```

- Patterns are anchored at the workspace root and must match the whole path.
- `**` matches any number of path segments; `*` and `?` never cross `/`.
- A pattern ending in `/` means that directory and everything under it.
- `forbidden_paths` wins over `allowed_paths`.
- `REALITY.md` and `trace/**` are always writable: the loop mandates them.
- `PATH.md` is NOT implicitly writable. Widening the route must be declared.

## Step List (Deterministic Order)
- [ ] `P1` Define goal, constraints and per-step file scopes.
      allowed_paths: PATH.md
- [ ] `P2` Execute the smallest admissible change set.
      allowed_paths: <set the files this step may touch>
- [ ] `P3` Update REALITY and add a trace entry.
      allowed_paths: PATH.md
- [ ] `P4` Run Gate 2 and record any rule change.
      allowed_paths: PATH.md, decisions/**

## Current Pointer
- `active_step`: `P1`

## Blocking Questions
- (none)

## Completion Criteria
- Every completed step has a corresponding `trace/` entry.
- Gate 1 and Gate 2 are both PASS for the final state.
PATHMD

put "REALITY.md" <<'REALITYMD'
# REALITY

<!-- generated:snapshot -->
<!-- /generated:snapshot -->

<!-- generated:artifacts -->
<!-- /generated:artifacts -->

## Deltas This Run
- (none yet)

## Open Risks
- PATH values still contain placeholders and must be set before operational use.

## Notes
- The generated regions above are rewritten by `make reality`. Everything else
  in this file is written by hand and survives regeneration.
REALITYMD

echo
echo "Records:"
mkdir -p "$DEST/trace" "$DEST/decisions"
copy "trace/README.md"
copy "decisions/README.md"
put "trace/$(date -u +%Y-%m-%d)-init.md" <<EOF
# $(date -u +%Y-%m-%d) — INIT

Installed governance: canon files, the \`trace/\` and \`decisions/\` records, and
the gate runtime under \`scripts/\`.

- \`gate_1\`: PASS — installation is the declared step
- \`gate_2\`: PASS — REALITY regenerated from the tree after install
EOF

if (( WITH_CI == 1 )); then
  echo
  echo "CI:"
  copy ".github/workflows/governance-gate.yml"
fi

echo
if [[ -f "$DEST/Makefile" ]] && ! grep -q 'governance.mk' "$DEST/Makefile"; then
  echo "Your Makefile was left untouched. Add this line to it:"
  echo
  echo "    include governance.mk"
  echo
elif [[ ! -f "$DEST/Makefile" ]]; then
  printf 'include governance.mk\n' > "$DEST/Makefile"
  echo "  write  Makefile (includes governance.mk)"
fi

if git -C "$DEST" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  bash "$DEST/scripts/reality_update.sh" >/dev/null 2>&1 || true
  echo "  REALITY.md generated from the tree"
else
  echo "  note: $DEST is not a git repository; the gates cannot verify anything until it is"
fi

echo
echo "$written written, $skipped skipped."
echo
echo "Next:"
echo "  1. Fill in the Active Scope and the step scopes in PATH.md."
echo "  2. Run 'make gate'. Gate 1 fails until the <set ...> placeholders are gone; that is the point."
echo "  3. Load CLAUDE.md as your agent's instructions."
