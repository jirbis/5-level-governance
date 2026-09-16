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
#   decisions_added_entries <root> <base> [dir]    -> the newly added shards, concatenated
#   decisions_check_law_amendment <root> <base>    -> reason on stdout, rc 0 if admissible
#
# The reason strings are shared verbatim with the extension's implementation in
# vscode-extension/src/gates.ts. Two gates that word the same finding
# differently are already drifting apart.

# The entries added since <base>, concatenated. Sharded, "what is new" is simply
# which files did not exist before - no byte arithmetic, and no ambiguity when
# two agents added entries in parallel.
decisions_added_entries() {
  local root="$1" base="$2" dir="${3:-decisions}"
  local f
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    [[ -f "$root/$f" ]] && cat "$root/$f" && printf '\n'
  done < <(shard_added "$root" "$base" "$dir")
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
  local root="$1" base="$2" dir="${3:-decisions}" target="${4:-LAW.md}"
  local changed verdict

  changed="$(scope_changed_files "$root" "$base")"
  if ! grep -qx "$target" <<<"$changed"; then
    printf 'no unrecorded policy change'   # policy unchanged, nothing to justify
    return 0
  fi

  if [[ ! -d "$root/$dir" ]]; then
    printf '%s changed but %s/ does not exist' "$target" "$dir"
    return 1
  fi

  verdict="$(decisions_added_entries "$root" "$base" "$dir" | _decisions_has_approved_entry "$target")"
  if [[ "$verdict" == "OK" ]]; then
    printf 'policy change recorded and approved'
    return 0
  fi

  printf '%s changed with no new %s/ entry naming it and carrying a recorded approved_by' \
    "$target" "$dir"
  return 1
}
