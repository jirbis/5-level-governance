#!/usr/bin/env bash
# Tests for PATH scope enforcement. Run: bash scripts/test_path_scope.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/path_scope.sh"

tests=0
fails=0

ok() { tests=$((tests+1)); printf "  ok   %s\n" "$1"; }
no() { tests=$((tests+1)); fails=$((fails+1)); printf "  FAIL %s\n" "$1"; }

match_is() {
  local path="$1" glob="$2" want="$3"
  if scope_path_matches "$path" "$glob"; then got=match; else got=nomatch; fi
  [[ "$got" == "$want" ]] && ok "'$path' vs '$glob' -> $want" || no "'$path' vs '$glob' -> got $got, want $want"
}

echo "== glob semantics =="
match_is "scripts/gate_enforce.sh"        "scripts/**"                  match
match_is "scripts/nested/deep/x.sh"       "scripts/**"                  match
match_is "scripts/x.sh"                   "scripts/"                    match
match_is "scriptsfoo/x.sh"                "scripts/**"                  nomatch
match_is "vscode-extension/src/gates.ts"  "vscode-extension/src/*.ts"   match
match_is "vscode-extension/src/a/b.ts"    "vscode-extension/src/*.ts"   nomatch
match_is "PATH.md"                        "PATH.md"                     match
match_is "docs/PATH.md"                   "PATH.md"                     nomatch
match_is "a/b/foo.md"                     "**/foo.md"                   match
match_is "foo.md"                         "**/foo.md"                   match
match_is "src/a.ts"                       "src/?.ts"                    match
match_is "src/ab.ts"                      "src/?.ts"                    nomatch
# a literal dot must not act as a regex wildcard
match_is "READMExmd"                      "README.md"                   nomatch

echo
echo "== scope_rules parsing =="
fixture="$(mktemp -d)"
trap 'rm -rf "$fixture"' EXIT
cat > "$fixture/PATH.md" <<'PATH_EOF'
# PATH

## Step Schema
```
- [x] `EXAMPLE` this lives in a fenced block and must be ignored.
      allowed_paths: should/never/appear/**
```

## Step List (Deterministic Order)
- [x] `P1` done step.
      allowed_paths: alpha/**
- [ ] `P2` not active, not done.
      allowed_paths: beta/**
- [ ] `P3` active step.
      allowed_paths: gamma/**, delta.txt
      forbidden_paths: gamma/secret.txt

## Current Pointer
- `active_step`: `P3`
PATH_EOF

rules="$(scope_rules "$fixture/PATH.md" "P3")"
grep -q $'allow\talpha/\*\*'       <<<"$rules" && ok "completed step scope included" || no "completed step scope missing"
grep -q $'allow\tgamma/\*\*'       <<<"$rules" && ok "active step scope included"    || no "active step scope missing"
grep -q $'allow\tdelta.txt'        <<<"$rules" && ok "comma-separated patterns split" || no "comma split broken"
grep -q $'forbid\tgamma/secret.txt' <<<"$rules" && ok "forbidden_paths parsed"        || no "forbidden_paths missing"
grep -q 'beta'                     <<<"$rules" && no "pending non-active step leaked into scope" || ok "pending non-active step excluded"
grep -q 'should/never/appear'      <<<"$rules" && no "fenced example leaked into scope"          || ok "fenced example ignored"

echo
echo "== end-to-end gate behaviour =="
GATE="$ROOT/scripts/gate_enforce.sh"

make_repo() {
  local d; d="$(mktemp -d)"
  cp "$ROOT"/{CLAUDE.md,LAW.md,GATE.md,REALITY.md,TRACE.md,DECISIONS.md} "$d/"
  mkdir -p "$d/scripts"
  cp "$ROOT"/scripts/*.sh "$d/scripts/"   # whole dir: gate_enforce.sh sources siblings
  sed -i 's/Last gate status: `UNKNOWN`/Last gate status: `PASS`/' "$d/REALITY.md"
  git -C "$d" init -q
  git -C "$d" config user.email t@t.t
  git -C "$d" config user.name t
  printf '%s\n' "$1" > "$d/PATH.md"
  git -C "$d" add -A >/dev/null
  git -C "$d" commit -qm base
  printf '%s' "$d"
}

path_md_scoped='# PATH

## Step List (Deterministic Order)
- [ ] `P1` active.
      allowed_paths: allowed/**
      forbidden_paths: allowed/secret.txt

## Current Pointer
- `active_step`: `P1`
'

path_md_undeclared='# PATH

## Step List (Deterministic Order)
- [ ] `P1` active with no declared scope.

## Current Pointer
- `active_step`: `P1`
'

run_gate2_in() { GOVERNANCE_DIFF_BASE=HEAD bash "$1/scripts/gate_enforce.sh" gate2 2>&1; }

# in-scope change passes
d="$(make_repo "$path_md_scoped")"
mkdir -p "$d/allowed"; echo hi > "$d/allowed/file.txt"
out="$(run_gate2_in "$d")"
grep -q "^PASS: PATH scope" <<<"$out" && ok "in-scope change passes" || no "in-scope change should pass: $(grep 'PATH scope' <<<"$out")"
rm -rf "$d"

# out-of-scope change fails
d="$(make_repo "$path_md_scoped")"
mkdir -p "$d/elsewhere"; echo hi > "$d/elsewhere/file.txt"
out="$(run_gate2_in "$d")"
if grep -q "out-of-scope file changed: elsewhere/file.txt" <<<"$out"; then ok "out-of-scope change fails"; else no "out-of-scope change should fail"; fi
grep -q "Gate enforcement result: FAIL" <<<"$out" && ok "out-of-scope change makes gate exit FAIL" || no "gate should report FAIL"
rm -rf "$d"

# forbidden path fails even though allowed_paths would match it
d="$(make_repo "$path_md_scoped")"
mkdir -p "$d/allowed"; echo hi > "$d/allowed/secret.txt"
out="$(run_gate2_in "$d")"
grep -q "forbidden file changed: allowed/secret.txt" <<<"$out" && ok "forbidden_paths beats allowed_paths" || no "forbidden_paths should win"
rm -rf "$d"

# REALITY/TRACE are implicitly writable
d="$(make_repo "$path_md_scoped")"
echo "- 2026-01-01 - note; gate_1=PASS, gate_2=PASS." >> "$d/TRACE.md"
echo "note" >> "$d/REALITY.md"
out="$(run_gate2_in "$d")"
grep -q "^PASS: PATH scope" <<<"$out" && ok "REALITY.md/TRACE.md implicitly in scope" || no "bookkeeping files should be implicitly allowed"
rm -rf "$d"

# PATH.md is NOT implicitly writable
d="$(make_repo "$path_md_scoped")"
echo "- silently widened" >> "$d/PATH.md"
out="$(run_gate2_in "$d")"
grep -q "out-of-scope file changed: PATH.md" <<<"$out" && ok "undeclared PATH.md edit is caught" || no "PATH.md must not be implicitly writable"
rm -rf "$d"

# undeclared scope fails closed
d="$(make_repo "$path_md_undeclared")"
echo hi > "$d/anything.txt"
out="$(run_gate2_in "$d")"
grep -q "no allowed_paths declared" <<<"$out" && ok "undeclared scope fails closed" || no "undeclared scope must fail closed"
rm -rf "$d"

# non-git workspace cannot be verified -> fail closed
d="$(mktemp -d)"
cp "$ROOT"/{CLAUDE.md,LAW.md,GATE.md,REALITY.md,TRACE.md,DECISIONS.md} "$d/"
mkdir -p "$d/scripts"
cp "$ROOT"/scripts/*.sh "$d/scripts/"
printf '%s\n' "$path_md_scoped" > "$d/PATH.md"
out="$(bash "$d/scripts/gate_enforce.sh" gate2 2>&1)"
grep -q "not a git repository" <<<"$out" && ok "non-git workspace fails closed" || no "non-git workspace must fail closed"
rm -rf "$d"

echo
echo "-----------------------------------------"
if (( fails == 0 )); then
  echo "PATH scope tests: PASS ($tests assertions)"
  exit 0
fi
echo "PATH scope tests: FAIL ($fails/$tests assertions failed)"
exit 1
