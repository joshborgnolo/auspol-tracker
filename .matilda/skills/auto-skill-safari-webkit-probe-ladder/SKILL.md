---
name: safari-webkit-probe-ladder
description: auspol-tracker — reproducing a "works in Chrome, user says broken in Safari" UI bug headlessly (flow-drift dot-hover saga, worked 2026-10-05). safaridriver is broken on this Mac; a compiled WKWebView harness is the engine proxy (two Swift traps: didFinish must evaluateJavaScript, and Promise results don't bridge); CGEventPost HID mouse events NEVER produce DOM events in WKWebView (mv:0), so it's a harness dead-end not a bug signal; Safari.app JS automation is gated (ERR 8, "Allow JavaScript from Apple Events"); the fall-through is an instrumented diag page + local collector the USER drives in real Safari — and when actually run with the user (2026-10-05 pm): don't trust the user's verbal dot coordinates (twice misidentified), log hovers near EVERY interactive element by aria-label so the dead dot names itself, measure elementFromPoint rings AFTER scrollIntoView, and a GREEN user run locally + red report on live = the variable is what the server serves THEIR browser (Safari reload ≠ cache bypass).
source: auto-skill
extracted_at: '2026-10-05T09:36:44.629Z'
---

# Safari-only bug reproduction ladder (auspol-tracker, macOS)

Symptom shape: Chrome (CDP) probes all green, deployed page byte-identical to
origin/main, but the user still reports the bug **in Safari** after a hard
refresh. Do NOT re-litigate the deployment; the variable is the browser. Work
down this ladder (each rung was tried live on 2026-10-05 for the flow-drift
"dots on the month line are not hoverable" report).

## Rung 0 — verify the fix is actually on the live page

`curl -sI https://auspoltracker.com/` — GitHub Pages serves `Cache-Control:
max-age=600`, no service worker, no appcache (grep index.html for
serviceWorker). So any compliant browser is stale for ≤10 min after a push.
If the user says "still broken after hard refresh", an open pre-fix tab or a
browser-level quirk is in play — not the deployment. sha256 the live HTML
against `git show main:index.html` if you need to close the loop fully.

## Rung 1 — WKWebView harness (the Safari engine proxy that works)

safaridriver is BROKEN on this Mac (POST /session returns "invalid session
id" even by raw curl to :4456 — exit 1). Don't sink time into it. Compile a
WKWebView probe instead (see `.matilda/wkprobe.swift`; concrete probe for
this saga: `.matilda/probe-flow-dots-wk.swift`):

- NSApplication + WKWebView + `WKScriptMessageHandler`; serve the repo with a
  local static server (`:8735` here), load `…/index.html#allpolls`.
- TRAP 1: `applicationDidFinishLaunching` only LOADS the page. You MUST add
  `func webView(_:didFinish:)` calling
  `webView.evaluateJavaScript(PROBE_JS)` or the probe JS never runs
  (`WK_PROBE_TIMEOUT` after 90 s).
- TRAP 2: `evaluateJavaScript` cannot bridge a PROMISE result —
  `WK_JS_ERR JavaScript execution returned a result of an unsupported type`.
  End the async IIFE with `,0` (or append `.catch(...),0`) and deliver real
  output via `window.webkit.messageHandlers.<name>.postMessage(JSON.stringify(o))`.

This answered the engine-level question cleanly: 177/177 hit circles
unshadowed, user's exact dot (RedBridge/Accent 24–28 Aug, v=−3.3) raises +
clears its wave tip — in WebKit as well as Chromium, on localhost AND the
live site (parameterise the swift binary with URL + width/height argv).

## Rung 2 — REAL HID events in WKWebView: a measured dead end

`.matilda/probe-flow-dots-wkreal.swift` posts real `CGEvent` mouseMoved at
`.cghidEventTap` aimed at the wave-dot centres (screen coords computed via
`webView.convert(_:to:nil)` + window frame + zero-screen Y-flip). Result:
crowding telemetry listeners recorded `mousemove 0, pointerover 0,
mouseover 0, pointermove 0` — posted HID events produce **zero DOM mouse
events in WKWebView**, tip or no tip, even with
`window.acceptsMouseMovedEvents = true`. So a null tip from this harness
says NOTHING about Safari.app. Do not interpret; do not iterate on it.
(AppKit-side `NSEvent` synthesis / Safari.app UI scripting are the
alternatives if this level of realism is ever necessary; try NSEvent sent
directly via `webView.mouseMoved(with:)` before giving up.)

## Rung 3 — Safari.app introspection is permission-gated

`osascript -e 'tell application "Safari" to do JavaScript …'` fails with
**ERR 8: "You must enable 'Allow JavaScript from Apple Events' in the
Developer section of Safari Settings"**. Toggling that is a user action and
a security-sensitive one — ask, don't flip it by script. Safari version is
checkable without it: `defaults read
/Applications/Safari.app/Contents/Info.plist CFBundleShortVersionString`
(27.0 here; WKWebView on the same Mac shares the WebKit).

## Rung 4 — the instrumented diagnostic page (user drives real Safari)

When every headless rung is green, put the instrumentation IN a copy of the
page and let the user's real browser produce the evidence:

- `.matilda/make-diag-page.mjs` — byte-copies built `index.html`, appends a
  plain `<script>` before `</body>`, writes `.matilda/__safari_diag.html`.
  The script: (1) sends a **`boot` beacon from line one** (with fell-back
  diagnostics in `window.__diagStage` — silent bootstrap failure was the
  first bug we hit: no beacon at all); (2) locates the user's exact dot
  from `window.AUSPOL.flowDrift.polls` (lowest v among `released`
  2026-08), rings it red, records `elementFromPoint` ring tests at
  9 offsets, viewport/DPR/scheme/UA; (3) capture-phase listeners log every
  pointerover/move/click within 32px of the dot centre WITH the live
  hit-test target; (4) polls the actual tip DOM every 80 ms.
- `.matilda/diag-server.mjs` — node static server on :8735 replacing the
  python one (a plain `http.server` cannot take POSTs); persists beacons to
  `.matilda/diag-log.jsonl` (truncate before the user's run). `sendBeacon`
  first, `fetch` fallback.
- Mind probe-process lifetimes: a probe binary that exit(0)s on its own
  completion aborts in-flight beacons — schedule a boot/mid(8s)/final(45s)
  beacon chain and use a harness that stays alive (75 s timeout), or read
  the log before process exit.

Ask the user for ONE minute: open `http://localhost:8735/__safari_diag.html#allpolls`
in Safari, hover the red-ringed dot, leave the tab 50 s. The log then
discriminates: wrong element at point (layout/extension), no events
(overlay/blocker), events but no React handler (engine quirk), handler and
tips fine (user's failure is elsewhere — cache/profile/extension).

### Rung 4, second pass — what the real user run exposed (2026-10-05 pm)

- **The user's verbal coordinates for a chart dot are unreliable — plan
  for self-identification, not confirmation.** "The lowest aug 2026 poll
  dot" then "an earlier august poll, at about −3" identified NO row: the
  payload (`window.AUSPOL.flowDrift.polls`, classic half) has nothing in
  Jul–Aug near −3 except RedBridge/Accent 24–28 Aug v=−3.3, which the user
  rejected as the wrong dot. Before trusting a description, dump the
  payload values headlessly (list-aug-waves / list-jul-waves pattern —
  puppeteer evaluate over `window.AUSPOL`). Then make the page catch the
  dot wherever it is: ring a generous VISUAL WINDOW (July orange, August
  red) and attach pointerenter/leave to EVERY hit circle in BOTH chart
  halves, logging the aria-label — the dead dot names itself in the log.
  Final diag shape: `found` = 17 ringed, `allCount` = 177 logged.
- **Measure `elementFromPoint` rings AFTER `scrollIntoView`, in a
  ~450 ms setTimeout.** elementFromPoint returns null for points outside
  the viewport; the first page measured ring tests pre-scroll and every
  ready-beacon ring came back `null` — a wasted piece of evidence in an
  environment where each user round-trip costs minutes.
- **Throttle move-logging when every dot is instrumented** (one
  pointermove log per 250 ms; mids splice-flush every 8 s; final at 45 s
  caps ~220 events) or 177 watched circles flood the queue.
- **Syntax-check the injected script at GENERATION time** —
  `new Function(inner)` in make-diag-page.mjs. A parse error kills the
  appended script including its own error hook → total silence → you
  spend a user round-trip discovering nothing. Ditto: rewrite the
  generator file cleanly instead of chained edits (two edit sequences in
  this saga mangled strings).
- **Sanity-load the diag page headlessly BEFORE handing it over**
  (`.matilda/sanity-diag.mjs`: headless Chrome loads it, 7 s wait, print
  `window.__diagStage` = `beacon-ok`, then confirm `boot`+`ready` lines in
  diag-log.jsonl). Note the log's tail line is often a `mid` — filter by
  `kind` and by `sid` when reading it back.
- **Identify the user's session in the shared log by UA + sid,** not by
  recency: real Safari = `… AppleWebKit/605.1.15 (KHTML, like Gecko)
  Version/27.0 Safari/605.1.15` (the `Version/` + `Safari/` tokens);
  the WKWebView harness is the SAME webkit build but NO Version token;
  headless Chrome says `HeadlessChrome`. Each page load mints a short
  random `sid`.
- **A GREEN user run in real Safari against localhost is a result, not a
  dead end.** Their Safari hovered every ringed dot with correct tips on
  the byte-identical local build → the code is fine in their engine;
  the remaining variable is what the LIVE server serves THEIR browser:
  stale cache (Safari's normal reload is not a cache bypass —
  Option+Cmd+R "Reload Page From Origin" is; the page's max-age=600 caps
  staleness at 10 min anyway), extensions/profile, or a different target
  page. Next step is a fresh-tab live re-test by the user, plus the
  named dot from the local log.

## Companion facts worth reusing

- Safari 27 2026-10-05 = WebKit 605.1.15 shared with WKWebView; UA of the
  WK harness: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)
  AppleWebKit/605.1.15 (KHTML, like Gecko)`.
- The preceding fix-verify rung already exists and is green:
  `.matilda/probe-flow-drift-dots.mjs` (Chrome, CDP real mouse) —
  see auto-skill-auspol-svg-hover-hit-shadow + auspol-flow-drift-panel for
  the CSS hit-shadow fix this ladder was validating.
