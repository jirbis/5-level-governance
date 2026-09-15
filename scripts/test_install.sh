#!/usr/bin/env bash
# Tests for the installer. Run: bash scripts/test_install.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

tests=0
fails=0
ok() { tests=$((tests+1)); printf "  ok   %s\n" "$1"; }
no() { tests=$((tests+1)); fails=$((fails+1)); printf "  FAIL %s\n" "$1"; }

# A real project: source in subdirectories, an ignored build output, an existing
# Makefile and an existing README the installer must not touch.
new_project() {
  local d; d="$(mktemp -d)"
  mkdir -p "$d/src/deep" "$d/build"
  printf 'export const x = 1;\n' > "$d/src/app.ts"
  printf 'export const y = 2;\n' > "$d/src/deep/nested.ts"
  printf '// ignored\n' > "$d/build/out.js"
  printf 'build/\n' > "$d/.gitignore"
  printf '# My Project\n' > "$d/README.md"
  printf 'SHELL := /bin/bash\n\n.PHONY: build\nbuild:\n\t@echo building\n' > "$d/Makefile"
  git -C "$d" init -q
  git -C "$d" config user.email t@t.t
  git -C "$d" config user.name t
  git -C "$d" add -A >/dev/null
  git -C "$d" commit -qm project
  printf '%s' "$d"
}

echo "== a fresh install =="
d="$(new_project)"
out="$(bash "$ROOT/scripts/install.sh" "$d" 2>&1)"

for f in CLAUDE.md LAW.md GATE.md PATH.md REALITY.md governance.mk \
         trace/README.md decisions/README.md scripts/gate_enforce.sh scripts/shard_store.sh; do
  [[ -f "$d/$f" ]] && ok "installs $f" || no "missing $f"
done
[[ -n "$(find "$d/trace" -name '*-init.md')" ]] && ok "seeds a first trace entry" || no "no seeded trace entry"
[[ -f "$d/scripts/test_install.sh" ]] && no "installed the governance test suite into the project" || ok "does not install the test suite"

echo
echo "== it does not clobber the project =="
grep -q '# My Project' "$d/README.md" && ok "leaves an existing README alone" || no "overwrote README.md"
grep -q 'echo building' "$d/Makefile" && ok "leaves an existing Makefile alone" || no "overwrote the Makefile"
grep -q 'include governance.mk' <<<"$out" && ok "tells the reader to include governance.mk" || no "no include instruction"

echo
echo "== the installed workspace passes its own gate =="
git -C "$d" add -A >/dev/null
git -C "$d" commit -qm governance
gate="$(GOVERNANCE_DIFF_BASE=HEAD bash "$d/scripts/gate_enforce.sh" gate2 2>&1)"
grep -q "Gate enforcement result: PASS" <<<"$gate" \
  && ok "Gate 2 passes right after install" \
  || no "Gate 2 failed after install: $(grep '^FAIL' <<<"$gate")"

# The nested files are the regression: REALITY once listed only the root.
for nested in src/app.ts src/deep/nested.ts scripts/gate_enforce.sh; do
  grep -q "$nested" "$d/REALITY.md" && ok "REALITY records $nested" || no "REALITY missed $nested"
done
grep -q 'build/out.js' "$d/REALITY.md" && no "REALITY recorded an ignored file" || ok "REALITY skips ignored files"

# Gate 1 must fail while the scope is still a placeholder: an installed but
# unconfigured workspace is not admissible, and saying so is the point.
g1="$(bash "$d/scripts/gate_enforce.sh" gate1 2>&1)"
grep -q "placeholder values" <<<"$g1" && ok "Gate 1 refuses an unconfigured PATH" || no "Gate 1 should refuse placeholders"

echo
echo "== the report survives a project with no test target =="
# Configure the scope first: an unconfigured PATH legitimately fails Gate 1, as
# asserted just above, so the report would be red for that reason instead.
sed -i 's/`<set workspace root>`/`proj`/; s/`<set concrete goal>`/`do the thing`/; s/`<set explicit exclusions>`/`nothing else`/' "$d/PATH.md"
sed -i 's|allowed_paths: <set the files this step may touch>|allowed_paths: src/**|' "$d/PATH.md"
g1b="$(bash "$d/scripts/gate_enforce.sh" gate1 2>&1)"
grep -q "Gate enforcement result: PASS" <<<"$g1b" && ok "Gate 1 passes once the scope is filled in" || no "Gate 1 should pass: $(grep '^FAIL' <<<"$g1b")"

rep="$(GOVERNANCE_DIFF_BASE=HEAD bash "$d/scripts/gate_report.sh" 2>&1)"
grep -q '| Tests | — not configured |' <<<"$rep" && ok "reports tests as not configured, not failed" || no "tests row wrong: $(grep 'Tests' <<<"$rep")"
grep -q '🟢' <<<"$rep" && ok "a project with no tests still gets a green verdict" || no "verdict should be green: $(grep -E '^- |Blockers' <<<"$rep" | head -3)"
rm -rf "$d"

echo
echo "== re-running the installer is safe =="
d="$(new_project)"
bash "$ROOT/scripts/install.sh" "$d" >/dev/null 2>&1
printf '\n## Open Risks\n- a hand-written risk\n' >> "$d/REALITY.md"
printf '# 2026-01-02 — WORK\n\nbody; gate_1=PASS, gate_2=PASS.\n' > "$d/trace/2026-01-02-work.md"
out2="$(bash "$ROOT/scripts/install.sh" "$d" 2>&1)"
grep -q 'a hand-written risk' "$d/REALITY.md" && ok "a second install preserves hand-written REALITY" || no "second install clobbered REALITY"
[[ -f "$d/trace/2026-01-02-work.md" ]] && ok "a second install preserves trace entries" || no "second install removed a trace entry"
grep -q 'skip ' <<<"$out2" && ok "reports what it skipped" || no "should report skips"
rm -rf "$d"

echo
echo "== --force refreshes doctrine but never erases evidence =="
d="$(new_project)"
bash "$ROOT/scripts/install.sh" "$d" >/dev/null 2>&1
init_entry="$(find "$d/trace" -name '*-init.md' | head -n1)"
printf '\nextra evidence added by hand\n' >> "$init_entry"
printf '# custom doctrine\n' > "$d/LAW.md"
out3="$(bash "$ROOT/scripts/install.sh" "$d" --force 2>&1)"
grep -q 'extra evidence added by hand' "$init_entry" \
  && ok "--force leaves an existing record entry untouched" \
  || no "--force erased evidence from a record entry"
grep -q 'Non-Negotiables' "$d/LAW.md" && ok "--force does refresh doctrine" || no "--force should refresh LAW.md"
[[ "$(find "$d/trace" -name '*-init*.md' | wc -l)" -ge 2 ]] \
  && ok "a same-day reinstall takes the next free entry name" \
  || no "reinstall should add a new entry rather than replace one"
rm -rf "$d"

echo
echo "== the installed workflow runs the installed runtime =="
d="$(new_project)"
bash "$ROOT/scripts/install.sh" "$d" --with-ci >/dev/null 2>&1
wf="$d/.github/workflows/governance-gate.yml"
[[ -f "$wf" ]] && ok "installs a workflow" || no "no workflow installed"
grep -q 'vscode-extension' "$wf" && no "installed workflow needs a directory the installer never creates" || ok "installed workflow does not reference vscode-extension"
grep -q 'npm ci' "$wf" && no "installed workflow builds an extension that is not there" || ok "installed workflow does not run npm"
grep -q 'gate_report.sh' "$wf" && ok "installed workflow runs the installed runtime" || no "workflow does not call the runtime"
grep -q 'fetch-depth: 0' "$wf" && ok "installed workflow keeps full history for the merge-base" || no "shallow clone would void the scope check"
rm -rf "$d"

echo
echo "== a broken test target is not mistaken for an absent one =="
d="$(new_project)"
bash "$ROOT/scripts/install.sh" "$d" >/dev/null 2>&1
sed -i 's/`<set workspace root>`/`proj`/; s/`<set concrete goal>`/`g`/; s/`<set explicit exclusions>`/`n`/' "$d/PATH.md"
sed -i 's|allowed_paths: <set the files this step may touch>|allowed_paths: src/**|' "$d/PATH.md"
git -C "$d" add -A >/dev/null; git -C "$d" commit -qm governance

printf 'include governance.mk\n\n.PHONY: test\ntest: missing-fixture\n\t@echo run\n' > "$d/Makefile"
rep="$(GOVERNANCE_DIFF_BASE=HEAD bash "$d/scripts/gate_report.sh" 2>&1)"
grep -q '| Tests | ❌ FAIL |' <<<"$rep" && ok "a broken test target is reported FAIL" || no "broken target wrongly reported: $(grep -m1 'Tests' <<<"$rep")"
grep -q '🔴' <<<"$rep" && ok "a broken test target makes the verdict red" || no "verdict should be red"

printf 'include governance.mk\n\n.PHONY: test\ntest:\n\t@echo "  ok   stub"\n' > "$d/Makefile"
rep="$(GOVERNANCE_DIFF_BASE=HEAD bash "$d/scripts/gate_report.sh" 2>&1)"
grep -q '| Tests | ✅ PASS |' <<<"$rep" && ok "a working test target is run and reported" || no "working target not run"
rm -rf "$d"

echo
echo "== it refuses to install into itself =="
if bash "$ROOT/scripts/install.sh" "$ROOT" >/dev/null 2>&1; then
  no "installing into the governance repository should be refused"
else
  ok "refuses to install into the governance repository"
fi

echo
echo "-----------------------------------------"
if (( fails == 0 )); then
  echo "Installer tests: PASS ($tests assertions)"
  exit 0
fi
echo "Installer tests: FAIL ($fails/$tests assertions failed)"
exit 1
