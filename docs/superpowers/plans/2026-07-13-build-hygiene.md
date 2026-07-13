# Build Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove per-post frontmatter boilerplate via directory data files (with byte-identical output), add PR build checks, fix the npm scripts, and stop shipping favicons twice.

**Architecture:** Four independent improvements. The load-bearing one is #2: Eleventy directory data files supply `layout`/`category` per folder, the photo pipeline switches from frontmatter-category to path-derived category (single source of truth = folder), and the vault's redundant frontmatter is stripped with a checksum proof that built output is unchanged.

**Tech Stack:** Eleventy 3 data cascade, node:test, GitHub Actions, npm scripts.

**Spec:** `docs/superpowers/specs/2026-07-13-build-hygiene-design.md`

## Global Constraints

- Task 2's built output must be **byte-identical** before vs. after (every `_site/**/*.html` plus `feed.xml`); any checksum diff fails the task.
- Only `isDraft: false` lines are ever stripped — an `isDraft: true` line must never be touched.
- Projects/, About/, Contact/ vault content is untouched by the strip.
- No changes to `.github/workflows/deploy.yml`.
- Never edit anything under `mockups/`.
- Build: `npx @11ty/eleventy` from repo root; tests: `npm test` (node --test, currently 60 passing).
- Task order matters: Task 1 must land before Task 2 (the strip would otherwise blind the photo validator to flat posts).

---

### Task 1: Photo pipeline derives category from path (TDD)

**Files:**
- Modify: `scripts/photos/lib/content-scan.js`
- Test: `scripts/photos/test/content-scan.test.js`

**Interfaces:**
- Consumes: `categoryRefFromInputPath(inputPath)` from `scripts/photos/lib/categories.js` — returns `{ category, projectSlug? }` for paths under `DFTFR-Obsidian/Website/<CategoryDir>/...`, `{}` otherwise. Already exists and is tested.
- Produces: `extractImageRefs({ frontmatter, body, filePath })` now derives `category`/`projectSlug` from `filePath` alone; `frontmatter.category` is no longer read. Everything else about the return shape is unchanged.

- [ ] **Step 1: Write the failing test.** Append to `scripts/photos/test/content-scan.test.js`:

```js
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
```

- [ ] **Step 2: Run it to verify it fails.**

Run: `node --test scripts/photos/test/content-scan.test.js`
Expected: the new test FAILS (`refs.length` is 0 — current code returns `[]` when `frontmatter.category` is absent). All pre-existing tests still pass (they already use real vault-shaped `filePath`s).

- [ ] **Step 3: Implement.** In `scripts/photos/lib/content-scan.js`:

Change the import block

```js
const {
  SITE_CONTENT_ROOT,
  DEFAULT_TREATMENT,
  NESTED_CATEGORY_DIRS,
  projectSlugFromPath,
  isPipelineManagedFilename,
} = require("./categories");
```

to

```js
const {
  SITE_CONTENT_ROOT,
  DEFAULT_TREATMENT,
  categoryRefFromInputPath,
  isPipelineManagedFilename,
} = require("./categories");
```

Delete the now-unused line `const NESTED_CATEGORY_SLUGS = new Set(Object.values(NESTED_CATEGORY_DIRS));`.

In `extractImageRefs`, replace

```js
  if (!frontmatter.category) return [];
  const category = String(frontmatter.category).toLowerCase();
  const treatment = frontmatter.photoTreatment || DEFAULT_TREATMENT;
```

with

```js
  // Category comes from where the file sits in the vault, not frontmatter —
  // directory data files supply `category` to Eleventy the same way, so the
  // folder is the single source of truth on both sides (matches the
  // "photo-links" transform, which already derives from inputPath).
  const { category, projectSlug } = categoryRefFromInputPath(filePath);
  if (!category) return [];
  const treatment = frontmatter.photoTreatment || DEFAULT_TREATMENT;
```

and delete the old line

```js
  const projectSlug = NESTED_CATEGORY_SLUGS.has(category) ? projectSlugFromPath(filePath) : undefined;
```

(the destructured `projectSlug` replaces it — `categoryRefFromInputPath` returns the same parent-directory slug for nested categories).

- [ ] **Step 4: Run the focused test file, then the full suite.**

Run: `node --test scripts/photos/test/content-scan.test.js` — all pass (existing tests pass unchanged: their `filePath`s already sit under the right category folders, and the now-ignored `frontmatter.category` values agree with the paths).
Run: `npm test`
Expected: 61/61 passing (60 + the new one), no warnings.

- [ ] **Step 5: Also update the stale test name.** The first test in the file, `"extractImageRefs returns nothing for a post with no category"`, uses `filePath: "x.md"` — still passes (path outside any category folder), but rename it to describe the new contract:

```js
test("extractImageRefs returns nothing for a file outside any category folder", () => {
  assert.deepEqual(extractImageRefs({ frontmatter: {}, body: "![x](a.jpg)", filePath: "x.md" }), []);
});
```

Run: `npm test` — 61/61 still passing.

- [ ] **Step 6: Commit**

```bash
git add scripts/photos/lib/content-scan.js scripts/photos/test/content-scan.test.js
git commit -m "Photo scanner derives category from vault path, not frontmatter"
```

---

### Task 2: Directory data files + vault strip (byte-identical)

**Files:**
- Create: `DFTFR-Obsidian/Website/Professional/Professional.11tydata.json`, `.../Philosophy/Philosophy.11tydata.json`, `.../Family/Family.11tydata.json`, `.../Fiction/Fiction.11tydata.json`, `.../Misc/Misc.11tydata.json`, `.../Exposures/Exposures.11tydata.json`
- Modify: ~34 vault `.md` files (strip), `DFTFR-Obsidian/Templates/Template for posts.md`, `README.md`

**Interfaces:**
- Consumes: Task 1's path-derived photo scanning (the strip is unsafe before it).
- Produces: nothing later tasks rely on.

- [ ] **Step 1: Baseline checksums from a clean build.**

```bash
rm -rf _site && npx @11ty/eleventy
find _site -type f \( -name '*.html' -o -name 'feed.xml' \) | LC_ALL=C sort | xargs md5sum > .superpowers/sdd/hash-before.txt
wc -l .superpowers/sdd/hash-before.txt
```

Expected: build succeeds; 59 lines (58 html + feed.xml).

- [ ] **Step 2: Create the six directory data files.** Each is exactly one JSON object:

`DFTFR-Obsidian/Website/Professional/Professional.11tydata.json`:
```json
{ "layout": "post.njk", "category": "professional" }
```
`DFTFR-Obsidian/Website/Philosophy/Philosophy.11tydata.json`:
```json
{ "layout": "post.njk", "category": "philosophy" }
```
`DFTFR-Obsidian/Website/Family/Family.11tydata.json`:
```json
{ "layout": "post.njk", "category": "family" }
```
`DFTFR-Obsidian/Website/Fiction/Fiction.11tydata.json`:
```json
{ "layout": "post.njk", "category": "fiction" }
```
`DFTFR-Obsidian/Website/Misc/Misc.11tydata.json`:
```json
{ "layout": "post.njk", "category": "misc" }
```
`DFTFR-Obsidian/Website/Exposures/Exposures.11tydata.json`:
```json
{ "layout": "exposure-series.njk", "category": "exposures" }
```

- [ ] **Step 3: Rebuild and confirm still byte-identical** (directory data now duplicates frontmatter — output must not change):

```bash
rm -rf _site && npx @11ty/eleventy
find _site -type f \( -name '*.html' -o -name 'feed.xml' \) | LC_ALL=C sort | xargs md5sum > .superpowers/sdd/hash-mid.txt
diff .superpowers/sdd/hash-before.txt .superpowers/sdd/hash-mid.txt && echo IDENTICAL
```

Expected: `IDENTICAL`.

- [ ] **Step 4: Strip the redundant frontmatter.** Save this as `.superpowers/sdd/strip-frontmatter.js` and run `node .superpowers/sdd/strip-frontmatter.js` (scratch location — it is git-ignored and must NOT be committed):

```js
const fs = require("fs");
const path = require("path");
const root = "DFTFR-Obsidian/Website";
const targets = [];
for (const dir of ["Professional", "Philosophy", "Family", "Fiction", "Misc", "Exposures"]) {
  for (const f of fs.readdirSync(path.join(root, dir))) {
    if (f.endsWith(".md")) targets.push(path.join(root, dir, f));
  }
}
for (const d of fs.readdirSync(path.join(root, "Exposures"), { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const idx = path.join(root, "Exposures", d.name, "index.md");
  if (fs.existsSync(idx)) targets.push(idx);
}
// Column-0 anchors only: nested YAML (per-exposure tags/body) is indented and untouched.
// isDraft is only dropped in its no-op `false` form — a live `isDraft: true` survives.
const DROP = [/^layout:\s/, /^category:\s/, /^isDraft:\s*false\s*$/];
let changed = 0;
for (const file of targets) {
  const src = fs.readFileSync(file, "utf8");
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) continue;
  const lines = m[1].split(/\r?\n/);
  const kept = lines.filter((l) => !DROP.some((rx) => rx.test(l)));
  if (kept.length === lines.length) continue;
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  fs.writeFileSync(file, src.replace(m[0], "---" + eol + kept.join(eol) + eol + "---"));
  changed++;
}
console.log("stripped", changed, "files");
```

Expected: ~33–34 files stripped (26 flat posts, 5 category index.md, 2 Exposures series index.md, plus Exposures/index.md if present). Run `git diff --stat` and confirm every changed file is under the six target folders and each lost only 1–3 lines.

- [ ] **Step 5: The byte-identical gate.**

```bash
rm -rf _site && npx @11ty/eleventy
find _site -type f \( -name '*.html' -o -name 'feed.xml' \) | LC_ALL=C sort | xargs md5sum > .superpowers/sdd/hash-after.txt
diff .superpowers/sdd/hash-before.txt .superpowers/sdd/hash-after.txt && echo IDENTICAL
npm test
```

Expected: `IDENTICAL` and 61/61 tests passing. If the diff shows ANY change, stop, investigate which file diverged (`git diff` on the vault file whose page changed), and fix before proceeding — do not commit a non-identical result.

- [ ] **Step 6: Update the Obsidian template.** In `DFTFR-Obsidian/Templates/Template for posts.md`, delete these two lines (keep everything else, including `isDraft: true`):

```
category: misc, professional, family, fiction
layout: post.njk
```

- [ ] **Step 7: Update README's frontmatter examples.** In `README.md`:

(a) Replace the regular-article frontmatter example (currently lines ~54–64):

```markdown
---
title: "Your Title Here"
category: family
dispatchNo: 224
description: "One or two sentences — used wherever the post is teased/linked elsewhere on the site."
date: 2026-07-11
layout: post.njk
tags: ["some-tag", "another-tag"]
isDraft: false
---
```

with:

```markdown
---
title: "Your Title Here"
dispatchNo: 224
description: "One or two sentences — used wherever the post is teased/linked elsewhere on the site."
date: 2026-07-11
tags: ["some-tag", "another-tag"]
---
```

(b) Replace the `category` field note:

```markdown
- **`category`** must be one of: `professional`, `philosophy`, `family`, `fiction`, `misc`
  (lowercase, matches the folder you put the file in).
```

with:

```markdown
- **Category and layout are automatic** — the folder you put the file in decides both (each
  category folder has a `<Folder>.11tydata.json` directory-data file supplying them, invisible
  in Obsidian). You never write `category:` or `layout:` in a post's frontmatter.
```

(c) In the Exposure Series frontmatter example (~lines 93–103), delete these three lines:

```
layout: exposure-series.njk
category: exposures
isDraft: false
```

(d) The `isDraft` field note (~line 78) stays as-is — it already describes the opt-in `true` form.

- [ ] **Step 8: Final verification and commit.**

```bash
rm -rf _site && npx @11ty/eleventy
find _site -type f \( -name '*.html' -o -name 'feed.xml' \) | LC_ALL=C sort | xargs md5sum | diff .superpowers/sdd/hash-before.txt - && echo IDENTICAL
git add DFTFR-Obsidian README.md
git commit -m "Directory data files replace per-post layout/category/isDraft boilerplate"
```

Expected: `IDENTICAL`; commit contains the 6 new .11tydata.json files, the stripped vault files, the template, and README — and NOT the strip script.

---

### Task 3: PR build workflow

**Files:**
- Create: `.github/workflows/build.yml`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing later tasks rely on.

- [ ] **Step 1: Create `.github/workflows/build.yml`** with exactly:

```yaml
name: Build check

on:
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build site
        run: npm run build
```

- [ ] **Step 2: Verify.** `git diff --stat` shows only the new file; confirm `.github/workflows/deploy.yml` is untouched; confirm indentation/step style mirrors deploy.yml (same actions, same versions). The workflow's real test is the first PR — note that in your report.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/build.yml
git commit -m "Run the site build on pull requests"
```

---

### Task 4: npm scripts + README search note

**Files:**
- Modify: `package.json`, `README.md`

**Interfaces:** none.

- [ ] **Step 1: Edit `package.json` scripts.** Change:

```json
    "build:drafts": "cross-env SHOW_DRAFTS=true eleventy",
```

to:

```json
    "build:drafts": "cross-env SHOW_DRAFTS=true eleventy && pagefind --site _site",
```

and delete the line:

```json
    "start": "npx @11ty/eleventy --serve",
```

- [ ] **Step 2: Add the search note to README.** In the "Previewing your changes before pushing" section, after the paragraph ending "Press Ctrl+C to stop it.", insert:

```markdown
One caveat: the **search box does nothing under `npm run serve`** — the search index is built
by a separate tool (Pagefind) that only runs as part of `npm run build` (and `npm run
build:drafts`), not inside the live-reload server. That's expected, not broken.
```

- [ ] **Step 3: Verify.**

```bash
npm run build:drafts 2>&1 | tail -3
npm run start 2>&1 | head -2 || echo "start-script-gone"
rm -rf _site && npx @11ty/eleventy
```

Expected: build:drafts output ends with Pagefind indexing lines (e.g. "Indexed N pages"); `npm run start` errors with "Missing script" → `start-script-gone`; final clean rebuild succeeds (leaves `_site` in normal non-drafts state).

- [ ] **Step 4: Commit**

```bash
git add package.json README.md
git commit -m "Pagefind in build:drafts, drop duplicate start script, document dev-server search"
```

---

### Task 5: Favicons shipped once

**Files:**
- Move: `assets/favicon/` → `favicon/` (repo root, via `git mv`)
- Modify: `eleventy.config.js`, `docs/site-integrations.md`
- Check (edit only if grep matches): `docs/favicon.md`

**Interfaces:** none.

- [ ] **Step 1: Move the folder.**

```bash
git mv assets/favicon favicon
```

- [ ] **Step 2: Update the config loop.** In `eleventy.config.js`, change:

```js
  for (const file of fs.readdirSync("assets/favicon")) {
    eleventyConfig.addPassthroughCopy({ [`assets/favicon/${file}`]: file });
  }
```

to:

```js
  // Favicon sources live at the repo root (NOT under assets/) so the blanket
  // assets passthrough above doesn't ship a second copy to /assets/favicon/.
  for (const file of fs.readdirSync("favicon")) {
    eleventyConfig.addPassthroughCopy({ [`favicon/${file}`]: file });
  }
```

- [ ] **Step 3: Update docs.** In `docs/site-integrations.md` (Favicons section):

Change: ``- Source files live in `assets/favicon/` (favicon.ico, favicon.svg, the 16/32/48 PNGs,``
to: ``- Source files live in `favicon/` at the repo root (favicon.ico, favicon.svg, the 16/32/48 PNGs,``

Change: ``- Any generation/instruction notes for a new favicon set should go in `docs/`, not``
  ``  `assets/favicon/` — a stray `favicon.md` in that folder would otherwise get copied straight``
to: ``- Any generation/instruction notes for a new favicon set should go in `docs/`, not``
  ``  `favicon/` — a stray `favicon.md` in that folder would otherwise get copied straight``

Then: `grep -n "assets/favicon" docs/favicon.md docs/site-integrations.md CLAUDE.md README.md` — update any remaining match the same way (path only, no other wording changes). Expected: zero matches remain afterward.

- [ ] **Step 4: Verify the built output.**

```bash
rm -rf _site && npx @11ty/eleventy
test -f _site/favicon.ico && test -f _site/site.webmanifest && echo root-ok
test ! -d _site/assets/favicon && echo no-duplicate
```

Expected: `root-ok` and `no-duplicate`; build's "Copied" count drops by the number of favicon files (~9) versus Task 4's build.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Move favicon sources out of assets/ so they ship only once"
```
