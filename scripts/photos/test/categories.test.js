const test = require("node:test");
const assert = require("node:assert/strict");
const {
  photoMetaKey,
  projectSlugFromPath,
  categoryRefFromInputPath,
  isPipelineManagedFilename,
  FLAT_CATEGORY_DIRS,
} = require("../lib/categories");

test("FLAT_CATEGORY_DIRS maps every vault directory to a lowercase slug", () => {
  assert.equal(FLAT_CATEGORY_DIRS.Exposures, "exposures");
  assert.equal(FLAT_CATEGORY_DIRS.Family, "family");
});

test("photoMetaKey builds a flat category key with no project slug", () => {
  assert.equal(
    photoMetaKey({ category: "exposures", filename: "fog-01.jpg" }),
    "exposures/fog-01.jpg"
  );
});

test("photoMetaKey includes the project slug when present", () => {
  assert.equal(
    photoMetaKey({ category: "projects", projectSlug: "weather-station", filename: "barometer.jpg" }),
    "projects/weather-station/barometer.jpg"
  );
});

test("projectSlugFromPath returns the parent directory name", () => {
  const p = "DFTFR-Obsidian/Website/Projects/weather-station/01-entry.md";
  assert.equal(projectSlugFromPath(p), "weather-station");
});

test("resolveDestination maps a flat category path to its vault directory", () => {
  const { resolveDestination } = require("../lib/categories");
  const path = require("node:path");
  const result = resolveDestination(path.join("family", "porch.jpg"));
  assert.equal(result.category, "family");
  assert.equal(result.filename, "porch.jpg");
  assert.equal(result.siteDir, path.join("DFTFR-Obsidian", "Website", "Family"));
});

test("resolveDestination maps a projects path to its project subfolder", () => {
  const { resolveDestination } = require("../lib/categories");
  const path = require("node:path");
  const result = resolveDestination(path.join("projects", "weather-station", "barometer.jpg"));
  assert.equal(result.category, "projects");
  assert.equal(result.projectSlug, "weather-station");
  assert.equal(result.siteDir, path.join("DFTFR-Obsidian", "Website", "Projects", "weather-station"));
});

test("resolveDestination throws on an unrecognized category folder", () => {
  const { resolveDestination } = require("../lib/categories");
  const path = require("node:path");
  assert.throws(() => resolveDestination(path.join("not-a-category", "x.jpg")), /Unknown photo category folder/);
});

test("categoryRefFromInputPath resolves a flat category post", () => {
  const path = require("node:path");
  const p = path.join("DFTFR-Obsidian", "Website", "Family", "porch-day.md");
  assert.deepEqual(categoryRefFromInputPath(p), { category: "family" });
});

test("categoryRefFromInputPath resolves a Projects journal entry with its project slug", () => {
  const path = require("node:path");
  const p = path.join("DFTFR-Obsidian", "Website", "Projects", "weather-station", "01-entry.md");
  assert.deepEqual(categoryRefFromInputPath(p), { category: "projects", projectSlug: "weather-station" });
});

test("categoryRefFromInputPath returns {} for a path outside any known category", () => {
  const path = require("node:path");
  const p = path.join("DFTFR-Obsidian", "Website", "About", "index.md");
  assert.deepEqual(categoryRefFromInputPath(p), {});
});

test("isPipelineManagedFilename accepts a bare image filename", () => {
  assert.equal(isPipelineManagedFilename("porch.jpg"), true);
});

test("isPipelineManagedFilename rejects an absolute path", () => {
  assert.equal(isPipelineManagedFilename("/family/porch.jpg"), false);
});

test("isPipelineManagedFilename rejects a URL scheme", () => {
  assert.equal(isPipelineManagedFilename("https://example.com/x.jpg"), false);
});

test("isPipelineManagedFilename rejects a nested path", () => {
  assert.equal(isPipelineManagedFilename("sub/photo.jpg"), false);
});

test("isPipelineManagedFilename rejects a non-image extension", () => {
  assert.equal(isPipelineManagedFilename("diagram.svg"), false);
});
