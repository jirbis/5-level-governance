#!/usr/bin/env bash
# Tests for REALITY generation. Run: bash scripts/test_reality_gen.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/reality_gen.sh"

tests=0
fails=0
ok() { tests=$((tests+1)); printf "  ok   %s\n" "$1"; }
no() { tests=$((tests+1)); fails=$((fails+1)); printf "  FAIL %s\n" "$1"; }
has()   { if [[ "$2" == *"$1"* ]]; then ok "$3"; else no "$3 :: missing '$1'"; fi; }
lacks() { if [[ "$2" != *"$1"* ]]; then ok "$3"; else no "$3 :: contains '$1'"; fi; }

new_repo() {
  local d; d="$(mktemp -d)"
  git -C "$d" init -q
  git -C "$d" config user.email t@t.t
  git -C "$d" config user.name t
  printf '# PATH\n\n## Current Pointer\n- `active_step`: `P7`\n' > "$d/PATH.md"
  printf 'alpha\n' > "$d/alpha.txt"
  mkdir -p "$d/src"; printf 'beta\n' > "$d/src/beta.txt"
  cat > "$d/REALITY.md" <<'R'
# REALITY

<!-- generated:snapshot -->
## Current State Snapshot
- Generated: `1999-01-01`
- stale content that must be replaced
<!-- /generated:snapshot -->

<!-- generated:artifacts -->
## Existing Artifacts
- `nothing.txt`
<!-- /generated:artifacts -->

## Deltas This Run
- a hand-written delta that must survive regeneration.

## Open Risks
- a hand-written risk that must survive regeneration.

## Notes
- hand-written notes.
R
  git -C "$d" add -A >/dev/null
  git -C "$d" commit -qm base
  printf '%s' "$d"
}

echo "== generated content =="
d="$(new_repo)"
out="$(reality_render "$d")"
has 'Active PATH step: `P7`' "$out" "snapshot reads the active step from PATH.md"
has 'Workspace root: `' "$out" "snapshot names the workspace root"
has 'HEAD at generation: `' "$out" "snapshot records HEAD"
has 'Working tree at generation: `clean`' "$out" "snapshot records a clean tree"
lacks 'stale content that must be replaced' "$out" "stale snapshot content is replaced"
has '- `alpha.txt`' "$out" "lists a tracked file at the root"
has '- `src/beta.txt`' "$out" "lists a tracked file in a subdirectory"
lacks '- `nothing.txt`' "$out" "drops an artifact that is no longer tracked"

# The regression this design exists to prevent: generation must never eat prose.
has 'a hand-written delta that must survive regeneration.' "$out" "preserves the Deltas section"
has 'a hand-written risk that must survive regeneration.' "$out" "preserves the Open Risks section"
has 'hand-written notes.' "$out" "preserves the Notes section"
has '## Deltas This Run' "$out" "preserves hand-written headings"
rm -rf "$d"

echo
echo "== idempotence =="
d="$(new_repo)"
reality_render "$d" > "$d/REALITY.md.1"
cp "$d/REALITY.md.1" "$d/REALITY.md"
reality_render "$d" > "$d/REALITY.md.2"
if diff -q <(grep -v 'Working tree at generation' "$d/REALITY.md.1") \
            <(grep -v 'Working tree at generation' "$d/REALITY.md.2") >/dev/null; then
  ok "rendering twice produces the same file"
else
  no "rendering is not idempotent"
fi
rm -rf "$d"

echo
echo "== staleness =="
d="$(new_repo)"
reality_render "$d" > "$d/R.tmp" && mv "$d/R.tmp" "$d/REALITY.md"
if reality_is_current "$d" >/dev/null; then ok "a freshly generated REALITY is current"; else no "should be current"; fi

printf 'gamma\n' > "$d/gamma.txt"
git -C "$d" add gamma.txt >/dev/null
msg="$(reality_is_current "$d")" && no "a newly tracked file should make REALITY stale" || {
  has 'gamma.txt' "$msg" "names the unrecorded file"
  has 'run `make reality`' "$msg" "tells the reader how to fix it"
}

git -C "$d" rm -q --cached gamma.txt >/dev/null; rm "$d/gamma.txt"
git -C "$d" rm -q alpha.txt >/dev/null
msg="$(reality_is_current "$d")" && no "a removed file should make REALITY stale" || \
  has 'alpha.txt' "$msg" "names the file recorded but no longer tracked"
rm -rf "$d"

echo
echo "== safety =="
d="$(new_repo)"
printf '# REALITY\n\n## Hand written, no markers\n- content\n' > "$d/REALITY.md"
out="$(reality_render "$d" 2>&1)"; rc=$?
if (( rc != 0 )); then ok "refuses to render a file with no generated regions"; else no "should refuse, got rc=0"; fi
has 'no generated regions' "$out" "explains why it refused"
if grep -q 'Hand written, no markers' "$d/REALITY.md"; then
  ok "leaves the unmarked file untouched"
else
  no "must not overwrite a file it cannot splice"
fi
rm -rf "$d"

echo
echo "== large trees collapse to directories =="
d="$(new_repo)"
mkdir -p "$d/many"
for i in $(seq 1 12); do printf '%s\n' "$i" > "$d/many/f$i.txt"; done
git -C "$d" add -A >/dev/null
out="$(REALITY_FILE_LIMIT=5 reality_artifacts_block "$d")"
has 'listed by directory because the tree exceeds 5 entries' "$out" "explains the collapse"
has '`many/` — 12 file(s)' "$out" "counts files per directory"
lacks '`many/f7.txt`' "$out" "does not list individual files past the limit"
rm -rf "$d"

echo
echo "-----------------------------------------"
if (( fails == 0 )); then
  echo "REALITY generation tests: PASS ($tests assertions)"
  exit 0
fi
echo "REALITY generation tests: FAIL ($fails/$tests assertions failed)"
exit 1
