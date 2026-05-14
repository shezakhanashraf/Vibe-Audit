const simpleGit = require("simple-git");
const fs = require("fs");

async function detectRemote() {
  const git = simpleGit();
  try {
    const remotes = await git.getRemotes();
    return remotes.length > 0;
  } catch (_) {
    return false;
  }
}

function shouldExcludeFile(filePath, config) {
  if (config.excludePaths.some((p) => filePath.includes(p))) return true;
  if (config.excludeExtensions.some((ext) => filePath.toLowerCase().endsWith(ext))) return true;
  return false;
}

async function getFilteredDiff(config) {
  const git = simpleGit();
  const baseRef = process.env.GITHUB_BASE_REF || "main";
  const hasRemote = await detectRemote();

  if (hasRemote) {
    try {
      await git.fetch("origin", baseRef);
    } catch (err) {
      console.log(`Warning: could not fetch origin/${baseRef}: ${err.message}`);
    }

    const nameOnly = await git.raw(["diff", "--name-only", `origin/${baseRef}...HEAD`]);
    const files = nameOnly
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean)
      .filter((f) => !shouldExcludeFile(f, config));

    if (files.length === 0) return { diff: "", files: [], source: "git" };

    const diff = await git.diff([`origin/${baseRef}...HEAD`, "--", ...files]);
    return { diff, files, source: "git" };
  }

  // Local fallback
  console.log("No git remote detected. Falling back to local diff file...");
  const localDiffPath = process.env.LOCAL_DIFF_PATH || "local-diff.patch";
  if (!fs.existsSync(localDiffPath)) {
    return { diff: "", files: [], source: "none" };
  }
  const content = fs.readFileSync(localDiffPath, "utf-8").trim();
  return {
    diff: content || "",
    files: content ? ["(from local-diff.patch)"] : [],
    source: "local",
  };
}

module.exports = { getFilteredDiff };
