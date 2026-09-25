---
name: auspol-favicon-pipeline
description: auspol-tracker — the favicon-192.png auto-redraw pipeline end-to-end (shipped 519c9bd, 2026-09-19). Why a PNG must exist beside the SVG data-URI (Google's crawler can't index data URIs and doesn't support SVG), render-favicon.mjs's sha256-of-favicon.svg staleness gate (copied from render-card's idiom), refresh_site's build→render-card→render-favicon→restamp order, the wrapper add-list trio, and the hash-the-exact-file-bytes gotcha (writeAtomic's trailing newline made the first build-side check false-positive).
source: auto-skill
extracted_at: '2026-09-19T00:00:00.000Z'
---

# The favicon raster pipeline (assets/favicon-192.png)

## Why two icons exist at all

The page's tab icon is an **SVG data-URI** in `<head>` — correct for browsers (live glyph,
redrawn from the aggregates every build, no request, never stale). But Google Search's
favicon crawler (Googlebot-Image) needs a **URL to fetch** — a data-URI is not crawlable —
and SVG is not among its supported formats (BMP, GIF, ICO, PNG, JPEG, PPM, TIFF). So the
result page fell back to a generic globe until `assets/favicon-192.png` existed. Two Google
constraints shape the renderer: **the favicon URL must be stable** (fixed unhashed name —
bytes may change, the URL may not), and **>48x48 recommended** (192 chosen, doubles as a
home-screen icon). `<head>` links PNG first (Google takes it), SVG data-URI second, typed
`image/svg+xml` (browsers prefer it; nothing about the tab changes).

## Components

- **`buildFavicon()` in `.build/newtracker/build.mjs`** (~:237) renders the live gauge glyph
  (four party arcs + needle vs LNP) from the headline estimator; `writeAtomic`
  **rewrites `assets/favicon.svg` on EVERY build** — so mtime carries no signal and any
  staleness check must content-hash.
- **`.build/newtracker/render-favicon.mjs`** — self-contained rasteriser (sibling of
  render-card.mjs but no HTTP server): reads `assets/favicon.svg`, `page.setContent()`s it
  at a `SIZE×SIZE` (192) viewport with `deviceScaleFactor: 1` (screenshot is exactly
  192×192, no resampling), drawn on ground **`#faf6f0`** (the site's `--bg`; a transparent
  dark-ink glyph disappears on dark search surfaces). Deps: `puppeteer-core` +
  `CHROME` env or the default macOS Chrome path; missing either = helpful `die(1)`.
  build.mjs never imports it (plain-node toolchain stays dependency-free).
- **Stamp `assets/favicon-192.json`** = `{svgSha256, drawnISO}`. Pre-launch gate: if
  `stamp.svgSha256 === sha256(favicon.svg)` and the PNG exists → exit 0
  `favicon current (glyph unchanged) – nothing to do` **before puppeteer is even
  required** (~20s saved per slot; machines with no Chrome skip quietly). Missing/old-format
  stamp falls through to a draw (fail-open, correct after a fresh clone).

## Automation (shipped `519c9bd`, 2026-09-19)

- **No new workflow or launchd job was added** — `refresh_site()` in
  `.build/git-push-main.sh` is the single funnel every writer already passes through
  (10 house wrappers, all CI data workflows since they run the same scripts, and
  prediction-refresh). Order is now: build → render-card → **render-favicon** → restamp
  build. Both renders are best-effort (log `WARN` + `::warning::`, never block a data
  commit over a preview asset).
- **Every data wrapper + `prediction-refresh.sh`** stages the trio
  `assets/favicon.svg assets/favicon-192.png assets/favicon-192.json` through the shared
  `SITE_FILES` array in `.build/git-push-main.sh` (since 2026-09-25; before that the
  trio was hand-copied into both the `git add` list and the `push_main` list of eleven
  wrappers). Each wrapper's `FILES=(<own paths> "${SITE_FILES[@]}")` feeds both the add
  and push_main (whose rebase-amend path re-stages from it). A new generated file goes
  into `SITE_FILES` once. demosau/essential early "confirm-skip" blocks use
  `git add ... assets/` so they pick the trio up wholesale; that's fine (cosmetic cases).
- **build.mjs stale-stamp warning** (~:379-397): after the `FAV_PNG` absent-warn, if the
  PNG exists it reads the stamp and warns `favicon PNG: drawn from an older glyph` on
  mismatch — soft warning only, never a hard fail (deliberate: a wrapper mid-refresh_site
  is already consistent, and a human seeing the reminder can act without a red build).

## GOTCHA — hash the exact file bytes, not the in-memory glyph

The first build-side check hashed `crypto.createHash("sha256).update(fav.svg)` — the
**in-memory string** — while the renderer hashes the **file on disk**. `writeAtomic` writes
`fav.svg + "\n"`, so the two hashes never agreed and the very first verification build
printed the stale-glyph warning seconds after a clean draw+stamp. The check must hash
`fav.svg + "\n"` to match the renderer byte-for-byte. Any future producer/consumer pair
that cross-compares content hashes has to agree on the exact byte source (file vs string).

## Verifying a change to it

Run the renderer **twice**: first run must print
`drew assets/favicon-192.png · 192x192 · … · stamped assets/favicon-192.json`(or the no-op
line if already current), second run **must** print `favicon current (glyph unchanged)` in
<1s — that proves the gate short-circuits before the Chrome probe. Then
`node .build/newtracker/build.mjs | grep favicon` must show only the `favicon: alp …`
composition line, no stale warning. The PNG itself is deterministic given the glyph, so a
no-data-change redraw produces byte-identical output (nothing new to commit).

## Related

- **auspol-share-card** — the gate idiom this copies (assets/auspol-card.json;
  refresh_site order documented there now includes the favicon step).
- **launchd-scheduled-data-pipeline** — wrapper conventions (best-effort render stages,
  explicit add-lists, push_main file arrays, slot lock, dirty-tree guard).
- **auspol-build-pipeline** — buildFavicon/writeAtomic/head-link map inside build.mjs.
