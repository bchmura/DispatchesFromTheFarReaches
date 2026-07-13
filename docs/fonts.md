# Fonts in use — "Dispatches from the Far Reaches" (redesign pass)

All families originate from Google Fonts but are **self-hosted** — no request to Google at page load. Sizes are in `rem` (root = browser default 16px). Body/prose sizes were deliberately bumped from the originals because EB Garamond runs small on the em.

## Load (self-hosted)

- The woff2 files live in `assets/fonts/` (latin + latin-ext subsets, downloaded from Google Fonts' css2 API with a woff2-capable user agent, `font-display: swap` preserved).
- The `@font-face` rules sit at the **top of `assets/css/site.css`** (single-stylesheet convention). Each rule keeps Google's original `unicode-range`, so a subset file only downloads when a page actually uses its characters — latin-ext, italics, and Kalam cost nothing on a typical page view.
- `_includes/partials/head.njk` preloads the three faces every page renders with (IM Fell English 400, EB Garamond 400, Fragment Mono 400 — latin subsets). Font preloads need the `crossorigin` attribute even same-origin.
- **EB Garamond is a variable font**: one file covers weights 400–500, declared as `font-weight: 400 500;` in a single rule per subset.
- **Kalam** (400 + 700) is used only inside Mermaid diagrams (`assets/js/mermaid-render.js` sets it as the diagram `fontFamily`); the browser fetches it on demand the first time a diagram renders — it is deliberately *not* preloaded.
- To add a weight/family: fetch the css2 URL for it with a browser user agent, save the woff2(s) into `assets/fonts/`, and append the rewritten `@font-face` block(s) to the top section of `site.css`.

## CSS variables

```css
--serif-display: 'IM Fell English','Iowan Old Style',Palatino,serif;
--serif-body:    'EB Garamond',Georgia,serif;
--mono:          'Fragment Mono',ui-monospace,'Cascadia Mono',Menlo,monospace;
```

## The three families

| Variable | Family | Fallbacks | Weights loaded | Used for |
|---|---|---|---|---|
| `--serif-display` | **IM Fell English** | Iowan Old Style, Palatino, serif | 400 (+ italic) | All headings + the drop-cap. **Never** for running or italic body text. |
| `--serif-body` | **EB Garamond** | Georgia, serif | 400, 500, 400 italic | All running prose, blockquotes (italic), search input. |
| `--mono` | **Fragment Mono** | ui-monospace, Cascadia Mono, Menlo, monospace | 400 (+ italic) | All metadata: nav, kickers, dates, dispatch/accession numbers, category chips, tags, CTAs, footer, stamp text. |

**Key rule:** IM Fell italic is hard to read at paragraph scale — blockquotes use **EB Garamond italic**, not Fell.

## IM Fell English (display) — weight 400

| Element | Size | Notes |
|---|---|---|
| Brand wordmark (`.brand`) | 1.1rem | |
| Hero `h1.title` | clamp(2.1rem, 4.4vw, 3.4rem) | line-height 1.08; `em` is italic + brass |
| Article `h1` | clamp(2rem, 4.2vw, 2.9rem) | |
| About `h1` | clamp(1.9rem, 3.6vw, 2.6rem) | |
| Project `h1` | clamp(1.9rem, 3.8vw, 2.7rem) | |
| Section headings (`.section-head`) | 1.5rem | |
| Featured card `h3` | 1.7rem | |
| Homepage list `h3` | 1.15rem | |
| Article body `h2` | 1.6rem | |
| Journal `h3` | 1.28rem | |
| Prev/next `h4` (`.art-nav`) | 1.05rem | |
| Drop-cap initial (`.lede::first-letter`) | 4.4rem | brass, floated |

## EB Garamond (body)

| Element | Size / line-height | Notes |
|---|---|---|
| Global `body` default | — / 1.6 | inherited baseline |
| Article body `p` | 1.24rem / 1.72 | |
| Article lede `p.lede` | 1.4rem / 1.62 | |
| Article blockquote | 1.34rem / 1.6 | **italic** |
| Article correspondence line `p` | 1.12rem | |
| About `p` | 1.18rem / 1.72 | |
| Project intro `p` | 1.14rem | |
| Journal `p` | 1.1rem / 1.66 | |
| Search input | 0.92rem | italic placeholder |

## Fragment Mono (metadata) — uppercase + letter-spacing

| Element | Size | Notes |
|---|---|---|
| Nav links | 0.64rem | |
| Kicker / eyebrow | 0.7rem | |
| Category chip (`.tag`) | 0.64rem | fixed box 128×24px |
| Dates / dispatch numbers | 0.68–0.72rem | |
| Accession call-number line | 0.62rem | |
| Tags / tag cloud | 0.64rem | cloud `.freq-2` bumped to 0.88rem |
| Readlink CTA | 0.75rem | |
| Article CTA label ("Send word") | 0.82rem | |
| Footer credit | 1.1rem | |
| Footer nav (`.fnav`) | 0.72rem | |
| Category strip (`.cats a`) | 0.68rem | |
| Restricted-stamp `<textPath>` | 8.1px | inline SVG |

## Migration note

The split maps cleanly to three type scales (display / body / mono) if you're moving to design tokens. Only the body/prose sizes changed from the original comps — headings and metadata are largely as before, just rendered in the new families.
