const path = require("node:path");
const { isPipelineManagedFilename, siteUrlForVaultImage, isPipelineManagedVideoFilename, videoThumbFilename } = require("./categories");

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
    const isVideo = isPipelineManagedVideoFilename(src);
    if (isPipelineManagedFilename(src) || isVideo) {
      if (!category || !cdnBase) return fullMatch;
      const categoryPath = projectSlug ? `${category}/${projectSlug}` : category;
      const fullUrl = `${cdnBase}/${categoryPath}/${src}`;
      if (isVideo) {
        const thumbSrc = `/${categoryPath}/${videoThumbFilename(src)}`;
        return `<a href="${fullUrl}" class="photo-link video-link has-play-badge" data-lightbox="video" target="_blank" rel="noopener"><img src="${thumbSrc}" class="treated-photo"${restAttrs}></a>`;
      }
      const thumbSrc = `/${categoryPath}/${src}`;
      // Exposures keep their pre-lightbox behavior for photos by explicit
      // decision — the series/stage pages have their own viewing flow.
      const lightboxAttr = category === "exposures" ? "" : ' data-lightbox="image"';
      return `<a href="${fullUrl}" class="photo-link"${lightboxAttr} target="_blank" rel="noopener"><img src="${thumbSrc}" class="treated-photo"${restAttrs}></a>`;
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
