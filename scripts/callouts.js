// Obsidian callouts (`> [!type] Title` blockquotes) have no markdown-it
// equivalent — markdown-it renders them as a plain <blockquote>, with the
// "[!type] Title" marker and the body text on the first <p>, joined by the
// same literal newline Obsidian's own soft-line-break authoring produces
// (breaks:false, so no <br> is inserted). This build-time transform detects
// that shape and rewrites it into a glyph + title/body callout, run as an
// Eleventy HTML transform (after markdown rendering) rather than a
// markdown-it plugin, since matching on rendered <blockquote>/<p> pairs is
// simpler than reimplementing blockquote parsing at the inline-rule level.

// Aliases Obsidian itself recognizes for each canonical callout type.
const ALIASES = {
  summary: "abstract",
  tldr: "abstract",
  hint: "tip",
  important: "tip",
  check: "success",
  done: "success",
  help: "question",
  faq: "question",
  caution: "warning",
  attention: "warning",
  fail: "failure",
  missing: "failure",
  error: "danger",
  cite: "quote",
};

const LABELS = {
  note: "Note",
  abstract: "Abstract",
  info: "Info",
  todo: "Todo",
  tip: "Tip",
  success: "Success",
  question: "Question",
  warning: "Warning",
  failure: "Failure",
  danger: "Danger",
  bug: "Bug",
  example: "Example",
  quote: "Quote",
};

// Line-icon glyphs, matching the site's existing brass/ink-green duotone
// inline-SVG convention (fill:none, stroke:currentColor) at UI-icon scale
// (viewBox 24, ~1.6 stroke-width) rather than the larger 64-viewBox category
// glyphs.
const GLYPHS = {
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 4h12v16H6z"/><path d="M9 9h6M9 13h6M9 17h3"/></svg>',
  abstract: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M9.5 12h5M9.5 15.5h5"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.7" r=".9" fill="currentColor" stroke="none"/></svg>',
  todo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 12.5l2.5 2.5L16 9"/></svg>',
  tip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3 11.2c.9.6 1 1.4 1 1.8h4c0-.4.1-1.2 1-1.8A6 6 0 0 0 12 3Z"/></svg>',
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.6 2.6L16 9"/></svg>',
  question: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.5 2.5 0 0 1 5 0c0 1.9-2.3 2.1-2.5 3.9"/><circle cx="12" cy="16.6" r=".9" fill="currentColor" stroke="none"/></svg>',
  warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3.5L21.5 20h-19Z"/><path d="M12 9.5v4.5"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/></svg>',
  failure: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
  danger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2.5l5 5v9l-5 5-5-5v-9Z"/><path d="M12 8.5v4.5"/><circle cx="12" cy="16.3" r=".9" fill="currentColor" stroke="none"/></svg>',
  bug: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="7" y="8.5" width="10" height="10" rx="4"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/><path d="M4 12h3M17 12h3M4 17h3M17 17h3M8 5.5 6.5 4M16 5.5 17.5 4"/></svg>',
  example: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 3h6M10 3v5.3L5.4 17a2 2 0 0 0 1.8 2.9h9.6a2 2 0 0 0 1.8-2.9L14 8.3V3"/></svg>',
  quote: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7.5 6.5c-2 0-3.2 1.6-3.2 3.7s1.3 3.6 3.2 3.6c0 2.1-1.1 3.4-3.2 3.4"/><path d="M16.5 6.5c-2 0-3.2 1.6-3.2 3.7s1.3 3.6 3.2 3.6c0 2.1-1.1 3.4-3.2 3.4"/></svg>',
};

// Border-style/opacity tiers, per the site's "vary by opacity/border, not
// new hues" rule (see Color palette / Status badges in the design spec) —
// only ever the one brass accent, just with rising emphasis.
const TIERS = {
  note: "quiet", abstract: "quiet", info: "quiet", todo: "quiet", example: "quiet", quote: "quiet",
  tip: "emphasis", success: "emphasis", question: "emphasis",
  warning: "alert", failure: "alert", danger: "alert", bug: "alert",
};

const CHEVRON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9l6 6 6-6"/></svg>';

const CALLOUT_PATTERN = /<blockquote>\s*<p>\[!(\w+)\]([+-]?)([^\n]*)\n([\s\S]*?)<\/blockquote>/g;

function rewriteCallouts(html) {
  return html.replace(CALLOUT_PATTERN, (fullMatch, rawType, fold, titleRest, bodyRest) => {
    const type = rawType.toLowerCase();
    const canonical = ALIASES[type] || type;
    const glyph = GLYPHS[canonical];
    if (!glyph) return fullMatch;
    const title = titleRest.trim() || LABELS[canonical];
    const tier = TIERS[canonical] || "quiet";
    const body = `<div class="callout-body"><p>${bodyRest}</div>`;

    // `+`/`-` marks the callout foldable, starting expanded/collapsed
    // respectively — plain `[!type]` (no suffix) stays a static, non-
    // interactive callout, matching Obsidian's own behavior.
    if (!fold) {
      return (
        `<div class="callout callout-${canonical} callout-${tier}">` +
        `<div class="callout-head"><span class="callout-glyph">${glyph}</span>` +
        `<span class="callout-title">${title}</span></div>${body}</div>`
      );
    }
    const expanded = fold === "+";
    return (
      `<div class="callout callout-${canonical} callout-${tier} callout-foldable">` +
      `<button type="button" class="callout-head" aria-expanded="${expanded}">` +
      `<span class="callout-glyph">${glyph}</span>` +
      `<span class="callout-title">${title}</span>` +
      `<span class="callout-chevron">${CHEVRON}</span></button>` +
      `<div class="callout-body"${expanded ? "" : " hidden"}><p>${bodyRest}</div>` +
      `</div>`
    );
  });
}

module.exports = { rewriteCallouts };
