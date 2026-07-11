# MentalDrool

## Blog redesign — design system

This repo is the live Eleventy build for a personal blog ("Dispatches from the Far Reaches"), sourcing markdown content from an Obsidian vault (`DFTFR-Obsidian/Website/`). It started as HTML/CSS mockups in `mockups/`; those are now superseded by the real templates in `_includes/` and are kept only for historical reference — do not treat them as current.

**Before doing any design or styling work on this site**, read `docs/designSpecifications-updated.md` first. It captures the established visual direction, color palette, typography, layout/width conventions (including a recurring CSS specificity footgun to avoid), component patterns, and terminology decisions. Don't re-derive or drift from these without discussing it — treat it as the source of truth for "what this site looks and sounds like."

**Before touching RSS, the contact form, favicons, or the deploy workflow**, read `docs/site-integrations.md` — it documents exactly how each is wired up and, importantly, where each credential lives (never in this repo).

## Repo structure

- `_includes/` — the real Nunjucks templates (layouts + partials) that render the site. This is where design/behavior changes actually happen now.
- `assets/css/site.css` — the single shared stylesheet (this replaced the old per-mockup inline `<style>` blocks; there's only one place to fix a token or component now).
- `DFTFR-Obsidian/Website/` — the Obsidian vault; markdown content + frontmatter live here.
- `eleventy.config.js` — collections, passthrough copy (including per-category and per-favicon-file rules), filters.
- `.github/workflows/deploy.yml` — builds and deploys to DreamHost on every push to `main`; see `docs/site-integrations.md`.
- `mockups/` — historical HTML/CSS mockup files from before the real build existed. Superseded; don't edit these expecting it to affect the live site.
- `docs/designSpecifications-updated.md` — the design system reference described above. Keep it in sync when a design decision changes (renamed terminology, new component pattern, palette tweak, etc.) rather than letting it go stale.
- `docs/site-integrations.md` — RSS feed, contact form (Web3Forms), favicons, and the GitHub Actions → DreamHost deploy pipeline. Keep in sync the same way.

## Working conventions for this project

- **Previewing changes to the real site:** run `npx @11ty/eleventy` (no dev server needed for a quick check) and read the generated HTML/CSS under `_site/` directly to confirm a change rendered as expected. `npm run serve` runs a live dev server if you need to click through it.
- **Previewing a brand-new mockup** (a page type that doesn't have a real template yet): publish it via the Artifact tool instead, using the *same* `file_path` on every republish so the shareable link updates in place rather than minting a new URL. Keep the favicon emoji stable per file once chosen (🕯️ has been used for the Archive-style pages). Artifacts block external images/fonts — inline SVG and system fonts only there, same as the historical mockups.
- **Iterating on feedback:** this design has gone through many rounds of small, specific fixes (spacing, alignment, wording, terminology). When given a correction, make the targeted fix rather than a broader rewrite, and check the design spec doc (or `site-integrations.md`) to see if the fix reveals a convention worth recording there.
- **Ask before assuming** on anything subjective (wording, terminology, which element "the banner" or "the content" refers to) — several past rounds of back-and-forth were because a request was interpreted too literally or too broadly on the first pass.
- **Never write passwords, private keys, or other credentials into any file in this repo** (including docs) — see `docs/site-integrations.md` for exactly where each deploy/integration credential actually lives instead.
