#!/usr/bin/env bash
set -euo pipefail

readonly EXIT_LEAK=1
readonly EXIT_NO_DENYLIST=2

denylist="${AIFSD_DENYLIST:-$HOME/.config/aifsd/denylist}"
root="${1:-$(git rev-parse --show-toplevel)}"

patterns="$(grep -v '^[[:space:]]*$' "$denylist" 2>/dev/null || true)"
if [ -z "$patterns" ]; then
  echo "leak-guard: denylist missing or empty: $denylist" >&2
  exit "$EXIT_NO_DENYLIST"
fi

if hits="$(grep -rIniE --exclude-dir=.git -e "$patterns" "$root")"; then
  echo "leak-guard: client-specific terms found:" >&2
  echo "$hits" >&2
  exit "$EXIT_LEAK"
fi
