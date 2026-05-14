const fs = require("fs");
const path = require("path");

function collectTests(dir, source) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(spec|test)\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) {
        results.push({
          filePath: full,
          source,
          content: fs.readFileSync(full, "utf-8"),
        });
      }
    }
  };
  walk(dir);
  return results;
}

function collectAllTests(config) {
  const qureTests = collectTests(config.qureTestDir, "qure");
  const qureFilePaths = new Set(qureTests.map((t) => t.filePath));

  const handWritten = collectTests(config.testDir, "hand-written")
    .filter((t) => !qureFilePaths.has(t.filePath));

  return { handWritten, qureTests };
}

function formatTestBlock(tests) {
  if (tests.length === 0) return "(none)";
  return tests.map((t) => `// FILE: ${t.filePath}\n${t.content}`).join("\n\n");
}

module.exports = { collectAllTests, formatTestBlock };
