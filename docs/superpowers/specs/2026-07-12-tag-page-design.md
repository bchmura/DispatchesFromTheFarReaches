# The Cross-Filing Index (tag page) — design

Date: 2026-07-12
Status: approved

## What and why

A single tag page at `/tags/`, titled **"The Cross-Filing Index"**, that finally gives the
site's tag links somewhere to go (they are all `href="#"` today: home tag cloud, posts'
"Cross-filed under" list, category-page entry tags). Visitors see every tag as a chip at
the top and the full post list below; tapping one or more chips filters the list
client-side to posts matching **any** selected tag (OR logic). With nothing selected, all
posts show. Arriving via a tag link elsewhere on the site pre-selects that tag on load.

Decisions made with the author:

- **Filter logic: OR** — selecting more tags broadens the list; no combination is empty.
- **Title: "The Cross-Filing Index"** — extends the existing "Cross-filed under" voice.
  Kicker: "Filed under many headings".
- **Nav placement: footer nav** — alongside RSS / About / File a Dispatch. Top nav stays
  categories-only. (Tag links across the site link in regardless.)
- **List style:** same article markup as the category pages' generic list.

## Approach (chosen from three)

One static page + a small vanilla-JS filter. Rejected alternatives: static per-tag pages
(`/tags/<tag>/` pagination — extra pages, still needs JS for multi-select, two systems
answering one question) and Pagefind facet filters (broken under `npm run serve` since
Pagefind only runs in the build script; heavyweight for show/hide).

## Components

### `tags.njk` (new, repo root)

Root-level Nunjucks page like `index.njk`/`feed.njk`: `{% extends "base.njk" %}`,
frontmatter `permalink: /tags/`, `title: The Cross-Filing Index`,
`eleventyExcludeFromCollections: true`. No new collections or `eleventy.config.js`
changes — it consumes the existing `collections.tagCloud` and `collections.posts`.

Structure:

- **Header** — category-page shape (`.cat-header`-style): kicker "Filed under many
  headings", `<h1>The Cross-Filing Index</h1>`, one short intro line.
- **Chip row** — one `<button type="button" data-tag="<name>" aria-pressed="false">` per
  entry in `collections.tagCloud` (already sorted count desc, then name). Buttons, not
  links: tapping toggles a filter, it doesn't navigate. Styled to match the existing
  `.cloud` tag treatment.
- **List** — every post in `collections.posts` (real posts only, newest first), using the
  category pages' generic `<article>` markup (stretched link, title, dispatch №/date,
  tags, description, "View the account") **plus** the category chip from the home list,
  since this list spans categories. Each article carries
  `data-tags="tag1,tag2"` (comma-separated — a future multi-word tag can't break it).
- Loads `/assets/js/tags-filter.js` at the end of the content block (same pattern as
  `search.js` on the home page).

### `assets/js/tags-filter.js` (new, ~40 lines, vanilla)

- On load: parse `?tags=` (comma-separated, URL-decoded) from `location.search`; set
  matching chips to `aria-pressed="true"`; unknown tags are silently ignored. Apply filter.
- On chip click: toggle `aria-pressed`, re-apply filter.
- Filter: collect pressed chips' `data-tag` values. None pressed → remove `hidden` from
  every article. Otherwise an article is visible iff its `data-tags` (split on commas)
  intersects the selection. Hiding uses the `hidden` attribute.
- After every toggle, `history.replaceState` rewrites the URL to `/tags/?tags=a,b`
  (URL-encoded) or bare `/tags/` when nothing is selected — filtered views are shareable.

### Link wiring (edits to existing templates)

- `index.njk` tag cloud, `post.njk` "Cross-filed under", `category.njk` entry tags:
  `href="/tags/?tags={{ t | urlencode }}"` replacing `href="#"`.
- `_includes/partials/footer.njk`: add `<a href="/tags/">Cross-Filing Index</a>` to
  `.fnav` with the same `current`-class check the other footer links use.

## No-JS and edge behavior

- Without JavaScript the page is a complete archive listing (all posts, newest first);
  chips render but don't toggle. Pre-selection degrades to "show all" — never broken/empty.
- A post with no tags appears in the unfiltered view and never matches a filter.
- Tag names are URL-encoded in links and decoded in the script; comparison is exact
  (tags in frontmatter are already lowercase single words today).

## Verification

1. `npx @11ty/eleventy` — confirm `_site/tags/index.html` exists, contains one chip per
   tagCloud entry and every real post with correct `data-tags`; confirm the three formerly
   dead tag-link groups now point at `/tags/?tags=...` and the footer link renders.
2. `npm run serve` click-through: toggle chips (OR behavior, URL updates via
   replaceState), load `/tags/?tags=<tag>` directly (pre-selected), follow a tag link
   from a post, empty selection shows all.
3. No new automated tests: the filter is DOM behavior and the repo has no DOM test
   harness; the static data it relies on is verified at build in step 1.

## Docs to update

- `docs/designSpecifications-updated.md`: add the Cross-Filing Index page pattern and
  terminology (keep-in-sync convention). `site-integrations.md` unaffected (nothing
  external).
