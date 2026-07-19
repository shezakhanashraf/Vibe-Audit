/**
 * Layer 5: AI Synthesis
 *
 * This is where the LLM adds value — but DIFFERENTLY from before.
 *
 * Before (v2): LLM was given code and asked to GUESS what might break.
 * Now (v3): LLM is given FACTS from layers 1-4 and asked to SYNTHESIZE.
 *
 * The LLM receives:
 * - Static analysis errors (facts)
 * - Dependency graph showing broken consumers (facts)
 * - Test execution results: which passed, which failed (facts)
 * - Visual regression data (facts)
 * - Mutation testing survivors (facts)
 * - The diff itself (for understanding intent)
 * - Qure test metadata (what user flows are protected)
 *
 * Its job is to:
 * 1. Correlate signals across layers
 * 2. Determine which are real regressions vs intentional changes
 * 3. Rank by severity and user impact
 * 4. Explain in plain language what the user will see
 * 5. Suggest what to fix or what to test
 */

const path = require("path");
const { analyze } = require("../lib/providers");
const {
  autoDetectQureTests,
  extractQureMetadata,
  detectCoverageGaps,
  formatQureMetadataBlock,
} = require("../lib/qure-sync");

async function runLayer5_Synthesis(signals, config) {
  // ─── Collect Qure intelligence ────────────────────────────────────────────────
  let qureMetadata = [];
  if (config.qure?.extractMetadata) {
    const qureTests = autoDetectQureTests(config.qure.scanDirs || []);
    qureMetadata = qureTests.map((t) => extractQureMetadata(t));
  }

  // ─── Build the evidence brief ─────────────────────────────────────────────────
  const evidenceBrief = buildEvidenceBrief(signals, qureMetadata, config);

  // ─── Build the prompt ─────────────────────────────────────────────────────────
  const prompt = buildSynthesisPrompt(signals, evidenceBrief, config);
  const systemInstruction = buildSystemInstruction(signals);

  // ─── Call LLM ─────────────────────────────────────────────────────────────────
  let responseText;
  try {
    console.log(`  Synthesizing with ${config.provider}/${config.models[config.provider]}...`);
    responseText = await analyze(prompt, systemInstruction, config);
  } catch (err) {
    console.log(`  LLM call failed: ${err.message}`);
    return null;
  }

  // ─── Parse response ───────────────────────────────────────────────────────────
  let analysis;
  try {
    analysis = JSON.parse(responseText);
  } catch (err) {
    // Try to extract JSON from markdown-wrapped response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        analysis = JSON.parse(jsonMatch[0]);
      } catch (_) {
        console.log(`  Could not parse response: ${responseText.slice(0, 200)}`);
        return null;
      }
    } else {
      console.log(`  Could not parse response: ${responseText.slice(0, 200)}`);
      return null;
    }
  }

  if (!analysis || typeof analysis.intent !== "string" || !Array.isArray(analysis.risks)) {
    console.log(`  Unexpected response shape.`);
    return null;
  }

  // ─── Enrich with layer data ───────────────────────────────────────────────────
  analysis.layerSummary = {
    staticErrors: signals.static?.summary?.errors || 0,
    brokenConsumers: signals.static?.summary?.brokenConsumers || 0,
    testsExecuted: signals.testExecution?.executed || false,
    testsPassed: signals.testExecution?.passed?.length || 0,
    testsFailed: signals.testExecution?.failed?.length || 0,
    visualRegressions: signals.visual?.regressions?.length || 0,
    mutantsGenerated: signals.mutations?.mutantsGenerated || 0,
    mutantsSurvived: signals.mutations?.mutantsSurvived || 0,
    qureFlowsCovered: qureMetadata.filter((m) => m.flowName).length,
  };

  // Coverage gaps
  analysis.coverageGaps = detectCoverageGaps(
    qureMetadata,
    signals.changedFiles,
    signals.static?.depGraph
  );

  console.log(`  Synthesis complete: ${analysis.risks.length} risk(s) identified.`);
  return analysis;
}

// ─── Prompt Building ────────────────────────────────────────────────────────────

function buildEvidenceBrief(signals, qureMetadata, config) {
  const sections = [];

  // Static analysis evidence
  if (signals.static) {
    const s = signals.static;
    if (s.tsc && !s.tsc.passed && s.tsc.relevantErrors.length > 0) {
      sections.push(`STATIC ANALYSIS ERRORS (verified facts, not guesses):\n${s.tsc.relevantErrors.join("\n")}`);
    }
    if (s.depGraph) {
      const depLines = Object.entries(s.depGraph).map(
        ([file, consumers]) => `  ${file} → consumed by: ${consumers.join(", ")} (NOT updated in this PR)`
      );
      sections.push(`BROKEN DEPENDENCY CHAIN (deterministic — these consumers use old interfaces):\n${depLines.join("\n")}`);
    }
    if (s.exportChanges.length > 0) {
      const exportLines = s.exportChanges.map((e) => {
        if (e.type === "renamed_field") return `  ${e.file}: field "${e.oldName}" renamed to "${e.newName}"`;
        return `  ${e.file}: export "${e.name}" ${e.type}`;
      });
      sections.push(`INTERFACE/EXPORT CHANGES:\n${exportLines.join("\n")}`);
    }
  }

  // Test execution evidence
  if (signals.testExecution?.executed) {
    const te = signals.testExecution;
    if (te.failed.length > 0) {
      const failLines = te.failed.map(
        (f) => `  FAILED: ${f.testName} ${f.isQure ? "[Qure flow]" : ""}\n    Error: ${f.error.slice(0, 200)}`
      );
      sections.push(`TEST FAILURES (these tests broke with the current code):\n${failLines.join("\n")}`);
    }
    if (te.passed.length > 0) {
      const passLines = te.passed.map(
        (p) => `  PASSED: ${p.testName} ${p.isQure ? "[Qure flow]" : ""}`
      );
      sections.push(`TESTS THAT STILL PASS (these do NOT catch the behavioral change):\n${passLines.join("\n")}`);
    }
  } else if (signals.testExecution?.affectedTests?.length > 0) {
    const affected = signals.testExecution.affectedTests;
    const affectedLines = affected.map(
      (t) => `  ${t.testNames[0] || path.basename(t.filePath)} ${t.isQure ? "[Qure]" : ""} — affected because: ${t.affectedReason}`
    );
    sections.push(`AFFECTED TESTS (identified but not executed):\n${affectedLines.join("\n")}`);
  }

  // Visual regression evidence
  if (signals.visual?.regressions?.length > 0) {
    const visLines = signals.visual.regressions.map(
      (r) => `  ${r.page}: ${r.type} regression — ${r.detail}`
    );
    sections.push(`VISUAL REGRESSIONS DETECTED (screenshots/ARIA differ from baseline):\n${visLines.join("\n")}`);
  }

  // Mutation testing evidence
  if (signals.mutations?.survivors?.length > 0) {
    const mutLines = signals.mutations.survivors.map(
      (m) => `  ${m.file}:${m.line} — mutation "${m.description}" survived. No test catches this change.`
    );
    sections.push(`SURVIVING MUTANTS (proof that tests are blind to these changes):\n${mutLines.join("\n")}`);
  }

  // Qure coverage map
  if (qureMetadata.length > 0) {
    sections.push(formatQureMetadataBlock(qureMetadata));
  }

  return sections.join("\n\n");
}

function buildSynthesisPrompt(signals, evidenceBrief, config) {
  // Truncate diff for the prompt
  const diffForPrompt = signals.diff.length > 50_000
    ? signals.diff.slice(0, 50_000) + "\n...[truncated]..."
    : signals.diff;

  return `
You are synthesizing a behavioral regression report from MULTI-LAYER EVIDENCE.
Your job is NOT to guess — you have been given facts from automated analysis.
Correlate the evidence and produce a clear risk assessment.

═══ EVIDENCE FROM AUTOMATED LAYERS ═══

${evidenceBrief || "(No evidence collected beyond the diff — static-only mode)"}

═══ CODE DIFF ═══
${diffForPrompt}

═══ INSTRUCTIONS ═══

Based on the evidence above, produce JSON with this shape:
{
  "intent": "one sentence: what is this PR trying to do?",
  "confidence_basis": "which layers provided evidence (e.g., 'static + test execution + mutation testing')",
  "risks": [
    {
      "flow": "the user journey at risk (reference test names if available)",
      "risk_level": "CRITICAL | HIGH | MEDIUM | LOW",
      "confidence": <0-100>,
      "evidence": ["list of evidence sources supporting this risk"],
      "source": "hand-written | qure | inferred",
      "affected_pages": ["/page1", "/page2"],
      "affected_selectors": [".selector1", "#id2"],
      "user_impact": "what the user literally sees on screen (be specific)",
      "fix_suggestion": "what the developer should do to fix this"
    }
  ],
  "test_gaps": [
    {
      "description": "what behavior is not tested",
      "suggestion": "what test to write or record in Qure"
    }
  ]
}

CONFIDENCE CALIBRATION:
- 90-100: Multiple layers confirm (static error + test failure + visual regression)
- 70-89: Two layers confirm (e.g., broken dep graph + surviving mutant)
- 50-69: One layer confirms (e.g., static error in changed file, no test coverage)
- 30-49: Inferred from code pattern (no execution evidence)
- 0-29: Speculative (only diff reading, no supporting evidence)

RISK LEVELS:
- CRITICAL: Proven broken (test failed, visual regression confirmed, or static error in hot path)
- HIGH: Strong evidence of break (broken consumer + no test coverage, surviving mutant on critical path)
- MEDIUM: Moderate evidence (interface change with untested consumers)
- LOW: Weak evidence (pattern-based inference only)

RULES:
- NEVER assign confidence > 70 without evidence from at least one execution layer (tests, visual, mutations)
- If the only evidence is "reading the diff", max confidence is 50
- Reference specific test names, file paths, and selectors from the evidence
- Do NOT invent evidence that wasn't provided
- If evidence shows a test CATCHES the issue, it is NOT a risk (the safety net works)
- Focus on what PASSES the tests but BREAKS the user experience
- Keep user_impact to 1-2 sentences describing what the user literally sees
- Keep fix_suggestion actionable and specific
`.trim();
}

function buildSystemInstruction(signals) {
  const layers = ["static analysis"];
  if (signals.testExecution?.executed) layers.push("test execution results");
  if (signals.visual?.regressions) layers.push("visual regression data");
  if (signals.mutations?.mutantsGenerated > 0) layers.push("mutation testing results");

  return (
    "You are a behavioral regression synthesizer. " +
    `You have received evidence from ${layers.length} automated layer(s): ${layers.join(", ")}. ` +
    "Your role is to correlate this evidence into a clear risk report. " +
    "You do NOT guess — you reason over facts. " +
    "Evidence from execution layers (test results, screenshots, mutations) is stronger than static analysis. " +
    "Static analysis alone can only reach medium confidence. " +
    "Multiple corroborating signals = high confidence. " +
    "Respond with valid JSON only. No prose, no markdown fences."
  );
}

module.exports = { runLayer5_Synthesis };
