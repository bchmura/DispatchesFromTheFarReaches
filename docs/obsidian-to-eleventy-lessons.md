# Lessons Learned: Pulling Obsidian Content into Eleventy

This document is a handoff from a prior project (an Eleventy site built from an Obsidian vault) to a new, unrelated project doing the same kind of integration. It has **no domain-specific content** — no frontmatter field names, no layout names, nothing tied to the old project's subject matter. It is purely about the mechanics of getting Obsidian markdown to render correctly and predictably in Eleventy. Assume single-repo layout (vault and Eleventy config live together), not a sibling-repo split.

## 1. Obsidian syntax that markdown-it (Eleventy's default renderer) does NOT understand

Obsidian extends plain Markdown. Eleventy's default `markdown-it` parser does not know these extensions exist — they will render as literal text unless you add a plugin or a transform.

- **Wikilinks (`[[Page Name]]`)** — not parsed at all by default. If the vault uses these for internal links, you need `markdown-it-wikilinks` (or similar) registered in the Eleventy config, or you must require authors to use standard `[text](/path)` links instead. Decide this early — retrofitting is a big find/replace across the vault.
- **Wikilink embeds (`![[path/to/image.png]]`)** — also not parsed. Standard Markdown image syntax (`![alt](/path.png)`) works; embed syntax does not. If the vault content was authored in Obsidian with embeds, either transform them or enforce plain Markdown image syntax as a content-authoring rule.
- **Callouts (`> [!note] Title`, `> [!warning]-`, etc.)** — parsed by markdown-it as an ordinary blockquote. Obsidian's callout types, aliases, and foldable `+`/`-` suffixes have no built-in equivalent. If callouts matter, you need a client-side (or build-time) transform that detects blockquotes whose first line matches `[!type]` and rewrites them into styled markup. Decide whether folding/collapsing needs to work with JS disabled — a pure client-side transform means it doesn't.
- **Mermaid diagrams (` ```mermaid ` fenced blocks)** — markdown-it just renders them as a `<pre><code class="language-mermaid">` block; there is no diagram rendering without extra work. If diagrams are used, plan for either a build-time render (e.g. `@mermaid-js/mermaid-cli`) or a client-side dynamic import that runs `mermaid.run()` only on pages that actually contain a diagram. **Do not** rely on Mermaid's `startOnLoad: true` if you're dynamically importing the library — that fires on the page's `load` event, which will already have passed by the time the dynamic import resolves, so diagrams silently never render.
- **Regular blockquotes vs. callouts** — if you add callout transforms, make sure the transform runs before any blockquote styling is applied, and structure the CSS/transform so that anything left as a plain `<blockquote>` after the callout pass is guaranteed to be a real quote, not a mis-parsed callout. Otherwise you'll get double-styled or unstyled elements.

## 2. Frontmatter and directory-level defaults

- Obsidian users will not (and should not have to) repeat the same frontmatter on every page in a section. Use Eleventy's **directory data cascade**: drop a `<dirname>.json` file in a folder (e.g. `blog/blog.json`) to set defaults (layout, tags, etc.) for every page in that directory and its subdirectories. This lets content authors write plain `.md` files with only page-specific frontmatter (title, date) and inherit everything else.
- Decide and document a **visibility/draft flag convention** (e.g. a boolean like `is_public` or `draft`) early, and filter every collection on it consistently. It's easy to add a new collection later and forget the filter, leaking draft content into a listing.
- If pages can be reordered independent of their natural sort (date, alpha), add an explicit **weight/priority field** with a numeric default, and always sort collections by weight first, then the natural key. This gives content authors manual control without needing to rename files.
- Watch for **frontmatter type coercion surprises**: YAML will interpret `Yes`/`No`, unquoted numbers-that-look-like-strings (e.g. a version or ID field), and dates inconsistently. If a field must stay a string (e.g. a record count that could be "0" or blank), quote it in the frontmatter and document that convention for content authors.
- If pages use a "promote a leaf page to a folder with children later" pattern (single `.md` file today, `folder/index.md` tomorrow), confirm both produce the identical URL — this is what lets you restructure content later without breaking existing links. Test this before it matters, not after someone reorganizes the vault.

## 3. Wiring Eleventy to read from the vault

- **Collection globs must match how Eleventy resolves paths.** If your vault content lives under a subdirectory relative to Eleventy's input root, your `getFilteredByGlob()` (or equivalent) calls must include that subdirectory prefix — glob patterns are matched against the resolved `inputPath`, not a path relative to the folder you "feel like" you're in.
- **Passthrough copy filters must not be too broad.** A passthrough copy configured to copy the whole input directory (rather than a specific subfolder) risks accidentally matching Eleventy's own output directory if input and output paths overlap or are nested — this causes Eleventy to try to copy files it just wrote back in as if they were sources, producing `ENOENT` or infinite-loop-like errors. Scope passthrough `filter` functions and source paths as narrowly as possible (e.g. only image/PDF extensions, only specific folders).
- **Confirm build success by output message, not exit code, if the vault has any known-quirky content.** Some Eleventy setups exit non-zero even on a successful build (e.g. due to a plugin warning). If that's the case here too, tell the build script/CI to check for the "Wrote N files" success line rather than trusting `$?`.

## 4. Image and asset paths

- Obsidian typically stores images alongside notes or in a single vault-wide attachments folder, referenced by bare filename or vault-relative path. Eleventy needs absolute site-root paths (`/images/foo.png`) or a passthrough copy that preserves the same relative structure the vault uses. Pick one convention (rewrite links vs. preserve vault paths via passthrough) and apply it consistently — don't mix.
- If you rewrite embed syntax to standard Markdown image syntax (per section 1), do it as an explicit transform/plugin step, not a one-time manual edit — new vault content will keep using Obsidian syntax as long as authors use Obsidian to write it.

## 5. General process notes

- **Get the callout/wikilink/mermaid decisions made before content authors write a lot of pages.** Retrofitting syntax conventions across dozens of existing vault files is the most tedious part of this kind of migration — cheaper to decide early which Obsidian-only syntax is allowed and which must be avoided in favor of plain Markdown.
- **Any client-side content transform (callouts, etc.) needs a clear ordering contract** with other client-side scripts that touch the same DOM (search indexing, table-of-contents generation, etc.) — run transforms that change markup structure before scripts that read that structure.
- When something in the vault renders wrong, check in this order: (1) is this Obsidian-only syntax markdown-it doesn't know? (2) is a directory cascade JSON setting an unexpected default? (3) is the collection glob/filter excluding or including the page unexpectedly? Most rendering bugs in this kind of pipeline trace back to one of those three.
