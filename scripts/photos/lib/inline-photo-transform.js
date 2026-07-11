const { isPipelineManagedFilename } = require("./categories");

const IMG_TAG_PATTERN = /<img src="([^"]+)"([^>]*)>/gi;

function rewriteInlinePhotos(html, { category, projectSlug, cdnBase }) {
  if (!category || !cdnBase) return html;
  return html.replace(IMG_TAG_PATTERN, (fullMatch, filename, restAttrs) => {
    if (!isPipelineManagedFilename(filename)) return fullMatch;
    const categoryPath = projectSlug ? `${category}/${projectSlug}` : category;
    const thumbSrc = `/${categoryPath}/${filename}`;
    const fullUrl = `${cdnBase}/${categoryPath}/${filename}`;
    return `<a href="${fullUrl}" class="photo-link" target="_blank" rel="noopener"><img src="${thumbSrc}" class="treated-photo"${restAttrs}></a>`;
  });
}

module.exports = { rewriteInlinePhotos };
