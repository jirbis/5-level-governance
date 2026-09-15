#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-all}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# shellcheck source=scripts/path_scope.sh
source "$ROOT/scripts/path_scope.sh"
# shellcheck source=scripts/decision_log.sh
source "$ROOT/scripts/decision_log.sh"
# shellcheck source=scripts/reality_gen.sh
source "$ROOT/scripts/reality_gen.sh"
# shellcheck source=scripts/shard_store.sh
source "$ROOT/scripts/shard_store.sh"

fail_count=0

pass() {
  printf "PASS: %s\n" "$1"
}

fail() {
  printf "FAIL: %s\n" "$1"
  fail_count=$((fail_count + 1))
}

require_dir() {
  local d="$1"
  if [[ -d "$ROOT/$d" ]]; then
    pass "directory exists: $d/"
  else
    fail "missing required directory: $d/"
  fi
}

require_file() {
  local f="$1"
  if [[ -f "$ROOT/$f" ]]; then
    pass "file exists: $f"
  else
    fail "missing required file: $f"
  fi
}

check_required_files() {
  require_file "CLAUDE.md"
  require_file "LAW.md"
  require_file "PATH.md"
  require_file "GATE.md"
  require_file "REALITY.md"
  require_dir "trace"
  require_dir "decisions"
  check_no_legacy_records
}

# A workspace carrying the old single-file records has not been migrated. The
# shard checks would simply not see those files, which would read as a pass.
check_no_legacy_records() {
  local legacy f found=0
  for legacy in "TRACE.md" "DECISIONS.md"; do
    f="$ROOT/$legacy"
    if [[ -f "$f" ]]; then
      fail "legacy record present: $legacy; run \`bash scripts/shard_migrate.sh --apply\` and remove it"
      found=1
    fi
  done
  if (( found == 0 )); then
    pass "no unmigrated legacy records"
  fi
}

run_gate1() {
  echo "== Gate 1: PATH Admissibility =="
  check_required_files

  if grep -Eq "<set [^>]+>" "$ROOT/PATH.md"; then
    fail "PATH.md still contains placeholder values (<set ...>)"
  else
    pass "PATH.md has no unresolved <set ...> placeholders"
  fi

  if grep -q "active_step" "$ROOT/PATH.md"; then
    pass "PATH.md declares active_step"
  else
    fail "PATH.md missing active_step"
  fi

  if grep -q "## Blocking Questions" "$ROOT/PATH.md"; then
    if grep -Eq '^- \(none\)$' "$ROOT/PATH.md"; then
      pass "PATH.md has no blocking questions"
    else
      fail "PATH.md has unresolved blocking questions"
    fi
  else
    fail "PATH.md missing Blocking Questions section"
  fi

  if grep -q "## Non-Negotiables" "$ROOT/LAW.md"; then
    pass "LAW.md contains Non-Negotiables"
  else
    fail "LAW.md missing Non-Negotiables section"
  fi
}

check_path_scope() {
  if ! command -v git >/dev/null 2>&1; then
    fail "PATH scope: git is unavailable, scope cannot be verified"
    return
  fi
  if ! git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    fail "PATH scope: not a git repository, scope cannot be verified"
    return
  fi
  if [[ ! -f "$ROOT/PATH.md" ]]; then
    fail "PATH scope: PATH.md is missing"
    return
  fi

  local active
  active="$(sed -n 's/^- `active_step`: `\([^`]*\)`.*/\1/p' "$ROOT/PATH.md" | head -n1)"
  if [[ -z "$active" ]]; then
    fail "PATH scope: PATH.md has no resolvable active_step"
    return
  fi

  local -a allow=() forbid=()
  local kind pat
  while IFS=$'\t' read -r kind pat; do
    if [[ -z "${pat:-}" ]]; then
      continue
    fi
    case "$kind" in
      allow)  allow+=("$pat") ;;
      forbid) forbid+=("$pat") ;;
    esac
  done < <(scope_rules "$ROOT/PATH.md" "$active")

  if (( ${#allow[@]} == 0 )); then
    fail "PATH scope: no allowed_paths declared for active step '$active' or any completed step; scope is undeclared, so no change is admissible"
    return
  fi
  allow+=("${SCOPE_IMPLICIT_ALLOW[@]}")

  local base
  base="$(scope_diff_base "$ROOT")"

  local -a changed=()
  local f
  while IFS= read -r f; do
    if [[ -n "$f" ]]; then
      changed+=("$f")
    fi
  done < <(scope_changed_files "$ROOT" "$base")

  if (( ${#changed[@]} == 0 )); then
    pass "PATH scope: no changes against ${base:0:12}, nothing to place in scope"
    return
  fi

  local -a violations=() breaches=()
  local g ok
  for f in "${changed[@]}"; do
    ok=0
    for g in "${forbid[@]:-}"; do
      [[ -z "$g" ]] && continue
      if scope_path_matches "$f" "$g"; then
        breaches+=("$f (matches forbidden_paths: $g)")
        ok=2
        break
      fi
    done
    [[ $ok -eq 2 ]] && continue
    for g in "${allow[@]}"; do
      if scope_path_matches "$f" "$g"; then
        ok=1
        break
      fi
    done
    (( ok == 1 )) || violations+=("$f")
  done

  for f in "${breaches[@]:-}"; do
    if [[ -n "$f" ]]; then
      fail "PATH scope: forbidden file changed: $f"
    fi
  done
  for f in "${violations[@]:-}"; do
    if [[ -n "$f" ]]; then
      fail "PATH scope: out-of-scope file changed: $f (not matched by any allowed_paths of step '$active' or completed steps)"
    fi
  done

  if (( ${#violations[@]} == 0 && ${#breaches[@]} == 0 )); then
    pass "PATH scope: all ${#changed[@]} changed file(s) are inside declared allowed_paths (base ${base:0:12})"
  fi
}

# trace/ and decisions/ are append-only records: one of work, one of rule
# changes. Sharded into a file per entry, "append-only" is per-file immutability:
# a shard that existed at the base must be byte-identical now. Additions are the
# only admissible change, which is also why two agents never collide.
check_shard_immutability() {
  local dir="$1" label="$2"

  if ! command -v git >/dev/null 2>&1; then
    fail "$label append-only: git is unavailable, history cannot be verified"
    return
  fi
  if ! git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    fail "$label append-only: not a git repository, history cannot be verified"
    return
  fi

  local base violations
  base="$(scope_diff_base "$ROOT")"

  if violations="$(shard_immutability "$ROOT" "$base" "$dir")"; then
    pass "$dir/ is append-only against ${base:0:12}"
    return
  fi

  local line
  while IFS= read -r line; do
    if [[ -n "$line" ]]; then
      fail "$label append-only: $line"
    fi
  done <<< "$violations"
}

# Every entry must carry its gate evidence. The single-file record could only be
# asked whether some line somewhere had it; a shard per entry can be asked of
# each one.
check_trace_evidence() {
  local shard missing=0 count=0
  while IFS= read -r shard; do
    [[ -z "$shard" ]] && continue
    count=$(( count + 1 ))
    # `Gate1`/`Gate2` is the older CODIFY output spelling. Entries written that
    # way do state both outcomes, and rewriting them to match today's spelling
    # would be falsifying the record this rule exists to protect.
    if ! grep -Eq 'gate_1|Gate1' "$ROOT/$shard" || ! grep -Eq 'gate_2|Gate2' "$ROOT/$shard"; then
      fail "TRACE evidence: $shard does not state gate_1 and gate_2"
      missing=1
    fi
  done < <(shard_list "$ROOT" "trace")

  if (( count == 0 )); then
    fail "TRACE evidence: trace/ contains no entries"
    return
  fi
  if (( missing == 0 )); then
    pass "all $count trace entr(ies) state gate_1 and gate_2"
  fi
}

check_law_amendment_recorded() {
  if ! git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    fail "DECISIONS: not a git repository, policy changes cannot be verified"
    return
  fi

  local base reason
  base="$(scope_diff_base "$ROOT")"

  if reason="$(decisions_check_law_amendment "$ROOT" "$base")"; then
    pass "DECISIONS: $reason against ${base:0:12}"
    return
  fi
  fail "DECISIONS: $reason"
}

run_gate2() {
  echo "== Gate 2: REALITY Admissibility =="
  check_required_files
  check_path_scope
  check_shard_immutability "trace" "TRACE"
  check_shard_immutability "decisions" "DECISIONS"
  check_law_amendment_recorded

  # REALITY is generated, so "is it current?" is answerable: regenerate the
  # artifact list and compare. This replaces two weaker checks - that the file
  # did not contain the word UNKNOWN, and that everything it listed existed.
  # Neither could see a file that existed but was never recorded, which is the
  # drift this repository actually suffered, twice.
  local staleness
  if staleness="$(reality_is_current "$ROOT")"; then
    pass "REALITY.md matches the tree"
  else
    fail "REALITY: $staleness"
  fi

  check_trace_evidence

}

case "$MODE" in
  gate1)
    run_gate1
    ;;
  gate2)
    run_gate2
    ;;
  all)
    run_gate1
    run_gate2
    ;;
  *)
    echo "Usage: $0 [gate1|gate2|all]" >&2
    exit 2
    ;;
esac

if [[ $fail_count -gt 0 ]]; then
  echo "Gate enforcement result: FAIL ($fail_count issue(s))"
  exit 1
fi

echo "Gate enforcement result: PASS"
