# Design Specifications — "Dispatches from the Far Reaches"

Personal blog redesign. Static site, built with Eleventy, sourcing markdown from an Obsidian vault. This document captures the visual direction, voice, terminology, and structural conventions established during the mockup phase (HTML/CSS comps in `mockups/`) so future sessions can pick up the design without re-deriving it.

> **Revision note (redesign pass).** This version supersedes the original spec after a round of theme-deepening work. Summary of what changed, detailed in-place below:
> 1. **Typography is now webfont-based** — IM Fell English (display), EB Garamond (body), Fragment Mono (metadata). This reverses the earlier "system fonts only" rule; see Typography + Technical constraints.
> 2. **Atmosphere is now directional** — the flat corner-vignette was replaced by an off-center warm "lantern" glow with a gentle flicker animation, then softened so page edges stay readable.
> 3. **Expedition/cartography layer expanded** — compass-rose corner watermark and a ticked "map-scale" rule under section headings (prototyped on the homepage).
> 4. **New archival motifs** — accession call-numbers, a "restricted collection" ring stamp, an illuminated drop-cap, and a "Cross-filed under" tag block on articles.
> 5. **All six category glyphs now exist** (Professional/Family/Fiction/Misc added), each with its own listing page.
> 6. **Copy + link fixes** — "Plate VII" → "Exposure VII" on the homepage; em-dashes removed from Contact; all internal links wired to same-directory siblings.
> The redesign comps live alongside the originals with a `-claudedesign` suffix (e.g. `style-1-archive-article-claudedesign.html`), plus an `index.html` contents page.

## Concept

Lovecraft's Arkham/Miskatonic-era academic gothic — science and mysticism blended, filtered through an expedition/field-journal lens (Indiana Jones meets Call of Cthulhu meets a 1920s university). The chosen direction is **"The Archive"**: a candlelit special-collections reading room at night, dark ink-green and brass, with an expedition/cartography layer added on top (compass roses, map fragments, dispatch numbering).

The dread should come from the **academic-archive framing** (call-numbers, restricted stamps, catalogued dispatches), not from overt creature/tentacle iconography or quoted Lovecraft text — this keeps it tasteful and original.

Four initial style directions were mocked up and compared; **The Archive** was selected. The other three (Observatory, Occult Broadsheet, Specimen Catalog) were removed from the repo once the decision was made.

## Site identity

- **Site name:** "Dispatches from the Far Reaches" (not "The Arkham Ledger" — that name was tried and rejected; "Arkham" as a direct brand name was also rejected in favor of leaning on the expedition-journal angle instead).
- **Footer credit line:** "Research supported by the Miskatonic University Department of Unorthodox Sciences (Arkham, MA)" — appears on every page, paired with a small faint rotated stamp glyph (compass-style double ring), sized to match the adjacent RSS/About/Contact nav links (`.72rem`), not larger.
- **Categories:** Professional, Philosophy, Projects, **Exposures** (renamed from Photos), Family, Fiction, Misc.
- **Voice:** first-person, dry, observational, lightly self-deprecating. Treats the blog as a filed/catalogued record ("dispatches," "the account," "the file"). Avoid modern startup-blog phrasing; avoid actual AI-tell clichés (no em-dashes, no "Quietly in use at," no generic "Jane Doe" placeholder names, no section-number eyebrows).
- **Favicon set:** a brass compass-rose seal on the `#14150f` ink-green ground (same mark as the site wordmark), covering the standard favicon.ico/svg/PNG sizes, apple-touch-icon, and a web manifest. See `docs/site-integrations.md` for where the source files live and how they're wired into the build.

## Color palette (single-accent, dark, single-theme)

This is a deliberately single-theme design (does not adapt to light system preference) — a candlelit room at night is the whole point.

```
--bg:          #14150f   near-black warm ink
--bg-raised:   #1b2318   card/panel background
--bg-raised-2: #20291d   secondary raised surface (category strip, nav flyout)
--ink:         #e7e1cf   primary text (aged bone)
--ink-dim:     #a89f89   secondary text
--ink-faint:   #6f6a57   tertiary/metadata text
--brass:       #c19a4b   the one accent color
--brass-dim:   #8a6d34   accent borders / dimmer accent text
--rule:        #2e3324   hairline borders/dividers
```

Only brass is used as an accent; variation (status, emphasis, frequency in the tag cloud) is expressed through opacity, border style (solid/dashed), and size — not additional hues. This was an explicit call so project statuses (see below) don't need new colors.

## Typography

**Webfonts (Google Fonts), replacing the earlier system-font stacks.** The system stacks remain as fallbacks in each variable.

```
--serif-display: 'IM Fell English','Iowan Old Style',Palatino,serif;
--serif-body:    'EB Garamond',Georgia,serif;
--mono:          'Fragment Mono',ui-monospace,'Cascadia Mono',Menlo,monospace;
```

Loaded per page via:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Fragment+Mono:ital@0;1&display=swap" rel="stylesheet" />
```

- **IM Fell English** — display/headings only. A digitization of 17th-century Fell types; its inky, slightly irregular texture is a *feature at large sizes* and a legibility cost at small ones, so keep it to headings and the drop-cap.
- **EB Garamond** — running prose. Warm and scholarly, but **runs small on the em** — body copy needed bumping (see below).
- **Fragment Mono** — all metadata: category chips, dates, dispatch numbers, tags, nav links, accession lines, footer credit.

**Do not set IM Fell italic as running text** (e.g. blockquotes). It's hard to read at paragraph scale — blockquotes use **EB Garamond italic** instead.

**Size adjustments made for Garamond's small x-height** (use these as the baseline, not the original smaller values):
- Article body `p`: `1.24rem` / line-height `1.72`; lede `1.4rem`. Blockquote: Garamond italic `1.34rem`. `h2`: `1.6rem`. Drop-cap initial: `4.4rem`.
- Article "correspondence" line: `1.12rem` (CTA label `0.82rem`).
- About body `p`: `1.18rem`. Project-detail: intro `1.14rem`, journal `h3` `1.28rem`, journal `p` `1.1rem`.

> **Eleventy note:** these load from Google Fonts, so the built site needs network access at load. For offline/perf, **self-host the woff2 files** and swap the `<link>` for a local `@font-face` block; keep the same fallbacks.

## Layout system — the width/indent rule

This took several rounds to get right; the rule going forward is:

- Outer container: `.wrap` — `max-width:1180px; margin:0 auto; padding:0 24px;`
- **Every page's main content area is inset an additional 36px on the left** (`--indent:36px`, so effective left inset = 60px from the viewport-relative wrap edge), flush to the wrap's normal right edge (24px). This 60px matches the nav logo's icon+gap width, so headline text lines up with the wordmark.
- No page-specific narrower reading column. Early iterations capped the article page, About page, and Exposure Series detail page at various fixed widths (720/860/900/1040px) — **this was reversed**. Every page now spans the same effective width. Where prose needs a shorter line length for readability, cap the **text elements** (`max-width: 72–75ch` on `<p>`), not the container.
- **Known footgun:** never combine `class="wrap somethingElse"` on the same element if `somethingElse` also sets `padding` or `margin`. Two same-specificity class selectors on one element cause a shorthand collision (whichever rule is later in the stylesheet wins outright, silently zeroing the other's values). This bug recurred multiple times (footer, main, hero, breadcrumb) before the fix became standard practice. **Always nest**: `<div class="wrap"><div class="inner">...</div></div>`, never `<div class="wrap inner">`.

## Components & conventions

- **Nav:** sticky header, brand wordmark + compass-rose icon, links collapse to a hamburger below ~960px. Current-page link gets `.current` (brass).
- **Category chip (`.tag`):** fixed-size box (128×24px) regardless of label length, so "Misc" and "Professional" render as identically-sized chips.
- **Per-entry topic tags vs. category:** on the homepage, topic tags sit right-aligned on the same line as the category chip, and **crossfade into the dispatch number + date on hover** (same slot, no layout shift). On category-listing pages, the category chip is dropped entirely (redundant with the page context) and topic tags are shown plainly instead.
- **Hover-reveal pattern:** used for metadata (date/dispatch number) and calls-to-action ("View the account" / "Open the [Category] file") on list rows — hidden by default, revealed on `:hover`/`:focus-within`, with space always reserved (height fixed, opacity-only transition) so nothing shifts on reveal. Respect `prefers-reduced-motion` (disable the transition, not the functionality).
- **Dispatch numbers:** each entry can carry a quietly-revealed catalog number ("No. 214") alongside its date, reinforcing the idea that everything is filed/catalogued. Numbers descend as dates get older (higher number = more recent). Project journal entries use their own local counter (No. 1, 2, 3…) restarting per project, not the site-wide sequence.
- **Accession call-numbers (NEW):** special-collections shelf marks in Fragment Mono, brass-dim, above the title on reading/detail pages — e.g. `Miskatonic University · Special Collections · MS-214 · Folder 3` (article), `MS-P-07 · Instrument file` (project detail), `EX-08` (exposure series), and a "Correspondent, uncatalogued" bookplate variant on About. Reinforces the reading-room conceit. **Project journal entry pages** split this into two stacked lines rather than one joined line — the project title first, then "Journal entry No. N" below it — so long project titles don't wrap awkwardly against the "Journal entry No. N ·" prefix.
- **Entire-block-clickable listing rows (NEW):** every listing row/card that leads to content (article-index rows, the homepage featured post and "continues" list, project journal entries) is clickable across its whole area, not just its "View the account"/"View this journal entry" text link — via an absolutely-positioned `.stretched-link` anchor covering the row, with the real inline links (tags, the visible CTA) lifted above it with `z-index:1` so they stay independently clickable. Grid cards that are already a single wrapping `<a>` (project/exposure cards) don't need this treatment.
- **Restricted-collection stamp (NEW):** a faint (opacity ~.17), rotated (-11°) ring stamp reading "MISKATONIC UNIVERSITY · SPECIAL COLLECTIONS" around a small compass mark, positioned top-right of the header inner on article, About, and exposure-series pages. Hidden below 760px. Built as inline SVG with a `<textPath>` on a circle.
- **Illuminated drop-cap (NEW):** article lede's first letter floated large in brass (`::first-letter`, ~4.4rem) — opens the piece like a bound volume.
- **"Cross-filed under" (NEW):** at the article foot, a mono label followed by that article's own topic tags as small bordered chips. Replaces showing the tags in the header (removed to avoid duplication).
- **Illustrations:** no photography/raster images are available in this environment (no image-gen tool; Artifact CSP blocks external image hosts), so all imagery is hand-authored inline SVG in the brass/ink-green duotone — map fragments, compass roses, lantern glow, mountain/tent silhouettes, instrument illustrations, etc. When real content exists (Eleventy build), these slots should take real photography/scans instead.
- **Texture & light (UPDATED):** a fixed, full-viewport `body::after` overlay combines a faint SVG feTurbulence grain (very low opacity) with the room lighting. The lighting is now **directional**: a warm off-center brass glow (radial gradient centered near top-right, `rgba(200,161,86,…)`) plus a **soft** darkening gradient toward the lower-left — deliberately gentler than the original all-corner vignette so page edges stay readable. The glow carries a slow **`lanternFlicker` keyframe** (opacity drifting ~1↔.90 over ~9s) to suggest candlelight; **disabled under `prefers-reduced-motion`**.
- **Expedition/cartography layer (UPDATED):** beyond the hero mark and footer stamp — a faint compass-rose **corner watermark** (inline-SVG `body::before`, opacity ~.08, bleeding off the lower-right) and section-heading rules restyled as a **ticked "map-scale" hairline** (repeating vertical registration ticks). Prototyped on the homepage; roll across other pages if desired. Keep within the single-brass / no-photo rules.
- **Status badges (Projects):** four states plus a terminal one, styled via border-style/opacity variation (not new colors): **Theorized** (dashed, dim) → **Afoot** (solid brass, filled) → **Dormant** (muted, translucent) → **Catalogued** (dim brass, filed). **Abandoned** (struck-through, faint) is the terminal dead-end state, independent of the others. *(Note: current comps use a small color-dot `::before` indicator per status; the spec's stricter intent is to differentiate by border-style/opacity alone — prefer that if reconciling.)*
- **Modals:** native `<dialog>` element + minimal inline `onclick` JS (`showModal()`/`close()`) — no framework. Used on the Exposure Series detail page: clicking a photo opens a larger view with capture specs (camera/lens/exposure/aperture/ISO/captured) laid out in one row across the bottom.
- **Search:** homepage only, in its own bordered box (separate from, but stacked with, the tag-cloud box — together they match the featured article's height, with the tag box absorbing any extra space). Framed in-voice as "Search these writings via our compuscanner," not a generic search input.

## Terminology decisions (naming things in-voice)

- Photo albums are called **"Exposure Series"**; individual shots within one are **"Exposure I," "Exposure II"**, etc. (Originally "Plate Set" / "Plate I" — changed because "Plate" reads ambiguously out of context, e.g. dinnerware/armor.) *The stray "Plate VII" on the homepage has been corrected to "Exposure VII."*
- Project statuses: **Theorized, Afoot, Dormant, Catalogued, Abandoned** (deliberately period/expedition-flavored instead of generic "Planned/Active/Paused/Done").
- List-row calls to action: **"View the account"** and **"Open the [Category] file"** (homepage); **"View this journal entry"** (project journal entries); **"View the project"** / **"Open the exposure series"** (listing cards).
- About page section label: **"A Biographical Note"** (period-appropriate framing, not "About" or "Bio").
- Contact page: **"File a Dispatch"** (not "Contact" or "Get in Touch") — frames sending a message as filing your own entry into the archive, consistent with the site-wide cataloguing motif. The form now has a real backend (Web3Forms — see `docs/site-integrations.md`): submitting shows an inline status line, then a "Returning you to the main page in 5…4…3…2…1" countdown (the digit styled in brass, `var(--serif-display)`, standing out from the surrounding mono note text) before redirecting to `/`. A themed confirmation page also exists at `/contact/thankyou.html` (same seal-panel motif as the form's sidebar) as the Web3Forms dashboard's configured redirect target for non-JS fallback submissions. Linked only from the footer nav (not the main category nav) and from in-article links as needed. *Em-dashes in the intro/hint copy were removed to honor the no-em-dash voice rule.*

## Page templates built so far

The redesign comps carry a `-claudedesign` suffix and live beside the originals. All share the system above.

| File (redesign) | Represents |
|---|---|
| `index.html` | Contents / index of all redesign pages (utility, not part of the site) |
| `style-1-archive-claudedesign.html` | Homepage (candlelight + compass watermark + ticked rules) |
| `style-1-archive-category-claudedesign.html` | Article listing (category index) — template for the category pages |
| `style-1-archive-article-claudedesign.html` | Individual article/post reading page (accession line, drop-cap, stamp, cross-filed) |
| `style-1-archive-projects-claudedesign.html` | Projects listing |
| `style-1-archive-project-detail-claudedesign.html` | Single project (journal + resources) |
| `style-1-archive-photos-claudedesign.html` | Exposures listing |
| `style-1-archive-plateset-claudedesign.html` | Single Exposure Series (photo detail + spec popup) |
| `style-1-archive-about-claudedesign.html` | About page (bookplate line + stamp) |
| `style-1-archive-contact-claudedesign.html` | Contact page ("File a Dispatch") |
| `style-1-archive-professional-claudedesign.html` | Category page — Professional (glyph: pen nib) |
| `style-1-archive-family-claudedesign.html` | Category page — Family (glyph: house/hearth) |
| `style-1-archive-fiction-claudedesign.html` | Category page — Fiction (glyph: mask) |
| `style-1-archive-misc-claudedesign.html` | Category page — Misc (glyph: filing tag) |

**Linking (mockup phase):** all internal links were relative and same-directory, pointing at sibling `-claudedesign` files. Content-item links resolved to a representative template ("View the account"/"Read the entry" → article; "View this journal entry" → project detail; "Open the [Category] file" → that category; photo cards → exposure series; project cards → project detail). Genuinely target-less links stayed `#`: RSS, article prev/next, and individual tag links (no per-tag/per-article mock existed). **In the real build**, RSS now points at the real `/feed.xml` (see `docs/site-integrations.md`); individual tag links are still placeholder `#` (no per-tag listing page exists yet).

## Technical constraints

- **Fonts now require a network request** (Google Fonts) — this reverses the original "no external requests / system fonts only" rule. Everything else stays self-contained: all imagery is inline SVG or inline data-URI; no external scripts. **For the Eleventy build, self-host the fonts** to restore full offline behavior.
- Respect `prefers-reduced-motion` on every transition/animation (including the new lantern flicker).
- Single-theme by design (no light-mode variant) — this is a deliberate choice, not an oversight.

## Open items / known gaps

- **Category glyphs are now complete** — Philosophy (eye-in-triangle), Projects (gear/compass), Exposures (aperture), **Professional (pen nib), Family (house/hearth), Fiction (mask), Misc (filing tag)**.
- The expedition overlay (compass-rose corner watermark + ticked map-scale rules) is currently only on the **homepage** — decide whether to roll it across all pages.
- The new archival motifs (accession call-numbers, restricted stamp, drop-cap, cross-filed) are on the reading/detail pages; listing pages were kept cleaner. Decide whether accession call-numbers should also appear on listing rows.
- The four new category pages carry **invented placeholder entries** (titles + one-line summaries) so the glyphs have context — swap for real content at build.
- About page has no real name, bio, or photo yet — currently a role-neutral placeholder ("The correspondent behind these dispatches") with a labeled silhouette standing in for a real portrait, and generic LinkedIn/GitHub/contact links.
- Project status differentiation: reconcile the comps' color-dot indicator with the spec's border-style/opacity-only intent (see Status badges note).
- Whether project-journal numbering and site-wide dispatch numbering should eventually be unified (currently deliberately separate, per above).
