# Video Support + Lightbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An mp4 dropped into `photos-source/` flows through the existing photo publish workflow (treated thumbnail committed, video uploaded to CloudFront); clicking its thumbnail plays it in a lightbox, photos outside Exposures adopt the same lightbox, and an Exposure Series entry can itself be a video that plays in the exposure page's existing stage.

**Architecture:** Extend the shared vocabulary in `scripts/photos/lib/categories.js` (video extensions, derived `*.mp4.jpg` thumbnail names), teach `thumbs.js`/`upload.js` to handle videos via `ffmpeg-static`, extend the `photo-links` HTML transform with lightbox markup rules, and add one native `<dialog>` lightbox partial + small vanilla JS file. Exposure pages get video fields computed by a new pure helper consumed by the `exposureEntries` collection.

**Tech Stack:** Node (CommonJS), Eleventy 3 / Nunjucks, sharp, exiftool-vendored, `ffmpeg-static` (new devDependency), `node --test` for tests, vanilla JS in the browser.

**Spec:** `docs/superpowers/specs/2026-07-13-video-lightbox-design.md` — read it first.

## Global Constraints

- **No external requests ever** — no CDN scripts/fonts/images; inline SVG or data-URI only. Media URLs use the already-configured CloudFront base (`_data/site.json` → `photosCdnBase`).
- **Single brass accent** (`--brass: #c19a4b`); vary by opacity/border, never new hues.
- **Respect `prefers-reduced-motion`** on every transition/animation.
- **Video thumbnails are named by appending `.jpg`** to the full video filename (`clip.mp4` → `clip.mp4.jpg`) — never by replacing the extension.
- **Exposures pages get no lightbox.** Inline photo refs on exposure posts keep the exact current `photo-link` markup. Video exposures play in the existing stage, `controls` only, **no autoplay**.
- **The lightbox autoplays** (the click is the play gesture) and its chrome is silent: a close "×" and aria-labels, no in-voice copy.
- **No-JS fallback:** every lightbox-triggering anchor keeps `href` to CloudFront + `target="_blank" rel="noopener"`.
- Tests run with `npm test` (`node --test scripts/photos/test/*.test.js`). Match the existing test style (`node:test`, `assert/strict`, `fs.mkdtempSync` temp dirs).
- Commit after each task; commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Video vocabulary in `categories.js`

**Files:**
- Modify: `scripts/photos/lib/categories.js`
- Test: `scripts/photos/test/categories.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces (added to the existing module.exports): `VIDEO_EXTENSIONS: string[]` (`[".mp4"]`), `isPipelineManagedVideoFilename(filename: string): boolean`, `videoThumbFilename(filename: string): string` (`"clip.mp4"` → `"clip.mp4.jpg"`). Every later task imports these from here.

- [ ] **Step 1: Write the failing tests** — append to `scripts/photos/test/categories.test.js`:

```js
test("isPipelineManagedVideoFilename accepts a bare mp4 filename", () => {
  const { isPipelineManagedVideoFilename } = require("../lib/categories");
  assert.equal(isPipelineManagedVideoFilename("clip.mp4"), true);
  assert.equal(isPipelineManagedVideoFilename("CLIP.MP4"), true);
});

test("isPipelineManagedVideoFilename rejects paths, URLs, and non-video extensions", () => {
  const { isPipelineManagedVideoFilename } = require("../lib/categories");
  assert.equal(isPipelineManagedVideoFilename("/family/clip.mp4"), false);
  assert.equal(isPipelineManagedVideoFilename("https://example.com/clip.mp4"), false);
  assert.equal(isPipelineManagedVideoFilename("sub/clip.mp4"), false);
  assert.equal(isPipelineManagedVideoFilename("porch.jpg"), false);
});

test("videoThumbFilename appends .jpg so it can never collide with a real photo", () => {
  const { videoThumbFilename } = require("../lib/categories");
  assert.equal(videoThumbFilename("clip.mp4"), "clip.mp4.jpg");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test scripts/photos/test/categories.test.js`
Expected: 3 failures, `isPipelineManagedVideoFilename is not a function`.

- [ ] **Step 3: Implement** — in `scripts/photos/lib/categories.js`, add below `IMAGE_EXTENSIONS`:

```js
const VIDEO_EXTENSIONS = [".mp4"];
```

Refactor `isPipelineManagedFilename` to share the bare-name check, and add the two new functions (keep the existing explanatory comment on `isPipelineManagedFilename`):

```js
function isBareFilename(filename) {
  return !(filename.startsWith("/") || filename.includes(":") || filename.includes("/"));
}

function isPipelineManagedFilename(filename) {
  return isBareFilename(filename) && IMAGE_EXTENSIONS.includes(path.extname(filename).toLowerCase());
}

// Same bare-filename rules as isPipelineManagedFilename, matched against
// video extensions instead — videos are pipeline-managed too (thumbnailed
// by thumbs.js, uploaded by upload.js), they just never land in the vault.
function isPipelineManagedVideoFilename(filename) {
  return isBareFilename(filename) && VIDEO_EXTENSIONS.includes(path.extname(filename).toLowerCase());
}

// A video's committed poster thumbnail appends .jpg to the FULL video
// filename (clip.mp4 -> clip.mp4.jpg) so it can never collide with a real
// photo named clip.jpg, and the mapping is derivable in both directions.
function videoThumbFilename(filename) {
  return `${filename}.jpg`;
}
```

Add `VIDEO_EXTENSIONS`, `isPipelineManagedVideoFilename`, and `videoThumbFilename` to `module.exports`.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all pass (the refactor must not break the existing `isPipelineManagedFilename` tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/photos/lib/categories.js scripts/photos/test/categories.test.js
git commit -m "Add video vocabulary to photo-pipeline categories lib"
```

---

### Task 2: `content-scan.js` recognizes inline video refs

**Files:**
- Modify: `scripts/photos/lib/content-scan.js`
- Test: `scripts/photos/test/content-scan.test.js`

**Interfaces:**
- Consumes: `isPipelineManagedVideoFilename` from Task 1.
- Produces: `extractImageRefs` now also returns refs for bare mp4 embeds (`![](clip.mp4)` / `![[clip.mp4]]`), same ref shape as images (`{filename, category, projectSlug, treatment, kind, sourceFile, isDraft}`). No new fields. Exposures-frontmatter refs already pass mp4 filenames through untouched (no extension check there) — no change to that branch.

Why this matters: refs drive two things — the treatment lookup in `thumbs.js` (keyed by `photoMetaKey`, which uses the *video* filename, e.g. `family/clip.mp4`) and the missing-thumbnail build gate in `eleventy.config.js` (`findMissingThumbnails` checks `photoMeta[key]`; Task 3 makes `thumbs.js` write video entries under those same keys).

- [ ] **Step 1: Write the failing tests** — append to `scripts/photos/test/content-scan.test.js`:

```js
test("extractImageRefs picks up a bare inline video embed", () => {
  const refs = extractImageRefs({
    frontmatter: {},
    body: "A short film.\n\n![The tide](clip.mp4)",
    filePath: "DFTFR-Obsidian/Website/Family/porch-day.md",
  });
  assert.deepEqual(refs.map((r) => r.filename), ["clip.mp4"]);
  assert.equal(refs[0].kind, "inline");
});

test("extractImageRefs still skips nested/absolute video paths and unknown extensions", () => {
  const refs = extractImageRefs({
    frontmatter: {},
    body: "![a](clip.mp4) ![b](/family/old.mp4) ![c](sub/clip.mp4) ![d](clip.mov)",
    filePath: "DFTFR-Obsidian/Website/Family/porch-day.md",
  });
  assert.deepEqual(refs.map((r) => r.filename), ["clip.mp4"]);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test scripts/photos/test/content-scan.test.js`
Expected: both new tests fail (0 refs found for mp4).

- [ ] **Step 3: Implement** — in `scripts/photos/lib/content-scan.js`, import `isPipelineManagedVideoFilename` alongside `isPipelineManagedFilename`, and change the inline-loop filter line to:

```js
    if (!isPipelineManagedFilename(filename) && !isPipelineManagedVideoFilename(filename)) continue;
```

Update the comment above it to say "image or video extension".

- [ ] **Step 4: Run the full suite**

Run: `npm test` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/photos/lib/content-scan.js scripts/photos/test/content-scan.test.js
git commit -m "content-scan recognizes inline video refs"
```

---

### Task 3: ffmpeg helpers + video thumbnails in `thumbs.js`

**Files:**
- Create: `scripts/photos/lib/video.js`
- Modify: `scripts/photos/thumbs.js`, `package.json` (via npm install)
- Test: `scripts/photos/test/video.test.js`, `scripts/photos/test/thumbs.test.js`

**Interfaces:**
- Consumes: `VIDEO_EXTENSIONS`, `videoThumbFilename` from Task 1.
- Produces: `scripts/photos/lib/video.js` exporting `extractVideoFrame(videoPath: string): string` (writes a poster PNG to a temp dir, returns its path; caller deletes it; throws if no frame could be extracted) and `remuxFaststart(videoPath: string): void` (lossless in-place `-c copy -movflags +faststart` remux — Task 4 uses this). `thumbs.js` exports `findSourceMedia` (replacing `findSourceImages`).

- [ ] **Step 1: Install ffmpeg-static**

Run: `npm install --save-dev ffmpeg-static`
Expected: `package.json` devDependencies gains `ffmpeg-static`; the install downloads a bundled ffmpeg binary (no admin rights, works in CI).

- [ ] **Step 2: Write the failing tests** — create `scripts/photos/test/video.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const ffmpegPath = require("ffmpeg-static");
const { extractVideoFrame, remuxFaststart } = require("../lib/video");

// Synthesizes a tiny real mp4 (2s of solid red) with the same bundled
// ffmpeg the lib uses, so these tests exercise the real binary end-to-end.
function makeTestVideo(seconds = 2) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "video-test-"));
  const out = path.join(dir, "clip.mp4");
  execFileSync(
    ffmpegPath,
    ["-y", "-f", "lavfi", "-i", `color=c=red:s=64x64:d=${seconds}`, "-pix_fmt", "yuv420p", out],
    { stdio: ["ignore", "ignore", "pipe"] }
  );
  return out;
}

test("extractVideoFrame writes a non-empty poster frame and returns its path", () => {
  const framePath = extractVideoFrame(makeTestVideo());
  assert.ok(fs.existsSync(framePath));
  assert.ok(fs.statSync(framePath).size > 0);
  fs.rmSync(framePath, { force: true });
});

test("extractVideoFrame falls back to frame 0 for a clip shorter than the 1s seek", () => {
  const framePath = extractVideoFrame(makeTestVideo(0.5));
  assert.ok(fs.existsSync(framePath));
  assert.ok(fs.statSync(framePath).size > 0);
  fs.rmSync(framePath, { force: true });
});

test("extractVideoFrame throws loudly on a file ffmpeg cannot read", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "video-test-"));
  const bogus = path.join(dir, "not-a-video.mp4");
  fs.writeFileSync(bogus, "definitely not mp4 bytes");
  assert.throws(() => extractVideoFrame(bogus), /poster frame/);
});

test("remuxFaststart rewrites the file in place and it remains readable", () => {
  const clip = makeTestVideo();
  remuxFaststart(clip);
  assert.ok(fs.statSync(clip).size > 0);
  // Round-trip: the remuxed file must still be a valid video ffmpeg can read.
  const framePath = extractVideoFrame(clip);
  assert.ok(fs.statSync(framePath).size > 0);
  fs.rmSync(framePath, { force: true });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `node --test scripts/photos/test/video.test.js`
Expected: FAIL — `Cannot find module '../lib/video'`.

- [ ] **Step 4: Implement `scripts/photos/lib/video.js`**

```js
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const ffmpegPath = require("ffmpeg-static");

function runFfmpeg(args) {
  execFileSync(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
}

// Grabs a poster frame ~1s in (input-side seek, so it's fast even on large
// files). A clip shorter than a second yields no output on that pass, so
// fall back to the very first frame before giving up. Returns the temp
// PNG's path; the caller is responsible for deleting it.
function extractVideoFrame(videoPath) {
  const outPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "video-frame-")), "frame.png");
  for (const seekArgs of [["-ss", "1"], []]) {
    try {
      runFfmpeg(["-y", ...seekArgs, "-i", videoPath, "-frames:v", "1", outPath]);
    } catch {
      // A failed pass falls through to the existence check below; only the
      // final throw reports the file as unreadable.
    }
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) return outPath;
  }
  throw new Error(`ffmpeg could not extract a poster frame from ${videoPath}`);
}

// Lossless remux that moves the moov atom to the front (faststart) so the
// browser can begin playback before the whole file has downloaded. Safe to
// re-run on every upload pass; replaces the file in place.
function remuxFaststart(videoPath) {
  const tmpPath = `${videoPath}.faststart.tmp.mp4`;
  try {
    runFfmpeg(["-y", "-i", videoPath, "-c", "copy", "-movflags", "+faststart", tmpPath]);
    fs.renameSync(tmpPath, videoPath);
  } finally {
    fs.rmSync(tmpPath, { force: true });
  }
}

module.exports = { extractVideoFrame, remuxFaststart };
```

- [ ] **Step 5: Run the video tests**

Run: `node --test scripts/photos/test/video.test.js` — Expected: 4 pass.

- [ ] **Step 6: Write the failing thumbs test** — append to `scripts/photos/test/thumbs.test.js`:

```js
test("findSourceMedia picks up both images and videos, nothing else", () => {
  const { findSourceMedia } = require("../thumbs");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "photos-test-"));
  fs.writeFileSync(path.join(tmp, "a.jpg"), "x");
  fs.writeFileSync(path.join(tmp, "b.mp4"), "x");
  fs.writeFileSync(path.join(tmp, "notes.txt"), "x");
  const found = findSourceMedia(tmp).map((f) => path.basename(f)).sort();
  assert.deepEqual(found, ["a.jpg", "b.mp4"]);
});
```

Run: `node --test scripts/photos/test/thumbs.test.js` — Expected: FAIL (`findSourceMedia` undefined).

- [ ] **Step 7: Implement video handling in `scripts/photos/thumbs.js`**

Add imports: `VIDEO_EXTENSIONS` and `videoThumbFilename` from `./lib/categories`, and `const { extractVideoFrame } = require("./lib/video");`.

Rename `findSourceImages` → `findSourceMedia` and widen its filter:

```js
const MEDIA_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS];

function findSourceMedia(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  return fs
    .readdirSync(rootDir, { recursive: true })
    .filter((entry) => MEDIA_EXTENSIONS.includes(path.extname(entry).toLowerCase()))
    .map((entry) => path.join(rootDir, entry));
}
```

In `run()`, replace the `findSourceImages` call with `findSourceMedia`, and inside the loop derive the destination through the video-aware name (the photoMeta key keeps the *video* filename, e.g. `family/clip.mp4` — it must match content-scan refs and exposure frontmatter):

```js
    const isVideo = VIDEO_EXTENSIONS.includes(path.extname(filename).toLowerCase());
    const destPath = path.join(siteDir, isVideo ? videoThumbFilename(filename) : filename);
```

And replace the thumbnail-writing block so a video's frame goes through the exact same treatment pipeline:

```js
    if (needsImage) {
      fs.mkdirSync(siteDir, { recursive: true });
      const pixelSource = isVideo ? extractVideoFrame(sourcePath) : sourcePath;
      await applyTreatment(sharp(pixelSource), treatment)
        .resize({ width: 640, withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toFile(destPath);
      if (isVideo) fs.rmSync(pixelSource, { force: true });
    }
```

Update `module.exports` (`findSourceMedia` in place of nothing — `findSourceImages` was not previously exported from thumbs.js, so only add) and the final `console.log` to say "media file(s)".

- [ ] **Step 8: Run the full suite**

Run: `npm test` — Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json scripts/photos/lib/video.js scripts/photos/thumbs.js scripts/photos/test/video.test.js scripts/photos/test/thumbs.test.js
git commit -m "thumbs.js generates treated poster thumbnails for mp4 sources via ffmpeg-static"
```

---

### Task 4: `upload.js` — strip video metadata + faststart remux

**Files:**
- Modify: `scripts/photos/upload.js`
- Test: `scripts/photos/test/upload.test.js`

**Interfaces:**
- Consumes: `VIDEO_EXTENSIONS` (Task 1), `remuxFaststart` (Task 3).
- Produces: `upload.js` additionally exports `findSourceVideos(rootDir): string[]` and `VIDEO_STRIP_AND_SET_TAGS: object`. `findSourceImages` keeps its current name/behavior (images only).

Videos get their own smaller tag set: image-only tags like `LensSerialNumber` aren't writable in mp4 and would make exiftool error; QuickTime videos carry location as `GPSCoordinates`, which images don't.

- [ ] **Step 1: Write the failing tests** — append to `scripts/photos/test/upload.test.js`:

```js
test("findSourceVideos picks up only video extensions", () => {
  const { findSourceVideos } = require("../upload");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "photos-upload-test-"));
  fs.writeFileSync(path.join(tmp, "a.jpg"), "x");
  fs.writeFileSync(path.join(tmp, "clip.mp4"), "x");
  const found = findSourceVideos(tmp).map((f) => path.basename(f));
  assert.deepEqual(found, ["clip.mp4"]);
});

test("VIDEO_STRIP_AND_SET_TAGS clears location fields and sets ownership to the site name", () => {
  const { VIDEO_STRIP_AND_SET_TAGS } = require("../upload");
  assert.equal(VIDEO_STRIP_AND_SET_TAGS.GPSLatitude, null);
  assert.equal(VIDEO_STRIP_AND_SET_TAGS.GPSLongitude, null);
  assert.equal(VIDEO_STRIP_AND_SET_TAGS.GPSAltitude, null);
  assert.equal(VIDEO_STRIP_AND_SET_TAGS.GPSCoordinates, null);
  assert.equal(VIDEO_STRIP_AND_SET_TAGS.Copyright, "Dispatches from the Far Reaches");
  assert.equal(VIDEO_STRIP_AND_SET_TAGS.Artist, "Dispatches from the Far Reaches");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test scripts/photos/test/upload.test.js` — Expected: 2 failures.

- [ ] **Step 3: Implement** — in `scripts/photos/upload.js`:

Add imports: `VIDEO_EXTENSIONS` from `./lib/categories`, `const { remuxFaststart } = require("./lib/video");`.

Add below `STRIP_AND_SET_TAGS`:

```js
// Videos get a smaller tag set: image-only tags (serial numbers, lens)
// aren't writable in mp4 and would make exiftool error out, while
// QuickTime files carry their location in GPSCoordinates instead.
const VIDEO_STRIP_AND_SET_TAGS = {
  GPSLatitude: null,
  GPSLongitude: null,
  GPSAltitude: null,
  GPSCoordinates: null,
  Copyright: SITE_NAME,
  Artist: SITE_NAME,
};

function findSourceVideos(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  return fs
    .readdirSync(rootDir, { recursive: true })
    .filter((entry) => VIDEO_EXTENSIONS.includes(path.extname(entry).toLowerCase()))
    .map((entry) => path.join(rootDir, entry));
}
```

Generalize the strip helper to take a tag set, and extend `run()` — metadata strip first, faststart remux as the last touch before sync:

```js
async function stripSensitiveMetadata(files, tags) {
  for (const file of files) {
    await exiftool.write(file, tags, ["-overwrite_original"]);
  }
}

async function run() {
  const bucket = process.env.PHOTOS_S3_BUCKET;
  if (!bucket) {
    throw new Error("PHOTOS_S3_BUCKET environment variable is not set.");
  }
  const images = findSourceImages(PHOTOS_SOURCE_ROOT);
  const videos = findSourceVideos(PHOTOS_SOURCE_ROOT);
  console.log(`Stripping sensitive metadata from ${images.length} photo(s) and ${videos.length} video(s)...`);
  await stripSensitiveMetadata(images, STRIP_AND_SET_TAGS);
  await stripSensitiveMetadata(videos, VIDEO_STRIP_AND_SET_TAGS);
  await exiftool.end();
  if (videos.length) {
    console.log(`Remuxing ${videos.length} video(s) for faststart playback...`);
    for (const video of videos) remuxFaststart(video);
  }
  console.log(`Syncing photos-source/ to s3://${bucket} ...`);
  syncToS3(bucket);
  console.log("Done.");
}
```

Add `findSourceVideos` and `VIDEO_STRIP_AND_SET_TAGS` to `module.exports`.

- [ ] **Step 4: Run the full suite**

Run: `npm test` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/photos/upload.js scripts/photos/test/upload.test.js
git commit -m "upload.js strips video metadata and remuxes mp4s for faststart"
```

---

### Task 5: Lightbox markup rules in the inline transform

**Files:**
- Modify: `scripts/photos/lib/inline-photo-transform.js`
- Test: `scripts/photos/test/inline-photo-transform.test.js`

**Interfaces:**
- Consumes: `isPipelineManagedVideoFilename`, `videoThumbFilename` (Task 1).
- Produces: three markup rules consumed by Task 6's `lightbox.js` (it binds to `a[data-lightbox]`) and Task 6's CSS (classes `video-link`, `has-play-badge`):
  1. Video ref (any category): `<a href="<cdn mp4>" class="photo-link video-link has-play-badge" data-lightbox="video" target="_blank" rel="noopener"><img src="/<path>/clip.mp4.jpg" class="treated-photo"...></a>`
  2. Image ref, category ≠ `exposures`: current anchor + ` data-lightbox="image"` after the class attribute.
  3. Image ref, category = `exposures`: byte-for-byte current markup.

- [ ] **Step 1: Update + add tests** — in `scripts/photos/test/inline-photo-transform.test.js`, the two existing exact-markup tests ("wraps a bare-filename img..." and "builds a project-nested URL...") gain ` data-lightbox="image"` immediately after `class="photo-link"` in their expected strings:

```js
    '<a href="https://cdn.example.com/family/porch.jpg" class="photo-link" data-lightbox="image" target="_blank" rel="noopener"><img src="/family/porch.jpg" class="treated-photo" alt="The porch"></a>'
```

```js
    '<a href="https://cdn.example.com/projects/weather-station/barometer.jpg" class="photo-link" data-lightbox="image" target="_blank" rel="noopener"><img src="/projects/weather-station/barometer.jpg" class="treated-photo" alt="Barometer"></a>'
```

Then append:

```js
test("wraps a bare video filename with lightbox video markup and the derived poster thumbnail", () => {
  const out = rewriteInlinePhotos('<img src="clip.mp4" alt="The tide">', opts);
  assert.equal(
    out,
    '<a href="https://cdn.example.com/family/clip.mp4" class="photo-link video-link has-play-badge" data-lightbox="video" target="_blank" rel="noopener"><img src="/family/clip.mp4.jpg" class="treated-photo" alt="The tide"></a>'
  );
});

test("exposure-category images keep the exact pre-lightbox markup", () => {
  const out = rewriteInlinePhotos(
    '<img src="fog-01.jpg" alt="Fog">',
    { category: "exposures", projectSlug: "coastal-series", cdnBase: opts.cdnBase }
  );
  assert.equal(
    out,
    '<a href="https://cdn.example.com/exposures/coastal-series/fog-01.jpg" class="photo-link" target="_blank" rel="noopener"><img src="/exposures/coastal-series/fog-01.jpg" class="treated-photo" alt="Fog"></a>'
  );
});

test("videos in the exposures category still get the lightbox (only images are carved out)", () => {
  const out = rewriteInlinePhotos(
    '<img src="clip.mp4">',
    { category: "exposures", projectSlug: "coastal-series", cdnBase: opts.cdnBase }
  );
  assert.match(out, /data-lightbox="video"/);
});
```

- [ ] **Step 2: Run to verify failures**

Run: `node --test scripts/photos/test/inline-photo-transform.test.js`
Expected: the two updated tests and the three new ones fail.

- [ ] **Step 3: Implement** — replace the pipeline-managed branch of `rewriteInlinePhotos` in `scripts/photos/lib/inline-photo-transform.js` (imports gain `isPipelineManagedVideoFilename`, `videoThumbFilename`):

```js
  return html.replace(IMG_TAG_PATTERN, (fullMatch, src, restAttrs) => {
    const isVideo = isPipelineManagedVideoFilename(src);
    if (isPipelineManagedFilename(src) || isVideo) {
      if (!category || !cdnBase) return fullMatch;
      const categoryPath = projectSlug ? `${category}/${projectSlug}` : category;
      const fullUrl = `${cdnBase}/${categoryPath}/${src}`;
      if (isVideo) {
        const thumbSrc = `/${categoryPath}/${videoThumbFilename(src)}`;
        return `<a href="${fullUrl}" class="photo-link video-link has-play-badge" data-lightbox="video" target="_blank" rel="noopener"><img src="${thumbSrc}" class="treated-photo"${restAttrs}></a>`;
      }
      const thumbSrc = `/${categoryPath}/${src}`;
      // Exposures keep their pre-lightbox behavior for photos by explicit
      // decision — the series/stage pages have their own viewing flow.
      const lightboxAttr = category === "exposures" ? "" : ' data-lightbox="image"';
      return `<a href="${fullUrl}" class="photo-link"${lightboxAttr} target="_blank" rel="noopener"><img src="${thumbSrc}" class="treated-photo"${restAttrs}></a>`;
    }
    if (!isExternalOrAbsolute(src) && pageInputPath) {
      const resolved = path.resolve(path.dirname(pageInputPath), src);
      const siteUrl = siteUrlForVaultImage(resolved);
      if (siteUrl) return `<img src="${siteUrl}"${restAttrs}>`;
    }
    return fullMatch;
  });
```

- [ ] **Step 4: Run the full suite**

Run: `npm test` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/photos/lib/inline-photo-transform.js scripts/photos/test/inline-photo-transform.test.js
git commit -m "Inline transform emits lightbox markup for videos and non-exposure photos"
```

---

### Task 6: The lightbox itself (partial + JS + CSS)

**Files:**
- Create: `_includes/partials/lightbox.njk`, `assets/js/lightbox.js`
- Modify: `_includes/base.njk`, `assets/css/site.css`

**Interfaces:**
- Consumes: `a[data-lightbox="video"|"image"]` anchors and classes `video-link` / `has-play-badge` from Task 5. Task 8 reuses `has-play-badge` on exposure-grid frames.
- Produces: a site-wide `<dialog id="lightbox">` and its behavior. No template exposes new data.

- [ ] **Step 1: Create `_includes/partials/lightbox.njk`**

```html
<dialog class="lightbox" id="lightbox" aria-label="Enlarged media">
  <button class="lightbox-close" type="button" aria-label="Close">&times;</button>
  <div class="lightbox-content"></div>
</dialog>
```

- [ ] **Step 2: Create `assets/js/lightbox.js`**

```js
// Opens pipeline-managed media (a[data-lightbox]) in a native <dialog>
// instead of a new tab. Without JS — or in a browser without showModal —
// the anchors keep working as plain CloudFront links in a new tab.
(() => {
  const dialog = document.getElementById("lightbox");
  if (!dialog || typeof dialog.showModal !== "function") return;
  const content = dialog.querySelector(".lightbox-content");

  document.addEventListener("click", (e) => {
    // Modified clicks (new-tab intent) keep their native behavior.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest("a[data-lightbox]");
    if (!link) return;
    e.preventDefault();
    content.replaceChildren();
    if (link.dataset.lightbox === "video") {
      const video = document.createElement("video");
      video.controls = true;
      video.autoplay = true;
      video.src = link.href;
      content.appendChild(video);
    } else {
      const img = document.createElement("img");
      img.src = link.href;
      img.alt = link.querySelector("img")?.alt || "";
      content.appendChild(img);
    }
    dialog.showModal();
  });

  dialog.querySelector(".lightbox-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => {
    // A click on the dialog element itself (not its children) is the backdrop.
    if (e.target === dialog) dialog.close();
  });
  // Esc closes via the native dialog cancel path; emptying the content on
  // every close is what actually stops video playback.
  dialog.addEventListener("close", () => content.replaceChildren());
})();
```

- [ ] **Step 3: Wire into `_includes/base.njk`** — after the footer include, alongside the existing scripts:

```html
{% include "partials/footer.njk" %}
{% include "partials/lightbox.njk" %}
<script src="/assets/js/callout-fold.js"></script>
<script src="/assets/js/mermaid-render.js"></script>
<script src="/assets/js/lightbox.js"></script>
```

- [ ] **Step 4: Add CSS to `assets/css/site.css`** (append as a new commented section; palette vars already exist):

```css
/* ---- Lightbox (videos site-wide; photos outside Exposures) ---- */
dialog.lightbox {
  padding: 0;
  border: 1px solid var(--brass-dim);
  background: var(--bg-raised);
  max-width: min(92vw, 1280px);
  max-height: 92vh;
}
dialog.lightbox::backdrop { background: rgba(10, 11, 8, 0.82); }
dialog.lightbox .lightbox-content img,
dialog.lightbox .lightbox-content video {
  display: block;
  max-width: min(92vw, 1280px);
  max-height: 92vh;
}
.lightbox-close {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  width: 32px;
  height: 32px;
  background: rgba(20, 21, 15, 0.72);
  border: 1px solid var(--brass-dim);
  color: var(--ink);
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
}
.lightbox-close:hover, .lightbox-close:focus-visible { color: var(--brass); border-color: var(--brass); }
@media (prefers-reduced-motion: no-preference) {
  dialog.lightbox[open] { animation: lightboxFade 0.18s ease-out; }
  @keyframes lightboxFade { from { opacity: 0; } to { opacity: 1; } }
}

/* ---- Play badge for video thumbnails (inline embeds + exposure grid) ---- */
a.video-link { position: relative; display: inline-block; }
.has-play-badge { position: relative; }
.has-play-badge::after {
  content: "";
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 34px;
  height: 34px;
  pointer-events: none;
  background: center / contain no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='11' fill='%2314150f' fill-opacity='.55' stroke='%23c19a4b' stroke-width='1.4'/%3E%3Cpath d='M9.5 8l7 4-7 4z' fill='%23c19a4b'/%3E%3C/svg%3E");
}
```

- [ ] **Step 5: Build and verify the rendered output**

Run: `npx @11ty/eleventy`
Expected: build succeeds. Then confirm the pieces landed:

- `_site/index.html` contains `id="lightbox"` and `/assets/js/lightbox.js`.
- `_site/assets/js/lightbox.js` and the CSS additions exist in `_site/assets/css/site.css`.
- A page with an inline photo (e.g. under `_site/family/`) has `data-lightbox="image"` on its `photo-link` anchors.

- [ ] **Step 6: Commit**

```bash
git add _includes/partials/lightbox.njk _includes/base.njk assets/js/lightbox.js assets/css/site.css
git commit -m "Add native-dialog lightbox and brass play badge"
```

---

### Task 7: Exposure media fields helper + Eleventy wiring

**Files:**
- Create: `scripts/photos/lib/exposure-media.js`
- Modify: `eleventy.config.js`
- Test: `scripts/photos/test/exposure-media.test.js`

**Interfaces:**
- Consumes: `VIDEO_EXTENSIONS`, `videoThumbFilename` (Task 1); `_data/site.json` → `photosCdnBase` (existing).
- Produces: `exposureMediaFields({image, seriesSlug, cdnBase}): {isVideo: boolean, imageSrc: string|null, videoSrc: string|null, thumbFilename: string|null}`. The `exposureEntries` collection spreads these onto each entry (so `item.isVideo` / `item.videoSrc` / `item.imageSrc` exist for Task 8's templates). Two new Nunjucks filters: `isVideoFile(name): boolean` and `mediaThumb(name): string` (video name → `name.jpg`, image name unchanged).

- [ ] **Step 1: Write the failing tests** — create `scripts/photos/test/exposure-media.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { exposureMediaFields } = require("../lib/exposure-media");

const args = { seriesSlug: "coastal-series", cdnBase: "https://cdn.example.com" };

test("a photo entry gets imageSrc and its own filename as the grid thumbnail", () => {
  assert.deepEqual(exposureMediaFields({ image: "fog-01.jpg", ...args }), {
    isVideo: false,
    imageSrc: "https://cdn.example.com/exposures/coastal-series/fog-01.jpg",
    videoSrc: null,
    thumbFilename: "fog-01.jpg",
  });
});

test("a video entry gets videoSrc and the derived .mp4.jpg grid thumbnail", () => {
  assert.deepEqual(exposureMediaFields({ image: "clip.mp4", ...args }), {
    isVideo: true,
    imageSrc: null,
    videoSrc: "https://cdn.example.com/exposures/coastal-series/clip.mp4",
    thumbFilename: "clip.mp4.jpg",
  });
});

test("an entry with no image yet resolves to all-null media fields", () => {
  assert.deepEqual(exposureMediaFields({ image: undefined, ...args }), {
    isVideo: false,
    imageSrc: null,
    videoSrc: null,
    thumbFilename: null,
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test scripts/photos/test/exposure-media.test.js`
Expected: FAIL — `Cannot find module '../lib/exposure-media'`.

- [ ] **Step 3: Implement `scripts/photos/lib/exposure-media.js`**

```js
const path = require("node:path");
const { VIDEO_EXTENSIONS, videoThumbFilename } = require("./categories");

// Resolves the media-facing fields for one Exposure Series entry: which
// CloudFront URL the single-exposure stage should show (photo vs video
// player), and which committed thumbnail the series grid should show (a
// video's is the derived poster jpg, never the mp4 itself).
function exposureMediaFields({ image, seriesSlug, cdnBase }) {
  if (!image) return { isVideo: false, imageSrc: null, videoSrc: null, thumbFilename: null };
  const isVideo = VIDEO_EXTENSIONS.includes(path.extname(image).toLowerCase());
  const cdnUrl = `${cdnBase}/exposures/${seriesSlug}/${image}`;
  return {
    isVideo,
    imageSrc: isVideo ? null : cdnUrl,
    videoSrc: isVideo ? cdnUrl : null,
    thumbFilename: isVideo ? videoThumbFilename(image) : image,
  };
}

module.exports = { exposureMediaFields };
```

- [ ] **Step 4: Run the tests**

Run: `node --test scripts/photos/test/exposure-media.test.js` — Expected: 3 pass.

- [ ] **Step 5: Wire into `eleventy.config.js`**

(a) Filters — next to the existing `toRoman` filter registration:

```js
  const { VIDEO_EXTENSIONS, videoThumbFilename } = require("./scripts/photos/lib/categories");
  const isVideoFile = (name) => Boolean(name) && VIDEO_EXTENSIONS.includes(path.extname(name).toLowerCase());
  eleventyConfig.addFilter("isVideoFile", isVideoFile);
  // The series grid always shows a committed thumbnail: a photo's own
  // treated file, or a video's derived poster jpg (clip.mp4 -> clip.mp4.jpg).
  eleventyConfig.addFilter("mediaThumb", (name) => (isVideoFile(name) ? videoThumbFilename(name) : name));
```

(b) In the `exposureEntries` collection, replace the `imageSrc` computation. Change this block:

```js
        entries.push({
          ...
          image: exposure.image,
          // The detail page shows the true-color CloudFront original (same
          // source the old dialog enlarged to), not the treated/sepia
          // thumbnail used inline on the grid.
          imageSrc: exposure.image
            ? `${siteData.photosCdnBase}/exposures/${seriesSlug}/${exposure.image}`
            : null,
          meta,
```

to:

```js
        entries.push({
          ...
          image: exposure.image,
          // The detail page shows the true-color CloudFront original (same
          // source the old dialog enlarged to), not the treated/sepia
          // thumbnail used inline on the grid. A video entry gets videoSrc
          // instead of imageSrc — see exposure-media.js.
          ...exposureMediaFields({
            image: exposure.image,
            seriesSlug,
            cdnBase: siteData.photosCdnBase,
          }),
          meta,
```

with `const { exposureMediaFields } = require("./scripts/photos/lib/exposure-media");` added near the collection (note: `siteData` is declared *after* the transform wiring around line 111 — the collection callback runs lazily at build time, so referencing it is fine, matching current code).

- [ ] **Step 6: Run full suite + build**

Run: `npm test` — Expected: all pass.
Run: `npx @11ty/eleventy` — Expected: build succeeds; spot-check an existing exposure page under `_site/exposures/.../1/index.html` still shows its `<img class="exposure-photo"` with the CloudFront URL.

- [ ] **Step 7: Commit**

```bash
git add scripts/photos/lib/exposure-media.js scripts/photos/test/exposure-media.test.js eleventy.config.js
git commit -m "exposureEntries resolves video vs photo media fields via exposure-media lib"
```

---

### Task 8: Exposure templates play video entries; keyboard guard

**Files:**
- Modify: `_includes/exposure-detail.njk`, `_includes/exposure-series.njk`, `assets/js/exposure-nav.js`, `assets/css/site.css`

**Interfaces:**
- Consumes: `item.isVideo` / `item.videoSrc` / `item.imageSrc` and the `isVideoFile` / `mediaThumb` filters (Task 7); `.has-play-badge` CSS (Task 6).
- Produces: rendered pages only.

- [ ] **Step 1: `_includes/exposure-detail.njk`** — replace the stage's media block (lines 5–9). No autoplay, by explicit decision: arrowing through a series must not start sound unprompted.

```njk
    {% if item.isVideo %}
    <video class="exposure-photo" controls preload="metadata" src="{{ item.videoSrc }}"></video>
    {% elif item.imageSrc %}
    <img class="exposure-photo" src="{{ item.imageSrc }}" alt="{{ item.title }}">
    {% else %}
    <div class="exposure-photo exposure-photo-empty"></div>
    {% endif %}
```

- [ ] **Step 2: `_includes/exposure-series.njk`** — the frame shows the (possibly derived) thumbnail and carries the play badge for videos. Replace the `.frame` block:

```njk
      <div class="frame{% if ex.image and (ex.image | isVideoFile) %} has-play-badge{% endif %}">
        {% if meta %}
        <img src="/{{ category }}/{{ seriesSlug }}/{{ ex.image | mediaThumb }}" alt="">
        {% else %}
        <div class="no-image"></div>
        {% endif %}
      </div>
```

- [ ] **Step 3: `assets/js/exposure-nav.js`** — add `video` to the ignore selector so arrow keys seek a focused player instead of navigating away:

```js
  if (e.target.closest("input, textarea, select, video, [contenteditable]")) return;
```

- [ ] **Step 4: CSS** — `.exposure-photo` is a class, so the existing sizing rules apply to the `<video>` as-is. Check `assets/css/site.css` for any `img.exposure-photo`-scoped rule (element-qualified); if one exists, widen the selector to also cover `video.exposure-photo`. If none exists, no CSS change is needed in this task.

- [ ] **Step 5: Build and verify**

Run: `npx @11ty/eleventy`
Expected: build succeeds; existing exposure pages unchanged (`<img class="exposure-photo"` still present under `_site/exposures/`), grid pages unchanged for photo-only series. (A real video exposure can't render until an mp4 goes through `photos:thumbs` — full manual verification happens in Task 9.)

- [ ] **Step 6: Commit**

```bash
git add _includes/exposure-detail.njk _includes/exposure-series.njk assets/js/exposure-nav.js assets/css/site.css
git commit -m "Exposure stage plays video entries; grid shows poster with play badge"
```

---

### Task 9: End-to-end verification + docs sync

**Files:**
- Modify: `docs/designSpecifications-updated.md`, `docs/site-integrations.md`

**Interfaces:**
- Consumes: everything above.
- Produces: verified feature + docs kept in sync (a standing CLAUDE.md requirement).

- [ ] **Step 1: Full test suite**

Run: `npm test` — Expected: all pass.

- [ ] **Step 2: End-to-end dry run with a synthetic video**

Generate a disposable test clip with the bundled ffmpeg (do NOT commit it; pick a category folder that exists under `photos-source/`, e.g. `Family` — check first with `ls photos-source`):

```bash
node -e "const {execFileSync}=require('node:child_process');execFileSync(require('ffmpeg-static'),['-y','-f','lavfi','-i','color=c=red:s=320x240:d=2','-pix_fmt','yuv420p','photos-source/Family/plan-test-clip.mp4'])"
node scripts/photos/thumbs.js
```

Expected: a treated `plan-test-clip.mp4.jpg` appears in `DFTFR-Obsidian/Website/Family/`, and `_data/photoMeta.json` gains a `family/plan-test-clip.mp4` entry (with a "No post references..." warning, which is fine).

Then embed it temporarily: add `![Test clip](plan-test-clip.mp4)` to any Family post, run `npx @11ty/eleventy`, and confirm the built page contains the full video anchor markup (`data-lightbox="video"`, `has-play-badge`, `src="/family/plan-test-clip.mp4.jpg"`).

Optionally click through with `npm run serve`: video plays in the lightbox (the CDN URL 404s for a test clip that was never uploaded — the *dialog behavior* is what's being checked), Esc/backdrop/× close it, a photo on the same page opens as an image in the lightbox.

**Cleanup (all of it):** delete `photos-source/Family/plan-test-clip.mp4`, the generated `DFTFR-Obsidian/Website/Family/plan-test-clip.mp4.jpg`, the `family/plan-test-clip.mp4` entry in `_data/photoMeta.json`, and revert the test embed. `git status` must show none of these files.

- [ ] **Step 3: Update `docs/site-integrations.md`** — in the photo pipeline section, document: mp4s are pipeline-managed media (same folders); `ffmpeg-static` extracts a ~1s poster frame that flows through the normal treatment/resize steps to `clip.mp4.jpg`; upload strips a video-specific tag set (incl. QuickTime `GPSCoordinates`) and remuxes `-c copy -movflags +faststart` before `aws s3 sync`; the lightbox behavior map (videos everywhere; photos outside Exposures; Exposures photos keep new-tab; video exposures play in the stage, no autoplay).

- [ ] **Step 4: Update `docs/designSpecifications-updated.md`** — add to Components & conventions: a **Lightbox (NEW)** bullet (native `<dialog>`, palette styling, fade under `prefers-reduced-motion` guard, silent chrome, no-JS fallback = new tab, Exposures carve-out) and a **Video thumbnails (NEW)** bullet (treated poster + brass play badge data-URI, `has-play-badge`); extend the Exposures bullet with one line: a series entry may be an mp4, playing in the stage with `controls`, no autoplay.

- [ ] **Step 5: Final build + commit**

Run: `npm test && npx @11ty/eleventy` — Expected: everything green.

```bash
git add docs/site-integrations.md docs/designSpecifications-updated.md
git commit -m "Sync docs with the video pipeline and lightbox"
```

---

## Self-review notes (already applied)

- Spec §1–§7 each map to a task: §1→T1, §2→T3, §3→T4, §4→T2+T5, §5→T6, §6→T3 (photoMeta writes), §7→T7+T8. Error handling: loud ffmpeg failure (T3 test), validate-refs flow (T2 rationale), no-JS fallback (T5 markup + T6 guard).
- The photoMeta key for a video keeps the **video filename** (`family/clip.mp4`), while the committed file is `clip.mp4.jpg` — T2, T3, and T7 all state this so implementers don't "fix" one side.
- `findSourceImages` in `upload.js` keeps its name (images only, new `findSourceVideos` beside it); `thumbs.js`'s private helper becomes `findSourceMedia`. They are different files with different needs — do not unify them.
