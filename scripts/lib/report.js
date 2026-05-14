const fs = require("fs");

const REPORT_PATH = "vibe-audit-report.md";

function writeReport(body) {
  fs.writeFileSync(REPORT_PATH, body);
  console.log(body);
}

function gracefulExit(title, detail) {
  writeReport(`## Vibe Audit Report

**${title}**

${detail}

---
*This report is advisory only. Human review is still required.*`);
  process.exit(0);
}

function renderReport({ analysis, changedFiles, truncated, maxDiffChars, handWrittenCount, qureTestCount, staticResults, depGraph, provider, model }) {
  const riskLines = analysis.risks.length
    ? analysis.risks.map((risk) => {
        const label = risk.risk_level === "HIGH" ? "HIGH RISK"
                    : risk.risk_level === "MEDIUM" ? "MEDIUM RISK"
                    : "LOW RISK";
        const confidence = typeof risk.confidence === "number"
          ? ` (confidence: ${risk.confidence}%)`
          : "";
        const sourceTag = risk.source === "qure"
          ? " [Qure-recorded flow]"
          : "";
        return `**${label} -- ${risk.flow || "unnamed flow"}**${confidence}${sourceTag}\n> ${risk.reasoning || "(no reasoning provided)"}`;
      }).join("\n\n")
    : "_No behavioral risks identified._";

  const fileList = changedFiles.length
    ? changedFiles.map((f) => `- \`${f}\``).join("\n")
    : "_(none)_";

  const truncNote = truncated
    ? `\n> Note: diff was truncated to ${maxDiffChars.toLocaleString()} characters.\n`
    : "";

  // Test coverage
  const coverageLines = [
    `- Hand-written tests: ${handWrittenCount} file(s)`,
    `- Qure-generated tests: ${qureTestCount} file(s)` +
      (qureTestCount === 0
        ? " -- [set up Qure](https://www.jetbrains.com/qure/) to record user flows and strengthen coverage"
        : ""),
  ].join("\n");

  // Static analysis summary
  let staticSummary = "";
  if (staticResults && staticResults.length > 0) {
    const items = staticResults.map((r) => {
      if (r.passed) return `- ${r.tool}: passed`;
      return `- ${r.tool}: ${r.errors.length} error(s)`;
    });
    staticSummary = `\n### Static analysis\n${items.join("\n")}\n`;
  }

  // Dependency graph summary
  let depSummary = "";
  if (depGraph) {
    const items = [];
    for (const [changed, importers] of Object.entries(depGraph)) {
      items.push(`- \`${changed}\` is imported by: ${importers.map((i) => `\`${i}\``).join(", ")}`);
    }
    depSummary = `\n### Dependency graph\n${items.join("\n")}\n`;
  }

  const report = `## Vibe Audit Report

**Detected intent:** ${analysis.intent}
${truncNote}
### Baseline coverage
${coverageLines}
${staticSummary}${depSummary}
### Changed files analyzed
${fileList}

### Risk Analysis

${riskLines}

---
*Analysis by ${provider}/${model}. This report is advisory only. Human review is still required.*`;

  writeReport(report);
}

module.exports = { writeReport, gracefulExit, renderReport };
