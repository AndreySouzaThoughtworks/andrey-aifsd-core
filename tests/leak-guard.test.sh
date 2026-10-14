#!/usr/bin/env bash
set -uo pipefail

guard="$(cd "$(dirname "$0")/.." && pwd)/scripts/leak-guard.sh"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failures=0

expect_exit() {
  local name="$1" expected="$2"; shift 2
  "$@" >/dev/null 2>&1
  local actual=$?
  if [ "$actual" -eq "$expected" ]; then echo "ok   $name"; else echo "FAIL $name (exit $actual, want $expected)"; failures=$((failures + 1)); fi
}

mkdir -p "$work/repo"
printf 'acme\nACME-[0-9]+\n\n' > "$work/denylist"
echo "generic content" > "$work/repo/clean.md"

expect_exit "clean tree passes with a blank denylist line" 0 env AIFSD_DENYLIST="$work/denylist" "$guard" "$work/repo"

echo "see ticket Acme-42" > "$work/repo/leak.md"
expect_exit "client term is rejected case-insensitively" 1 env AIFSD_DENYLIST="$work/denylist" "$guard" "$work/repo"
rm "$work/repo/leak.md"

expect_exit "missing denylist fails closed" 2 env AIFSD_DENYLIST="$work/absent" "$guard" "$work/repo"
: > "$work/empty"
expect_exit "empty denylist fails closed" 2 env AIFSD_DENYLIST="$work/empty" "$guard" "$work/repo"

exit "$failures"
