#!/usr/bin/env node
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { exiftool } = require("exiftool-vendored");
const { PHOTOS_SOURCE_ROOT, IMAGE_EXTENSIONS } = require("./lib/categories");

const SITE_NAME = "Dispatches from the Far Reaches";

const STRIP_AND_SET_TAGS = {
  GPSLatitude: null,
  GPSLongitude: null,
  GPSAltitude: null,
  GPSPosition: null,
  SerialNumber: null,
  BodySerialNumber: null,
  LensSerialNumber: null,
  Copyright: SITE_NAME,
  Artist: SITE_NAME,
  OwnerName: SITE_NAME,
};

function findSourceImages(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  return fs
    .readdirSync(rootDir, { recursive: true })
    .filter((entry) => IMAGE_EXTENSIONS.includes(path.extname(entry).toLowerCase()))
    .map((entry) => path.join(rootDir, entry));
}

async function stripSensitiveMetadata(files) {
  for (const file of files) {
    await exiftool.write(file, STRIP_AND_SET_TAGS, ["-overwrite_original"]);
  }
}

function syncToS3(bucket) {
  execFileSync(
    "aws",
    ["s3", "sync", PHOTOS_SOURCE_ROOT, `s3://${bucket}`, "--size-only"],
    { stdio: "inherit" }
  );
}

async function run() {
  const bucket = process.env.PHOTOS_S3_BUCKET;
  if (!bucket) {
    throw new Error("PHOTOS_S3_BUCKET environment variable is not set.");
  }
  const files = findSourceImages(PHOTOS_SOURCE_ROOT);
  console.log(`Stripping sensitive metadata from ${files.length} photo(s)...`);
  await stripSensitiveMetadata(files);
  await exiftool.end();
  console.log(`Syncing photos-source/ to s3://${bucket} ...`);
  syncToS3(bucket);
  console.log("Done.");
}

module.exports = { run, findSourceImages, STRIP_AND_SET_TAGS };

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
