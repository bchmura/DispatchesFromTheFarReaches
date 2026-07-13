# Head metadata + source consolidation — design

Date: 2026-07-13
Status: approved

Covers review items #3 (head metadata), #5 (category single-source), #10 (draft-check
helper), #12 (passthrough restart note). Closes out the 2026-07-12 Eleventy review list.

## 1. Head metadata (#3)

`_includes/partials/head.njk` gains, from existing data only:

- `<meta name="description">` — `description` frontmatter, falling back to
  `site.description` (home, tag page, category pages have none of their own). Never an
  empty tag.
- `<link rel="canonical">` — `site.url` (from `_data/site.json`, no trailing slash) +
  `page.url`.
- Open Graph: `og:title` (page title, else site title), `og:description` (same value as
  meta description), `og:url` (canonical), `og:site_name` (site title), `og:type`
  (`article` when the page has a `category`, else `website`), `og:image`
  (`site.url`-absolute URL of the existing `/android-chrome-512x512.png` — a stable
  site-wide brand mark; per-type images like exposure covers are deliberately out of
  scope).
- `<meta name="twitter:card" content="summary">`.

Verification: built post page carries its own description/canonical/og:type=article;
home page carries site description/og:type=website; no page has an empty description;
diff vs prior build shows ONLY added head lines (everything else identical).

## 2. Category single-source (#5)

`_data/categories.json` becomes the single source of truth: each entry gains
`"dir"` (vault folder name, e.g. `"Professional"`) and `"nested"` (boolean; true for
Projects/Exposures). Then:

- `scripts/photos/lib/categories.js` derives `FLAT_CATEGORY_DIRS` and
  `NESTED_CATEGORY_DIRS` from `require("../../../_data/categories.json")` instead of
  hardcoding them. Exports and their shapes are unchanged — no caller changes.
- `_data/categoryLabels.json` is deleted; `_data/categoryLabels.js` (global data file)
  derives the same key→label object from `categories.json`. Templates untouched.

categories.json already lists all 7 categories (professional, philosophy, projects,
exposures, family, fiction, misc), so each entry gets `dir` + `nested`, and the
derivation splits the two maps by filtering on `nested`.

Gates: byte-identical build, `npm test` 61/61 (photo-pipeline tests exercise the
derived maps).

## 3. Draft-check helper (#10)

In `eleventy.config.js`, the four inline `item.data.isDraft && !showDrafts` /
`showDrafts || !item.data.isDraft` occurrences (isRealPost, journalEntriesByProject,
projectsBySlug, exposureEntries) collapse into one `isLiveItem(item)` helper defined
next to `isRealPost`. The fifth occurrence in `_data/eleventyComputed.js` stays (separate
module, one line doing double duty with `permalink: false`) and gets a cross-reference
comment. Gate: byte-identical build (including with SHOW_DRAFTS=true — same page set as
before the change).

## 4. Passthrough restart note (#12)

Two-line comment on the nested-category passthrough loop in `eleventy.config.js`:
subfolders are enumerated once at config load, so a new project/gallery folder created
while `npm run serve` is running needs a restart before its images copy. No behavior
change.

## Docs

`docs/designSpecifications-updated.md` Technical constraints section: one bullet noting
every page now emits description/canonical/OG tags derived from frontmatter + site.json.

## Out of scope

Per-type og:image (exposure covers); sharing the draft helper across modules; any
sitemap/robots work.
