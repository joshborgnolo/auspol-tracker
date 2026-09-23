---
name: auspol-headless-geometry-verify
description: "auspol-tracker — verifying a layout/spacing fix headlessly in this repo: screenshots are USELESS to the reviewing model (read_file cannot process PNG — no image input), so assert geometry NUMERICALLY via getBoundingClientRect diffs / computedStyle / DOM text inside a puppeteer-core probe instead. Includes the .matilda/probe/*.mjs serve-and-probe skeleton (node:http on an ephemeral port, system Chrome headless: 'new', keep probes untracked). Worked 2026-09-23: house-lean control gap measured 2px, fixed by CSS, re-probed at 12px (77eed98)."
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
