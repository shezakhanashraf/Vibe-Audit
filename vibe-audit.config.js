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

  // Static analysis — set to false to skip
  runTsc: true,
  runEslint: true,
  tsconfigPath: "tsconfig.json",

  // Dependency graph tracing
  traceDeps: true,
};
