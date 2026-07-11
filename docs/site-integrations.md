# Site integrations — RSS, contact form, favicons, deployment

This covers the "wired up to real services" parts of the live Eleventy build that aren't
covered by `designSpecifications-updated.md` (visual/voice) or `obsidian-to-eleventy-lessons.md`
(vault-to-Eleventy mechanics). **No passwords, SSH private keys, or other secrets are stored
anywhere in this repo or in this doc** — see the Deployment section for exactly where each
credential actually lives.

## RSS / Atom feed

- `@11ty/eleventy-plugin-rss` is installed and registered in `eleventy.config.js` (dynamic
  `import()` inside the async config function, since the plugin is ESM-only and the config file
  is CommonJS).
- `feed.njk` renders `/feed.xml` from `collections.posts` (already sorted newest-first, already
  excludes category-index and project-journal-entry pages), capped at the 20 most recent items.
- `_data/site.json` holds `url` and `description`, used to build absolute links in the feed.
  `url` is currently `https://dispatchesfromthefarreaches.com` — update this if the domain ever
  changes.
- The footer's "RSS" link and a `<link rel="alternate">` in `_includes/partials/head.njk` both
  point at `/feed.xml`.

## Contact form (Web3Forms)

- `_includes/contact.njk` posts to Web3Forms via a hidden `access_key` input plus a hidden
  honeypot checkbox (`name="botcheck"`). The access key is a **public, client-side key by
  design** (Web3Forms' whole model is a key embedded in static HTML) — it is not a secret and is
  fine to have committed in the template.
- `assets/js/contact-form.js` submits via `fetch()` (no page navigation), shows inline status
  text, and on success runs a 5-second countdown ("Returning you to the main page in 5…") before
  redirecting to `/`. The countdown digit is wrapped in `<strong class="countdown-num">`, styled
  in brass + `var(--serif-display)` to stand out.
- `DFTFR-Obsidian/Website/Contact/thankyou.md` (layout `_includes/thankyou.njk`) is a
  same-themed confirmation page built at `/contact/thankyou.html` — this exact path is set as
  Web3Forms' redirect URL in their dashboard, used only as a fallback for non-JS form posts
  (the JS path never navigates there since it redirects to `/` itself after the countdown).
- Testing note: Web3Forms sits behind a Cloudflare bot challenge, so hitting the API with `curl`
  from a script gets blocked outright — that's expected, not a sign of misconfiguration. Verify
  by actually submitting the form in a browser.

## Favicons

- Source files live in `assets/favicon/` (favicon.ico, favicon.svg, the 16/32/48 PNGs,
  apple-touch-icon.png, android-chrome-*.png, site.webmanifest).
- `eleventy.config.js` has a loop that adds one passthrough-copy rule per file in that folder,
  copying each straight to the **site root** (`/favicon.ico`, not `/assets/favicon/favicon.ico`)
  — several of these are looked up at fixed root paths by browsers/OS regardless of `<link>`
  tags, and `site.webmanifest` already references its icons as root-relative paths.
- Any generation/instruction notes for a new favicon set should go in `docs/`, not
  `assets/favicon/` — a stray `favicon.md` in that folder would otherwise get copied straight
  onto the live site.
- The `<link rel="icon">` / `<link rel="apple-touch-icon">` / `<link rel="manifest">` /
  `theme-color` tags live in `_includes/partials/head.njk`.

## Deployment — GitHub Actions → DreamHost

`.github/workflows/deploy.yml` runs on every push to `main` (and manually via
`workflow_dispatch`):

1. `actions/checkout` → `actions/setup-node` (Node 24) → `npm ci` → `npm run build`
   (`eleventy && pagefind --site _site`).
2. Writes an SSH private key to `~/.ssh/id_ed25519` from the `DREAMHOST_SSH_KEY` **GitHub
   Actions secret**, and pins DreamHost's host key inline in the workflow (a public value, safe
   to commit).
3. `rsync -avz --delete` from `_site/` to
   `/home/curatebot_9sxtzf/dispatchesfromthefarreaches.com/` on
   `pdx1-shared-a1-24.dreamhost.com`, excluding `.htaccess` and `.well-known` so anything
   DreamHost manages there survives a sync.

**Where the credentials actually live (and don't):**
- The deploy keypair (ed25519, comment `github-actions-deploy`) was generated locally, its
  private half was pasted directly into the GitHub secret `DREAMHOST_SSH_KEY` (Settings →
  Secrets and variables → Actions) and never committed to any file in this repo.
- The public half is appended to `~/.ssh/authorized_keys` on the DreamHost account
  (`curatebot_9sxtzf`) — that's the only place it's installed.
- The DreamHost account **password** was used once, interactively, by the repo owner directly in
  their own terminal to install that public key — it was never typed into an agent-run command,
  never written to a file, and isn't recorded anywhere in this repo or its docs.
- If the deploy key is ever rotated: generate a new keypair, add the new public key to
  `~/.ssh/authorized_keys` on DreamHost (append, don't just replace, until the new one is
  confirmed working), update the `DREAMHOST_SSH_KEY` secret, then remove the old public key line.

**Known quirk:** an early deploy run failed with `ssh: connect ... Connection timed out` — a
network-level timeout (not an auth rejection) suggesting DreamHost or an upstream network was
momentarily dropping SSH connections from GitHub Actions' runner IP ranges. Manual SSH from the
repo owner's own machine worked immediately throughout, which is what pointed at an IP-based
network issue rather than a key/config problem. Subsequent runs (after a Node-version bump and,
separately, an unrelated content push) succeeded end-to-end and the site now deploys reliably —
but if `Connection timed out` reappears, that's the first thing to suspect again, and DreamHost
support is the right contact (they can see their own edge/firewall logs; this repo has no
visibility into that).

If DreamHost ever blocks GitHub's IP ranges outright and won't budge, the fallback plan
discussed (not implemented) is switching from a **push** model (GitHub → SSH → DreamHost) to a
**pull** model (a cron job or webhook on DreamHost that runs `git pull` + build itself) — that
only needs outbound connections initiated by DreamHost, which wouldn't hit the same restriction.
