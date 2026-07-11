# Photo pipeline design — treated thumbnails in Git, originals on S3/CloudFront

## Problem

Real photography is about to start flowing into the site (Exposure Series, Family, Professional,
Fiction, Misc, Projects), but full-resolution originals shouldn't live in Git: they're large,
churn a lot during editing, and bloat repo/deploy size. At the same time, thumbnails need a
period-appropriate visual treatment (sepia/B&W/etc.) that shouldn't be applied by hand per photo,
and enlarging a photo should show the real, full-color, already-composed version — hosted on the
existing S3 bucket + CloudFront distribution rather than Git/DreamHost.

The GitHub Actions build (`.github/workflows/deploy.yml`) only ever sees what's committed to
`main` — it has no access to local original photos and shouldn't need AWS credentials. So all
photo processing and S3 upload has to happen locally, before a push, not in CI.

## Architecture

### New folder: `photos-source/` (gitignored)

Holds original, full-resolution photos, already cropped/composed the way they should look
enlarged (no auto-resizing — whatever's in here is treated as the final "large" version).
Mirrors the exact category/slug structure `eleventy.config.js` already uses for passthrough copy,
so a processing script can reuse that mapping directly and the relative path doubles as the S3
key / CloudFront path with zero lookup table:

```
photos-source/
  professional/*.jpg
  philosophy/*.jpg
  exposures/*.jpg
  family/*.jpg
  fiction/*.jpg
  misc/*.jpg
  projects/<slug>/*.jpg
```

Add `/photos-source/` to `.gitignore`. Nothing in this folder is ever committed.

### Three local npm commands (`scripts/photos/`, using `sharp` for image ops and `exifr` for EXIF)

1. **`npm run photos:thumbs`** — no network, no AWS credentials needed.
   - Walks `photos-source/`, and for each new/changed image (tracked by mtime or hash so reruns
     are cheap and idempotent):
     - Reads EXIF (camera, lens, aperture, exposure time, ISO, captured date/time) and
       writes/updates a git-tracked JSON file: `_data/photoMeta.json`, keyed by
       `"<category>/<filename>"` (or `"projects/<slug>/<filename>"`).
     - Applies the visual treatment (see below) and writes a small thumbnail to the *same
       filename* in the existing site content folder — e.g.
       `DFTFR-Obsidian/Website/Family/porch.jpg` — the exact path the current passthrough-copy
       rules in `eleventy.config.js` already serve. **No changes needed to
       `eleventy.config.js`.** `sharp` doesn't carry EXIF/metadata into its output unless asked,
       so the thumbnail is naturally metadata-clean.
   - Run this, then `npm run serve` / `npx eleventy`, to proof locally — full loop, no AWS
     dependency, fast iteration on treatment or EXIF display without touching the network.

2. **`npm run photos:upload`** — syncs new/changed files from `photos-source/` to S3
   (`aws s3 sync`, checksum/size-based so unchanged files aren't re-uploaded), landing at:
   ```
   s3://<bucket>/dispatchesfromthefarreaches/<category>/<filename>
   s3://<bucket>/dispatchesfromthefarreaches/projects/<slug>/<filename>
   ```
   so the CloudFront URL is always
   `https://<cdn-domain>/dispatchesfromthefarreaches/<category>/<filename>` — same relative path
   as the thumbnail, just a different host and one extra top-level prefix (this CloudFront
   distribution serves other projects too, hence the prefix).
   - Before uploading, strips privacy-sensitive metadata from a *copy* of each file (never
     mutates your working file in `photos-source/`) using `exiftool`, which can remove specific
     tags without re-encoding/re-compressing the image (no quality loss). Fields stripped: all
     `GPS*` tags, `OwnerName`/`CameraOwnerName`, `SerialNumber`, `BodySerialNumber`,
     `LensSerialNumber`. Camera model, lens model, aperture, exposure time, ISO, and capture
     date/time are left embedded (redundant with `_data/photoMeta.json`, but harmless and kept
     per preference).
   - AWS credentials come from the local AWS CLI profile / environment variables on the machine
     running this command — never written to any file in this repo, same credential-hygiene
     pattern already documented for the DreamHost deploy key in `docs/site-integrations.md`.

3. **`npm run photos:publish`** — convenience wrapper for the "ready to ship" moment: runs
   `photos:thumbs`, `git add`s the generated thumbnails + `_data/photoMeta.json`, commits, runs
   `photos:upload`, then `git push` (which triggers the existing GitHub Actions deploy, unchanged).

### Visual treatment

- Options: `sepia` (site-wide default), `bw`, `duotone-brass`, `darkened` — implemented as
  `sharp` operations (greyscale / tint / modulate).
- Any post or Exposure Series can override the default via a `photoTreatment:` frontmatter field,
  applied to every photo belonging to that post.
- Treatment applies **only** to the generated thumbnail. The CloudFront-served version (the file
  you prepared in `photos-source/`) stays true color — enlarging a photo reveals real color, a
  deliberate "lift the veil" moment.

### Referencing photos from content

- **Exposure Series:** each entry in a post's `exposures` frontmatter list drops the currently
  hand-typed `camera`/`lens`/`exposureTime`/`aperture`/`iso`/`captured` fields (now auto-derived)
  and gains an `image: <filename>` field. `title`/`body`/`tags`/`num` remain hand-authored
  creative content. The `exposure-series.njk` template looks up capture specs from
  `_data/photoMeta.json` by `"<category>/<image>"` at build time.
- **Any other post** (Family, Professional, Philosophy, Fiction, Misc, Projects): a standard
  markdown image reference `![alt](porch.jpg)` in the post body is picked up by an Eleventy
  transform, which resolves the filename against the post's `category` (or project slug),
  rewrites it into `<a href="<cloudfront-url>"><img src="/<category>/<filename>" class="treated-photo"></a>`.
  No new authoring syntax — same markdown you'd write anyway.

## Data flow (one photo, start to finish)

1. Drop `porch.jpg` (already cropped/sized as you want it to appear enlarged) into
   `photos-source/family/`.
2. Reference `porch.jpg` in the Family post's markdown body (or as an Exposure Series entry's
   `image:` field).
3. `npm run photos:thumbs` → treated thumbnail lands at `DFTFR-Obsidian/Website/Family/porch.jpg`;
   EXIF written to `_data/photoMeta.json` (minus nothing yet — stripping happens at upload time).
4. Proof locally with `npm run serve`. Re-run `photos:thumbs` freely while iterating on
   `photoTreatment` or re-editing the master in `photos-source/`.
5. When ready: `npm run photos:publish` — uploads a metadata-stripped copy of the original to S3,
   commits the thumbnail + `_data/photoMeta.json`, pushes to `main`. GitHub Actions builds and
   deploys exactly as it does today; CI never touches `photos-source/` or AWS.

## Error handling / edge cases

- A photo with no EXIF (e.g. a scan) doesn't crash `photos:thumbs` — capture-spec fields are
  simply omitted/blank in `_data/photoMeta.json`, and the template renders without that row
  rather than failing.
- `photos:upload` only syncs changed files (checksum/size comparison) so re-running it isn't a
  full re-upload every time.
- If a post references an `image`/markdown-image filename that has no corresponding thumbnail yet
  (i.e. `photos:thumbs` hasn't been run since the photo was added), the Eleventy build should fail
  loudly with a clear "missing thumbnail for X" error rather than silently shipping a 404.
- `photos:upload`'s metadata strip operates on a temp copy — `photos-source/` originals are never
  mutated, so re-running strip logic (e.g. after changing which fields get stripped) is always
  safe and repeatable from the untouched originals.

## Out of scope for this spec

- Migrating any already-committed images (none currently exist in `DFTFR-Obsidian/Website/*` —
  all categories are still placeholder/mockup content).
- Building the actual S3 bucket/CloudFront distribution or its IAM policy — assumed to already
  exist per the brainstorming conversation; only the bucket name/CDN domain need to be supplied as
  local config (e.g. an untracked `.env` or npm config, not committed).
- Responsive `srcset`/multiple thumbnail sizes — a single small treated thumbnail size is in
  scope; further size variants can be layered on later if page-weight becomes an issue.
