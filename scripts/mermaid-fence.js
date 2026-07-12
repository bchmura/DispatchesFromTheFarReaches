// markdown-it's default fence renderer emits mermaid code blocks as
// `<pre><code class="language-mermaid">...</code></pre>` — inert text as
// far as the browser is concerned. Mermaid's own client-side renderer
// looks for `<pre class="mermaid">` (or any element matching its
// querySelector) containing the *plain* diagram source, so this overrides
// just the "mermaid" info-string case to emit that shape instead, reusing
// markdown-it's own HTML-escaping (still valid, since the browser decodes
// entities back to the original source when Mermaid reads textContent).
function mermaidFence(md) {
  const defaultFence =
    md.renderer.rules.fence ||
    function (tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options);
    };

  md.renderer.rules.fence = function (tokens, idx, options, env, self) {
    const token = tokens[idx];
    const info = token.info ? md.utils.unescapeAll(token.info).trim() : "";
    const lang = info.split(/\s+/)[0];
    if (lang !== "mermaid") return defaultFence(tokens, idx, options, env, self);
    return `<pre class="mermaid">${md.utils.escapeHtml(token.content)}</pre>\n`;
  };
}

module.exports = { mermaidFence };
