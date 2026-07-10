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
