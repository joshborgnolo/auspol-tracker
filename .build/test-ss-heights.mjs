#!/usr/bin/env node
/* test-ss-heights.mjs – pins the menu-page swap flash fix (2026-10-15).

   The page's static article stands in flow under the mounted app: --ss-h
   pulls #root up over it and --app-h clamps it to the app's height. Each
   var used to get its own ResizeObserver, and the browser delivered them
   in separate batches with a paint in between. On a swap to a shorter
   view (flows-explained -> disagreement, 7,900px -> 1,400px) the article
   cap moved while the pull-up still read the old, taller --ss-h; #root's
   negative margin over-ate the article, body's box collapsed to zero
   height for a frame, and the whole viewport drew the html canvas - the
   tide-line art flashing across the screen mid-swap.

   Fix, two homes (both pinned here):
   1. the mount tail of the 73de0c58 asset sets BOTH vars in ONE syncHeights
      callback (scrollHeight reaches the article's natural height through
      the max-height clip, so no second cascade round is needed);
   2. template.html gives #root a one-viewport floor so no settled or
      transient frame can leave the document shorter than the window at
      all (the 640px rung follows the shorter tile band).

   Same family, second fix (2026-10-25): the tide composite lived on bare
   `html`, which paints from stylesheet parse until <body> exists. With no
   body there is no opaque box to mask the art, and the art repeats on BOTH
   axes (that's what fills the overscroll gutter), so a frame landing in
   the parse window drew the whole viewport in tide lines - the "bunch of
   mostly blue lines" flash on some refreshes. The composite now hangs off
   html:has(body), so nothing paints until <body> lands; the 640px
   background-size override carries the same gate.

   Runs after the build in npm test's chain: asserts the sources AND their
   compiled presence in the built documents. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// ---- 1. the mount tail: one callback owns both vars --------------------------------------
const asset = read(path.join(".build", "newtracker", "assets", "73de0c58-f11f-4793-9f90-77e583ab051b.js"));
{
  assert.ok(asset.includes("const syncHeights = () => {"),
    "the mount tail owns a syncHeights callback");
  const fn = asset.slice(asset.indexOf("const syncHeights = () => {"));
  const body = fn.slice(0, fn.indexOf("};"));
  assert.ok(body.includes('setProperty("--app-h", appH + "px")'),
    "syncHeights sets --app-h from the app's height");
  assert.ok(body.includes('setProperty("--ss-h", Math.min(staticSummary.scrollHeight, appH) + "px")'),
    "syncHeights sets --ss-h from min(scrollHeight, app) in the same read");
  const between = body.indexOf('setProperty("--app-h"') < body.indexOf('setProperty("--ss-h"');
  assert.ok(between, "--app-h and --ss-h are written by the same function, same round");
  assert.ok((asset.match(/new ResizeObserver\(syncHeights\)/g) || []).length >= 2,
    "both the article and the app root feed the one callback");
  assert.ok(!asset.includes("setStaticSummaryHeight"),
    "the old per-var setter is gone (no bookmark back to the two-phase update)");
}

// ---- 2. the template floor and its consumers' fallbacks ----------------------------------
const tpl = read(path.join(".build", "newtracker", "template.html"));
{
  assert.ok(tpl.includes("body.js #root { min-height: calc(100vh - 252px); }"),
    "the document never drops below the window (240+12 band)");
  assert.ok(tpl.includes("body.js #root { min-height: calc(100vh - 198px); min-height: calc(100dvh - 198px); }"),
    "the 640px rung follows the shorter band (190+8, vh + dvh twin)");
  {
    // the 198px companion must sit INSIDE a @media (max-width: 640px) block:
    // walking from the block's own open brace to the rule, every other rule
    // is balanced, leaving exactly the media block's brace unclosed
    const rule = tpl.indexOf("body.js #root { min-height: calc(100vh - 198px); min-height: calc(100dvh - 198px); }");
    const media = tpl.lastIndexOf("@media (max-width: 640px) {", rule);
    assert.ok(media >= 0, "a 640px media block opens before the 198px rule");
    const inside = tpl.slice(tpl.indexOf("{", media) + 1, rule);
    assert.equal(
      inside.split("{").length,
      inside.split("}").length,
      "the 198px companion lives inside the 640px band block",
    );
  }
  assert.ok(tpl.includes("margin-top: calc(-1 * var(--ss-h, 0px));"),
    "the pull-up keeps its no-var fallback");
  assert.ok(tpl.includes("max-height: var(--app-h, none);"),
    "the article cap keeps its no-var fallback");
  {
    // the tide composite waits for <body>: a frame painting between
    // stylesheet parse and <body> has no opaque box masking the two-way
    // tiling, so the whole viewport drew tide lines
    const bare = tpl.indexOf("html {\n  --tile-art:");
    assert.ok(bare >= 0, "the tide vars still live on the bare html rule");
    const bareBlock = tpl.slice(bare, tpl.indexOf("}", bare));
    assert.ok(!bareBlock.includes("background-image") && !bareBlock.includes("background-size")
      && !bareBlock.includes("background-position") && !bareBlock.includes("background-repeat"),
      "the bare html rule keeps only vars, the solid tide-ground and the transition");
    const gate = tpl.indexOf("html:has(body) {");
    assert.ok(gate >= 0, "the tide composite is gated on the body's presence");
    const gateBlock = tpl.slice(gate, tpl.indexOf("}", gate));
    assert.ok(gateBlock.includes("background-image:") && gateBlock.includes("background-repeat: no-repeat, repeat, no-repeat;"),
      "the gated rule carries the full tide composite (art still repeating on both axes)");
    assert.ok(tpl.includes("html:has(body) { background-size: 100% 3000px, auto 320px, 100% 180px; }"),
      "the 640px background-size override keeps the same gate");
    assert.ok(tpl.indexOf("html:has(body.dark) {", gate) > 0,
      "the dark override still rides beside the gate");
  }
}

// ---- 3. the fix made the build ------------------------------------------------------------
for (const doc of ["index.html", path.join("vic", "index.html")]) {
  const html = read(doc);
  assert.ok(html.includes("min-height:calc(100vh - 252px)") || html.includes("min-height: calc(100vh - 252px)"),
    `${doc}: the viewport floor compiled in`);
  assert.ok(html.includes("syncHeights"),
    `${doc}: the atomic height sync compiled in`);
  assert.ok(html.includes("html:has(body) {"),
    `${doc}: the tide composite's body gate compiled in`);
}

console.log("PASS: ss-heights – one syncHeights owns --app-h/--ss-h, #root floor at both rungs, fallbacks held, tide composite gated on html:has(body), both builds carry it");
