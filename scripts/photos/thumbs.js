#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const {
  PHOTOS_SOURCE_ROOT,
  DEFAULT_TREATMENT,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  photoMetaKey,
  resolveDestination,
  videoThumbFilename,
} = require("./lib/categories");
const { scanVaultForImageRefs } = require("./lib/content-scan");
const { applyTreatment } = require("./lib/treatment");
const { readCaptureMeta } = require("./lib/exif");
const { extractVideoFrame } = require("./lib/video");

const PHOTO_META_PATH = path.join("_data", "photoMeta.json");
const MEDIA_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS];

function findSourceMedia(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  return fs
    .readdirSync(rootDir, { recursive: true })
    .filter((entry) => MEDIA_EXTENSIONS.includes(path.extname(entry).toLowerCase()))
    .map((entry) => path.join(rootDir, entry));
}

function needsRegeneration(sourcePath, destPath) {
  if (!fs.existsSync(destPath)) return true;
  return fs.statSync(sourcePath).mtimeMs > fs.statSync(destPath).mtimeMs;
}

// A photoTreatment frontmatter change doesn't touch the source file's mtime,
// so needsRegeneration alone would miss it — this returns true whenever the
// newly-computed treatment differs from what's already recorded in
// photoMeta for this photo, so re-running photos:thumbs after editing
// photoTreatment always regenerates the thumbnail.
function hasTreatmentChanged(existingEntry, newTreatment) {
  return existingEntry?.treatment !== undefined && existingEntry.treatment !== newTreatment;
}

async function run() {
  const refs = scanVaultForImageRefs();
  const refsByKey = new Map(refs.map((ref) => [photoMetaKey(ref), ref]));

  const photoMeta = fs.existsSync(PHOTO_META_PATH)
    ? JSON.parse(fs.readFileSync(PHOTO_META_PATH, "utf8"))
    : {};

  const sourceMedia = findSourceMedia(PHOTOS_SOURCE_ROOT);
  let processed = 0;

  for (const sourcePath of sourceMedia) {
    const relativePath = path.relative(PHOTOS_SOURCE_ROOT, sourcePath);
    const { category, projectSlug, filename, siteDir } = resolveDestination(relativePath);
    const key = photoMetaKey({ category, projectSlug, filename });
    const ref = refsByKey.get(key);
    const treatment = ref ? ref.treatment : DEFAULT_TREATMENT;
    const isVideo = VIDEO_EXTENSIONS.includes(path.extname(filename).toLowerCase());
    const destPath = path.join(siteDir, isVideo ? videoThumbFilename(filename) : filename);

    if (!ref) {
      console.warn(`No post references ${key} yet — processing with the default "${DEFAULT_TREATMENT}" treatment.`);
    }

    const needsImage = needsRegeneration(sourcePath, destPath) || hasTreatmentChanged(photoMeta[key], treatment);
    const needsMeta = !photoMeta[key];
    if (!needsImage && !needsMeta) continue;

    if (needsImage) {
      fs.mkdirSync(siteDir, { recursive: true });
      const pixelSource = isVideo ? extractVideoFrame(sourcePath) : sourcePath;
      await applyTreatment(sharp(pixelSource), treatment)
        .resize({ width: 640, withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toFile(destPath);
      if (isVideo) fs.rmSync(pixelSource, { force: true });
    }

    photoMeta[key] = { ...(await readCaptureMeta(sourcePath)), treatment };
    processed += 1;
  }

  fs.mkdirSync("_data", { recursive: true });
  fs.writeFileSync(PHOTO_META_PATH, JSON.stringify(photoMeta, null, 2) + "\n");
  console.log(`photos:thumbs — processed ${processed} media file(s), ${sourceMedia.length} total in photos-source/.`);
}

module.exports = { run, needsRegeneration, hasTreatmentChanged, findSourceMedia };

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
