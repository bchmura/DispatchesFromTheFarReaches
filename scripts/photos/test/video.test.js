const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const ffmpegPath = require("ffmpeg-static");
const { extractVideoFrame, remuxFaststart } = require("../lib/video");

// Synthesizes a tiny real mp4 (2s of solid red) with the same bundled
// ffmpeg the lib uses, so these tests exercise the real binary end-to-end.
function makeTestVideo(seconds = 2) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "video-test-"));
  const out = path.join(dir, "clip.mp4");
  execFileSync(
    ffmpegPath,
    ["-y", "-f", "lavfi", "-i", `color=c=red:s=64x64:d=${seconds}`, "-pix_fmt", "yuv420p", out],
    { stdio: ["ignore", "ignore", "pipe"] }
  );
  return out;
}

test("extractVideoFrame writes a non-empty poster frame and returns its path", () => {
  const framePath = extractVideoFrame(makeTestVideo());
  assert.ok(fs.existsSync(framePath));
  assert.ok(fs.statSync(framePath).size > 0);
  fs.rmSync(framePath, { force: true });
});

test("extractVideoFrame falls back to frame 0 for a clip shorter than the 1s seek", () => {
  const framePath = extractVideoFrame(makeTestVideo(0.5));
  assert.ok(fs.existsSync(framePath));
  assert.ok(fs.statSync(framePath).size > 0);
  fs.rmSync(framePath, { force: true });
});

test("extractVideoFrame throws loudly on a file ffmpeg cannot read", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "video-test-"));
  const bogus = path.join(dir, "not-a-video.mp4");
  fs.writeFileSync(bogus, "definitely not mp4 bytes");
  assert.throws(() => extractVideoFrame(bogus), /poster frame/);
});

test("remuxFaststart rewrites the file in place and it remains readable", () => {
  const clip = makeTestVideo();
  remuxFaststart(clip);
  assert.ok(fs.statSync(clip).size > 0);
  // Round-trip: the remuxed file must still be a valid video ffmpeg can read.
  const framePath = extractVideoFrame(clip);
  assert.ok(fs.statSync(framePath).size > 0);
  fs.rmSync(framePath, { force: true });
});
