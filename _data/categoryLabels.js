// Derived key -> label map so templates keep using `categoryLabels[key]`
// unchanged. Single source of truth: _data/categories.json.
const categories = require("./categories.json");
module.exports = Object.fromEntries(categories.map((c) => [c.key, c.label]));
