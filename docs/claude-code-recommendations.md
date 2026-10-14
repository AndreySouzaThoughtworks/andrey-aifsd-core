# Claude Code — configuration & workflow recommendations

Distilled, evidence-backed recommendations for Claude Code config and agentic dev flows (2025–2026).
Each line = actionable decision. Sources at bottom; caveats marked. About tech, not any specific codebase.

## CLAUDE.md / project instructions

- Keep each CLAUDE.md short — under ~200 lines per file; some keep root file under ~60.
- Bloated instruction files degrade instruction-following — more you cram, more gets ignored.
- Per-line test: "would removing this cause a mistake?" No → cut it.
- Include: non-guessable shell commands, non-default style rules, test runners, repo etiquette, environment quirks, known gotchas, deliberate architecture decisions.
- Exclude: anything inferable from code, standard language conventions, fast-changing facts, file-by-file descriptions.
- Push sometimes-relevant domain knowledge into on-demand skills, not always-loaded instruction file.
- Use path-scoped rules (a `paths:` glob in rule frontmatter) so rules load only when matching files touched.
- Add short "tool-calling gotchas" section (e.g. "run the test script, not a bare command", "don't `cd` needlessly — use the right path"); teams report better consistency. *(qualitative anecdote)*
- CLAUDE.md = advisory context, not enforced config — never rely on it for actions that must always happen.
- Run end-of-session reflect-and-suggest loop: ask model to summarize session and propose instruction-file refinements, then human reviews. *(manual prompt, not a telemetry pipeline)*

## Hooks

- Use hooks for anything that must happen every time, zero exceptions — hooks deterministic; instructions not.
- PostToolUse: auto-format and lint after every file edit.
- PreToolUse: hard-block dangerous calls (destructive shell, writes to a migrations folder, direct DB writes) via exit code 2 or `permissionDecision: "deny"`.
- Stop / SubagentStop: block turn from ending until check passes.
- Always inspect `stop_hook_active` in Stop hook to avoid infinite loops; cap with auto-override after N consecutive blocks.
- 30+ lifecycle events (PreToolUse, PostToolUse, Stop, SubagentStop, SessionStart, UserPromptSubmit, …) — gate at whichever point fits.
- Prefer baseline-aware gates (fail only on *new* violations) so gate adoptable on repo with existing debt.
- Shipping hooks inside a plugin: prefer `decision: "block"` JSON path over `exit 2` for Stop hooks — exit-2 reported to fail under plugin install. *(version-specific bug)*

## Verification before "done"

- Give model machine-readable success check (test exit code, linter, fixture diff), have it iterate until check green.
- Escalation ladder, weakest to strongest: in-prompt run-and-iterate, then `/goal` condition re-checked each turn by separate evaluator, then Stop-hook gate, then fresh-context verification subagent.
- Make model show evidence (command/test output), not assert success.
- Let verification subagent in fresh context try to *refute* result — agent that did work should not grade it.

## Subagents / orchestration

- Subagents run in isolated context windows, own system prompt and tool restrictions, return only a summary.
- Decompose complex work into focused single-purpose subagents — better output quality, easier debugging.
- Don't over-split: extra subagents cost markedly more tokens, add startup latency, share no state — use where fresh context or isolation genuinely helps (verification, review), not everywhere.
- Add adversarial review subagent that sees only diff + acceptance criteria, not reasoning that produced change.
- Tell reviewer to flag only gaps affecting correctness or stated requirements — reviewers over-report by default, chasing every finding causes over-engineering.
- Give long-lived subagent persistent memory via `memory:` frontmatter field (scopes: user / project / local); accrues patterns and insights across sessions.
- If subagent declares a `tools:` allowlist, include `Write`/`Edit` or its memory file silently never written. *(version-specific bug)*
- Write detailed delegation descriptions, limit each subagent's tool access, check subagent definitions into version control.

## Worktrees / parallelism

- `--worktree` / `-w` creates isolated worktree (under `.claude/worktrees/<name>/` on branch `worktree-<name>`); edits in one session never touch another's.
- Pin subagent to own worktree with `isolation: worktree` in frontmatter — temp worktree auto-removed if subagent finishes with no changes. Good for safe parallel fan-out.

## Plan mode / core workflow

- Default loop: Explore, Plan, Code, Commit.
- Separate research and planning from implementation to avoid solving wrong problem.
- Plan mode adds overhead — skip when diff describable in one sentence (typo, log line, rename).

## Plugins / distribution

- One plugin can bundle skills, subagents, hooks, MCP servers, LSP servers, background monitors, `bin/` executables, default settings — one versioned self-contained unit.
- Distribute via plugin marketplace; marketplace repo can be fully private (auth via `gh`/git credential helpers).
- Plugin auto-update needs `GITHUB_TOKEN` / `GH_TOKEN` in environment.
- Plugin `settings.json` currently honors only `agent` and `subagentStatusLine` keys.

## MCP

- Large MCP tool surfaces consume context — tool overload is real, measurable cost.
- Deferred/searchable tool loading can cut MCP context dramatically (one report: ~51k → ~8.5k tokens). *(single anecdote; verify for your setup)*
- Weak corroboration here — most MCP-specific claims did not survive verification; treat as directional.

## Caveats (read before relying on the above)

- Several primitives — subagent `memory:`, `isolation: worktree`, `/goal` evaluator, consecutive-block Stop cap — shipped in 2026 point releases; verify installed version before depending on them.
- "Significantly improved" team-usage claims are first-party qualitative anecdotes, not controlled measurements.
- Specific line-count targets are editorial heuristics; underlying bloat→degradation trend is benchmark-backed (IFScale, ManyIFEval).
- Docs move fast — older engineering-blog URLs now redirect to current docs site, exact event counts drift between versions.

## Sources

- Claude Code docs — best-practices, memory, hooks, sub-agents, worktrees, plugins, plugin-marketplaces (`code.claude.com/docs`).
- "How Anthropic Teams Use Claude Code" (Anthropic report PDF).
- HumanLayer — "Writing a good CLAUDE.md".
- Instruction-following degradation research: arXiv 2507.11538 (IFScale), "Curse of Instructions" / ManyIFEval.
- Practitioner posts on hooks, planner/executor/critic orchestration, git-worktree parallel agents, MCP context cost (various blogs/forums; lower evidentiary weight).

---
*Generated with Claude AI — please review before distribution.*
