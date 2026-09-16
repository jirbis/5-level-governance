#!/usr/bin/env bash
# PATH scope enforcement: bind declared PATH step scopes to the real git diff.
#
# Exposes:
#   scope_glob_to_regex <glob>          -> ERE anchored at workspace root
#   scope_path_matches <path> <glob>    -> 0 if the path is inside the glob
#   scope_rules <path.md> <active_step> -> emits "allow<TAB>pat" / "forbid<TAB>pat"
#   scope_diff_base <root>              -> commit-ish to diff against
#   scope_changed_files <root> <base>   -> sorted unique changed paths
#
# Glob semantics (anchored, whole-path match):
#   **   any number of path segments
#   *    any characters within one segment (never crosses /)
#   ?    one character within one segment
#   dir/ shorthand for dir/**

# Always writable: the execution loop mandates writing these every run.
# PATH.md is deliberately NOT here — changing the route must be declared in scope.
SCOPE_IMPLICIT_ALLOW=("REALITY.md" "trace/**")

scope_glob_to_regex() {
  local pat="$1" out="" ch i len
  [[ "$pat" == */ ]] && pat="${pat}**"
  len=${#pat}
  i=0
  while (( i < len )); do
    ch="${pat:i:1}"
    if [[ "$ch" == "*" && "${pat:i+1:1}" == "*" ]]; then
      if [[ "${pat:i+2:1}" == "/" ]]; then
        out+="(.*/)?"        # **/ -> zero or more leading segments
        i=$(( i + 3 ))
      else
        out+=".*"            # ** -> anything, crosses /
        i=$(( i + 2 ))
      fi
      continue
    fi
    case "$ch" in
      '*') out+="[^/]*" ;;
      '?') out+="[^/]" ;;
      .|+|'('|')'|'['|']'|'{'|'}'|'^'|'$'|'|'|'\') out+="\\$ch" ;;
      *)   out+="$ch" ;;
    esac
    i=$(( i + 1 ))
  done
  printf '^%s$' "$out"
}

scope_path_matches() {
  local path="$1" glob="$2" re
  re="$(scope_glob_to_regex "$glob")"
  [[ "$path" =~ $re ]]
}

# Emit the scope rules in force: every completed step plus the active step.
# A branch diff is the cumulative result of the steps already executed, so the
# admissible surface is their union - not the active step alone.
scope_rules() {
  local path_md="$1" active="$2"
  awk -v active="$active" '
    function emit(kind, line,   value, n, parts, k, p) {
      sub(/^[[:space:]]*[a-z_]+:[[:space:]]*/, "", line)
      n = split(line, parts, ",")
      for (k = 1; k <= n; k++) {
        p = parts[k]
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", p)
        gsub(/^`|`$/, "", p)
        if (p != "") printf "%s\t%s\n", kind, p
      }
    }
    /^```/            { fence = !fence; next }   # never parse fenced examples
    fence             { next }
    /^## Step List/   { inlist = 1; next }
    /^## /            { inlist = 0; next }
    !inlist           { next }
    /^- \[[ xX]\][[:space:]]*`[^`]+`/ {
      done = (substr($0, 4, 1) == "x" || substr($0, 4, 1) == "X")
      match($0, /`[^`]+`/)
      id = substr($0, RSTART + 1, RLENGTH - 2)
      insel = (done || id == active)
      next
    }
    /^[[:space:]]+allowed_paths:/   { if (insel) emit("allow", $0);  next }
    /^[[:space:]]+forbidden_paths:/ { if (insel) emit("forbid", $0); next }
  ' "$path_md"
}

# Is <base> a commit git can actually resolve? An unresolvable base makes every
# `git diff` fail, and a failed diff looks exactly like an empty one: no changed
# files, nothing out of scope, nothing to check. The whole gate then passes
# vacuously, which is worse than failing.
scope_base_resolves() {
  local root="$1" base="$2"
  [[ -n "$base" ]] || return 1
  git -C "$root" rev-parse --verify --quiet "${base}^{commit}" >/dev/null 2>&1
}

scope_diff_base() {
  local root="$1" ref mb
  if [[ -n "${GOVERNANCE_DIFF_BASE:-}" ]]; then
    if ! scope_base_resolves "$root" "$GOVERNANCE_DIFF_BASE"; then
      printf 'GOVERNANCE_DIFF_BASE=%s is not a commit this repository can resolve' \
        "$GOVERNANCE_DIFF_BASE" >&2
      return 1
    fi
    printf '%s' "$GOVERNANCE_DIFF_BASE"
    return 0
  fi
  for ref in origin/HEAD origin/main origin/master main master; do
    git -C "$root" rev-parse --verify --quiet "$ref" >/dev/null 2>&1 || continue
    if mb="$(git -C "$root" merge-base HEAD "$ref" 2>/dev/null)" && [[ -n "$mb" ]]; then
      printf '%s' "$mb"
      return 0
    fi
  done
  printf 'HEAD'
}

# Non-zero if the diff could not be taken. Callers must not treat that as "no
# changes": a swallowed git error and a clean tree are indistinguishable.
scope_changed_files() {
  local root="$1" base="$2"
  if ! scope_base_resolves "$root" "$base"; then
    return 1
  fi
  {
    git -C "$root" diff --name-only "$base" -- || return 1
    git -C "$root" diff --name-only --cached "$base" -- || return 1
    git -C "$root" ls-files --others --exclude-standard || return 1
  } | sed '/^$/d' | sort -u
}
