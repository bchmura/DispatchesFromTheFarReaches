const path = require("node:path");

// Derived from _data/categories.json — the single source of truth for the
// category list (key/label/slug/glyph for templates; dir/nested for this
// pipeline). Adding a category also needs the vault side: a `<Folder>.11tydata.json` directory data file (whose hardcoded category slug must match the key here) and a category index.md.
// Kept as two maps (flat vs nested) because passthrough-copy and the photo
// pipeline treat them differently: nested categories (Projects, Exposures)
// give each post its own subfolder and image folder.
const CATEGORIES = require("../../../_data/categories.json");
const FLAT_CATEGORY_DIRS = Object.fromEntries(
  CATEGORIES.filter((c) => !c.nested).map((c) => [c.dir, c.slug])
);
const NESTED_CATEGORY_DIRS = Object.fromEntries(
  CATEGORIES.filter((c) => c.nested).map((c) => [c.dir, c.slug])
);

const SITE_CONTENT_ROOT = path.join("DFTFR-Obsidian", "Website");
const PHOTOS_SOURCE_ROOT = "photos-source";
const DEFAULT_TREATMENT = "sepia";
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

function projectSlugFromPath(mdOrImagePath) {
  return path.basename(path.dirname(mdOrImagePath));
}

// Derives { category, projectSlug? } from a markdown file's inputPath, the
// same way _data/eleventyComputed.js derives project slugs — used by the
// Eleventy "photo-links" transform, which only has `this.page.inputPath`
// available (not `this.category`; transforms don't expose custom template
// data on `this`). Note: a flat .md file sitting directly inside a nested-
// category folder (e.g. Exposures/index.md, with no gallery subfolder of
// its own) gets its own filename back as `projectSlug` here — harmless for
// current callers (such files produce no photo refs), but don't build a
// photo key from this return value without checking for that case first.
function categoryRefFromInputPath(inputPath) {
  const rel = path.relative(SITE_CONTENT_ROOT, inputPath);
  const [dirName, second] = rel.split(path.sep);
  if (NESTED_CATEGORY_DIRS[dirName]) {
    return { category: NESTED_CATEGORY_DIRS[dirName], projectSlug: second };
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
const NESTED_SITE_CATEGORY_DIRS = Object.fromEntries(
  Object.entries(NESTED_CATEGORY_DIRS).map(([dir, slug]) => [slug, dir])
);

function resolveDestination(relativePath) {
  const [category, ...rest] = relativePath.split(path.sep);
  const nestedDirName = NESTED_SITE_CATEGORY_DIRS[category];
  if (nestedDirName) {
    const [projectSlug, filename] = rest;
    return {
      category,
      projectSlug,
      filename,
      siteDir: path.join(SITE_CONTENT_ROOT, nestedDirName, projectSlug),
    };
  }
  const [filename] = rest;
  const siteDirName = SITE_CATEGORY_DIRS[category];
  if (!siteDirName) throw new Error(`Unknown photo category folder: ${category}`);
  return { category, filename, siteDir: path.join(SITE_CONTENT_ROOT, siteDirName) };
}

// Maps an *absolute filesystem path* to an image already sitting somewhere
// in the vault (e.g. resolved from a Markdown embed like
// `![](../Exposures/some-gallery/photo.jpg)`) to the site-root URL it lands
// at after the passthrough-copy rules in eleventy.config.js run — flat
// categories copy straight to `/<slug>/<filename>`, nested categories
// (Projects, Exposures) preserve their per-post subfolder as
// `/<slug>/<subfolder>/<filename>`. Returns null if the path isn't under a
// known category folder (e.g. outside SITE_CONTENT_ROOT entirely).
function siteUrlForVaultImage(absPath) {
  const rel = path.relative(SITE_CONTENT_ROOT, absPath);
  if (rel.startsWith("..")) return null;
  const parts = rel.split(path.sep);
  const [dirName] = parts;
  if (NESTED_CATEGORY_DIRS[dirName]) {
    const [, projectSlug, filename] = parts;
    if (!projectSlug || !filename) return null;
    return `/${NESTED_CATEGORY_DIRS[dirName]}/${projectSlug}/${filename}`;
  }
  const slug = FLAT_CATEGORY_DIRS[dirName];
  if (!slug) return null;
  const [, filename] = parts;
  if (!filename) return null;
  return `/${slug}/${filename}`;
}

module.exports = {
  FLAT_CATEGORY_DIRS,
  NESTED_CATEGORY_DIRS,
  SITE_CONTENT_ROOT,
  PHOTOS_SOURCE_ROOT,
  DEFAULT_TREATMENT,
  IMAGE_EXTENSIONS,
  projectSlugFromPath,
  categoryRefFromInputPath,
  isPipelineManagedFilename,
  photoMetaKey,
  resolveDestination,
  siteUrlForVaultImage,
};
