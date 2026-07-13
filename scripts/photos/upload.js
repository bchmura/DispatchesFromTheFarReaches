#!/usr/bin/env node
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { exiftool } = require("exiftool-vendored");
const { PHOTOS_SOURCE_ROOT, IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } = require("./lib/categories");
const { remuxFaststart } = require("./lib/video");

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

// Videos get a smaller tag set: image-only tags (serial numbers, lens)
// aren't writable in mp4 and would make exiftool error out, while
// QuickTime files carry their location in GPSCoordinates instead.
const VIDEO_STRIP_AND_SET_TAGS = {
  GPSLatitude: null,
  GPSLongitude: null,
  GPSAltitude: null,
  GPSCoordinates: null,
  Copyright: SITE_NAME,
  Artist: SITE_NAME,
};

function findSourceImages(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  return fs
    .readdirSync(rootDir, { recursive: true })
    .filter((entry) => IMAGE_EXTENSIONS.includes(path.extname(entry).toLowerCase()))
    .map((entry) => path.join(rootDir, entry));
}

function findSourceVideos(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  return fs
    .readdirSync(rootDir, { recursive: true })
    .filter((entry) => VIDEO_EXTENSIONS.includes(path.extname(entry).toLowerCase()))
    .map((entry) => path.join(rootDir, entry));
}

async function stripSensitiveMetadata(files, tags) {
  for (const file of files) {
    await exiftool.write(file, tags, ["-overwrite_original"]);
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
  const images = findSourceImages(PHOTOS_SOURCE_ROOT);
  const videos = findSourceVideos(PHOTOS_SOURCE_ROOT);
  console.log(`Stripping sensitive metadata from ${images.length} photo(s) and ${videos.length} video(s)...`);
  await stripSensitiveMetadata(images, STRIP_AND_SET_TAGS);
  await stripSensitiveMetadata(videos, VIDEO_STRIP_AND_SET_TAGS);
  await exiftool.end();
  if (videos.length) {
    console.log(`Remuxing ${videos.length} video(s) for faststart playback...`);
    for (const video of videos) remuxFaststart(video);
  }
  console.log(`Syncing photos-source/ to s3://${bucket} ...`);
  syncToS3(bucket);
  console.log("Done.");
}

module.exports = { run, findSourceImages, findSourceVideos, STRIP_AND_SET_TAGS, VIDEO_STRIP_AND_SET_TAGS };

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
