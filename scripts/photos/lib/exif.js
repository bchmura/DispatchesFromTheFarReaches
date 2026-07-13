const exifr = require("exifr");
const { exiftool } = require("exiftool-vendored");

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

// Video containers keep their metadata in QuickTime keys that exifr can't
// parse, so videos go through exiftool instead. Only camera and capture
// date realistically exist for video — lens/exposure/aperture/ISO stay
// absent and render as "missing" downstream, same as any photo without them.
function normalizeVideoTags(raw) {
  if (!raw) return {};
  const meta = {};
  if (raw.Make || raw.Model) {
    meta.camera = [raw.Make, raw.Model].filter(Boolean).join(" ").trim();
  }
  // exiftool-vendored returns ExifDateTime objects for real date tags; a
  // placeholder like "0000:00:00 00:00:00" comes back as a plain string
  // (no toDate) and is skipped.
  const captureDate = raw.CreationDate || raw.CreateDate || raw.MediaCreateDate;
  const asDate = captureDate && typeof captureDate.toDate === "function" ? captureDate.toDate() : null;
  if (asDate && !Number.isNaN(asDate.getTime())) {
    meta.captured = asDate.toISOString();
  }
  return meta;
}

async function readVideoCaptureMeta(filePath) {
  try {
    const raw = await exiftool.read(filePath);
    return normalizeVideoTags(raw);
  } catch (error) {
    return {};
  }
}

// exiftool keeps a background process pool alive; any script that used
// readVideoCaptureMeta must call this before exiting or node never exits.
function endExiftool() {
  return exiftool.end();
}

module.exports = {
  normalizeExifTags,
  readCaptureMeta,
  normalizeVideoTags,
  readVideoCaptureMeta,
  endExiftool,
};
