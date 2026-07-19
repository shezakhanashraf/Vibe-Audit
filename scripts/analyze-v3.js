const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { loadConfig } = require("./lib/config");
const { getFilteredDiff } = require("./lib/diff");
const { gracefulExit, renderReport } = require("./lib/report");

// ─── Layer modules ──────────────────────────────────────────────────────────────
const { runLayer1_Static } = require("./layers/01-static");
const { runLayer2_TestExecution } = require("./layers/02-test-execution");
const { runLayer3_Visual } = require("./layers/03-visual-regression");
const { runLayer4_Mutations } = require("./layers/04-mutation");
const { runLayer5_Synthesis } = require("./layers/05-synthesis");

/**
 * Vibe Audit v3 — Multi-Layer Behavioral Regression Pipeline
 *
 * Architecture:
 *   Layer 1: Static Analysis (fast, deterministic)
 *     - TypeScript compiler errors
 *     - ESLint violations
 *     - Dependency graph tracing (un-updated consumers)
 *     - Changed export analysis
 *
 *   Layer 2: Targeted Test Execution (medium cost, high signal)
 *     - Impact analysis: which tests cover the changed files?
 *     - Run ONLY affected tests (not the whole suite)
 *     - Capture pass/fail + coverage delta
 *     - Qure tests are first-class here
 *
 *   Layer 3: Visual/Structural Regression (medium cost, catches UI issues)
 *     - Run Playwright against affected pages
 *     - Capture screenshots + ARIA snapshots
 *     - Compare against baseline
 *
 *   Layer 4: Mutation Testing (expensive, proves test quality)
 *     - Only mutate lines that changed in the PR
 *     - Run affected tests against mutants
 *     - Surviving mutants = untested behavioral changes
 *
 *   Layer 5: AI Synthesis (correlates all signals)
 *     - Receives FACTS from layers 1-4
 *     - Doesn't guess — reasons over evidence
 *     - Produces final risk report with confidence based on signal strength
 *
 * Each layer is optional and configured independently.
 * The pipeline degrades gracefully — if you can't run tests (no app server),
 * it falls back to static + LLM like before, but with better context.
 */

async function main() {
  const config = loadConfig();
  const startTime = Date.now();

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║         Vibe Audit v3 — Regression Pipeline     ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // ─── Check API key ────────────────────────────────────────────────────────────
  const keyEnvMap = {
    gemini: "GEMINI_API_KEY",
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
  };
  const provider = config.provider;
  const model = config.models[provider];
  const keyEnv = keyEnvMap[provider];

  if (!process.env[keyEnv]) {
    return gracefulExit(
      "Analysis skipped",
      `\`${keyEnv}\` is not set. Export it in your shell or add it to a \`.env\` file.`
    );
  }

  // ─── Get diff ─────────────────────────────────────────────────────────────────
  let diffResult;
  try {
    diffResult = await getFilteredDiff(config);
  } catch (err) {
    return gracefulExit("Could not read the diff", `\`${err.message}\``);
  }

  let { diff, files: changedFiles } = diffResult;

  if (!diff) {
    return gracefulExit(
      "No reviewable changes detected",
      diffResult.source === "none"
        ? "No git remote found and no `local-diff.patch` file present.\n\nTo run locally: create `local-diff.patch` or set `LOCAL_DIFF_PATH`."
        : "All changed files were filtered out or the diff is empty."
    );
  }

  let truncated = false;
  if (diff.length > config.maxDiffChars) {
    diff = diff.slice(0, config.maxDiffChars);
    truncated = true;
  }

  console.log(`Diff: ${changedFiles.length} file(s), ${diff.length} chars\n`);

  // ─── Run layers ───────────────────────────────────────────────────────────────
  const signals = {
    diff,
    changedFiles,
    truncated,
  };

  // Layer 1: Static Analysis (always runs — fast and free)
  console.log("━━━ Layer 1: Static Analysis ━━━━━━━━━━━━━━━━━━━━━");
  signals.static = await runLayer1_Static(diff, changedFiles, config);

  // Layer 2: Test Execution (runs if app/tests are available)
  if (config.layers.testExecution) {
    console.log("\n━━━ Layer 2: Test Execution ━━━━━━━━━━━━━━━━━━━━━━");
    signals.testExecution = await runLayer2_TestExecution(changedFiles, config);
  } else {
    console.log("\n━━━ Layer 2: Test Execution [SKIPPED] ━━━━━━━━━━━━");
    signals.testExecution = null;
  }

  // Layer 3: Visual Regression (runs if baseUrl + baselineDir configured)
  if (config.layers.visualRegression) {
    console.log("\n━━━ Layer 3: Visual Regression ━━━━━━━━━━━━━━━━━━━");
    signals.visual = await runLayer3_Visual(changedFiles, config);
  } else {
    console.log("\n━━━ Layer 3: Visual Regression [SKIPPED] ━━━━━━━━━");
    signals.visual = null;
  }

  // Layer 4: Mutation Testing (runs if enabled — expensive)
  if (config.layers.mutationTesting) {
    console.log("\n━━━ Layer 4: Mutation Testing ━━━━━━━━━━━━━━━━━━━━");
    signals.mutations = await runLayer4_Mutations(diff, changedFiles, config);
  } else {
    console.log("\n━━━ Layer 4: Mutation Testing [SKIPPED] ━━━━━━━━━━");
    signals.mutations = null;
  }

  // Layer 5: AI Synthesis (always runs — correlates all signals into report)
  console.log("\n━━━ Layer 5: AI Synthesis ━━━━━━━━━━━━━━━━━━━━━━━━━");
  const analysis = await runLayer5_Synthesis(signals, config);

  if (!analysis) {
    return gracefulExit(
      "Could not complete synthesis",
      "The AI synthesis layer failed. Check logs above for details."
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n━━━ Report (completed in ${elapsed}s) ━━━━━━━━━━━━━━━━━━`);

  renderReport({
    analysis,
    signals,
    config,
    provider,
    model,
    elapsed,
  });
}

main().catch((err) => {
  gracefulExit("Unexpected error", `\`${err.message}\``);
});
