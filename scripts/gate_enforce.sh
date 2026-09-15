#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-all}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# shellcheck source=scripts/path_scope.sh
source "$ROOT/scripts/path_scope.sh"
# shellcheck source=scripts/trace_append_only.sh
source "$ROOT/scripts/trace_append_only.sh"

fail_count=0

pass() {
  printf "PASS: %s\n" "$1"
}

fail() {
  printf "FAIL: %s\n" "$1"
  fail_count=$((fail_count + 1))
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
  require_file "TRACE.md"
  require_file "CODIFY.md"
}

run_gate1() {
  echo "== Gate 1: PATH Admissibility =="
  check_required_files

  if rg -n "<set [^>]+>" "$ROOT/PATH.md" >/dev/null; then
    fail "PATH.md still contains placeholder values (<set ...>)"
  else
    pass "PATH.md has no unresolved <set ...> placeholders"
  fi

  if rg -n "active_step" "$ROOT/PATH.md" >/dev/null; then
    pass "PATH.md declares active_step"
  else
    fail "PATH.md missing active_step"
  fi

  if rg -n "## Blocking Questions" "$ROOT/PATH.md" >/dev/null; then
    if rg -n "^- \(none\)$" "$ROOT/PATH.md" >/dev/null; then
      pass "PATH.md has no blocking questions"
    else
      fail "PATH.md has unresolved blocking questions"
    fi
  else
    fail "PATH.md missing Blocking Questions section"
  fi

  if rg -n "## Non-Negotiables" "$ROOT/LAW.md" >/dev/null; then
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

check_trace_append_only() {
  if ! command -v git >/dev/null 2>&1; then
    fail "TRACE append-only: git is unavailable, history cannot be verified"
    return
  fi
  if ! git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    fail "TRACE append-only: not a git repository, history cannot be verified"
    return
  fi

  local base violations
  base="$(scope_diff_base "$ROOT")"

  if violations="$(trace_verify_append_only "$ROOT" "$base")"; then
    pass "TRACE.md is append-only against ${base:0:12}"
    return
  fi

  local line
  while IFS= read -r line; do
    if [[ -n "$line" ]]; then
      fail "TRACE append-only: $line"
    fi
  done <<< "$violations"
}

run_gate2() {
  echo "== Gate 2: REALITY Admissibility =="
  check_required_files
  check_path_scope
  check_trace_append_only

  if rg -n 'Last gate status: `UNKNOWN`' "$ROOT/REALITY.md" >/dev/null; then
    fail "REALITY.md still has unknown gate status"
  else
    pass "REALITY.md has a resolved gate status"
  fi

  if rg -n "^- [0-9]{4}-[0-9]{2}-[0-9]{2} .*gate_1=.*gate_2=" "$ROOT/TRACE.md" >/dev/null; then
    pass "TRACE.md has dated gate evidence with gate_1 and gate_2"
  else
    fail "TRACE.md missing dated gate evidence with gate_1 and gate_2"
  fi

  local missing=0
  while IFS= read -r artifact; do
    if [[ -n "$artifact" && ! -f "$ROOT/$artifact" ]]; then
      fail "REALITY artifact missing on disk: $artifact"
      missing=1
    fi
  done < <(sed -n 's/^- `\([^`]*\)`$/\1/p' "$ROOT/REALITY.md")
  if [[ $missing -eq 0 ]]; then
    pass "all REALITY.md listed artifacts exist on disk"
  fi
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
