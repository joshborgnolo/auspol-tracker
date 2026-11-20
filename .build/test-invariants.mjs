#!/usr/bin/env node
/* test-invariants.mjs – pins the six 2026-10-13 audit fixes that guard silent
   data/display degradation (S2/T4/T5/T6/T7/T8 in the audit; T8's build half
   is an np-project source grep). Every assertion here failed (or could have)
   before its fix landed; none of them drift with new data — each has the
   structural property pinned, not a figure.

   Runs after the build in npm test's chain (it reads the built documents
   and the committed data/emitters). */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// ---- the data bundle, evaluated -----------------------------------------------------------
const assetDir = path.join(ROOT, ".build", "newtracker", "assets");
const bundleName = fs.readdirSync(assetDir).find((f) => f.startsWith("9f09dca2-") && f.endsWith(".js"));
assert.ok(bundleName, "the 9f09dca2 data asset exists");
const sandbox = {};
{
  const src = read(path.join(".build", "newtracker", "assets", bundleName));
  assert.ok(src.includes("window.AUSPOL = ("), "the data asset keeps its window.AUSPOL wrapper");
  const window = sandbox;                       // the bundle assigns onto `window`
  eval(src);                                    // local-only, repo-generated code
  sandbox.AUSPOL = window.AUSPOL;
}
const A = sandbox.AUSPOL;
assert.ok(A && typeof A === "object" && A.cycles, "the data bundle evaluates to a window.AUSPOL object");

function walkNumber(v, label) {
  assert.ok(typeof v === "number" && Number.isFinite(v), `${label}: finite number expected`);
}

// ---- T4: no cycle line may outrun its term ----------------------------------------------
/* A cycle's drawn line used to stop at a flat 36 months while endRes ringed
   the closing election past it (1998/2004/2010 ran 36.5–37.5). gen-data now
   caps a term at its own length: series carry every month from 0 through
   the integer `span`, and the closing election ring (endRes.x, fractional)
   sits within half a month of the line's last point — never ~1.5 months
   past where the line stopped. */
assert.ok(A.cycles && A.cycles.length >= 10, "the cycles array is populated");
for (const c of A.cycles) {
  assert.ok(Number.isInteger(c.span) && c.span > 0, `cycle ${c.year}: integer month span`);
  assert.ok(c.points && Array.isArray(c.points.tpp) && Array.isArray(c.points.primary),
    `cycle ${c.year}: the two-party and primary lines are present`);
  for (const id of ["tpp", "primary"]) {
    const s = c.points[id];
    assert.equal(s[0].x, 0, `cycle ${c.year} ${id}: the line starts at the term's opening`);
    assert.equal(s[s.length - 1].x, c.span, `cycle ${c.year} ${id}: the line runs the term's full length`);
    for (const p of s) walkNumber(p.y, `cycle ${c.year} ${id} y`);
  }
  if (c.current) continue;                      // no closing election yet
  assert.ok(Number.isFinite(c.endRes?.x), `cycle ${c.year}: endRes.x is finite`);
  assert.ok(c.endRes.x - c.span < 1.0,
    `cycle ${c.year}: closing election ring sits by the line's end (endRes.x ${c.endRes.x} vs span ${c.span})`);
}

// ---- T5: no pooled figure may be NaN/±Infinity -------------------------------------------
/* The by-band firm/other pools divided by a zero total weight and emitted
   NaN v/ci95 into the bundle, which the panel then rendered literally. Every
   aggregate-emitted figure is now guarded and must stay finite (when the
   measure exists for that cohort at all). */
{
  const f = A.firmness;
  assert.ok(f && f.now && f.base, "the firmness block is present");
  for (const [era, blk] of Object.entries({ now: f.now, base: f.base }))
    for (const [k, rec] of Object.entries(blk)) {
      if (k === "from" || k === "to") continue;
      walkNumber(rec.n, `firmness.${era}.${k}.n`);
      if (rec.v == null) continue;              // absent cohort, absent figure — fine
      walkNumber(rec.v, `firmness.${era}.${k}.v`);
      walkNumber(rec.ci95, `firmness.${era}.${k}.ci95`);
      assert.ok(rec.v >= 0 && rec.v <= 100, `firmness.${era}.${k}.v is a share`);
    }
  assert.ok(A.issues && Array.isArray(A.issues.list) && A.issues.list.length >= 5,
    "the issues list is populated");
  for (const it of A.issues.list) {
    if (it.imp != null) {                       // salience read is pooled only where two houses agree on a question
      assert.ok(Number.isFinite(it.imp.v) && Number.isFinite(it.imp.ci),
        `issue ${it.id}: salience v/ci are finite when present`);
      if (it.imp.by != null)
        for (const r of it.imp.by) walkNumber(r.v, `issue ${it.id} salience wave`);
    }
    assert.ok(it.own && typeof it.own === "object", `issue ${it.id}: ownership pooled`);
    for (const k of ["alp", "lnp", "onp"]) {
      walkNumber(it.own.v[k], `issue ${it.id} own ${k}`);
      walkNumber(it.own.ci[k], `issue ${it.id} own ${k} ci`);
      assert.ok(it.own.v[k] >= 0 && it.own.v[k] <= 100, `issue ${it.id} own ${k} is a share`);
    }
    walkNumber(it.own.gap, `issue ${it.id} lead gap`);
    assert.ok(["alp", "lnp", "onp"].includes(it.own.lead), `issue ${it.id}: a named owner leads`);
    // the What-matters trend view's line and dots ride the same row
    if (it.imp != null) {
      assert.ok(Array.isArray(it.salMonthly) && it.salMonthly.length >= 2,
        `issue ${it.id}: a current salience estimate has its monthly line`);
      assert.ok(Array.isArray(it.salDots) && it.salDots.length >= 2,
        `issue ${it.id}: a current salience estimate has its poll dots`);
    }
    if (it.salMonthly != null) {
      const yms = it.salMonthly.map((m) => m[0]);
      assert.deepEqual(yms, [...yms].sort(), `issue ${it.id} salMonthly months run in order`);
      for (const [ym, v, ci] of it.salMonthly) {
        assert.ok(/^\d{4}-\d{2}$/.test(ym), `issue ${it.id} salMonthly month key ${ym}`);
        walkNumber(v, `issue ${it.id} salMonthly v`);
        walkNumber(ci, `issue ${it.id} salMonthly ci`);
        assert.ok(v >= 0 && v <= 100 && ci > 0, `issue ${it.id} salMonthly share and interval are sane`);
      }
      for (const [x, house, date, v, n] of it.salDots) {
        /* the verbatim poll name, so the client can join the dot to its
           archive row by pollster|released */
        assert.ok(typeof house === "string" && house.length > 2 && !/^\(/.test(house), `issue ${it.id} salDot names its pollster`);
        assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(date), `issue ${it.id} salDot wave date`);
        walkNumber(v, `issue ${it.id} salDot share`);
        assert.ok(v >= 0 && v <= 100 && n > 0, `issue ${it.id} salDot share and n are sane`);
      }
    }
  }
  assert.ok(Array.isArray(A.direction) && A.direction.length >= 10,
    "the direction series is populated");
  for (const d of A.direction) {
    if (d.unsure == null) continue;
    assert.ok(d.unsure >= 0 && d.unsure <= 100,
      `direction ${d.date}: unsure ${d.unsure} is a floored share, never negative`);
  }
}

// ---- T6: the feed never leaks machine vocabulary -----------------------------------
/* feed.xml's bits() folds YouGov's community-strong[-australia] machine
   codes into OTH (summing), drops und/dnr residue cells, and the item body
   never prints "L/NP null" for a one-sided share2pp row. The residue-cell
   patterns need cell context – the printed cohort label "2025 dnr voters
   now:" and the sentence "Undecided 4%." are legitimate copy that must not
   trip these greps. */
{
  const feed = read("feed.xml");
  assert.ok(!feed.includes("community-strong"),
    "no community-strong machine codes in the feed");
  assert.ok(!feed.includes("L/NP null"),
    "no 'L/NP null' complement placeholder in the feed");
  const cellLeak = feed.match(/[ ·](?:und|dnr) [0-9]+(?:[ ·<]|$)/) || [];
  assert.equal(cellLeak.length, 0,
    `no und/dnr figure cells leak into the feed (found ${cellLeak.length}: ${cellLeak[0] || ""})`);
  assert.ok(feed.includes("Ind/Oth"), "the top-line Ind/Oth cell is printed");
  assert.ok(/[ ·]OTH [0-9]+/.test(feed),
    "cohort lines print their OTH cell (the feed's party vocabulary)");
  assert.ok(/Undecided [0-9.]+%\./.test(feed),
    "the printed 'Undecided N%.' sentence survives (a clause, not a cell)");
  assert.ok(feed.includes("2025 dnr voters now:"),
    "the didn't-vote cohort keeps its printed group label");
}

// ---- T7: the changelog page is a full-share citizen ---------------------------------------
{
  const ch = read(path.join("changelog", "index.html"));
  assert.ok(ch.includes('<html lang="en-AU">'), "changelog/ declares en-AU like the other documents");
  for (const tag of [
    '<meta property="og:site_name" content="auspoltracker.com">',
    '<meta property="og:locale" content="en_AU">',
    '<meta property="og:url" content="https://auspoltracker.com/changelog/">',
    '<meta property="og:image" content="https://auspoltracker.com/assets/auspol-card.png?v=',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:alt"',
    '<meta name="twitter:card" content="summary_large_image">',
  ])
    assert.ok(ch.includes(tag), `changelog/ carries ${tag.slice(0, 60)}`);
  assert.ok(read("sitemap.xml").includes("<loc>https://auspoltracker.com/changelog/</loc>"),
    "the sitemap lists /changelog/");
  const head = read("index.html");
  assert.ok(head.includes('<meta property="og:image:alt"'),
    "the federal document keeps its own og:image:alt twin");
}

// ---- T8: the Next-polls projection never mutates its shared memoised rows ----------------
/* npProject memoises byDate/wk rows by cadence key and the panel used to
   trim the returned array in place; the pin is on the plain-layer source:
   a handed-out array is sliced, never length-trimmed. */
{
  const np = read(path.join(".build", "newtracker", "assets", "np-project.js"));
  assert.ok(!/rows\.length\s*=\s*Math\.min/.test(np),
    "np-project.js never trims a handed-out rows array in place");
  assert.ok(np.includes(".slice("),
    "the projection hands out sliced copies");
}

// ---- T9: every past poll row says what its shares are of ---------------------------------
/* The source-polls download carried five party columns, so a 1958–87 row whose
   DLP or Democrats rode their own lane read short of 100 – as if undecideds
   were mixed in – and the validator skipped any row with no Greens or One
   Nation figure, which hid three typos and 13 short Morgan rows (2026-11-20).
   Pinned: in gen-data's cycle-source rows, a row with a remainder to total
   adds to 100 within rounding once its dlp/dem/und lanes count, or carries
   `sum`; an `und` row is beyond rounding and its term names the house's
   declared reason; and the download's columns carry those lanes. */
{
  const src = JSON.parse(read(path.join(".build", "newtracker", "assets", "cycle-source.json")));
  const LANES = ["alp", "lnp", "grn", "onp", "oth", "dlp", "dem"];
  let rows = 0, und = 0, dem = 0, dlp = 0;
  for (const [year, term] of Object.entries(src)) {
    for (const p of term.polls) {
      if (p.firm === "Election" || p.alp == null || p.lnp == null) continue;
      if (p.oth == null && p.dlp == null && p.dem == null && (p.grn == null || p.onp == null)) continue;
      rows++;
      if (p.dem != null) dem++;
      if (p.dlp != null) dlp++;
      const sum = LANES.reduce((s, k) => s + (p[k] ?? 0), 0);
      const where = `cycle-source ${year} ${p.date} ${p.firm}`;
      if (p.und != null) {
        und++;
        assert.ok(p.und > 2 && Math.abs(sum + p.und - 100) < 0.05, `${where}: und ${p.und} completes a row short of 100 beyond rounding (Σ ${sum})`);
        assert.ok(term.notes && term.notes[p.firm], `${where}: an undecided row's term names the house's declared basis`);
      } else if (p.sum != null) {
        assert.ok(Math.abs(p.sum - sum) < 0.05 && Math.abs(sum - 100) > 2, `${where}: sum ${p.sum} is the row's own total, off 100 beyond rounding`);
      } else {
        assert.ok(Math.abs(sum - 100) <= 2, `${where}: shares add to ${sum} with no und or sum to say why`);
      }
    }
  }
  assert.ok(rows > 3000 && und > 50 && dem > 50 && dlp > 50, `the past rows carry their lanes (${rows} rows, ${und} undecided, ${dem} Democrats, ${dlp} DLP)`);
  const tabs = read(path.join(".build", "newtracker", "assets", "d1a1d215-370c-4ebc-878b-7eeea9ad8102.js"));
  assert.ok(tabs.includes('"primary_dlp", "primary_dem", "primary_undecided", "primary_note",'), "the source-polls header ends with the four base columns");
  assert.ok(tabs.includes("p.dlp ?? null, p.dem ?? null, p.und ?? null, pastNote(p, src),"), "each past voting-intention row fills them");
}

console.log(`PASS: invariants – ${A.cycles.length} cycles inside their caps, finite-figure sweep, feed vocabulary, changelog tags, np-project purity, past rows' bases`);
