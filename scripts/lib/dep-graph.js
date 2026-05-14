const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Parse changed files from the diff to find which exports changed,
// then trace all files that import from those changed files.
// Uses a simple regex approach — no AST, works without extra deps.

function extractChangedFiles(diff) {
  const files = new Set();
  const lines = diff.split("\n");
  for (const line of lines) {
    const match = line.match(/^diff --git a\/(.+?) b\/(.+)/);
    if (match) files.add(match[2]);
  }
  return [...files];
}

function findImporters(targetFile, searchDir = ".", visited = new Set()) {
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
        if (visited.has(full)) continue;
        visited.add(full);
        try {
          const content = fs.readFileSync(full, "utf-8");
          // Match import/require statements that reference the target file
          const importPattern = new RegExp(
            `(?:import|require)\\s*\\(?\\s*['"]([^'"]*?)['"]`,
            "g"
          );
          let m;
          while ((m = importPattern.exec(content)) !== null) {
            const importPath = m[1];
            // Resolve relative imports
            if (importPath.startsWith(".") || importPath.startsWith("@/")) {
              const normalized = importPath
                .replace("@/", "")
                .replace(/\.(ts|tsx|js|jsx)$/, "");
              if (
                targetBase.endsWith(normalized) ||
                targetFile.includes(normalized) ||
                normalized.endsWith(path.basename(targetBase))
              ) {
                importers.push(full);
              }
            }
          }
        } catch (_) {
          // skip unreadable files
        }
      }
    }
  };

  walk(searchDir);
  return importers;
}

function traceDepGraph(diff, config) {
  if (!config.traceDeps) return null;

  const changedFiles = extractChangedFiles(diff);
  if (changedFiles.length === 0) return null;

  console.log("Tracing dependency graph...");

  const graph = {};
  for (const file of changedFiles) {
    // Only trace .ts/.tsx/.js/.jsx files
    if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue;

    const importers = findImporters(file);
    if (importers.length > 0) {
      graph[file] = importers;
      console.log(`  ${file} is imported by ${importers.length} file(s)`);
    }
  }

  if (Object.keys(graph).length === 0) return null;
  return graph;
}

function formatDepGraph(graph) {
  if (!graph) return "";

  const lines = ["--- BEGIN DEPENDENCY GRAPH (which files consume the changed files) ---"];
  for (const [changed, importers] of Object.entries(graph)) {
    lines.push(`\n${changed} is imported by:`);
    importers.forEach((imp) => lines.push(`  - ${imp}`));
  }
  lines.push("--- END DEPENDENCY GRAPH ---\n");
  lines.push(
    "The dependency graph above shows which files consume the changed files. " +
    "If a consumer was NOT updated in the diff but depends on a changed export, " +
    "it is likely broken. This is deterministic data, not a guess.\n"
  );
  return lines.join("\n");
}

module.exports = { traceDepGraph, formatDepGraph };
