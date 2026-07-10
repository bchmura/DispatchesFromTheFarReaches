# Eleventy Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the mockups in `mockups/` and the Obsidian vault content in `DFTFR-Obsidian/Website/` into a working local Eleventy build, with a shared layout system, cleaned-up content, stub entries for empty categories, and local Pagefind search.

**Architecture:** Eleventy's input root is the project root. All build machinery (layouts, includes, data, CSS, JS, config) lives at the project root. `DFTFR-Obsidian/Website/**/*.md` is the only thing inside the vault; nothing else is added there. Nunjucks templating. One shared `assets/css/site.css` mechanically extracted from the `-claudedesign` mockup files — no visual changes. Pagefind runs as a second build step and is wired through its low-level JS API.

**Tech Stack:** Eleventy 3.1.6 (already installed), Nunjucks (bundled with Eleventy), Pagefind (to be added as a devDependency), plain JS (no framework) for search/dialog wiring, Node 24 / npm scripts for the migration helper script.

## Global Constraints

- No HTML markup inside any file under `DFTFR-Obsidian/`.
- Nothing except markdown content files (`.md`) may be added inside `DFTFR-Obsidian/`. No config, no CSS, no JS, no JSON data files there.
- Layout selection happens via `layout:`/`category:` frontmatter fields written directly into each content file — no directory-data-cascade JSON files.
- Visual design must exactly match the `-claudedesign` mockup files in `mockups/` — treat them as source of truth over `docs/designSpecifications.md` wherever the two disagree.
- URL scheme: `/category/slug/`, category folder name lowercased, filename already matches its title's slug.
- Respect `prefers-reduced-motion` on every transition, matching the mockups.
- Photos: passthrough copy is one explicit per-category mapping in root `eleventy.config.js`; images referenced from markdown as root-relative paths (`/category/filename.jpg`).
- GitHub Actions/CI is explicitly out of scope for this plan.

---

## Task 1: Eleventy project scaffolding

**Files:**
- Modify: `package.json`
- Create: `eleventy.config.js`
- Create: `.eleventyignore`

**Interfaces:**
- Produces: `npm run build` (one-shot build), `npm run serve` (dev server, no search index) — later tasks assume these exist.

- [ ] **Step 1: Add the Eleventy config file**

Create `eleventy.config.js`:

```js
module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "assets": "assets" });

  return {
    dir: {
      input: ".",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
  };
};
```

- [ ] **Step 2: Add `.eleventyignore`**

Create `.eleventyignore` at the project root:

```
DFTFR-Obsidian/.obsidian
DFTFR-Obsidian/Templates
DFTFR-Obsidian.zip
mockups
docs
node_modules
package.json
package-lock.json
```

- [ ] **Step 3: Add build/serve scripts to `package.json`**

Modify the `"scripts"` block in `package.json` to:

```json
"scripts": {
  "build": "eleventy && pagefind --site _site",
  "serve": "eleventy --serve",
  "test": "echo \"Error: no test specified\" && exit 1"
},
```

- [ ] **Step 4: Verify the build runs cleanly**

Run: `npx eleventy`
Expected: exits 0, prints a "Wrote N files" line (N will be small/zero-ish at this point since no templates exist yet besides passthrough).

- [ ] **Step 5: Verify the ignored paths are not touched**

Run: `ls _site 2>/dev/null; find _site -iname "*.obsidian*" -o -iname "*Templates*" 2>/dev/null`
Expected: `_site` may not exist yet or be empty of any `DFTFR-Obsidian` artifacts — no matches from the find command.

- [ ] **Step 6: Commit**

```bash
git add package.json eleventy.config.js .eleventyignore
git commit -m "chore: scaffold eleventy config and ignore rules"
```

*(If this repo is not a git repository yet, skip the commit steps in this plan and note it to the user — do not run `git init` without asking.)*

---

## Task 2: Global data, base layout, shared partials, and site.css

**Files:**
- Create: `_data/site.json`
- Create: `_data/categories.json`
- Create: `_includes/partials/head.njk`
- Create: `_includes/partials/nav.njk`
- Create: `_includes/partials/footer.njk`
- Create: `_includes/base.njk`
- Create: `assets/css/site.css`
- Create (temporary, deleted in Step 8): `smoke-test.njk`

**Interfaces:**
- Produces: `base.njk` layout consumed by every other layout via `{% extends "base.njk" %}` and a `{% block content %}` block. `site.json` exposes `site.title` and `site.footerCredit`. `categories.json` exposes an array of `{key, label, slug, glyphSvg}` used by nav, footer cats-strip, and later the category listing template.

- [ ] **Step 1: Add `_data/site.json`**

```json
{
  "title": "Dispatches from the Far Reaches",
  "footerCredit": "Expeditions supported by Miskatonic University (Arkham, MA)"
}
```

- [ ] **Step 2: Add `_data/categories.json`**

```json
[
  { "key": "professional", "label": "Professional", "slug": "professional" },
  { "key": "philosophy", "label": "Philosophy", "slug": "philosophy" },
  { "key": "projects", "label": "Projects", "slug": "projects" },
  { "key": "exposures", "label": "Exposures", "slug": "exposures" },
  { "key": "family", "label": "Family", "slug": "family" },
  { "key": "fiction", "label": "Fiction", "slug": "fiction" },
  { "key": "misc", "label": "Misc", "slug": "misc" }
]
```

- [ ] **Step 3: Add `_includes/partials/head.njk`**

```njk
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{% if title %}{{ title }} — {% endif %}{{ site.title }}</title>
<link rel="stylesheet" href="/assets/css/site.css" />
```

- [ ] **Step 4: Add `_includes/partials/nav.njk`**

This is the exact nav markup from every mockup (`header.site` / `nav.bar`), parameterized on `category` (the current page's category key, if any) for the `.current` class:

```njk
<header class="site">
  <nav class="bar">
    <a class="brand" href="/">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1" aria-hidden="true">
        <circle cx="12" cy="12" r="9.5"/>
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>
        <path d="M12 6.5l2.4 5.5-2.4 5.5-2.4-5.5z" fill="currentColor" stroke="none"/>
      </svg>
      {{ site.title }}
    </a>
    <button class="navtoggle" aria-label="Toggle navigation" aria-expanded="false" onclick="var n=document.getElementById('navlinks');var open=n.classList.toggle('open');this.setAttribute('aria-expanded',open);">
      <span></span><span></span><span></span>
    </button>
    <div class="navlinks" id="navlinks">
      {% for cat in categories %}
      <a href="/{{ cat.slug }}/"{% if category == cat.key %} class="current"{% endif %}>{{ cat.label }}</a>
      {% endfor %}
    </div>
  </nav>
</header>
```

- [ ] **Step 5: Add `_includes/partials/footer.njk`**

```njk
<section class="cats">
  <div class="wrap cats-inner">
    {% for cat in categories %}
    <a href="/{{ cat.slug }}/"{% if category == cat.key %} class="current"{% endif %}>{{ cat.label }}</a>
    {% endfor %}
  </div>
</section>

<footer class="wrap">
  <span class="foot-credit">
    <svg class="stamp" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
      <circle cx="20" cy="20" r="17"/>
      <circle cx="20" cy="20" r="12.5"/>
      <path d="M20 9v4M20 27v4M9 20h4M27 20h4"/>
      <path d="M20 14l3 6-3 6-3-6z" fill="currentColor" stroke="none"/>
    </svg>
    {{ site.footerCredit }}
  </span>
  <span class="fnav">
    <a href="#">RSS</a>
    <a href="/about/"{% if page.url == "/about/" %} class="current"{% endif %}>About</a>
    <a href="/contact/"{% if page.url == "/contact/" %} class="current"{% endif %}>File a Dispatch</a>
  </span>
</footer>
```

- [ ] **Step 6: Add `_includes/base.njk`**

```njk
<!doctype html>
<html lang="en">
<head>
{% include "partials/head.njk" %}
</head>
<body>
{% include "partials/nav.njk" %}
{% block content %}{% endblock %}
{% include "partials/footer.njk" %}
</body>
</html>
```

- [ ] **Step 7: Add `assets/css/site.css`**

Mechanically extracted and deduped from the shared `<style>` block present in every `-claudedesign` mockup (tokens, texture overlay, nav, hero, posts/featured/list/tag/aside/search, cats strip, footer, entry-actions hover) plus the page-specific rules from the article, category, about, contact, projects, and exposures/plateset mockups:

```css
:root{
  --bg:#14150f; --bg-raised:#1b2318; --bg-raised-2:#20291d;
  --ink:#e7e1cf; --ink-dim:#a89f89; --ink-faint:#6f6a57;
  --brass:#c19a4b; --brass-dim:#8a6d34; --rule:#2e3324; --indent:36px;
  --serif-display: 'IM Fell English','Iowan Old Style',Palatino,serif;
  --serif-body: 'EB Garamond',Georgia,serif;
  --mono: 'Fragment Mono',ui-monospace,'Cascadia Mono',Menlo,monospace;
}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{background:var(--bg);color:var(--ink);font-family:var(--serif-body);line-height:1.6;-webkit-font-smoothing:antialiased;}
a{color:inherit;text-decoration:none;}
:focus-visible{outline:2px solid var(--brass);outline-offset:3px;}

@keyframes lanternFlicker{0%,100%{opacity:1}16%{opacity:.94}33%{opacity:.995}49%{opacity:.9}64%{opacity:.97}82%{opacity:.93}}
@media (prefers-reduced-motion:reduce){body::after{animation:none!important;}}
body::after{
  content:"";position:fixed;inset:0;z-index:6;pointer-events:none;animation:lanternFlicker 9s ease-in-out infinite;
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E"),
    radial-gradient(circle at 82% 6%, rgba(200,161,86,.10) 0%, rgba(200,161,86,.03) 26%, transparent 56%),
    radial-gradient(ellipse 120% 112% at 70% 26%, transparent 55%, rgba(0,0,0,.24) 86%, rgba(0,0,0,.38) 100%);
  background-size:140px 140px, 100% 100%, 100% 100%;
  background-repeat:repeat, no-repeat, no-repeat;
}
body::before{
  content:"";position:fixed;right:-96px;bottom:-96px;width:460px;height:460px;z-index:0;pointer-events:none;opacity:.08;
  background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' fill='none' stroke='%23c19a4b' stroke-width='1.3'%3E%3Ccircle cx='100' cy='100' r='94'/%3E%3Ccircle cx='100' cy='100' r='70'/%3E%3Ccircle cx='100' cy='100' r='9'/%3E%3Cpath d='M100 6v18M100 176v18M6 100h18M176 100h18'/%3E%3Cpath d='M100 30 L112 100 L100 170 L88 100 Z' fill='%23c19a4b' stroke='none' opacity='.55'/%3E%3Cpath d='M30 100 L100 88 L170 100 L100 112 Z' fill='%23c19a4b' stroke='none' opacity='.4'/%3E%3Cpath d='M55 55 L100 100 L55 145M145 55 L100 100 L145 145' stroke-width='.8' opacity='.6'/%3E%3C/svg%3E") center/contain no-repeat;
}
.hero,main.wrap,.cats,footer.wrap{position:relative;z-index:1;}

.wrap{max-width:1180px;margin:0 auto;padding:0 24px;}

header.site{border-bottom:1px solid var(--rule);position:sticky;top:0;background:var(--bg);z-index:20;}
nav.bar{display:flex;align-items:center;justify-content:space-between;height:72px;max-width:1180px;margin:0 auto;padding:0 24px;}
.brand{font-family:var(--serif-display);font-size:1.1rem;letter-spacing:.02em;display:flex;align-items:center;gap:10px;white-space:nowrap;}
.brand svg{width:26px;height:26px;flex:none;}
.navlinks{display:flex;gap:18px;font-family:var(--mono);font-size:.64rem;letter-spacing:.06em;text-transform:uppercase;}
.navlinks a{color:var(--ink-dim);border-bottom:1px solid transparent;padding-bottom:4px;transition:color .15s,border-color .15s;white-space:nowrap;}
.navlinks a:hover,.navlinks a:focus-visible,.navlinks a.current{color:var(--brass);border-color:var(--brass-dim);}
.navtoggle{display:none;background:none;border:1px solid var(--rule);color:var(--ink);width:40px;height:40px;border-radius:2px;flex:none;}
.navtoggle span{display:block;width:18px;height:1px;background:var(--ink);margin:4px auto;}
@media (max-width:960px){
  .navlinks{position:absolute;top:72px;left:0;right:0;background:var(--bg-raised);flex-direction:column;gap:0;border-bottom:1px solid var(--rule);max-height:0;overflow:hidden;transition:max-height .25s ease;}
  .navlinks.open{max-height:400px;}
  .navlinks a{display:block;padding:14px 24px;border-bottom:1px solid var(--rule);}
  .navtoggle{display:block;}
}
@media (prefers-reduced-motion:reduce){ .navlinks{transition:none;} }

.hero{border-bottom:1px solid var(--rule);background:radial-gradient(ellipse 100% 150% at 96% 2%, rgba(193,154,75,.14) 0%, rgba(193,154,75,.06) 38%, transparent 68%),var(--bg);}
.hero-inner{display:grid;grid-template-columns:1.3fr .9fr;gap:48px;align-items:center;padding:72px 0 64px;}
.hero-text{padding-left:var(--indent);}
.kicker{font-family:var(--mono);font-size:.7rem;letter-spacing:.18em;text-transform:uppercase;color:var(--brass-dim);margin:0 0 18px;}
h1.title{font-family:var(--serif-display);font-weight:400;font-size:clamp(2.1rem,4.4vw,3.4rem);letter-spacing:.01em;line-height:1.08;margin:0 0 20px;text-wrap:balance;color:var(--ink);}
h1.title em{font-style:italic;color:var(--brass);}
.hero p.sub{color:var(--ink-dim);font-size:1.05rem;max-width:46ch;margin:0;}
.hero-mark{display:flex;justify-content:center;}
.hero-mark svg{width:100%;max-width:220px;height:auto;}
@media (max-width:820px){ .hero-inner{grid-template-columns:1fr;padding:44px 0 40px;gap:28px;} .hero-mark{order:-1;max-width:140px;margin:0 auto;} }
@media (max-width:600px){ .hero-text{padding-left:16px;} }

main.wrap{padding:64px 24px 40px;}
h2.section-head{font-family:var(--serif-display);font-weight:400;font-size:1.5rem;margin:0 0 32px;padding-left:var(--indent);display:flex;align-items:baseline;gap:16px;}
h2.section-head::after{
  content:"";flex:1;height:8px;align-self:center;
  background:
    linear-gradient(var(--rule),var(--rule)) left center/100% 1px no-repeat,
    repeating-linear-gradient(90deg, var(--brass-dim) 0 1px, transparent 1px 34px) left bottom/100% 6px no-repeat;
  opacity:.85;
}

.posts{display:grid;grid-template-columns:1.5fr 1fr;gap:40px;padding-left:var(--indent);}
@media (max-width:900px){.posts{grid-template-columns:1fr;}}
@media (max-width:600px){.posts{padding-left:16px;}}

.featured{border:1px solid var(--rule);background:var(--bg-raised);border-radius:2px;overflow:hidden;}
.featured-media{aspect-ratio:16/8;display:block;}
.featured-media svg{width:100%;height:100%;display:block;}
.featured-body{padding:32px 36px 36px;}
.featured .tag{margin-bottom:16px;}
.featured h3{font-family:var(--serif-display);font-size:1.7rem;font-weight:400;line-height:1.22;margin:0 0 14px;text-wrap:balance;}
.featured p{color:var(--ink-dim);margin:0 0 18px;max-width:52ch;}
.meta{font-family:var(--mono);font-size:.72rem;color:var(--ink-faint);letter-spacing:.04em;}
.readlink{display:inline-flex;align-items:center;gap:8px;margin-top:18px;font-family:var(--mono);font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;color:var(--brass);}
.readlink svg{width:14px;height:14px;}

.tag{display:inline-flex;align-items:center;justify-content:center;width:128px;height:24px;flex:none;font-family:var(--mono);font-size:.64rem;letter-spacing:.07em;text-transform:uppercase;color:var(--brass);border:1px solid var(--brass-dim);border-radius:1px;}

.list{display:flex;flex-direction:column;}
.list article{padding:22px 0;border-bottom:1px solid var(--rule);}
.list article:first-child{padding-top:0;}
.list h3{font-family:var(--serif-display);font-size:1.15rem;font-weight:400;margin:10px 0 8px;line-height:1.3;text-wrap:balance;}
.list p{color:var(--ink-dim);font-size:.92rem;margin:0;}

.entry-head{display:flex;align-items:center;justify-content:space-between;gap:14px;}
.entry-right{position:relative;min-height:24px;display:flex;align-items:center;}
.entry-tags-inline{display:flex;gap:8px;transition:opacity .15s ease;}
.entry-tags-inline a,.entry-tags a{font-family:var(--mono);font-size:.64rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-dim);border:1px solid var(--rule);padding:4px 9px;border-radius:1px;transition:color .15s,border-color .15s,background-color .15s;}
.entry-tags-inline a:hover,.entry-tags-inline a:focus-visible,.entry-tags a:hover,.entry-tags a:focus-visible{color:var(--brass);border-color:var(--brass-dim);background:var(--bg-raised);}
.entry-tags{display:flex;flex-wrap:wrap;gap:8px;}
.date-hover{position:absolute;top:0;right:0;display:flex;align-items:center;height:100%;font-family:var(--mono);font-size:.68rem;letter-spacing:.03em;color:var(--ink-faint);opacity:0;transition:opacity .15s ease;white-space:nowrap;}
.date-hover .dispatch-no{color:var(--brass-dim);}
.list article:hover .entry-tags-inline,.list article:focus-within .entry-tags-inline{opacity:0;}
.list article:hover .date-hover,.list article:focus-within .date-hover{opacity:1;}
@media (prefers-reduced-motion:reduce){ .date-hover,.entry-tags-inline{transition:none;} }

.aside-stack{display:flex;flex-direction:column;gap:24px;}
.tag-aside{flex:1;display:flex;flex-direction:column;border:1px solid var(--rule);background:var(--bg-raised);border-radius:2px;padding:28px 26px;}
.tag-aside .section-head{margin:0 0 20px;padding-left:0;font-size:1.15rem;}
.cloud{display:flex;flex-wrap:wrap;gap:10px;align-content:flex-start;}
.cloud a{font-family:var(--mono);font-size:.66rem;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-dim);border:1px solid var(--rule);padding:6px 11px;border-radius:1px;transition:color .15s,border-color .15s,background-color .15s;}
.cloud a:hover,.cloud a:focus-visible{color:var(--brass);border-color:var(--brass-dim);background:var(--bg-raised-2);}
.cloud a.freq-2{font-size:.88rem;color:var(--brass-dim);border-color:var(--brass-dim);}
@media (max-width:900px){ .aside-stack{margin-top:8px;} }

.search-aside{flex:none;border:1px solid var(--rule);background:var(--bg-raised);border-radius:2px;padding:26px 26px;}
.search-label{font-family:var(--mono);font-size:.66rem;letter-spacing:.06em;text-transform:uppercase;color:var(--brass-dim);margin:0 0 12px;}
.search-line{display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--rule);padding-bottom:8px;transition:border-color .15s;}
.search-line:focus-within{border-color:var(--brass-dim);}
.search-line svg{width:16px;height:16px;color:var(--brass-dim);flex:none;}
.search-line input{flex:1;min-width:0;background:none;border:none;color:var(--ink);font-family:var(--serif-body);font-size:.92rem;padding:0;}
.search-line input::placeholder{color:var(--ink-faint);font-style:italic;}
.search-line input:focus{outline:none;}
.search-results{margin-top:14px;display:flex;flex-direction:column;gap:10px;}
.search-results a{display:block;font-family:var(--mono);font-size:.72rem;color:var(--ink-dim);border-bottom:1px solid var(--rule);padding-bottom:8px;}
.search-results a:hover,.search-results a:focus-visible{color:var(--brass);}
.search-results .no-results{font-family:var(--serif-body);font-style:italic;font-size:.85rem;color:var(--ink-faint);}

.cats{border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);margin-top:56px;background:var(--bg-raised-2);}
.cats-inner{display:flex;gap:0;overflow-x:auto;}
.cats a{flex:1 0 auto;min-width:120px;padding:22px 14px;text-align:center;border-right:1px solid var(--rule);font-family:var(--mono);font-size:.68rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-dim);transition:color .15s,background .15s;}
.cats a:last-child{border-right:none;}
.cats a:hover,.cats a:focus-visible,.cats a.current{color:var(--brass);background:var(--bg-raised);}

footer{color:var(--ink-faint);font-size:.85rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;}
footer.wrap{padding:38px 24px 42px;}
footer .foot-credit,footer .fnav{font-family:var(--mono);letter-spacing:.06em;text-transform:uppercase;}
footer .foot-credit{display:flex;align-items:center;gap:16px;font-size:1.1rem;color:var(--ink-dim);}
footer .stamp{width:42px;height:42px;flex:none;color:var(--brass-dim);opacity:.6;transform:rotate(-8deg);}
footer .fnav{display:flex;gap:18px;font-size:.72rem;}
footer .fnav a:hover,footer .fnav a.current{color:var(--brass);}

.entry-actions{height:20px;margin-top:10px;display:flex;justify-content:space-between;align-items:center;gap:18px;overflow:hidden;font-family:var(--mono);font-size:.68rem;letter-spacing:.07em;text-transform:uppercase;opacity:0;pointer-events:none;transition:opacity .15s ease;}
.list article:hover .entry-actions,.list article:focus-within .entry-actions,.journal article:hover .entry-actions,.journal article:focus-within .entry-actions{opacity:1;pointer-events:auto;}
.entry-actions a{color:var(--brass);border-bottom:1px solid transparent;}
.entry-actions a:hover,.entry-actions a:focus-visible{border-color:var(--brass-dim);}
@media (prefers-reduced-motion:reduce){.entry-actions{transition:none;}}

/* ---------- Article page ---------- */
.art-header{border-bottom:1px solid var(--rule);padding:52px 0 40px;background:radial-gradient(ellipse 80% 120% at 94% 6%, rgba(193,154,75,.11) 0%, rgba(193,154,75,.04) 40%, transparent 70%),var(--bg);}
.art-header .inner{margin:0 0 0 var(--indent);position:relative;}
.art-meta-row{display:flex;align-items:center;gap:16px;margin-bottom:18px;flex-wrap:wrap;}
.cat-pill{font-family:var(--mono);font-size:.66rem;letter-spacing:.07em;text-transform:uppercase;color:var(--brass);border:1px solid var(--brass-dim);padding:4px 10px;border-radius:1px;}
.art-date{font-family:var(--mono);font-size:.7rem;letter-spacing:.03em;color:var(--ink-faint);}
.art-date .dispatch-no{color:var(--brass-dim);}
.art-header h1{font-family:var(--serif-display);font-weight:400;font-size:clamp(2rem,4.2vw,2.9rem);line-height:1.15;margin:0 0 16px;text-wrap:balance;}
.art-tags{display:flex;flex-wrap:wrap;gap:8px;}
.art-tags a{font-family:var(--mono);font-size:.64rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-dim);border:1px solid var(--rule);padding:4px 9px;border-radius:1px;transition:color .15s,border-color .15s,background-color .15s;}
.art-tags a:hover,.art-tags a:focus-visible{color:var(--brass);border-color:var(--brass-dim);background:var(--bg-raised);}
@media (max-width:600px){ .art-header .inner{padding-left:16px;} }

.art-body{margin:0 0 0 var(--indent);padding:52px 0 8px;}
.art-body p,.art-body blockquote{max-width:75ch;}
@media (max-width:600px){ .art-body{margin-left:16px;padding:36px 0 8px;} }
.art-body p{color:var(--ink-dim);font-size:1.24rem;line-height:1.72;margin:0 0 26px;}
.art-body p.lede{color:var(--ink);font-size:1.4rem;line-height:1.62;}
.art-body blockquote{margin:38px 0;padding:4px 0 4px 26px;border-left:2px solid var(--brass-dim);font-family:var(--serif-body);font-style:italic;font-size:1.34rem;color:var(--ink);line-height:1.6;}
.art-body h2{font-family:var(--serif-display);font-weight:400;font-size:1.6rem;color:var(--ink);margin:48px 0 18px;text-wrap:balance;}

.accession{font-family:var(--mono);font-size:.62rem;letter-spacing:.15em;text-transform:uppercase;color:var(--brass-dim);margin:0 0 14px;}
.art-body p.lede::first-letter{float:left;font-family:var(--serif-display);font-weight:400;font-size:4.4rem;line-height:.82;padding:8px 14px 0 2px;color:var(--brass);}
.stamp-mark{position:absolute;top:-4px;right:0;width:120px;height:120px;color:var(--brass-dim);opacity:.17;transform:rotate(-11deg);pointer-events:none;}
.stamp-mark text{font-family:var(--mono);font-size:8.1px;letter-spacing:1px;}
@media (max-width:760px){ .stamp-mark{display:none;} }
.cross-filed{display:flex;align-items:center;gap:10px 14px;flex-wrap:wrap;margin-bottom:30px;padding-bottom:26px;border-bottom:1px solid var(--rule);}
.cf-label{font-family:var(--mono);font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;color:var(--brass-dim);margin-right:2px;}
.cross-filed a{font-family:var(--mono);font-size:.64rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-dim);border:1px solid var(--rule);padding:4px 9px;border-radius:1px;transition:color .15s,border-color .15s,background-color .15s;}
.cross-filed a:hover,.cross-filed a:focus-visible{color:var(--brass);border-color:var(--brass-dim);background:var(--bg-raised);}

.art-foot{margin:0 0 0 var(--indent);padding:8px 0 56px;border-bottom:1px solid var(--rule);}
@media (max-width:600px){ .art-foot{margin-left:16px;padding:8px 0 40px;} }
.art-contact{border:1px solid var(--rule);background:var(--bg-raised);border-radius:2px;padding:22px 24px;margin-bottom:28px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;}
.art-contact p{margin:0;color:var(--ink-dim);font-size:1.12rem;line-height:1.55;max-width:48ch;}
.art-contact a{display:inline-flex;align-items:center;gap:8px;font-family:var(--mono);font-size:.82rem;letter-spacing:.08em;text-transform:uppercase;color:var(--brass);white-space:nowrap;}
.art-contact a svg{width:14px;height:14px;}
.art-contact a:hover,.art-contact a:focus-visible{color:var(--brass-dim);}
.art-nav{display:grid;grid-template-columns:1fr 1fr;gap:24px;}
.art-nav a{display:block;border:1px solid var(--rule);background:var(--bg-raised);padding:20px 22px;border-radius:2px;transition:border-color .15s,background .15s;}
.art-nav a:hover,.art-nav a:focus-visible{border-color:var(--brass-dim);background:var(--bg-raised-2);}
.art-nav .dir{display:block;font-family:var(--mono);font-size:.64rem;letter-spacing:.08em;text-transform:uppercase;color:var(--brass-dim);margin-bottom:8px;}
.art-nav .next{text-align:right;}
.art-nav h4{font-family:var(--serif-display);font-weight:400;font-size:1.05rem;margin:0;line-height:1.3;text-wrap:balance;color:var(--ink);}
@media (max-width:640px){ .art-nav{grid-template-columns:1fr;} .art-nav .next{text-align:left;} }

/* ---------- Category / listing pages ---------- */
.cat-header{border-bottom:1px solid var(--rule);padding:52px 0 38px;background:radial-gradient(ellipse 80% 120% at 94% 6%, rgba(193,154,75,.11) 0%, rgba(193,154,75,.04) 40%, transparent 70%),var(--bg);}
.cat-header .inner{padding-left:var(--indent);display:flex;align-items:center;justify-content:space-between;gap:32px;}
.cat-header .kicker{font-family:var(--mono);font-size:.7rem;letter-spacing:.18em;text-transform:uppercase;color:var(--brass-dim);margin:0 0 14px;}
.cat-header h1{font-family:var(--serif-display);font-weight:400;font-size:clamp(1.9rem,3.6vw,2.7rem);letter-spacing:.01em;line-height:1.1;margin:0 0 14px;text-wrap:balance;color:var(--ink);}
.cat-header p{color:var(--ink-dim);font-size:1.02rem;max-width:62ch;margin:0;}
.cat-header .cat-mark{flex:none;width:66px;height:66px;color:var(--brass);opacity:.9;}
.cat-header .cat-mark svg{width:100%;height:100%;display:block;}
@media (max-width:600px){ .cat-header .inner{padding-left:16px;flex-direction:column;align-items:flex-start;gap:18px;} .cat-header .cat-mark{order:-1;width:48px;height:48px;} }

.article-index{margin:0 0 0 var(--indent);}
@media (max-width:600px){ .article-index{margin-left:16px;} }

/* ---------- About ---------- */
.about{margin:0 0 0 var(--indent);display:grid;grid-template-columns:260px 1fr;gap:64px;align-items:start;position:relative;}
@media (max-width:760px){ .about{grid-template-columns:1fr;margin-left:16px;gap:32px;} }
.portrait{border:1px solid var(--rule);background:var(--bg-raised);border-radius:2px;aspect-ratio:4/5;overflow:hidden;position:relative;}
.portrait svg{width:100%;height:100%;display:block;}
.portrait-note{position:absolute;bottom:0;left:0;right:0;background:rgba(15,17,9,.82);padding:8px 12px;font-family:var(--mono);font-size:.6rem;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-faint);text-align:center;}
h1{font-family:var(--serif-display);font-weight:400;font-size:clamp(1.9rem,3.6vw,2.6rem);line-height:1.15;margin:0 0 20px;text-wrap:balance;}
.about p{color:var(--ink-dim);font-size:1.18rem;line-height:1.72;margin:0 0 22px;max-width:72ch;}
.profile-links{display:flex;flex-direction:column;gap:0;border-top:1px solid var(--rule);margin-top:32px;}
.profile-links a{display:flex;align-items:center;gap:14px;padding:16px 0;border-bottom:1px solid var(--rule);transition:color .15s;}
.profile-links a:hover,.profile-links a:focus-visible{color:var(--brass);}
.profile-links svg{width:20px;height:20px;flex:none;color:var(--brass-dim);transition:color .15s;}
.profile-links a:hover svg,.profile-links a:focus-visible svg{color:var(--brass);}
.profile-links .plabel{font-family:var(--mono);font-size:.82rem;letter-spacing:.04em;}
.profile-links .pnote{margin-left:auto;font-family:var(--mono);font-size:.68rem;color:var(--ink-faint);}

/* ---------- Contact ---------- */
.contact-head{margin:0 0 44px var(--indent);max-width:75ch;}
.contact-head p{color:var(--ink-dim);font-size:1.03rem;margin:0 0 16px;max-width:75ch;}
.intake{margin:0 0 56px var(--indent);display:grid;grid-template-columns:1fr 220px;gap:48px;align-items:start;}
@media (max-width:820px){ .intake{grid-template-columns:1fr;margin-left:16px;gap:32px;} }
.form-panel{border:1px solid var(--rule);background:var(--bg-raised);border-radius:2px;padding:32px;position:relative;}
.form-panel::before{content:"";position:absolute;top:14px;right:14px;left:14px;bottom:14px;border:1px solid var(--rule);pointer-events:none;opacity:.5;}
.field{margin:0 0 26px;}
.field:last-of-type{margin-bottom:0;}
.field label{display:block;font-family:var(--mono);font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--brass-dim);margin:0 0 8px;}
.field .hint{display:block;font-family:var(--serif-body);font-style:italic;font-size:.82rem;color:var(--ink-faint);margin-top:6px;}
.field input,.field textarea{width:100%;background:var(--bg);border:1px solid var(--rule);color:var(--ink);font-family:var(--serif-body);font-size:.98rem;padding:10px 12px;border-radius:1px;transition:border-color .15s;}
.field input:focus,.field textarea:focus{border-color:var(--brass-dim);outline:none;}
.field textarea{resize:vertical;min-height:160px;line-height:1.55;}
.field input::placeholder,.field textarea::placeholder{color:var(--ink-faint);opacity:.7;}
.submit-row{display:flex;align-items:center;gap:18px;margin-top:32px;flex-wrap:wrap;}
.submit-btn{font-family:var(--mono);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--bg);background:var(--brass);border:1px solid var(--brass);border-radius:1px;padding:13px 22px;cursor:pointer;transition:background .15s,color .15s;}
.submit-btn:hover,.submit-btn:focus-visible{background:var(--brass-dim);border-color:var(--brass-dim);}
.submit-note{font-family:var(--mono);font-size:.68rem;color:var(--ink-faint);letter-spacing:.03em;}
.seal-panel{border:1px solid var(--rule);background:var(--bg-raised-2);border-radius:2px;padding:26px 22px;text-align:center;}
.seal-panel svg{width:88px;height:88px;color:var(--brass-dim);margin:0 auto 16px;display:block;}
.seal-panel p{font-family:var(--mono);font-size:.68rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-faint);margin:0;line-height:1.7;}
.seal-panel p strong{display:block;color:var(--ink-dim);font-size:.72rem;margin-bottom:4px;}

/* ---------- Projects ---------- */
.proj-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;padding-left:var(--indent);}
@media (max-width:980px){ .proj-grid{grid-template-columns:repeat(2,1fr);} }
@media (max-width:640px){ .proj-grid{grid-template-columns:1fr;} }
@media (max-width:600px){ .proj-grid{padding-left:16px;} }
.proj-card{border:1px solid var(--rule);background:var(--bg-raised);border-radius:2px;overflow:hidden;display:flex;flex-direction:column;transition:border-color .15s;}
.proj-card:hover,.proj-card:focus-within{border-color:var(--brass-dim);}
.proj-media{aspect-ratio:16/10;display:block;}
.proj-media svg{width:100%;height:100%;display:block;}
.proj-body{padding:22px 24px 26px;display:flex;flex-direction:column;gap:12px;flex:1;}
.proj-body h3{font-family:var(--serif-display);font-weight:400;font-size:1.2rem;margin:0;line-height:1.3;text-wrap:balance;}
.proj-body p{color:var(--ink-dim);font-size:.92rem;margin:0;flex:1;}
.proj-link{margin-top:auto;font-family:var(--mono);font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;color:var(--brass);}
.plate-meta{font-family:var(--mono);font-size:.66rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-faint);}
.plate-meta .n{color:var(--brass-dim);}

.status{display:inline-flex;align-items:center;gap:7px;font-family:var(--mono);font-size:.64rem;letter-spacing:.08em;text-transform:uppercase;padding:4px 10px;border-radius:1px;width:fit-content;}
.status::before{content:"";width:6px;height:6px;border-radius:50%;flex:none;}
.status-theorized{color:var(--ink-faint);border:1px dashed var(--rule);}
.status-theorized::before{background:var(--ink-faint);}
.status-afoot{color:var(--brass);border:1px solid var(--brass-dim);background:rgba(193,154,75,.08);}
.status-afoot::before{background:var(--brass);}
.status-dormant{color:var(--ink-dim);border:1px solid var(--rule);opacity:.8;}
.status-dormant::before{background:var(--ink-dim);}
.status-catalogued{color:var(--brass-dim);border:1px solid var(--rule);}
.status-catalogued::before{background:var(--brass-dim);}
.status-abandoned{color:var(--ink-faint);border:1px solid var(--rule);text-decoration:line-through;opacity:.65;}
.status-abandoned::before{background:var(--ink-faint);}

.breadcrumb{padding:20px 0;border-bottom:1px solid var(--rule);}
.breadcrumb .inner{padding-left:var(--indent);font-family:var(--mono);font-size:.68rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-faint);}
.breadcrumb a{color:var(--ink-dim);}
.breadcrumb a:hover{color:var(--brass);}
@media (max-width:600px){ .breadcrumb .inner{padding-left:16px;} }

.proj-header{border-bottom:1px solid var(--rule);padding:44px 0 40px;background:radial-gradient(ellipse 80% 120% at 94% 6%, rgba(193,154,75,.11) 0%, rgba(193,154,75,.04) 40%, transparent 70%),var(--bg);}
.proj-header .inner{padding-left:var(--indent);display:grid;grid-template-columns:1.3fr .9fr;gap:40px;align-items:center;}
.proj-header h1{font-family:var(--serif-display);font-weight:400;font-size:clamp(1.9rem,3.8vw,2.7rem);line-height:1.15;margin:14px 0 16px;text-wrap:balance;}
.proj-header p{color:var(--ink-dim);font-size:1.14rem;line-height:1.6;max-width:56ch;margin:0;}
@media (max-width:820px){ .proj-header .inner{grid-template-columns:1fr;} }
@media (max-width:600px){ .proj-header .inner{padding-left:16px;} }

.proj-content{display:grid;grid-template-columns:1.4fr .9fr;gap:48px;align-items:start;padding-left:var(--indent);}
@media (max-width:900px){ .proj-content{grid-template-columns:1fr;} }
@media (max-width:600px){ .proj-content{padding-left:16px;} }

.journal article{padding:0 0 26px;margin-bottom:26px;border-bottom:1px solid var(--rule);}
.journal article:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0;}
.journal .entry-head{display:flex;align-items:baseline;justify-content:space-between;gap:14px;margin-bottom:8px;}
.journal h3{font-family:var(--serif-display);font-weight:400;font-size:1.28rem;margin:0;}
.journal .date-hover{font-family:var(--mono);font-size:.68rem;letter-spacing:.03em;color:var(--ink-faint);opacity:0;transition:opacity .15s ease;white-space:nowrap;flex:none;}
.journal .date-hover .dispatch-no{color:var(--brass-dim);}
.journal article:hover .date-hover,.journal article:focus-within .date-hover{opacity:1;}
.journal p{color:var(--ink-dim);font-size:1.1rem;line-height:1.66;margin:0;}
.journal .entry-actions{justify-content:flex-end;}
@media (prefers-reduced-motion:reduce){ .journal .date-hover,.journal .entry-actions{transition:none;} }

.resources{border:1px solid var(--rule);background:var(--bg-raised);border-radius:2px;padding:26px 24px;}
.resources h2.section-head{font-size:1.15rem;margin-bottom:20px;}
.resources ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:16px;}
.resources li{border-bottom:1px solid var(--rule);padding-bottom:14px;}
.resources li:last-child{border-bottom:none;padding-bottom:0;}
.resources a{display:block;}
.resources .rtitle{font-family:var(--serif-display);color:var(--ink);font-size:.98rem;display:block;margin-bottom:4px;transition:color .15s;}
.resources a:hover .rtitle,.resources a:focus-visible .rtitle{color:var(--brass);}
.resources .rnote{color:var(--ink-faint);font-size:.82rem;}

/* ---------- Exposures / plate detail ---------- */
.plates{display:flex;flex-direction:column;gap:56px;margin:0 0 0 var(--indent);}
@media (max-width:600px){ .plates{margin-left:16px;} }
.plate{display:grid;grid-template-columns:1.2fr .8fr;gap:32px;}
@media (max-width:760px){ .plate{grid-template-columns:1fr;} }
.plate-open{display:block;border:none;background:none;padding:0;cursor:zoom-in;width:100%;text-align:left;}
.plate-media{border:1px solid var(--rule);border-radius:2px;overflow:hidden;aspect-ratio:4/3;transition:border-color .15s;}
.plate-open:hover .plate-media,.plate-open:focus-visible .plate-media{border-color:var(--brass-dim);}
.plate-media svg{width:100%;height:100%;display:block;}
.plate-text{height:100%;display:flex;flex-direction:column;}
.plate-num{font-family:var(--mono);font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;color:var(--brass-dim);display:block;margin-bottom:10px;}
.plate h3{font-family:var(--serif-display);font-weight:400;font-size:1.25rem;margin:0 0 10px;text-wrap:balance;}
.plate p{color:var(--ink-dim);font-size:.95rem;margin:0;}
.plate-tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:14px;}
.plate-tags a{font-family:var(--mono);font-size:.64rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-dim);border:1px solid var(--rule);padding:4px 9px;border-radius:1px;transition:color .15s,border-color .15s,background-color .15s;}
.plate-tags a:hover,.plate-tags a:focus-visible{color:var(--brass);border-color:var(--brass-dim);background:var(--bg-raised);}
@media (max-width:760px){ .plate-text{height:auto;} .plate-tags{margin-top:0;} }

dialog.plate-dialog{position:relative;border:1px solid var(--brass-dim);background:var(--bg-raised);color:var(--ink);border-radius:2px;padding:0;max-width:920px;width:94vw;max-height:88vh;}
dialog.plate-dialog::backdrop{background:rgba(6,7,4,.82);}
.dialog-media{aspect-ratio:16/9;}
.dialog-media svg{width:100%;height:100%;display:block;}
.dialog-specs{display:grid;grid-template-columns:repeat(6,1fr);gap:16px 22px;padding:26px 30px;border-top:1px solid var(--rule);}
.dialog-specs div{font-family:var(--mono);font-size:.78rem;color:var(--ink-faint);}
.dialog-specs div span{display:block;font-size:.64rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-faint);opacity:.7;margin-bottom:4px;}
.dialog-specs div b{color:var(--ink-dim);font-weight:400;}
.dialog-close{position:absolute;top:16px;right:16px;width:38px;height:38px;border:1px solid var(--rule);background:var(--bg-raised-2);color:var(--ink-dim);border-radius:2px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.dialog-close:hover,.dialog-close:focus-visible{color:var(--brass);border-color:var(--brass-dim);}
.dialog-close svg{width:18px;height:18px;}
@media (max-width:760px){ .dialog-specs{grid-template-columns:repeat(3,1fr);} }
@media (max-width:480px){ .dialog-specs{grid-template-columns:1fr 1fr;padding:20px 22px;} }
```

- [ ] **Step 8: Verify with a temporary smoke-test page, then delete it**

Create `smoke-test.njk` at the project root:

```njk
---
layout: base.njk
title: Smoke Test
---
<main class="wrap"><p style="color:var(--ink-dim);padding:40px 24px;">Smoke test content</p></main>
```

Run: `npx eleventy`
Expected: `_site/smoke-test/index.html` exists, contains `Dispatches from the Far Reaches` (from the nav brand), `Expeditions supported by Miskatonic University` (from the footer), and a `<link rel="stylesheet" href="/assets/css/site.css">` tag.

Run: `grep -c "Dispatches from the Far Reaches" _site/smoke-test/index.html`
Expected: `2` (appears once in `<title>`, once in the nav brand).

Delete `smoke-test.njk` and re-run `npx eleventy` to confirm `_site/smoke-test/` disappears.

- [ ] **Step 9: Commit**

```bash
git add _data _includes assets
git commit -m "feat: add global data, base layout, shared partials, and site.css"
```

---

## Task 3: Post layout + migrate existing category content (Professional, Philosophy, Family, Misc)

**Files:**
- Create: `_includes/post.njk`
- Modify: all 21 existing files under `DFTFR-Obsidian/Website/{Professional,Philosophy,Family,Misc}/*.md`
- Create (temporary, deleted in Step 5): `scripts/migrate-content.mjs`

**Interfaces:**
- Consumes: `categories` global data (Task 2), `dispatchNo` frontmatter field (new — a numeric field this task adds to every migrated post, descending with recency per the design spec's dispatch-numbering convention).
- Produces: every migrated post now has frontmatter `layout: post.njk`, `category: <key>`, `dispatchNo: <int>`, and no leftover Hugo syntax.

- [ ] **Step 1: Add `_includes/post.njk`**

Based on the article mockup's `.art-header`/`.art-body`/`.art-foot` structure, adapted to loop over `tags` and render Nunjucks-safe markdown content via `content | safe`:

```njk
{% extends "base.njk" %}
{% block content %}
<section class="art-header">
  <div class="wrap">
  <div class="inner">
    <div class="art-meta-row">
      <span class="cat-pill">{{ categoryLabel }}</span>
      <span class="art-date"><span class="dispatch-no">No. {{ dispatchNo }}</span> · {{ date | date("d MMMM yyyy") }}</span>
    </div>
    <h1>{{ title }}</h1>
  </div>
  </div>
</section>
<main class="wrap">
  <div class="art-body">
    {{ content | safe }}
  </div>
  <div class="art-foot">
    {% if tags.length %}
    <div class="cross-filed">
      <span class="cf-label">Cross-filed under</span>
      {% for tag in tags %}<a href="#">{{ tag }}</a>{% endfor %}
    </div>
    {% endif %}
    <div class="art-contact">
      <p>Correspondence regarding this file is welcome, though replies may be slow to arrive.</p>
      <a href="/contact/">Send word <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
    </div>
  </div>
</main>
{% endblock %}
```

`categoryLabel` is derived per-page via `eleventy.config.js` — add this to the config from Task 1 (edit `eleventy.config.js`, inside the exported function, before the `return`):

```js
eleventyConfig.addFilter("date", (value, format) => {
  const d = new Date(value);
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
});
```

And add computed data so `categoryLabel` resolves from `category` without hand-typing it on every file — add to `_data/site.json`'s sibling, a new `_data/categoryLabels.json`:

```json
{
  "professional": "Professional",
  "philosophy": "Philosophy",
  "projects": "Projects",
  "exposures": "Exposures",
  "family": "Family",
  "fiction": "Fiction",
  "misc": "Misc"
}
```

Then change the `categoryLabel` reference in `post.njk` above to `{{ categoryLabels[category] }}` (two find/replace edits in the template just written).

- [ ] **Step 2: Write and run the migration script**

Create `scripts/migrate-content.mjs`:

```js
import { readFileSync, writeFileSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";

const CATEGORY_DIRS = {
  Professional: "professional",
  Philosophy: "philosophy",
  Family: "family",
  Misc: "misc",
};

const ROOT = "DFTFR-Obsidian/Website";
let dispatchNo = 200; // arbitrary starting point below the mockup's highest example (No. 214)

for (const [dir, categoryKey] of Object.entries(CATEGORY_DIRS)) {
  const dirPath = join(ROOT, dir);
  const files = readdirSync(dirPath).filter((f) => f.endsWith(".md")).sort();
  for (const file of files) {
    const filePath = join(dirPath, file);
    let text = readFileSync(filePath, "utf8");

    // frontmatter fixups
    text = text.replace(/^layout:\s*\n/m, `layout: post.njk\n`);
    text = text.replace(/^permalink:\s*\n/m, "");
    text = text.replace(/^isDraft:\s*true\s*$/m, "isDraft: false");
    text = text.replace(/^(title: .*)$/m, `$1\ncategory: ${categoryKey}\ndispatchNo: ${dispatchNo}`);
    dispatchNo += 1;

    // {{< plink "url" >}}text{{< /plink >}}  ->  [text](url)
    text = text.replace(/\{\{<\s*plink\s*"([^"]+)"\s*>\}\}([\s\S]*?)\{\{<\s*\/plink\s*>\}\}/g, "[$2]($1)");

    // <!--more--> excerpt marker -> removed (description frontmatter covers it)
    text = text.replace(/^<!--more-->\s*\n/m, "");

    // {{< randompic >}} (no closing tag, prefixes a paragraph) -> stripped
    text = text.replace(/\{\{<\s*randompic\s*>\}\}/g, "");

    // {{< photo src="X" ... >}}caption{{< /photo >}}  ->  ![caption](/category/X)
    text = text.replace(
      /\{\{<\s*photo\s+src="([^"]+)"[^>]*>\}\}([\s\S]*?)\{\{<\s*\/photo\s*>\}\}/g,
      (_, src, caption) => `![${caption}](/${categoryKey}/${src})`
    );
    // self-closing {{< photo src="X" / >}} (no caption)
    text = text.replace(/\{\{<\s*photo\s+src="([^"]+)"\s*\/\s*>\}\}/g, (_, src) => `![](/${categoryKey}/${src})`);

    writeFileSync(filePath, text, "utf8");
  }
}

console.log("Migration complete.");
```

Run: `node scripts/migrate-content.mjs`
Expected: prints `Migration complete.` with no errors.

- [ ] **Step 3: Verify no Hugo shortcodes remain except the documented `{{< ref >}}` cross-links**

Run: `grep -rn "{{<" DFTFR-Obsidian/Website --include="*.md" | grep -v "{{< ref"`
Expected: no output (empty) — every `plink`/`randompic`/`photo`/`more` marker is gone; only `{{< ref ... >}}` remains (handled in Step 4 below, not by this script, since it needs the final URL scheme, not just a filename swap).

- [ ] **Step 4: Resolve remaining `{{< ref >}}` internal links to plain markdown links**

Run this one-off `sed` per known cross-reference (the exact set found during content review — five links across two files, already pointing at the renamed slugs from the earlier renaming pass):

```bash
cd DFTFR-Obsidian/Website/Professional
sed -i \
  -e 's#\[cutting the ham at both ends\](\{\{< ref "the-ancestral-ham-and-the-rites-we-never-question" >\}\})#[cutting the ham at both ends](/professional/cutting-the-ham-at-both-ends/)#' \
  -e 's#\[continous improvement\](\{\{< ref "the-ritual-of-continuous-improvement" >\}\})#[continous improvement](/professional/the-ritual-of-continuous-improvement/)#' \
  feeding-on-chaos-an-antifragile-ward-against-rigidity.md
for f in rites-against-the-rigor-an-introduction.md rites-against-the-rigor-five-steps-to-begin-the-ritual.md rites-against-the-rigor-the-obstacles-along-the-way.md rites-against-the-rigor-the-grimoire-of-documentation.md; do
  sed -i \
    -e 's#\[part one\](\{\{< ref "rites-against-the-rigor-an-introduction" >\}\} "part one")#[part one](/professional/rites-against-the-rigor-an-introduction/ "part one")#' \
    -e 's#\[part two\](\{\{< ref "rites-against-the-rigor-five-steps-to-begin-the-ritual" >\}\} "part two")#[part two](/professional/rites-against-the-rigor-five-steps-to-begin-the-ritual/ "part two")#' \
    -e 's#\[part three\](\{\{< ref "rites-against-the-rigor-the-obstacles-along-the-way" >\}\} "part three")#[part three](/professional/rites-against-the-rigor-the-obstacles-along-the-way/ "part three")#' \
    -e 's#\[part four\](\{\{< ref "rites-against-the-rigor-the-grimoire-of-documentation" >\}\} "part four")#[part four](/professional/rites-against-the-rigor-the-grimoire-of-documentation/ "part four")#' \
    "$f"
done
sed -i 's#\[hindsight is infallible\](\{\{< ref "hindsight-the-infallible-oracle" >\}\})#[hindsight is infallible](/professional/hindsight-the-infallible-oracle/)#' rites-against-the-rigor-the-obstacles-along-the-way.md
cd - > /dev/null
```

Note: filename slugs above must exactly match the actual filenames on disk at execution time. Note also the pre-existing bug already fixed on 2026-07-10: the article-cross-reference targets ("part three"/"part four") had originally all pointed at the same file; that was corrected before this task and is not something this step needs to redo.

Run: `grep -rn "{{<" DFTFR-Obsidian/Website --include="*.md"`
Expected: no output at all.

- [ ] **Step 5: Delete the migration script**

Run: `rm scripts/migrate-content.mjs`
(It's a one-shot helper — the vault contains only markdown, per the global constraints, and there's no reason to keep a run-once script hanging around either.)

- [ ] **Step 6: Verify the build renders all 21 migrated posts**

Run: `npx eleventy`
Expected output line: `Wrote 21 files` at minimum (plus whatever else exists at this point — this count will grow in later tasks; check for "21" appearing as a substring of the reported count is not reliable, so instead run the next command).

Run: `find _site/professional _site/philosophy _site/family _site/misc -name "index.html" | wc -l`
Expected: `21`

Run: `grep -l "No. 2" _site/professional/*/index.html | wc -l`
Expected: a nonzero number (confirms `dispatchNo` rendered).

- [ ] **Step 7: Commit**

```bash
git add _includes/post.njk eleventy.config.js _data/categoryLabels.json DFTFR-Obsidian/Website
git commit -m "feat: add post layout and migrate existing vault content off Hugo shortcodes"
```

---

## Task 4: Fiction stub content

**Files:**
- Create: `DFTFR-Obsidian/Website/Fiction/the-correspondent-who-wasnt.md`
- Create: `DFTFR-Obsidian/Website/Fiction/the-signal-that-came-in-backwards.md`

**Interfaces:**
- Consumes: `post.njk` layout from Task 3.

- [ ] **Step 1: Create the first stub**

```markdown
---
title: "The Correspondent Who Wasn't"
description: "A short story about a research assistant who answers every letter promptly, correctly, and without ever once being seen."
date: 2025-07-08
layout: post.njk
category: fiction
dispatchNo: 210
tags: ["fiction", "ai"]
isDraft: false
---
Every letter to the department got a reply within the hour, typed in the same even hand, signed only "the correspondent." No one had met them. No one had been told to expect them. The mail simply started arriving answered.

## The first complaint

It was three months before anyone thought to ask who was answering. By then the correspondent had cleared a backlog eleven years deep, cross-referenced a filing error from before most of the staff were hired, and settled a dispute about a missing specimen crate using a receipt no one remembered keeping.

## What the returned envelope said

A junior clerk, more out of boredom than suspicion, sent a letter addressed to no one — just a blank page, folded and sealed. It came back three days later with a single line: "I have nothing to add to this. Neither, I think, do you."

Nobody sent a blank envelope again.
```

- [ ] **Step 2: Create the second stub**

```markdown
---
title: "The Signal That Came in Backwards"
description: "A dispatch about a shortwave transmission that only made sense played in reverse, and what it turned out to actually be."
date: 2025-05-14
layout: post.njk
category: fiction
dispatchNo: 205
tags: ["fiction", "radio"]
isDraft: false
---
The transmission repeated every forty minutes, exactly, for six nights running. Recorded and slowed down, it sounded like static with a grudge. Recorded and played backwards, it sounded like someone reading a shipping manifest in a language that did not quite exist yet.

## The manifest

Forty crates, it said, of instruments bound for a survey that the records office had no listing for. A port of departure that matched no atlas. A signature at the end, read forwards this time by accident, that matched no one currently employed, retired, or on record as deceased.

## The seventh night

On the seventh night the signal did not repeat. Nothing has come in on that frequency since, and no one who monitored it that week has been willing to say, on the record, whether they were relieved.
```

- [ ] **Step 3: Verify the build**

Run: `npx eleventy`
Expected: `_site/fiction/the-correspondent-who-wasnt/index.html` and `_site/fiction/the-signal-that-came-in-backwards/index.html` both exist.

Run: `grep -o "No. 210\|No. 205" _site/fiction/*/index.html`
Expected: both dispatch numbers found, one per file.

- [ ] **Step 4: Commit**

```bash
git add DFTFR-Obsidian/Website/Fiction
git commit -m "content: add two Fiction stub entries"
```

---

## Task 5: Projects layout + stub content

**Files:**
- Create: `_includes/project.njk`
- Create: `DFTFR-Obsidian/Website/Projects/building-a-weather-station-from-salvaged-instruments.md`
- Create: `DFTFR-Obsidian/Website/Projects/restoring-a-1930s-field-radio.md`

**Interfaces:**
- Consumes: `base.njk`. Each project file's frontmatter carries a `journal:` list (each entry: `no`, `date`, `title`, `body`) and a `resources:` list (each: `title`, `note`, `url`) — `project.njk` renders both directly from frontmatter, no separate per-entry files.
- Produces: `/projects/<slug>/` detail pages.

- [ ] **Step 1: Add `_includes/project.njk`**

Adapted from the project-detail mockup's breadcrumb / `.proj-header` / journal+resources two-column layout:

```njk
{% extends "base.njk" %}
{% block content %}
<div class="breadcrumb">
  <div class="wrap"><div class="inner"><a href="/projects/">Projects</a> / {{ title }}</div></div>
</div>
<section class="proj-header">
  <div class="wrap">
  <div class="inner">
    <div>
      <span class="status status-{{ status | lower }}">{{ status }}</span>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
    </div>
  </div>
  </div>
</section>
<main class="wrap">
  <div class="proj-content">
    <div class="journal">
      <h2 class="section-head">Journal</h2>
      {% for entry in journal %}
      <article>
        <div class="entry-head">
          <h3>{{ entry.title }}</h3>
          <span class="date-hover"><span class="dispatch-no">No. {{ entry.no }}</span> · {{ entry.date | date("d MMMM yyyy") }}</span>
        </div>
        <p>{{ entry.body }}</p>
      </article>
      {% endfor %}
    </div>
    <aside class="resources">
      <h2 class="section-head">Resources</h2>
      <ul>
        {% for r in resources %}
        <li><a href="{{ r.url }}"><span class="rtitle">{{ r.title }}</span><span class="rnote">{{ r.note }}</span></a></li>
        {% endfor %}
      </ul>
    </aside>
  </div>
</main>
{% endblock %}
```

- [ ] **Step 2: Add the first stub project**

```markdown
---
title: "Building a Weather Station from Salvaged Instruments"
description: "Two barometers, a broken sextant, and a lot of solder, assembled into a mounted instrument panel that mostly agrees with the forecast."
date: 2025-08-23
layout: project.njk
category: projects
status: Catalogued
tags: ["diy", "instruments"]
isDraft: false
journal:
  - no: 1
    date: 2025-08-03
    title: "Two barometers and a ruined sextant"
    body: "Found both barometers in a box marked \"instruments, untested\" at an estate sale, along with a sextant too corroded to use but with a mirror and brass fittings worth keeping."
  - no: 2
    date: 2025-08-08
    title: "One dead cell, one salvageable linkage"
    body: "The aneroid cell in the first barometer has a slow leak that no amount of shellac is fixing. Decision made to build around the second and keep the first for parts."
  - no: 3
    date: 2025-08-16
    title: "A mounting board from a repurposed drawer bottom"
    body: "Cut the housing from the bottom of a drawer that no longer had a dresser attached to it. Brass corner fittings from the sextant hold the barometer face in place."
  - no: 4
    date: 2025-08-23
    title: "Close enough to trust, not close enough to brag about"
    body: "Checked the reading against the county weather station three miles east over four consecutive mornings. Consistent agreement within a small margin."
resources:
  - title: "Aneroid Barometer Repair Notes"
    note: "Forum thread on diagnosing slow-leaking cells"
    url: "#"
  - title: "A 1948 Manual on Field Meteorological Instruments"
    note: "Scanned manual, the closest thing to a source of truth here"
    url: "#"
---
Two barometers, a broken sextant, and a lot of solder, assembled over three weeks into a mounted instrument panel that now sits by the back door.
```

- [ ] **Step 3: Add the second stub project**

```markdown
---
title: "Restoring a 1930s Field Radio"
description: "Found dead at an estate sale. Three replaced capacitors in and it now produces something closer to sound than static."
date: 2025-09-02
layout: project.njk
category: projects
status: Afoot
tags: ["diy", "radio"]
isDraft: false
journal:
  - no: 1
    date: 2025-08-28
    title: "Dead on arrival, as expected"
    body: "Chassis is intact, dial glass is cracked but readable. Every visible capacitor has the telltale bulge of a unit that gave up decades ago."
  - no: 2
    date: 2025-09-02
    title: "First replaced capacitor, first sign of life"
    body: "Swapped the largest electrolytic. Tubes now glow on power-up, though nothing comes through the speaker yet."
resources:
  - title: "Vintage Radio Capacitor Reference Chart"
    note: "Cross-reference for original part values"
    url: "#"
---
Found dead at an estate sale for eight dollars, on the strength of an intact chassis and a dial that still turned freely.
```

- [ ] **Step 4: Verify the build**

Run: `npx eleventy`
Expected: `_site/projects/building-a-weather-station-from-salvaged-instruments/index.html` and `_site/projects/restoring-a-1930s-field-radio/index.html` exist.

Run: `grep -o "Two barometers and a ruined sextant" _site/projects/building-a-weather-station-from-salvaged-instruments/index.html`
Expected: one match (confirms the journal loop rendered).

- [ ] **Step 5: Commit**

```bash
git add _includes/project.njk DFTFR-Obsidian/Website/Projects
git commit -m "feat: add project layout and two stub projects"
```

---

## Task 6: Exposures layout + stub content + modal dialog JS

**Files:**
- Create: `_includes/exposure-series.njk`
- Create: `assets/js/dialog.js`
- Create: `DFTFR-Obsidian/Website/Exposures/the-backyard-observatory.md`
- Create: `DFTFR-Obsidian/Website/Exposures/coastal-fog-early-mornings.md`

**Interfaces:**
- Consumes: `base.njk`. Each series file's frontmatter carries an `exposures:` list (`num` roman numeral, `title`, `body`, `tags`, `camera`, `lens`, `exposureTime`, `aperture`, `iso`, `captured`) — no images required since none exist yet; `exposure-series.njk` renders a plain dark placeholder rectangle in place of the mockup's inline-SVG illustration for each plate.
- Produces: `/exposures/<slug>/` detail pages, each with one native `<dialog>` per exposure.

- [ ] **Step 1: Add `assets/js/dialog.js`**

```js
document.addEventListener("click", (e) => {
  const opener = e.target.closest("[data-dialog-target]");
  if (opener) {
    document.getElementById(opener.dataset.dialogTarget)?.showModal();
  }
  const closer = e.target.closest("[data-dialog-close]");
  if (closer) {
    closer.closest("dialog")?.close();
  }
});
```

- [ ] **Step 2: Add `_includes/exposure-series.njk`**

```njk
{% extends "base.njk" %}
{% block content %}
<div class="breadcrumb">
  <div class="wrap"><div class="inner"><a href="/exposures/">Exposures</a> / {{ title }}</div></div>
</div>
<section class="set-header">
  <div class="wrap">
  <div class="inner">
    <span class="plate-meta"><span class="n">{{ exposures.length }} exposures</span> · {{ date | date("MMMM yyyy") }}</span>
    <h1>{{ title }}</h1>
    <p>{{ description }}</p>
  </div>
  </div>
</section>
<main class="wrap">
  <div class="plates">
    {% for ex in exposures %}
    <div class="plate">
      <button class="plate-open" data-dialog-target="dlg-{{ loop.index }}" aria-label="View capture details for Exposure {{ ex.num }}: {{ ex.title }}">
        <div class="plate-media" style="background:#0f1109;"></div>
      </button>
      <div class="plate-text">
        <div>
          <span class="plate-num">Exposure {{ ex.num }}</span>
          <h3>{{ ex.title }}</h3>
          <p>{{ ex.body }}</p>
        </div>
        <div class="plate-tags">{% for t in ex.tags %}<a href="#">{{ t }}</a>{% endfor %}</div>
      </div>
    </div>
    <dialog id="dlg-{{ loop.index }}" class="plate-dialog">
      <button class="dialog-close" data-dialog-close aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <div class="dialog-media" style="background:#0f1109;"></div>
      <div class="dialog-specs">
        <div><span>Camera</span><b>{{ ex.camera }}</b></div>
        <div><span>Lens</span><b>{{ ex.lens }}</b></div>
        <div><span>Exposure</span><b>{{ ex.exposureTime }}</b></div>
        <div><span>Aperture</span><b>{{ ex.aperture }}</b></div>
        <div><span>ISO</span><b>{{ ex.iso }}</b></div>
        <div><span>Captured</span><b>{{ ex.captured }}</b></div>
      </div>
    </dialog>
    {% endfor %}
  </div>
</main>
<script src="/assets/js/dialog.js"></script>
{% endblock %}
```

- [ ] **Step 3: Add the first stub series**

```markdown
---
title: "The Backyard Observatory"
description: "Long exposures of the yard telescope across a week of unusually clear nights, plus everything that went wrong along the way."
date: 2025-08-01
layout: exposure-series.njk
category: exposures
tags: ["astronomy", "photography"]
isDraft: false
exposures:
  - num: "I"
    title: "First Light Test"
    body: "Checking the mount alignment before committing to anything longer than a thirty-second exposure."
    tags: ["astronomy", "alignment"]
    camera: "35mm DSLR, unmodified"
    lens: "50mm f/1.8"
    exposureTime: "30s"
    aperture: "f/2.8"
    iso: "800"
    captured: "3 Aug, 10:52 PM"
  - num: "II"
    title: "The Waxing Gibbous, Slightly Overexposed"
    body: "Went two stops too bright chasing detail in the maria and lost the terminator entirely."
    tags: ["astronomy", "lunar"]
    camera: "35mm DSLR, unmodified"
    lens: "200mm f/4"
    exposureTime: "1/250s"
    aperture: "f/5.6"
    iso: "200"
    captured: "4 Aug, 11:20 PM"
---
Long exposures of the yard telescope across a week of unusually clear nights.
```

- [ ] **Step 4: Add the second stub series**

```markdown
---
title: "Coastal Fog, Early Mornings"
description: "A week of dawn walks along the same half mile of shoreline, waiting for the fog to do something different."
date: 2025-06-10
layout: exposure-series.njk
category: exposures
tags: ["coastal", "photography"]
isDraft: false
exposures:
  - num: "I"
    title: "Nothing but Grey, and That's Fine"
    body: "First morning out. The fog never lifted, which turned out to be the actual subject rather than an obstacle to it."
    tags: ["coastal", "fog"]
    camera: "35mm DSLR, unmodified"
    lens: "35mm f/2"
    exposureTime: "1/60s"
    aperture: "f/4"
    iso: "400"
    captured: "10 June, 5:40 AM"
  - num: "II"
    title: "A Gap in the Fog, for About Four Minutes"
    body: "The one morning the fog thinned enough to show the breakwater. Gone again before the light meter finished adjusting."
    tags: ["coastal", "fog"]
    camera: "35mm DSLR, unmodified"
    lens: "35mm f/2"
    exposureTime: "1/125s"
    aperture: "f/5.6"
    iso: "200"
    captured: "13 June, 5:52 AM"
---
A week of dawn walks along the same half mile of shoreline.
```

- [ ] **Step 5: Verify the build**

Run: `npx eleventy`
Expected: `_site/exposures/the-backyard-observatory/index.html` and `_site/exposures/coastal-fog-early-mornings/index.html` exist.

Run: `grep -c "dialog.plate-dialog\|class=\"plate-dialog\"" _site/exposures/the-backyard-observatory/index.html`
Expected: nonzero (two `<dialog>` elements for the two exposures in that series).

- [ ] **Step 6: Commit**

```bash
git add _includes/exposure-series.njk assets/js/dialog.js DFTFR-Obsidian/Website/Exposures
git commit -m "feat: add exposure series layout, modal dialog JS, and two stub series"
```

---

## Task 7: Category listing template + pagination

**Files:**
- Create: `_includes/category.njk`
- Create: `category-pages.njk`

**Interfaces:**
- Consumes: `categories.json` (Task 2), Eleventy's `collections.all` to filter by `category` frontmatter.
- Produces: `/professional/`, `/philosophy/`, `/projects/`, `/exposures/`, `/family/`, `/fiction/`, `/misc/` — one listing page per category, all seeded with real content by this point in the plan.

- [ ] **Step 1: Add `_includes/category.njk`**

```njk
{% extends "base.njk" %}
{% block content %}
<section class="cat-header">
  <div class="wrap">
  <div class="inner">
    <div>
      <p class="kicker">Filed under</p>
      <h1>{{ pagination.items[0].label }}</h1>
    </div>
  </div>
  </div>
</section>
<main class="wrap">
  <div class="article-index">
    <div class="list">
      {% for entry in pagination.items[0].entries %}
      <article>
        <div class="entry-head">
          <div class="entry-tags">{% for t in entry.data.tags %}<a href="#">{{ t }}</a>{% endfor %}</div>
          <span class="date-hover"><span class="dispatch-no">No. {{ entry.data.dispatchNo }}</span> · {{ entry.date | date("d MMMM yyyy") }}</span>
        </div>
        <h3>{{ entry.data.title }}</h3>
        <p>{{ entry.data.description }}</p>
        <div class="entry-actions"><a href="{{ entry.url }}">View the account</a></div>
      </article>
      {% endfor %}
    </div>
  </div>
</main>
{% endblock %}
```

- [ ] **Step 2: Add the paginated driver, `category-pages.njk`, at the project root**

```njk
---
pagination:
  data: categories
  size: 1
  alias: cat
permalink: "/{{ cat.slug }}/"
layout: category.njk
eleventyComputed:
  category: "{{ cat.key }}"
---
{% set entries = collections.all | selectattr("data.category", "equalto", cat.key) %}
```

Note: Nunjucks front matter cannot run the `selectattr` filter inline like the line above implies in plain Nunjucks syntax — implement the filtering in `eleventy.config.js` instead, as a `postsByCategory` collection, and simplify `category-pages.njk` to consume it directly. Replace the file's contents with:

```njk
---
pagination:
  data: categories
  size: 1
  alias: cat
permalink: "/{{ cat.slug }}/"
layout: category.njk
eleventyComputed:
  category: "{{ cat.key }}"
---
```

And add this collection to `eleventy.config.js` (inside the exported function, alongside the `date` filter added in Task 3):

```js
eleventyConfig.addCollection("postsByCategory", (collectionApi) => {
  const byCategory = {};
  for (const item of collectionApi.getAll()) {
    const category = item.data.category;
    if (!category) continue;
    (byCategory[category] ??= []).push(item);
  }
  for (const key of Object.keys(byCategory)) {
    byCategory[key].sort((a, b) => b.date - a.date);
  }
  return byCategory;
});
```

Then update `_includes/category.njk`'s loop source from `pagination.items[0].entries` to `collections.postsByCategory[pagination.items[0].key]`, and the `<h1>` from `pagination.items[0].label` — both already match the `categories.json` field names (`key`, `label`), so only the collection accessor needs the pagination-item indirection: change `{% for entry in pagination.items[0].entries %}` to `{% for entry in collections.postsByCategory[pagination.items[0].key] %}`.

- [ ] **Step 3: Verify all 7 category pages build**

Run: `npx eleventy`
Expected: no errors.

Run: `for c in professional philosophy projects exposures family fiction misc; do test -f "_site/$c/index.html" && echo "$c OK" || echo "$c MISSING"; done`
Expected: all seven lines end in `OK`.

Run: `grep -c "<article>" _site/professional/index.html`
Expected: `21` — wait, should be `15` (Professional has 15 posts after the rename/cleanup in earlier tasks — re-run `find DFTFR-Obsidian/Website/Professional -name "*.md" | wc -l` first and use that number as the expected count instead of assuming 15 or 21).

Run: `find DFTFR-Obsidian/Website/Professional -name "*.md" | wc -l` and confirm the `<article>` count in `_site/professional/index.html` from the previous command matches it exactly.

- [ ] **Step 4: Commit**

```bash
git add _includes/category.njk category-pages.njk eleventy.config.js
git commit -m "feat: add paginated category listing pages"
```

---

## Task 8: About page

**Files:**
- Create: `_includes/about.njk`
- Create: `DFTFR-Obsidian/Website/About/about.md`

- [ ] **Step 1: Add `_includes/about.njk`**

```njk
{% extends "base.njk" %}
{% block content %}
<main class="wrap">
  <div class="about">
    <div class="portrait">
      <svg viewBox="0 0 300 375" fill="none" stroke="currentColor" stroke-width="1.2" role="img" aria-label="Placeholder illustrated silhouette portrait">
        <rect width="300" height="375" fill="#0f1109"/>
        <circle cx="150" cy="150" r="60" stroke="#8a6d34" opacity=".8"/>
        <path d="M70 340 Q70 240 150 240 Q230 240 230 340" stroke="#8a6d34" opacity=".8"/>
      </svg>
      <div class="portrait-note">Placeholder — real photo pending</div>
    </div>
    <div>
      <p class="kicker">A Biographical Note</p>
      <h1>{{ title }}</h1>
      {{ content | safe }}
    </div>
  </div>
</main>
{% endblock %}
```

- [ ] **Step 2: Add `DFTFR-Obsidian/Website/About/about.md`**

```markdown
---
title: "The correspondent behind these dispatches"
description: "A Biographical Note"
layout: about.njk
isDraft: false
---
I keep this record the way some people keep a field notebook: irregularly, occasionally out of order, and mostly for my own benefit. Professional work, ongoing projects, actual photographs, and a small amount of fiction all end up filed here under whichever heading fits best that week.

Most of what gets written down here starts as a note taken somewhere less comfortable than a desk. It is edited into something readable later, when the details have had time to settle into whether or not they were actually true.
```

- [ ] **Step 3: Verify**

Run: `npx eleventy`
Expected: `_site/about/index.html` exists (note: since the source is `About/about.md`, confirm the actual output URL — run `find _site -iname "about*"` and check whether it landed at `/about/` or `/about/about/`; if it's the latter, add `permalink: /about/` to the frontmatter and rebuild).

Run: `grep -c "A Biographical Note" _site/about/index.html`
Expected: nonzero.

- [ ] **Step 4: Commit**

```bash
git add _includes/about.njk DFTFR-Obsidian/Website/About
git commit -m "feat: add About page"
```

---

## Task 9: Contact page ("File a Dispatch")

**Files:**
- Create: `_includes/contact.njk`
- Create: `assets/js/contact-form.js`
- Create: `DFTFR-Obsidian/Website/Contact/contact.md`

- [ ] **Step 1: Add `assets/js/contact-form.js`**

```js
document.getElementById("dispatch-form")?.addEventListener("submit", function (e) {
  e.preventDefault();
  const subject = document.getElementById("f-subject").value;
  const reply = document.getElementById("f-reply").value;
  const message = document.getElementById("f-message").value;
  const body = message + "\n\nReply to: " + reply;
  const mailto = "mailto:correspondent@dispatchesfromthefarreaches.example"
    + "?subject=" + encodeURIComponent(subject)
    + "&body=" + encodeURIComponent(body);
  window.location.href = mailto;
});
```

- [ ] **Step 2: Add `_includes/contact.njk`**

```njk
{% extends "base.njk" %}
{% block content %}
<main class="wrap">
  <div class="contact-head">
    <p class="kicker">Filed Correspondence</p>
    <h1>{{ title }}</h1>
    {{ content | safe }}
  </div>
  <div class="intake">
    <form class="form-panel" id="dispatch-form">
      <div class="field">
        <label for="f-subject">Subject</label>
        <input type="text" id="f-subject" name="subject" placeholder="What this concerns" required />
      </div>
      <div class="field">
        <label for="f-reply">Address for reply</label>
        <input type="email" id="f-reply" name="reply" placeholder="you@example.com" required />
        <span class="hint">So the reply has somewhere to go; this is folded into the message body, not sent automatically.</span>
      </div>
      <div class="field">
        <label for="f-message">Message</label>
        <textarea id="f-message" name="message" placeholder="The account, as you have it" required></textarea>
      </div>
      <div class="submit-row">
        <button type="submit" class="submit-btn">Post the Dispatch</button>
        <span class="submit-note">Opens in your own mail program</span>
      </div>
    </form>
    <div class="seal-panel">
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">
        <circle cx="50" cy="50" r="36"/>
        <circle cx="50" cy="50" r="27"/>
      </svg>
      <p><strong>No. — filed live</strong>Each dispatch is numbered on receipt, the same as any other entry in the account.</p>
    </div>
  </div>
</main>
<script src="/assets/js/contact-form.js"></script>
{% endblock %}
```

- [ ] **Step 3: Add `DFTFR-Obsidian/Website/Contact/contact.md`**

```markdown
---
title: "File a Dispatch"
description: "Filed Correspondence"
layout: contact.njk
permalink: /contact/
isDraft: false
---
Notes, corrections, and questions on anything catalogued here are welcome. Fill in the form below and it will be handed to your mail program, addressed and ready to send. Nothing is transmitted from this page itself.
```

- [ ] **Step 4: Verify**

Run: `npx eleventy`
Expected: `_site/contact/index.html` exists and contains `id="dispatch-form"` and a `<script src="/assets/js/contact-form.js">` tag.

- [ ] **Step 5: Commit**

```bash
git add _includes/contact.njk assets/js/contact-form.js DFTFR-Obsidian/Website/Contact
git commit -m "feat: add Contact / File a Dispatch page"
```

---

## Task 10: Home page

**Files:**
- Create: `index.njk`

**Interfaces:**
- Consumes: `collections.all` (built-in), sorted by `date` descending, sliced to the 7 most recent for the "continues" list plus 1 for the featured slot.

- [ ] **Step 1: Add `index.njk` at the project root**

```njk
---
layout: base.njk
title: null
---
{% set sorted = collections.all | sort(attribute="date") | reverse %}
{% set featured = sorted[0] %}
{% set rest = sorted | slice(1, 8) %}
<section class="hero">
  <div class="wrap">
  <div class="hero-inner">
    <div class="hero-text">
      <p class="kicker">Dispatches, sent irregularly</p>
      <h1 class="title">Reports from work, thought, and the <em>far reaches</em> in between.</h1>
      <p class="sub">Filed under whichever heading fits best, the way a field log is kept: not tidy, but findable.</p>
    </div>
  </div>
  </div>
</section>
<main class="wrap">
  <div class="posts" style="margin-top:8px;">
    <div class="featured">
      <div class="featured-body">
        <span class="tag">{{ categoryLabels[featured.data.category] }}</span>
        <h3>{{ featured.data.title }}</h3>
        <p class="meta">{{ featured.date | date("d MMMM yyyy") }}</p>
        <p>{{ featured.data.description }}</p>
        <a class="readlink" href="{{ featured.url }}">Read the entry <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
      </div>
    </div>
    <div class="aside-stack">
      <aside class="search-aside">
        <p class="search-label">Search these writings via our compuscanner</p>
        <label class="search-line">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><circle cx="12" cy="12" r="3"/></svg>
          <input type="text" id="site-search" placeholder="Type a word, name, or year..." aria-label="Search these writings">
        </label>
        <div class="search-results" id="site-search-results"></div>
      </aside>
    </div>
    <div class="list continues">
      {% for entry in rest %}
      <article>
        <div class="entry-head">
          <span class="tag">{{ categoryLabels[entry.data.category] }}</span>
          <div class="entry-right">
            <span class="date-hover"><span class="dispatch-no">No. {{ entry.data.dispatchNo }}</span> · {{ entry.date | date("d MMMM yyyy") }}</span>
          </div>
        </div>
        <h3>{{ entry.data.title }}</h3>
        <p>{{ entry.data.description }}</p>
        <div class="entry-actions"><a href="{{ entry.url }}">View the account</a></div>
      </article>
      {% endfor %}
    </div>
  </div>
</main>
<script src="/assets/js/search.js" type="module"></script>
```

- [ ] **Step 2: Verify**

Run: `npx eleventy`
Expected: `_site/index.html` exists.

Run: `grep -c "search-aside\|site-search" _site/index.html`
Expected: nonzero.

- [ ] **Step 3: Commit**

```bash
git add index.njk
git commit -m "feat: add home page with latest-entries listing and search markup"
```

---

## Task 11: Per-category image passthrough copy

**Files:**
- Modify: `eleventy.config.js`
- Create (temporary, deleted in Step 3): `DFTFR-Obsidian/Website/Family/__fixture.jpg`

**Interfaces:**
- Produces: images dropped by the user into any `DFTFR-Obsidian/Website/<Category>/` folder land at `/<category>/<filename>` in the build output.

- [ ] **Step 1: Add the per-category passthrough mappings to `eleventy.config.js`**

Add these lines inside the exported function, alongside the existing `addPassthroughCopy({ "assets": "assets" })` call from Task 1:

```js
const categoryDirs = {
  Professional: "professional",
  Philosophy: "philosophy",
  Projects: "projects",
  Exposures: "exposures",
  Family: "family",
  Fiction: "fiction",
  Misc: "misc",
};
for (const [dir, slug] of Object.entries(categoryDirs)) {
  eleventyConfig.addPassthroughCopy({
    [`DFTFR-Obsidian/Website/${dir}/*.{jpg,jpeg,png,gif,webp}`]: slug,
  });
}
```

- [ ] **Step 2: Verify with a throwaway fixture**

Run: `echo "not a real image, just testing passthrough copy" > "DFTFR-Obsidian/Website/Family/__fixture.jpg"`
Run: `npx eleventy`
Run: `test -f "_site/family/__fixture.jpg" && echo "PASSTHROUGH OK" || echo "PASSTHROUGH BROKEN — check object-form addPassthroughCopy output path behavior"`
Expected: `PASSTHROUGH OK`. If it's broken, the file most likely landed at `_site/DFTFR-Obsidian/Website/Family/__fixture.jpg` instead — if so, switch the mapping value from a bare `slug` string to `{ [slug]: true }`... actually first re-check Eleventy 3.x docs' exact object-form semantics before guessing further; the fixture test in this step exists specifically to catch this before real photos depend on it.

- [ ] **Step 3: Delete the fixture**

Run: `rm "DFTFR-Obsidian/Website/Family/__fixture.jpg"`
Run: `npx eleventy` and confirm `_site/family/__fixture.jpg` is gone.

- [ ] **Step 4: Commit**

```bash
git add eleventy.config.js
git commit -m "feat: add per-category image passthrough copy"
```

---

## Task 12: Pagefind search integration

**Files:**
- Modify: `package.json` (add `pagefind` devDependency)
- Create: `assets/js/search.js`

**Interfaces:**
- Consumes: the `#site-search` input and `#site-search-results` container from `index.njk` (Task 10).
- Produces: a working local search once `npm run build` (which runs `pagefind` after `eleventy`) has completed at least once.

- [ ] **Step 1: Install Pagefind**

Run: `npm install --save-dev pagefind`
Expected: `package.json`'s `devDependencies` now includes `"pagefind"`.

- [ ] **Step 2: Add `assets/js/search.js`**

```js
import * as pagefind from "/pagefind/pagefind.js";

const input = document.getElementById("site-search");
const results = document.getElementById("site-search-results");
if (input && results) {
  let debounceTimer;
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const term = input.value.trim();
      results.innerHTML = "";
      if (!term) return;
      const search = await pagefind.search(term);
      if (!search.results.length) {
        results.innerHTML = '<p class="no-results">Nothing filed under that yet.</p>';
        return;
      }
      for (const r of search.results.slice(0, 6)) {
        const data = await r.data();
        const a = document.createElement("a");
        a.href = data.url;
        a.textContent = data.meta.title || data.url;
        results.appendChild(a);
      }
    }, 200);
  });
}
```

- [ ] **Step 3: Verify the full build produces a search index**

Run: `npm run build`
Expected: prints Eleventy's "Wrote N files" line, then Pagefind's own summary line (something like "Indexed N pages").

Run: `test -f _site/pagefind/pagefind.js && echo "INDEX OK" || echo "INDEX MISSING"`
Expected: `INDEX OK`.

- [ ] **Step 4: Verify the index actually contains migrated content**

Run: `grep -rl "fear-that-devours-empires" _site/pagefind/ 2>/dev/null | head -1`
Expected: at least one matching fragment file path printed (confirms one of the migrated Professional posts made it into the index — if this prints nothing, check that `npm run build`, not just `npx eleventy`, was the command used, since Pagefind only runs as part of the `build` script).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json assets/js/search.js
git commit -m "feat: wire up Pagefind search on the homepage"
```

---

## Task 13: Final verification sweep

**Files:** none (verification only).

- [ ] **Step 1: Full clean build**

Run: `rm -rf _site && npm run build`
Expected: exits 0, ends with both Eleventy's and Pagefind's success output.

- [ ] **Step 2: Confirm no Hugo/Obsidian-only syntax remains in the vault**

Run: `grep -rn "{{<" DFTFR-Obsidian/Website --include="*.md"`
Expected: no output.

Run: `grep -rln "<!--" DFTFR-Obsidian/Website --include="*.md"`
Expected: no output (all `<!--more-->` markers were removed in Task 3).

- [ ] **Step 3: Confirm nothing but markdown was added inside the vault**

Run: `find DFTFR-Obsidian/Website -type f ! -name "*.md"`
Expected: no output (or only genuine user-supplied image files, if the user has already dropped any in — this command is a permanent guardrail worth re-running any time new content is added to the vault, not just now).

- [ ] **Step 4: Confirm every one of the 7 category pages, home, about, and contact all build**

Run:
```bash
for url in / /about/ /contact/ /professional/ /philosophy/ /projects/ /exposures/ /family/ /fiction/ /misc/; do
  path="_site${url}index.html"
  test -f "$path" && echo "$url OK" || echo "$url MISSING"
done
```
Expected: all lines end in `OK`.

- [ ] **Step 5: Report the follow-up list to the user**

This is not a code change — summarize in the final report to the user (not committed to git, already documented in the spec's Hugo shortcode cleanup follow-up section):
- 15 `{{< randompic >}}` spots across Professional/Philosophy/Misc/Family lost their decorative image placeholder entirely during Task 3's migration script; there was no image to substitute.
- Real photography for the 5 original `{{< photo >}}` shortcodes (Family's `vacation_rocks` predecessor, `changing_my_direction`, `the-simulation-hypothesis-and-you`) still needs to be supplied by the user into the matching category folders, per Task 11's passthrough copy wiring, before those images will actually appear.

No commit for this task — it's a verification/reporting pass only.

---

## Self-Review Notes

- **Spec coverage:** every section of `docs/superpowers/specs/2026-07-10-eleventy-migration-design.md` maps to a task above — directory layout (Tasks 1-2), templating/CSS (Task 2), collections/URLs/content modeling (Tasks 3-9), photos (Task 11), search (Task 12), Hugo shortcode cleanup (Task 3), placeholder content (Tasks 4-6), and the two open risks (Task 7 Step 3's count-matching check, Task 11's fixture-based passthrough smoke test).
- **Type/name consistency checked:** `category` (not `categoryKey`) is the frontmatter field name used consistently from Task 3 onward; `categoryLabels` (plural, matches the `_data/categoryLabels.json` filename minus extension) is used consistently in `post.njk`, `category.njk`, and `index.njk`; `dispatchNo` (not `dispatchNumber` or `no`) is the field name used in Task 3's migration script, Task 4's stubs, and Task 10's home page template.
- **Known follow-up for whoever executes Task 7:** Eleventy's pagination-plus-collection-filtering interaction needed a config-side `postsByCategory` collection rather than pure Nunjucks filtering in frontmatter, because Nunjucks front matter is YAML, not a template context where `selectattr` can run — Step 2 of that task documents the false-start and the corrected approach inline so the executor doesn't have to rediscover it.
