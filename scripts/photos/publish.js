#!/usr/bin/env node
const { execFileSync } = require("node:child_process");

// `git diff --cached --quiet` exits 0 when nothing is staged, 1 when
// something is. Anything else (status >= 2, or no status at all) is a real
// git failure and should propagate, not be swallowed as "nothing staged".
function hasStagedChanges() {
  try {
    execFileSync("git", ["diff", "--cached", "--quiet"]);
    return false;
  } catch (err) {
    if (err.status === 1) return true;
    throw err;
  }
}

async function run(commitMessage = "Add/update photos") {
  execFileSync("node", ["scripts/photos/thumbs.js"], { stdio: "inherit" });
  execFileSync("git", ["add", "DFTFR-Obsidian/Website", "_data/photoMeta.json"], { stdio: "inherit" });
  if (hasStagedChanges()) {
    execFileSync("git", ["commit", "-m", commitMessage], { stdio: "inherit" });
  } else {
    console.log("Nothing new to commit (photos:thumbs made no changes) — skipping commit, continuing to upload.");
  }
  execFileSync("node", ["scripts/photos/upload.js"], { stdio: "inherit" });
  execFileSync("git", ["push"], { stdio: "inherit" });
}

module.exports = { run, hasStagedChanges };

if (require.main === module) {
  const commitMessage = process.argv[2];
  run(commitMessage).catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
