const exifr = require("exifr");

function normalizeExifTags(raw) {
  if (!raw) return {};
  const meta = {};
  if (raw.Make || raw.Model) {
    meta.camera = [raw.Make, raw.Model].filter(Boolean).join(" ").trim();
  }
  if (raw.LensModel) meta.lens = raw.LensModel;
  if (raw.ExposureTime) {
    meta.exposureTime = raw.ExposureTime < 1
      ? `1/${Math.round(1 / raw.ExposureTime)}s`
      : `${raw.ExposureTime}s`;
  }
  if (raw.FNumber) meta.aperture = `f/${raw.FNumber}`;
  if (raw.ISO) meta.iso = String(raw.ISO);
  const captureDate = raw.DateTimeOriginal || raw.CreateDate;
  if (captureDate instanceof Date && !Number.isNaN(captureDate.getTime())) {
    meta.captured = captureDate.toISOString();
  }
  return meta;
}

async function readCaptureMeta(filePath) {
  try {
    const raw = await exifr.parse(filePath, {
      pick: ["Make", "Model", "LensModel", "ExposureTime", "FNumber", "ISO", "DateTimeOriginal", "CreateDate"],
    });
    return normalizeExifTags(raw);
  } catch (error) {
    return {};
  }
}

module.exports = { normalizeExifTags, readCaptureMeta };
