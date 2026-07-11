const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { normalizeExifTags, readCaptureMeta } = require("../lib/exif");

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
