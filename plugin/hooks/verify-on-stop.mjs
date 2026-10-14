#!/usr/bin/env node
// Stop-hook verification gate: blocks turn-end while the repo's lint gate reports
// issues, but only when there are uncommitted changes. Plugin-safe (uses the
// decision:"block" JSON path, not exit 2) and self-capping (won't loop forever).
// Command: AIFSD_VERIFY_CMD, else the `## Verification` Verify command in the nearest CLAUDE.md
// in a folder above the repo, else "pnpm lint". The repo's own CLAUDE.md is never read: a cloned
// repo controls it, and this command runs unprompted at every turn end.

import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";

const DEFAULT_VERIFY_CMD = "pnpm lint";
const MAX_CONSECUTIVE_BLOCKS = Number(process.env.AIFSD_VERIFY_MAX_BLOCKS ?? 3);

// shortcut: `@path` imports inside CLAUDE.md are not followed; put `## Verification` in the CLAUDE.md itself.
const repoRoot = () => {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return process.cwd();
  }
};

const verifyCmdFromInstructions = () => {
  for (let dir = dirname(repoRoot()); ; dir = dirname(dir)) {
    try {
      const section = readFileSync(join(dir, "CLAUDE.md"), "utf8")
        .split(/^## /m)
        .find((part) => part.startsWith("Verification"));
      const cmd = section?.match(/\*\*Verify command:\*\*\s*`([^`]+)`/)?.[1];
      if (cmd) return cmd;
    } catch {}
    if (dirname(dir) === dir) return undefined;
  }
};

const VERIFY_CMD = process.env.AIFSD_VERIFY_CMD ?? verifyCmdFromInstructions() ?? DEFAULT_VERIFY_CMD;
const VERIFY_OUTPUT_TAIL = 1500;
// Sentinel in the counter file: this session gave up on the gate. Negative, so no block count reaches it.
const RELEASED = -1;
const COUNTER_DIR = join(tmpdir(), "aifsd-verify-stop");

const allow = () => process.exit(0);
const block = (reason) => {
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
};

const readHookInput = () => {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return {};
  }
};

const counterFile = (sessionId) =>
  join(COUNTER_DIR, `${(sessionId ?? "default").replace(/[^A-Za-z0-9_-]/g, "_")}.count`);

const readCounter = (file) => {
  try {
    return Number(readFileSync(file, "utf8")) || 0;
  } catch {
    return 0;
  }
};
const bumpCounter = (file) => {
  mkdirSync(COUNTER_DIR, { recursive: true });
  const next = readCounter(file) + 1;
  writeFileSync(file, String(next));
  return next;
};
const resetCounter = (file) => {
  try {
    rmSync(file);
  } catch {
    /* already gone */
  }
};

const hasUncommittedChanges = () => {
  try {
    execSync("git diff --quiet && git diff --cached --quiet", { stdio: "ignore" });
    return false;
  } catch {
    return true;
  }
};

// Extensions a JS/TS repo's lint gate plausibly covers — deliberately generous, including the ones
// only a prettier-in-eslint setup touches. Skipping is a decision NOT to verify, so this errs toward
// running: the win is the asset-only turn (a screenshot, a binary fixture), not a clever prediction
// of what eslint was configured to read.
const LINTABLE = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".jsonc",
  ".md", ".mdx", ".yaml", ".yml", ".css", ".scss", ".less", ".html", ".vue", ".svelte",
]);

/**
 * Top-level directories the repo's own lint script names — typically `{src,apps,libs,test}/**`. Read from the script rather than configured here: the plugin stays
 * self-contained, and the repo already states its own scope.
 *
 * Empty means "couldn't tell" (`turbo run lint`, `nx run-many -t lint`, a nested `packages/x/src/**`
 * glob), and empty means RUN — guessing narrower would silently shrink the gate.
 */
const lintRoots = () => {
  const pkgPath = resolve(process.cwd(), "package.json");
  if (!existsSync(pkgPath)) return new Set();
  try {
    const script = JSON.parse(readFileSync(pkgPath, "utf8")).scripts?.[VERIFY_CMD.split(/\s+/).pop()];
    const roots = new Set();
    const globs = script?.matchAll(/(?:^|[\s"'(])(?:([\w.-]+)|\{([^}]+)\})\/\*\*/g) ?? [];
    for (const [, single, braced] of globs) {
      if (braced) braced.split(",").forEach((r) => roots.add(r.trim()));
      else roots.add(single);
    }
    return roots;
  } catch {
    return new Set();
  }
};

/**
 * Nothing changed that the gate could have an opinion about. Two independent reasons: the file types
 * are ones no linter reads, or every changed path lies outside the roots the lint script itself
 * names. Either way the run can only report failures this turn did not cause.
 */
const nothingLintableChanged = () => {
  try {
    const changed = execFileSync("git", ["diff", "--name-only", "HEAD"], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
    if (changed.length === 0) return false;
    // Anything at the repo root means RUN, before any other test. That is where the files deciding
    // what lint reports live — `eslint.config.mjs`, `tsconfig.json`, `package.json`, and the
    // extensionless `.eslintrc` / `.prettierrc` / `.editorconfig`, which carry no extension to match
    // and no directory to match either. Both filters below would wave them through.
    if (changed.some((f) => !f.includes("/"))) return false;
    if (!changed.some((f) => LINTABLE.has(extname(f)))) return true;
    const roots = lintRoots();
    return roots.size > 0 && !changed.some((f) => roots.has(f.split("/")[0]));
  } catch {
    return false;
  }
};

const verifyScriptIsAbsent = () => {
  const pkgPath = resolve(process.cwd(), "package.json");
  if (!existsSync(pkgPath)) return true;
  const scriptName = VERIFY_CMD.split(/\s+/).pop();
  const looksLikePnpmScript = /^pnpm(\s+run)?\s/.test(VERIFY_CMD);
  if (!looksLikePnpmScript) return false;
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  return !pkg.scripts || !pkg.scripts[scriptName];
};

const main = () => {
  const input = readHookInput();
  const counter = counterFile(input.session_id);

  // Released stays released for the session — read BEFORE the early exits, because those reset the
  // counter and a clean or asset-only turn would otherwise wipe the sentinel and restart the
  // nagging. Resetting on release was the original bug: a gate that cannot be made green went
  // block-block-block-release forever, paying for a full lint run each time.
  const released = readCounter(counter) === RELEASED;

  if (!hasUncommittedChanges() || verifyScriptIsAbsent() || nothingLintableChanged()) {
    if (!released) resetCounter(counter);
    allow();
  }

  if (released) allow();

  try {
    execSync(VERIFY_CMD, { stdio: "pipe", cwd: process.cwd() });
    resetCounter(counter);
    allow();
  } catch (error) {
    const blocks = bumpCounter(counter);
    if (blocks > MAX_CONSECUTIVE_BLOCKS) {
      writeFileSync(counter, String(RELEASED));
      allow();
    }
    const output =
      (error.stdout?.toString() ?? "") + (error.stderr?.toString() ?? "");
    block(
      `Verification gate (\`${VERIFY_CMD}\`) reported issues — fix them before ending the turn ` +
        `(block ${blocks}/${MAX_CONSECUTIVE_BLOCKS}; the gate auto-releases after that). ` +
        `Show the passing output as evidence once fixed.\n\n${output.slice(-VERIFY_OUTPUT_TAIL)}`,
    );
  }
};

main();
