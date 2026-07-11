# Photo Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let real photography flow into the site without committing originals to Git: authors drop full-resolution photos into a gitignored `photos-source/` folder, a local script generates period-treated thumbnails (committed to Git, built by the existing Eleventy passthrough copy) and extracts EXIF for display, and a second local script uploads privacy-scrubbed originals to S3/CloudFront for the true-color enlarged view.

**Architecture:** Small, independently testable Node modules under `scripts/photos/lib/` (category mapping, EXIF normalization, sharp-based treatments, vault content scanning, HTML rewriting) are composed by three thin CLI scripts (`thumbs.js`, `upload.js`, `publish.js`). Eleventy's config and templates are extended just enough to render the generated thumbnail + EXIF data and to link out to CloudFront — the existing passthrough-copy mechanism and build pipeline are otherwise untouched.

**Tech Stack:** Node 24 built-ins (`node:test`, `node:fs` recursive readdir, `node:child_process`), `sharp` (image resize/treatment), `exifr` (EXIF read), `exiftool-vendored` (in-place metadata strip/set without re-encoding), `gray-matter` (frontmatter parsing), AWS CLI (`aws s3 sync`, invoked as a subprocess — not an SDK dependency).

## Global Constraints

- Full-resolution originals live in `photos-source/` (gitignored) and are never committed.
- CloudFront URL shape: `https://<cdn-domain>/dispatchesfromthefarreaches/<category>/<filename>` — the `dispatchesfromthefarreaches` prefix is required because the CDN serves other projects too.
- Default visual treatment is `sepia`, applied to the generated thumbnail only; a post/Exposure Series can override it via a `photoTreatment` frontmatter field. The CloudFront-served large version always stays true color.
- No copy-before-editing step for metadata stripping — files in `photos-source/` are exports from elsewhere with an independent archival copy already kept, so the strip runs in place on them.
- Metadata handling on upload: strip `GPS*`, `SerialNumber`, `BodySerialNumber`, `LensSerialNumber`; set `Copyright`, `Artist`, `OwnerName` to `"Dispatches from the Far Reaches"`. Camera/lens/aperture/exposure/ISO/captured-date fields are left embedded (redundant with `_data/photoMeta.json` but harmless).
- CI (`.github/workflows/deploy.yml`) never touches `photos-source/` or AWS — all photo processing and upload happens locally, before a push.
- AWS credentials come from the local AWS CLI profile / environment variables — never written to any file in this repo, matching the credential-hygiene pattern already documented in `docs/site-integrations.md` for the DreamHost deploy key.
- Full spec: `docs/superpowers/specs/2026-07-11-photo-pipeline-design.md`.

---

### Task 1: Project setup — dependencies, gitignore, seed data files

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `_data/photoMeta.json`
- Modify: `_data/site.json`

**Interfaces:**
- Produces: npm scripts `photos:thumbs`, `photos:upload`, `photos:publish`, `test`; devDependencies `sharp`, `exifr`, `exiftool-vendored`, `gray-matter`; the global data key `site.photosCdnBase` (consumed by Task 8's template changes and Task 6's transform).

- [ ] **Step 1: Install the new dependencies**

Run:
```bash
npm install --save-dev sharp exifr exiftool-vendored gray-matter
```
Expected: `package.json` gains four new `devDependencies` entries and `package-lock.json` updates.

- [ ] **Step 2: Add npm scripts and replace the placeholder test script**

Edit `package.json`'s `"scripts"` block to:
```json
  "scripts": {
    "build": "eleventy && pagefind --site _site",
    "serve": "eleventy --serve",
    "test": "node --test scripts/photos/test/",
    "start": "npx @11ty/eleventy --serve",
    "photos:thumbs": "node scripts/photos/thumbs.js",
    "photos:upload": "node scripts/photos/upload.js",
    "photos:publish": "node scripts/photos/publish.js"
  },
```

- [ ] **Step 3: Gitignore the originals folder**

Edit `.gitignore` to add one line:
```
node_modules/
_site/
.superpowers/
/photos-source/
```

- [ ] **Step 4: Seed the EXIF sidecar data file**

Create `_data/photoMeta.json`:
```json
{}
```
This lets templates safely reference `photoMeta["<category>/<filename>"]` (Eleventy loads any `_data/*.json` file as global data keyed by filename) before the pipeline has ever run.

- [ ] **Step 5: Add the CDN base URL to site config**

Edit `_data/site.json`, adding a `photosCdnBase` field:
```json
{
  "title": "Dispatches from the Far Reaches",
  "footerCredit": "Research supported by the Miskatonic University Department of Unorthodox Sciences (Arkham, MA)",
  "url": "https://dispatchesfromthefarreaches.com",
  "description": "Field notes, journal entries, and dispatches from the far reaches.",
  "photosCdnBase": "https://REPLACE_WITH_CLOUDFRONT_DOMAIN.cloudfront.net/dispatchesfromthefarreaches"
}
```
**Manual follow-up (not automatable from here):** replace `REPLACE_WITH_CLOUDFRONT_DOMAIN.cloudfront.net` with your actual CloudFront distribution domain before relying on enlarged photo links in production.

- [ ] **Step 6: Verify the build still runs**

Run: `npx eleventy`
Expected: build completes with no errors (this task made no template/content changes yet, so output should be identical to before).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .gitignore _data/photoMeta.json _data/site.json
git commit -m "Add photo pipeline dependencies, npm scripts, and seed data files"
```

---

### Task 2: Shared category-mapping module

**Files:**
- Create: `scripts/photos/lib/categories.js`
- Modify: `eleventy.config.js:17-24` (the `flatCategoryDirs` literal)
- Test: `scripts/photos/test/categories.test.js`

**Interfaces:**
- Consumes: nothing (first module in the dependency chain).
- Produces: `FLAT_CATEGORY_DIRS` (object, vault dir name → slug), `SITE_CONTENT_ROOT` (string path), `PHOTOS_SOURCE_ROOT` (string, `"photos-source"`), `CDN_KEY_PREFIX` (string, `"dispatchesfromthefarreaches"`), `DEFAULT_TREATMENT` (string, `"sepia"`), `IMAGE_EXTENSIONS` (array of lowercase extensions with leading dot), `projectSlugFromPath(mdOrImagePath)` (returns parent directory basename), `photoMetaKey({category, projectSlug, filename})` (returns the `_data/photoMeta.json` key string), `resolveDestination(relativePath)` (maps a `photos-source/`-relative path to `{category, projectSlug?, filename, siteDir}`, throwing on an unrecognized category folder). Every later task in this plan imports from this file.

- [ ] **Step 1: Write the failing test**

Create `scripts/photos/test/categories.test.js`:
```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { photoMetaKey, projectSlugFromPath, FLAT_CATEGORY_DIRS } = require("../lib/categories");

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/photos/test/categories.test.js`
Expected: FAIL with `Cannot find module '../lib/categories'`.

- [ ] **Step 3: Write the module**

Create `scripts/photos/lib/categories.js`:
```js
const path = require("node:path");

const FLAT_CATEGORY_DIRS = {
  Professional: "professional",
  Philosophy: "philosophy",
  Exposures: "exposures",
  Family: "family",
  Fiction: "fiction",
  Misc: "misc",
};

const SITE_CONTENT_ROOT = path.join("DFTFR-Obsidian", "Website");
const PHOTOS_SOURCE_ROOT = "photos-source";
const CDN_KEY_PREFIX = "dispatchesfromthefarreaches";
const DEFAULT_TREATMENT = "sepia";
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

function projectSlugFromPath(mdOrImagePath) {
  return path.basename(path.dirname(mdOrImagePath));
}

function photoMetaKey({ category, projectSlug, filename }) {
  return projectSlug ? `${category}/${projectSlug}/${filename}` : `${category}/${filename}`;
}

const SITE_CATEGORY_DIRS = Object.fromEntries(
  Object.entries(FLAT_CATEGORY_DIRS).map(([dir, slug]) => [slug, dir])
);

function resolveDestination(relativePath) {
  const [category, ...rest] = relativePath.split(path.sep);
  if (category === "projects") {
    const [projectSlug, filename] = rest;
    return {
      category,
      projectSlug,
      filename,
      siteDir: path.join(SITE_CONTENT_ROOT, "Projects", projectSlug),
    };
  }
  const [filename] = rest;
  const siteDirName = SITE_CATEGORY_DIRS[category];
  if (!siteDirName) throw new Error(`Unknown photo category folder: ${category}`);
  return { category, filename, siteDir: path.join(SITE_CONTENT_ROOT, siteDirName) };
}

module.exports = {
  FLAT_CATEGORY_DIRS,
  SITE_CONTENT_ROOT,
  PHOTOS_SOURCE_ROOT,
  CDN_KEY_PREFIX,
  DEFAULT_TREATMENT,
  IMAGE_EXTENSIONS,
  projectSlugFromPath,
  photoMetaKey,
  resolveDestination,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/photos/test/categories.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Refactor `eleventy.config.js` to use the shared mapping**

Modify `eleventy.config.js`, replacing the inline `flatCategoryDirs` block (currently lines 17-24):
```js
  // Flat categories: one image folder per category, no per-post subfolders.
  const flatCategoryDirs = {
    Professional: "professional",
    Philosophy: "philosophy",
    Exposures: "exposures",
    Family: "family",
    Fiction: "fiction",
    Misc: "misc",
  };
```
with:
```js
  // Flat categories: one image folder per category, no per-post subfolders.
  // Shared with the photo pipeline scripts (scripts/photos/) so both sides
  // agree on the same category -> slug mapping.
  const { FLAT_CATEGORY_DIRS: flatCategoryDirs } = require("./scripts/photos/lib/categories");
```

- [ ] **Step 6: Verify the build still runs**

Run: `npx eleventy`
Expected: build completes with no errors, identical output to before (pure refactor, no behavior change).

- [ ] **Step 7: Commit**

```bash
git add scripts/photos/lib/categories.js scripts/photos/test/categories.test.js eleventy.config.js
git commit -m "Extract shared category/slug mapping into scripts/photos/lib/categories.js"
```

---

### Task 3: EXIF reader module

**Files:**
- Create: `scripts/photos/lib/exif.js`
- Test: `scripts/photos/test/exif.test.js`

**Interfaces:**
- Consumes: `exifr` (npm package installed in Task 1).
- Produces: `normalizeExifTags(raw)` (pure function, raw EXIF object → `{camera?, lens?, exposureTime?, aperture?, iso?, captured?}`, all fields optional strings/ISO-date-strings), `readCaptureMeta(filePath)` (async, reads a file's EXIF and returns the same normalized shape). Consumed by Task 9 (`thumbs.js`).

- [ ] **Step 1: Write the failing test**

Create `scripts/photos/test/exif.test.js`:
```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeExifTags } = require("../lib/exif");

test("normalizeExifTags returns {} for missing EXIF", () => {
  assert.deepEqual(normalizeExifTags(undefined), {});
});

test("normalizeExifTags builds camera from Make + Model", () => {
  const meta = normalizeExifTags({ Make: "Fujifilm", Model: "X100V" });
  assert.equal(meta.camera, "Fujifilm X100V");
});

test("normalizeExifTags formats a sub-second exposure time as a fraction", () => {
  const meta = normalizeExifTags({ ExposureTime: 1 / 125 });
  assert.equal(meta.exposureTime, "1/125s");
});

test("normalizeExifTags formats aperture and ISO", () => {
  const meta = normalizeExifTags({ FNumber: 4, ISO: 400 });
  assert.equal(meta.aperture, "f/4");
  assert.equal(meta.iso, "400");
});

test("normalizeExifTags prefers DateTimeOriginal over CreateDate", () => {
  const meta = normalizeExifTags({
    DateTimeOriginal: new Date("2025-06-10T05:40:00Z"),
    CreateDate: new Date("2025-06-11T00:00:00Z"),
  });
  assert.equal(meta.captured, "2025-06-10T05:40:00.000Z");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/photos/test/exif.test.js`
Expected: FAIL with `Cannot find module '../lib/exif'`.

- [ ] **Step 3: Write the module**

Create `scripts/photos/lib/exif.js`:
```js
const exifr = require("exifr");

function normalizeExifTags(raw) {
  if (!raw) return {};
  const meta = {};
  if (raw.Make || raw.Model) {
    meta.camera = [raw.Make, raw.Model].filter(Boolean).join(" ").trim();
  }
  if (raw.LensModel) meta.lens = raw.LensModel;
  if (raw.ExposureTime) {
    meta.exposureTime = raw.ExposureTime < 1
      ? `1/${Math.round(1 / raw.ExposureTime)}s`
      : `${raw.ExposureTime}s`;
  }
  if (raw.FNumber) meta.aperture = `f/${raw.FNumber}`;
  if (raw.ISO) meta.iso = String(raw.ISO);
  const captureDate = raw.DateTimeOriginal || raw.CreateDate;
  if (captureDate instanceof Date && !Number.isNaN(captureDate.getTime())) {
    meta.captured = captureDate.toISOString();
  }
  return meta;
}

async function readCaptureMeta(filePath) {
  const raw = await exifr.parse(filePath, {
    pick: ["Make", "Model", "LensModel", "ExposureTime", "FNumber", "ISO", "DateTimeOriginal", "CreateDate"],
  });
  return normalizeExifTags(raw);
}

module.exports = { normalizeExifTags, readCaptureMeta };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/photos/test/exif.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/photos/lib/exif.js scripts/photos/test/exif.test.js
git commit -m "Add EXIF normalization module for photo capture specs"
```

---

### Task 4: Visual treatment module

**Files:**
- Create: `scripts/photos/lib/treatment.js`
- Test: `scripts/photos/test/treatment.test.js`

**Interfaces:**
- Consumes: `sharp` (npm package installed in Task 1).
- Produces: `applyTreatment(sharpImage, treatmentName)` (takes a `sharp()` instance and one of `"sepia" | "bw" | "duotone-brass" | "darkened"`, returns the chained `sharp` instance; throws `Error` on an unrecognized name), `TREATMENTS` (a `Set` of the valid names). Consumed by Task 9 (`thumbs.js`).

- [ ] **Step 1: Write the failing test**

Create `scripts/photos/test/treatment.test.js`:
```js
const test = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");
const { applyTreatment } = require("../lib/treatment");

function swatch(r, g, b) {
  return sharp({ create: { width: 4, height: 4, channels: 3, background: { r, g, b } } });
}

test("bw treatment produces equal R/G/B channels", async () => {
  const { data } = await applyTreatment(swatch(200, 60, 40), "bw").raw().toBuffer({ resolveWithObject: true });
  assert.equal(data[0], data[1]);
  assert.equal(data[1], data[2]);
});

test("sepia treatment shifts toward warm brown tones", async () => {
  const { data } = await applyTreatment(swatch(150, 150, 150), "sepia").raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[0] > data[2], "red channel should exceed blue channel after sepia tint");
});

test("applyTreatment rejects an unknown treatment name", () => {
  assert.throws(() => applyTreatment(swatch(0, 0, 0), "vintage-polaroid"), /Unknown photo treatment/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/photos/test/treatment.test.js`
Expected: FAIL with `Cannot find module '../lib/treatment'`.

- [ ] **Step 3: Write the module**

Create `scripts/photos/lib/treatment.js`:
```js
const TREATMENTS = new Set(["sepia", "bw", "duotone-brass", "darkened"]);

function applyTreatment(image, treatmentName) {
  if (!TREATMENTS.has(treatmentName)) {
    throw new Error(`Unknown photo treatment: ${treatmentName}`);
  }
  switch (treatmentName) {
    case "bw":
      return image.greyscale().modulate({ brightness: 0.92 });
    case "sepia":
      return image
        .greyscale()
        .tint({ r: 112, g: 66, b: 20 })
        .modulate({ brightness: 0.95 });
    case "duotone-brass":
      return image
        .greyscale()
        .tint({ r: 168, g: 132, b: 74 })
        .modulate({ brightness: 0.9 });
    case "darkened":
      return image.modulate({ brightness: 0.75, saturation: 0.85 });
    default:
      throw new Error(`Unhandled photo treatment: ${treatmentName}`);
  }
}

module.exports = { applyTreatment, TREATMENTS };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/photos/test/treatment.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/photos/lib/treatment.js scripts/photos/test/treatment.test.js
git commit -m "Add sharp-based photo treatment module (sepia/bw/duotone-brass/darkened)"
```

---

### Task 5: Vault content-scan module

**Files:**
- Create: `scripts/photos/lib/content-scan.js`
- Test: `scripts/photos/test/content-scan.test.js`

**Interfaces:**
- Consumes: `gray-matter` (npm package installed in Task 1), `SITE_CONTENT_ROOT`/`DEFAULT_TREATMENT`/`projectSlugFromPath` from `./categories.js` (Task 2).
- Produces: `extractImageRefs({frontmatter, body, filePath})` (pure function → array of `{filename, category, projectSlug, treatment, kind, sourceFile}`), `scanVaultForImageRefs(rootDir)` (fs-walking wrapper, same return shape, flattened across all markdown files). Consumed by Task 9 (`thumbs.js`).

- [ ] **Step 1: Write the failing test**

Create `scripts/photos/test/content-scan.test.js`:
```js
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

test("extractImageRefs attaches the project slug for project journal entries", () => {
  const refs = extractImageRefs({
    frontmatter: { category: "projects" },
    body: "![Barometer](barometer.jpg)",
    filePath: "DFTFR-Obsidian/Website/Projects/weather-station/01-entry.md",
  });
  assert.equal(refs[0].projectSlug, "weather-station");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/photos/test/content-scan.test.js`
Expected: FAIL with `Cannot find module '../lib/content-scan'`.

- [ ] **Step 3: Write the module**

Create `scripts/photos/lib/content-scan.js`:
```js
const fs = require("node:fs");
const path = require("node:path");
const matter = require("gray-matter");
const { SITE_CONTENT_ROOT, DEFAULT_TREATMENT, projectSlugFromPath } = require("./categories");

const IMAGE_MARKDOWN_PATTERN = /!\[[^\]]*\]\(([^)\s]+)\)/g;

function extractImageRefs({ frontmatter, body, filePath }) {
  if (!frontmatter.category) return [];
  const category = String(frontmatter.category).toLowerCase();
  const treatment = frontmatter.photoTreatment || DEFAULT_TREATMENT;
  const projectSlug = category === "projects" ? projectSlugFromPath(filePath) : undefined;

  if (Array.isArray(frontmatter.exposures)) {
    return frontmatter.exposures
      .filter((exposure) => exposure.image)
      .map((exposure) => ({
        filename: exposure.image,
        category,
        projectSlug,
        treatment,
        kind: "exposure",
        sourceFile: filePath,
      }));
  }

  const refs = [];
  let match;
  IMAGE_MARKDOWN_PATTERN.lastIndex = 0;
  while ((match = IMAGE_MARKDOWN_PATTERN.exec(body))) {
    refs.push({
      filename: match[1],
      category,
      projectSlug,
      treatment,
      kind: "inline",
      sourceFile: filePath,
    });
  }
  return refs;
}

function findMarkdownFiles(rootDir) {
  return fs
    .readdirSync(rootDir, { recursive: true })
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => path.join(rootDir, entry));
}

function scanVaultForImageRefs(rootDir = SITE_CONTENT_ROOT) {
  return findMarkdownFiles(rootDir).flatMap((filePath) => {
    const { data: frontmatter, content: body } = matter(fs.readFileSync(filePath, "utf8"));
    return extractImageRefs({ frontmatter, body, filePath });
  });
}

module.exports = { extractImageRefs, findMarkdownFiles, scanVaultForImageRefs };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/photos/test/content-scan.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/photos/lib/content-scan.js scripts/photos/test/content-scan.test.js
git commit -m "Add vault content-scan module to locate photo references and their treatment"
```

---

### Task 6: Inline-photo HTML transform module

**Files:**
- Create: `scripts/photos/lib/inline-photo-transform.js`
- Test: `scripts/photos/test/inline-photo-transform.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `rewriteInlinePhotos(html, {category, cdnBase})` (pure string → string function), wired into `eleventy.config.js` within this same task (Step 5).

- [ ] **Step 1: Write the failing test**

Create `scripts/photos/test/inline-photo-transform.test.js`:
```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { rewriteInlinePhotos } = require("../lib/inline-photo-transform");

const opts = { category: "family", cdnBase: "https://cdn.example.com/dispatchesfromthefarreaches" };

test("wraps a bare-filename img in a link to the CloudFront full-size version", () => {
  const out = rewriteInlinePhotos('<img src="porch.jpg" alt="The porch">', opts);
  assert.equal(
    out,
    '<a href="https://cdn.example.com/dispatchesfromthefarreaches/family/porch.jpg" class="photo-link" target="_blank" rel="noopener"><img src="/family/porch.jpg" class="treated-photo" alt="The porch"></a>'
  );
});

test("leaves an already-absolute image path untouched", () => {
  const out = rewriteInlinePhotos('<img src="/assets/logo.svg" alt="logo">', opts);
  assert.equal(out, '<img src="/assets/logo.svg" alt="logo">');
});

test("leaves an external image URL untouched", () => {
  const out = rewriteInlinePhotos('<img src="https://example.com/x.jpg">', opts);
  assert.equal(out, '<img src="https://example.com/x.jpg">');
});

test("returns the input unchanged when no category is provided", () => {
  const html = '<img src="porch.jpg">';
  assert.equal(rewriteInlinePhotos(html, { cdnBase: opts.cdnBase }), html);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/photos/test/inline-photo-transform.test.js`
Expected: FAIL with `Cannot find module '../lib/inline-photo-transform'`.

- [ ] **Step 3: Write the module**

Create `scripts/photos/lib/inline-photo-transform.js`:
```js
const IMG_TAG_PATTERN = /<img src="([^"/][^"]*\.(?:jpe?g|png|gif|webp))"([^>]*)>/gi;

function rewriteInlinePhotos(html, { category, cdnBase }) {
  if (!category || !cdnBase) return html;
  return html.replace(IMG_TAG_PATTERN, (fullMatch, filename, restAttrs) => {
    const thumbSrc = `/${category}/${filename}`;
    const fullUrl = `${cdnBase}/${category}/${filename}`;
    return `<a href="${fullUrl}" class="photo-link" target="_blank" rel="noopener"><img src="${thumbSrc}" class="treated-photo"${restAttrs}></a>`;
  });
}

module.exports = { rewriteInlinePhotos };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/photos/test/inline-photo-transform.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Wire the transform into Eleventy**

Modify `eleventy.config.js`: add near the top (after the existing `const fs = require("node:fs");` / `const path = require("node:path");` lines) a new require, and after the passthrough-copy block (right after the `projectsDir` loop closes, before `eleventyConfig.addFilter("date", ...)`), register the transform:
```js
  const { rewriteInlinePhotos } = require("./scripts/photos/lib/inline-photo-transform");
  const siteData = JSON.parse(fs.readFileSync("_data/site.json", "utf8"));

  eleventyConfig.addTransform("photo-links", function (content, outputPath) {
    if (!outputPath || !outputPath.endsWith(".html")) return content;
    const category = this.category;
    if (!category) return content;
    return rewriteInlinePhotos(content, { category, cdnBase: siteData.photosCdnBase });
  });
```

- [ ] **Step 6: Verify the build still runs**

Run: `npx eleventy`
Expected: build completes with no errors. Since no post currently has an inline `![alt](filename)` image reference, output HTML is unchanged.

- [ ] **Step 7: Commit**

```bash
git add scripts/photos/lib/inline-photo-transform.js scripts/photos/test/inline-photo-transform.test.js eleventy.config.js
git commit -m "Add inline-photo HTML transform and wire it into the Eleventy build"
```

---

### Task 7: Build-time validation for missing thumbnails

**Files:**
- Create: `scripts/photos/lib/validate-refs.js`
- Test: `scripts/photos/test/validate-refs.test.js`
- Modify: `eleventy.config.js`

**Interfaces:**
- Consumes: `scanVaultForImageRefs`/`photoMetaKey` (Task 5/Task 2) — the same ref shape `{filename, category, projectSlug, treatment, kind, sourceFile}`.
- Produces: `findMissingThumbnails(refs, hasThumbnail)` (pure function — takes the refs array plus an injected `hasThumbnail(key)` predicate so it's testable without touching the filesystem — returns the array of refs with no matching entry). Wired into `eleventy.config.js` so a build fails loudly instead of silently shipping a 404, per the spec's error-handling requirement.

- [ ] **Step 1: Write the failing test**

Create `scripts/photos/test/validate-refs.test.js`:
```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/photos/test/validate-refs.test.js`
Expected: FAIL with `Cannot find module '../lib/validate-refs'`.

- [ ] **Step 3: Write the module**

Create `scripts/photos/lib/validate-refs.js`:
```js
const { photoMetaKey } = require("./categories");

function findMissingThumbnails(refs, hasThumbnail) {
  return refs.filter((ref) => !hasThumbnail(photoMetaKey(ref)));
}

module.exports = { findMissingThumbnails };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/photos/test/validate-refs.test.js`
Expected: PASS, 2 tests.

- [ ] **Step 5: Wire the validation into the Eleventy build**

Modify `eleventy.config.js`, adding this near the top of the exported async function (right after the `eleventyConfig.addWatchTarget(...)` line, before the RSS plugin registration), so it runs once per build before any templates render:
```js
  const { scanVaultForImageRefs } = require("./scripts/photos/lib/content-scan");
  const { findMissingThumbnails } = require("./scripts/photos/lib/validate-refs");
  const { photoMetaKey, SITE_CONTENT_ROOT } = require("./scripts/photos/lib/categories");

  {
    const photoMetaPath = "_data/photoMeta.json";
    const photoMeta = fs.existsSync(photoMetaPath)
      ? JSON.parse(fs.readFileSync(photoMetaPath, "utf8"))
      : {};
    const refs = scanVaultForImageRefs(SITE_CONTENT_ROOT);
    const missing = findMissingThumbnails(refs, (key) => Boolean(photoMeta[key]));
    if (missing.length) {
      const list = missing
        .map((ref) => `  - ${photoMetaKey(ref)} (referenced from ${ref.sourceFile})`)
        .join("\n");
      throw new Error(
        `Photo pipeline: ${missing.length} referenced photo(s) have no generated thumbnail yet. Run "npm run photos:thumbs" first:\n${list}`
      );
    }
  }
```
This means: as soon as a post references a photo (`image:` frontmatter field or inline `![]()`), the build fails with a clear message until `npm run photos:thumbs` has actually produced that thumbnail — no silent 404s. Posts with no photo reference at all (like today's two placeholder Exposure Series entries) are unaffected, since `scanVaultForImageRefs` only returns refs for photos a post explicitly claims to have.

- [ ] **Step 6: Verify the build still passes today**

Run: `npx eleventy`
Expected: build completes with no errors — `_data/photoMeta.json` is still `{}` and no post in the vault has an `image` field or inline `![]()` reference yet, so `scanVaultForImageRefs` returns an empty array and the check is a no-op.

- [ ] **Step 7: Verify the check actually fails when it should**

Run (PowerShell), as a throwaway smoke test:
```powershell
Add-Content "DFTFR-Obsidian/Website/Family/index.md" "`n![test](does-not-exist.jpg)"
npx eleventy
```
Expected: the build fails with the `Photo pipeline: 1 referenced photo(s) have no generated thumbnail yet...` error. Then revert the throwaway edit:
```powershell
git checkout -- "DFTFR-Obsidian/Website/Family/index.md"
```

- [ ] **Step 8: Commit**

```bash
git add scripts/photos/lib/validate-refs.js scripts/photos/test/validate-refs.test.js eleventy.config.js
git commit -m "Fail the build loudly when a post references a photo with no generated thumbnail"
```

---

### Task 8: Exposure Series template + CSS + example content update

**Files:**
- Modify: `_includes/exposure-series.njk`
- Modify: `assets/css/site.css`
- Modify: `DFTFR-Obsidian/Website/Exposures/coastal-fog-early-mornings.md`
- Modify: `DFTFR-Obsidian/Website/Exposures/the-backyard-observatory.md`

**Interfaces:**
- Consumes: global data `photoMeta` (from `_data/photoMeta.json`, Task 1) and `site.photosCdnBase` (Task 1).
- Produces: no new JS interfaces — this task is template/content only. No automated test (Nunjucks templates aren't unit-tested in this codebase); verified via `npx eleventy` + reading generated HTML, per this repo's stated convention (see `CLAUDE.md`).

- [ ] **Step 1: Update the Exposure Series template**

Modify `_includes/exposure-series.njk`, replacing the `{% for ex in exposures %}` loop body (currently lines 26-54) with:
```njk
    {% for ex in exposures %}
    {% set meta = photoMeta[category + "/" + ex.image] if ex.image else null %}
    <div class="plate">
      <button class="plate-open" data-dialog-target="dlg-{{ loop.index }}" aria-label="View capture details for Exposure {{ ex.num }}: {{ ex.title }}">
        {% if meta %}
        <img class="plate-media" src="/{{ category }}/{{ ex.image }}" alt="{{ ex.title }}">
        {% else %}
        <div class="plate-media" style="background:#0f1109;"></div>
        {% endif %}
      </button>
      <div class="plate-text">
        <div>
          <span class="plate-num">Exposure {{ ex.num }}</span>
          <h3>{{ ex.title }}</h3>
          <p>{{ ex.body }}</p>
        </div>
        <div class="plate-tags">{% for t in ex.tags %}<a href="#">{{ t }}</a>{% endfor %}</div>
      </div>
    </div>
    <dialog id="dlg-{{ loop.index }}" class="plate-dialog">
      <button class="dialog-close" data-dialog-close aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      {% if meta %}
      <img class="dialog-media" src="{{ site.photosCdnBase }}/{{ category }}/{{ ex.image }}" alt="{{ ex.title }}">
      {% else %}
      <div class="dialog-media" style="background:#0f1109;"></div>
      {% endif %}
      {% if meta %}
      <div class="dialog-specs">
        <div><span>Camera</span><b>{{ meta.camera }}</b></div>
        <div><span>Lens</span><b>{{ meta.lens }}</b></div>
        <div><span>Exposure</span><b>{{ meta.exposureTime }}</b></div>
        <div><span>Aperture</span><b>{{ meta.aperture }}</b></div>
        <div><span>ISO</span><b>{{ meta.iso }}</b></div>
        <div><span>Captured</span><b>{{ meta.captured }}</b></div>
      </div>
      {% endif %}
    </dialog>
    {% endfor %}
```
This preserves the existing placeholder look (solid `#0f1109` background, no specs row) for any exposure that has no `image` field or hasn't been processed by `photos:thumbs` yet — the thumbnail-and-specs path only activates once `photoMeta` actually has an entry for that photo.

- [ ] **Step 2: Add CSS for the new `<img>` elements**

Modify `assets/css/site.css`, adding two rules directly after the existing `.plate-media svg{...}` rule (line 338) and `.dialog-media svg{...}` rule (line 351) respectively:
```css
.plate-media img{width:100%;height:100%;display:block;object-fit:cover;}
```
```css
.dialog-media img{width:100%;height:100%;display:block;object-fit:cover;}
```

- [ ] **Step 3: Update the two example Exposure Series posts to the new frontmatter shape**

Modify `DFTFR-Obsidian/Website/Exposures/coastal-fog-early-mornings.md` frontmatter's `exposures` list, dropping the now-unused `camera`/`lens`/`exposureTime`/`aperture`/`iso`/`captured` fields (no `image` field is added, since no real photo file exists yet for this placeholder content — it will keep rendering the existing solid-background placeholder until someone drops a real photo into `photos-source/exposures/` and adds an `image:` field):
```yaml
exposures:
  - num: "I"
    title: "Nothing but Grey, and That's Fine"
    body: "First morning out. The fog never lifted, which turned out to be the actual subject rather than an obstacle to it."
    tags: ["coastal", "fog"]
  - num: "II"
    title: "A Gap in the Fog, for About Four Minutes"
    body: "The one morning the fog thinned enough to show the breakwater. Gone again before the light meter finished adjusting."
    tags: ["coastal", "fog"]
```

Modify `DFTFR-Obsidian/Website/Exposures/the-backyard-observatory.md` frontmatter's `exposures` list the same way:
```yaml
exposures:
  - num: "I"
    title: "First Light Test"
    body: "Checking the mount alignment before committing to anything longer than a thirty-second exposure."
    tags: ["astronomy", "alignment"]
  - num: "II"
    title: "The Waxing Gibbous, Slightly Overexposed"
    body: "Went two stops too bright chasing detail in the maria and lost the terminator entirely."
    tags: ["astronomy", "lunar"]
```

- [ ] **Step 4: Verify the build and inspect the output**

Run: `npx eleventy`
Expected: build completes with no errors.

Run (PowerShell): `Select-String -Path "_site/exposures/coastal-fog-early-mornings/index.html" -Pattern "plate-media"`
Expected: shows the `<div class="plate-media" style="background:#0f1109;">` placeholder markup (no `<img>` yet, since `_data/photoMeta.json` is still `{}` and neither post has an `image` field) — confirming the fallback path renders correctly and nothing is broken.

- [ ] **Step 5: Commit**

```bash
git add _includes/exposure-series.njk assets/css/site.css "DFTFR-Obsidian/Website/Exposures/coastal-fog-early-mornings.md" "DFTFR-Obsidian/Website/Exposures/the-backyard-observatory.md"
git commit -m "Drive Exposure Series capture specs from photoMeta.json instead of hand-typed frontmatter"
```

---

### Task 9: `thumbs.js` — treated-thumbnail + EXIF generation script

**Files:**
- Create: `scripts/photos/thumbs.js`
- Test: `scripts/photos/test/thumbs.test.js`

**Interfaces:**
- Consumes: `FLAT_CATEGORY_DIRS`/`SITE_CONTENT_ROOT`/`PHOTOS_SOURCE_ROOT`/`DEFAULT_TREATMENT`/`IMAGE_EXTENSIONS`/`photoMetaKey`/`resolveDestination` (Task 2), `scanVaultForImageRefs` (Task 5), `applyTreatment` (Task 4), `readCaptureMeta` (Task 3).
- Produces: `run()` (async, the full pipeline), `needsRegeneration(sourcePath, destPath)` (pure-ish mtime comparison). `run` is invoked by Task 11 (`publish.js`) and by `npm run photos:thumbs`.

- [ ] **Step 1: Write the failing test**

Create `scripts/photos/test/thumbs.test.js`:
```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/photos/test/thumbs.test.js`
Expected: FAIL with `Cannot find module '../thumbs'`.

- [ ] **Step 3: Write the script**

Create `scripts/photos/thumbs.js`:
```js
#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const {
  PHOTOS_SOURCE_ROOT,
  DEFAULT_TREATMENT,
  IMAGE_EXTENSIONS,
  photoMetaKey,
  resolveDestination,
} = require("./lib/categories");
const { scanVaultForImageRefs } = require("./lib/content-scan");
const { applyTreatment } = require("./lib/treatment");
const { readCaptureMeta } = require("./lib/exif");

const PHOTO_META_PATH = path.join("_data", "photoMeta.json");

function findSourceImages(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  return fs
    .readdirSync(rootDir, { recursive: true })
    .filter((entry) => IMAGE_EXTENSIONS.includes(path.extname(entry).toLowerCase()))
    .map((entry) => path.join(rootDir, entry));
}

function needsRegeneration(sourcePath, destPath) {
  if (!fs.existsSync(destPath)) return true;
  return fs.statSync(sourcePath).mtimeMs > fs.statSync(destPath).mtimeMs;
}

async function run() {
  const refs = scanVaultForImageRefs();
  const refsByKey = new Map(refs.map((ref) => [photoMetaKey(ref), ref]));

  const photoMeta = fs.existsSync(PHOTO_META_PATH)
    ? JSON.parse(fs.readFileSync(PHOTO_META_PATH, "utf8"))
    : {};

  const sourceImages = findSourceImages(PHOTOS_SOURCE_ROOT);
  let processed = 0;

  for (const sourcePath of sourceImages) {
    const relativePath = path.relative(PHOTOS_SOURCE_ROOT, sourcePath);
    const { category, projectSlug, filename, siteDir } = resolveDestination(relativePath);
    const key = photoMetaKey({ category, projectSlug, filename });
    const ref = refsByKey.get(key);
    const treatment = ref ? ref.treatment : DEFAULT_TREATMENT;
    const destPath = path.join(siteDir, filename);

    if (!ref) {
      console.warn(`No post references ${key} yet — processing with the default "${DEFAULT_TREATMENT}" treatment.`);
    }

    if (!needsRegeneration(sourcePath, destPath)) continue;

    fs.mkdirSync(siteDir, { recursive: true });
    await applyTreatment(sharp(sourcePath), treatment)
      .resize({ width: 640, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toFile(destPath);

    photoMeta[key] = { ...(await readCaptureMeta(sourcePath)), treatment };
    processed += 1;
  }

  fs.mkdirSync("_data", { recursive: true });
  fs.writeFileSync(PHOTO_META_PATH, JSON.stringify(photoMeta, null, 2) + "\n");
  console.log(`photos:thumbs — processed ${processed} photo(s), ${sourceImages.length} total in photos-source/.`);
}

module.exports = { run, needsRegeneration };

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/photos/test/thumbs.test.js`
Expected: PASS, 2 tests.

- [ ] **Step 5: Manually verify against a real photo**

Run (PowerShell):
```powershell
New-Item -ItemType Directory -Force photos-source/family
Copy-Item "<any real .jpg on your machine>" photos-source/family/test-photo.jpg
npm run photos:thumbs
```
Expected console output: a warning that no post references `family/test-photo.jpg` yet (expected, since it isn't referenced from any markdown), followed by `photos:thumbs — processed 1 photo(s), 1 total in photos-source/.` Then confirm `DFTFR-Obsidian/Website/Family/test-photo.jpg` exists and looks sepia-toned, and `_data/photoMeta.json` has a new `family/test-photo.jpg` entry with EXIF fields (if the source photo has any). Delete both the source and generated file afterward — this was just a smoke test, not real content:
```powershell
Remove-Item photos-source/family/test-photo.jpg
Remove-Item "DFTFR-Obsidian/Website/Family/test-photo.jpg"
```
Manually edit `_data/photoMeta.json` back to `{}` if this test added an entry.

- [ ] **Step 6: Commit**

```bash
git add scripts/photos/thumbs.js scripts/photos/test/thumbs.test.js
git commit -m "Add photos:thumbs script to generate treated thumbnails and extract EXIF"
```

---

### Task 10: `upload.js` — S3 sync + metadata scrub script

**Files:**
- Create: `scripts/photos/upload.js`
- Test: `scripts/photos/test/upload.test.js`

**Interfaces:**
- Consumes: `PHOTOS_SOURCE_ROOT`/`CDN_KEY_PREFIX`/`IMAGE_EXTENSIONS` (Task 2), `exiftool` from `exiftool-vendored` (Task 1), `PHOTOS_S3_BUCKET` environment variable (not committed anywhere — set locally by the operator).
- Produces: `run()` (async, strip-then-sync pipeline), `findSourceImages(rootDir)` (reused shape from Task 9, duplicated locally to keep this module standalone — see note below), `STRIP_AND_SET_TAGS` (object of exiftool tag names to values/`null`). Invoked by Task 11 (`publish.js`) and `npm run photos:upload`.

- [ ] **Step 1: Write the failing test**

Create `scripts/photos/test/upload.test.js`:
```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { findSourceImages, STRIP_AND_SET_TAGS } = require("../upload");

test("findSourceImages only picks up recognized image extensions", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "photos-upload-test-"));
  fs.writeFileSync(path.join(tmp, "a.jpg"), "x");
  fs.writeFileSync(path.join(tmp, "notes.txt"), "x");
  const found = findSourceImages(tmp).map((f) => path.basename(f));
  assert.deepEqual(found, ["a.jpg"]);
});

test("findSourceImages returns an empty array for a folder that doesn't exist yet", () => {
  assert.deepEqual(findSourceImages(path.join(os.tmpdir(), "does-not-exist-xyz")), []);
});

test("STRIP_AND_SET_TAGS clears GPS/serial fields and sets ownership fields to the site name", () => {
  assert.equal(STRIP_AND_SET_TAGS.GPSLatitude, null);
  assert.equal(STRIP_AND_SET_TAGS.SerialNumber, null);
  assert.equal(STRIP_AND_SET_TAGS.BodySerialNumber, null);
  assert.equal(STRIP_AND_SET_TAGS.LensSerialNumber, null);
  assert.equal(STRIP_AND_SET_TAGS.Copyright, "Dispatches from the Far Reaches");
  assert.equal(STRIP_AND_SET_TAGS.Artist, "Dispatches from the Far Reaches");
  assert.equal(STRIP_AND_SET_TAGS.OwnerName, "Dispatches from the Far Reaches");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/photos/test/upload.test.js`
Expected: FAIL with `Cannot find module '../upload'`.

- [ ] **Step 3: Write the script**

Create `scripts/photos/upload.js`:
```js
#!/usr/bin/env node
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { exiftool } = require("exiftool-vendored");
const { PHOTOS_SOURCE_ROOT, CDN_KEY_PREFIX, IMAGE_EXTENSIONS } = require("./lib/categories");

const SITE_NAME = "Dispatches from the Far Reaches";

const STRIP_AND_SET_TAGS = {
  GPSLatitude: null,
  GPSLongitude: null,
  GPSAltitude: null,
  GPSPosition: null,
  SerialNumber: null,
  BodySerialNumber: null,
  LensSerialNumber: null,
  Copyright: SITE_NAME,
  Artist: SITE_NAME,
  OwnerName: SITE_NAME,
};

function findSourceImages(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  return fs
    .readdirSync(rootDir, { recursive: true })
    .filter((entry) => IMAGE_EXTENSIONS.includes(path.extname(entry).toLowerCase()))
    .map((entry) => path.join(rootDir, entry));
}

async function stripSensitiveMetadata(files) {
  for (const file of files) {
    await exiftool.write(file, STRIP_AND_SET_TAGS, ["-overwrite_original"]);
  }
}

function syncToS3(bucket) {
  execFileSync(
    "aws",
    ["s3", "sync", PHOTOS_SOURCE_ROOT, `s3://${bucket}/${CDN_KEY_PREFIX}`, "--size-only"],
    { stdio: "inherit" }
  );
}

async function run() {
  const bucket = process.env.PHOTOS_S3_BUCKET;
  if (!bucket) {
    throw new Error("PHOTOS_S3_BUCKET environment variable is not set.");
  }
  const files = findSourceImages(PHOTOS_SOURCE_ROOT);
  console.log(`Stripping sensitive metadata from ${files.length} photo(s)...`);
  await stripSensitiveMetadata(files);
  await exiftool.end();
  console.log(`Syncing photos-source/ to s3://${bucket}/${CDN_KEY_PREFIX} ...`);
  syncToS3(bucket);
  console.log("Done.");
}

module.exports = { run, findSourceImages, STRIP_AND_SET_TAGS };

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/photos/test/upload.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/photos/upload.js scripts/photos/test/upload.test.js
git commit -m "Add photos:upload script to scrub sensitive metadata and sync to S3"
```

---

### Task 11: `publish.js` — combined thumbs + commit + upload + push

**Files:**
- Create: `scripts/photos/publish.js`

**Interfaces:**
- Consumes: `thumbs.js` and `upload.js` as subprocesses (Tasks 8-9).
- Produces: `run(commitMessage)` (async). No automated test — this is a thin orchestration wrapper around already-tested scripts plus `git`/`aws` subprocess calls with real side effects (commits, pushes); verified manually per Step 2 below rather than via `node --test`.

- [ ] **Step 1: Write the script**

Create `scripts/photos/publish.js`:
```js
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
```

- [ ] **Step 2: Manually verify the command is wired correctly (dry run of the wiring, not a real publish)**

Run: `node -e "require('./scripts/photos/publish.js'); console.log('publish.js loads and exports run()')"`
Expected output: `publish.js loads and exports run()` with no errors — confirms the module requires cleanly (this only checks that the file parses and its dependencies resolve; it does not execute `run()`, since that would commit/push for real). Actually running `npm run photos:publish` end-to-end should only be done deliberately by the site owner once real photos are ready to ship — note this in the docs update (Task 12).

- [ ] **Step 3: Commit**

```bash
git add scripts/photos/publish.js
git commit -m "Add photos:publish convenience script (thumbs, commit, upload, push)"
```

---

### Task 12: Documentation updates

**Files:**
- Modify: `docs/site-integrations.md`
- Modify: `docs/designSpecifications-updated.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Document the photo pipeline in `site-integrations.md`**

Add a new section to `docs/site-integrations.md`, after the "Favicons" section and before "Deployment — GitHub Actions → DreamHost":
```markdown
## Photo pipeline (S3 + CloudFront originals, treated thumbnails in Git)

- Full-resolution originals live in `photos-source/` at the repo root (gitignored, never
  committed), mirroring the site's category/slug layout: `photos-source/<category>/*.jpg` and
  `photos-source/projects/<slug>/*.jpg`.
- `npm run photos:thumbs` (local, no AWS needed) reads EXIF into `_data/photoMeta.json` and
  writes a treated thumbnail (default `sepia`; override per post via a `photoTreatment`
  frontmatter field) into the matching `DFTFR-Obsidian/Website/<Category>/` folder — the exact
  path the existing passthrough-copy rules in `eleventy.config.js` already serve, so no build
  config changes are needed as photos are added.
- `npm run photos:upload` scrubs sensitive EXIF fields (GPS, camera/lens serial numbers) from the
  files in `photos-source/` in place, sets `Copyright`/`Artist`/`OwnerName` to "Dispatches from
  the Far Reaches", and syncs them to
  `s3://$PHOTOS_S3_BUCKET/dispatchesfromthefarreaches/<category>/<filename>`. Requires the
  `PHOTOS_S3_BUCKET` environment variable and a working local AWS CLI profile — **AWS credentials
  are never stored in this repo**, same pattern as the DreamHost deploy key below.
- `npm run photos:publish` chains both scripts plus a git commit + push, for the "ready to ship"
  moment.
- The enlarged/full-size photo a reader sees on click is served from CloudFront at
  `_data/site.json`'s `photosCdnBase` + `/<category>/<filename>` — true color, untreated. Only
  the small thumbnail gets the sepia/B&W/etc. treatment.
- CI never touches `photos-source/` or AWS: the GitHub Actions build only ever sees what's
  already committed (the treated thumbnails + `_data/photoMeta.json`).
```

- [ ] **Step 2: Update the design spec's "Illustrations" note**

Modify `docs/designSpecifications-updated.md`, replacing the existing "Illustrations" bullet (the one starting "no photography/raster images are available in this environment...") with:
```markdown
- **Illustrations:** hand-authored inline SVG (brass/ink-green duotone) is still used for
  decorative marks (map fragments, compass roses, category glyphs, etc.). Real photography flows
  through the photo pipeline documented in `docs/site-integrations.md`: a treated thumbnail
  (default sepia, overridable per post via `photoTreatment` frontmatter) is committed to the repo
  and rendered inline; clicking it opens the true-color original from CloudFront. A post with no
  photo yet still falls back to the original placeholder treatment (SVG or a solid dark
  background) rather than a broken image.
```

- [ ] **Step 3: Commit**

```bash
git add docs/site-integrations.md docs/designSpecifications-updated.md
git commit -m "Document the photo pipeline in site-integrations.md and the design spec"
```
