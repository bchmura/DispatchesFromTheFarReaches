const test = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");
const { applyTreatment } = require("../lib/treatment");

function swatch(r, g, b) {
  return sharp({ create: { width: 4, height: 4, channels: 3, background: { r, g, b } } });
}

test("bw treatment produces equal R/G/B channels", async () => {
  const { data } = await applyTreatment(swatch(200, 60, 40), "bw").raw().toBuffer({ resolveWithObject: true });
  assert.equal(data[0], data[1]);
  assert.equal(data[1], data[2]);
});

test("sepia treatment shifts toward warm brown tones", async () => {
  const { data } = await applyTreatment(swatch(150, 150, 150), "sepia").raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[0] > data[2], "red channel should exceed blue channel after sepia tint");
});

test("duotone-brass treatment shifts toward a brass/tan tone", async () => {
  const { data } = await applyTreatment(swatch(150, 150, 150), "duotone-brass").raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[0] > data[2], "red channel should exceed blue channel after duotone-brass tint");
});

test("applyTreatment rejects an unknown treatment name", () => {
  assert.throws(() => applyTreatment(swatch(0, 0, 0), "vintage-polaroid"), /Unknown photo treatment/);
});
