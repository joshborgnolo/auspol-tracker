---
name: chrome-session-piggyback
description: Read paywalled pages through the user's own logged-in Chrome via AppleScript (osascript) — .build/chrome-article.mjs opens a tab, polls readyState, returns outerHTML, closes what it opened. Zero credential handling. Needs Chrome's "Allow JavaScript from Apple Events" toggle + one-time macOS Automation consent; exit 1 contract lets callers fall back; interactive/manual runs only, NEVER launchd (GUI consent prompt). Built 2026-08-29 for The Australian/Newspoll and reused for News24/YouGov.
source: auto-skill
extracted_at: '2026-08-29T12:30:03.321Z'
---

# Piggyback the user's logged-in Chrome session to read paywalled pages

Problem shape: a target site (theaustralian.com.au) is both paywalled and bot-walled — plain
`fetch` gets an HTTP **200** "No Cookies" challenge, and archive.md is down/stale. The user has
a working subscriber session in their desktop Chrome. Alternatives evaluated and rejected:
cookie export (Cloudflare rotates sessions; login cookies undecryptable on disk) and CDP
remote-debugging (Chrome ≥ 136 ignores `--remote-debugging-port` on the default profile).
What works: drive the live browser over Apple Events — the tab runs under the user's real
profile, subscription cookies included, and **no credentials are ever touched by the code**.

## The tool: `.build/chrome-article.mjs <https-url>`

Node CLI that shells `osascript` with a heredoc AppleScript:

1. `launch` Chrome; if zero windows, `make new window` (flag `madeWindow`), else
   `make new tab at end of tabs of front window` with the URL.
2. Poll `execute tabRef javascript "document.readyState"`, 1 s × 25, then `delay 2.5` settle
   (News Corp's article body finishes rendering after `complete`).
3. Return `document.documentElement.outerHTML` on stdout.
4. Close exactly what it opened — the lone tab, or the whole window only if it had to create
   one. No Chrome state is modified or stored.

**Exit contract** (callers branch on this):
- exit 0 = rendered HTML on stdout
- exit 1 = any failure, reason on stderr; stderr inherits to the caller so the human sees it
- exit 2 = bad usage
- Failure detection inside stdout too: a `CHROME_JS_ERROR:` prefix means the in-page JS failed
  (almost always the Apple-Events toggle being off); `html.length < 20_000` means a wall/error
  page snuck through — a subscriber's rendered article page is 100 KB+.

## Two macOS prerequisites (surface both on stderr when missing)

1. Chrome ▸ View ▸ Developer ▸ **"Allow JavaScript from Apple Events"** — user toggles once.
2. macOS **Automation/TCC consent** for the calling terminal/app — first `osascript` run pops a
   GUI prompt (`error 1743` / "not authorized" when declined); approve under System Settings ▸
   Privacy & Security ▸ Automation. Because the prompt is GUI, this technique is
   **interactive/manual runs only — never enable it in a launchd LaunchAgent**: schedule-driven
   contexts can't grant consent and may hang. In scheduled wrappers, document why the env
   gate stays unset (see `.build/newspoll-updater.sh` header).

**Security note the user accepted**: with the Apple-Events JS toggle on, ANY local process can
read any tab of that Chrome. Fine when sensitive browsing happens in a different browser
(user: Safari for sensitive, Chrome is clean). State this trade-off when proposing the design.

## Integration pattern: env-gated LAST-resort, never the default fetch

In the caller (e.g. `.build/extract-newspoll.mjs`), wire it as:

```js
function chromeFallback(url) {
  if (!process.env.NEWSIE_CHROME) return null;              // opt-in only
  if (!/(^|\.)theaustralian\.com\.au$/.test(new URL(url).hostname)) return null;
  try {
    return execFileSync("node", [".build/chrome-article.mjs", url],
      { encoding: "utf8", timeout: 180_000, maxBuffer: 64 * 1024 * 1024,
        stdio: ["ignore", "pipe", "inherit"] });
  } catch { return null; } // helper already logged why; keep falling
}
```

Order of attempts: plain fetch → bot-wall detection → archive.md → **chromeFallback** → give
up with the original error. Also treat an archive.md snapshot OF THE WALL PAGE (its `<title>`
still says "no cookies") as unusable and try Chrome then too — observed in practice.

Why env-gated and last, not rank-0: the fetched page gets fed to tuned parsers written against
free-coverage prose; a full paywalled article's language (historical asides, comparison
sections) can poison figure extraction — see the newspoll-extraction skill for the concrete
mis-parse evidence that drove this design. The Chrome path is a rescue for "no other source at
all", its output still subject to the caller's guards, and the caller must let conflicts fail
loud rather than coin-flip.

## Multi-page sweeps: a different script shape than the single-URL helper

chrome-article.mjs opens one URL and closes it; for sweeps (N paginated URLs in one
osascript run) three findings from the News24 section-headline job (2026-08-31, full
detail in the news24-section-headlines skill):

1. **One FRESH TAB per page** — `make new tab at end of tabs of front window` each time.
   Reusing a tab via `set URL of tabRef to <next>` yields EMPTY-BUT-LOADED pages
   (h1 present, readyState complete, 0 content anchors) on Akamai-walled News Corp
   sections. Count expected anchors per page to detect this.
2. **Never `close tabRef` mid-sweep** — the next `front window`/`count of windows` throws
   `-1728 Can't get window id "…"`. Leave tabs open, close at the very end (in `try`) or
   not at all.
3. **Preflight EVERY page's extraction** — paginated endpoints may silently ignore your
   params (`?page=N` returned the identical 20 stories on News24; the real pagination is
   path-style `/page/N`). Diff page 1 vs page 2 results before trusting a 5-page run.

## Known site outcomes

- `theaustralian.com.au` — works; full subscriber article HTML via the piggyback.
- **`afr.com` — DEAD END for article bodies** (verified 2026-08-31 across sessions): the body
  is paywall-trimmed server/client-side even in the user's subscribed Chrome — no figures in
  the DOM, metas, or Flourish embeds. Topic pages (`afr.com/topic/…`), however, DO render
  article titles/links via plain unauthenticated fetch (~1 MB HTML) — use them for
  DETECTION only (see redbridge-accent-extraction's AFR topic-page cross-check).

## Testing the whole chain headlessly-ish

- Helper alone: `node .build/chrome-article.mjs <live-url> > /tmp/page.html; echo $?` — expect
  exit 0 and 500 KB+ on a subscriber session; grep the file for article-body markers
  (`<p>` count, `primary vote` hits, ld+json `NewsArticle` with real `datePublished`, ABSENCE
  of the wall-page title).
- Integration without burning the real fallback: `sed` a scratch copy of the caller to point
  the earlier fallback's host at a dead TLD (`archive.md` → `archive.invalid`), then run with
  the env var set — proves the Chrome rung fires end-to-end without touching the real script.
- Finish with a default (env-unset) run and byte-compare status output — scheduled behaviour
  must be identical to before.
