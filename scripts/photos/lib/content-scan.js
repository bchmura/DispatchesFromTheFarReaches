const fs = require("node:fs");
const path = require("node:path");
const matter = require("gray-matter");
const {
  SITE_CONTENT_ROOT,
  DEFAULT_TREATMENT,
  projectSlugFromPath,
  isPipelineManagedFilename,
} = require("./categories");
const { TREATMENTS } = require("./treatment");

const IMAGE_MARKDOWN_PATTERN = /!\[[^\]]*\]\(([^)\s]+)\)/g;

function extractImageRefs({ frontmatter, body, filePath }) {
  if (!frontmatter.category) return [];
  const category = String(frontmatter.category).toLowerCase();
  const treatment = frontmatter.photoTreatment || DEFAULT_TREATMENT;
  if (!TREATMENTS.has(treatment)) {
    throw new Error(
      `Invalid photoTreatment "${treatment}" in ${filePath} — must be one of: ${[...TREATMENTS].join(", ")}`
    );
  }
  const projectSlug = category === "projects" ? projectSlugFromPath(filePath) : undefined;

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
      }));
  }

  const refs = [];
  let match;
  IMAGE_MARKDOWN_PATTERN.lastIndex = 0;
  while ((match = IMAGE_MARKDOWN_PATTERN.exec(body))) {
    const filename = match[1];
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
