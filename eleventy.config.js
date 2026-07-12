const fs = require("node:fs");
const path = require("node:path");

module.exports = async function (eleventyConfig) {
  // See _data/eleventyComputed.js — same flag, drafts are skipped from
  // collections here and skipped from output there.
  const showDrafts = process.env.SHOW_DRAFTS === "true";

  const rssPlugin = (await import("@11ty/eleventy-plugin-rss")).default;
  eleventyConfig.addWatchTarget("./DFTFR-Obsidian/Website/**");

  // Obsidian's ==highlight== syntax has no equivalent in markdown-it's
  // default rule set — register the markdown-it-mark plugin on Eleventy's
  // own markdown-it instance (rather than a passthrough regex transform) so
  // it composes correctly with other inline rules (bold/italic nesting,
  // escaping, etc.).
  const markdownIt = require("markdown-it");
  const markdownItMark = require("markdown-it-mark");
  const { obsidianImageEmbeds } = require("./scripts/obsidian-embeds");
  const { mermaidFence } = require("./scripts/mermaid-fence");
  const md = markdownIt({ html: true })
    .use(markdownItMark)
    .use(obsidianImageEmbeds)
    .use(mermaidFence);
  eleventyConfig.setLibrary("md", md);

  // Mermaid's own bundle (not a devDependency of the site build itself —
  // just used as a source for the one file we ship to the browser) is
  // self-hosted rather than pulled from a CDN, same rationale as the
  // "self-host the fonts" note in the design spec: no third-party request
  // at page load. Only the single-file UMD build is copied — the ESM build
  // dynamically imports a couple dozen further chunk files by relative
  // path, which would all need copying too for it to work standalone.
  eleventyConfig.addPassthroughCopy({
    "node_modules/mermaid/dist/mermaid.min.js": "assets/js/vendor/mermaid.min.js",
  });

  const { scanVaultForImageRefs } = require("./scripts/photos/lib/content-scan");
  const { findMissingThumbnails } = require("./scripts/photos/lib/validate-refs");
  const { photoMetaKey, SITE_CONTENT_ROOT } = require("./scripts/photos/lib/categories");

  // Hoisted out of the validation block below so the exposureEntries
  // collection (further down) can reuse the same parsed data instead of
  // re-reading the file.
  const photoMetaPath = "_data/photoMeta.json";
  const photoMeta = fs.existsSync(photoMetaPath)
    ? JSON.parse(fs.readFileSync(photoMetaPath, "utf8"))
    : {};

  {
    const refs = scanVaultForImageRefs(SITE_CONTENT_ROOT)
      .filter((ref) => showDrafts || !ref.isDraft);
    const missing = findMissingThumbnails(refs, (key) => Boolean(photoMeta[key]));
    if (missing.length) {
      const list = missing
        .map((ref) => `  - ${photoMetaKey(ref)} (referenced from ${ref.sourceFile})`)
        .join("\n");
      throw new Error(
        `Photo pipeline: ${missing.length} referenced photo(s) have no generated thumbnail yet. Run "npm run photos:thumbs" first:\n${list}`
      );
    }
  }

  eleventyConfig.addPlugin(rssPlugin);

  eleventyConfig.addPassthroughCopy({ "assets": "assets" });
  for (const file of fs.readdirSync("assets/favicon")) {
    eleventyConfig.addPassthroughCopy({ [`assets/favicon/${file}`]: file });
  }

  const IMAGE_GLOB = "*.{jpg,jpeg,png,gif,webp}";

  // Flat categories: one image folder per category, no per-post subfolders.
  // Shared with the photo pipeline scripts (scripts/photos/) so both sides
  // agree on the same category -> slug mapping.
  const { FLAT_CATEGORY_DIRS: flatCategoryDirs, NESTED_CATEGORY_DIRS: nestedCategoryDirs } =
    require("./scripts/photos/lib/categories");
  for (const [dir, slug] of Object.entries(flatCategoryDirs)) {
    eleventyConfig.addPassthroughCopy({
      [`DFTFR-Obsidian/Website/${dir}/${IMAGE_GLOB}`]: slug,
    });
  }

  // Nested categories (Projects, Exposures): each post is its own subfolder
  // (Projects/<slug>/, Exposures/<slug>/), and a glob like
  // "Projects/**/*.jpg" -> "projects" would flatten every post's images
  // into one shared folder by basename alone (verified: Eleventy's
  // glob-to-string passthrough copy does not preserve intermediate path
  // structure) — two posts both using e.g. "001.jpg" would silently
  // collide, one overwriting the other. Register one passthrough mapping
  // per actual subfolder instead, so each post's images land at their own
  // /<category>/<slug>/ path.
  for (const [dir, slug] of Object.entries(nestedCategoryDirs)) {
    const categoryDir = `DFTFR-Obsidian/Website/${dir}`;
    if (!fs.existsSync(categoryDir)) continue;
    for (const entry of fs.readdirSync(categoryDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      eleventyConfig.addPassthroughCopy({
        [`${categoryDir}/${entry.name}/${IMAGE_GLOB}`]: `${slug}/${entry.name}`,
      });
    }
  }

  const { rewriteInlinePhotos } = require("./scripts/photos/lib/inline-photo-transform");
  const { categoryRefFromInputPath } = require("./scripts/photos/lib/categories");
  const siteData = JSON.parse(fs.readFileSync("_data/site.json", "utf8"));

  eleventyConfig.addTransform("photo-links", function (content, outputPath) {
    if (!outputPath || !outputPath.endsWith(".html")) return content;
    // Transforms only expose { inputPath, outputPath, url, page, baseHref }
    // on `this` — there is no `this.category`. Derive category (and project
    // slug, for Projects) from the page's inputPath instead, the same way
    // _data/eleventyComputed.js derives project slugs.
    const { category, projectSlug } = categoryRefFromInputPath(this.page.inputPath);
    return rewriteInlinePhotos(content, {
      category,
      projectSlug,
      cdnBase: siteData.photosCdnBase,
      pageInputPath: this.page.inputPath,
    });
  });

  const { rewriteCallouts } = require("./scripts/callouts");
  eleventyConfig.addTransform("callouts", function (content, outputPath) {
    if (!outputPath || !outputPath.endsWith(".html")) return content;
    return rewriteCallouts(content);
  });

  const { toRoman } = require("./scripts/photos/lib/exposure-order");
  eleventyConfig.addFilter("toRoman", toRoman);

  eleventyConfig.addFilter("date", (value, format) => {
    const d = new Date(value);
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const day = d.getUTCDate();
    const tokens = {
      yyyy: String(d.getUTCFullYear()),
      MMMM: months[d.getUTCMonth()],
      MM: String(d.getUTCMonth() + 1).padStart(2, "0"),
      dd: String(day).padStart(2, "0"),
      d: String(day),
    };
    // `format` is a token string (e.g. "dd MMMM yyyy", "MMMM yyyy") — replace
    // longest tokens first so "dd"/"MMMM" aren't partially eaten by "d"/"MM".
    return (format || "d MMMM yyyy").replace(/yyyy|MMMM|MM|dd|d/g, (token) => tokens[token]);
  });

  eleventyConfig.addFilter("addLedeClass", (content) => {
    return content.replace("<p>", '<p class="lede">');
  });

  eleventyConfig.addFilter("readingTime", (content) => {
    const text = content.replace(/<[^>]*>/g, " ");
    const words = text.split(/\s+/).filter(Boolean);
    return Math.max(1, Math.round(words.length / 200));
  });

  eleventyConfig.addFilter("indexOfPost", (arr, url) => arr.findIndex((item) => item.url === url));

  // A "real post" carries a `category` but is neither a category-index page
  // (Task-14 addition: per-category description content, e.g.
  // Professional/index.md) nor a project journal entry (Task-14 addition:
  // Projects/<slug>/<entry>.md) — both have their own dedicated collections
  // below and must not leak into post listings, the home feed, or the tag
  // cloud.
  const isRealPost = (item) =>
    item.data.category &&
    !item.data.isCategoryIndex &&
    !item.data.isJournalEntry &&
    (showDrafts || !item.data.isDraft);

  eleventyConfig.addCollection("postsByCategory", (collectionApi) => {
    const byCategory = {};
    for (const item of collectionApi.getAll()) {
      if (!isRealPost(item)) continue;
      (byCategory[item.data.category] ??= []).push(item);
    }
    for (const key of Object.keys(byCategory)) {
      byCategory[key].sort((a, b) => b.date - a.date);
    }
    return byCategory;
  });

  // Real content entries only (excludes about/contact, category-index
  // pages, and project journal entries), sorted newest first — used by the
  // home page for the featured slot and the "continues" list.
  eleventyConfig.addCollection("posts", (collectionApi) =>
    collectionApi.getAll()
      .filter(isRealPost)
      .sort((a, b) => b.date - a.date)
  );

  // The 7 most recent posts after the featured (newest) one, for the home
  // page's "continues" list. Kept as a real JS array.slice — Nunjucks'
  // built-in `slice` filter chunks an array into N groups rather than
  // extracting a start/end range, so it can't be used for this in-template.
  eleventyConfig.addCollection("continuesPosts", (collectionApi) =>
    collectionApi.getAll()
      .filter(isRealPost)
      .sort((a, b) => b.date - a.date)
      .slice(1, 8)
  );

  // Tag frequency across all real content, sorted by count desc then name,
  // for the home page's "Browse by tag" cloud.
  eleventyConfig.addCollection("tagCloud", (collectionApi) => {
    const counts = {};
    for (const item of collectionApi.getAll()) {
      if (!isRealPost(item)) continue;
      for (const tag of item.data.tags || []) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  });

  // One category-index page per category (e.g. Professional/index.md),
  // keyed by category — supplies the description text rendered under each
  // category's <h1>, per constraint #3: layout/content lives in vault
  // markdown, not in _data.
  eleventyConfig.addCollection("categoryIndex", (collectionApi) => {
    const byCategory = {};
    for (const item of collectionApi.getAll()) {
      if (item.data.isCategoryIndex) byCategory[item.data.category] = item;
    }
    return byCategory;
  });

  // Project journal entries (Projects/<project-slug>/<entry>.md), keyed by
  // project slug (the entry's parent directory name) and sorted oldest
  // first, matching the mockup's chronological journal order. Each
  // project's own overview page (Projects/<project-slug>/index.md) reads
  // its entries from here rather than a frontmatter list.
  eleventyConfig.addCollection("journalEntriesByProject", (collectionApi) => {
    const byProject = {};
    for (const item of collectionApi.getAll()) {
      if (!item.data.isJournalEntry) continue;
      if (item.data.isDraft && !showDrafts) continue;
      const projectSlug = path.basename(path.dirname(item.inputPath));
      (byProject[projectSlug] ??= []).push(item);
    }
    for (const key of Object.keys(byProject)) {
      byProject[key].sort((a, b) => a.date - b.date);
    }
    return byProject;
  });

  // Project overview pages (Projects/<project-slug>/index.md), keyed by
  // their own fileSlug (== the project's directory/slug) — lets a journal
  // entry page look up its parent project's title and URL.
  eleventyConfig.addCollection("projectsBySlug", (collectionApi) => {
    const bySlug = {};
    for (const item of collectionApi.getAll()) {
      if (
        item.data.category === "projects" &&
        !item.data.isJournalEntry &&
        !item.data.isCategoryIndex &&
        (showDrafts || !item.data.isDraft)
      ) {
        bySlug[item.page.fileSlug] = item;
      }
    }
    return bySlug;
  });

  // Flattens every Exposure Series' `exposures` frontmatter array into one
  // entry per photo, each carrying its own real URL
  // (/exposures/<series-slug>/<n>/) plus prev/next links within that
  // series — consumed by exposure-pages.njk's pagination to generate one
  // full-screen page per exposure. Order is the frontmatter's own written
  // order (matches exposure-series.njk's listing), not EXIF capture date —
  // captured date sorting was tried first but the author prefers to control
  // display order directly in the markdown.
  eleventyConfig.addCollection("exposureEntries", (collectionApi) => {
    const entries = [];
    for (const item of collectionApi.getAll()) {
      if (item.data.category !== "exposures" || item.data.isCategoryIndex) continue;
      if (item.data.isDraft && !showDrafts) continue;
      const seriesSlug = item.page.fileSlug;
      const written = item.data.exposures || [];
      const total = written.length;
      written.forEach((exposure, index) => {
        const num = index + 1;
        const meta = exposure.image
          ? photoMeta[photoMetaKey({ category: "exposures", projectSlug: seriesSlug, filename: exposure.image })]
          : null;
        entries.push({
          seriesTitle: item.data.title,
          seriesSlug,
          seriesUrl: item.url,
          accession: item.data.accession,
          num,
          numeral: toRoman(num),
          total,
          title: exposure.title,
          body: exposure.body,
          tags: exposure.tags || [],
          image: exposure.image,
          // The detail page shows the true-color CloudFront original (same
          // source the old dialog enlarged to), not the treated/sepia
          // thumbnail used inline on the grid.
          imageSrc: exposure.image
            ? `${siteData.photosCdnBase}/exposures/${seriesSlug}/${exposure.image}`
            : null,
          meta,
          hasSpecs: Boolean(
            meta && (meta.camera || meta.lens || meta.exposureTime || meta.aperture || meta.iso || meta.captured)
          ),
          url: `/exposures/${seriesSlug}/${num}/`,
          prevUrl: num > 1 ? `/exposures/${seriesSlug}/${num - 1}/` : null,
          nextUrl: num < total ? `/exposures/${seriesSlug}/${num + 1}/` : null,
        });
      });
    }
    return entries;
  });

  return {
    dir: {
      input: ".",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: false,
  };
};
