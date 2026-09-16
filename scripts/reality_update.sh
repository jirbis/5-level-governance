#!/usr/bin/env bash
# Rewrite the generated regions of REALITY.md in place.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/reality_gen.sh
source "$ROOT/scripts/reality_gen.sh"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

reality_render "$ROOT" >"$tmp"

if cmp -s "$tmp" "$ROOT/REALITY.md"; then
  echo "REALITY.md already current."
  exit 0
fi

cat "$tmp" >"$ROOT/REALITY.md"
echo "REALITY.md regenerated."
