#!/usr/bin/env bash
# DECISIONS.md enforcement: policy may not change without a recorded approval.
#
# `LAW.md` is the policy. This ties any amendment of it to a new, approved entry
# in the append-only decision log, so a rule can never change silently.
#
# Honest limit: the gate verifies that an approval is RECORDED, not that it was
# GIVEN. Nothing in a file can prove authorship. Binding `approved_by` to a real
# identity needs signed commits or a reviewed pull request, which is a property
# of the repository, not of this script. Stated here so the check is not
# mistaken for more than it is.
#
# Exposes:
#   decisions_appended_section <root> <base> [rel] -> the newly appended bytes
#   decisions_check_law_amendment <root> <base>    -> reason on stdout, rc 0 if admissible
#
# The reason strings are shared verbatim with the extension's implementation in
# vscode-extension/src/gates.ts. Two gates that word the same finding
# differently are already drifting apart.

# The portion of the log added since <base>. Append-only is verified separately,
# so everything past the old length is by definition the new material.
decisions_appended_section() {
  local root="$1" base="$2" rel="${3:-DECISIONS.md}" old_size=0 tmp

  tmp="$(mktemp)"
  if git -C "$root" cat-file -e "$base:$rel" 2>/dev/null; then
    git -C "$root" show "$base:$rel" >"$tmp" 2>/dev/null
    old_size="$(wc -c <"$tmp")"
    old_size="${old_size//[[:space:]]/}"
  fi
  rm -f "$tmp"

  if [[ -f "$root/$rel" ]]; then
    tail -c "+$(( old_size + 1 ))" "$root/$rel"
  fi
}

# Does the appended section contain an entry that amends <target> and carries a
# usable approval?
_decisions_has_approved_entry() {
  local target="$1"
  awk -v target="$target" '
    function flush() { if (inentry && tgt && appr) found = 1 }
    /^### / { flush(); inentry = 1; tgt = 0; appr = 0; next }
    !inentry { next }
    /^- `target_file`:/ { if (index($0, target) > 0) tgt = 1; next }
    /^- `approved_by`:/ {
      v = $0
      sub(/^- `approved_by`:[[:space:]]*/, "", v)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", v)
      gsub(/^`|`$/, "", v)
      # an empty, placeholder or TBD approval is not an approval
      if (v != "" && v !~ /^</ && toupper(v) !~ /^(TBD|NONE|PENDING|N\/A)$/) {
        appr = 1
      }
      next
    }
    END { flush(); print (found ? "OK" : "MISSING") }
  '
}

decisions_check_law_amendment() {
  local root="$1" base="$2" rel="${3:-DECISIONS.md}" target="${4:-LAW.md}"
  local changed verdict

  changed="$(scope_changed_files "$root" "$base")"
  if ! grep -qx "$target" <<<"$changed"; then
    printf 'no unrecorded policy change'   # policy unchanged, nothing to justify
    return 0
  fi

  if [[ ! -f "$root/$rel" ]]; then
    printf '%s changed but %s does not exist\n' "$target" "$rel"
    return 1
  fi

  verdict="$(decisions_appended_section "$root" "$base" "$rel" | _decisions_has_approved_entry "$target")"
  if [[ "$verdict" == "OK" ]]; then
    printf 'policy change recorded and approved'
    return 0
  fi

  printf '%s changed with no new %s entry naming it and carrying a recorded approved_by\n' \
    "$target" "$rel"
  return 1
}
