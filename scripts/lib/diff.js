const simpleGit = require("simple-git");
const fs = require("fs");

function shouldExcludeFile(filePath, config) {
  if (config.excludePaths.some((p) => filePath.includes(p))) return true;
  if (config.excludeExtensions.some((ext) => filePath.toLowerCase().endsWith(ext))) return true;
  return false;
}

async function getFilteredDiff(config) {
  const git = simpleGit();
  const baseRef = process.env.GITHUB_BASE_REF || "main";

  // Try git remote diff first
  try {
    const remotes = await git.getRemotes();
    if (remotes.length > 0) {
      try { await git.fetch("origin", baseRef); } catch (_) {}

      const nameOnly = await git.raw([
        "diff",
        "--name-only",
        "origin/" + baseRef + "...HEAD"
      ]);

      const files = nameOnly
        .split("\n")
        .map(f => f.trim())
        .filter(Boolean)
        .filter(f => !shouldExcludeFile(f, config));

      if (files.length > 0) {
        const diff = await git.diff([
          "origin/" + baseRef + "...HEAD",
          "--",
          ...files
        ]);

        if (diff) return { diff, files, source: "git" };
      }
    }
  } catch (_) {}

  // Fallback to local patch file
  const localDiffPath = process.env.LOCAL_DIFF_PATH || "local-diff.patch";

  if (!fs.existsSync(localDiffPath)) {
    return { diff: "", files: [], source: "none" };
  }

  console.log("Reading diff from " + localDiffPath);

  const content = fs.readFileSync(localDiffPath, "utf-8").trim();
  const files = [];

  for (const line of content.split("\n")) {
    const match = line.match(/^diff --git a\/(.+?) b\/(.+)/);

    if (match && !shouldExcludeFile(match[2], config)) {
      files.push(match[2]);
    }
  }

  return { diff: content || "", files, source: "local" };
}

module.exports = { getFilteredDiff };
