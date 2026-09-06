---
name: auspol-share-card
description: auspol-tracker — the og:image sharecard pipeline end-to-end (make-card.js design-in-page, render-card.mjs headless-Chrome driver, build.mjs stamp check + og:image cache-bust, wrapper/CI automation). Staleness is DATE+FIGURE (publishedISO + a fig block of the card's displayed strings); figure-only changes (decay drift, "cure" corrections, PR-merged waves) redraw via render-card's pre-launch gate, refresh_site owns build→render→restamp order in every wrapper, and the daily prediction-refresh backstop (puppeteer+CHROME wired) self-heals anything missed ≤24h. Shipped 2026-09-07.
source: auto-skill
extracted_at: '2026-09-07T00:00:00.000Z'
---

# The share card (assets/auspol-card.png) pipeline

## Components and why they're shaped this way

- **`.build/newtracker/make-card.js`** — the ONLY place the card is designed. Runs *inside
  the built page*: reads `window.AUSPOL` (so the card can't contradict the page) and draws
  with the site's own webfonts (canvas text only picks up fonts a document already loaded).
  Exposes `window.__auspolCard = { png, publishedISO, fig }` (fig = the displayed
  figure strings; shape mirrored in build.mjs's cardFigs) and ends by clicking a
  download (render-card.mjs neuters the click).
- **`.build/newtracker/render-card.mjs`** — the driver. Serves the repo on an ephemeral
  127.0.0.1 port, opens `index.html` in headless Chrome via **puppeteer-core** (the repo's
  one declared dependency; resolved from repo `node_modules` then `~/node_modules`),
  waits for `window.AUSPOL.latest` AND for three named faces to load (Crimson Text, IBM
  Plex Sans, Source Sans 3 — refuses to draw rather than fall back to system fonts),
  writes `assets/auspol-card.png` + stamp `assets/auspol-card.json`
  (`{publishedISO, fig}` — fig is the block of figure strings the card shows).
  Chrome found via `CHROME` env, else the hardcoded macOS
  `/Applications/Google Chrome.app/...` path; missing either dep = helpful `die(1)`
  pointing at the manual console procedure in make-card.js's header.
- **`.build/newtracker/build.mjs` (~L489-533)** — cannot draw the card (plain-node
  toolchain, deliberately; build.mjs never imports render-card). It reads the stamp,
  compares against `grabLatest().publishedISO` (`grabLatest` re-parses the `latest` const
  out of the 9f09dca2 dataset asset — a string-split contract, see
  auspol-build-pipeline) and its fig via the local `cardFigs()` (shape mirrored in
  make-card.js — edit both together), warns on mismatch locally, and **hard-fails
  (exit 1) when `CI && GITHUB_WORKFLOW === "tests"`** on DATE mismatch only —
  figure drift is advisory-warn, healing via the gated re-render below. build.mjs
  also writes **`assets/auspol-latest.json`** (`{publishedISO, fig}`), the machine-readable
  "what the card SHOULD say" sidecar that render-card's gate compares the drawn
  stamp against. `og:image` is cache-busted `?v=${(cardStamp || dataStamp) + figKey}`
  where figKey is a sha1-8 of the drawn stamp's fig block (absent for pre-fig
  stamps) — key comes from the STAMP, so the URL changes exactly when the card's
  pixels change. cardAlt/meta descriptions quote the same `latest` figures.

## Automation (refresh_site + figure gate, shipped 2026-09-07)

- **`refresh_site()` in `.build/git-push-main.sh`** owns the ORDER: build (writes
  auspol-latest.json) → render-card (gated, best-effort — failure WARNs, never
  blocks) → build again (restamps og:image with the fresh stamp/figKey). An
  earlier design rendered BEFORE the build, so cards/stamps shipped one wave
  stale (`ff20d9a`: stamp 08-31, data 09-02); never reintroduce render-before-build.
- All **10 `.build/*-updater.sh` house wrappers** call `refresh_site` between
  validate and commit, and stage `assets/auspol-card.png assets/auspol-card.json
  assets/auspol-latest.json` (also passed to `push_main` for the rebase-amend path).
  `.build/prediction-refresh.sh` does the same — that daily pipeline is the ≤24h
  backstop for figure-only drift and PR-merged filings nobody rendered for.
- **`render-card.mjs` staleness gate**: before launching Chrome it reads the drawn
  stamp `assets/auspol-card.json` against `assets/auspol-latest.json`
  (date AND fig JSON compared); match → exit 0 "card current" in <1s, no Chrome
  (~20s saved per slot). Missing sidecar/stamp → draws (fail-open, correct after a
  fresh clone).
- CI prerequisites: `poll-agent.yml`, `roymorgan-update.yml`, `coverage-check.yml`,
  **`prediction-refresh.yml` (update + repair) and `newspoll-watch.yml` (filing
  agent)** carry `npm ci --ignore-scripts --no-audit --no-fund || true` plus
  `CHROME: /usr/bin/google-chrome`. Ubuntu images ship Chrome at that path.

## Fixed gaps (were open until 2026-09-07)

1. ~~Staleness was date-only~~ — fig block now rides the stamp end-to-end
   (make-card → render-card → build.mjs advisory + og:image key).
2. ~~No daily backstop~~ — prediction-refresh runs refresh_site daily; drift
   heals ≤24h.
3. ~~Unconditional renders~~ — the pre-launch gate makes current cards a free
   no-op.

Small print: demosau/essential updaters have early "confirm-skip" build+commit
blocks (`git add ... || true`) that rebuild index.html WITHOUT rendering —
cosmetic, heals on the next wave or the daily backstop. `news24-updater.sh` has
no CI twin, so its renders happen only via the local launchd Mac (Chrome at the
default path).

## Related

- **auspol-build-pipeline** — build.mjs/gen-data.mjs map (grabLatest, writeAtomic;
  auspol-latest.json now exists but the other string-split consumers remain).
- **launchd-scheduled-data-pipeline** — wrapper conventions (best-effort warn pattern,
  push_main file list, slot lock).
- **ci-main-writer-races** — main-writers serialisation that stamps/pushes ride on.
