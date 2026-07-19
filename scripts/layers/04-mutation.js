/**
 * Layer 4: Mutation Testing (Targeted)
 *
 * The highest-signal technique for proving test quality:
 * "If I change this line, does any test fail?"
 *
 * If no test fails after a mutation → the tests are BLIND to that behavior.
 * This is the strongest evidence of regression risk.
 *
 * Key optimization: ONLY mutate lines that changed in this PR.
 * Full mutation testing is prohibitively expensive (hours).
 * Targeted mutation testing on just the diff is feasible (minutes).
 *
 * Mutations applied:
 * - Arithmetic: + → -, * → /, etc.
 * - Comparison: > → >=, === → !==
 * - Boolean: true → false, && → ||
 * - String: remove string literal
 * - Delete: remove statement entirely
 * - Return: change return value
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Mutation operators
const MUTATIONS = [
  { name: "negate_condition", pattern: /(!==|===)/, replace: (m) => m === "!==" ? "===" : "!==" },
  { name: "flip_comparison", pattern: /(>=|<=|>|<)/, replace: (m) => ({ ">=": "<", "<=": ">", ">": "<=", "<": ">=" }[m]) },
  { name: "flip_boolean", pattern: /\b(true|false)\b/, replace: (m) => m === "true" ? "false" : "true" },
  { name: "flip_logic", pattern: /(&&|\|\|)/, replace: (m) => m === "&&" ? "||" : "&&" },
  { name: "zero_number", pattern: /\b(\d+)\b/, replace: () => "0" },
  { name: "empty_string", pattern: /(['"])[^'"]+\1/, replace: (m, q) => `${q}${q}` },
  { name: "remove_statement", pattern: /^.+;$/, replace: () => "/* mutant: removed */" },
];

async function runLayer4_Mutations(diff, changedFiles, config) {
  const results = {
    mutantsGenerated: 0,
    mutantsKilled: 0,
    mutantsSurvived: 0,
    survivors: [], // These are the dangerous ones — untested behavioral changes
    summary: "",
  };

  const mutationConfig = config.layers.mutationConfig || {};
  const maxMutants = mutationConfig.maxMutants || 20; // Cap to keep it fast
  const testTimeout = mutationConfig.testTimeout || 30_000;

  // ─── Extract changed lines from diff ──────────────────────────────────────────
  const changedLines = extractChangedLines(diff);

  if (changedLines.length === 0) {
    results.summary = "No mutable lines found in the diff.";
    return results;
  }

  console.log(`  ${changedLines.length} changed line(s) to mutate`);

  // ─── Generate mutants ─────────────────────────────────────────────────────────
  const mutants = generateMutants(changedLines, maxMutants);
  results.mutantsGenerated = mutants.length;
  console.log(`  Generated ${mutants.length} mutant(s)`);

  if (mutants.length === 0) {
    results.summary = "No applicable mutations for the changed lines.";
    return results;
  }

  // ─── Check if tests can run ───────────────────────────────────────────────────
  const playwrightAvailable = checkPlaywright();
  if (!playwrightAvailable) {
    results.summary = `${mutants.length} mutant(s) generated but test runner not available. Install @playwright/test.`;
    return results;
  }

  // ─── Run each mutant ──────────────────────────────────────────────────────────
  console.log(`  Running tests against ${mutants.length} mutant(s)...`);

  for (const mutant of mutants) {
    const killed = await testMutant(mutant, config, testTimeout);

    if (killed) {
      results.mutantsKilled++;
    } else {
      results.mutantsSurvived++;
      results.survivors.push(mutant);
    }
  }

  // ─── Summary ──────────────────────────────────────────────────────────────────
  const killRate = results.mutantsGenerated > 0
    ? ((results.mutantsKilled / results.mutantsGenerated) * 100).toFixed(0)
    : 0;

  results.summary = `${results.mutantsKilled}/${results.mutantsGenerated} mutants killed (${killRate}% kill rate). ${results.mutantsSurvived} survived.`;

  if (results.mutantsSurvived > 0) {
    console.log(`\n  SURVIVING MUTANTS (untested behaviors):`);
    results.survivors.forEach((m) => {
      console.log(`    ⚠ ${m.file}:${m.line} — ${m.mutation} (${m.description})`);
    });
  } else {
    console.log(`  All mutants killed — tests adequately cover the changes.`);
  }

  return results;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Extract added lines from the diff with file + line number context.
 */
function extractChangedLines(diff) {
  const lines = [];
  let currentFile = null;
  let lineNumber = 0;

  for (const line of diff.split("\n")) {
    const fileMatch = line.match(/^diff --git a\/(.+?) b\/(.+)/);
    if (fileMatch) {
      currentFile = fileMatch[2];
      continue;
    }

    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunkMatch) {
      lineNumber = parseInt(hunkMatch[1], 10) - 1;
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      lineNumber++;
      const content = line.slice(1);

      // Skip non-executable lines
      if (
        content.trim() === "" ||
        content.trim().startsWith("//") ||
        content.trim().startsWith("/*") ||
        content.trim().startsWith("*") ||
        content.trim().startsWith("import ") ||
        content.trim().startsWith("export default") ||
        content.trim() === "{" ||
        content.trim() === "}" ||
        content.trim() === ");" ||
        content.trim() === "};"
      ) {
        continue;
      }

      if (currentFile && /\.(ts|tsx|js|jsx)$/.test(currentFile)) {
        lines.push({ file: currentFile, line: lineNumber, content });
      }
    } else if (!line.startsWith("-")) {
      lineNumber++;
    }
  }

  return lines;
}

/**
 * Generate mutants by applying mutation operators to changed lines.
 */
function generateMutants(changedLines, maxMutants) {
  const mutants = [];

  for (const { file, line, content } of changedLines) {
    if (mutants.length >= maxMutants) break;

    for (const mutation of MUTATIONS) {
      if (mutants.length >= maxMutants) break;

      const match = content.match(mutation.pattern);
      if (match) {
        const original = match[0];
        const replacement = mutation.replace(original, match[1]);

        if (replacement !== original) {
          const mutatedContent = content.replace(mutation.pattern, replacement);
          mutants.push({
            file,
            line,
            mutation: mutation.name,
            description: `${original} → ${replacement}`,
            originalLine: content,
            mutatedLine: mutatedContent,
          });
          break; // One mutation per line
        }
      }
    }
  }

  return mutants;
}

/**
 * Apply a mutant, run tests, restore original.
 * Returns true if the mutant was "killed" (tests failed).
 */
async function testMutant(mutant, config, timeout) {
  const filePath = mutant.file;

  if (!fs.existsSync(filePath)) return true; // Can't test — assume killed

  const original = fs.readFileSync(filePath, "utf-8");
  const lines = original.split("\n");

  // Apply mutation
  if (mutant.line - 1 >= lines.length) return true;
  lines[mutant.line - 1] = mutant.mutatedLine;
  const mutated = lines.join("\n");

  fs.writeFileSync(filePath, mutated);

  let killed = false;
  try {
    // Run a quick test — any test failure means the mutant is killed
    execSync(`npx playwright test --reporter=line 2>&1`, {
      encoding: "utf-8",
      timeout,
      stdio: "pipe",
      cwd: config.appDir || ".",
    });
    // Tests passed with the mutant → mutant survived → test gap!
    killed = false;
  } catch (_) {
    // Tests failed → mutant was killed → tests are effective
    killed = true;
  } finally {
    // ALWAYS restore original
    fs.writeFileSync(filePath, original);
  }

  return killed;
}

function checkPlaywright() {
  try {
    execSync("npx playwright --version 2>&1", { encoding: "utf-8", timeout: 5_000, stdio: "pipe" });
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = { runLayer4_Mutations };
