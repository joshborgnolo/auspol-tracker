/* test-tide-art.mjs — pins for the tide band's weekly vote-weighted
   recolour (.build/newtracker/tide-art.mjs + its build.mjs wiring).
   Run by npm test, AFTER the federal build — the built-file assertions read
   index.html and assets/tile-art*.svg as the build just wrote them.

   Semantics under test (user call 2026-10-25): the COLOUR SHUFFLE re-rolls
   weekly (Sydney ISO week seed; the first build after Monday 12am picks up
   the new draw), while the proportions track the current latest.primary at
   every build. What must never happen within a week on unchanged weights:
   a different layout — that would churn the 43KB art lines across same-week
   rebuilds and the html/asset-file copies apart. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractTide, isoWeekSeed, assignLines, rewriteTideArt } from "./newtracker/tide-art.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const TEMPLATE = read(".build/newtracker/template.html");

/* today's live primary shares, as build.mjs reads them off latest.primary */
const W = { alp: 26.7, lnp: 22.4, grn: 13.6, onp: 26.0, oth: 11.2 };

/* ---- 1. extraction from the committed template art ---------------------- */
{
  const t = extractTide(TEMPLATE);
  assert.equal(t.ds.length, 30, "30 traces");
  assert.deepEqual(t.light, { oth: "#66779b", alp: "#d99a8e", lnp: "#8ba6d6", grn: "#93bf9b", onp: "#e0a878" },
    "the light washed palette, read off the committed art");
  assert.deepEqual(t.dark, { oth: "#7586ab", alp: "#a96559", lnp: "#5d7aaf", grn: "#578861", onp: "#a76b32" },
    "the dark washed palette, read off the committed art");
  assert.ok(t.head.includes("viewBox='0 0 1200 480'"), "the 1200×480 art shell");
}
/* a byte-mangled blob must trip the guard, not recolour quietly (the blob
   is stored percent-encoded, so the corruption lands in encoded form) */
assert.throws(() => extractTide(TEMPLATE.replace("%2366779b", "%2366779c")), /tide-art/);

/* ---- 2. the weekly seed ------------------------------------------------- */
assert.equal(isoWeekSeed(new Date("2026-10-25T12:00:00Z")), 202643, "Sun 25 Oct 23:00 AEDT is still ISO week 43");
assert.equal(isoWeekSeed(new Date("2026-10-25T13:00:00Z")), 202644, "Mon 26 Oct 00:00 AEDT rolls the week — the Monday-12am boundary");
assert.equal(isoWeekSeed(new Date("2026-10-20T00:00:00Z")), 202643, "mid-week keeps the seed");
assert.equal(isoWeekSeed(new Date("2027-01-03T13:00:00Z")), 202701, "year boundary (Mon 4 Jan 2027 00:00 AEDT) opens 2027-W01");

/* ---- 3. the draw --------------------------------------------------------- */
assert.deepEqual(assignLines(W, 202644),
  ["lnp", "lnp", "lnp", "onp", "lnp", "alp", "grn", "onp", "alp", "lnp",
   "onp", "alp", "grn", "onp", "grn", "oth", "alp", "alp", "alp", "onp",
   "lnp", "alp", "onp", "grn", "onp", "onp", "oth", "lnp", "oth", "onp"],
  "golden: week 202644's draw at the live shares");
assert.notDeepEqual(assignLines(W, 202643), assignLines(W, 202644), "the shuffle re-rolls across the boundary");
assert.equal(assignLines(undefined, 202644), null, "no weights at all keeps the template art");
assert.equal(assignLines(null, 202644), null);
assert.equal(assignLines({ alp: 0 }, 202644), null, "zero shares keep the template art");
assert.equal(assignLines({ alp: 0, lnp: null, grn: undefined, onp: NaN, oth: -3 }, 202644), null,
  "absent/null/NaN/negative shares all count as 0");
assert.ok(assignLines({ alp: 100 }, 202644).every((p) => p === "alp"), "a 100% share paints every trace");
assert.ok(assignLines({ oth: 100 }, 202644).every((p) => p === "oth"));
assert.ok(new Set(assignLines({ lnp: 100, grn: Infinity, onp: NaN, oth: null }, 202644)).size === 1
  && assignLines({ lnp: 100, grn: Infinity, onp: NaN, oth: null }, 202644)[0] === "lnp",
  "non-finite shares are 0, the one finite share wins every trace");
{ // Vic-shaped object: a party absent from the key set (folded into others)
  const lines = assignLines({ alp: 26.7, lnp: 22.4, grn: 13.6, oth: 37.3 }, 202644);
  assert.equal(lines.length, 30);
  assert.ok(!lines.includes("onp") && lines.every((p) => ["alp", "lnp", "grn", "oth"].includes(p)),
    "a missing key draws nothing and never crashes");
}
{ // shares need not sum to 100 (rounding leaves 99.9): they renormalise
  const lines = assignLines({ alp: 26.7, lnp: 22.4, grn: 13.6, onp: 26.0, oth: 11.1 }, 202644);
  assert.equal(lines.length, 30);
}
{ // 520 consecutive weeks: the long-run colour share IS the primary share
  const n = 520, c = { alp: 0, lnp: 0, grn: 0, onp: 0, oth: 0 };
  for (let s = 202600; s < 202600 + n; s++) for (const p of assignLines(W, s)) c[p]++;
  for (const k of Object.keys(c)) {
    const share = (100 * c[k]) / (n * 30);
    assert.ok(Math.abs(share - W[k]) < 1.5, `${k}: 520-week mean ${share.toFixed(2)} within 1.5pt of ${W[k]}`);
  }
}

/* ---- 4. rewrite: determinism, week roll, splice fidelity ---------------- */
{
  const same1 = rewriteTideArt(TEMPLATE, W, new Date("2026-10-20T00:00:00Z"));
  const same2 = rewriteTideArt(TEMPLATE, W, new Date("2026-10-25T12:00:00Z"));
  assert.equal(same1.html, same2.html, "same ISO week + same weights: byte-identical rebuilds (no same-week churn)");
  assert.equal(same1.svgLight, same2.svgLight);
  const next = rewriteTideArt(TEMPLATE, W, new Date("2026-10-25T13:00:00Z"));
  assert.notEqual(next.html, same1.html, "the first Monday-midnight build re-shuffles");
  for (const out of [same1, next]) {
    assert.ok(out.html.includes("--tile-art: url(\"data:image/svg+xml,"), "the spliced var still parses as css");
    assert.ok(!out.html.includes("--tile-art: url(\"data:image/svg+xml,undefined"), "no undefined splice");
    const paths = (out.svgLight.match(/<path/g) || []).length;
    assert.equal(paths, 30, "30 traces in the light art");
    const lightStrokes = new Set([...out.svgLight.matchAll(/stroke='(#[0-9a-f]{6})'/g)].map((m) => m[1]));
    const pal = extractTide(TEMPLATE).light;
    for (const s of lightStrokes) assert.ok(Object.values(pal).includes(s), `stroke ${s} is a washed palette colour`);
    // light and dark carry THE SAME draw: trace-by-trace the same party
    const sameShape = out.svgLight.replace(/#[0-9a-f]{6}/g, "@") === out.svgDark.replace(/#[0-9a-f]{6}/g, "@");
    assert.ok(sameShape, "light and dark geometry identical (same party per trace, themed)");
  }
  assert.equal(rewriteTideArt(TEMPLATE, null).html, TEMPLATE, "a null draw leaves the template untouched");
  assert.equal(rewriteTideArt(TEMPLATE, null).svgLight, null);
}

/* ---- 5. the build carried it — fresh index.html + satellite files --------
   (npm test runs build.mjs before this file.) */
{
  const built = read("index.html");
  const grab = (html, v) => decodeURIComponent(html.match(
    new RegExp(v.replace(/-/g, "\\$&") + ": url\\(\"data:image/svg\\+xml,(.*?)\"\\);"),
  )[1]);
  const inlineLight = grab(built, "--tile-art"), inlineDark = grab(built, "--tile-art-dark");
  assert.equal((inlineLight.match(/<path/g) || []).length, 30, "built index.html: 30 light traces");
  assert.equal((inlineDark.match(/<path/g) || []).length, 30, "built index.html: 30 dark traces");
  const lightFile = read("assets/tile-art.svg").trim(), darkFile = read("assets/tile-art-dark.svg").trim();
  assert.equal(inlineLight, lightFile, "the satellite /assets/tile-art.svg carries the same art as the page");
  assert.equal(inlineDark, darkFile, "the satellite /assets/tile-art-dark.svg carries the same art as the page");
  const expected = rewriteTideArt(TEMPLATE, null); // geometry oracle: the template's own traces
  assert.ok(expected.svgLight == null);            // documents the null-draw fallback
  const t = extractTide(TEMPLATE);
  const ds = (svg) => [...svg.matchAll(/<path d='([^']+)'/g)].map((m) => m[1]).join("");
  assert.equal(ds(inlineLight), t.ds.join(""), "the built art still draws the committed wave geometry");
}

console.log("PASS: tide-art — extraction guards, Sydney ISO-week seed (Monday-12am roll), null/zero/non-finite weight rules, golden draw, within-week determinism, built page + satellite files share the one art");
