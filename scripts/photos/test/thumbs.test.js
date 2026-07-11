const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { needsRegeneration } = require("../thumbs");

test("needsRegeneration is true when the destination doesn't exist yet", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "photos-test-"));
  const source = path.join(tmp, "source.jpg");
  fs.writeFileSync(source, "x");
  assert.equal(needsRegeneration(source, path.join(tmp, "missing.jpg")), true);
});

test("needsRegeneration is false when the destination is newer than the source", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "photos-test-"));
  const source = path.join(tmp, "source.jpg");
  const dest = path.join(tmp, "dest.jpg");
  fs.writeFileSync(source, "x");
  fs.writeFileSync(dest, "y");
  const future = new Date(Date.now() + 5000);
  fs.utimesSync(dest, future, future);
  assert.equal(needsRegeneration(source, dest), false);
});
