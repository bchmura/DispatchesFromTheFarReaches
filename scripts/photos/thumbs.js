#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const {
  PHOTOS_SOURCE_ROOT,
  DEFAULT_TREATMENT,
  IMAGE_EXTENSIONS,
  photoMetaKey,
  resolveDestination,
} = require("./lib/categories");
const { scanVaultForImageRefs } = require("./lib/content-scan");
const { applyTreatment } = require("./lib/treatment");
const { readCaptureMeta } = require("./lib/exif");

const PHOTO_META_PATH = path.join("_data", "photoMeta.json");

function findSourceImages(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  return fs
    .readdirSync(rootDir, { recursive: true })
    .filter((entry) => IMAGE_EXTENSIONS.includes(path.extname(entry).toLowerCase()))
    .map((entry) => path.join(rootDir, entry));
}

function needsRegeneration(sourcePath, destPath) {
  if (!fs.existsSync(destPath)) return true;
  return fs.statSync(sourcePath).mtimeMs > fs.statSync(destPath).mtimeMs;
}

async function run() {
  const refs = scanVaultForImageRefs();
  const refsByKey = new Map(refs.map((ref) => [photoMetaKey(ref), ref]));

  const photoMeta = fs.existsSync(PHOTO_META_PATH)
    ? JSON.parse(fs.readFileSync(PHOTO_META_PATH, "utf8"))
    : {};

  const sourceImages = findSourceImages(PHOTOS_SOURCE_ROOT);
  let processed = 0;

  for (const sourcePath of sourceImages) {
    const relativePath = path.relative(PHOTOS_SOURCE_ROOT, sourcePath);
    const { category, projectSlug, filename, siteDir } = resolveDestination(relativePath);
    const key = photoMetaKey({ category, projectSlug, filename });
    const ref = refsByKey.get(key);
    const treatment = ref ? ref.treatment : DEFAULT_TREATMENT;
    const destPath = path.join(siteDir, filename);

    if (!ref) {
      console.warn(`No post references ${key} yet — processing with the default "${DEFAULT_TREATMENT}" treatment.`);
    }

    if (!needsRegeneration(sourcePath, destPath)) continue;

    fs.mkdirSync(siteDir, { recursive: true });
    await applyTreatment(sharp(sourcePath), treatment)
      .resize({ width: 640, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toFile(destPath);

    photoMeta[key] = { ...(await readCaptureMeta(sourcePath)), treatment };
    processed += 1;
  }

  fs.mkdirSync("_data", { recursive: true });
  fs.writeFileSync(PHOTO_META_PATH, JSON.stringify(photoMeta, null, 2) + "\n");
  console.log(`photos:thumbs — processed ${processed} photo(s), ${sourceImages.length} total in photos-source/.`);
}

module.exports = { run, needsRegeneration };

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
