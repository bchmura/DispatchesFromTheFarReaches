const test = require("node:test");
const assert = require("node:assert/strict");
const { extractImageRefs } = require("../lib/content-scan");

test("extractImageRefs returns nothing for a post with no category", () => {
  assert.deepEqual(extractImageRefs({ frontmatter: {}, body: "![x](a.jpg)", filePath: "x.md" }), []);
});

test("extractImageRefs reads exposures[].image and defaults to the sepia treatment", () => {
  const refs = extractImageRefs({
    frontmatter: { category: "exposures", exposures: [{ image: "fog-01.jpg" }, { title: "no image" }] },
    body: "",
    filePath: "DFTFR-Obsidian/Website/Exposures/coastal.md",
  });
  assert.equal(refs.length, 1);
  assert.deepEqual(refs[0], {
    filename: "fog-01.jpg",
    category: "exposures",
    projectSlug: undefined,
    treatment: "sepia",
    kind: "exposure",
    sourceFile: "DFTFR-Obsidian/Website/Exposures/coastal.md",
  });
});

test("extractImageRefs honors a photoTreatment override", () => {
  const refs = extractImageRefs({
    frontmatter: { category: "exposures", photoTreatment: "bw", exposures: [{ image: "fog-01.jpg" }] },
    body: "",
    filePath: "coastal.md",
  });
  assert.equal(refs[0].treatment, "bw");
});

test("extractImageRefs scans inline markdown images in the body for non-exposure posts", () => {
  const refs = extractImageRefs({
    frontmatter: { category: "family" },
    body: "Some text.\n\n![The porch](porch.jpg)\n\nMore text ![Another](shed.png).",
    filePath: "DFTFR-Obsidian/Website/Family/porch-day.md",
  });
  assert.deepEqual(refs.map((r) => r.filename), ["porch.jpg", "shed.png"]);
});

test("extractImageRefs skips absolute-path image references and only picks up bare filenames", () => {
  const refs = extractImageRefs({
    frontmatter: { category: "family" },
    body: "![a](porch.jpg) and ![b](/family/legacy.jpg)",
    filePath: "DFTFR-Obsidian/Website/Family/porch-day.md",
  });
  assert.deepEqual(refs.map((r) => r.filename), ["porch.jpg"]);
});

test("extractImageRefs attaches the project slug for project journal entries", () => {
  const refs = extractImageRefs({
    frontmatter: { category: "projects" },
    body: "![Barometer](barometer.jpg)",
    filePath: "DFTFR-Obsidian/Website/Projects/weather-station/01-entry.md",
  });
  assert.equal(refs[0].projectSlug, "weather-station");
});
