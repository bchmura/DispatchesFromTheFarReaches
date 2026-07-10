const path = require("node:path");

module.exports = {
  // Migrated vault posts carry a `category` frontmatter field but no
  // permalink of their own; derive one here so /professional/<slug>/ etc.
  // wins over the default output path mirroring the source directory tree
  // (DFTFR-Obsidian/Website/<Dir>/...). Pages without a `category` are left
  // alone and fall back to Eleventy's normal permalink behavior.
  //
  // Project journal entries (Projects/<project-slug>/<entry>.md) nest one
  // level deeper, under their own project: /projects/<project-slug>/<entry>/.
  // The project slug is the entry file's parent directory name, not its own
  // fileSlug — a project's own overview file (Projects/<slug>/index.md)
  // already resolves fileSlug to that same directory name, so its permalink
  // (/projects/<slug>/) needs no special case here.
  permalink: (data) => {
    if (data.isJournalEntry && data.category && data.page) {
      const projectSlug = path.basename(path.dirname(data.page.inputPath));
      return `/${data.category}/${projectSlug}/${data.page.fileSlug}/`;
    }
    if (data.category && data.page && data.page.fileSlug) {
      return `/${data.category}/${data.page.fileSlug}/`;
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
};
