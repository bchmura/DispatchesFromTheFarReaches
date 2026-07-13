# Head Metadata + Source Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every page emits description/canonical/OG metadata; the category list has one source of truth; draft checks collapse to one helper; the passthrough restart quirk is documented.

**Architecture:** Task 1 adds head tags (the only output-changing task — verified by a diff that shows ONLY the new head lines). Tasks 2 and 3 are refactors proven byte-identical, same methodology as the previous pass.

**Tech Stack:** Nunjucks, Eleventy data cascade (JS global data), node:test.

**Spec:** `docs/superpowers/specs/2026-07-13-metadata-and-consolidation-design.md`

## Global Constraints

- Tasks 2 and 3 must produce **byte-identical** built output (Task 3 additionally byte-identical under `SHOW_DRAFTS=true`).
- Task 1's output diff must contain ONLY the added head lines — nothing else changes on any page.
- No caller of `scripts/photos/lib/categories.js` changes; its export names and shapes stay identical.
- Templates keep using `categoryLabels[key]` unchanged.
- `npm test` stays 61/61 throughout.
- Never edit anything under `mockups/`.

---

### Task 1: Head metadata

**Files:**
- Modify: `_includes/partials/head.njk`, `docs/designSpecifications-updated.md`

**Interfaces:**
- Consumes: `site.title`/`site.description`/`site.url` from `_data/site.json`; per-page `title`, `description`, `category` from the cascade; `page.url`.
- Produces: nothing other tasks rely on.

- [ ] **Step 1: Snapshot two built pages for the before/after diff.**

```bash
rm -rf _site && npx @11ty/eleventy
cp _site/index.html .superpowers/sdd/home-before.html
cp _site/professional/hindsight-the-infallible-oracle/index.html .superpowers/sdd/post-before.html
```

- [ ] **Step 2: Add the metadata block.** In `_includes/partials/head.njk`, directly after the `<title>` line, insert:

```njk
<meta name="description" content="{{ description or site.description }}" />
<link rel="canonical" href="{{ site.url }}{{ page.url }}" />
<meta property="og:title" content="{{ title or site.title }}" />
<meta property="og:description" content="{{ description or site.description }}" />
<meta property="og:url" content="{{ site.url }}{{ page.url }}" />
<meta property="og:site_name" content="{{ site.title }}" />
<meta property="og:type" content="{% if category and title %}article{% else %}website{% endif %}" />
<meta property="og:image" content="{{ site.url }}/android-chrome-512x512.png" />
<meta name="twitter:card" content="summary" />
```

Notes: Nunjucks autoescape is on, so quotes inside descriptions are safely encoded. The `category and title` test makes posts (and journal entries/series, which have both) `article`, while category listing pages (category, no title of their own) and utility pages stay `website`.

- [ ] **Step 3: Rebuild and verify the diff is additions-only.**

```bash
npx @11ty/eleventy
diff .superpowers/sdd/home-before.html _site/index.html
diff .superpowers/sdd/post-before.html _site/professional/hindsight-the-infallible-oracle/index.html
```

Expected: each diff shows ONLY the nine inserted lines (as `>` additions in one hunk), nothing else. On the post page the added lines carry the post's own description, `og:type` `article`, and canonical `https://dispatchesfromthefarreaches.com/professional/hindsight-the-infallible-oracle/`. On the home page: the site description, `og:type` `website`.

- [ ] **Step 4: Verify no empty descriptions anywhere.**

```bash
grep -rl 'name="description" content=""' _site --include="*.html" || echo "no empty descriptions"
grep -c 'rel="canonical"' _site/tags/index.html
```

Expected: `no empty descriptions`; canonical count `1` on the tag page (which has no frontmatter description and exercises the site-description fallback).

- [ ] **Step 5: Docs.** In `docs/designSpecifications-updated.md`, under `## Technical constraints`, append this bullet:

```markdown
- **Every page emits head metadata** — meta description (frontmatter `description`, falling back to `site.description`), canonical URL, Open Graph tags (`og:type` is `article` for pages with both a category and a title, else `website`; `og:image` is the site-wide `android-chrome-512x512.png`), and `twitter:card` — all assembled in `_includes/partials/head.njk` from existing data.
```

- [ ] **Step 6: Commit.**

```bash
git add _includes/partials/head.njk docs/designSpecifications-updated.md
git commit -m "Emit description, canonical, and Open Graph metadata on every page"
```

---

### Task 2: Category single-source

**Files:**
- Modify: `_data/categories.json`, `scripts/photos/lib/categories.js`
- Create: `_data/categoryLabels.js`
- Delete: `_data/categoryLabels.json`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `categories.json` entries now carry `dir` (vault folder name) and `nested` (boolean) — anything future that needs the category list reads this one file.

- [ ] **Step 1: Baseline.**

```bash
rm -rf _site && npx @11ty/eleventy
find _site -type f \( -name '*.html' -o -name 'feed.xml' \) | LC_ALL=C sort | xargs md5sum > .superpowers/sdd/hash-t2-before.txt
```

- [ ] **Step 2: Augment categories.json via script** (NOT by retyping — the glyphSvg strings are long and easy to corrupt). Save as `.superpowers/sdd/augment-categories.js`, run `node .superpowers/sdd/augment-categories.js`, do not commit the script:

```js
const fs = require("fs");
const cats = JSON.parse(fs.readFileSync("_data/categories.json", "utf8"));
const dirs = {
  professional: "Professional", philosophy: "Philosophy", projects: "Projects",
  exposures: "Exposures", family: "Family", fiction: "Fiction", misc: "Misc",
};
const nested = new Set(["projects", "exposures"]);
for (const c of cats) {
  c.dir = dirs[c.key];
  c.nested = nested.has(c.key);
}
fs.writeFileSync("_data/categories.json", JSON.stringify(cats, null, 2) + "\n");
console.log("augmented", cats.length, "categories");
```

Then `git diff _data/categories.json` — confirm each of the 7 entries gained exactly `"dir"` and `"nested"` and every `glyphSvg` is unchanged (whitespace reflow from stringify is fine).

- [ ] **Step 3: Derive the pipeline maps.** In `scripts/photos/lib/categories.js`, replace the two hardcoded map declarations (`const FLAT_CATEGORY_DIRS = {...};` with its comment, and `const NESTED_CATEGORY_DIRS = {...};` with its comment) with:

```js
// Derived from _data/categories.json — the single source of truth for the
// category list (key/label/slug/glyph for templates; dir/nested for this
// pipeline). Adding a category means editing that one file only.
// Kept as two maps (flat vs nested) because passthrough-copy and the photo
// pipeline treat them differently: nested categories (Projects, Exposures)
// give each post its own subfolder and image folder.
const CATEGORIES = require("../../../_data/categories.json");
const FLAT_CATEGORY_DIRS = Object.fromEntries(
  CATEGORIES.filter((c) => !c.nested).map((c) => [c.dir, c.slug])
);
const NESTED_CATEGORY_DIRS = Object.fromEntries(
  CATEGORIES.filter((c) => c.nested).map((c) => [c.dir, c.slug])
);
```

Everything below (SITE_CONTENT_ROOT onward) and all exports stay exactly as they are.

- [ ] **Step 4: Replace the labels file.** Delete `_data/categoryLabels.json` (`git rm _data/categoryLabels.json`) and create `_data/categoryLabels.js`:

```js
// Derived key -> label map so templates keep using `categoryLabels[key]`
// unchanged. Single source of truth: _data/categories.json.
const categories = require("./categories.json");
module.exports = Object.fromEntries(categories.map((c) => [c.key, c.label]));
```

- [ ] **Step 5: Gates.**

```bash
npm test
rm -rf _site && npx @11ty/eleventy
find _site -type f \( -name '*.html' -o -name 'feed.xml' \) | LC_ALL=C sort | xargs md5sum | diff .superpowers/sdd/hash-t2-before.txt - && echo IDENTICAL
```

Expected: 61/61; `IDENTICAL`. If not identical, stop and investigate — do not commit.

- [ ] **Step 6: Confirm no other reader of categoryLabels.json exists.**

```bash
grep -rn "categoryLabels" --include="*.njk" --include="*.js" --exclude-dir=node_modules --exclude-dir=_site . | grep -v "_data/categoryLabels.js"
```

Expected: only template usages of the `categoryLabels` variable (e.g. `categoryLabels[...]` in index.njk/post.njk/category.njk/tags.njk) — no remaining reference to the deleted `.json` file path.

- [ ] **Step 7: Commit.**

```bash
git add _data/categories.json _data/categoryLabels.js scripts/photos/lib/categories.js
git commit -m "categories.json becomes the single source for category definitions"
```

(The `git rm` in Step 4 already staged the deletion of categoryLabels.json.)

---

### Task 3: Draft-check helper + restart note

**Files:**
- Modify: `eleventy.config.js`, `_data/eleventyComputed.js`

**Interfaces:** none new.

- [ ] **Step 1: Baselines — normal AND drafts builds.**

```bash
rm -rf _site && npx @11ty/eleventy
find _site -type f \( -name '*.html' -o -name 'feed.xml' \) | LC_ALL=C sort | xargs md5sum > .superpowers/sdd/hash-t3-before.txt
rm -rf _site && SHOW_DRAFTS=true npx @11ty/eleventy
find _site -type f -name '*.html' | LC_ALL=C sort | xargs md5sum > .superpowers/sdd/hash-t3-drafts-before.txt
```

(Run these in Git Bash — the inline `SHOW_DRAFTS=true` env prefix is bash syntax, same form Step 5 uses.)

- [ ] **Step 2: Introduce the helper.** In `eleventy.config.js`, directly above the `isRealPost` definition, add:

```js
  // Drafts are visible only when SHOW_DRAFTS=true (serve:drafts /
  // build:drafts). _data/eleventyComputed.js applies the same rule to
  // permalinks — change both together.
  const isLiveItem = (item) => showDrafts || !item.data.isDraft;
```

Then replace the four inline checks:
- In `isRealPost`: `(showDrafts || !item.data.isDraft)` → `isLiveItem(item)`
- In `journalEntriesByProject`: `if (item.data.isDraft && !showDrafts) continue;` → `if (!isLiveItem(item)) continue;`
- In `projectsBySlug`: `(showDrafts || !item.data.isDraft)` → `isLiveItem(item)`
- In `exposureEntries`: `if (item.data.isDraft && !showDrafts) continue;` → `if (!isLiveItem(item)) continue;`

- [ ] **Step 3: Cross-reference in eleventyComputed.** In `_data/eleventyComputed.js`, change the line `if (data.isDraft && !showDrafts) return false;` to:

```js
    // Same rule as isLiveItem in eleventy.config.js — change both together.
    if (data.isDraft && !showDrafts) return false;
```

- [ ] **Step 4: The restart note (#12).** In `eleventy.config.js`, at the end of the existing comment block above the nested-category passthrough loop (the one explaining per-subfolder registration), append:

```js
  // NOTE: subfolders are enumerated once at config load — a NEW project or
  // gallery folder created while `npm run serve` is running won't get a
  // passthrough rule (its images 404) until the dev server restarts.
```

- [ ] **Step 5: Gates — both build modes byte-identical.**

```bash
rm -rf _site && npx @11ty/eleventy
find _site -type f \( -name '*.html' -o -name 'feed.xml' \) | LC_ALL=C sort | xargs md5sum | diff .superpowers/sdd/hash-t3-before.txt - && echo IDENTICAL-NORMAL
rm -rf _site && SHOW_DRAFTS=true npx @11ty/eleventy
find _site -type f -name '*.html' | LC_ALL=C sort | xargs md5sum | diff .superpowers/sdd/hash-t3-drafts-before.txt - && echo IDENTICAL-DRAFTS
npm test
rm -rf _site && npx @11ty/eleventy
```

Expected: `IDENTICAL-NORMAL`, `IDENTICAL-DRAFTS`, 61/61, and a final normal-mode rebuild so `_site` isn't left in drafts state.

- [ ] **Step 6: Commit.**

```bash
git add eleventy.config.js _data/eleventyComputed.js
git commit -m "Consolidate draft checks into isLiveItem; document passthrough restart quirk"
```
