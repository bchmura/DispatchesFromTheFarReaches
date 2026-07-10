# Fonts in use — "Dispatches from the Far Reaches" (redesign pass)

All three families are Google Fonts. Sizes are in `rem` (root = browser default 16px). Body/prose sizes were deliberately bumped from the originals because EB Garamond runs small on the em. For an offline/perf Eleventy build, self-host the woff2 files and swap the `<link>` for a local `@font-face` block (keep the same fallbacks).

## Load (every page, in `<head>`)

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Fragment+Mono:ital@0;1&display=swap" rel="stylesheet" />
```

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
