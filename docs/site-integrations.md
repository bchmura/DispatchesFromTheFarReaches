# Site integrations — RSS, contact form, favicons, deployment

This covers the "wired up to real services" parts of the live Eleventy build that aren't
covered by `designSpecifications-updated.md` (visual/voice) or `obsidian-to-eleventy-lessons.md`
(vault-to-Eleventy mechanics). **No passwords, SSH private keys, or other secrets are stored
anywhere in this repo or in this doc** — see the Deployment section for exactly where each
credential actually lives.

## RSS / Atom feed

- `@11ty/eleventy-plugin-rss` is installed and registered in `eleventy.config.js` (dynamic
  `import()` inside the async config function, since the plugin is ESM-only and the config file
  is CommonJS).
- `feed.njk` renders `/feed.xml` from `collections.posts` (already sorted newest-first, already
  excludes category-index and project-journal-entry pages), capped at the 20 most recent items.
- `_data/site.json` holds `url` and `description`, used to build absolute links in the feed.
  `url` is currently `https://dispatchesfromthefarreaches.com` — update this if the domain ever
  changes.
- The footer's "RSS" link and a `<link rel="alternate">` in `_includes/partials/head.njk` both
  point at `/feed.xml`.

## Contact form (Web3Forms)

- `_includes/contact.njk` posts to Web3Forms via a hidden `access_key` input plus a hidden
  honeypot checkbox (`name="botcheck"`). The access key is a **public, client-side key by
  design** (Web3Forms' whole model is a key embedded in static HTML) — it is not a secret and is
  fine to have committed in the template.
- `assets/js/contact-form.js` submits via `fetch()` (no page navigation), shows inline status
  text, and on success runs a 5-second countdown ("Returning you to the main page in 5…") before
  redirecting to `/`. The countdown digit is wrapped in `<strong class="countdown-num">`, styled
  in brass + `var(--serif-display)` to stand out.
- `DFTFR-Obsidian/Website/Contact/thankyou.md` (layout `_includes/thankyou.njk`) is a
  same-themed confirmation page built at `/contact/thankyou.html` — this exact path is set as
  Web3Forms' redirect URL in their dashboard, used only as a fallback for non-JS form posts
  (the JS path never navigates there since it redirects to `/` itself after the countdown).
- Testing note: Web3Forms sits behind a Cloudflare bot challenge, so hitting the API with `curl`
  from a script gets blocked outright — that's expected, not a sign of misconfiguration. Verify
  by actually submitting the form in a browser.

## Favicons

- Source files live in `assets/favicon/` (favicon.ico, favicon.svg, the 16/32/48 PNGs,
  apple-touch-icon.png, android-chrome-*.png, site.webmanifest).
- `eleventy.config.js` has a loop that adds one passthrough-copy rule per file in that folder,
  copying each straight to the **site root** (`/favicon.ico`, not `/assets/favicon/favicon.ico`)
  — several of these are looked up at fixed root paths by browsers/OS regardless of `<link>`
  tags, and `site.webmanifest` already references its icons as root-relative paths.
- Any generation/instruction notes for a new favicon set should go in `docs/`, not
  `assets/favicon/` — a stray `favicon.md` in that folder would otherwise get copied straight
  onto the live site.
- The `<link rel="icon">` / `<link rel="apple-touch-icon">` / `<link rel="manifest">` /
  `theme-color` tags live in `_includes/partials/head.njk`.

## Photo pipeline (S3 + CloudFront originals, treated thumbnails in Git)

- Full-resolution originals live in `photos-source/` at the repo root (gitignored, never
  committed), mirroring the site's category/slug layout: `photos-source/<category>/*.jpg` for
  flat categories (Professional/Philosophy/Family/Fiction/Misc), and
  `photos-source/exposures/<gallery-slug>/*.jpg` / `photos-source/projects/<project-slug>/*.jpg`
  for the two "nested" categories, where each post is its own subfolder both in the vault
  (`Exposures/<slug>/index.md`, `Projects/<slug>/index.md`) and for its images. Which categories
  are flat vs. nested is defined once, in `scripts/photos/lib/categories.js`'s
  `FLAT_CATEGORY_DIRS`/`NESTED_CATEGORY_DIRS`, and every other part of the pipeline (passthrough
  copy, `photos:thumbs`, the inline-photo transform, the build validator) derives from that same
  map — adding a category never means duplicating this decision.
- `npm run photos:thumbs` (local, no AWS needed) reads EXIF into `_data/photoMeta.json` and
  writes a treated thumbnail (default `sepia`; override per post via a `photoTreatment`
  frontmatter field) into the matching `DFTFR-Obsidian/Website/<Category>/` (or
  `.../<Category>/<slug>/` for nested categories) folder — the exact path the existing
  passthrough-copy rules in `eleventy.config.js` already serve, so no build config changes are
  needed as photos are added. If a thumbnail file already exists but has no `_data/photoMeta.json`
  entry (e.g. it was placed there by hand), the script backfills the EXIF entry without
  re-encoding the image.
- `npm run photos:upload` scrubs sensitive EXIF fields (GPS, camera/lens serial numbers) from the
  files in `photos-source/` in place, sets `Copyright`/`Artist`/`OwnerName` to "Dispatches from
  the Far Reaches", and syncs them to
  `s3://$PHOTOS_S3_BUCKET/<category>/<filename>` (or `.../<category>/<slug>/<filename>` for
  nested categories) — directly at the bucket root, no path prefix. Requires the
  `PHOTOS_S3_BUCKET` environment variable (the **plain bucket name**, e.g.
  `cdn-dispatches-023345616863-us-east-1` — **not** the full `arn:aws:s3:::...` ARN; the AWS CLI
  rejects an ARN there with a parameter-validation error) and a working local AWS CLI profile —
  **AWS credentials are never stored in this repo**, same pattern as the DreamHost deploy key
  below.
- `npm run photos:publish` chains both scripts plus a git commit + push, for the "ready to ship"
  moment. `publish.js`'s `hasStagedChanges()` check means it no longer hard-fails when
  `photos:thumbs` makes no changes — it logs "Nothing new to commit... continuing to upload" and
  proceeds straight to `photos:upload`/`git push` instead of crashing on `git commit`'s "nothing
  to commit" exit code (this was a real bug, fixed after being hit in practice). `git push` still
  requires the machine running it to have git already authenticated with GitHub (SSH key or
  `gh auth login`) — a "Permission denied (publickey)" failure there is a local git/GitHub setup
  issue, not a photo-pipeline bug.
- The enlarged/full-size photo a reader sees on click is served from CloudFront at
  `_data/site.json`'s `photosCdnBase` + `/<category>/<filename>` — true color, untreated. Only
  the small thumbnail gets the sepia/B&W/etc. treatment. **Set the real CloudFront domain in
  `_data/site.json`'s `photosCdnBase` field** — it currently still holds the literal placeholder
  `https://REPLACE_WITH_CLOUDFRONT_DOMAIN.cloudfront.net`, which must be replaced with the real
  distribution domain (no path prefix needed — it must match the bucket-root upload path above)
  before enlarged-photo links will work in production.
- CI never touches `photos-source/` or AWS: the GitHub Actions build only ever sees what's
  already committed (the treated thumbnails + `_data/photoMeta.json`).
- Exposure Series entries have no manual `num` field — "Exposure I/II/III…" labels come from each
  entry's **position in the frontmatter's own `exposures` list** (via the `toRoman` filter), the
  same order the author wrote them in. An earlier version sorted by each photo's EXIF capture date
  instead (`sortExposuresByCaptured`, `scripts/photos/lib/exposure-order.js`) — that function is
  still there and still tested, just no longer called from either template, since the author
  prefers to control display order directly in the markdown rather than have it re-derived from
  capture date.
- **The /exposures/ listing's card image** (`_includes/category.njk`'s `exposures` branch) comes
  from `coverImageSrc`, computed per-gallery in `_data/eleventyComputed.js`. It defaults to the
  first exposure in the gallery's written order; a gallery can override this with a `coverImage:
  <filename>` frontmatter field (one of that gallery's own image filenames) to show a different
  photo as its listing thumbnail instead. Falls back to the plain placeholder card (no `<img>`) if
  the chosen filename has no generated thumbnail yet, same as everywhere else a photo can degrade
  gracefully.
- **Single-exposure pages are real per-photo URLs, not a modal** (redesigned from the original
  `<dialog>` popup): `/exposures/<gallery-slug>/<n>/`, where `<n>` is the 1-based position in the
  frontmatter's written order (matching the "Exposure I/II/III…" numbering above). Worth
  understanding in full before touching this again.
  - `eleventy.config.js`'s `exposureEntries` collection flattens every gallery's `exposures` array
    (in written order) into one entry per photo — each carrying its own `url`, `prevUrl`/`nextUrl`
    (`null` at either end of the series), the resolved `photoMeta` record, and the CloudFront
    `imageSrc` (true color, not the treated thumbnail). It numbers entries the same way
    `_includes/exposure-series.njk` numbers the grid, so the numbering always agrees between the
    two pages.
  - `exposure-pages.njk` (repo root, alongside `feed.njk`) is a single Eleventy **pagination**
    generator — `pagination: { data: collections.exposureEntries, size: 1, alias: "item" }` with
    `permalink: "{{ item.url }}"` — that produces one output page per array entry, laid out by
    `_includes/exposure-detail.njk`. There's no per-exposure content file in the vault; the array
    entry *is* the page's data. `_data/eleventyComputed.js`'s `title` function computes the
    `<title>` from `data.item` for the same reason (this page type has no frontmatter title of its
    own).
  - `_includes/exposure-detail.njk` extends `base.njk` like every other page (real nav header +
    footer), then renders a two-pane full-screen layout: `.exposure-stage` (the photo, capped to
    the viewport) on the left with on-screen prev/next arrow buttons, `.exposure-sidebar` on the
    right with an explicit "Return to the collection" link, the title/description/tags, and the
    capture-data spec stack. `assets/js/exposure-nav.js` reads `data-prev`/`data-next`/`data-exit`
    off the page's `.exposure-view` wrapper to wire up `←`/`→`/`Esc` keyboard navigation.
  - **Navigation stops at the ends** (no wraparound) — `prevUrl`/`nextUrl` are `null` on the
    first/last exposure, which renders the corresponding arrow as a disabled `<span>` instead of a
    link. The "Return to the collection" link and `Esc` key work regardless of position, so there's
    always a way out even at an end.
  - **Every capture-data field is always shown, one per line** (`.spec-row`), even when absent —
    an absent field reads `missing` in dim italic rather than being omitted. This replaced an
    earlier flex-wrap "only show what's present" layout; showing all six consistently reads more
    like a catalogue card and was simpler than reconciling wrap behavior across photos with
    different field combinations. Fields are genuinely, legitimately absent depending on what a
    given photo's camera recorded (confirmed in practice: a Fujifilm X100V has no Lens field at all
    since it's a fixed-lens camera; some photos have zero EXIF whatsoever) — `missing` communicates
    that plainly instead of leaving a blank-looking gap.
  - The collection page (`_includes/exposure-series.njk`) is a 4-column grid of thumbnails styled
    as 35mm slide mounts (`.slide` / `.frame`) — a cream cardboard mount with equal padding on all
    sides around the sepia thumbnail, and the position printed small in the mount's own corner
    (`.slide-code`, e.g. "No. 3") rather than as a caption. Each mount is a single `<a>` to its
    `/exposures/<slug>/<n>/` page.
- **Referencing a photo that isn't this post's own** (e.g. embedding one gallery's photo from an unrelated Misc post) is supported without going through the treatment pipeline at all: write a plain relative path from the referencing post to wherever that image actually sits in the vault (e.g. `![Alt](../Exposures/some-gallery/DispatchesFromTheFarthestReaches-110107-05.jpg)`), and the `photo-links` transform in `eleventy.config.js` (via `siteUrlForVaultImage` in `scripts/photos/lib/categories.js`) resolves it against the *source file's* own vault location and rewrites it to the real site URL that image lands at — not the treated/thumbnailed version, the file as passthrough-copy already places it. Obsidian's own `![[filename.jpg]]` / `![[filename.jpg|alt]]` wikilink-embed syntax works the same way for either case (same-directory or cross-directory) — `scripts/obsidian-embeds.js` rewrites it to standard `![alt](target)` before anything else runs, so both syntaxes end up going through identical handling.
- **Known cleanup items in `DFTFR-Obsidian/Website/Exposures/` as of this writing** (worth
  resolving before/during a redo, not touched automatically since they look like in-progress
  reorganization rather than something safe to guess about):
  - Three loose `.jpg` files sit directly in `Exposures/` (not inside any gallery subfolder) —
    leftovers from before galleries were moved into their own subfolders.
  - Two subfolders, `Exposures/mechanisms/` and `Exposures/misc/` (and their `photos-source/`
    counterparts), contain photos but have no corresponding `index.md` — nothing renders them.
  - `_data/photoMeta.json` has some stale flat-format keys (e.g.
    `exposures/DispatchesFromTheFarthestReaches-090419-01.jpg`, no gallery-slug segment) left over
    from before the nested-subfolder restructuring — harmless (nothing looks them up anymore),
    but dead weight.

## Deployment — GitHub Actions → DreamHost

`.github/workflows/deploy.yml` runs on every push to `main` (and manually via
`workflow_dispatch`):

1. `actions/checkout` → `actions/setup-node` (Node 24) → `npm ci` → `npm run build`
   (`eleventy && pagefind --site _site`).
2. Writes an SSH private key to `~/.ssh/id_ed25519` from the `DREAMHOST_SSH_KEY` **GitHub
   Actions secret**, and pins DreamHost's host key inline in the workflow (a public value, safe
   to commit).
3. `rsync -avz --delete` from `_site/` to
   `/home/curatebot_9sxtzf/dispatchesfromthefarreaches.com/` on
   `pdx1-shared-a1-24.dreamhost.com`, excluding `.htaccess` and `.well-known` so anything
   DreamHost manages there survives a sync.

**Where the credentials actually live (and don't):**
- The deploy keypair (ed25519, comment `github-actions-deploy`) was generated locally, its
  private half was pasted directly into the GitHub secret `DREAMHOST_SSH_KEY` (Settings →
  Secrets and variables → Actions) and never committed to any file in this repo.
- The public half is appended to `~/.ssh/authorized_keys` on the DreamHost account
  (`curatebot_9sxtzf`) — that's the only place it's installed.
- The DreamHost account **password** was used once, interactively, by the repo owner directly in
  their own terminal to install that public key — it was never typed into an agent-run command,
  never written to a file, and isn't recorded anywhere in this repo or its docs.
- If the deploy key is ever rotated: generate a new keypair, add the new public key to
  `~/.ssh/authorized_keys` on DreamHost (append, don't just replace, until the new one is
  confirmed working), update the `DREAMHOST_SSH_KEY` secret, then remove the old public key line.

**Known quirk:** an early deploy run failed with `ssh: connect ... Connection timed out` — a
network-level timeout (not an auth rejection) suggesting DreamHost or an upstream network was
momentarily dropping SSH connections from GitHub Actions' runner IP ranges. Manual SSH from the
repo owner's own machine worked immediately throughout, which is what pointed at an IP-based
network issue rather than a key/config problem. Subsequent runs (after a Node-version bump and,
separately, an unrelated content push) succeeded end-to-end and the site now deploys reliably —
but if `Connection timed out` reappears, that's the first thing to suspect again, and DreamHost
support is the right contact (they can see their own edge/firewall logs; this repo has no
visibility into that).

If DreamHost ever blocks GitHub's IP ranges outright and won't budge, the fallback plan
discussed (not implemented) is switching from a **push** model (GitHub → SSH → DreamHost) to a
**pull** model (a cron job or webhook on DreamHost that runs `git pull` + build itself) — that
only needs outbound connections initiated by DreamHost, which wouldn't hit the same restriction.
