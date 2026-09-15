#!/usr/bin/env bash
# Generate the mechanical sections of REALITY.md from the tree.
#
# REALITY is supposed to be the artifact truth, but a hand-written list drifts:
# this repository twice carried a REALITY that omitted files sitting on disk.
# What a machine can observe is generated here; judgement - deltas, risks, notes
# - stays hand-written and is preserved verbatim between runs.
#
# Generated regions are delimited by markers. Everything outside them is left
# exactly as it was.
#
# Exposes:
#   reality_snapshot_block <root>   -> the snapshot section
#   reality_artifacts_block <root>  -> the artifacts section
#   reality_render <root>           -> the whole file with generated regions refreshed
#   reality_is_current <root>       -> 0 if the file already matches what would be generated

# Above this many tracked files, list directories with counts instead of every
# path: an artifact nobody can read is not a record.
REALITY_FILE_LIMIT="${REALITY_FILE_LIMIT:-200}"

SNAPSHOT_OPEN="<!-- generated:snapshot -->"
SNAPSHOT_CLOSE="<!-- /generated:snapshot -->"
ARTIFACTS_OPEN="<!-- generated:artifacts -->"
ARTIFACTS_CLOSE="<!-- /generated:artifacts -->"

reality_snapshot_block() {
  local root="$1" active head_sha tree_state abs

  abs="$(cd "$root" && pwd)"

  active="$(sed -n 's/^- `active_step`: `\([^`]*\)`.*/\1/p' "$root/PATH.md" 2>/dev/null | head -n1)"
  head_sha="$(git -C "$root" rev-parse --short HEAD 2>/dev/null || printf 'unknown')"
  if [[ -n "$(git -C "$root" status --porcelain 2>/dev/null)" ]]; then
    tree_state="dirty"
  else
    tree_state="clean"
  fi

  printf '%s\n' "$SNAPSHOT_OPEN"
  printf '## Current State Snapshot\n'
  printf -- '- Generated: `%s`\n' "$(date -u +%Y-%m-%d)"
  printf -- '- Workspace root: `%s`\n' "$(basename "$abs")"
  printf -- '- Active PATH step: `%s`\n' "${active:-unknown}"
  printf -- '- HEAD at generation: `%s`\n' "$head_sha"
  printf -- '- Working tree at generation: `%s`\n' "$tree_state"
  printf '%s\n' "$SNAPSHOT_CLOSE"
}

reality_artifacts_block() {
  local root="$1" files count

  files="$(git -C "$root" ls-files 2>/dev/null || true)"
  count="$(grep -c . <<<"$files" || true)"

  printf '%s\n' "$ARTIFACTS_OPEN"
  printf '## Existing Artifacts\n'

  if (( count > REALITY_FILE_LIMIT )); then
    printf -- '- %s tracked files; listed by directory because the tree exceeds %s entries.\n\n' \
      "$count" "$REALITY_FILE_LIMIT"
    awk -F/ '{ if (NF == 1) d = "."; else { d = $1; for (i = 2; i < NF; i++) d = d "/" $i } ; n[d]++ }
             END { for (k in n) printf "- `%s/` — %d file(s)\n", k, n[k] }' <<<"$files" | sort
  else
    while IFS= read -r f; do
      [[ -n "$f" ]] && printf -- '- `%s`\n' "$f"
    done <<<"$files"
  fi
  printf '%s\n' "$ARTIFACTS_CLOSE"
}

# Replace the content between a marker pair, leaving everything else untouched.
_reality_splice() {
  local file="$1" open_m="$2" close_m="$3" block="$4"
  # `open` and `close` are awk built-ins; -v cannot assign to them
  awk -v open_m="$open_m" -v close_m="$close_m" -v block="$block" '
    index($0, open_m) == 1 { print block; skipping = 1; next }
    index($0, close_m) == 1 { skipping = 0; next }
    !skipping { print }
  ' "$file"
}

reality_render() {
  local root="$1"
  local file="$root/REALITY.md"
  local tmp

  if [[ ! -f "$file" ]]; then
    # Scaffold only. Never reached for an existing file: silently replacing one
    # would discard the hand-written sections this whole design exists to keep.
    printf '# REALITY\n\n%s\n\n%s\n\n## Open Risks\n- (none)\n\n## Notes\n- Generated sections are refreshed by `make reality`; everything else is written by hand.\n' \
      "$(reality_snapshot_block "$root")" "$(reality_artifacts_block "$root")"
    return 0
  fi

  if ! grep -qF "$SNAPSHOT_OPEN" "$file" || ! grep -qF "$ARTIFACTS_OPEN" "$file"; then
    printf 'REALITY.md has no generated regions; add %s / %s and %s / %s markers\n' \
      "$SNAPSHOT_OPEN" "$SNAPSHOT_CLOSE" "$ARTIFACTS_OPEN" "$ARTIFACTS_CLOSE" >&2
    return 2
  fi

  tmp="$(mktemp)"
  _reality_splice "$file" "$SNAPSHOT_OPEN" "$SNAPSHOT_CLOSE" "$(reality_snapshot_block "$root")" >"$tmp"
  _reality_splice "$tmp" "$ARTIFACTS_OPEN" "$ARTIFACTS_CLOSE" "$(reality_artifacts_block "$root")"
  rm -f "$tmp"
}

# Is REALITY.md already what generation would produce?
#
# Only the artifacts region is compared. The snapshot carries the generation
# date and HEAD, which move for reasons that are not drift, and requiring them
# to be current would turn every commit into a stale-REALITY failure.
reality_is_current() {
  local root="$1"
  local file="$root/REALITY.md"
  local current expected

  if [[ ! -f "$file" ]]; then
    printf 'REALITY.md does not exist'
    return 1
  fi
  if ! grep -qF "$ARTIFACTS_OPEN" "$file"; then
    printf 'REALITY.md has no generated artifacts region; run `make reality`'
    return 1
  fi

  current="$(awk -v open_m="$ARTIFACTS_OPEN" -v close_m="$ARTIFACTS_CLOSE" '
    index($0, close_m) == 1 { inside = 0 }
    inside { print }
    index($0, open_m) == 1 { inside = 1 }
  ' "$file")"
  expected="$(reality_artifacts_block "$root" | sed '1d;$d')"

  if [[ "$current" == "$expected" ]]; then
    return 0
  fi

  local missing extra
  missing="$(comm -13 <(sort <<<"$current") <(sort <<<"$expected") | head -n5 | tr '\n' ' ')"
  extra="$(comm -23 <(sort <<<"$current") <(sort <<<"$expected") | head -n5 | tr '\n' ' ')"
  printf 'REALITY.md is stale; run `make reality`'
  [[ -n "${missing// /}" ]] && printf ' — unrecorded: %s' "$(sed 's/- //g;s/`//g' <<<"$missing")"
  [[ -n "${extra// /}" ]] && printf ' — recorded but absent: %s' "$(sed 's/- //g;s/`//g' <<<"$extra")"
  return 1
}
