const fs = require("fs");
const { formatCoverageGaps } = require("./qure-sync");

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

/**
 * Render report for v3 multi-layer architecture.
 * Accepts either v2-style params or v3-style params.
 */
function renderReport(params) {
  // Detect v3 format (has signals object)
  if (params.signals) {
    return renderReportV3(params);
  }
  return renderReportV2(params);
}

// ─── V3 Report (Multi-Layer) ────────────────────────────────────────────────────

function renderReportV3({ analysis, signals, config, provider, model, elapsed }) {
  const { changedFiles, truncated } = signals;

  // Risk items
  const riskLines = analysis.risks.length
    ? analysis.risks.map((risk) => {
        const label = risk.risk_level === "CRITICAL" ? "CRITICAL"
                    : risk.risk_level === "HIGH" ? "HIGH RISK"
                    : risk.risk_level === "MEDIUM" ? "MEDIUM RISK"
                    : "LOW RISK";
        const confidence = typeof risk.confidence === "number"
          ? ` (confidence: ${risk.confidence}%)`
          : "";
        const sourceTag = risk.source === "qure" ? " [Qure flow]" : "";
        const evidenceTag = risk.evidence?.length
          ? `\n> Evidence: ${risk.evidence.join("; ")}`
          : "";
        const pagesTag = risk.affected_pages?.length
          ? `\n> Pages: ${risk.affected_pages.join(", ")}`
          : "";
        const fixTag = risk.fix_suggestion
          ? `\n> Fix: ${risk.fix_suggestion}`
          : "";
        return `**${label} — ${risk.flow || "unnamed flow"}**${confidence}${sourceTag}\n> ${risk.user_impact || risk.reasoning || "(no detail)"}${evidenceTag}${pagesTag}${fixTag}`;
      }).join("\n\n")
    : "_No behavioral risks identified._";

  // Layer summary
  const ls = analysis.layerSummary || {};
  const layerLines = [];
  layerLines.push(`| Layer | Result |`);
  layerLines.push(`|-------|--------|`);
  layerLines.push(`| Static Analysis | ${ls.staticErrors} error(s), ${ls.brokenConsumers} broken consumer(s) |`);
  if (ls.testsExecuted) {
    layerLines.push(`| Test Execution | ${ls.testsPassed} passed, ${ls.testsFailed} failed |`);
  } else {
    layerLines.push(`| Test Execution | skipped |`);
  }
  layerLines.push(`| Visual Regression | ${ls.visualRegressions || 0} regression(s) |`);
  if (ls.mutantsGenerated > 0) {
    const killRate = ls.mutantsGenerated > 0
      ? Math.round(((ls.mutantsGenerated - ls.mutantsSurvived) / ls.mutantsGenerated) * 100)
      : 0;
    layerLines.push(`| Mutation Testing | ${ls.mutantsSurvived}/${ls.mutantsGenerated} survived (${killRate}% kill rate) |`);
  } else {
    layerLines.push(`| Mutation Testing | skipped |`);
  }
  layerLines.push(`| Qure Coverage | ${ls.qureFlowsCovered} flow(s) protected |`);

  // Changed files
  const fileList = changedFiles.length
    ? changedFiles.map((f) => `- \`${f}\``).join("\n")
    : "_(none)_";

  const truncNote = truncated
    ? `\n> Note: diff was truncated to ${config.maxDiffChars.toLocaleString()} characters.\n`
    : "";

  // Test gaps
  const testGapSection = analysis.test_gaps?.length
    ? "\n### Test Gaps\n\n" + analysis.test_gaps.map(
        (g) => `- **${g.description}**\n  - Suggestion: ${g.suggestion}`
      ).join("\n")
    : "";

  // Coverage gaps (Qure suggestions)
  const coverageGapSection = analysis.coverageGaps?.length
    ? formatCoverageGaps(analysis.coverageGaps)
    : "";

  const report = `## Vibe Audit Report

**Detected intent:** ${analysis.intent}
**Evidence basis:** ${analysis.confidence_basis || "static analysis only"}
${truncNote}
### Layer Results

${layerLines.join("\n")}

### Changed files
${fileList}

### Risk Analysis

${riskLines}
${testGapSection}
${coverageGapSection}
---
*Analysis by ${provider}/${model} in ${elapsed}s. This report is advisory only.*`;

  writeReport(report);
}

// ─── V2 Report (Legacy — kept for backward compatibility) ───────────────────────

function renderReportV2({ analysis, changedFiles, truncated, maxDiffChars, handWrittenCount, qureTestCount, qureMetadata, coverageGaps, staticResults, depGraph, provider, model }) {
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
        const pagesTag = risk.affected_pages && risk.affected_pages.length > 0
          ? `\n> Pages: ${risk.affected_pages.join(", ")}`
          : "";
        const selectorsTag = risk.affected_selectors && risk.affected_selectors.length > 0
          ? `\n> Elements: \`${risk.affected_selectors.join("`, `")}\``
          : "";
        return `**${label} -- ${risk.flow || "unnamed flow"}**${confidence}${sourceTag}\n> ${risk.reasoning || "(no reasoning provided)"}${pagesTag}${selectorsTag}`;
      }).join("\n\n")
    : "_No behavioral risks identified._";

  const fileList = changedFiles.length
    ? changedFiles.map((f) => `- \`${f}\``).join("\n")
    : "_(none)_";

  const truncNote = truncated
    ? `\n> Note: diff was truncated to ${maxDiffChars.toLocaleString()} characters.\n`
    : "";

  const qureFlows = qureMetadata && qureMetadata.length > 0
    ? qureMetadata.filter((m) => m.flowName).map((m) => m.flowName)
    : [];

  const coverageLines = [
    `- Hand-written tests: ${handWrittenCount} file(s)`,
    `- Qure-generated tests: ${qureTestCount} file(s)` +
      (qureTestCount === 0
        ? " -- [set up Qure](https://www.jetbrains.com/qure/) to record user flows and strengthen coverage"
        : ""),
  ];

  if (qureFlows.length > 0) {
    coverageLines.push(`\n**Qure-protected flows:**`);
    qureFlows.forEach((flow) => coverageLines.push(`  - ${flow}`));
  }

  let staticSummary = "";
  if (staticResults && staticResults.length > 0) {
    const items = staticResults.map((r) => {
      if (r.passed) return `- ${r.tool}: passed`;
      return `- ${r.tool}: ${r.errors.length} error(s)`;
    });
    staticSummary = `\n### Static analysis\n${items.join("\n")}\n`;
  }

  let depSummary = "";
  if (depGraph) {
    const items = [];
    for (const [changed, importers] of Object.entries(depGraph)) {
      items.push(`- \`${changed}\` is imported by: ${importers.map((i) => `\`${i}\``).join(", ")}`);
    }
    depSummary = `\n### Dependency graph\n${items.join("\n")}\n`;
  }

  const gapSection = coverageGaps && coverageGaps.length > 0
    ? formatCoverageGaps(coverageGaps)
    : "";

  const report = `## Vibe Audit Report

**Detected intent:** ${analysis.intent}
${truncNote}
### Baseline coverage
${coverageLines.join("\n")}
${staticSummary}${depSummary}
### Changed files analyzed
${fileList}

### Risk Analysis

${riskLines}
${gapSection}
---
*Analysis by ${provider}/${model}. This report is advisory only. Human review is still required.*`;

  writeReport(report);
}

module.exports = { writeReport, gracefulExit, renderReport };
