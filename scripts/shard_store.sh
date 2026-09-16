#!/usr/bin/env bash
# Sharded append-only records.
#
# A single append-only file is correct but not usable: two agents, or two
# branches, appending on the same day collide on the last line of the same file
# every time. Splitting each entry into its own file removes the conflict by
# construction - two additions to a directory do not touch the same bytes.
#
# The append-only property survives the split and gets sharper: instead of "the
# new content must have the old content as a prefix", it becomes "a shard that
# existed at the base must be byte-identical now". That is a per-file question
# git already answers, so the rule is read straight off `git diff --name-status`:
# anything other than an addition is a rewrite of recorded history.
#
# Exposes:
#   shard_slug <text>                        -> filesystem-safe slug
#   shard_new_path <root> <dir> <label>      -> a free path for a new entry
#   shard_list <root> <dir>                  -> shard paths, chronological
#   shard_render <root> <dir>                -> every shard concatenated
#   shard_added <root> <base> <dir>          -> shards added since base
#   shard_immutability <root> <base> <dir>   -> violation lines on stdout

shard_slug() {
  local text="$1"
  printf '%s' "$text" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -e 's/[^a-z0-9]\+/-/g' -e 's/^-\+//' -e 's/-\+$//' \
    | cut -c1-60
}

# Entries sort by filename, so the date leads. A same-day collision gets a
# numeric suffix rather than overwriting an existing record.
shard_new_path() {
  local root="$1" dir="$2" label="$3"
  local slug date candidate n
  slug="$(shard_slug "$label")"
  [[ -z "$slug" ]] && slug="entry"
  date="$(date -u +%Y-%m-%d)"
  candidate="$dir/$date-$slug.md"
  n=2
  while [[ -e "$root/$candidate" ]]; do
    candidate="$dir/$date-$slug-$n.md"
    n=$(( n + 1 ))
  done
  printf '%s' "$candidate"
}

# README.md holds the directory's own rules, not an entry, so it is never
# listed, rendered or subject to the immutability rule.
shard_list() {
  local root="$1" dir="$2"
  [[ -d "$root/$dir" ]] || return 0
  find "$root/$dir" -maxdepth 1 -type f -name '*.md' ! -name 'README.md' -print \
    | sed "s|^$root/||" \
    | LC_ALL=C sort
}

shard_render() {
  local root="$1" dir="$2" f first=1
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    if (( first == 0 )); then
      printf '\n---\n\n'
    fi
    first=0
    cat "$root/$f"
  done < <(shard_list "$root" "$dir")
}

# Shards that did not exist at <base>: both committed additions and files not
# yet tracked. New entries are the only admissible change to the directory.
shard_added() {
  local root="$1" base="$2" dir="$3"
  {
    git -C "$root" diff --name-status --diff-filter=A "$base" -- "$dir/" 2>/dev/null | cut -f2-
    git -C "$root" diff --name-status --cached --diff-filter=A "$base" -- "$dir/" 2>/dev/null | cut -f2-
    git -C "$root" ls-files --others --exclude-standard -- "$dir/" 2>/dev/null
  } | sed '/^$/d' | grep -v "^$dir/README\.md$" | LC_ALL=C sort -u
}

# Shards that already existed at <base>. Only these are protected: an entry
# added on this branch may still be corrected before it is merged, but one that
# is already part of the record may not be touched.
_shard_at_base() {
  local root="$1" base="$2" dir="$3"
  git -C "$root" ls-tree -r --name-only "$base" -- "$dir/" 2>/dev/null \
    | grep -v "^$dir/README\.md$" || true
}

# Walk each commit in the range as well as comparing the endpoints. A branch
# that rewrites an entry in one commit and restores it in the next has still
# tampered with the record, and comparing only the endpoints would call that
# clean.
_shard_midchain_violations() {
  local root="$1" base="$2" dir="$3"
  local protected rev status path_a short

  protected="$(_shard_at_base "$root" "$base" "$dir")"
  [[ -z "$protected" ]] && return 0

  while IFS= read -r rev; do
    [[ -z "$rev" ]] && continue
    while IFS=$'\t' read -r status path_a _; do
      [[ -z "${status:-}" || -z "${path_a:-}" ]] && continue
      grep -qxF "$path_a" <<<"$protected" || continue
      short="$(git -C "$root" rev-parse --short "$rev" 2>/dev/null || printf '%s' "$rev")"
      printf 'touched in commit %s: %s\n' "$short" "$path_a"
    done < <(git -C "$root" diff-tree --no-commit-id --name-status -r \
               --diff-filter=MDRT "$rev" -- "$dir/" 2>/dev/null)
  done < <(git -C "$root" rev-list --reverse "$base..HEAD" 2>/dev/null || true)
}

shard_immutability() {
  local root="$1" base="$2" dir="$3"
  local status path_a path_b rc=0 line

  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    printf '%s\n' "$line"
    rc=1
  done < <(_shard_midchain_violations "$root" "$base" "$dir")

  while IFS=$'\t' read -r status path_a path_b; do
    [[ -z "${status:-}" ]] && continue
    case "$status" in
      A*) ;;                                  # a new entry: the only admissible change
      M*) printf 'modified: %s\n' "$path_a"; rc=1 ;;
      D*) printf 'deleted: %s\n' "$path_a"; rc=1 ;;
      R*) printf 'renamed: %s -> %s\n' "$path_a" "${path_b:-?}"; rc=1 ;;
      C*) printf 'copied over: %s\n' "$path_a"; rc=1 ;;
      T*) printf 'type changed: %s\n' "$path_a"; rc=1 ;;
      *)  printf 'altered (%s): %s\n' "$status" "$path_a"; rc=1 ;;
    esac
  done < <(
    {
      git -C "$root" diff --name-status "$base" -- "$dir/" 2>/dev/null
      git -C "$root" diff --name-status --cached "$base" -- "$dir/" 2>/dev/null
    } | grep -v "	$dir/README\.md$" | LC_ALL=C sort -u
  )

  return "$rc"
}
