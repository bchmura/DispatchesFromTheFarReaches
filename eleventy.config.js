module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "assets": "assets" });

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

  eleventyConfig.addCollection("postsByCategory", (collectionApi) => {
    const byCategory = {};
    for (const item of collectionApi.getAll()) {
      const category = item.data.category;
      if (!category) continue;
      (byCategory[category] ??= []).push(item);
    }
    for (const key of Object.keys(byCategory)) {
      byCategory[key].sort((a, b) => b.date - a.date);
    }
    return byCategory;
  });

  // Real content entries only (excludes about/contact, which have no
  // `category` field), sorted newest first — used by the home page for the
  // featured slot and the "continues" list.
  eleventyConfig.addCollection("posts", (collectionApi) =>
    collectionApi.getAll()
      .filter((item) => item.data.category)
      .sort((a, b) => b.date - a.date)
  );

  // The 7 most recent posts after the featured (newest) one, for the home
  // page's "continues" list. Kept as a real JS array.slice — Nunjucks'
  // built-in `slice` filter chunks an array into N groups rather than
  // extracting a start/end range, so it can't be used for this in-template.
  eleventyConfig.addCollection("continuesPosts", (collectionApi) =>
    collectionApi.getAll()
      .filter((item) => item.data.category)
      .sort((a, b) => b.date - a.date)
      .slice(1, 8)
  );

  // Tag frequency across all real content, sorted by count desc then name,
  // for the home page's "Browse by tag" cloud.
  eleventyConfig.addCollection("tagCloud", (collectionApi) => {
    const counts = {};
    for (const item of collectionApi.getAll()) {
      if (!item.data.category) continue;
      for (const tag of item.data.tags || []) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
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
