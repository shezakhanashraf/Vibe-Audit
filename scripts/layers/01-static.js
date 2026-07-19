/**
 * Layer 1: Static Analysis
 *
 * Fast, deterministic, free. Runs in seconds.
 * Produces FACTS — not guesses.
 *
 * Signals:
 * - TypeScript compiler errors on changed/downstream files
 * - ESLint violations
 * - Dependency graph: which files import from changed files but weren't updated
 * - Export analysis: what was exported before vs after (interface contracts)
 * - Dead code detection in the diff
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

async function runLayer1_Static(diff, changedFiles, config) {
  const results = {
    tsc: null,
    eslint: null,
    depGraph: null,
    exportChanges: [],
    summary: { errors: 0, warnings: 0, brokenConsumers: 0 },
  };

  // ─── TypeScript ───────────────────────────────────────────────────────────────
  if (config.runTsc) {
    results.tsc = runTsc(config);
    if (results.tsc && !results.tsc.passed) {
      results.summary.errors += results.tsc.errors.length;
      // Filter to only errors in changed files or their consumers
      results.tsc.relevantErrors = results.tsc.errors.filter((e) =>
        changedFiles.some((f) => e.includes(f) || e.includes(path.basename(f)))
      );
      console.log(`  tsc: ${results.tsc.errors.length} error(s), ${results.tsc.relevantErrors.length} relevant to this diff`);
    } else if (results.tsc) {
      console.log("  tsc: passed");
    }
  }

  // ─── ESLint ───────────────────────────────────────────────────────────────────
  if (config.runEslint) {
    results.eslint = runEslint(config, changedFiles);
    if (results.eslint && !results.eslint.passed) {
      results.summary.errors += results.eslint.errors.length;
      console.log(`  eslint: ${results.eslint.errors.length} error(s)`);
    } else if (results.eslint) {
      console.log("  eslint: passed");
    }
  }

  // ─── Dependency Graph ─────────────────────────────────────────────────────────
  if (config.traceDeps) {
    results.depGraph = traceDepGraph(diff, changedFiles);
    if (results.depGraph) {
      const brokenCount = Object.values(results.depGraph).reduce(
        (sum, consumers) => sum + consumers.length,
        0
      );
      results.summary.brokenConsumers = brokenCount;
      console.log(`  dep-graph: ${brokenCount} potentially broken consumer(s)`);
    } else {
      console.log("  dep-graph: no unupdated consumers found");
    }
  }

  // ─── Export/Interface Change Detection ────────────────────────────────────────
  results.exportChanges = detectExportChanges(diff);
  if (results.exportChanges.length > 0) {
    console.log(`  exports: ${results.exportChanges.length} interface change(s) detected`);
  }

  return results;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function runTsc(config) {
  if (!fs.existsSync(config.tsconfigPath)) {
    console.log(`  tsc: skipped (${config.tsconfigPath} not found)`);
    return null;
  }
  try {
    execSync("npx tsc --noEmit --pretty false 2>&1", {
      encoding: "utf-8",
      timeout: 60_000,
      stdio: "pipe",
    });
    return { passed: true, errors: [], relevantErrors: [] };
  } catch (err) {
    const output = (err.stdout || "") + (err.stderr || "");
    const errors = output
      .split("\n")
      .filter((line) => line.includes("error TS"))
      .slice(0, 50);
    return { passed: false, errors, relevantErrors: [] };
  }
}

function runEslint(config, changedFiles) {
  const eslintConfigs = [
    ".eslintrc.js", ".eslintrc.json", ".eslintrc.yml", ".eslintrc.yaml",
    ".eslintrc", "eslint.config.js", "eslint.config.mjs",
  ];
  if (!eslintConfigs.some((f) => fs.existsSync(f))) {
    console.log("  eslint: skipped (no config found)");
    return null;
  }

  // Only lint changed files (faster + more relevant)
  const filesToLint = changedFiles
    .filter((f) => /\.(ts|tsx|js|jsx|mjs)$/.test(f))
    .filter((f) => fs.existsSync(f));

  if (filesToLint.length === 0) {
    return { passed: true, errors: [] };
  }

  try {
    execSync(`npx eslint ${filesToLint.join(" ")} --format compact --quiet 2>&1`, {
      encoding: "utf-8",
      timeout: 60_000,
      stdio: "pipe",
    });
    return { passed: true, errors: [] };
  } catch (err) {
    const output = (err.stdout || "") + (err.stderr || "");
    const errors = output
      .split("\n")
      .filter((line) => line.includes("Error"))
      .slice(0, 50);
    return { passed: false, errors };
  }
}

function traceDepGraph(diff, changedFiles) {
  const graph = {};

  for (const file of changedFiles) {
    if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue;

    const importers = findImporters(file);
    // Only flag consumers that were NOT in the changed files list
    const unupdatedImporters = importers.filter(
      (imp) => !changedFiles.includes(imp)
    );

    if (unupdatedImporters.length > 0) {
      graph[file] = unupdatedImporters;
    }
  }

  return Object.keys(graph).length > 0 ? graph : null;
}

function findImporters(targetFile, searchDir = ".") {
  const importers = [];
  const targetBase = targetFile.replace(/\.(ts|tsx|js|jsx)$/, "");

  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", ".next", "dist", "build", ".git", "coverage"].includes(entry.name)) continue;
        walk(full);
      } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) {
        try {
          const content = fs.readFileSync(full, "utf-8");
          const importPattern = /(?:import|require)\s*\(?\s*['"]([^'"]*?)['"]/g;
          let m;
          while ((m = importPattern.exec(content)) !== null) {
            const importPath = m[1];
            if (importPath.startsWith(".") || importPath.startsWith("@/")) {
              const normalized = importPath.replace("@/", "").replace(/\.(ts|tsx|js|jsx)$/, "");
              if (targetBase.endsWith(normalized) || targetFile.includes(normalized) || normalized.endsWith(path.basename(targetBase))) {
                importers.push(full);
                break; // only count once per file
              }
            }
          }
        } catch (_) {}
      }
    }
  };

  walk(searchDir);
  return importers;
}

/**
 * Detect changes to exported interfaces/types/functions in the diff.
 * These are contract changes that affect downstream consumers.
 */
function detectExportChanges(diff) {
  const changes = [];
  const lines = diff.split("\n");
  let currentFile = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const fileMatch = line.match(/^diff --git a\/(.+?) b\/(.+)/);
    if (fileMatch) {
      currentFile = fileMatch[2];
      continue;
    }

    // Detect removed exports (lines starting with -)
    if (line.startsWith("-") && !line.startsWith("---")) {
      const exportMatch = line.match(
        /^-\s*export\s+(?:interface|type|function|const|class|enum)\s+(\w+)/
      );
      if (exportMatch) {
        changes.push({
          file: currentFile,
          type: "removed_export",
          name: exportMatch[1],
          line: line.slice(1).trim(),
        });
      }

      // Detect renamed fields in interfaces/types
      const fieldMatch = line.match(/^-\s+(\w+)\s*[?:]?\s*:/);
      if (fieldMatch && currentFile) {
        // Check if next line adds a different field name
        const nextLine = lines[i + 1];
        if (nextLine && nextLine.startsWith("+")) {
          const newFieldMatch = nextLine.match(/^\+\s+(\w+)\s*[?:]?\s*:/);
          if (newFieldMatch && newFieldMatch[1] !== fieldMatch[1]) {
            changes.push({
              file: currentFile,
              type: "renamed_field",
              oldName: fieldMatch[1],
              newName: newFieldMatch[1],
            });
          }
        }
      }
    }
  }

  return changes;
}

module.exports = { runLayer1_Static };
