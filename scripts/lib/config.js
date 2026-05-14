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

  // Static analysis
  runTsc: true,
  runEslint: true,
  tsconfigPath: "tsconfig.json",

  // Dependency graph
  traceDeps: true,

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

  return config;
}

module.exports = { loadConfig };
