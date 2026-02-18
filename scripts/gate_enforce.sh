#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-all}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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

run_gate2() {
  echo "== Gate 2: REALITY Admissibility =="
  check_required_files

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
