const fs = require("fs");
const path = require("path");

// Default config — overridden by vibe-audit.config.js in the project root or env vars
const DEFAULTS = {
  // LLM provider: "gemini" | "openai" | "anthropic"
  provider: "gemini",

  // Model name per provider
  models: {
    gemini: "gemini-2.5-flash",
    openai: "gpt-4o",
    anthropic: "claude-sonnet-4-20250514",
  },

  // Max diff characters to send to the LLM
  maxDiffChars: 100_000,

  // Test directories
  testDir: "tests",
  qureTestDir: "tests/qure",

  // Qure integration settings
  qure: {
    autoDetect: true,
    scanDirs: ["tests", "e2e", "test", "__tests__", "spec"],
    extractMetadata: true,
    showCoverageGaps: true,
    riskWeight: 1.5,
  },

  // ─── Layer Configuration (v3) ─────────────────────────────────────────────────
  layers: {
    // Layer 2: Test execution — run affected tests
    testExecution: true,
    testTimeout: 60_000,
    coverageDelta: false, // requires c8

    // Layer 3: Visual regression — capture + compare screenshots
    visualRegression: false, // disabled by default (needs running server)
    visualConfig: {
      baseUrl: "http://localhost:3000",
      baselineDir: ".vibe-audit/baselines",
      screenshotDir: ".vibe-audit/screenshots",
      startCommand: null, // e.g., "npm run dev"
      startTimeout: 30_000,
      captureTimeout: 60_000,
    },

    // Layer 4: Mutation testing — prove test quality
    mutationTesting: false, // disabled by default (expensive)
    mutationConfig: {
      maxMutants: 20,
      testTimeout: 30_000,
    },
  },

  // Static analysis
  runTsc: true,
  runEslint: true,
  tsconfigPath: "tsconfig.json",

  // Dependency graph
  traceDeps: true,

  // Application directory (for running tests)
  appDir: ".",

  // Paths to exclude from diff
  excludePaths: [
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "node_modules/", "dist/", "build/", ".next/", "coverage/",
  ],
  excludeExtensions: [
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
    ".pdf", ".zip", ".gz", ".mp4", ".woff", ".woff2", ".ttf",
  ],
};

function loadConfig() {
  const config = { ...DEFAULTS };

  // Try loading project-level config file
  const configPath = path.resolve("vibe-audit.config.js");
  if (fs.existsSync(configPath)) {
    try {
      const userConfig = require(configPath);
      Object.assign(config, userConfig);
      if (userConfig.models) {
        config.models = { ...DEFAULTS.models, ...userConfig.models };
      }
      if (userConfig.qure) {
        config.qure = { ...DEFAULTS.qure, ...userConfig.qure };
      }
      if (userConfig.layers) {
        config.layers = { ...DEFAULTS.layers, ...userConfig.layers };
        if (userConfig.layers.visualConfig) {
          config.layers.visualConfig = { ...DEFAULTS.layers.visualConfig, ...userConfig.layers.visualConfig };
        }
        if (userConfig.layers.mutationConfig) {
          config.layers.mutationConfig = { ...DEFAULTS.layers.mutationConfig, ...userConfig.layers.mutationConfig };
        }
      }
      console.log(`Loaded config from ${configPath}`);
    } catch (e) {
      console.log(`Warning: could not load ${configPath}: ${e.message}`);
    }
  }

  // Env var overrides
  if (process.env.VIBE_AUDIT_PROVIDER) config.provider = process.env.VIBE_AUDIT_PROVIDER;
  if (process.env.VIBE_AUDIT_MODEL) config.models[config.provider] = process.env.VIBE_AUDIT_MODEL;
  if (process.env.QURE_TEST_DIR) config.qureTestDir = process.env.QURE_TEST_DIR;
  if (process.env.VIBE_AUDIT_MAX_DIFF) config.maxDiffChars = parseInt(process.env.VIBE_AUDIT_MAX_DIFF, 10);
  if (process.env.VIBE_AUDIT_TSC === "false") config.runTsc = false;
  if (process.env.VIBE_AUDIT_ESLINT === "false") config.runEslint = false;

  // Qure-specific overrides
  if (process.env.QURE_AUTO_DETECT === "false") config.qure.autoDetect = false;
  if (process.env.QURE_SCAN_DIRS) config.qure.scanDirs = process.env.QURE_SCAN_DIRS.split(",").map((s) => s.trim());
  if (process.env.QURE_EXTRACT_METADATA === "false") config.qure.extractMetadata = false;
  if (process.env.QURE_COVERAGE_GAPS === "false") config.qure.showCoverageGaps = false;
  if (process.env.QURE_RISK_WEIGHT) config.qure.riskWeight = parseFloat(process.env.QURE_RISK_WEIGHT);

  // Layer overrides
  if (process.env.VIBE_AUDIT_TEST_EXECUTION === "false") config.layers.testExecution = false;
  if (process.env.VIBE_AUDIT_VISUAL === "true") config.layers.visualRegression = true;
  if (process.env.VIBE_AUDIT_MUTATIONS === "true") config.layers.mutationTesting = true;
  if (process.env.VIBE_AUDIT_BASE_URL) config.layers.visualConfig.baseUrl = process.env.VIBE_AUDIT_BASE_URL;
  if (process.env.VIBE_AUDIT_APP_DIR) config.appDir = process.env.VIBE_AUDIT_APP_DIR;

  return config;
}

module.exports = { loadConfig };
