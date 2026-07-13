# Video support + lightbox — design

**Date:** 2026-07-13
**Status:** Approved design, pre-implementation

## Goal

Extend the photo pipeline so an mp4 dropped into `photos-source/` flows through the
same publish workflow as a photo: a treated thumbnail is generated and committed,
the video is uploaded to S3/CloudFront, and the post embeds the thumbnail. Clicking
the thumbnail opens a lightbox overlay that plays the video. Photos **outside the
Exposures category** adopt the same lightbox (showing the full-size CloudFront
image); **Exposures pages keep their current page layout and behavior** — no
lightbox there — but an Exposure Series entry may itself be a video, in which
case the single-exposure page's stage plays the video in place of the photo
(see §7).

## Decisions made during brainstorming

- **Click behavior: lightbox overlay** (chosen over open-in-new-tab and
  inline-swap alternatives).
- **Lightbox scope:** video and photo refs inline in posts outside Exposures.
  Exposures (both the series grid and single-exposure pages, and any inline
  refs on exposure posts) get **no lightbox**; inline photo refs there keep
  today's open-full-size-in-new-tab behavior.
- **Exposures can contain videos (added in review):** an exposure entry whose
  `image:` is an mp4 plays in the single-exposure page's existing stage
  (replacing the `<img>`, not the page layout).
- **Lightbox chrome stays silent** — no in-voice terminology ("Kinetoscope
  record" etc.) was added; just a close control and aria-labels.
- **Authoring flow is unchanged** — same folders, same embed syntax, same
  `photos:publish` command.

## Architecture

### 1. Shared vocabulary (`scripts/photos/lib/categories.js`)

- Add `VIDEO_EXTENSIONS = [".mp4"]` alongside `IMAGE_EXTENSIONS`.
- Add a sibling helper `isPipelineManagedVideoFilename()` (same bare-filename
  rules as `isPipelineManagedFilename()`, but matched against
  `VIDEO_EXTENSIONS`) so `content-scan.js` and `inline-photo-transform.js`
  cannot disagree about what is pipeline-managed, same as today for images.
  The image helper keeps its current name and behavior.
- Video thumbnails are named by **appending** `.jpg` to the full video
  filename (`clip.mp4` → `clip.mp4.jpg`) so a thumbnail can never collide
  with a real photo named `clip.jpg`, and the mapping is derivable in both
  directions without metadata.

### 2. Thumbnail generation (`scripts/photos/thumbs.js`)

- New dependency: **`ffmpeg-static`** (bundled ffmpeg binary — nothing to
  install locally or in CI, no admin rights needed).
- For each video source: extract a single frame ~1 second in via ffmpeg,
  then pipe that frame through the **existing** sharp steps — treatment
  (default sepia, `photoTreatment` frontmatter override honored), resize to
  640px width, jpeg quality 82. Video thumbs are visually indistinguishable
  from photo thumbs in treatment.
- The thumbnail lands in the vault next to photo thumbs and is committed by
  `photos:publish` as usual. Regeneration rules (`needsRegeneration`,
  `hasTreatmentChanged`, `photoMeta` entries) apply to videos the same way.

### 3. Upload (`scripts/photos/upload.js`)

- `aws s3 sync` already uploads everything in `photos-source/` — no change
  to the sync itself.
- Extend the exiftool metadata strip to video files (GPS, serial numbers;
  same `STRIP_AND_SET_TAGS`).
- Add a **faststart remux** for mp4s (moov atom moved to the front,
  lossless, via ffmpeg) so playback can begin before the file fully
  downloads. Applied in-place to the source, same spirit as the in-place
  exiftool strip. The remux is lossless (`-c copy -movflags +faststart`), so
  running it on every upload pass is harmless; no faststart-detection step
  is needed.
- Videos never enter git, exactly like full-size photos today.

### 4. Markdown handling

- `scripts/photos/lib/content-scan.js`: recognize video refs in posts (same
  bare-filename rules as images) so treatments/validation cover them.
- `scripts/photos/lib/inline-photo-transform.js`: a video ref renders as its
  thumbnail `<img>` (src `/<category-path>/clip.mp4.jpg`) with a small brass
  play-badge **inline SVG** overlaid (site convention: no external assets),
  wrapped in a link to the mp4's CloudFront URL.
- Lightbox markup rules in the transform:
  - Video ref (any category): lightbox-triggering markup with
    `data-lightbox="video"`.
  - Image ref, category ≠ `exposures`: lightbox-triggering markup with
    `data-lightbox="image"`.
  - Image ref, category = `exposures`: **exact current markup**
    (`<a class="photo-link" target="_blank" rel="noopener">`), unchanged.
- All lightbox-triggering anchors still carry `href` to CloudFront and
  `target="_blank" rel="noopener"` so they degrade to today's behavior
  without JavaScript.

### 5. The lightbox (new front-end piece)

- A native `<dialog>` element added once in the base layout
  (`_includes/base.njk` or a partial), plus a small dependency-free
  `assets/js/lightbox.js` wired in site-wide (same pattern as
  `callout-fold.js` / `exposure-nav.js`).
- Behavior:
  - Click on a `data-lightbox` anchor → `preventDefault()`, open the dialog
    with either a `<video controls autoplay>` or a full-size `<img>`
    pointed at the anchor's `href` (CloudFront).
  - Closing (Esc, backdrop click, close button) pauses/discards the video.
    Native `<dialog>` supplies focus handling and Esc for free.
- Styling: ink-green/brass palette, `::backdrop` dimming, minimal fade that
  is disabled under `prefers-reduced-motion`. Single brass accent only.
- No external requests introduced — the player is the browser's own, media
  comes from the already-in-use CloudFront domain.
- Chrome is silent: a close "×" and aria-labels only, no added copy.

### 6. Metadata (`_data/photoMeta.json`)

- Videos get `photoMeta` entries like photos (treatment recorded; capture
  metadata read via exiftool where mp4s carry it, fields absent otherwise).

### 7. Video exposures (Exposure Series pages)

An Exposure Series frontmatter entry may reference a video with its existing
`image:` field (e.g. `image: clip.mp4`) — no new frontmatter field.

- **Collection (`eleventy.config.js`, `exposureEntries`):** detect the video
  extension and add `isVideo` plus a CloudFront `videoSrc`
  (`<cdnBase>/exposures/<series-slug>/clip.mp4`). For videos, the
  grid-thumbnail path resolves to the derived `clip.mp4.jpg` name.
- **Series grid (`exposure-series.njk`):** a video entry's slide mount shows
  its treated thumbnail (`/exposures/<series-slug>/clip.mp4.jpg`) with the
  same small brass play-badge inline SVG used for inline video refs. The
  mount still links to the single-exposure page, exactly like a photo.
- **Single-exposure page (`exposure-detail.njk`):** when `isVideo`, the stage
  renders `<video class="exposure-photo" controls preload="metadata">`
  pointed at `videoSrc`, in place of the `<img>`. **No autoplay** — arrowing
  through a series shouldn't start sound unprompted; the reader presses play.
  Everything around the stage (sidebar, prev/next arrows, caption, capture
  data with its existing "missing" fallbacks, Esc-to-exit) is unchanged.
- **Keyboard guard (`assets/js/exposure-nav.js`):** the document-level
  keydown handler must ignore events targeting the `<video>` element (add
  `video` to its existing ignore selector) — otherwise ArrowLeft/ArrowRight
  while the player has focus would both seek the video and navigate to the
  neighboring exposure.
- Ordering, numbering, and pagination need no changes — video entries flow
  through the written-order `exposures` list like any other entry.

## Error handling

- A video that ffmpeg cannot read fails that file loudly (console error,
  non-zero exit) rather than silently shipping a missing thumbnail.
- A video ref in a post with no matching source file follows the existing
  validate-refs behavior for images.
- Lightbox JS absent/failed → anchors open CloudFront in a new tab (today's
  behavior).

## Testing

Extend the existing node test suites:

- `categories.test.js` — video extension recognition, thumbnail naming
  (`clip.mp4` → `clip.mp4.jpg`), no collision with `clip.jpg`.
- `inline-photo-transform.test.js` — video ref markup (play badge, CDN href,
  `data-lightbox="video"`), non-exposures image markup
  (`data-lightbox="image"`), exposures image markup unchanged, non-managed
  refs untouched.
- `thumbs.test.js` — video thumbnail regeneration rules and naming.
- `upload.test.js` — video files included in the metadata-strip file list.
- `exposure-order.test.js` (or the collection's covering tests) — a video
  entry resolves `isVideo`, `videoSrc`, and the `.mp4.jpg` grid-thumbnail
  path correctly.
- Manual verification: build the site, click a video thumb (plays in
  lightbox), a non-exposure photo (image in lightbox), an inline exposure
  photo (new tab, unchanged), Esc/backdrop close, no-JS fallback; open a
  video exposure's page (player in the stage, no autoplay, arrows/Esc still
  navigate when the player isn't focused, arrow keys seek without
  navigating when it is), and its series grid mount (thumbnail + play
  badge).

## Out of scope

- Any lightbox on Exposures pages (video exposures play in the existing
  stage per §7; the page layout is untouched).
- Poster-frame selection UI (frame at ~1s is fixed; revisit only if a real
  video's first second is unusable).
- Any video transcoding/resizing — the uploaded mp4 is served as-authored
  (faststart remux is the only touch).
