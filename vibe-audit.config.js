// vibe-audit.config.js — drop this in your project root to customize behavior.
// All fields are optional. Env vars override these values.

module.exports = {
  // LLM provider: "gemini" | "openai" | "anthropic"
  provider: "gemini",

  // Model override per provider
  models: {
    gemini: "gemini-2.5-flash",
    openai: "gpt-4o",
    anthropic: "claude-sonnet-4-20250514",
  },

  // Max diff size sent to the LLM (characters)
  maxDiffChars: 100_000,

  // Test directories
  testDir: "tests",
  qureTestDir: "tests/qure",

  // ─── Qure Integration ──────────────────────────────────────────────────────
  qure: {
    // Auto-detect Qure-generated tests anywhere in the project
    autoDetect: true,

    // Directories to scan for Qure tests
    scanDirs: ["tests", "e2e", "test", "__tests__", "spec"],

    // Extract metadata from Qure tests (pages, selectors, assertions)
    extractMetadata: true,

    // Show coverage gap suggestions in the report
    showCoverageGaps: true,

    // Risk weight for Qure-recorded flows (1.5 = 50% confidence boost)
    riskWeight: 1.5,
  },

  // ─── Multi-Layer Pipeline (v3) ─────────────────────────────────────────────
  layers: {
    // Layer 2: Run affected Playwright tests
    testExecution: true,
    testTimeout: 60_000,

    // Layer 3: Visual/ARIA snapshot comparison
    visualRegression: true,
    visualConfig: {
      baseUrl: "http://localhost:3000",
      baselineDir: ".vibe-audit/baselines",
      screenshotDir: ".vibe-audit/screenshots",
      startCommand: "npm run dev --prefix demo", // auto-starts the demo app
      startTimeout: 30_000,
    },

    // Layer 4: Mutation testing on changed lines
    // WARNING: expensive — only enable in CI or for critical PRs
    mutationTesting: false,
    mutationConfig: {
      maxMutants: 20,      // Cap to keep runtime reasonable
      testTimeout: 30_000, // Timeout per mutant test run
    },
  },

  // Static analysis — set to false to skip
  runTsc: true,
  runEslint: true,
  tsconfigPath: "tsconfig.json",

  // Dependency graph tracing
  traceDeps: true,

  // Application directory (where to run tests from)
  appDir: ".",
};
