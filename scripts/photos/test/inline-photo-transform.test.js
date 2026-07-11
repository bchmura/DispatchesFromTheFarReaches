const test = require("node:test");
const assert = require("node:assert/strict");
const { rewriteInlinePhotos } = require("../lib/inline-photo-transform");

const opts = { category: "family", cdnBase: "https://cdn.example.com/dispatchesfromthefarreaches" };

test("wraps a bare-filename img in a link to the CloudFront full-size version", () => {
  const out = rewriteInlinePhotos('<img src="porch.jpg" alt="The porch">', opts);
  assert.equal(
    out,
    '<a href="https://cdn.example.com/dispatchesfromthefarreaches/family/porch.jpg" class="photo-link" target="_blank" rel="noopener"><img src="/family/porch.jpg" class="treated-photo" alt="The porch"></a>'
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
