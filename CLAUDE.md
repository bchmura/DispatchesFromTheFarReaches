# MentalDrool

## Blog redesign — design system

This repo contains HTML/CSS mockups for a personal blog redesign ("Dispatches from the Far Reaches"), eventually to be built in Eleventy sourcing markdown from an Obsidian vault. Mockups live in `mockups/`.

**Before doing any design or styling work on this site**, read `docs/designSpecifications.md` first. It captures the established visual direction, color palette, typography, layout/width conventions (including a recurring CSS specificity footgun to avoid), component patterns, and terminology decisions from the mockup phase. Don't re-derive or drift from these without discussing it — treat it as the source of truth for "what this site looks and sounds like."

## Repo structure

- `mockups/` — self-contained HTML/CSS mockup files, one per page template. Each file has its own inline `<style>` (no shared stylesheet yet) — when editing a token or component convention, check whether the same fix is needed across all 8 files (this has bitten us before, e.g. the footer-padding and hero-width specificity bugs each needed fixing in multiple files).
- `docs/designSpecifications.md` — the design system reference described above. Keep it in sync when a design decision changes (renamed terminology, new component pattern, palette tweak, etc.) rather than letting it go stale.

## Working conventions for this project

- **Previewing changes:** mockups are published via the Artifact tool, not just written to disk. After editing a file, republish it with `Artifact` using the *same* `file_path` so the same shareable link updates in place rather than minting a new URL. Keep the favicon emoji stable per file once chosen (🕯️ has been used for the Archive-style pages).
- **No image generation tool is available in this environment**, and Artifacts block loading external images/fonts. All illustrations are hand-authored inline SVG in the site's palette; system font stacks only (no webfont CDNs). Don't reach for `picsum.photos` or similar placeholder-image services inside an Artifact — they won't load.
- **Iterating on feedback:** this design has gone through many rounds of small, specific fixes (spacing, alignment, wording, terminology). When given a correction, make the targeted fix rather than a broader rewrite, and check the design spec doc to see if the fix reveals a convention worth recording there.
- **Ask before assuming** on anything subjective (wording, terminology, which element "the banner" or "the content" refers to) — several past rounds of back-and-forth were because a request was interpreted too literally or too broadly on the first pass.
