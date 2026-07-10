module.exports = {
  // Migrated vault posts carry a `category` frontmatter field but no
  // permalink of their own; derive one here so /professional/<slug>/ etc.
  // wins over the default output path mirroring the source directory tree
  // (DFTFR-Obsidian/Website/<Dir>/...). Pages without a `category` are left
  // alone and fall back to Eleventy's normal permalink behavior.
  permalink: (data) => {
    if (data.category && data.page && data.page.fileSlug) {
      return `/${data.category}/${data.page.fileSlug}/`;
    }
    return data.permalink;
  },
};
