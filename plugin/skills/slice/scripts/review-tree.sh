#!/usr/bin/env bash
# Create, or re-point, this slice's review worktree and make it runnable.
#
# Usage: review-tree.sh <review-tree> [<sha>]    run from inside the repository
#
# Prints the tree's path on success. Exits non-zero with the reason on stderr
# when the tree cannot be made ready, which every caller treats as a STOP.
set -euo pipefail

REVIEW_TREE="${1:?usage: review-tree.sh <review-tree> [<sha>]}"
REPO="$(git rev-parse --show-toplevel)"
SHA="$(git rev-parse "${2:-HEAD}")"

# Outside the repository: a worktree nested under one carrying a
# pnpm-workspace.yaml is captured by that workspace, and pnpm install then
# exits 0 having installed nothing.
case "$REVIEW_TREE" in
  "$REPO"/*) echo "review tree must sit outside $REPO" >&2; exit 1 ;;
  /*) ;;
  *) echo "review tree must be an absolute path, got: $REVIEW_TREE" >&2; exit 1 ;;
esac

# Detached, because the slice branch is checked out in the orchestrator's tree
# and git refuses to hand the same branch to a second worktree. Re-point rather
# than add: every STOP in step 7 leaves the tree registered.
if git worktree list --porcelain | grep -qxF "worktree $REVIEW_TREE"; then
  git -C "$REVIEW_TREE" checkout --detach "$SHA"
else
  git worktree add --detach "$REVIEW_TREE" "$SHA"
fi

# The link's target, not its existence: a reused tree can hold a real
# node_modules, or a link to a tree that has moved, and either has the gate
# verify against dependencies the orchestrator does not have.
LINK="$REVIEW_TREE/node_modules"
if [ "$(readlink "$LINK" 2>/dev/null || true)" != "$REPO/node_modules" ]; then
  rm -rf "${LINK:?}"
  ln -s "$REPO/node_modules" "$LINK"
fi

echo "$REVIEW_TREE"
