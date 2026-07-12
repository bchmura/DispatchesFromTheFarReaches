const test = require("node:test");
const assert = require("node:assert/strict");
const { toRoman, sortExposuresByCaptured } = require("../lib/exposure-order");

test("toRoman converts small integers", () => {
  assert.equal(toRoman(1), "I");
  assert.equal(toRoman(2), "II");
  assert.equal(toRoman(3), "III");
  assert.equal(toRoman(4), "IV");
  assert.equal(toRoman(9), "IX");
});

test("toRoman handles larger numbers with subtractive notation", () => {
  assert.equal(toRoman(40), "XL");
  assert.equal(toRoman(1994), "MCMXCIV");
});

test("toRoman throws on a non-positive-integer input", () => {
  assert.throws(() => toRoman(0), /positive integer/);
  assert.throws(() => toRoman(1.5), /positive integer/);
});

const CTX = { category: "exposures", seriesSlug: "coastal-series" };

test("sortExposuresByCaptured orders entries by their photo's EXIF capture date", () => {
  const exposures = [
    { title: "Second", image: "b.jpg" },
    { title: "First", image: "a.jpg" },
  ];
  const photoMeta = {
    "exposures/coastal-series/a.jpg": { captured: "2025-06-10T05:40:00.000Z" },
    "exposures/coastal-series/b.jpg": { captured: "2025-06-13T05:52:00.000Z" },
  };
  const sorted = sortExposuresByCaptured(exposures, photoMeta, CTX);
  assert.deepEqual(sorted.map((e) => e.title), ["First", "Second"]);
});

test("sortExposuresByCaptured puts entries with no image or no photoMeta entry at the end, preserving their written order", () => {
  const exposures = [
    { title: "No image yet" },
    { title: "Dated", image: "a.jpg" },
    { title: "Not thumbed yet", image: "missing.jpg" },
  ];
  const photoMeta = {
    "exposures/coastal-series/a.jpg": { captured: "2025-06-10T05:40:00.000Z" },
  };
  const sorted = sortExposuresByCaptured(exposures, photoMeta, CTX);
  assert.deepEqual(sorted.map((e) => e.title), ["Dated", "No image yet", "Not thumbed yet"]);
});

test("sortExposuresByCaptured is stable when all entries lack a date", () => {
  const exposures = [{ title: "A" }, { title: "B" }, { title: "C" }];
  const sorted = sortExposuresByCaptured(exposures, {}, CTX);
  assert.deepEqual(sorted.map((e) => e.title), ["A", "B", "C"]);
});
