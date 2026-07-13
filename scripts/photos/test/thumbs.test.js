const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { needsRegeneration, hasTreatmentChanged } = require("../thumbs");

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

test("hasTreatmentChanged is false when there is no existing photoMeta entry", () => {
  assert.equal(hasTreatmentChanged(undefined, "bw"), false);
});

test("hasTreatmentChanged is false when the treatment is unchanged", () => {
  assert.equal(hasTreatmentChanged({ treatment: "sepia" }, "sepia"), false);
});

test("hasTreatmentChanged is true when a photoTreatment override changes the recorded treatment", () => {
  assert.equal(hasTreatmentChanged({ treatment: "sepia" }, "bw"), true);
});

test("findSourceMedia picks up both images and videos, nothing else", () => {
  const { findSourceMedia } = require("../thumbs");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "photos-test-"));
  fs.writeFileSync(path.join(tmp, "a.jpg"), "x");
  fs.writeFileSync(path.join(tmp, "b.mp4"), "x");
  fs.writeFileSync(path.join(tmp, "notes.txt"), "x");
  const found = findSourceMedia(tmp).map((f) => path.basename(f)).sort();
  assert.deepEqual(found, ["a.jpg", "b.mp4"]);
});
