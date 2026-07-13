# The Cross-Filing Index (Tag Page) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single tag page at `/tags/` ("The Cross-Filing Index") with multi-select OR tag filtering, pre-selectable via `?tags=` links from every existing tag link on the site.

**Architecture:** One new root-level Eleventy template renders all tag chips (from the existing `tagCloud` collection) and all real posts (from the existing `posts` collection) statically; a ~40-line vanilla JS file toggles chips and shows/hides articles client-side. Three existing templates' dead `href="#"` tag links become real links into the page; the footer nav gains a standing link. No `eleventy.config.js` changes.

**Tech Stack:** Eleventy 3 (Nunjucks), vanilla JS (IIFE + `var` style, matching `assets/js/mermaid-render.js`), existing CSS classes in `assets/css/site.css`.

**Spec:** `docs/superpowers/specs/2026-07-12-tag-page-design.md`

## Global Constraints

- Filter logic is **OR**: an article is visible when it has **any** selected tag. Nothing selected → all articles visible.
- Page title / `<h1>`: **"The Cross-Filing Index"**. Kicker: **"Filed under many headings"**. URL: `/tags/`. Footer link text: **"Cross-Filing Index"**.
- `data-tags` and the `?tags=` query parameter are **comma-separated**; tag values are URL-encoded in links.
- No new collections, no `eleventy.config.js` changes, no new automated tests (repo has no DOM test harness — verification is build-output assertions + manual click-through).
- Reuse existing CSS classes; the only CSS additions are chip-button styling and two small spacing rules.
- The repo builds with `npx @11ty/eleventy` from the repo root; output goes to `_site/`. Build is fast (<1s).
- Never edit files under `mockups/` — they are historical.

---

### Task 1: The static page (`tags.njk` + chip CSS)

**Files:**
- Create: `tags.njk` (repo root, sibling of `index.njk`)
- Modify: `assets/css/site.css` (the `.cloud` rules, currently lines 246–249, and two new rules)

**Interfaces:**
- Consumes: `collections.tagCloud` (array of `{name, count}`, sorted count desc then name — defined in `eleventy.config.js`), `collections.posts` (real posts, newest first), `categoryLabels` global data, the `date` and `urlencode` filters.
- Produces: DOM contract for Task 2 — `#tag-filter` containing `button[data-tag][aria-pressed]` chips, and `#tag-list` containing `article[data-tags]` entries (comma-separated tags).

- [ ] **Step 1: Create `tags.njk`** with exactly this content:

```njk
---
title: The Cross-Filing Index
permalink: /tags/
eleventyExcludeFromCollections: true
---
{% extends "base.njk" %}
{% block content %}
<section class="cat-header">
  <div class="wrap">
  <div class="inner">
    <div>
      <p class="kicker">Filed under many headings</p>
      <h1>The Cross-Filing Index</h1>
      <p>Every recurring subject in the collection, gathered in one index. Select one or more to narrow the record; with nothing selected, everything is shown.</p>
    </div>
    <div class="cat-mark">
      <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.3" role="img" aria-label="Illustration of two overlapping filing tags">
        <path d="M14 14 L34 14 L34 40 L24 47 L14 40 Z" opacity=".5"/>
        <circle cx="24" cy="23" r="3"/>
        <path d="M30 22 L50 22 L50 48 L40 55 L30 48 Z" opacity=".85"/>
        <circle cx="40" cy="31" r="3"/>
      </svg>
    </div>
  </div>
  </div>
</section>
<main class="wrap">
  <div class="article-index">
    <div class="cloud tag-filter" id="tag-filter">
      {% for tag in collections.tagCloud %}
      <button type="button" data-tag="{{ tag.name }}" aria-pressed="false"{% if tag.count > 1 %} class="freq-2"{% endif %}>{{ tag.name }}</button>
      {% endfor %}
    </div>
    <div class="list" id="tag-list">
      {% for entry in collections.posts %}
      <article data-tags="{{ (entry.data.tags or []) | join(",") }}">
        <a class="stretched-link" href="{{ entry.url }}" aria-hidden="true" tabindex="-1"></a>
        <span class="tag">{{ categoryLabels[entry.data.category] }}</span>
        <div class="entry-head">
          <h3>{{ entry.data.title }}</h3>
          {% if entry.data.dispatchNo %}
          <span class="date-hover"><span class="dispatch-no">No. {{ entry.data.dispatchNo }}</span> · {{ entry.date | date("d MMMM yyyy") }}</span>
          {% endif %}
        </div>
        <div class="entry-tags">{% for t in entry.data.tags %}<a href="/tags/?tags={{ t | urlencode }}">{{ t }}</a>{% endfor %}</div>
        <p>{{ entry.data.description }}</p>
        <div class="entry-actions"><a href="{{ entry.url }}">View the account</a></div>
      </article>
      {% endfor %}
    </div>
  </div>
</main>
{% endblock %}
```

Notes for the implementer: the header/section shape mirrors `_includes/category.njk`; the article markup is the category pages' generic branch plus the `<span class="tag">` category chip (needed because this list spans categories) and real tag links. `(entry.data.tags or [])` guards a tagless post — Nunjucks `join` on `undefined` would throw.

- [ ] **Step 2: Add chip-button CSS.** In `assets/css/site.css`, find these two rules (currently lines 247–248):

```css
.cloud a{font-family:var(--mono);font-size:.66rem;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-dim);border:1px solid var(--rule);padding:6px 11px;border-radius:1px;transition:color .15s,border-color .15s,background-color .15s;}
.cloud a:hover,.cloud a:focus-visible{color:var(--brass);border-color:var(--brass-dim);background:var(--bg-raised-2);}
```

and change them to cover buttons too, then add the pressed state, the button reset, and the spacing rules directly below the `.cloud a.freq-2` rule:

```css
.cloud a,.cloud button{font-family:var(--mono);font-size:.66rem;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-dim);border:1px solid var(--rule);padding:6px 11px;border-radius:1px;transition:color .15s,border-color .15s,background-color .15s;}
.cloud a:hover,.cloud a:focus-visible,.cloud button:hover,.cloud button:focus-visible{color:var(--brass);border-color:var(--brass-dim);background:var(--bg-raised-2);}
.cloud a.freq-2{font-size:.88rem;color:var(--brass-dim);border-color:var(--brass-dim);}
.cloud button{background:none;cursor:pointer;}
.cloud button.freq-2{font-size:.88rem;color:var(--brass-dim);border-color:var(--brass-dim);}
.cloud button[aria-pressed="true"]{color:var(--brass);border-color:var(--brass);background:var(--bg-raised-2);}
.tag-filter{margin:0 0 36px;}
.article-index article > .tag{margin-bottom:10px;}
```

(The existing `.cloud a.freq-2` line stays as-is; the block above shows it only to fix the insertion point.)

- [ ] **Step 3: Build and verify the page renders.**

Run: `npx @11ty/eleventy && grep -c "<article data-tags=" _site/tags/index.html && grep -c "button type=\"button\" data-tag=" _site/tags/index.html && grep -c "The Cross-Filing Index" _site/tags/index.html`

Expected: build succeeds; article count equals the number of real posts (compare against `grep -c "<article" _site/professional/index.html` summed across categories if unsure — as of writing, expect ~40); chip count ≥ 1 (one per unique tag); title appears ≥ 2 times (`<title>` + `<h1>`).

- [ ] **Step 4: Verify `data-tags` content is correct** for a known post.

Run: `grep -o "<article data-tags=\"[^\"]*\"" _site/tags/index.html | head -5`

Expected: comma-separated lowercase tags matching post frontmatter (e.g. `data-tags="blogging"`), empty string for tagless posts — never the literal text `undefined`.

- [ ] **Step 5: Commit**

```bash
git add tags.njk assets/css/site.css
git commit -m "Add the Cross-Filing Index page (static markup + chip styles)"
```

---

### Task 2: The filter script (`assets/js/tags-filter.js`)

**Files:**
- Create: `assets/js/tags-filter.js`
- Modify: `tags.njk` (add the script tag at the end of the content block)

**Interfaces:**
- Consumes: Task 1's DOM contract — `#tag-filter button[data-tag][aria-pressed]`, `#tag-list article[data-tags]` (comma-separated).
- Produces: URL contract used by Task 3's links — `/tags/?tags=<encoded>,<encoded>` (comma-separated, URL-encoded values), applied on load and rewritten on every toggle via `history.replaceState`.

- [ ] **Step 1: Create `assets/js/tags-filter.js`** with exactly this content (IIFE + `var`, matching `mermaid-render.js` style):

```js
(function () {
  var chips = Array.prototype.slice.call(
    document.querySelectorAll("#tag-filter button[data-tag]")
  );
  var articles = Array.prototype.slice.call(
    document.querySelectorAll("#tag-list article")
  );
  if (!chips.length || !articles.length) return;

  function selectedTags() {
    return chips
      .filter(function (c) { return c.getAttribute("aria-pressed") === "true"; })
      .map(function (c) { return c.getAttribute("data-tag"); });
  }

  // OR semantics: with nothing selected everything shows; otherwise an
  // article shows when it carries any selected tag.
  function applyFilter() {
    var selected = selectedTags();
    articles.forEach(function (article) {
      if (!selected.length) {
        article.hidden = false;
        return;
      }
      var tags = (article.getAttribute("data-tags") || "").split(",");
      article.hidden = !selected.some(function (t) {
        return tags.indexOf(t) !== -1;
      });
    });
    // Keep the URL shareable: /tags/?tags=a,b while filtered, bare /tags/
    // when not. replaceState so toggling doesn't pollute history.
    var qs = selected.length
      ? "?tags=" + selected.map(encodeURIComponent).join(",")
      : "";
    history.replaceState(null, "", location.pathname + qs);
  }

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var pressed = chip.getAttribute("aria-pressed") === "true";
      chip.setAttribute("aria-pressed", pressed ? "false" : "true");
      applyFilter();
    });
  });

  // Pre-select from ?tags= (links elsewhere on the site point here with a
  // tag already chosen). URLSearchParams decodes; unknown tags are ignored.
  var initial = new URLSearchParams(location.search).get("tags");
  if (initial) {
    var wanted = initial.split(",");
    chips.forEach(function (chip) {
      if (wanted.indexOf(chip.getAttribute("data-tag")) !== -1) {
        chip.setAttribute("aria-pressed", "true");
      }
    });
    applyFilter();
  }
})();
```

- [ ] **Step 2: Load it from `tags.njk`.** Immediately before `{% endblock %}`, add:

```njk
<script src="/assets/js/tags-filter.js"></script>
```

(Same pattern as `index.njk` loading `search.js` inside its content block — not in `base.njk`, which only carries sitewide scripts.)

- [ ] **Step 3: Build and verify wiring.**

Run: `npx @11ty/eleventy && grep -c "tags-filter.js" _site/tags/index.html && test -f _site/assets/js/tags-filter.js && echo js-copied`

Expected: `1` and `js-copied` (the blanket `assets` passthrough copy picks the file up automatically).

- [ ] **Step 4: Manual behavior check** (the repo has no DOM test harness — this is the spec's agreed verification):

Run: `npm run serve`, open `http://localhost:8080/tags/`, and confirm:
1. All posts visible initially, no chips pressed.
2. Tap one chip → list narrows to posts with that tag; URL becomes `/tags/?tags=<tag>`.
3. Tap a second chip → list **grows** (OR, not AND); URL lists both comma-separated.
4. Untap both → all posts visible; URL returns to `/tags/`.
5. Load `http://localhost:8080/tags/?tags=<some-real-tag>` directly → that chip is pressed and the list is pre-filtered.
6. Load `/tags/?tags=nonexistent` → no chip pressed... all posts visible, no errors in console.

Stop the server when done.

- [ ] **Step 5: Commit**

```bash
git add assets/js/tags-filter.js tags.njk
git commit -m "Add multi-select OR tag filtering to the Cross-Filing Index"
```

---

### Task 3: Wire the site's tag links into the page

**Files:**
- Modify: `index.njk` (two places: the tag cloud ~line 68, the list's inline tags ~line 88)
- Modify: `_includes/post.njk` (the "Cross-filed under" links, ~line 31)
- Modify: `_includes/category.njk` (the entry tag links, ~line 61)
- Modify: `_includes/partials/footer.njk` (add the standing footer link)

**Interfaces:**
- Consumes: Task 2's URL contract — `/tags/?tags=<urlencoded-tag>`.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: `index.njk` tag cloud.** Change:

```njk
<a href="#"{% if tag.count > 1 %} class="freq-2"{% endif %}>{{ tag.name }}</a>
```

to:

```njk
<a href="/tags/?tags={{ tag.name | urlencode }}"{% if tag.count > 1 %} class="freq-2"{% endif %}>{{ tag.name }}</a>
```

- [ ] **Step 2: `index.njk` list inline tags.** Change:

```njk
<div class="entry-tags-inline">{% for t in entry.data.tags %}<a href="#">{{ t }}</a>{% endfor %}</div>
```

to:

```njk
<div class="entry-tags-inline">{% for t in entry.data.tags %}<a href="/tags/?tags={{ t | urlencode }}">{{ t }}</a>{% endfor %}</div>
```

- [ ] **Step 3: `_includes/post.njk` cross-filed links.** Change:

```njk
{% for tag in tags %}<a href="#">{{ tag }}</a>{% endfor %}
```

to:

```njk
{% for tag in tags %}<a href="/tags/?tags={{ tag | urlencode }}">{{ tag }}</a>{% endfor %}
```

- [ ] **Step 4: `_includes/category.njk` entry tags.** Change:

```njk
<div class="entry-tags">{% for t in entry.data.tags %}<a href="#">{{ t }}</a>{% endfor %}</div>
```

to:

```njk
<div class="entry-tags">{% for t in entry.data.tags %}<a href="/tags/?tags={{ t | urlencode }}">{{ t }}</a>{% endfor %}</div>
```

- [ ] **Step 5: `_includes/partials/footer.njk` standing link.** Change:

```njk
<a href="/feed.xml">RSS</a>
<a href="/about/"{% if page.url == "/about/" %} class="current"{% endif %}>About</a>
```

to:

```njk
<a href="/feed.xml">RSS</a>
<a href="/tags/"{% if page.url == "/tags/" %} class="current"{% endif %}>Cross-Filing Index</a>
<a href="/about/"{% if page.url == "/about/" %} class="current"{% endif %}>About</a>
```

- [ ] **Step 6: Build and verify no dead tag links remain anywhere.**

Run: `npx @11ty/eleventy && grep -rl 'href="#"' _site --include="*.html" || echo "no dead links"`

Expected: `no dead links` (before this task, home/category/post pages all contain `href="#"`).

Run: `grep -c 'href="/tags/?tags=' _site/index.html && grep -c '/tags/"' _site/index.html`

Expected: first count ≥ number of cloud tags (cloud + inline list tags); second ≥ 1 (footer link on every page).

- [ ] **Step 7: Spot-check a link round-trip.** Open any built post page (e.g. `_site/professional/a-reckoning-after-two-weeks-in-the-dark/index.html`) and confirm its cross-filed link reads `href="/tags/?tags=blogging"` — the same tag value that appears in `_site/tags/index.html`'s chip `data-tag="blogging"`.

- [ ] **Step 8: Commit**

```bash
git add index.njk _includes/post.njk _includes/category.njk _includes/partials/footer.njk
git commit -m "Point all tag links at the Cross-Filing Index with pre-selection"
```

---

### Task 4: Docs sync + final verification

**Files:**
- Modify: `docs/designSpecifications-updated.md` (Terminology section ~line 113, and the "Linking" note ~line 143)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing — documentation and sign-off only.

- [ ] **Step 1: Add the terminology bullet.** In `docs/designSpecifications-updated.md`, under `## Terminology decisions (naming things in-voice)`, append:

```markdown
- Tag index page: **"The Cross-Filing Index"** at `/tags/` (kicker: "Filed under many headings") — extends the per-post "Cross-filed under" language. All tag links site-wide point here as `/tags/?tags=<tag>`, pre-selecting that tag; the page filters client-side with multi-select **OR** logic (`assets/js/tags-filter.js`), shows everything when nothing is selected, and works as a plain full archive listing without JS. Linked from the footer nav as **"Cross-Filing Index"**.
```

- [ ] **Step 2: Fix the stale linking note.** In the same file (~line 143), change the sentence:

```markdown
**In the real build**, RSS now points at the real `/feed.xml` (see `docs/site-integrations.md`); individual tag links are still placeholder `#` (no per-tag listing page exists yet).
```

to:

```markdown
**In the real build**, RSS now points at the real `/feed.xml` (see `docs/site-integrations.md`), and individual tag links now point at the Cross-Filing Index (`/tags/?tags=<tag>` — see Terminology below); article prev/next are real category-sibling links.
```

- [ ] **Step 3: Full clean verification.**

Run: `rm -rf _site && npx @11ty/eleventy && find _site -name "*.html" | wc -l`

Expected: build succeeds; page count is exactly one higher than before this feature (58, if nothing else changed since the font work).

Run: `grep -rl 'href="#"' _site --include="*.html" || echo "no dead links"`

Expected: `no dead links`.

- [ ] **Step 4: Commit**

```bash
git add docs/designSpecifications-updated.md
git commit -m "Document the Cross-Filing Index in the design spec"
```
