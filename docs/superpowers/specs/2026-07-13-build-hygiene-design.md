# Build hygiene: directory data, PR builds, scripts, favicons — design

Date: 2026-07-13
Status: approved

Covers review items #2 (frontmatter boilerplate), #7 (PR builds), #8 (npm scripts),
#9 (duplicate favicons). Four small, independent improvements in one pass.

## 1. Directory data files (#2)

Every flat-category post repeats `layout: post.njk`, `category: <slug>`, and
`isDraft: false` in frontmatter; Exposures series repeat the same with
`exposure-series.njk`. Eleventy's data cascade makes the folder supply these.

**Decisions made with the author:**
- Scope: the 5 flat categories + Exposures. **Projects keeps its frontmatter** —
  one folder there mixes two layouts (`project.njk` for `index.md`,
  `project-journal-entry.njk` + `isJournalEntry` for entries) and Eleventy cannot
  compute `layout` dynamically, so derivation would be fragile for low volume.
- Existing posts get the redundant lines **stripped**, verified byte-identical.

**New files (static JSON, invisible in Obsidian's default explorer):**

- `DFTFR-Obsidian/Website/Professional/Professional.11tydata.json` →
  `{"layout": "post.njk", "category": "professional"}`
- Same pattern for `Philosophy`, `Family`, `Fiction`, `Misc`.
- `DFTFR-Obsidian/Website/Exposures/Exposures.11tydata.json` →
  `{"layout": "exposure-series.njk", "category": "exposures"}`

Frontmatter still overrides directory data when present (normal cascade
precedence). Category `index.md` files inherit `layout` harmlessly (their own
`eleventyComputed: permalink: false` means no page is rendered) and now get
`category` from the folder too.

### Photo-pipeline decoupling (required by the strip)

`scripts/photos/lib/content-scan.js` currently reads `frontmatter.category` via
gray-matter — **outside** Eleventy's data cascade. Stripping `category` from
posts would silently skip them in the missing-thumbnail validator. Fix:
`extractImageRefs` derives category (and nested-ness) from the file's path via
the existing `categoryRefFromInputPath(filePath)` helper in
`scripts/photos/lib/categories.js`, making folder location the single source of
truth on both sides. Files outside any known category folder return `[]` as
before. `photoTreatment`, `isDraft`, and `exposures` still come from
frontmatter. Tests updated; a new test proves a file with no `category`
frontmatter in a category folder is still scanned.

### Vault cleanup

Strip from the vault (behavior-neutral, values identical to directory data):
- `layout:` and `category:` and `isDraft: false` lines from the 26 flat posts
  and 2 Exposures `index.md` series files.
- The redundant `category:` line from the 5 flat category `index.md` files
  (keep `isCategoryIndex` and the `eleventyComputed: permalink: false` block).
- `isDraft: true` (used by the post template for new drafts) is never stripped;
  only the no-op `false` form.
- Projects/, About/, Contact/ untouched.

`DFTFR-Obsidian/Templates/Template for posts.md` drops its `layout` and
`category` lines (folder placement now decides category), keeps `isDraft: true`.

### Verification (the core gate)

Checksum every `_site/**/*.html` (and `feed.xml`) from a clean build before the
change; rebuild after; the two listings must be **identical**. Any diff fails.
`npm test` passes with the updated content-scan tests.

## 2. PR builds (#7)

New `.github/workflows/build.yml`, triggered on `pull_request`:
checkout → setup-node (Node 24, npm cache) → `npm ci` → `npm run build`.
Nothing else — no SSH, no secrets, no deploy. `deploy.yml` is untouched. This
gates PRs on the same build `main` runs (including the photo validator and
Pagefind), so a broken build is caught before merge instead of by a red deploy.

## 3. npm scripts (#8)

- `build:drafts` becomes `cross-env SHOW_DRAFTS=true eleventy && pagefind --site _site`
  so the drafts preview has working search.
- The `start` script (duplicate of `serve`) is deleted.
- `serve` intentionally keeps live-reload without search — Pagefind is a
  post-build indexer and can't participate in the dev server's watch loop.
  One line documenting this goes in README.md's dev/preview section.

## 4. Favicons (#9)

The blanket `addPassthroughCopy({ assets: "assets" })` ships `assets/favicon/*`
to `/assets/favicon/` while the per-file loop ships the same files to the site
root — only the root copies are referenced. Fix: `git mv assets/favicon favicon`
(repo root, outside the blanket copy), update the loop in `eleventy.config.js`
to read `favicon/`, and update path references in `docs/site-integrations.md`
and `docs/favicon.md`. Verify the built output has root favicons and **no**
`_site/assets/favicon/` directory, and total page/file expectations otherwise
unchanged.

## Docs to update

- `docs/obsidian-to-eleventy-lessons.md` and `docs/designSpecifications-updated.md`:
  wherever post frontmatter conventions are described, reflect the lean form
  (no layout/category/isDraft:false; folder decides category).
- `docs/site-integrations.md` + `docs/favicon.md`: favicon source path.
- README.md: dev-server search note (item 3).

## Out of scope

Projects frontmatter derivation; making `serve` run Pagefind; consolidating the
category definition triple-source (review item #5); draft-helper consolidation
(#10).
