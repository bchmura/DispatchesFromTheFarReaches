const path = require("node:path");
const { VIDEO_EXTENSIONS, videoThumbFilename } = require("./categories");

// Resolves the media-facing fields for one Exposure Series entry: which
// CloudFront URL the single-exposure stage should show (photo vs video
// player), and which committed thumbnail the series grid should show (a
// video's is the derived poster jpg, never the mp4 itself).
function exposureMediaFields({ image, seriesSlug, cdnBase }) {
  if (!image) return { isVideo: false, imageSrc: null, videoSrc: null, thumbFilename: null };
  const isVideo = VIDEO_EXTENSIONS.includes(path.extname(image).toLowerCase());
  const cdnUrl = `${cdnBase}/exposures/${seriesSlug}/${image}`;
  return {
    isVideo,
    imageSrc: isVideo ? null : cdnUrl,
    videoSrc: isVideo ? cdnUrl : null,
    thumbFilename: isVideo ? videoThumbFilename(image) : image,
  };
}

module.exports = { exposureMediaFields };
