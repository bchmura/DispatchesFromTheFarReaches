module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "assets": "assets" });

  return {
    dir: {
      input: ".",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
  };
};
