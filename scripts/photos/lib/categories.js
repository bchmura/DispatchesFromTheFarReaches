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
  photoMetaKey,
  resolveDestination,
};
