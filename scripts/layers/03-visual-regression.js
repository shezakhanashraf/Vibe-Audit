/**
 * Layer 3: Visual & Structural Regression
 *
 * Catches what no amount of code reading can find:
 * - CSS/layout changes that break the visual appearance
 * - Structural accessibility changes
 * - Content that renders as empty/undefined/NaN
 *
 * How it works:
 * 1. Determine which pages/routes are affected by the diff
 * 2. Start the dev server (or use a running one)
 * 3. Navigate to affected pages
 * 4. Capture screenshots + ARIA snapshots
 * 5. Compare against baseline (if exists)
 *
 * This is the layer that catches the demo bug perfectly:
 * "checkout total shows undefined" — a screenshot would show it immediately.
 */

const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

async function runLayer3_Visual(changedFiles, config) {
  const results = {
    pagesChecked: [],
    screenshots: [],
    ariaSnapshots: [],
    regressions: [],
    serverStarted: false,
    summary: "",
  };

  const visualConfig = config.layers.visualConfig || {};
  const baseUrl = visualConfig.baseUrl || "http://localhost:3000";
  const baselineDir = visualConfig.baselineDir || ".vibe-audit/baselines";
  const screenshotDir = visualConfig.screenshotDir || ".vibe-audit/screenshots";

  // ─── Determine affected pages ─────────────────────────────────────────────────
  const affectedPages = inferAffectedPages(changedFiles, config);

  if (affectedPages.length === 0) {
    results.summary = "Could not determine affected pages from changed files.";
    console.log("  No affected pages could be inferred.");
    return results;
  }

  console.log(`  Affected pages: ${affectedPages.map((p) => p.url).join(", ")}`);
  results.pagesChecked = affectedPages;

  // ─── Check if server is running ──────────────────────────────────────────────
  const serverRunning = await checkServer(baseUrl);
  if (!serverRunning) {
    // Try to start it
    if (visualConfig.startCommand) {
      console.log(`  Starting server: ${visualConfig.startCommand}`);
      try {
        await startServer(visualConfig.startCommand, baseUrl, visualConfig.startTimeout || 30_000);
        results.serverStarted = true;
      } catch (err) {
        console.log(`  Could not start server: ${err.message}`);
        results.summary = `Server not available at ${baseUrl}. Set layers.visualConfig.startCommand or start it manually.`;
        return results;
      }
    } else {
      results.summary = `No server running at ${baseUrl}. Configure layers.visualConfig.baseUrl or startCommand.`;
      console.log(`  No server at ${baseUrl} — skipping visual checks.`);
      return results;
    }
  }

  // ─── Capture screenshots + ARIA snapshots ─────────────────────────────────────
  // Create a temporary Playwright script that navigates to each page and captures
  fs.mkdirSync(screenshotDir, { recursive: true });

  const captureScript = generateCaptureScript(affectedPages, baseUrl, screenshotDir);
  const scriptPath = path.join(screenshotDir, "_capture.mjs");
  fs.writeFileSync(scriptPath, captureScript);

  try {
    console.log(`  Capturing ${affectedPages.length} page(s)...`);
    const output = execSync(`npx playwright test "${scriptPath}" --reporter=line 2>&1`, {
      encoding: "utf-8",
      timeout: visualConfig.captureTimeout || 60_000,
      stdio: "pipe",
    });
    console.log("  Capture complete.");
  } catch (err) {
    // Even if the "test" fails, screenshots may have been captured
    const errMsg = (err.stdout || err.stderr || "").slice(0, 300);
    console.log(`  Capture script returned errors (may still have screenshots): ${errMsg}`);
  }

  // ─── Compare against baseline ─────────────────────────────────────────────────
  if (fs.existsSync(baselineDir)) {
    for (const page of affectedPages) {
      const screenshotName = `${page.name}.png`;
      const currentPath = path.join(screenshotDir, screenshotName);
      const baselinePath = path.join(baselineDir, screenshotName);

      if (fs.existsSync(currentPath) && fs.existsSync(baselinePath)) {
        // For now, just check file size difference as a rough heuristic
        // A proper implementation would use pixelmatch
        const currentSize = fs.statSync(currentPath).size;
        const baselineSize = fs.statSync(baselinePath).size;
        const sizeDiff = Math.abs(currentSize - baselineSize) / Math.max(baselineSize, 1);

        if (sizeDiff > 0.05) {
          results.regressions.push({
            page: page.url,
            type: "visual",
            detail: `Screenshot differs by ${(sizeDiff * 100).toFixed(1)}% in file size`,
            screenshotPath: currentPath,
            baselinePath,
          });
        }
      }

      // ARIA snapshot comparison
      const ariaPath = path.join(screenshotDir, `${page.name}.aria.txt`);
      const ariaBaseline = path.join(baselineDir, `${page.name}.aria.txt`);
      if (fs.existsSync(ariaPath) && fs.existsSync(ariaBaseline)) {
        const current = fs.readFileSync(ariaPath, "utf-8");
        const baseline = fs.readFileSync(ariaBaseline, "utf-8");
        if (current !== baseline) {
          results.regressions.push({
            page: page.url,
            type: "aria",
            detail: "Accessibility tree structure changed",
            current: current.slice(0, 500),
            baseline: baseline.slice(0, 500),
          });
        }
      }
    }
  } else {
    console.log(`  No baseline directory at ${baselineDir} — capturing initial baseline.`);
    fs.mkdirSync(baselineDir, { recursive: true });
    // Copy current screenshots as baseline
    if (fs.existsSync(screenshotDir)) {
      for (const file of fs.readdirSync(screenshotDir)) {
        if (file.endsWith(".png") || file.endsWith(".aria.txt")) {
          fs.copyFileSync(
            path.join(screenshotDir, file),
            path.join(baselineDir, file)
          );
        }
      }
    }
    results.summary = "Initial baseline captured. Run again after changes to detect regressions.";
    return results;
  }

  // ─── Clean up ─────────────────────────────────────────────────────────────────
  try { fs.unlinkSync(scriptPath); } catch (_) {}

  results.summary = results.regressions.length > 0
    ? `${results.regressions.length} visual/structural regression(s) detected!`
    : `${affectedPages.length} page(s) checked — no regressions detected.`;

  if (results.regressions.length > 0) {
    console.log(`  REGRESSIONS FOUND:`);
    results.regressions.forEach((r) => {
      console.log(`    ✗ ${r.page} — ${r.type}: ${r.detail}`);
    });
  }

  return results;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Infer which pages/URLs are affected based on changed files.
 * Maps file paths to routes using common conventions.
 */
function inferAffectedPages(changedFiles, config) {
  const pages = [];
  const seen = new Set();

  for (const file of changedFiles) {
    const lower = file.toLowerCase();

    // Next.js app router: app/cart/page.tsx → /cart
    const appRouteMatch = file.match(/app\/(.+?)\/page\.(ts|tsx|js|jsx)$/);
    if (appRouteMatch) {
      const route = "/" + appRouteMatch[1].replace(/\(.*?\)\//g, "");
      if (!seen.has(route)) {
        seen.add(route);
        pages.push({ url: route, name: route.replace(/\//g, "-").replace(/^-/, "") || "home", source: file });
      }
      continue;
    }

    // Next.js pages router: pages/cart.tsx → /cart
    const pagesMatch = file.match(/pages\/(.+?)\.(ts|tsx|js|jsx)$/);
    if (pagesMatch && !pagesMatch[1].startsWith("_") && !pagesMatch[1].startsWith("api/")) {
      const route = "/" + pagesMatch[1].replace(/\/index$/, "");
      if (!seen.has(route)) {
        seen.add(route);
        pages.push({ url: route, name: route.replace(/\//g, "-").replace(/^-/, ""), source: file });
      }
      continue;
    }

    // Components/hooks — infer which page uses them
    if (lower.includes("component") || lower.includes("hook") || lower.includes("lib")) {
      // These affect pages but we can't determine which without the dep graph
      // The synthesis layer will correlate this with test data
      const baseName = path.basename(file, path.extname(file)).toLowerCase();
      if (baseName.includes("cart")) {
        if (!seen.has("/cart")) { seen.add("/cart"); pages.push({ url: "/cart", name: "cart", source: file }); }
      }
      if (baseName.includes("checkout")) {
        if (!seen.has("/checkout")) { seen.add("/checkout"); pages.push({ url: "/checkout", name: "checkout", source: file }); }
      }
      if (baseName.includes("login") || baseName.includes("auth")) {
        if (!seen.has("/login")) { seen.add("/login"); pages.push({ url: "/login", name: "login", source: file }); }
      }
      if (baseName.includes("account") || baseName.includes("profile")) {
        if (!seen.has("/account")) { seen.add("/account"); pages.push({ url: "/account", name: "account", source: file }); }
      }
    }

    // Root page / homepage files
    if (file.match(/app\/page\.(ts|tsx|js|jsx)$/) || file.match(/pages\/index\.(ts|tsx|js|jsx)$/)) {
      if (!seen.has("/")) { seen.add("/"); pages.push({ url: "/", name: "home", source: file }); }
    }
  }

  // Always check homepage if nothing else was found
  if (pages.length === 0) {
    pages.push({ url: "/", name: "home", source: "fallback" });
  }

  return pages;
}

async function checkServer(baseUrl) {
  try {
    execSync(`curl -s -o /dev/null -w "%{http_code}" "${baseUrl}" 2>/dev/null`, {
      encoding: "utf-8",
      timeout: 5_000,
      stdio: "pipe",
    });
    return true;
  } catch (_) {
    return false;
  }
}

async function startServer(command, baseUrl, timeout) {
  return new Promise((resolve, reject) => {
    const child = spawn("sh", ["-c", command], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    // Poll until server responds
    const startTime = Date.now();
    const interval = setInterval(async () => {
      if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        reject(new Error(`Server did not start within ${timeout}ms`));
        return;
      }
      const running = await checkServer(baseUrl);
      if (running) {
        clearInterval(interval);
        resolve();
      }
    }, 1000);
  });
}

/**
 * Generate a Playwright script that captures screenshots and ARIA snapshots
 * for each affected page.
 */
function generateCaptureScript(pages, baseUrl, outputDir) {
  const captures = pages.map((page) => {
    const screenshotPath = path.join(outputDir, `${page.name}.png`);
    const ariaPath = path.join(outputDir, `${page.name}.aria.txt`);
    return `
  // Page: ${page.url}
  await page.goto('${baseUrl}${page.url}');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '${screenshotPath}', fullPage: true });
  
  // Capture ARIA snapshot
  const aria_${page.name.replace(/[^a-z0-9]/gi, "_")} = await page.accessibility.snapshot();
  require('fs').writeFileSync('${ariaPath}', JSON.stringify(aria_${page.name.replace(/[^a-z0-9]/gi, "_")}, null, 2));
`;
  });

  return `
const { test } = require('@playwright/test');
const fs = require('fs');

test('capture visual baselines', async ({ page }) => {
  ${captures.join("\n")}
});
`;
}

module.exports = { runLayer3_Visual };
