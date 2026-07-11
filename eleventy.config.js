const fs = require("node:fs");
const path = require("node:path");

module.exports = async function (eleventyConfig) {
  const rssPlugin = (await import("@11ty/eleventy-plugin-rss")).default;
  eleventyConfig.addWatchTarget("./DFTFR-Obsidian/Website/**");

  eleventyConfig.addPlugin(rssPlugin);

  eleventyConfig.addPassthroughCopy({ "assets": "assets" });
  for (const file of fs.readdirSync("assets/favicon")) {
    eleventyConfig.addPassthroughCopy({ [`assets/favicon/${file}`]: file });
  }

  const IMAGE_GLOB = "*.{jpg,jpeg,png,gif,webp}";

  // Flat categories: one image folder per category, no per-post subfolders.
  // Shared with the photo pipeline scripts (scripts/photos/) so both sides
  // agree on the same category -> slug mapping.
  const { FLAT_CATEGORY_DIRS: flatCategoryDirs } = require("./scripts/photos/lib/categories");
  for (const [dir, slug] of Object.entries(flatCategoryDirs)) {
    eleventyConfig.addPassthroughCopy({
      [`DFTFR-Obsidian/Website/${dir}/${IMAGE_GLOB}`]: slug,
    });
  }

  // Projects: each project is its own subfolder (Projects/<slug>/), and a
  // glob like "Projects/**/*.jpg" -> "projects" would flatten every
  // project's images into one shared /projects/ folder by basename alone
  // (verified: Eleventy's glob-to-string passthrough copy does not
  // preserve intermediate path structure) — two projects both using e.g.
  // "001.jpg" would silently collide, one overwriting the other. Register
  // one passthrough mapping per actual project subfolder instead, so each
  // project's images land at their own /projects/<slug>/ path.
  const projectsDir = "DFTFR-Obsidian/Website/Projects";
  if (fs.existsSync(projectsDir)) {
    for (const entry of fs.readdirSync(projectsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      eleventyConfig.addPassthroughCopy({
        [`${projectsDir}/${entry.name}/${IMAGE_GLOB}`]: `projects/${entry.name}`,
      });
    }
  }

  const { rewriteInlinePhotos } = require("./scripts/photos/lib/inline-photo-transform");
  const siteData = JSON.parse(fs.readFileSync("_data/site.json", "utf8"));

  eleventyConfig.addTransform("photo-links", function (content, outputPath) {
    if (!outputPath || !outputPath.endsWith(".html")) return content;
    const category = this.category;
    if (!category) return content;
    return rewriteInlinePhotos(content, { category, cdnBase: siteData.photosCdnBase });
  });

  eleventyConfig.addFilter("date", (value, format) => {
    const d = new Date(value);
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
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
  const isRealPost = (item) => item.data.category && !item.data.isCategoryIndex && !item.data.isJournalEntry;

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
      if (item.data.category === "projects" && !item.data.isJournalEntry && !item.data.isCategoryIndex) {
        bySlug[item.page.fileSlug] = item;
      }
    }
    return bySlug;
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
