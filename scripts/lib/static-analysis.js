const { execSync } = require("child_process");
const fs = require("fs");

// Run TypeScript compiler in check mode and capture errors
function runTsc(config) {
  if (!config.runTsc) return null;
  if (!fs.existsSync(config.tsconfigPath)) {
    console.log(`Skipping tsc: ${config.tsconfigPath} not found.`);
    return null;
  }

  try {
    execSync("npx tsc --noEmit --pretty false 2>&1", {
      encoding: "utf-8",
      timeout: 60_000,
      stdio: "pipe",
    });
    return { tool: "tsc", passed: true, errors: [] };
  } catch (err) {
    const output = (err.stdout || "") + (err.stderr || "");
    const errors = output
      .split("\n")
      .filter((line) => line.includes("error TS"))
      .slice(0, 50); // cap to avoid flooding the prompt
    return { tool: "tsc", passed: false, errors };
  }
}

// Run ESLint and capture errors
function runEslint(config) {
  if (!config.runEslint) return null;

  // Check if eslint config exists
  const eslintConfigs = [
    ".eslintrc.js", ".eslintrc.json", ".eslintrc.yml", ".eslintrc.yaml",
    ".eslintrc", "eslint.config.js", "eslint.config.mjs",
  ];
  const hasEslint = eslintConfigs.some((f) => fs.existsSync(f));
  if (!hasEslint) {
    console.log("Skipping eslint: no config found.");
    return null;
  }

  try {
    execSync("npx eslint . --format compact --quiet 2>&1", {
      encoding: "utf-8",
      timeout: 60_000,
      stdio: "pipe",
    });
    return { tool: "eslint", passed: true, errors: [] };
  } catch (err) {
    const output = (err.stdout || "") + (err.stderr || "");
    const errors = output
      .split("\n")
      .filter((line) => line.includes("Error"))
      .slice(0, 50);
    return { tool: "eslint", passed: false, errors };
  }
}

function runStaticAnalysis(config) {
  const results = [];
  console.log("Running static analysis...");

  const tscResult = runTsc(config);
  if (tscResult) {
    results.push(tscResult);
    const status = tscResult.passed ? "passed" : `${tscResult.errors.length} error(s)`;
    console.log(`  tsc: ${status}`);
  }

  const eslintResult = runEslint(config);
  if (eslintResult) {
    results.push(eslintResult);
    const status = eslintResult.passed ? "passed" : `${eslintResult.errors.length} error(s)`;
    console.log(`  eslint: ${status}`);
  }

  return results;
}

function formatStaticAnalysis(results) {
  if (results.length === 0) return "";

  const allPassed = results.every((r) => r.passed);
  if (allPassed) {
    return "Static analysis (tsc, eslint) passed with no errors.\n";
  }

  const lines = ["--- BEGIN STATIC ANALYSIS RESULTS ---"];
  for (const result of results) {
    if (!result.passed && result.errors.length > 0) {
      lines.push(`\n[${result.tool}] — ${result.errors.length} error(s):`);
      result.errors.forEach((e) => lines.push(`  ${e}`));
    }
  }
  lines.push("--- END STATIC ANALYSIS RESULTS ---\n");
  lines.push(
    "The errors above are from the TypeScript compiler and/or ESLint. " +
    "These are REAL errors, not speculation. If a static analysis error relates to " +
    "a changed file in the diff, it is strong evidence of a behavioral risk.\n"
  );
  return lines.join("\n");
}

module.exports = { runStaticAnalysis, formatStaticAnalysis };
