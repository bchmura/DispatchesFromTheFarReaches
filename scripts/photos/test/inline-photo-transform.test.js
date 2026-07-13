const test = require("node:test");
const assert = require("node:assert/strict");
const { rewriteInlinePhotos } = require("../lib/inline-photo-transform");

const opts = { category: "family", cdnBase: "https://cdn.example.com" };

test("wraps a bare-filename img in a link to the CloudFront full-size version", () => {
  const out = rewriteInlinePhotos('<img src="porch.jpg" alt="The porch">', opts);
  assert.equal(
    out,
    '<a href="https://cdn.example.com/family/porch.jpg" class="photo-link" data-lightbox="image" target="_blank" rel="noopener"><img src="/family/porch.jpg" class="treated-photo" alt="The porch"></a>'
  );
});

test("leaves an already-absolute image path untouched", () => {
  const out = rewriteInlinePhotos('<img src="/assets/logo.svg" alt="logo">', opts);
  assert.equal(out, '<img src="/assets/logo.svg" alt="logo">');
});

test("leaves an external image URL untouched", () => {
  const out = rewriteInlinePhotos('<img src="https://example.com/x.jpg">', opts);
  assert.equal(out, '<img src="https://example.com/x.jpg">');
});

test("returns the input unchanged when no category is provided", () => {
  const html = '<img src="porch.jpg">';
  assert.equal(rewriteInlinePhotos(html, { cdnBase: opts.cdnBase }), html);
});

test("leaves a non-image extension untouched even though it has no leading slash", () => {
  const html = '<img src="diagram.svg" alt="diagram">';
  assert.equal(rewriteInlinePhotos(html, opts), html);
});

test("leaves a nested path untouched", () => {
  const html = '<img src="sub/photo.jpg">';
  assert.equal(rewriteInlinePhotos(html, opts), html);
});

test("builds a project-nested URL when projectSlug is provided", () => {
  const out = rewriteInlinePhotos(
    '<img src="barometer.jpg" alt="Barometer">',
    { category: "projects", projectSlug: "weather-station", cdnBase: opts.cdnBase }
  );
  assert.equal(
    out,
    '<a href="https://cdn.example.com/projects/weather-station/barometer.jpg" class="photo-link" data-lightbox="image" target="_blank" rel="noopener"><img src="/projects/weather-station/barometer.jpg" class="treated-photo" alt="Barometer"></a>'
  );
});

test("wraps a bare video filename with lightbox video markup and the derived poster thumbnail", () => {
  const out = rewriteInlinePhotos('<img src="clip.mp4" alt="The tide">', opts);
  assert.equal(
    out,
    '<a href="https://cdn.example.com/family/clip.mp4" class="photo-link video-link has-play-badge" data-lightbox="video" target="_blank" rel="noopener"><img src="/family/clip.mp4.jpg" class="treated-photo" alt="The tide"></a>'
  );
});

test("exposure-category images keep the exact pre-lightbox markup", () => {
  const out = rewriteInlinePhotos(
    '<img src="fog-01.jpg" alt="Fog">',
    { category: "exposures", projectSlug: "coastal-series", cdnBase: opts.cdnBase }
  );
  assert.equal(
    out,
    '<a href="https://cdn.example.com/exposures/coastal-series/fog-01.jpg" class="photo-link" target="_blank" rel="noopener"><img src="/exposures/coastal-series/fog-01.jpg" class="treated-photo" alt="Fog"></a>'
  );
});

test("videos in the exposures category still get the lightbox (only images are carved out)", () => {
  const out = rewriteInlinePhotos(
    '<img src="clip.mp4">',
    { category: "exposures", projectSlug: "coastal-series", cdnBase: opts.cdnBase }
  );
  assert.match(out, /data-lightbox="video"/);
});
