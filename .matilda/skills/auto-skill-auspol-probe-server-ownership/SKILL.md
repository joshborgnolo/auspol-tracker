---
name: auspol-probe-server-ownership
description: when a headless probe (puppeteer) asserts numbers that don't match the tree you just edited — you may be hitting a SQUATTED port's server (a sibling session's dev server or a stale worktree), not yours. Port 8765/8931-style favourites are routinely owned on this machine by lingering python/node servers serving other checkouts. Recipe to prove server ownership before trusting a probe, why python http.server silently breaks Chrome boots, and the SPA goto trap. (Proven twice 2026-11-09/10 in /map/ work.)
source: auto-skill
extracted_at: '2026-11-10T01:09:59.311Z'
---

# Headless probes: prove your server owns the port before trusting an assert

## The failure modes seen live (two sessions, 2026-11-09/10)

1. **Squatted favourite ports.** `python3 -m http.server 8765` reported
   "started" while a sibling session's Python (PID 73863) already owned
   `127.0.0.1:8765` serving ANOTHER directory (a stale worktree). My server
   bound only IPv6 `[::]:8765`. Every probe (and `curl 127.0.0.1`) hit THEIR
   tree — geometry asserts ran against bytes I hadn't edited, passing and
   failing for the wrong reasons. Port 8931 was also already owned by a
   long-lived `node` process. Favourite dev-server ports are hot property
   across sibling Matilda sessions (browser user too).
2. **python `-m http.server` drops Chrome's parallel-fetch sockets**: the
   page stalls with console `ERR_SOCKET_NOT_CONNECTED` → boot never reaches
   app code (`d3 is not defined`, eternal wait-for-selector). Chrome
   pipelines the map page's ~60 data fetches and python's server closes
   mid-load — observed as ~50% boot flake, rebuilding boot attempts hiding
   real failures.
3. **Same-hash SPA goto doesn't re-boot.** `page.goto(sameOrigin + #y=2025…)`
   after a boot on the same path only flipped the hash — the app kept the
   PREVIOUS frame's state, so per-year probes measured the stale frame
   ("2013 lena" showed 2025's 3.5%).

## The recipe

- **Fresh random port, proof of ownership before probing:**
  `python3 -c "import socket;s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1])"`
  → start the server → `lsof -nP -iTCP:<port> -sTCP:LISTEN` must show YOUR
  pid AND `curl -s http://127.0.0.1:<port>/<path-to-file> | md5 -q` ==
  `md5 -q <file>` (the second check is what catches IPv4/IPv6 split
  ownership — the listener table alone can mislead).
- **Serve with `.matilda/serve.mjs`** (node static server, in-repo: `node
  .matilda/serve.mjs <root> <port>`) — keep-alive, content-length, no-store;
  it was written for exactly this python-socket-drop problem. Don't fix the
  flake with retry loops alone; they hide page-error classes.
- **Re-booting an SPA between frame assertions:** `await page.goto("about:blank");
  await page.goto(url)` per year/lens switch (hash-only or query-only gotos
  on the same path leave previous app state live; `waitUntil: networkidle0`
  resolves instantly and your waits hit stale DOM).
- Prober scripts are scratch (`.matilda/probe-*.mjs`, one-off): write, run,
  delete; only port to `.build/map/probe-*.mjs` (the repo's committed live
  probes) when the suite needs the scenario pinned.

Related: auspol-headless-geometry-verify (why asserts must be geometry/DOM
numbers, never screenshots); shell-command-pitfalls (sleep-comment rule when
pacing the deploy).
