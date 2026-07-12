const path = require("node:path");
const { isPipelineManagedFilename, siteUrlForVaultImage } = require("./categories");

const IMG_TAG_PATTERN = /<img src="([^"]+)"([^>]*)>/gi;

function isExternalOrAbsolute(src) {
  return src.startsWith("/") || src.startsWith("data:") || /^[a-z][a-z0-9+.-]*:/i.test(src);
}

// `pageInputPath` (the source .md file's own path) is what lets a
// cross-directory embed — `![](../Exposures/some-gallery/photo.jpg)`,
// written relative to the *vault*, not the built page's URL — resolve to
// where that image actually lands after passthrough copy. Without it, the
// browser resolves the relative src against the page's own URL instead
// (e.g. a post at /misc/some-post/ turns `../Exposures/x.jpg` into
// /misc/Exposures/x.jpg, which doesn't exist).
function rewriteInlinePhotos(html, { category, projectSlug, cdnBase, pageInputPath }) {
  return html.replace(IMG_TAG_PATTERN, (fullMatch, src, restAttrs) => {
    if (isPipelineManagedFilename(src)) {
      if (!category || !cdnBase) return fullMatch;
      const categoryPath = projectSlug ? `${category}/${projectSlug}` : category;
      const thumbSrc = `/${categoryPath}/${src}`;
      const fullUrl = `${cdnBase}/${categoryPath}/${src}`;
      return `<a href="${fullUrl}" class="photo-link" target="_blank" rel="noopener"><img src="${thumbSrc}" class="treated-photo"${restAttrs}></a>`;
    }
    if (!isExternalOrAbsolute(src) && pageInputPath) {
      const resolved = path.resolve(path.dirname(pageInputPath), src);
      const siteUrl = siteUrlForVaultImage(resolved);
      if (siteUrl) return `<img src="${siteUrl}"${restAttrs}>`;
    }
    return fullMatch;
  });
}

module.exports = { rewriteInlinePhotos };
