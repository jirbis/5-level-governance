#!/usr/bin/env bash
# TRACE append-only enforcement.
#
# `LAW.md` forbids rewriting prior TRACE history. This turns that rule into a
# check: the recorded route may only grow. Every version of TRACE.md must have
# the previous version as an exact byte prefix.
#
# The whole chain is walked, not just base..worktree, because a branch that
# rewrites TRACE in one commit and restores it in another has still destroyed
# the audit trail - and a prefix check against the endpoints alone would miss it.
#
# Exposes:
#   trace_verify_append_only <root> <base> [relpath] -> violation lines on stdout

# Write the content of <rel> at <rev> into <out>. A path that does not exist at
# that revision is treated as empty content, so deletion surfaces as truncation
# through the same prefix check rather than needing a separate code path.
_trace_show() {
  local root="$1" rev="$2" rel="$3" out="$4"
  if git -C "$root" cat-file -e "$rev:$rel" 2>/dev/null; then
    git -C "$root" show "$rev:$rel" >"$out" 2>/dev/null
  else
    : >"$out"
  fi
}

_trace_size() {
  local n
  n="$(wc -c <"$1")"
  printf '%s' "${n//[[:space:]]/}"
}

# 0 if <old> is a byte prefix of <new>; otherwise describe the divergence.
_trace_is_prefix() {
  local old="$1" new="$2" old_size new_size raw
  old_size="$(_trace_size "$old")"
  new_size="$(_trace_size "$new")"

  if (( old_size == 0 )); then
    return 0
  fi

  # Look for an in-place rewrite before reporting size. An edited entry usually
  # also changes the length, and calling that "truncated" would read as if
  # entries had been dropped.
  local common=$(( old_size < new_size ? old_size : new_size ))
  if ! head -c "$common" "$new" | cmp -s - <(head -c "$common" "$old"); then
    raw="$(head -c "$common" "$new" | cmp - <(head -c "$common" "$old") 2>&1 | head -n1)"
    raw="${raw##*differ: }"
    # some cmp builds say "char", others "byte"; the extension says "byte" and
    # the two gates must not word the same finding differently
    printf 'diverges at %s' "${raw/#char /byte }"
    return 1
  fi
  if (( new_size < old_size )); then
    printf 'truncated from %s to %s bytes' "$old_size" "$new_size"
    return 1
  fi
  return 0
}

trace_verify_append_only() {
  local root="$1" base="$2" rel="${3:-TRACE.md}"
  local tmp prev cur rc=0 rev short msg

  tmp="$(mktemp -d)"
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp'" RETURN
  prev="$tmp/prev"
  cur="$tmp/cur"

  _trace_show "$root" "$base" "$rel" "$prev"

  while IFS= read -r rev; do
    if [[ -z "$rev" ]]; then
      continue
    fi
    _trace_show "$root" "$rev" "$rel" "$cur"
    if ! msg="$(_trace_is_prefix "$prev" "$cur")"; then
      short="$(git -C "$root" rev-parse --short "$rev" 2>/dev/null || printf '%s' "$rev")"
      printf 'commit %s rewrites %s history (%s)\n' "$short" "$rel" "$msg"
      rc=1
    fi
    cp "$cur" "$prev"
  done < <(git -C "$root" rev-list --reverse "$base..HEAD" 2>/dev/null || true)

  # Finally the working tree, which is where an agent edits before committing.
  if [[ -f "$root/$rel" ]]; then
    cp "$root/$rel" "$cur"
  else
    : >"$cur"
  fi
  if ! msg="$(_trace_is_prefix "$prev" "$cur")"; then
    printf 'working tree rewrites %s history (%s)\n' "$rel" "$msg"
    rc=1
  fi

  return "$rc"
}
