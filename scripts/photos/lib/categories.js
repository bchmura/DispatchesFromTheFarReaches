const path = require("node:path");

const FLAT_CATEGORY_DIRS = {
  Professional: "professional",
  Philosophy: "philosophy",
  Exposures: "exposures",
  Family: "family",
  Fiction: "fiction",
  Misc: "misc",
};

const SITE_CONTENT_ROOT = path.join("DFTFR-Obsidian", "Website");
const PHOTOS_SOURCE_ROOT = "photos-source";
const CDN_KEY_PREFIX = "dispatchesfromthefarreaches";
const DEFAULT_TREATMENT = "sepia";
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

function projectSlugFromPath(mdOrImagePath) {
  return path.basename(path.dirname(mdOrImagePath));
}

// Derives { category, projectSlug? } from a markdown file's inputPath, the
// same way _data/eleventyComputed.js derives project slugs — used by the
// Eleventy "photo-links" transform, which only has `this.page.inputPath`
// available (not `this.category`; transforms don't expose custom template
// data on `this`).
function categoryRefFromInputPath(inputPath) {
  const rel = path.relative(SITE_CONTENT_ROOT, inputPath);
  const [dirName, second] = rel.split(path.sep);
  if (dirName === "Projects") {
    return { category: "projects", projectSlug: second };
  }
  const slug = FLAT_CATEGORY_DIRS[dirName];
  return slug ? { category: slug } : {};
}

// Single source of truth for what counts as a "bare filename" the photo
// pipeline manages: no leading slash, no scheme (":"), no nested path
// ("/" in the middle), and a recognized image extension. Shared by
// content-scan.js (deciding what to flag/validate) and
// inline-photo-transform.js (deciding what to rewrite) so the two can't
// silently disagree about what's pipeline-managed.
function isPipelineManagedFilename(filename) {
  if (filename.startsWith("/") || filename.includes(":") || filename.includes("/")) return false;
  return IMAGE_EXTENSIONS.includes(path.extname(filename).toLowerCase());
}

function photoMetaKey({ category, projectSlug, filename }) {
  return projectSlug ? `${category}/${projectSlug}/${filename}` : `${category}/${filename}`;
}

const SITE_CATEGORY_DIRS = Object.fromEntries(
  Object.entries(FLAT_CATEGORY_DIRS).map(([dir, slug]) => [slug, dir])
);

function resolveDestination(relativePath) {
  const [category, ...rest] = relativePath.split(path.sep);
  if (category === "projects") {
    const [projectSlug, filename] = rest;
    return {
      category,
      projectSlug,
      filename,
      siteDir: path.join(SITE_CONTENT_ROOT, "Projects", projectSlug),
    };
  }
  const [filename] = rest;
  const siteDirName = SITE_CATEGORY_DIRS[category];
  if (!siteDirName) throw new Error(`Unknown photo category folder: ${category}`);
  return { category, filename, siteDir: path.join(SITE_CONTENT_ROOT, siteDirName) };
}

module.exports = {
  FLAT_CATEGORY_DIRS,
  SITE_CONTENT_ROOT,
  PHOTOS_SOURCE_ROOT,
  CDN_KEY_PREFIX,
  DEFAULT_TREATMENT,
  IMAGE_EXTENSIONS,
  projectSlugFromPath,
  categoryRefFromInputPath,
  isPipelineManagedFilename,
  photoMetaKey,
  resolveDestination,
};
