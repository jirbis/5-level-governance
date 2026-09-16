#!/usr/bin/env bash
# Verify that a recorded approval was actually given.
#
# The decision log proves an approval is RECORDED. Nothing inside a file proves
# who wrote it, so `approved_by` alone is tamper-evidence, not authentication.
# This binds it to identity the repository holds and the author cannot forge:
# the set of GitHub accounts that submitted an APPROVED review on the pull
# request carrying the change.
#
#   bash scripts/verify_approval.sh [base] [target]
#
# Reads GOVERNANCE_APPROVERS_FILE: one GitHub login per line, written by CI
# after it has successfully queried the reviews.
#
# Fails closed, per decisions/ D4. The file MISSING means the approver list
# could not be established, which is not the same as "nobody approved" and is
# never a pass: a verifier that cannot verify must not report success.
set -uo pipefail

ROOT="${GOVERNANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
# shellcheck source=scripts/path_scope.sh
source "$ROOT/scripts/path_scope.sh"
# shellcheck source=scripts/shard_store.sh
source "$ROOT/scripts/shard_store.sh"

TARGET="${2:-LAW.md}"
DIR="decisions"

fail() { printf '%s\n' "$1"; exit 1; }

BASE="${1:-}"
if [[ -z "$BASE" ]]; then
  BASE="$(scope_diff_base "$ROOT" 2>&1)" || fail "approval: $BASE"
fi

changed="$(scope_changed_files "$ROOT" "$BASE")" \
  || fail "approval: cannot read the diff against ${BASE:0:12}; approvals cannot be verified"

if ! grep -qx "$TARGET" <<<"$changed"; then
  echo "approval: $TARGET unchanged, nothing to verify"
  exit 0
fi

# The approver list must have been established, not merely absent.
if [[ -z "${GOVERNANCE_APPROVERS_FILE:-}" ]]; then
  fail "approval: GOVERNANCE_APPROVERS_FILE is unset, so the approvers are unknown; $TARGET changed and cannot be verified"
fi
if [[ ! -f "$GOVERNANCE_APPROVERS_FILE" ]]; then
  fail "approval: the approver list was never written, so querying the reviews failed; $TARGET changed and cannot be verified"
fi

declare -a approvers=()
while IFS= read -r line; do
  line="${line//[$'\r\t ']/}"
  [[ -n "$line" ]] && approvers+=("${line#@}")
done < "$GOVERNANCE_APPROVERS_FILE"

if (( ${#approvers[@]} == 0 )); then
  fail "approval: $TARGET changed but nobody has submitted an approving review"
fi

# Only entries this change adds are examined. Entries already in the record were
# approved under whatever rule applied then, and they are immutable: rewriting
# them to satisfy a newer rule is precisely what the append-only record forbids.
declare -a unverified=()
checked=0
while IFS= read -r entry; do
  [[ -z "$entry" || ! -f "$ROOT/$entry" ]] && continue
  grep -q "$TARGET" "$ROOT/$entry" || continue

  value="$(sed -n 's/^- `approved_by`:[[:space:]]*//p' "$ROOT/$entry" | head -n1)"
  value="${value//\`/}"
  value="${value//[$'\r\t ']/}"
  value="${value#@}"
  checked=$(( checked + 1 ))

  matched=0
  for a in "${approvers[@]}"; do
    if [[ "${value,,}" == "${a,,}" ]]; then
      matched=1
      break
    fi
  done
  if (( matched == 0 )); then
    unverified+=("$entry names '${value:-<empty>}'")
  fi
done < <(shard_added "$ROOT" "$BASE" "$DIR")

if (( checked == 0 )); then
  fail "approval: $TARGET changed but this change adds no $DIR/ entry naming it"
fi

if (( ${#unverified[@]} > 0 )); then
  printf 'approval: recorded approver did not approve this pull request — %s; approving reviews came from: %s\n' \
    "${unverified[0]}" "$(IFS=,; echo "${approvers[*]}")"
  exit 1
fi

printf 'approval: %s entr(ies) verified against the approving reviewer(s): %s\n' \
  "$checked" "$(IFS=,; echo "${approvers[*]}")"
