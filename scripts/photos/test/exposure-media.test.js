const test = require("node:test");
const assert = require("node:assert/strict");
const { exposureMediaFields } = require("../lib/exposure-media");

const args = { seriesSlug: "coastal-series", cdnBase: "https://cdn.example.com" };

test("a photo entry gets imageSrc and its own filename as the grid thumbnail", () => {
  assert.deepEqual(exposureMediaFields({ image: "fog-01.jpg", ...args }), {
    isVideo: false,
    imageSrc: "https://cdn.example.com/exposures/coastal-series/fog-01.jpg",
    videoSrc: null,
    thumbFilename: "fog-01.jpg",
  });
});

test("a video entry gets videoSrc and the derived .mp4.jpg grid thumbnail", () => {
  assert.deepEqual(exposureMediaFields({ image: "clip.mp4", ...args }), {
    isVideo: true,
    imageSrc: null,
    videoSrc: "https://cdn.example.com/exposures/coastal-series/clip.mp4",
    thumbFilename: "clip.mp4.jpg",
  });
});

test("an entry with no image yet resolves to all-null media fields", () => {
  assert.deepEqual(exposureMediaFields({ image: undefined, ...args }), {
    isVideo: false,
    imageSrc: null,
    videoSrc: null,
    thumbFilename: null,
  });
});
