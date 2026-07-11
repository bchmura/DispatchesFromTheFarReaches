const IMG_TAG_PATTERN = /<img src="([^"/:]+\.(?:jpe?g|png|gif|webp))"([^>]*)>/gi;

function rewriteInlinePhotos(html, { category, cdnBase }) {
  if (!category || !cdnBase) return html;
  return html.replace(IMG_TAG_PATTERN, (fullMatch, filename, restAttrs) => {
    const thumbSrc = `/${category}/${filename}`;
    const fullUrl = `${cdnBase}/${category}/${filename}`;
    return `<a href="${fullUrl}" class="photo-link" target="_blank" rel="noopener"><img src="${thumbSrc}" class="treated-photo"${restAttrs}></a>`;
  });
}

module.exports = { rewriteInlinePhotos };
