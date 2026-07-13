const fs = require("node:fs");
const path = require("node:path");
const matter = require("gray-matter");
const {
  SITE_CONTENT_ROOT,
  DEFAULT_TREATMENT,
  categoryRefFromInputPath,
  isPipelineManagedFilename,
} = require("./categories");
const { TREATMENTS } = require("./treatment");

// Matches both standard Markdown image syntax (`![alt](target)`) and
// Obsidian's own wikilink embed syntax (`![[target]]`, optionally
// `![[target|alt]]`) — Obsidian inserts the latter automatically when you
// drag/paste an image into a note, so both need to be recognized here for
// the missing-thumbnail check to catch every real embed, not just
// hand-typed Markdown ones.
const IMAGE_MARKDOWN_PATTERN = /!\[[^\]]*\]\(([^)\s]+)\)|!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

function extractImageRefs({ frontmatter, body, filePath }) {
  // Category comes from where the file sits in the vault, not frontmatter —
  // directory data files supply `category` to Eleventy the same way, so the
  // folder is the single source of truth on both sides (matches the
  // "photo-links" transform, which already derives from inputPath).
  const { category, projectSlug } = categoryRefFromInputPath(filePath);
  if (!category) return [];
  const treatment = frontmatter.photoTreatment || DEFAULT_TREATMENT;
  if (!TREATMENTS.has(treatment)) {
    throw new Error(
      `Invalid photoTreatment "${treatment}" in ${filePath} — must be one of: ${[...TREATMENTS].join(", ")}`
    );
  }
  const isDraft = Boolean(frontmatter.isDraft);

  if (Array.isArray(frontmatter.exposures)) {
    return frontmatter.exposures
      .filter((exposure) => exposure.image)
      .map((exposure) => ({
        filename: exposure.image,
        category,
        projectSlug,
        treatment,
        kind: "exposure",
        sourceFile: filePath,
        isDraft,
      }));
  }

  const refs = [];
  let match;
  IMAGE_MARKDOWN_PATTERN.lastIndex = 0;
  while ((match = IMAGE_MARKDOWN_PATTERN.exec(body))) {
    const filename = match[1] || match[2];
    // Only bare, relative filenames with a recognized image extension are
    // managed by this pipeline — skip absolute paths, external URLs, nested
    // paths, and non-image extensions. Shared with rewriteInlinePhotos' own
    // check in inline-photo-transform.js via isPipelineManagedFilename, so
    // the two can't drift out of sync.
    if (!isPipelineManagedFilename(filename)) continue;
    refs.push({
      filename,
      category,
      projectSlug,
      treatment,
      kind: "inline",
      sourceFile: filePath,
      isDraft,
    });
  }
  return refs;
}

function findMarkdownFiles(rootDir) {
  return fs
    .readdirSync(rootDir, { recursive: true })
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => path.join(rootDir, entry));
}

function scanVaultForImageRefs(rootDir = SITE_CONTENT_ROOT) {
  return findMarkdownFiles(rootDir).flatMap((filePath) => {
    const { data: frontmatter, content: body } = matter(fs.readFileSync(filePath, "utf8"));
    return extractImageRefs({ frontmatter, body, filePath });
  });
}

module.exports = { extractImageRefs, findMarkdownFiles, scanVaultForImageRefs };
