# Client context contract

The core plugin never names a client. Everything client-specific comes from sections of the nearest CLAUDE.md (a client folder's CLAUDE.md, or a file it imports with `@`). A skill that needs a key reads it there; when the section or key is absent it uses the stated default, or asks.

| Section | Key | Meaning | Default when absent |
|---|---|---|---|
| `## Issue tracking` | Tracker | `jira`, `github`, `linear`, … | Ask |
| | Mechanics | Skill, MCP server or CLI that performs tracker calls | The tracker's connected MCP server, else its CLI |
| | Spec home | Where specs and implementation detail go | Ask; never the ticket |
| | Extra guardrail terms | Terms that must never reach the tracker | Base guardrail only |
| | Ticket URL | URL template for a ticket key | The tracker's default link form |
| | Issue types | Issue types the project offers, and what stands in for a missing one | Discover from the tracker |
| | Spike convention | How a Spike is filed when the tracker has no Spike type | Ask |
| | Bug fields | Dedicated fields for environment, steps, expected and actual result | Put them in the description |
| | Incident tracker | Project or board that holds production incidents | Ask |
| `## Commit convention` | Applies to, Subject, Ticket key, Branch, Remote, PR title | See `/aifsd-core:commit` | Plain Conventional Commits |
| `## Delivery notes` | Shared notes home | Per-ticket handoff, progress, findings and spec files shared across machines and people, and how they are published | `docs/aifsd/{ticket-id}/` in the repo being changed |
| | Local notes home | Machine-local scratch: agent notes, review worktrees, batch state | `~/.local/state/aifsd/` — allow it once per profile in `permissions.additionalDirectories` (see onboarding) |
| | Spec placement | Per-repo rule for whether specs live in the repo | Ask on first spec in a repo, then record the answer here |
| | Notes repo checkout | Local path of the notes repository when the Shared notes home lives in a separate repo; exported as `AIFSD_NOTES_REPO` | Clone it with `gh` |
| `## Stack recipes` | per stack | Skills or docs to load when writing or reviewing code in that stack | None; use the repo's own conventions |
| `## Review routing` | per job | Reviewer agents or skills for security, architecture, types, tests | Built-in `/security-review` and `/code-review`; skip the rest and say so |
| `## Domain references` | per domain | Client reference docs a skill may load | None |
| | API standard | The client's normative API guidelines | Ask when a story defines an API |
| `## Verification` | Verify command | Command the turn-end gate runs unprompted; read only from a folder-level CLAUDE.md above the repo (never the repo's own, never an `@`-imported file) | `pnpm lint`; `AIFSD_VERIFY_CMD` overrides both |
| `## Production support` | Observability, Log query, Environment, Auth errors, Retention | Where and how to read production telemetry | Ask; never guess an environment name |
| | Runbook index, Config fix, Ship path | Repo docs for incident handling, config changes and release | The repo's `docs/` |
| | Investigation corpus | Where per-incident notes go | `.claude/prod-support/<ticket>/` |
| | Deploy correlation, Intake fields, Similar tickets, Call capture | Client sources for correlating deploys, reading intake forms, finding related tickets, capturing calls | Skip and say so |
| `## Artifact style` | Template, Brand skill, Disclosure | HTML template, brand skill and disclosure line for generated pages | The core's neutral `primer.html`, no brand skill, no banner |
