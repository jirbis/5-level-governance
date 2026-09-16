#!/usr/bin/env bash
# Check that the approval a decision entry records was actually given.
#
#   bash scripts/verify_approval.sh [base]
#
# Every decisions/ entry the change ADDS must name a GitHub account that
# submitted an approving review on the head being verified. Entries already in
# the record are immutable and are never re-examined.
#
# Reads:
#   GOVERNANCE_APPROVERS_FILE  one GitHub login per line, written by CI after it
#                              has successfully queried the reviews
#
# WHAT THIS IS. It surfaces a mismatch between the name written in the record
# and the accounts that approved. It is not a barrier against a hostile author:
# in a `pull_request` workflow both this script and the workflow that runs it
# come from the branch under review, so whoever writes the entry can also
# rewrite the checker. Making approval MANDATORY is GitHub's job - branch
# protection or a ruleset with required reviews and stale-approval dismissal.
# See GATE.md.
#
# Fails closed, per decisions/ D4: an approver list that was never written means
# the query failed, which is not "nobody approved" and is never a pass.
set -uo pipefail

ROOT="${GOVERNANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
# shellcheck source=scripts/path_scope.sh
source "$ROOT/scripts/path_scope.sh"
# shellcheck source=scripts/shard_store.sh
source "$ROOT/scripts/shard_store.sh"

DIR="decisions"

fail() { printf '%s\n' "$1"; exit 1; }

BASE="${1:-}"
if [[ -z "$BASE" ]]; then
  BASE="$(scope_diff_base "$ROOT" 2>&1)" || fail "approval: $BASE"
fi

declare -a added=()
while IFS= read -r entry; do
  [[ -n "$entry" && -f "$ROOT/$entry" ]] && added+=("$entry")
done < <(shard_added "$ROOT" "$BASE" "$DIR")

# A change that records no decision has no approval to verify. Requiring one
# where LAW.md changed is a separate rule, enforced by the gate itself.
if (( ${#added[@]} == 0 )); then
  echo "approval: no new $DIR/ entries, nothing to verify"
  exit 0
fi

if [[ -z "${GOVERNANCE_APPROVERS_FILE:-}" ]]; then
  fail "approval: GOVERNANCE_APPROVERS_FILE is unset, so the approvers are unknown; ${#added[@]} new $DIR/ entr(ies) cannot be verified"
fi
if [[ ! -f "$GOVERNANCE_APPROVERS_FILE" ]]; then
  fail "approval: the approver list was never written, so querying the reviews failed; ${#added[@]} new $DIR/ entr(ies) cannot be verified"
fi

declare -a approvers=()
while IFS= read -r line; do
  line="${line//[$'\r\t ']/}"
  [[ -n "$line" ]] && approvers+=("${line#@}")
done < "$GOVERNANCE_APPROVERS_FILE"

if (( ${#approvers[@]} == 0 )); then
  fail "approval: ${#added[@]} new $DIR/ entr(ies) recorded but no approving review covers this head"
fi

declare -a unverified=()
for entry in "${added[@]}"; do
  value="$(sed -n 's/^- `approved_by`:[[:space:]]*//p' "$ROOT/$entry" | head -n1)"
  value="${value//\`/}"
  value="${value//[$'\r\t ']/}"
  value="${value#@}"

  if [[ -z "$value" ]]; then
    unverified+=("$entry records no approved_by")
    continue
  fi

  matched=0
  for a in "${approvers[@]}"; do
    if [[ "${value,,}" == "${a,,}" ]]; then
      matched=1
      break
    fi
  done
  (( matched == 1 )) || unverified+=("$entry names '$value'")
done

if (( ${#unverified[@]} > 0 )); then
  printf 'approval: recorded approver did not approve this head — %s; approving reviews of this head came from: %s\n' \
    "${unverified[0]}" "$(IFS=,; echo "${approvers[*]}")"
  exit 1
fi

printf 'approval: %s new %s entr(ies) verified against the approving reviewer(s) of this head: %s\n' \
  "${#added[@]}" "$DIR" "$(IFS=,; echo "${approvers[*]}")"
