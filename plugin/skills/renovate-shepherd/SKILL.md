---
name: renovate-shepherd
description: 'Shepherd Renovate bot PRs to safety. Fetches all open Renovate PRs, categorises them into new (not yet approved or auto-merge not enabled) and pending-merge (approved + auto-merge enabled but not yet merged), displays them in sorted tables, then walks you through each new PR: checkout, deep-dive analysis, local checks, verdict, approval comment, and auto-merge toggle.'
---
# Renovate Shepherd

Manage + triage all open Renovate bot PRs for this repo. Structured, safe workflow.

---

## Phase 1 — Fetch & Categorise

### 1.1 Detect the repository

```bash
gh repo view --json nameWithOwner --jq '.nameWithOwner'
```

Store result as `REPO` (e.g. `<org>/<repo>`).

### 1.2 Fetch all open Renovate PRs

`gh pr list --author` no support `app/`-prefixed bot logins. Fetch all open PRs, filter by login containing `renovate` (case-insensitive).

**Important**: always use `--limit 100`. Default limit 30 — silently omits older PRs. Renovate PRs pile up; older ones (lower numbers) hide without this flag.

```bash
gh pr list \
  --repo "$REPO" \
  --state open \
  --json number,title,createdAt,labels,reviewDecision,autoMergeRequest,author \
  --limit 100 \
  | jq '[.[] | select(.author.login | ascii_downcase | contains("renovate"))]'
```

### 1.3 Classify each PR

Per PR:

- **`approved`** — `reviewDecision == "APPROVED"`
- **`autoMergeEnabled`** — `autoMergeRequest != null`

Categories:

| Category | Condition |
|----------|-----------|
| **Inbox** | NOT approved **OR** (approved AND NOT autoMergeEnabled) |
| **In Flight** | approved AND autoMergeEnabled |

---

## Phase 2 — Display Tables

Show **two tables**, sorted `createdAt` ascending (oldest first — most urgent top).

### Table A — Inbox (need attention)

| PR # | Title (≤60 chars) | Approved? | Auto-merge? |
|------|--------------------|-----------|-------------|

- Truncate title at 60 chars, append `…` if cut.
- **Approved?** — `✓` / `✗`
- **Auto-merge?** — `✓` / `✗`

### Table B — In Flight (approved + auto-merge on, waiting for CI/merge queue)

| PR # | Title (≤60 chars) | Opened |
|------|--------------------|----|

- **Opened** — human-readable age, e.g. `3 d`, `1 h 20 m`, `5 w`.

Table empty → print one line: `(none)`.

---

## Phase 3 — Interactive Triage Loop

Iterate every **Inbox** PR in Table A (oldest first).

Per PR, run steps in order.

---

### Step 3.1 — Checkout the branch

```bash
gh pr checkout <PR_NUMBER> 2>/dev/null || {
  BRANCH=$(gh pr view <PR_NUMBER> --json headRefName --jq '.headRefName')
  git fetch origin "$BRANCH"
  git checkout "origin/$BRANCH" --detach
}
```

Detached HEAD fine — checks need files, not writable branch. Confirm checkout worked before continuing.

---

### Step 3.2 — Understand the change

Run in parallel:

```bash
gh pr view <PR_NUMBER> --json title,body,files,labels
gh pr diff <PR_NUMBER> | awk '/^diff --git.*pnpm-lock/{skip=1;next} /^diff --git/{skip=0} !skip'
```

`awk` skips whole `pnpm-lock.yaml` diff section (section-aware, not line-aware), keeps output on `package.json` where bump declared. Lockfile installed correctly in Step 3.3 via `pnpm install --frozen-lockfile`.

Analyse diff with these questions:

1. **What changed?** — packages updated, patch/minor/major bump, lock-file only?
2. **Breaking potential** — any updated package have changelog entry mentioning breaking changes, removed APIs, behaviour changes?
3. **Scope of impact** — which source files import updated package(s)?  
   Use `grep -rE "from ['\"]<package>" src/ test/` to find usages. Prefix match (no closing quote) catches exact imports (e.g. `from 'rxjs'`) and subpath imports (e.g. `from 'rxjs/operators'`) in one pass.
4. **Type safety** — any type signature changes visible in diff?
5. **Config/env changes** — any config schema or env variable requirements change?

---

### Step 3.3 — Run local checks

Three phases. Check fails → record failure and **continue** (no abort — surface failure in verdict).

**Exception**: `pnpm install --frozen-lockfile` fails → mark **blocking**. Run no further checks — all results meaningless against stale deps. Surface immediately in verdict as `DO NOT MERGE` with install error.

**Phase 1 — Install (blocking gate, sequential)**

```bash
# Note: output showing version "regressions" (e.g. - msw 2.12.14 / + msw 2.12.12)
# is expected when switching between branches with different lockfiles — the install
# is correctly pinning to the version declared in this branch's lockfile, not regressing.
pnpm install --frozen-lockfile
```

**Phase 2 — Static analysis + tests (run all in parallel)**

All read-only, no build artefacts, independent:

```bash
pnpm exec tsc --noEmit        # type check
pnpm run format:check         # format check
pnpm run lint                 # lint
pnpm run lint:deps            # dependency boundaries
pnpm run test                 # unit + integration tests (ts-jest compiles directly, no dist needed)
```

**Phase 3 — Build (sequential, after phase 2)**

```bash
pnpm run build                # compiles to dist/
```

Capture: exit code, last 20 lines of stdout/stderr per failing step.

---

### Step 3.4 — Present verdict

Print structured verdict block:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PR #<number> — <title>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CHANGE ANALYSIS
  Package(s)    : <list>
  Bump type     : patch | minor | major
  Breaking risk : LOW | MEDIUM | HIGH
  Affected files: <count> usages across src/ and test/
  Notes         : <any changelog / type-change findings>

LOCAL CHECKS
  ✓ / ✗  pnpm install --frozen-lockfile  [BLOCKING]
  ✓ / ✗  tsc --noEmit
  ✓ / ✗  format:check
  ✓ / ✗  lint
  ✓ / ✗  lint:deps
  ✓ / ✗  test
  ✓ / ✗  build

VERDICT
  <SAFE TO MERGE | NEEDS REVIEW | DO NOT MERGE>

  <One paragraph summarising the reasoning.  If any check failed,
   explain which check, what the error indicates, and whether it
   is pre-existing or introduced by this PR.>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Step 3.5 — User decision

Ask:

> **Are you happy with this verdict?**
> Options:
> - **[A]pprove** — approve PR with generated comment, proceed
> - **[I]nvestigate more** — describe what else to check (then loop back to Step 3.2 with that focus area)
> - **[S]kip** — leave PR untouched, next one
> - **[Q]uit** — stop triage loop entirely

Wait for user input before continuing.

---

### Step 3.6 — Approve (if user chose A)

Generate approval comment from template, write to temp file, submit via `--body-file` — avoids shell escaping issues with multi-line content:

```
## Renovate Shepherd Review

**Packages updated**: <list>
**Bump type**: <patch | minor | major>
**Breaking risk**: <LOW | MEDIUM | HIGH>

### Local checks
| Check | Result |
|-------|--------|
| Install (`pnpm install --frozen-lockfile`) | ✓ / ✗ |
| Type check (`tsc --noEmit`) | ✓ / ✗ |
| Format check | ✓ / ✗ |
| Lint | ✓ / ✗ |
| Dependency boundaries | ✓ / ✗ |
| Tests | ✓ / ✗ |
| Build | ✓ / ✗ |

### Notes
<any findings from change analysis>

Reviewed and approved via `/renovate-shepherd` skill.
```

Write comment to temp file, submit:

```bash
cat > /tmp/renovate-review-<PR_NUMBER>.md << 'EOF'
<filled comment body>
EOF

gh pr review <PR_NUMBER> --approve --body-file /tmp/renovate-review-<PR_NUMBER>.md
rm /tmp/renovate-review-<PR_NUMBER>.md
```

---

### Step 3.7 — Merge the PR

**First, determine repo merge policy** (see **Merge profile** section). Repo allows auto-merge → `gh pr merge <PR_NUMBER> --auto --squash` enough; enable it, move on. Repo disables auto-merge under strict status checks (common for services with strict checks, often with release bot committing to `main` after every merge) → use manual sequence below.

**The release-bot problem** (when repo has one): release bot commits `[no ci] chore(release): x.y.z` to `main` within ~30 seconds of every merge. PR branch falls behind, blocks merge under strict status checks. `--admin` flag does NOT bypass this (bypasses approval rules, not up-to-date check).

**Manual merge sequence (strict-checks repos)**:

1. After previous PR merges, wait until `main` latest commit is a `[no ci]` release commit — confirms release bot ran:

```bash
until git fetch origin main -q && git log origin/main -1 --format="%s" | grep -q "\[no ci\]"; do sleep 10; done
```

2. Update PR branch (now includes release commit, so current with main):

```bash
gh pr update-branch <PR_NUMBER>
```

3. Wait for all CI checks to finish (required: Docker Checks, Semgrep/SAST, container security scan — ~3-4 min total):

```bash
# Wait 30s for GitHub to register the new CI run, then poll
sleep 30
until ! gh pr checks <PR_NUMBER> 2>&1 | grep -q "	pending	"; do sleep 20; done
```

4. Verify main has not advanced during CI wait (another merge restarts cycle):

```bash
CURRENT_SHA=$(git fetch origin main -q && git rev-parse origin/main)
# Compare with the SHA captured in step 1
```

5. Main still at same SHA → merge:

```bash
gh pr merge <PR_NUMBER> --squash --body ""
```

Main advanced (rare — only if another concurrent merge happened) → back to step 1.

---

### Step 3.8 — Advance to next PR

Return to `main` before next checkout — clean starting state:

```bash
git checkout main
```

Print:

```
→ Moving to next PR…
```

Repeat from Step 3.1 for next PR in Table A.

---

## Phase 4 — Summary

After loop finishes (all PRs processed, or user quit), print:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRIAGE COMPLETE
  Processed : <n> PRs
  Approved  : <n>
  Auto-merge enabled : <n>
  Skipped   : <n>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Checkout back to `main`:

```bash
git checkout main
```

---

## Notes

- Never force-push or reset during this workflow.
- `pnpm run test` takes longer than 3 minutes → surface running output and wait, do not abort.
- **major** bump with any changelog mention of breaking changes → `DO NOT MERGE` unless all checks pass AND user explicitly overrides.
- Branch behind `main` by more than 10 commits → note in verdict; PR may have conflicts.
- Respect existing CLAUDE.md project rules: no comments, no type assertions, functional style in any generated snippets.

### Merge profile (determine per repo)

Merge mechanics depend on target repo branch-protection + CI config. Determine once per repo; Step 3.7 follows from them. Values below are **worked example from a strict-checks service** (`example-service`) — confirm each against actual repo (`gh api repos/$REPO/rulesets`, `gh pr checks`, repo release workflow):

**Auto-merge enabled?** Yes → Step 3.7 is just `gh pr merge --auto --squash`. `gh pr merge --auto` fails with `enablePullRequestAutoMerge` → auto-merge disabled → manual sequence.

**Required status checks** (example, example-service — enforced by ruleset, not classic branch protection):
- `service-checks / docker-checks / Docker Checks` (required check context)
- Compliance - container security scan workflow (required workflow)
- Compliance - Secure Development (SAST) workflow (required workflow)
Full CI run ~3-4 min. Other repos list different contexts — read them from repo ruleset.

**Release bot?** Some repos run bot committing `[no ci] chore(release): x.y.z` to `main` ~30s after every merge. Combined with `strict_required_status_checks_policy: true`, every PR branch falls behind after previous merge, so required checks re-run on new merge commit. Mitigation: wait for release-bot commit on `main` before updating next branch (Step 3.7). No release bot → skip that wait.

**`--admin` bypass**: `gh pr merge --admin` does NOT bypass "Required status check is expected" error — only approval-count requirements.

**Lockfile conflicts**: multiple Renovate PRs pile up → some branches conflict with current `main` on `pnpm-lock.yaml`. `gh pr update-branch` returns `Cannot update PR branch due to conflicts`. Skip those — Renovate rebases them on next run.
