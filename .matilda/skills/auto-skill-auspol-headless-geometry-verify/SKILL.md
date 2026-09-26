---
name: auspol-headless-geometry-verify
description: "auspol-tracker — verifying a layout/spacing OR interactivity fix headlessly in this repo: screenshots are USELESS to the reviewing model (read_file cannot process PNG — no image input), so assert geometry NUMERICALLY via getBoundingClientRect diffs / computedStyle / DOM text inside a puppeteer-core probe instead, and drive interactivity via page.mouse.hover / elementFromPoint with state read off classes and cursor style. Includes the .matilda/probe/*.mjs serve-and-probe skeleton (node:http on an ephemeral port, system Chrome headless: 'new', stub window.AP bridge calls, keep probes untracked). Worked 2026-09-23: house-lean control gap measured 2px, fixed by CSS, re-probed at 12px (77eed98); 2026-09-24: undecided dots unclickable — key/query and overlay causes eliminated with probes, catchment grid-walk showed the pick region displaced down-right, rect comparison found .chart wrapper 30px taller than its svg (toVB measured the wrong box; 0c3d9b7). Also 2026-09-24, PAGE-PARITY probing traps (masthead-parity.mjs asserting a satellite == the main page): React style-prop SVG attrs land in style not attributes and CSSOM serialises dasharrays comma-separated (normalise commas or NaN); compare CSS custom properties at the consuming element not :root (dark tokens sit at body.dark on main vs :root on satellites — documentElement reads legitimately differ); third-party embeds (Infogram) never fire load → goto with domcontentloaded; headless Chrome is dark-scheme by default."
source: auto-skill
extracted_at: '2026-09-23T02:20:41.637Z'
---

# Headless layout verification — measure, don't screenshot

Symptom that spawns this: a user reports "X seems too tight / misaligned /
missing" on the live page and the fix is CSS. The natural flow — screenshot
before/after and LOOK at it — does not work in this harness: `read_file`
cannot process PNGs and the agent has no image input. The screenshot files
write fine (`page.screenshot({clip})`); they are simply unreadable. Spend
zero turns on them.

## What works: assert the numbers the screenshot would show

Inside a `page.evaluate`, read geometry directly and return plain numbers:

- **Gaps/alignment** — `getBoundingClientRect()` on the two elements and
  diff the edges: `b2.top - b1.bottom === expected gap`. For wrap/stack
  bugs check `left`/`right` relationships the same way.
- **Computed style** — `getComputedStyle(el).marginTop` etc. confirms WHICH
  rule won (invaluable when a shared class is in play, e.g. the
  `.ap-var-ctl` 2px margin in 77eed98: the value proved the shared rule was
  the culprit before the fix was scoped to `.ap-lean`).
- **Rendered content/state** — textContent of chips/labels, class lists,
  `aria-pressed` (see .matilda/probe/var-default.mjs which verifies the
  Poll-disagreement default view by listing legend chips, not pixels).
- Measure at TWO viewports (`page.setViewport({width: 1280})` and a phone
  rung ~480) — a spacing bug that only wraps at one width is invisible at
  the other.

Then: re-run the SAME probe after the CSS/source change + rebuild and the
asserted numbers must move (2px → 12px). The probe doubles as the
regression check; diffing numbers is also diffable evidence for the user.

## Probe skeleton (repo convention — keep in `.matilda/probe/`, untracked)

```js
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8939;                     // 8935+ seen in use; stay ephemeral
const MIME = { ".html": "text/html", ".js": "text/javascript",
               ".json": "application/json", ".woff2": "font/woff2" /* … */ };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new" });
const page = await browser.newPage();
// …collect console/pageerror, goto, drive the UI, evaluate, close both…
```

Working `.matilda/probe/` examples to copy: `var-default.mjs` (drives the
All-polls tab, asserts chip labels across a toggle) and `lean-spacing.mjs`
(bounding-box gap assertion, two widths). Don't commit them — scratch
verification, and the repo's agents have learned the hard way that stray
builders in `.build/` get swept into other sessions' commits.

## Adjacent gotchas

- Driving the page: click by visible text in `page.evaluate`
  (`[...document.querySelectorAll("button, a")].find(n => /all polls/i.test(n.textContent))`),
  then `page.waitForSelector` the panel — the app mounts async.
- If a check fails against the LIVE site, separate "deploy stale?" from
  "fix wrong?" first (see auspol-live-site-verify) before touching code.

## Page-parity probing traps (masthead-parity.mjs, 2026-09-24)

When the probe compares ANOTHER page's rendering against the main page's
(the satellite masthead had to be byte-identical), three assertions each
cost a probe iteration before they measured the right thing:

- **React SVG props land in `style`, not as attributes.** The main page's
  dial sets `strokeDasharray` via React style prop, so
  `getAttribute("stroke-dasharray")` is `null` while the shell page sets
  the real attribute. Read `el.style.strokeDasharray ||
  el.getAttribute("stroke-dasharray")` — and CSSOM serialises dash arrays
  COMMA-separated (`"10.5, 10.5"`), so `.replace(/,/g, " ")` before
  splitting/parsing or every value is NaN.
- **Compare CSS custom properties at the CONSUMING element, not
  `:root`.** The main page scopes its dark tokens at `body.dark`, the
  satellites at `:root:not(.sh-light)` — documentElement `--alp` read
  light-token on one and dark-token on the other while the actual strokes
  matched. `getComputedStyle(dial).getPropertyValue("--alp")` resolved
  identically on both. Assert tokens where they're used.
- **Third-party embeds stall the `load` event past the nav timeout.**
  The Newspoll archive's Infogram embed never fires `load`, so
  `page.goto(..., {waitUntil: "load"})` dies at
  `TimeoutError: Navigation timeout of 30000 ms exceeded`. Use
  `waitUntil: "domcontentloaded"` on any page with external embeds, then
  a fixed settle `wait` — the lockup/dial assertions don't need `load`.
- Headless Chrome defaults to prefers-color-scheme DARK, and parity
  asserts on both pages are symmetric in dark token values — fine, but
  know which scheme your numbers are in before "fixing" a mismatch.

The working two-page comparator is `.matilda/probe/masthead-parity.mjs`:
one serve-and-probe skeleton, the SAME `page.evaluate` lockup-measurer fn
run against two `browser.newPage()`s (main `/` and `/archives/newspoll/`),
asserting computed font/weight, per-part dial stroke/geometry and
transform-matrix equality plus interaction (`/#story` opens
`.dl-backdrop`).
