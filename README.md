# Running "Dispatches from the Far Reaches"

This is the operating manual for the site itself — how to add an article, a photo gallery,
a project, or a photo, and how to get it live. It's written for day-to-day use, not for
developing the site's code. (If you're looking for how the templates/CSS/build actually
work, see `CLAUDE.md` and the `docs/` folder instead.)

## The short version

1. All content lives as markdown files in `DFTFR-Obsidian/Website/`, organized in one folder
   per category.
2. Every time you `git push` to `main`, the live site rebuilds and deploys automatically
   (via GitHub Actions → DreamHost) — usually within a couple of minutes. There is no separate
   "publish" button beyond that push.
3. Photos are the one exception to "just add a file and push" — see the **Photos** section
   below, they need one extra local step before they'll appear.

## Before you start (one-time setup)

You need [Node.js](https://nodejs.org) installed (any recent version). Then, once, in this
folder:

```
npm install
```

Everything below assumes you've done that once.

## Previewing your changes before pushing

From the repo root:

```
npm run serve
```

This starts a local preview server (prints a `localhost` address to open in your browser) and
auto-rebuilds as you edit files. Press Ctrl+C to stop it.

One caveat: the **search box does nothing under `npm run serve`** — the search index is built
by a separate tool (Pagefind) that only runs as part of `npm run build` (and `npm run
build:drafts`), not inside the live-reload server. That's expected, not broken.

If you just want a one-off build without a live-reloading server:

```
npx eleventy
```

The built site lands in `_site/` — you don't need to look in there normally, and it's not
something you ever commit or push.

## Adding a regular article (Professional / Philosophy / Family / Fiction / Misc)

Create a new `.md` file in the matching folder, e.g. `DFTFR-Obsidian/Website/Family/a-new-post.md`.
Start it with this frontmatter block, then write the article underneath in plain markdown:

```markdown
---
title: "Your Title Here"
dispatchNo: 224
description: "One or two sentences — used wherever the post is teased/linked elsewhere on the site."
date: 2026-07-11
tags: ["some-tag", "another-tag"]
---

Your article text goes here, in normal markdown.
```

Notes on each field:

- **Category and layout are automatic** — the folder you put the file in decides both (each
  category folder has a `<Folder>.11tydata.json` directory-data file supplying them, invisible
  in Obsidian). You never write `category:` or `layout:` in a post's frontmatter. A file also
  needs a `title` to publish at all — an untitled stray `.md` dropped into a category folder is
  ignored by the build entirely.
- **`dispatchNo`** is the "MS-###" number shown on the article page and in listings. It's not
  automatic — look at the highest `dispatchNo` used anywhere in `DFTFR-Obsidian/Website/` and
  use the next number up.
- **`tags`** show up as clickable chips at the bottom of the article — each links to the
  Cross-Filing Index (`/tags/`) with that tag pre-selected — and feed the homepage's
  "Browse by tag" list. Use whatever words make sense; there's no fixed list.
- **`isDraft`** — set to `true` to keep a post out of the normal site build entirely (no page,
  no listing, no RSS entry, no tag-cloud count). A normal `npm run serve` / `npm run build` /
  the live auto-deploy all skip it. To preview a draft yourself before it's ready, use
  `npm run serve:drafts` (or `npm run build:drafts` for a one-off build) — those two commands
  are the only place drafts show up. **Don't push while a post you want hidden still has
  `isDraft: true` removed** — the normal build that runs on push always honors this flag, so as
  long as it's `true`, pushing is safe.
- Want a photo inline in the article body? See **Photos** below — you just write
  `![some description](filename.jpg)` in the markdown text, same as any other markdown image.

## Adding a photo gallery ("Exposure Series")

Each gallery is its own subfolder under `DFTFR-Obsidian/Website/Exposures/<gallery-slug>/`, with
an `index.md` — same pattern as Projects. Create the folder and the file:

```markdown
---
title: "Your Gallery Title"
description: "One or two sentences describing the series."
date: 2026-07-11
accession: "EX-12"
tags: ["some-tag"]
exposures:
  - title: "First Photo's Title"
    body: "A sentence or two about this specific shot."
    tags: ["some-tag"]
    image: some-photo.jpg
  - title: "Second Photo's Title"
    body: "..."
    tags: ["some-tag"]
    image: another-photo.jpg
---
A short intro paragraph for the whole gallery.
```

- **`accession`** is the "EX-##" number shown on the page — look at the highest `EX-` number
  already used and pick the next one.
- Each entry under `exposures:` is one photo. You do **not** number them — "Exposure I",
  "Exposure II", etc. are assigned automatically for display, **in the order you wrote them in**
  (top to bottom in the `exposures:` list). Reorder the list to reorder the gallery.
- **`image`** must match a photo's filename in this same gallery folder, and must have been run
  through the photo pipeline (see **Photos** below) — that's what generates the thumbnail and
  pulls in the camera/lens/aperture/etc. details automatically. An entry with no `image` yet (or
  one that hasn't been through the pipeline yet) still renders in its written position — just
  with a placeholder instead of a photo, rather than breaking anything.
- You do **not** hand-type camera/lens/aperture/ISO/date-taken anywhere — that all comes from
  the photo's own embedded camera data automatically once it's been through the pipeline.
- **`coverImage`** (optional) — set this to one of the gallery's own photo filenames to control
  which photo represents this gallery on the main `/exposures/` listing page. Leave it out and the
  listing uses the first photo in the `exposures:` list instead.
- Clicking a photo takes you to its own full-screen page — the photo on the left (the full-color
  version from CloudFront), a sidebar on the right with its description and whichever camera
  details that specific photo actually has embedded (a photo with no lens data, e.g. a
  fixed-lens compact camera, or no camera data at all, just shows "missing" for those fields —
  that's not a bug, some photos genuinely don't have that data). Use the on-screen arrows (or
  `←`/`→`) to move between photos in the gallery, and "Return to the collection" (or `Esc`) to go
  back to the grid.

## Adding a Project

Each project is its own folder under `DFTFR-Obsidian/Website/Projects/<project-slug>/`, with an
`index.md` (the overview) plus one `.md` file per journal entry.

**`index.md`** (the project overview page):

```markdown
---
title: "Your Project Title"
description: "One or two sentences."
date: 2026-07-11
layout: project.njk
category: projects
status: Afoot
accession: "MS-P-12 · Instrument file"
tags: ["diy"]
isDraft: false
resources:
  - title: "Some Reference"
    note: "Why it's relevant"
    url: "https://example.com"
---
An overview paragraph for the whole project.
```

- **`status`** must be one of: `Theorized`, `Afoot`, `Dormant`, `Catalogued`, `Abandoned` — this
  controls the little status indicator on the project card.
- **`accession`** follows the same "look at the highest MS-P-## and pick the next one" rule as
  above.
- `resources` is optional — a list of links relevant to the project. Leave it out entirely if
  there aren't any yet.

**Each journal entry** (e.g. `01-first-steps.md`, in the same folder as `index.md`):

```markdown
---
title: "First Steps"
date: 2026-07-11
no: 1
isJournalEntry: true
category: projects
layout: project-journal-entry.njk
isDraft: false
tag: DIY
---
The entry text itself, in normal markdown.
```

Journal entries render oldest-first automatically by `date` — you don't need to manage their
order by filename, though naming them `01-`, `02-`, etc. keeps them easy to find in a file
browser.

## Photos

Full-resolution photos are **never** committed to this repo (they'd make it huge) — they're
kept separately in Amazon S3/CloudFront, and only a small, treated thumbnail gets committed here.

### Where to put an original photo

Drop it into `photos-source/<category>/`, where `<category>` matches the site section it
belongs to: `professional`, `philosophy`, `family`, `fiction`, `misc`. Exposures and Projects
nest one level deeper, since each gallery/project has its own folder:
`photos-source/exposures/<gallery-slug>/` or `photos-source/projects/<project-slug>/`. This
folder is not tracked by git — it only exists on your own computer.

Whatever you put in `photos-source/` is treated as the "true" version — crop/size it exactly
how you want it to look when a reader clicks to enlarge it, since nothing resizes it further.

### Reference the photo from your post

- **Exposure Series:** set `image: your-photo.jpg` on that exposure's entry (see above).
- **Any other post:** just write `![a description](your-photo.jpg)` in the article body, same
  as any markdown image — no special syntax.

### Generate the thumbnail

Run this locally whenever you've added or changed photos:

```
npm run photos:thumbs
```

This reads each photo's embedded camera info, applies a "period" visual treatment to a small
thumbnail (sepia by default), and writes that thumbnail into the site's content folder so it
gets built and deployed like any other file. It does **not** touch the internet — safe to run
as often as you like while you're proofing things with `npm run serve`.

**Changing the look of a photo:** add `photoTreatment: bw` (or `sepia`, `duotone-brass`,
`darkened`) to the post's frontmatter (same level as `title`), then re-run
`npm run photos:thumbs`. It applies to every photo in that post/gallery.

**Important:** if a post references a photo (`image:` field or `![alt](file.jpg)`) that hasn't
been through `photos:thumbs` yet, the site will refuse to build at all rather than show a
broken image — that's intentional, it's telling you to run the command above.

### Upload the full-size original

Once you're happy with a batch of photos, upload the originals so the "click to enlarge" link
works:

```
npm run photos:upload
```

This needs two things set up on your machine (one-time, ask whoever manages the AWS account if
you don't already have these): the AWS CLI installed and logged in, and an environment variable
`PHOTOS_S3_BUCKET` set to the right bucket name. This step also strips GPS location data and
camera serial numbers from the uploaded copy for privacy — that's automatic, nothing to do.

**`PHOTOS_S3_BUCKET` must be the plain bucket name** (e.g. `cdn-dispatches-023345616863-us-east-1`),
**not** the full ARN (`arn:aws:s3:::...`) — the AWS CLI rejects an ARN there with a "Parameter
validation failed" error.

**One-time setup:** the "click to enlarge" links won't resolve to anything until you set your
actual CloudFront domain in `_data/site.json`'s `photosCdnBase` field (it starts out as a literal
placeholder, `https://REPLACE_WITH_CLOUDFRONT_DOMAIN.cloudfront.net`). This has to match wherever
`photos:upload` actually puts the files — currently the bucket root, no extra path prefix.

### Do everything and ship it

```
npm run photos:publish
```

Runs `photos:thumbs`, commits the generated thumbnails (skipping the commit step gracefully if
there's genuinely nothing new to commit), runs `photos:upload`, and pushes — the one-command
version of the two steps above plus going live.

`git push` needs your machine's git already authenticated with GitHub (an SSH key added to your
GitHub account, or `gh auth login`) — if it fails with "Permission denied (publickey)", that's a
one-time git/GitHub setup issue on your machine, unrelated to the photo pipeline itself.

## Contact form, RSS feed, favicon

These are already wired up and don't need any day-to-day attention:

- The **contact form** on `/contact/` emails you directly; nothing to configure per-post.
- The **RSS feed** at `/feed.xml` updates automatically from your 20 most recent articles.
- The **favicon** (browser tab icon) is a fixed site-wide image, not something set per-post.

If any of these ever need to change, see `docs/site-integrations.md` — that's written for
whoever's touching the code, not day-to-day use.

## Going live

Once your new/edited files look right in `npm run serve`:

```
git add <the files you changed>
git commit -m "a short description of what you added"
git push
```

That's it — pushing to `main` is what makes it live. If you also added new photos, run
`npm run photos:publish` instead of the three commands above (it includes its own commit and
push).

## If something goes wrong

- **Build fails locally or the auto-deploy fails:** the error message is almost always specific
  (e.g. "missing thumbnail for X" means run `npm run photos:thumbs`). Read it before assuming
  something is broken.
- **Not sure what a setting does or where a credential lives:** check `docs/site-integrations.md`
  first — it documents exactly this.
- **Design/visual questions** (spacing, wording, terminology) are covered in
  `docs/designSpecifications-updated.md`.
