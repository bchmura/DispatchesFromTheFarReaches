// Obsidian inserts `![[target]]` (or `![[target|alt text]]`) automatically
// when you drag/paste/autocomplete an image into a note — markdown-it has
// no idea what that syntax means. Rather than write a new inline rule from
// scratch, rewrite it to standard Markdown image syntax
// (`![alt](target)`) on the raw source string before markdown-it parses
// anything, so it flows through the exact same image handling (the
// "photo-links" transform's same-directory/cross-directory/external-URL
// branches) as a hand-typed `![]()` embed.
const WIKI_EMBED_PATTERN = /!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;

function obsidianImageEmbeds(md) {
  md.core.ruler.before("normalize", "obsidian_image_embeds", (state) => {
    state.src = state.src.replace(WIKI_EMBED_PATTERN, (_match, target, alt) => {
      return `![${alt || ""}](${target.trim()})`;
    });
  });
}

module.exports = { obsidianImageEmbeds };
