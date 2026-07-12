const { photoMetaKey } = require("./categories");

const ROMAN_NUMERALS = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

function toRoman(num) {
  if (!Number.isInteger(num) || num < 1) {
    throw new Error(`toRoman expects a positive integer, got ${num}`);
  }
  let remaining = num;
  let result = "";
  for (const [value, symbol] of ROMAN_NUMERALS) {
    while (remaining >= value) {
      result += symbol;
      remaining -= value;
    }
  }
  return result;
}

// Sorts a gallery's `exposures` frontmatter list by each entry's photo's
// EXIF capture date (looked up in _data/photoMeta.json, keyed the same way
// the rest of the photo pipeline keys it). Entries with no `image` field
// yet, or whose photo hasn't been through `photos:thumbs` yet, have no
// resolvable date — they sort to the end, in their original written order,
// so an in-progress gallery still renders sensibly rather than crashing or
// reordering unpredictably.
function sortExposuresByCaptured(exposures, photoMeta, { category, seriesSlug }) {
  const capturedTime = (exposure) => {
    if (!exposure.image) return null;
    const key = photoMetaKey({ category, projectSlug: seriesSlug, filename: exposure.image });
    const captured = photoMeta[key] && photoMeta[key].captured;
    if (!captured) return null;
    const time = new Date(captured).getTime();
    return Number.isNaN(time) ? null : time;
  };

  return exposures
    .map((exposure, index) => ({ exposure, index, time: capturedTime(exposure) }))
    .sort((a, b) => {
      if (a.time === null && b.time === null) return a.index - b.index;
      if (a.time === null) return 1;
      if (b.time === null) return -1;
      if (a.time !== b.time) return a.time - b.time;
      return a.index - b.index;
    })
    .map(({ exposure }) => exposure);
}

module.exports = { toRoman, sortExposuresByCaptured };
