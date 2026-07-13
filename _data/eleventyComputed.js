const path = require("node:path");
const { photoMetaKey } = require("../scripts/photos/lib/categories");

// Drafts (isDraft: true) are skipped entirely during a normal build/serve —
// no output file, and (via eleventy.config.js's isRealPost/collection
// filters) no appearance in listings, the tag cloud, or the RSS feed.
// `npm run serve:drafts` / `npm run build:drafts` set SHOW_DRAFTS=true to
// include them for local preview.
const showDrafts = process.env.SHOW_DRAFTS === "true";

module.exports = {
  // Category now comes from each folder's `<Folder>.11tydata.json` directory
  // data file (frontmatter can still override it), so every .md file sitting
  // in a category folder carries a `category` automatically — a page must
  // ALSO have a `title` to get a category permalink here, so
  // /professional/<slug>/ etc. wins over the default output path mirroring
  // the source directory tree (DFTFR-Obsidian/Website/<Dir>/...). An
  // untitled stray .md in a category folder has `category` but no `title`,
  // so it falls through to the safety net below and never publishes. Pages
  // without a `category` are left alone and fall back to Eleventy's normal
  // permalink behavior.
  //
  // Project journal entries (Projects/<project-slug>/<entry>.md) nest one
  // level deeper, under their own project: /projects/<project-slug>/<entry>/.
  // The project slug is the entry file's parent directory name, not its own
  // fileSlug — a project's own overview file (Projects/<slug>/index.md)
  // already resolves fileSlug to that same directory name, so its permalink
  // (/projects/<slug>/) needs no special case here.
  permalink: (data) => {
    // Same rule as isLiveItem in eleventy.config.js — three sites total, see isLiveItem's comment.
    if (data.isDraft && !showDrafts) return false;
    if (data.isJournalEntry && data.category && data.page) {
      const projectSlug = path.basename(path.dirname(data.page.inputPath));
      return `/${data.category}/${projectSlug}/${data.page.fileSlug}/`;
    }
    if (data.category && data.title && data.page && data.page.fileSlug) {
      return `/${data.category}/${data.page.fileSlug}/`;
    }
    // Safety net: publishing vault markdown is opt-in. Anything under
    // DFTFR-Obsidian/ that isn't a recognized page type (no `category`+
    // `title` above, no explicit `permalink` of its own like About/Contact)
    // never gets an output page — otherwise working notes fall through to
    // Eleventy's default input-path-mirroring permalink and end up deployed
    // (and Pagefind-indexed) at /DFTFR-Obsidian/... URLs. Falsy check, not
    // === undefined: Eleventy passes "" (not undefined) here for a file
    // with no frontmatter at all (seen with a frontmatter-less vault note).
    if (
      !data.permalink &&
      data.page &&
      data.page.inputPath.startsWith("./DFTFR-Obsidian/")
    ) {
      return false;
    }
    return data.permalink;
  },

  // Exposes the parent project's slug on journal-entry pages, so
  // project-journal-entry.njk can look the project up in the
  // `projectsBySlug` collection (for its title and a link back).
  projectSlug: (data) => {
    if (data.isJournalEntry && data.page) {
      return path.basename(path.dirname(data.page.inputPath));
    }
    return undefined;
  },

  // exposure-pages.njk has no frontmatter title of its own — it's a single
  // pagination generator producing one output per collections.exposureEntries
  // item (accessible here as `data.item`, the pagination alias), so the
  // <title> has to be computed per-page from that item instead.
  title: (data) => {
    if (data.item && data.item.numeral) {
      return `${data.item.title} — Exposure ${data.item.numeral}`;
    }
    return data.title;
  },

  // The image shown for an Exposure Series on the /exposures/ listing card.
  // Defaults to the first exposure in the gallery's own written order;
  // a gallery can override this with a `coverImage: <filename>` frontmatter
  // field (must be one of that gallery's own image filenames) to show a
  // different photo instead. Resolves to undefined (falls back to the
  // plain placeholder card) if the chosen filename has no generated
  // thumbnail yet, same as everywhere else photos degrade gracefully.
  coverImageSrc: (data) => {
    if (data.category !== "exposures" || data.isCategoryIndex) return undefined;
    if (!Array.isArray(data.exposures) || !data.page) return undefined;
    const seriesSlug = data.page.fileSlug;
    const filename = data.coverImage || (data.exposures[0] && data.exposures[0].image);
    if (!filename) return undefined;
    const key = photoMetaKey({ category: "exposures", projectSlug: seriesSlug, filename });
    if (!data.photoMeta || !data.photoMeta[key]) return undefined;
    return `/exposures/${seriesSlug}/${filename}`;
  },
};
