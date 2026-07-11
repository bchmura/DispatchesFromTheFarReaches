const { photoMetaKey } = require("./categories");

function findMissingThumbnails(refs, hasThumbnail) {
  return refs.filter((ref) => !hasThumbnail(photoMetaKey(ref)));
}

module.exports = { findMissingThumbnails };
