const test = require("node:test");
const assert = require("node:assert/strict");
const { extractImageRefs } = require("../lib/content-scan");

test("extractImageRefs returns nothing for a file outside any category folder", () => {
  assert.deepEqual(extractImageRefs({ frontmatter: {}, body: "![x](a.jpg)", filePath: "x.md" }), []);
});

test("extractImageRefs reads exposures[].image, defaults to the sepia treatment, and attaches the series slug", () => {
  const refs = extractImageRefs({
    frontmatter: { exposures: [{ image: "fog-01.jpg" }, { title: "no image" }] },
    body: "",
    filePath: "DFTFR-Obsidian/Website/Exposures/coastal-series/index.md",
  });
  assert.equal(refs.length, 1);
  assert.deepEqual(refs[0], {
    filename: "fog-01.jpg",
    category: "exposures",
    projectSlug: "coastal-series",
    treatment: "sepia",
    kind: "exposure",
    sourceFile: "DFTFR-Obsidian/Website/Exposures/coastal-series/index.md",
    isDraft: false,
  });
});

test("extractImageRefs marks refs from a draft post as isDraft: true", () => {
  const refs = extractImageRefs({
    frontmatter: { isDraft: true },
    body: "![a](porch.jpg)",
    filePath: "DFTFR-Obsidian/Website/Family/porch-day.md",
  });
  assert.equal(refs[0].isDraft, true);
});

test("extractImageRefs honors a photoTreatment override", () => {
  const refs = extractImageRefs({
    frontmatter: { photoTreatment: "bw", exposures: [{ image: "fog-01.jpg" }] },
    body: "",
    filePath: "DFTFR-Obsidian/Website/Exposures/coastal-series/index.md",
  });
  assert.equal(refs[0].treatment, "bw");
});

test("extractImageRefs scans inline markdown images in the body for non-exposure posts", () => {
  const refs = extractImageRefs({
    frontmatter: {},
    body: "Some text.\n\n![The porch](porch.jpg)\n\nMore text ![Another](shed.png).",
    filePath: "DFTFR-Obsidian/Website/Family/porch-day.md",
  });
  assert.deepEqual(refs.map((r) => r.filename), ["porch.jpg", "shed.png"]);
});

test("extractImageRefs skips absolute-path image references and only picks up bare filenames", () => {
  const refs = extractImageRefs({
    frontmatter: {},
    body: "![a](porch.jpg) and ![b](/family/legacy.jpg)",
    filePath: "DFTFR-Obsidian/Website/Family/porch-day.md",
  });
  assert.deepEqual(refs.map((r) => r.filename), ["porch.jpg"]);
});

test("extractImageRefs skips a non-image extension and a nested path", () => {
  const refs = extractImageRefs({
    frontmatter: {},
    body: "![a](porch.jpg) ![b](diagram.svg) ![c](sub/photo.jpg)",
    filePath: "DFTFR-Obsidian/Website/Family/porch-day.md",
  });
  assert.deepEqual(refs.map((r) => r.filename), ["porch.jpg"]);
});

test("extractImageRefs throws a clear error naming the file when photoTreatment is invalid", () => {
  assert.throws(
    () =>
      extractImageRefs({
        frontmatter: { photoTreatment: "sepai" },
        body: "![a](porch.jpg)",
        filePath: "DFTFR-Obsidian/Website/Family/porch-day.md",
      }),
    /sepai.*DFTFR-Obsidian\/Website\/Family\/porch-day\.md/s
  );
});

test("extractImageRefs attaches the project slug for project journal entries", () => {
  const refs = extractImageRefs({
    frontmatter: {},
    body: "![Barometer](barometer.jpg)",
    filePath: "DFTFR-Obsidian/Website/Projects/weather-station/01-entry.md",
  });
  assert.equal(refs[0].projectSlug, "weather-station");
});

test("extractImageRefs derives category from the folder when frontmatter has no category", () => {
  const refs = extractImageRefs({
    frontmatter: { title: "Lean post" },
    body: "![porch](porch.jpg)",
    filePath: "DFTFR-Obsidian/Website/Family/porch-day.md",
  });
  assert.equal(refs.length, 1);
  assert.equal(refs[0].category, "family");
  assert.equal(refs[0].filename, "porch.jpg");
});
