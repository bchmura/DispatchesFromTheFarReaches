const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { findSourceImages, STRIP_AND_SET_TAGS } = require("../upload");

test("findSourceImages only picks up recognized image extensions", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "photos-upload-test-"));
  fs.writeFileSync(path.join(tmp, "a.jpg"), "x");
  fs.writeFileSync(path.join(tmp, "notes.txt"), "x");
  const found = findSourceImages(tmp).map((f) => path.basename(f));
  assert.deepEqual(found, ["a.jpg"]);
});

test("findSourceImages returns an empty array for a folder that doesn't exist yet", () => {
  assert.deepEqual(findSourceImages(path.join(os.tmpdir(), "does-not-exist-xyz")), []);
});

test("STRIP_AND_SET_TAGS clears GPS/serial fields and sets ownership fields to the site name", () => {
  assert.equal(STRIP_AND_SET_TAGS.GPSLatitude, null);
  assert.equal(STRIP_AND_SET_TAGS.SerialNumber, null);
  assert.equal(STRIP_AND_SET_TAGS.BodySerialNumber, null);
  assert.equal(STRIP_AND_SET_TAGS.LensSerialNumber, null);
  assert.equal(STRIP_AND_SET_TAGS.Copyright, "Dispatches from the Far Reaches");
  assert.equal(STRIP_AND_SET_TAGS.Artist, "Dispatches from the Far Reaches");
  assert.equal(STRIP_AND_SET_TAGS.OwnerName, "Dispatches from the Far Reaches");
});
