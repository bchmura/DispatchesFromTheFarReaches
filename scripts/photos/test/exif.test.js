const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const ffmpegPath = require("ffmpeg-static");
const { exiftool } = require("exiftool-vendored");
const {
  normalizeExifTags,
  readCaptureMeta,
  normalizeVideoTags,
  readVideoCaptureMeta,
  endExiftool,
} = require("../lib/exif");

// The exiftool singleton keeps child processes alive; without this the test
// process never exits.
test.after(() => endExiftool());

test("normalizeExifTags returns {} for missing EXIF", () => {
  assert.deepEqual(normalizeExifTags(undefined), {});
});

test("normalizeExifTags builds camera from Make + Model", () => {
  const meta = normalizeExifTags({ Make: "Fujifilm", Model: "X100V" });
  assert.equal(meta.camera, "Fujifilm X100V");
});

test("normalizeExifTags formats a sub-second exposure time as a fraction", () => {
  const meta = normalizeExifTags({ ExposureTime: 1 / 125 });
  assert.equal(meta.exposureTime, "1/125s");
});

test("normalizeExifTags formats aperture and ISO", () => {
  const meta = normalizeExifTags({ FNumber: 4, ISO: 400 });
  assert.equal(meta.aperture, "f/4");
  assert.equal(meta.iso, "400");
});

test("normalizeExifTags prefers DateTimeOriginal over CreateDate", () => {
  const meta = normalizeExifTags({
    DateTimeOriginal: new Date("2025-06-10T05:40:00Z"),
    CreateDate: new Date("2025-06-11T00:00:00Z"),
  });
  assert.equal(meta.captured, "2025-06-10T05:40:00.000Z");
});

test("readCaptureMeta returns {} when exifr.parse fails on invalid file", async () => {
  const tempFile = path.join(os.tmpdir(), `exif-test-${Date.now()}.txt`);
  fs.writeFileSync(tempFile, "This is not an image file");
  try {
    const meta = await readCaptureMeta(tempFile);
    assert.deepEqual(meta, {});
  } finally {
    fs.unlinkSync(tempFile);
  }
});

// Synthesizes a tiny real mp4 with the same bundled ffmpeg the pipeline
// uses, so the video-metadata tests exercise real exiftool reads.
function makeTestVideo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "exif-video-test-"));
  const out = path.join(dir, "clip.mp4");
  execFileSync(
    ffmpegPath,
    ["-y", "-f", "lavfi", "-i", "color=c=red:s=64x64:d=1", "-pix_fmt", "yuv420p", out],
    { stdio: ["ignore", "ignore", "pipe"] }
  );
  return out;
}

test("normalizeVideoTags maps Make/Model to camera", () => {
  const meta = normalizeVideoTags({ Make: "Apple", Model: "iPhone 15 Pro" });
  assert.equal(meta.camera, "Apple iPhone 15 Pro");
});

test("normalizeVideoTags maps a date tag with toDate() to a captured ISO string", () => {
  const meta = normalizeVideoTags({
    CreateDate: { toDate: () => new Date("2023-05-14T12:30:00Z") },
  });
  assert.equal(meta.captured, "2023-05-14T12:30:00.000Z");
});

test("normalizeVideoTags prefers CreationDate over CreateDate", () => {
  const meta = normalizeVideoTags({
    CreationDate: { toDate: () => new Date("2024-01-02T10:00:00Z") },
    CreateDate: { toDate: () => new Date("2023-05-14T12:30:00Z") },
  });
  assert.equal(meta.captured, "2024-01-02T10:00:00.000Z");
});

test("normalizeVideoTags returns {} for missing input and skips unusable date values", () => {
  assert.deepEqual(normalizeVideoTags(undefined), {});
  assert.deepEqual(normalizeVideoTags({}), {});
  // A raw string (no toDate) or an invalid date must not produce `captured`.
  assert.deepEqual(normalizeVideoTags({ CreateDate: "0000:00:00 00:00:00" }), {});
  assert.deepEqual(normalizeVideoTags({ CreateDate: { toDate: () => new Date(NaN) } }), {});
});

test("readVideoCaptureMeta reads a real CreateDate back from an mp4 via exiftool", async () => {
  const clip = makeTestVideo();
  await exiftool.write(clip, { CreateDate: "2023:05:14 12:30:00" }, ["-overwrite_original"]);
  const meta = await readVideoCaptureMeta(clip);
  assert.ok(meta.captured, "expected a captured date");
  assert.ok(meta.captured.startsWith("2023-05-14T"), `got ${meta.captured}`);
});

test("readVideoCaptureMeta returns {} for a file exiftool cannot read", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "exif-video-test-"));
  const bogus = path.join(dir, "not-a-video.mp4");
  fs.writeFileSync(bogus, "definitely not mp4 bytes");
  assert.deepEqual(await readVideoCaptureMeta(bogus), {});
});
