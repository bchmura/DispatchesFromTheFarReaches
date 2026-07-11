const test = require("node:test");
const assert = require("node:assert/strict");
const { findMissingThumbnails } = require("../lib/validate-refs");

const refs = [
  { filename: "fog-01.jpg", category: "exposures", projectSlug: undefined, sourceFile: "a.md" },
  { filename: "porch.jpg", category: "family", projectSlug: undefined, sourceFile: "b.md" },
];

test("findMissingThumbnails returns refs with no matching thumbnail", () => {
  const hasThumbnail = (key) => key === "exposures/fog-01.jpg";
  const missing = findMissingThumbnails(refs, hasThumbnail);
  assert.equal(missing.length, 1);
  assert.equal(missing[0].filename, "porch.jpg");
});

test("findMissingThumbnails returns an empty array when every ref has a thumbnail", () => {
  const missing = findMissingThumbnails(refs, () => true);
  assert.deepEqual(missing, []);
});
