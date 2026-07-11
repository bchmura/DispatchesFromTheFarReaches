#!/usr/bin/env node
const { execFileSync } = require("node:child_process");

async function run(commitMessage = "Add/update photos") {
  execFileSync("node", ["scripts/photos/thumbs.js"], { stdio: "inherit" });
  execFileSync("git", ["add", "DFTFR-Obsidian/Website", "_data/photoMeta.json"], { stdio: "inherit" });
  execFileSync("git", ["commit", "-m", commitMessage], { stdio: "inherit" });
  execFileSync("node", ["scripts/photos/upload.js"], { stdio: "inherit" });
  execFileSync("git", ["push"], { stdio: "inherit" });
}

module.exports = { run };

if (require.main === module) {
  const commitMessage = process.argv[2];
  run(commitMessage).catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
