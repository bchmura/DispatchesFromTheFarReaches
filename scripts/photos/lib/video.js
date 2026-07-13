const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const ffmpegPath = require("ffmpeg-static");

function runFfmpeg(args) {
  execFileSync(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
}

// Grabs a poster frame ~1s in (input-side seek, so it's fast even on large
// files). A clip shorter than a second yields no output on that pass, so
// fall back to the very first frame before giving up. Returns the temp
// PNG's path; the caller is responsible for deleting it.
function extractVideoFrame(videoPath) {
  const outPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "video-frame-")), "frame.png");
  for (const seekArgs of [["-ss", "1"], []]) {
    try {
      runFfmpeg(["-y", ...seekArgs, "-i", videoPath, "-frames:v", "1", outPath]);
    } catch {
      // A failed pass falls through to the existence check below; only the
      // final throw reports the file as unreadable.
    }
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) return outPath;
  }
  throw new Error(`ffmpeg could not extract a poster frame from ${videoPath}`);
}

// Lossless remux that moves the moov atom to the front (faststart) so the
// browser can begin playback before the whole file has downloaded. Safe to
// re-run on every upload pass; replaces the file in place.
function remuxFaststart(videoPath) {
  const tmpPath = `${videoPath}.faststart.tmp.mp4`;
  try {
    runFfmpeg(["-y", "-i", videoPath, "-c", "copy", "-movflags", "+faststart", tmpPath]);
    fs.renameSync(tmpPath, videoPath);
  } finally {
    fs.rmSync(tmpPath, { force: true });
  }
}

module.exports = { extractVideoFrame, remuxFaststart };
