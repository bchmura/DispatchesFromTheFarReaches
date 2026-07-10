# Design: Migrate mockups + Obsidian vault into a working Eleventy site

## Goal

Turn the static HTML mockups in `mockups/` and the Obsidian vault content in
`DFTFR-Obsidian/Website/` into a real Eleventy site that builds and renders
locally. GitHub Actions CI/deploy is explicitly out of scope for this pass —
a fast follow-on once the local build is solid.

## Constraints (from the user and CLAUDE.md)

1. No HTML markup inside Obsidian markdown files.
2. Layouts must be reusable — header/nav/footer written once, not per page.
3. Layout selection happens via frontmatter in the vault markdown files
   (edited directly, not worked around).
4. Home page has a working local search (Pagefind), styled as the mockup's
   "compuscanner" box, not a generic search widget.
5. Visual system, palette, typography, and terminology are informed by
   `docs/designSpecifications.md` — Outside of that document, the mockups have been changed and that should be adhered to over the design specification.
6. Photos referenced by the vault's old Hugo `{{< photo >}}` shortcodes will
   be supplied by the user, dropped into the **same vault folders as the
   content that references them**.

## Directory layout

**Nothing but placeholder markdown content ever gets added inside
`DFTFR-Obsidian/`.** All build machinery — layouts, includes, data files,
CSS, JS, Eleventy config — lives at the project root, outside the vault
entirely. Eleventy's input root is the *project root* (`.`), not the vault;
the vault's `Website/` folder is simply one input among several,
referenced by its full path.

```
(project root)
  eleventy.config.js         ← dir.input ".", dir.output "_site", ignores below
  .eleventyignore             ← excludes .obsidian/, Templates/, mockups/, docs/, the zip, node_modules
  _includes/
    base.njk                  ← <html> shell, loads site.css, wraps {{ content }}
    partials/
      nav.njk                   category nav, current-page highlighting
      footer.njk                 credit line + compass stamp, written once
      head.njk                   <title>/meta, shared across all pages
    post.njk                  ← Professional/Philosophy/Family/Fiction/Misc entries
    category.njk              ← listing page for one category (paginated)
    project.njk                ← project detail (journal + resources)
    exposure-series.njk       ← exposure series detail (exposures + spec popups)
    about.njk
    contact.njk
    home.njk
  _data/
    site.json                 ← site title, footer credit line
    categories.json           ← [{key,label,slug,glyph}, ...] drives nav + category.njk pagination
  assets/
    css/site.css               ← one shared stylesheet, deduped from the 21 mockup files
    js/search.js               ← Pagefind low-level API wiring for the homepage box
    js/dialog.js                ← exposure-series modal helpers (native <dialog>)
  index.njk                    ← home page: latest entries + search box (permalink "/")

DFTFR-Obsidian/                 ← untouched vault, only markdown content added
  .obsidian/                    ← ignored by Eleventy (see .eleventyignore)
  Templates/                    ← ignored by Eleventy
  Website/
    Professional/*.md           ← existing 15 posts, cleaned up (see below)
    Philosophy/*.md
    Family/*.md
    Fiction/*.md                ← 1-2 stub posts (new)
    Misc/*.md
    Projects/*.md               ← 1-2 stub projects (new)
    Exposures/*.md              ← 1-2 stub series (new)
    About/about.md
    Contact/contact.md
```

Every `.md` file's own frontmatter carries `layout:` and `category:`
directly (e.g. `layout: post.njk`, `category: professional`) — per
constraint #3, this is an edit to the content file's frontmatter, not a
separate config file, so it's still "just content" living in the vault.
No per-directory JSON cascade files are added inside the vault to do this
job instead.

`.eleventyignore` (at the project root) explicitly excludes
`DFTFR-Obsidian/.obsidian`, `DFTFR-Obsidian/Templates`,
`DFTFR-Obsidian.zip`, `mockups/`, `docs/`, and `node_modules/` — since the
input root is now the whole project, these all need an explicit ignore
rather than falling outside the input tree automatically.

## Templating & CSS

**Nunjucks**, not Liquid — this design leans on includes/partials and
pagination in a way Liquid handles more awkwardly. Nunjucks is also
Eleventy's default, so no extra dependency.

**One shared `assets/css/site.css`**, mechanically extracted from the
*-claudedesign* mockup files' tokens and components — no visual changes
during extraction. Per constraint #5, the mockups themselves (not
`docs/designSpecifications.md`) are read directly as the source of truth
wherever the two disagree, since the mockups have moved on since that doc
was last written.
This directly forecloses the footer-padding / hero-width specificity bugs
CLAUDE.md already flags as recurring — there's only one copy of `.wrap`,
one copy of the indent rule, one copy of everything, so a fix only needs to
happen once.

*Alternatives considered:* Liquid templates (rejected — weaker
include/macro support for the amount of partial-reuse this needs) and
"keep per-mockup inline CSS, just add Nunjucks includes for nav/footer"
(rejected — reintroduces exactly the duplicated-token drift that caused the
footer/hero bugs in the first place).

## Collections, URLs, and content modeling

- URL scheme: **`/category/slug/`** (e.g. `/professional/fear-prevents-change/`).
  Category folder name lowercased via a Nunjucks filter for the URL segment;
  filename slugified for the rest. Vault folder names stay capitalized
  (`Professional/`) for Obsidian's own UI — only the *URL* is lowercased.
- No directory-data cascade — each `.md` file's frontmatter carries its own
  `layout` and `category` fields directly (see Directory layout above),
  since only markdown may live inside the vault.
- **Projects** and **Exposure Series** are modeled as one markdown file per
  project/series, with journal entries / individual exposures as a
  structured frontmatter list (not separate files per entry). This matches
  the mockups ("journal + resources" on one project page; "series +
  exposures" on one series page) without inventing a nested-folder /
  per-item file structure that only pays off once there's a much larger
  volume of entries than the 1-2 stubs we're seeding now.
- **Home, About, Contact** are not vault "notes" in the diary sense:
  - `About/about.md` and `Contact/contact.md` are real vault markdown
    files (frontmatter picks the `about.njk` / `contact.njk` layout) — kept
    as markdown per rule #1, even though they're single pages.
  - The home page (`index.njk`) is a template, not vault content — it's a
    computed page (latest entries across all categories + search box), not
    an authored note, so it lives directly under `Website/` as `.njk`.
- Category listing pages (`/professional/`, `/exposures/`, etc.) are
  produced by **one paginated `category.njk` template** driven by
  `_data/categories.json`, rather than one listing file per category.

## Photos / images

User will drop real image files into the same vault folder as the content
referencing them (e.g. `Family/001.jpg` next to `Family/vacation_rocks.md`).

- Passthrough copy is configured entirely in the root `eleventy.config.js`
  — one explicit mapping per category folder, e.g.
  `addPassthroughCopy({"DFTFR-Obsidian/Website/Family/*.{jpg,jpeg,png,gif,webp}": "family"})` —
  rather than a single whole-vault glob, per the known ENOENT/broad-passthrough
  footgun. This also gives predictable output paths (`/family/001.jpg`)
  without needing any config file inside the vault itself.
- Images are referenced from markdown with **root-relative paths**
  (`![caption](/professional/001.jpg)`), matching the "pick one convention,
  apply it consistently" guidance — this also sidesteps ambiguity about
  what a relative path resolves against once permalink structure changes.
- Risk to flag during implementation: two posts in the *same* category
  folder both using a generic filename like `001.jpg` would collide at the
  output path `/category/001.jpg`. Not a problem with the current 5 photo
  references (each is a distinct filename already), but worth a naming
  convention note for future content.

## Search

**Pagefind**, run as a second build step after Eleventy finishes:

```json
"scripts": {
  "build": "eleventy && pagefind --site _site",
  "serve": "eleventy --serve"
}
```

Wired through Pagefind's **low-level JS API** (`assets/js/search.js`), not
its prebuilt default UI — so the search box keeps reading as the
"compuscanner" component from the design spec instead of a generic search
widget. `serve`/local dev runs Eleventy only (no search index) since
Pagefind needs a finished `_site/` to scan; the full `build` script is what
produces working search.

## Hugo shortcode cleanup

The vault content was authored for a prior Hugo site. Cleanup during
migration:

| Found | Fix | Result |
|---|---|---|
| `{{< plink "url" >}}text{{< /plink >}}` | rewritten | `[text](url)` |
| `{{< ref "filename" >}}` inside links | rewritten | resolved `/category/slug/` path, once slugs are final |
| `<!--more-->` | removed | `description` frontmatter already covers excerpts |
| `isDraft: true` | flipped | `isDraft: false` on all 15 affected Professional posts |
| `{{< randompic >}}` (15 occurrences) | shortcode stripped, prose kept | **no image restored** — see follow-up list below |
| `{{< photo src="X" ... >}}caption{{< /photo >}}` (5 occurrences) | rewritten | `![caption](/category/X)` — resolves once the user drops the actual image file into that category folder |
| empty `permalink:` frontmatter field | removed | permalink is computed from folder+filename per the URL scheme above |
| empty `layout:` frontmatter field | removed | layout now comes from the directory-data cascade, not per-file frontmatter |

### Follow-up list (not auto-fixable, for the user to revisit later)

- 15 `{{< randompic >}}` spots (across Professional, Philosophy, Misc,
  Family) lost their decorative image entirely — there is no equivalent
  without a real image to put there. Once the design system has a stock of
  inline-SVG or photo assets to drop in, these are the paragraphs to
  revisit.
- The stray `<br/>` tag found near two `{{< plink >}}` links in
  `Misc/the_rumours_of_my_death.md` will be replaced with a plain
  paragraph break (two consecutive links become two list items or two
  short lines) rather than left as raw HTML, per rule #1.

## Placeholder content

- **Fiction, Projects, Exposures**: 1-2 stub entries each, in-voice per the
  design spec's terminology (project statuses, "Exposure I/II" numbering,
  etc.), so the listing template, category page, and detail page all have
  something real to render against rather than an empty state.
- **About**: keeps the existing mockup's role-neutral placeholder bio
  ("The correspondent behind these dispatches") — no real name/photo yet.
- **Contact**: copy only; the `mailto:`-building form logic lives in
  `contact.njk`, not in the markdown.

## Open risk / things to validate during implementation

- Confirm the per-category explicit passthrough-copy mappings actually
  land images at `/category/filename.jpg` as designed, once the user adds
  the first real image file — object-form passthrough copy output paths
  are worth a quick smoke test rather than assuming.
- Confirm categories.json-driven pagination produces exactly 7 category
  pages (`/professional/`, `/philosophy/`, `/projects/`, `/exposures/`,
  `/family/`, `/fiction/`, `/misc/`) and not an 8th accidental page.
- Confirm `.eleventyignore` correctly excludes `DFTFR-Obsidian/.obsidian`,
  `DFTFR-Obsidian/Templates`, `DFTFR-Obsidian.zip`, `mockups/`, and `docs/`
  now that the input root is the whole project rather than just the vault
  — a miss here would make Eleventy try to process files that aren't site
  content.
