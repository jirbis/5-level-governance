#!/usr/bin/env bash
# Install governance into another repository.
#
#   bash scripts/install.sh DEST [--with-ci] [--force]
#
# Nothing is overwritten. A file that already exists is left alone and reported,
# because the point of this framework is that records and doctrine are not
# clobbered by tooling. --force overwrites the canon files only; it never
# touches trace/ or decisions/, which are append-only by rule.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DEST=""
WITH_CI=0
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --with-ci) WITH_CI=1 ;;
    --force)   FORCE=1 ;;
    -h|--help)
      sed -n '2,10p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'
      exit 0 ;;
    *) DEST="$arg" ;;
  esac
done

if [[ -z "$DEST" ]]; then
  echo "Usage: bash scripts/install.sh DEST [--with-ci] [--force]" >&2
  exit 2
fi
if [[ ! -d "$DEST" ]]; then
  echo "Destination is not a directory: $DEST" >&2
  exit 2
fi
DEST="$(cd "$DEST" && pwd)"
if [[ "$DEST" == "$SRC" ]]; then
  echo "Destination is the governance repository itself." >&2
  exit 2
fi

written=0
skipped=0

put() {  # put <relative-path> <<<content
  local rel="$1" full="$DEST/$1"
  if [[ -e "$full" && $FORCE -eq 0 ]]; then
    printf '  skip   %s (exists)\n' "$rel"
    skipped=$(( skipped + 1 ))
    cat >/dev/null
    return
  fi
  mkdir -p "$(dirname "$full")"
  cat >"$full"
  printf '  write  %s\n' "$rel"
  written=$(( written + 1 ))
}

copy() {  # copy <relative-path-in-src> [relative-path-in-dest]
  local rel="$1" dst="${2:-$1}"
  put "$dst" < "$SRC/$rel"
}

# Records are append-only by rule, so a record write never overwrites - not even
# under --force, which exists to refresh doctrine, not to erase evidence. A
# same-day collision takes the next free name rather than replacing the entry.
put_record() {
  local rel="$1" full="$DEST/$1" base ext n=2
  if [[ -e "$full" ]]; then
    base="${rel%.md}"
    while [[ -e "$DEST/$base-$n.md" ]]; do
      n=$(( n + 1 ))
    done
    rel="$base-$n.md"
    full="$DEST/$rel"
  fi
  mkdir -p "$(dirname "$full")"
  cat >"$full"
  printf '  write  %s\n' "$rel"
  written=$(( written + 1 ))
}

echo "Installing governance into $DEST"
echo

echo "Runtime:"
# Only the runtime gate; the test suite belongs to the governance repository.
for f in gate_enforce.sh path_scope.sh decision_log.sh reality_gen.sh \
         reality_update.sh shard_store.sh shard_migrate.sh gate_report.sh; do
  copy "scripts/$f"
  chmod +x "$DEST/scripts/$f" 2>/dev/null || true
done

# A separate include, so a project that already has a Makefile keeps it.
put "governance.mk" <<'MK'
# Governance targets. Include from your Makefile:
#     include governance.mk
.PHONY: gate gate1 gate2 reality report trace decisions

gate:
	@bash ./scripts/gate_enforce.sh all

gate1:
	@bash ./scripts/gate_enforce.sh gate1

gate2:
	@bash ./scripts/gate_enforce.sh gate2

reality:
	@bash ./scripts/reality_update.sh

report:
	@bash ./scripts/gate_report.sh

trace:
	@bash -c 'source ./scripts/shard_store.sh && shard_render . trace'

decisions:
	@bash -c 'source ./scripts/shard_store.sh && shard_render . decisions'
MK

echo
echo "Doctrine:"
copy "CLAUDE.md"
copy "LAW.md"
copy "GATE.md"

put "PATH.md" <<'PATHMD'
# PATH

## Objective
Define the admissible implementation route under LAW.

## Active Scope
- Workspace: `<set workspace root>`
- Goal: `<set concrete goal>`
- Out of scope: `<set explicit exclusions>`

## Step Schema
Each step declares the files it may touch. Gate 2 checks the real git diff
against these patterns, so an undeclared scope admits no change.

```
- [ ] `P3` Do the thing.
      allowed_paths: src/**, Makefile
      forbidden_paths: LAW.md
```

- Patterns are anchored at the workspace root and must match the whole path.
- `**` matches any number of path segments; `*` and `?` never cross `/`.
- A pattern ending in `/` means that directory and everything under it.
- `forbidden_paths` wins over `allowed_paths`.
- `REALITY.md` and `trace/**` are always writable: the loop mandates them.
- `PATH.md` is NOT implicitly writable. Widening the route must be declared.

## Step List (Deterministic Order)
- [ ] `P1` Define goal, constraints and per-step file scopes.
      allowed_paths: PATH.md
- [ ] `P2` Execute the smallest admissible change set.
      allowed_paths: <set the files this step may touch>
- [ ] `P3` Update REALITY and add a trace entry.
      allowed_paths: PATH.md
- [ ] `P4` Run Gate 2 and record any rule change.
      allowed_paths: PATH.md, decisions/**

## Current Pointer
- `active_step`: `P1`

## Blocking Questions
- (none)

## Completion Criteria
- Every completed step has a corresponding `trace/` entry.
- Gate 1 and Gate 2 are both PASS for the final state.
PATHMD

put "REALITY.md" <<'REALITYMD'
# REALITY

<!-- generated:snapshot -->
<!-- /generated:snapshot -->

<!-- generated:artifacts -->
<!-- /generated:artifacts -->

## Deltas This Run
- (none yet)

## Open Risks
- PATH values still contain placeholders and must be set before operational use.

## Notes
- The generated regions above are rewritten by `make reality`. Everything else
  in this file is written by hand and survives regeneration.
REALITYMD

echo
echo "Records:"
mkdir -p "$DEST/trace" "$DEST/decisions"
copy "trace/README.md"
copy "decisions/README.md"
put_record "trace/$(date -u +%Y-%m-%d)-init.md" <<EOF
# $(date -u +%Y-%m-%d) — INIT

Installed governance: canon files, the \`trace/\` and \`decisions/\` records, and
the gate runtime under \`scripts/\`.

- \`gate_1\`: PASS — installation is the declared step
- \`gate_2\`: PASS — REALITY regenerated from the tree after install
EOF

if (( WITH_CI == 1 )); then
  echo
  echo "CI:"
  # Purpose-built for an installed project: it runs the installed shell runtime
  # and nothing else. This repository's own workflow builds the VS Code
  # extension, which the installer deliberately does not copy, so shipping that
  # one would fail the job before it ever reached the gates.
  put ".github/workflows/governance-gate.yml" <<'CI'
name: Governance Gate

on:
  pull_request:
  workflow_dispatch:

permissions:
  contents: read
  pull-requests: write

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          # Gate 2 diffs against the merge-base, so a shallow clone would leave
          # it nothing to compare and the scope check would pass vacuously.
          fetch-depth: 0

      - name: Resolve diff base
        id: base
        env:
          BASE_REF: ${{ github.event.pull_request.base.ref }}
        run: |
          set -euo pipefail
          if [[ -n "${BASE_REF:-}" ]]; then
            git fetch --no-tags origin "+refs/heads/$BASE_REF:refs/remotes/origin/$BASE_REF"
            base="$(git merge-base "origin/$BASE_REF" HEAD)"
          else
            base="$(git rev-parse 'HEAD^' 2>/dev/null || git rev-parse HEAD)"
          fi
          echo "base=$base" >> "$GITHUB_OUTPUT"

      - name: Collect approving reviewers
        id: approvers
        if: github.event_name == 'pull_request'
        # No continue-on-error: if the query fails the job fails. A verifier
        # whose input could not be established must never fall through to a pass.
        uses: actions/github-script@v7
        env:
          APPROVERS_FILE: ${{ runner.temp }}/governance-approvers.txt
        with:
          script: |
            const fs = require('fs');
            const { owner, repo } = context.repo;
            const reviews = await github.paginate(
              github.rest.pulls.listReviews,
              { owner, repo, pull_number: context.issue.number, per_page: 100 }
            );
            const latest = new Map();
            for (const r of reviews) {
              if (!r.user || !['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(r.state)) {
                continue;
              }
              latest.set(r.user.login, r.state);
            }
            const approvers = [...latest.entries()]
              .filter(([, state]) => state === 'APPROVED')
              .map(([login]) => login);
            fs.writeFileSync(process.env.APPROVERS_FILE, approvers.join('\n') + '\n');
            core.info(`approving reviewers: ${approvers.join(', ') || '(none)'}`);

      - name: Run gates and render report
        id: report
        env:
          GOVERNANCE_DIFF_BASE: ${{ steps.base.outputs.base }}
          GOVERNANCE_APPROVERS_FILE: ${{ github.event_name == 'pull_request' && format('{0}/governance-approvers.txt', runner.temp) || '' }}
          # Outside the checkout: a report written into the workspace is an
          # untracked file the gates would correctly reject as out of scope.
          REPORT: ${{ runner.temp }}/governance-report.md
        run: |
          set +e
          bash ./scripts/gate_report.sh > "$REPORT"
          echo "rc=$?" >> "$GITHUB_OUTPUT"
          echo "report=$REPORT" >> "$GITHUB_OUTPUT"
          cat "$REPORT" >> "$GITHUB_STEP_SUMMARY"

      - name: Comment on the pull request
        if: github.event_name == 'pull_request'
        # A fork pull request gets a read-only token, so commenting fails there
        # through no fault of the change. The summary above is always written.
        continue-on-error: true
        uses: actions/github-script@v7
        env:
          REPORT_PATH: ${{ steps.report.outputs.report }}
        with:
          script: |
            const fs = require('fs');
            const body = fs.readFileSync(process.env.REPORT_PATH, 'utf8');
            const marker = '<!-- governance-gate -->';
            const { owner, repo } = context.repo;
            const issue_number = context.issue.number;
            const existing = await github.paginate(
              github.rest.issues.listComments,
              { owner, repo, issue_number, per_page: 100 }
            );
            const mine = existing.find(
              (c) => c.user.type === 'Bot' && c.body && c.body.includes(marker)
            );
            if (mine) {
              await github.rest.issues.updateComment({ owner, repo, comment_id: mine.id, body });
            } else {
              await github.rest.issues.createComment({ owner, repo, issue_number, body });
            }

      - name: Verdict
        run: |
          if [[ "${{ steps.report.outputs.rc }}" != "0" ]]; then
            echo "::error::Governance gate failed. See the job summary or the pull request comment."
            exit 1
          fi
          echo "Governance gate passed."
CI
fi

echo
if [[ -f "$DEST/Makefile" ]] && ! grep -q 'governance.mk' "$DEST/Makefile"; then
  echo "Your Makefile was left untouched. Add this line to it:"
  echo
  echo "    include governance.mk"
  echo
elif [[ ! -f "$DEST/Makefile" ]]; then
  printf 'include governance.mk\n' > "$DEST/Makefile"
  echo "  write  Makefile (includes governance.mk)"
fi

if git -C "$DEST" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  bash "$DEST/scripts/reality_update.sh" >/dev/null 2>&1 || true
  echo "  REALITY.md generated from the tree"
else
  echo "  note: $DEST is not a git repository; the gates cannot verify anything until it is"
fi

echo
echo "$written written, $skipped skipped."
echo
echo "Next:"
echo "  1. Fill in the Active Scope and the step scopes in PATH.md."
echo "  2. Run 'make gate'. Gate 1 fails until the <set ...> placeholders are gone; that is the point."
echo "  3. Load CLAUDE.md as your agent's instructions."
