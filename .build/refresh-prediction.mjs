#!/usr/bin/env node
/* /prediction/ page generator.
 *
 * Runs the re-election suite's snapshot/hazard model (the best of the
 * .build/analysis constructions) against current origin/main data, records
 * the read in data/prediction-history.json, and regenerates
 * prediction/index.html (a GENERATED file — do not hand-edit; the Morgan
 * archive pattern). Called every CI day by .build/prediction-refresh.sh but
 * only acts on FORTNIGHTLY due dates anchored at 2026-09-19 (plus forced
 * runs), so each recompute is one dated record in the page's reading
 * selector. Numbers are composed here, once: the page is a dumb renderer
 * that swaps pre-composed strings per record.
 *
 * Cadence: ANCHOR + 14-day intervals (Sydney dates). The scheduled wrapper
 * runs this with --if-due; `bash .build/prediction-refresh.sh` locally or a
 * workflow_dispatch forces with --force.
 *
 * Usage: node .build/refresh-prediction.mjs [--if-due] [--force]
 *          [--as-of=YYYY-MM-DD] [--age=N.N] [--dry]
 * Prints a final PRED_STATUS {...} line for the wrapper.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// ---------- cadence + term constants -------------------------------------
const ELECTION_DATE = "2025-05-03";       // Albanese-2025 term start
const SPAN_MONTHS = 36.5;                 // must match the hazard script's curSpan
const ANCHOR = "2026-09-19";              // first scheduled recompute (user-set)
const INTERVAL_DAYS = 14;
const ELEC2PP_2025 = 55.2;                // ALP 2PP at the 2025 election (AEC)
const HISTORY_FILE = "data/prediction-history.json";
const PAGE = "prediction/index.html";
const BUILD = ".build/newtracker/build.mjs";

// ---------- Sydney-date helpers (no external deps) -----------------------
const DAY = 864e5;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const sydneyToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dayMs = (d) => Date.parse(d + "T00:00:00Z");
const daysBetween = (a, b) => Math.round((dayMs(b) - dayMs(a)) / DAY);
const addDays = (d, n) => { const t = new Date(dayMs(d) + n * DAY); return t.toISOString().slice(0, 10); };
const dateLabel = (d) => { const [y, m, dd] = d.split("-").map(Number); return `${dd} ${MONTHS[m - 1]} ${y}`; };
const dateShort = (d) => { const [y, m, dd] = d.split("-").map(Number); return `${dd} ${MONTHS[m - 1].slice(0, 3)} ${y}`; };
const nextDue = (asOf) => daysBetween(ANCHOR, asOf) < 0 ? ANCHOR
  : addDays(ANCHOR, Math.ceil((daysBetween(ANCHOR, asOf) + (daysBetween(ANCHOR, asOf) % INTERVAL_DAYS === 0 ? 1 : 0)) / INTERVAL_DAYS) * INTERVAL_DAYS);
const isDue = (asOf) => { const d = daysBetween(ANCHOR, asOf); return d >= 0 && d % INTERVAL_DAYS === 0; };

// ---------- CLI ----------------------------------------------------------
const argv = process.argv.slice(2);
const FLAG = (n) => argv.includes("--" + n);
const ARGV = (n) => { const a = argv.find((x) => x.startsWith("--" + n + "=")); return a ? a.slice(n.length + 3) : null; };
const asOf = /^\d{4}-\d{2}-\d{2}$/.test(ARGV("as-of") || "") ? ARGV("as-of") : sydneyToday();
const ageOverride = ARGV("age") ? +ARGV("age") : null;
const force = FLAG("force"), ifDue = FLAG("if-due"), dry = FLAG("dry");

let age = +(daysBetween(ELECTION_DATE, asOf) / 30.4375).toFixed(1);
if (ageOverride != null) age = ageOverride;
if (age > 33.5) { console.error(`WARN age ${age} exceeds the 33.5-month final-read point — clamping (term nearing end; revisit this generator)`); age = 33.5; }

if (ifDue && !force && !isDue(asOf)) {
  console.log(`PRED_STATUS ${JSON.stringify({ due: false, ran: false, asOf, nextDue: nextDue(asOf) })}`);
  process.exit(0);
}

// ---------- run the models (read-only; they git-show origin/main data) ---
const run = (file, args) => JSON.parse(execFileSync("node", [file, ...args, "--json"], { encoding: "utf8", maxBuffer: 1 << 26 }));
const hz = run(".build/analysis/reelect-snapshot-hazard.mjs", [`--age=${age}`]);
const rg = run(".build/analysis/reelect-term-ridge.mjs", []);
const ridgeP = +rg.liveP.toFixed(4);

const r4 = (x) => +x.toFixed(4);
const record = {
  asOf, age,
  ousted: { median: hz.ousted.median, lo: hz.ousted.lo, hi: hz.ousted.hi, shareOuster: hz.ousted.shareOuster },
  inSample: hz.inSample,
  features: { pmNet: r4(hz.features.pmNet), ppm: r4(hz.features.ppm), primSw: r4(hz.features.primSw), tppSw: r4(hz.features.tppSw), govAge: hz.features.govAge, ageFrac: hz.features.ageFrac },
  ridge: { liveP: ridgeP, window: rg.window },
};
const profile = hz.profile;   // 13 completed terms: { y, ousted, span, finAge, bands:{..,"fin"} }

// ---------- history: load, replace-or-append this date's record, sort ----
let hist;
try { hist = JSON.parse(readFileSync(HISTORY_FILE, "utf8")); } catch { hist = null; }
if (!hist || !Array.isArray(hist.records)) {
  hist = { model: "reelect-snapshot-hazard + reelect-term-ridge cross-check", generatedBy: ".build/refresh-prediction.mjs", election: "2025-05-03", spanMonths: SPAN_MONTHS, records: [] };
}
const iOld = hist.records.findIndex((r) => r.asOf === asOf);
if (iOld >= 0) hist.records.splice(iOld, 1);
hist.records.push(record);
hist.records.sort((a, b) => (a.asOf < b.asOf ? -1 : 1));

// ---------- display composition (single source of truth for the page) --
const pct = (x) => Math.round(x * 100);
const MINUS = "−";
const s0 = (x) => (x < 0 ? MINUS : "") + Math.abs(x).toFixed(0);
const s1 = (x) => (x < 0 ? MINUS : "") + Math.abs(x).toFixed(1);
const sp0 = (x) => (x < 0 ? MINUS : x > 0 ? "+" : "") + Math.abs(x).toFixed(0);
const sp1 = (x) => (x < 0 ? MINUS : x > 0 ? "+" : "") + Math.abs(x).toFixed(1);
const ORD = [null, "1st", "2nd", "3rd", "4th", "5th", "6th"];
const BANDS = [6, 12, 15, 18, 24, 30];
const bandNear = (age) => BANDS.reduce((a, b) => (Math.abs(b - age) < Math.abs(a - age) ? b : a));
const bandRead = (t, band) => (t.bands[String(band)] != null ? t.bands[String(band)] : t.bands.fin);
const joinL = (xs) => xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1];

// Everything the page needs to say for one record. Recomposed for every
// record at every run — the history file keeps bare numbers, wording live here.
function compose(rec) {
  const o = rec.ousted, f = rec.features, age = rec.age;
  const rPct = pct(1 - o.median), loPct = pct(1 - o.hi), hiPct = pct(1 - o.lo);
  const winShare = 100 - pct(o.shareOuster);
  const band = bandNear(age);
  const losers = profile.filter((t) => t.ousted === 1).map((t) => bandRead(t, band));
  const winners = profile.filter((t) => t.ousted === 0).map((t) => bandRead(t, band));
  const minL = Math.min(...losers), maxW = Math.max(...winners), minW = Math.min(...winners);
  const inS = rec.inSample;

  const feat1 = f.pmNet <= -0.5
    ? `Voters disapprove of Albanese by a net margin of about ${Math.abs(f.pmNet).toFixed(0)} points. On its own that is a historically bad level — the four defeated governments all carried numbers like this, and a model that looks only at levels does in fact read this term worse than the typical loser.`
    : f.pmNet >= 0.5
      ? `Voters approve of Albanese by a net margin of about ${f.pmNet.toFixed(0)} points — a healthier level than any of the four defeated governments carried at this point.`
      : `Voters are net evenly split on Albanese — unremarkable territory for a government at this age.`;
  const feat2 = f.ppm >= 0.5
    ? `Albanese still leads the opposition leader by about ${f.ppm.toFixed(0)} points as preferred prime minister. Governments that lose usually lose the leadership question as well as the vote.`
    : f.ppm <= -0.5
      ? `The opposition leader has moved ahead of Albanese by about ${Math.abs(f.ppm).toFixed(0)} points as preferred prime minister. Governments that lose usually lose the leadership question as well as the vote — this one currently trails on both.`
      : `Preferred prime minister is essentially tied. Governments that lose usually lose the leadership question as well as the vote.`;
  const feat3 = f.primSw < 0
    ? `Labor’s primary is running about ${Math.abs(f.primSw).toFixed(1)} points under its election vote — a standard post-election fade, not a collapse, on this record.`
    : f.primSw > 0
      ? `Labor’s primary is running about ${f.primSw.toFixed(1)} points over its election vote — a halo the ousted terms rarely enjoyed.`
      : `Labor’s primary is running exactly at its election vote.`;
  const tppLvl = +(ELEC2PP_2025 + f.tppSw).toFixed(1);
  const feat4 = tppLvl > 50.5
    ? `The government remains narrowly in front on two-party preferred — about ${tppLvl.toFixed(1)} versus 55.2 at the election, ${Math.abs(f.tppSw).toFixed(1)} points off its election pace.`
    : tppLvl >= 47.5
      ? `Two-party preferred is essentially level — about ${tppLvl.toFixed(1)} versus 55.2 at the election.`
      : `The government is behind on two-party preferred — about ${tppLvl.toFixed(1)} versus 55.2 at the election — and every beaten government was underwater here by now.`;
  const feat5 = `This is the ${ORD[f.govAge] || f.govAge + "th"} consecutive Labor term. More than any single poll, age sorts the fates: no first-term government on this record has been voted out, and the four that fell were in their second, third, fourth and fifth terms.${f.govAge === 2 ? " The Gillard government was ousted at exactly this age." : ""}`;

  const qual = inS < minL ? "below every eventual loser’s read"
    : inS <= maxW ? "inside the survivors’ range" : "above the range survivors have ever worn and won anyway";
  const loserList = joinL(losers.map(pct)), winLo = pct(minW), winHi = pct(maxW);

  const sickSentence = inS < minL
    ? "three of the four governments that eventually fell already looked markedly sicker than this one at the same age."
    : inS <= maxW
      ? "at the same age this term reads like the terms that survived rather than the four that fell."
      : "at the same age this term reads sicker than most of the nine that survived — and sicker than some that fell.";
  const blendBits = [
    f.pmNet <= -0.5 ? "bad approval levels" : f.pmNet >= 0.5 ? "healthy approval levels" : "approval split down the middle",
    f.primSw < -0.5 ? "but an ordinary post-election fade" : f.primSw > 0.5 ? "and no post-election fade at all" : "and a vote holding at its election mark",
    f.ppm >= 0.5 ? "with a live preferred-PM cushion" : f.ppm <= -0.5 ? "without any preferred-PM cushion" : "with the leadership question tied",
    f.govAge <= 2 ? "in a young government" : null,
  ].filter(Boolean).join(", ");
  const blendTail = inS < minL
    ? "That is why the model lands well short of alarm — the terms that fell looked far sicker than this by the same month."
    : inS <= maxW
      ? "The model’s read is unremarkable — the historical company of terms that survived."
      : "That is alarm territory by this record’s standards.";

  return {
    sub: `A statistical model trained on the polling record of every completed federal term since 1987 reads the signature of Albanese’s second term, about ${Math.round(age)} months in — as at ${dateLabel(rec.asOf)}.`,
    fig: String(rPct),
    figAria: `Modelled chance of re-election: median ${rPct} per cent, inside a ten-to-ninety per cent range of ${loPct} to ${hiPct} per cent, on a zero to one hundred scale.`,
    note: `The band is the model’s honest disagreement with itself: re-fit on three hundred reshuffles of the historical record, the middle of its answers — the ten-to-ninety per cent range — runs from ${loPct} to ${hiPct} per cent. In ${winShare} per cent of those re-fits the call is re-election. The rest call defeat.`,
    what2: `The honest part of the answer is the width of the band. Thirteen terms and four defeats is a thin history, so the genuine range runs from an uncomfortable ${loPct} to a comfortable ${hiPct} per cent. What the record can say clearly is which company this term keeps: ${sickSentence}`,
    f1l: sp0(f.pmNet), f1: feat1,
    f2l: sp0(f.ppm), f2: feat2,
    f3l: s1(f.primSw), f3: feat3,
    f4l: s1(f.tppSw), f4: feat4,
    f5l: `${ORD[f.govAge] || f.govAge + "th"} term`, f5: feat5,
    blend: `The blend is the point: ${blendBits}. ${blendTail}`,
    nowRow: `reads ${pct(inS)}% at ${age} months — ${qual} (losers’ month-${band} reads: ${loserList} per cent; survivors’ worst: ${winHi} per cent there)`,
    bandIntro: `The column that matters today is month ${band} — the yardstick nearest this term’s age of ${age} months.`,
    bandCompare: `The four eventual losers read ${loserList} per cent there, the nine winners ran from ${winLo} to ${winHi} — and the current term read ${pct(inS)} at that age.`,
    ridgeCell: `p(ousted) = ${rec.ridge.liveP.toFixed(2)} → predict ${rec.ridge.liveP < 0.5 ? "re-elected" : "ousted"}${age > 18.5 ? " (first-16-months yardstick — its window is now closed)" : ""}`,
    ridgeCell2: `reads p(ousted) = ${rec.ridge.liveP.toFixed(2)} — ${rec.ridge.liveP < 0.5 ? "same verdict, well short of alarm" : "in ousted territory too"}${age > 18.5 ? " (its window is now closed)" : ""}.`,
    hazardCell: `median p(ousted) = ${o.median.toFixed(2)}, 10–90% [${o.lo.toFixed(2)}, ${o.hi.toFixed(2)}]`,
    code: [
      `p(ousted | profile at ${age}mo) = median ${o.median.toFixed(2)} · 10–90% CI [${o.lo.toFixed(2)}, ${o.hi.toFixed(2)}]`,
      `share of bootstrap draws calling ousted (p ≥ 0.5): ${pct(o.shareOuster)}%`,
      `features: pmNet ${s1(f.pmNet)} · ppm ${sp1(f.ppm)} · primSw ${s1(f.primSw)} · tppSw ${s1(f.tppSw)} · govAge ${f.govAge} · ageFrac ${f.ageFrac.toFixed(2)}`,
      `(the table’s current-term row shows the in-sample profile read: ${inS.toFixed(2)})`,
    ].join("\n"),
    metaDesc: `Modelled ${rPct} per cent chance of re-election for the Albanese government as at ${dateLabel(rec.asOf)} — honest range ${loPct}–${hiPct}. A statistical read of thirteen completed federal terms, refreshed fortnightly.`,
  };
}

// ---------- static term metadata for the table (election years are facts) --
const TERMS_META = {
  1987: ["1987–90", "ALP — Hawke"], 1990: ["1990–93", "ALP — Hawke → Keating"],
  1993: ["1993–96", "ALP — Keating"], 1996: ["1996–98", "Coalition — Howard"],
  1998: ["1998–01", "Coalition — Howard"], 2001: ["2001–04", "Coalition — Howard"],
  2004: ["2004–07", "Coalition — Howard"], 2007: ["2007–10", "ALP — Rudd"],
  2010: ["2010–13", "ALP — Gillard → Rudd"], 2013: ["2013–16", "Coalition — Abbott → Turnbull"],
  2016: ["2016–19", "Coalition — Turnbull → Morrison"], 2019: ["2019–22", "Coalition — Morrison"],
  2022: ["2022–25", "ALP — Albanese"],
};
const cellPct = (v) => (v == null ? "·" : String(Math.round(v * 100)));
const termRows = profile.map((t) => {
  const [span, govt] = TERMS_META[t.y];
  const lost = t.ousted === 1;
  const cells = [6, 12, 15, 18, 24, 30].map((b) =>
    `<td>${b === t.finAge && t.finAge === 30 ? cellPct(t.bands.fin) + "&nbsp;†" : cellPct(t.bands[String(b)])}</td>`).join("");
  const finCell = t.finAge === 30 ? "<td>·</td>" : `<td>${cellPct(t.bands.fin)}</td>`;
  return `<tr${lost ? ' class="lost"' : ""}><td class="l">${span}</td><td class="l">${govt}</td><td class="l fate">${lost ? "lost" : "returned"}</td>${cells}${finCell}</tr>`;
}).join("\n        ");

const latest = hist.records[hist.records.length - 1];
const S = compose(latest);
const embed = hist.records.map((r) => ({ asOf: r.asOf, sl: dateShort(r.asOf), o: r.ousted, s: compose(r) }));
const embedJson = JSON.stringify(embed).replace(/</g, "\\u003c");
const pc1 = (x) => (Math.round(x * 1000) / 10).toFixed(1);

const options = hist.records.map((r) =>
  `<option value="${r.asOf}"${r.asOf === latest.asOf ? " selected" : ""}>${dateShort(r.asOf)}</option>`).join("\n      ");
const selStrip = hist.records.length > 1
  ? `<div class="pred-selwrap">
    <label class="pred-sellabel" for="pred-sel">Model reading as at</label>
    <select id="pred-sel" class="pred-sel">
      ${options}
    </select>
    <span class="pred-stale" id="pred-stale" hidden></span>
  </div>`
  : `<p class="pred-selnote">This is the first model read — a dated record begins accumulating at the next fortnightly refresh (${dateLabel(nextDue(asOf))}).</p>`;

const pageJs = `<script>
const PRED_DATA = ${embedJson};
(function () {
  var sel = document.getElementById("pred-sel");
  if (!sel) return;
  var latest = PRED_DATA[PRED_DATA.length - 1];
  function pctv(x) { return (Math.round(x * 1000) / 10) + "%"; }
  function find(d) { for (var i = 0; i < PRED_DATA.length; i++) if (PRED_DATA[i].asOf === d) return PRED_DATA[i]; return null; }
  function apply(rec) {
    var els = document.querySelectorAll("[data-slot]");
    for (var i = 0; i < els.length; i++) {
      var k = els[i].getAttribute("data-slot");
      if (rec.s[k] != null) els[i].textContent = rec.s[k];
    }
    var fig = document.querySelector(".pred-fig");
    if (fig) fig.setAttribute("aria-label", rec.s.figAria);
    var ci = document.querySelector(".pred-ci");
    if (ci) { ci.style.left = pctv(1 - rec.o.hi); ci.style.width = pctv(rec.o.hi - rec.o.lo); }
    var med = document.querySelector(".pred-med");
    if (med) med.style.left = pctv(1 - rec.o.median);
    var stale = document.getElementById("pred-stale");
    if (stale) {
      if (rec.asOf !== latest.asOf) { stale.hidden = false; stale.textContent = "Archived read — the latest (" + latest.sl + ") puts re-election at " + latest.s.fig + "%."; }
      else stale.hidden = true;
    }
    if (window.history && history.replaceState) history.replaceState(null, "", "#" + rec.asOf);
  }
  sel.addEventListener("change", function () { var r = find(sel.value); if (r) apply(r); });
  if (location.hash.length > 5) { var r = find(location.hash.slice(1)); if (r) { sel.value = r.asOf; apply(r); } }
})();
</script>`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Will this government be re-elected? · auspol tracker</title>
<!-- GENERATED FILE — do not hand-edit. Rebuilt by .build/refresh-prediction.mjs
     on every fortnightly due date from 2026-09-19 (anchored every 14 days;
     .build/prediction-refresh.sh, driven by prediction-refresh.yml and the
     wrapper's --if-due gate). Chrome matches the /feedback/ satellite
     recipe; numbers are composed once in the generator from the live output
     of .build/analysis/reelect-snapshot-hazard.mjs (+ term-ridge cross-check).
     This read: ${dateLabel(latest.asOf)} · age ${latest.age} months. -->
<meta name="description" content="${S.metaDesc}">
<meta name="theme-color" content="#faf6f0" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1a1612" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website">
<meta property="og:site_name" content="auspol tracker">
<meta property="og:title" content="Will this government be re-elected? · auspol tracker">
<meta property="og:description" content="${S.metaDesc}">
<meta name="twitter:card" content="summary">
<link rel="canonical" href="https://auspoltracker.com/prediction/">
<link rel="icon" href="/assets/favicon.svg">
<style>
/* ------- fonts: the two cuts the static article runs ------- */
@font-face {
  font-family: 'Crimson Text';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/assets/fonts/crimsontext-400-latin.aac0df38.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Crimson Text';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url("/assets/fonts/crimsontext-600-latin.94af2060.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'IBM Plex Sans';
  font-style: normal;
  font-weight: 300 700;
  font-display: swap;
  src: url("/assets/fonts/ibmplexsans-latin.056e4e24.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

/* ------- palette: the editorial surfaces the live site runs in ------- */
:root {
  --bg:        oklch(0.975 0.009 80);
  --ink:       oklch(0.27 0.012 55);
  --ink-2:     oklch(0.44 0.012 55);
  --ink-3:     oklch(0.52 0.010 58);
  --ink-faint: oklch(0.70 0.008 65);
  --line:      oklch(0.895 0.008 75);
  --line-2:    oklch(0.935 0.006 78);
  --accent:    oklch(0.50 0.070 205);
  --mood-neg:  oklch(0.505 0.092 36);
  --serif: "Crimson Text", Georgia, "Times New Roman", serif;
  --sans: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg:        oklch(0.205 0.010 65);
    --ink:       oklch(0.940 0.008 80);
    --ink-2:     oklch(0.800 0.009 78);
    --ink-3:     oklch(0.670 0.009 72);
    --ink-faint: oklch(0.545 0.009 68);
    --line:      oklch(0.355 0.011 66);
    --line-2:    oklch(0.312 0.010 66);
    --accent:    oklch(0.70 0.080 205);
    --mood-neg:  oklch(0.685 0.105 38);
  }
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 14px;
  font-feature-settings: "tnum" 1, "ss01" 1;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  line-height: 1.45;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
}

/* ------- back to the interactive tracker (the static page's .ss-back pill) */
.ss-back {
  position: fixed; right: 18px; bottom: 18px; z-index: 300;
  display: inline-block;
  padding: 10px 16px; border-radius: 999px; border: 1px solid var(--line);
  background: var(--bg); color: var(--ink); font-size: 13px;
  font-weight: 600; text-decoration: none; cursor: pointer;
  box-shadow: 0 3px 16px oklch(0 0 0 / 0.16);
}
.ss-back:hover { border-color: var(--ink-3); }

/* ------- article: the static summary's column + type rhythm ------- */
.frame-wrap {
  flex: 1; display: flex; flex-direction: column;
  max-width: 680px; width: 100%; margin: 0 auto;
  padding: 40px 28px calc(64px + env(safe-area-inset-bottom, 0px)) 28px;
}
.frame-wrap h1 {
  font-family: var(--serif); font-size: 34px; font-weight: 600;
  letter-spacing: -0.01em; margin: 0 0 6px;
}
.frame-wrap h2 {
  font-family: var(--serif); font-size: 20px; font-weight: 600;
  margin: 30px 0 8px; padding-top: 14px; border-top: 1px solid var(--line);
}
/* Body copy + ss-sub/ss-note carry the static page's RENDERED values: on the
   live page .static-summary p outranks the declared sub/note rules, so body
   paragraphs actually run 14.5px/1.6 ink-2. */
.frame-wrap p { font-size: 14.5px; line-height: 1.6; color: var(--ink-2); margin: 0 0 12px; }
/* Specificity to match .frame-wrap p: these land on <p class> elements. */
.frame-wrap p.ss-sub { margin: 0 0 4px; }
.frame-wrap p.ss-note { margin: 20px 0 0; }
.ss-note a { color: var(--ink-2); }
.ss-note a:hover, .ss-note a:focus-visible { text-decoration: underline; text-underline-offset: 2px; }
.frame-wrap strong { color: var(--ink); font-weight: 600; }

/* ------- the headline figure + its honesty band ------- */
.pred-fig { margin: 30px 0 4px; }
.pred-num {
  font-family: var(--serif); font-weight: 600;
  font-size: 58px; line-height: 1; letter-spacing: -0.015em;
}
.pred-cap { margin-top: 7px; font-size: 13px; font-weight: 500; color: var(--ink-2); }
.pred-band { position: relative; height: 6px; margin-top: 20px; border-radius: 3px; background: var(--line-2); }
.pred-ci {
  position: absolute; top: -2px; bottom: -2px;
  border-radius: 5px; background: var(--accent); opacity: 0.32;
}
.pred-med {
  position: absolute; top: -4px; bottom: -4px; width: 2px;
  border-radius: 1px; background: var(--ink);
}
.pred-scale {
  display: flex; justify-content: space-between;
  margin-top: 7px; font-size: 10.5px; color: var(--ink-faint);
}
.pred-note { margin-top: 12px; font-size: 13px; line-height: 1.6; color: var(--ink-2); }

/* ------- the reading-history selector ------- */
.pred-selwrap { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin: 16px 0 0; }
.pred-sellabel { font-size: 12.5px; font-weight: 600; color: var(--ink); }
.pred-sel {
  font-family: var(--sans); font-size: 13px; color: var(--ink);
  background: var(--bg); border: 1px solid var(--line); border-radius: 8px;
  padding: 6px 8px;
}
.pred-stale { font-size: 12px; color: var(--ink-3); }
.pred-selnote, .frame-wrap p.pred-selnote { margin-top: 14px; font-size: 12.5px; color: var(--ink-3); }

/* ------- the five readings ------- */
.pred-feats { list-style: none; margin: 2px 0 14px; }
.pred-feats li {
  padding: 10px 0; border-top: 1px solid var(--line-2);
  font-size: 14.5px; line-height: 1.6; color: var(--ink-2);
}
.pred-feats li:first-child { border-top: 0; }
.pred-feats strong { display: block; font-size: 12.5px; font-weight: 600; color: var(--ink); }

/* ------- the term table + the ladder ------- */
.pred-twrap { overflow-x: auto; margin: 6px 0 8px; }
.pred-table { width: 100%; min-width: 560px; border-collapse: collapse; }
.pred-table caption {
  text-align: left; font-size: 12px; line-height: 1.5; color: var(--ink-3);
  padding: 0 0 8px; caption-side: top;
}
.pred-table th, .pred-table td { padding: 5px 6px; border-bottom: 1px solid var(--line-2); }
.pred-table thead th {
  font-size: 11px; font-weight: 600; color: var(--ink-3); text-align: right;
  border-bottom: 1px solid var(--line); white-space: nowrap;
}
.pred-table thead th.l, .pred-table td.l { text-align: left; }
.pred-table td { font-size: 12.5px; text-align: right; white-space: nowrap; }
.pred-table .fate { font-weight: 500; }
.pred-table tr.lost td { color: var(--mood-neg); }
.pred-table tr.lost .fate { font-weight: 600; }
.pred-table tr.cur td { font-weight: 600; color: var(--ink); }
.pred-table tr.cur .now {
  font-weight: 500; text-align: left; white-space: normal; color: var(--ink-2);
  padding-top: 8px; padding-bottom: 8px;
}
.pred-tnote, .frame-wrap p.pred-tnote { font-size: 12.5px; line-height: 1.55; color: var(--ink-3); margin: 0 0 12px; }

.pred-ladder { width: 100%; border-collapse: collapse; margin: 4px 0 12px; }
.pred-ladder th, .pred-ladder td {
  padding: 7px 8px; border-bottom: 1px solid var(--line-2);
  font-size: 12.5px; line-height: 1.5; text-align: left; vertical-align: top;
}
.pred-ladder thead th {
  font-size: 11px; font-weight: 600; color: var(--ink-3);
  border-bottom: 1px solid var(--line);
}
.pred-ladder tr.picked td { background: color-mix(in oklch, var(--accent) 7%, transparent); }

.pred-code {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 12px; line-height: 1.65; color: var(--ink-2);
  background: color-mix(in oklch, var(--ink) 5%, transparent);
  border-radius: 8px; padding: 11px 14px; margin: 2px 0 12px;
  overflow-x: auto; white-space: pre;
}
</style>
</head>
<body>
<main class="frame-wrap">
  <h1>Will this government be re-elected?</h1>
  <p class="ss-sub" data-slot="sub">${S.sub}</p>

  ${selStrip}

  <figure class="pred-fig" role="img" aria-label="${S.figAria}">
    <div class="pred-num"><span data-slot="fig">${S.fig}</span>%</div>
    <div class="pred-cap">the model’s median chance that the Albanese government is re-elected</div>
    <div class="pred-band" aria-hidden="true">
      <div class="pred-ci" style="left:${pc1(1 - latest.ousted.hi)}%;width:${pc1(latest.ousted.hi - latest.ousted.lo)}%"></div>
      <div class="pred-med" style="left:${pc1(1 - latest.ousted.median)}%"></div>
    </div>
    <div class="pred-scale" aria-hidden="true">
      <span>defeat certain · 0</span>
      <span>50</span>
      <span>100 · re-election certain</span>
    </div>
    <figcaption class="pred-note" data-slot="note">${S.note}</figcaption>
  </figure>

  <h2>What this number is</h2>
  <p>The number above is not a poll of voters and it is not a betting price. It comes from a model that was shown the polling history of every completed federal parliamentary term since 1987 — thirteen terms, nine of which ended in the government’s re-election and four in its defeat — and taught to recognise the signature a term shows part-way through: how the prime minister is rated, whether the prime minister still leads as preferred PM, and how far the vote has faded from the last election result. Read against that record, the signature of Albanese’s second term is the signature of a government that goes on to survive.</p>
  <p data-slot="what2">${S.what2}</p>

  <h2>How the model reads this term</h2>
  <p>Five readings, all knowable from published polling, drive the call.</p>
  <ul class="pred-feats">
    <li>
      <strong>Net PM approval · <span data-slot="f1l">${S.f1l}</span></strong>
      <span data-slot="f1">${S.f1}</span>
    </li>
    <li>
      <strong>Preferred-PM lead · <span data-slot="f2l">${S.f2l}</span></strong>
      <span data-slot="f2">${S.f2}</span>
    </li>
    <li>
      <strong>Primary vote · <span data-slot="f3l">${S.f3l}</span> on 2025</strong>
      <span data-slot="f3">${S.f3}</span>
    </li>
    <li>
      <strong>Two-party preferred · <span data-slot="f4l">${S.f4l}</span> on 2025</strong>
      <span data-slot="f4">${S.f4}</span>
    </li>
    <li>
      <strong>Age of the government · <span data-slot="f5l">${S.f5l}</span></strong>
      <span data-slot="f5">${S.f5}</span>
    </li>
  </ul>
  <p data-slot="blend">${S.blend}</p>

  <h2>The thirteen terms it learned from</h2>
  <p>Every few months of each completed term, from month six to the final pre-election read, the model says how likely that government was to be ousted at that point. The four defeats are in colour; the current term is pinned underneath.</p>
  <div class="pred-twrap">
    <table class="pred-table">
      <caption>Modelled chance of ouster, per cent, at each age of the term — fitted on the full record.</caption>
      <thead>
        <tr>
          <th class="l" scope="col">Term</th>
          <th class="l" scope="col">Government</th>
          <th class="l" scope="col">Fate</th>
          <th scope="col">mo 6</th>
          <th scope="col">12</th>
          <th scope="col">15</th>
          <th scope="col">18</th>
          <th scope="col">24</th>
          <th scope="col">30</th>
          <th scope="col">final</th>
        </tr>
      </thead>
      <tbody>
        ${termRows}
        <tr class="cur"><td class="l">2025–&nbsp;</td><td class="l">ALP — Albanese</td><td class="l fate">in progress</td><td class="now" colspan="7" data-slot="nowRow">${S.nowRow}</td></tr>
      </tbody>
    </table>
  </div>
  <p class="pred-tnote">† The 2007 term ran 33 months, so its month-30 read doubles as its final read. Table values are the model’s in-sample reads; the headline call above comes from the bootstrap described below.</p>
  <p data-slot="bandIntro">${S.bandIntro}</p>
  <p data-slot="bandCompare">${S.bandCompare}</p>
  <p>You can score 69 per cent on this table by simply always predicting “returned” — incumbents usually win. Tested honestly, with each term held out in turn and never seen by its judge, the model calls ten of thirteen terms correctly from month six onwards, and eleven by the final pre-election read. History blurs at the extremes: the Hawke government’s famous mid-term scare of 1989–90 read as high as 71 per cent ouster-risk at month 12, and it recovered to win the 1990 election — while the 2016–19 Coalition sat at 32 per cent by its final read and survived.</p>

  <h2>Where this can go wrong</h2>
  <p><strong>There are only thirteen terms.</strong> Four defeats is a tiny sample, and the final-read accuracy of 85 per cent itself carries about fourteen points of statistical noise either way. Treat every number on this page as a best guess with a range attached — which is why the range, not the median, is the most honest figure here.</p>
  <p><strong>It cannot see shocks.</strong> The model reads the shape of polling, not events. The 2010–13 minority government’s collapse has no antecedent in the record, and the model never calls it — at any horizon. The 2019–22 term flips depending on exactly when you look: the COVID rally peaks at precisely the fifteen-month yardstick. And 1990 is the one genuine comeback on record — a 71 per cent ouster-read at month 12 that still won.</p>
  <p><strong>Waiting buys less than you’d think.</strong> Accuracy is a flat 77 per cent from month six to month 24; only the final pre-election read climbs to 85. Governments that are structurally finished are visible early — three of the four losers were already long shots at six months. Everything else stays murky until the campaign.</p>
  <p><strong>Winning means seats, not the popular vote.</strong> Fates are coded by who formed government. Howard’s 1998 win on 49 per cent of the two-party vote counts as a win — the model is about survival, not vote share. And none of this is a forecast of events between now and the election: it is a reading of history’s signatures, and the election itself remains its own fact.</p>

  <h2>The model, technically</h2>
  <p>The headline is the best of four constructions tried in the site’s re-election modelling suite (.build/analysis, committed de5dfa4). The ladder, with how each reads Albanese’s second term:</p>
  <table class="pred-ladder">
    <thead>
      <tr><th scope="col">Construction</th><th scope="col">Read on Albanese-2025</th><th scope="col">Leave-one-term-out</th></tr>
    </thead>
    <tbody>
      <tr><td>15-month <em>levels</em> composite (approval, lead, swings scored against the ousted and survivor centroids)</td><td>−1.18 — worse than the typical ousted term’s level</td><td>15% (useless)</td></tr>
      <tr><td>15-month <em>declines</em> composite (fade from the term’s own honeymoon)</td><td>+0.86 — a standard honeymoon fade</td><td>54%</td></tr>
      <tr><td>Ridge logistic on per-term trajectory features</td><td><span data-slot="ridgeCell">${S.ridgeCell}</span></td><td>85% full-term · 77% live</td></tr>
      <tr class="picked"><td><strong>Snapshot / hazard model — the one above</strong></td><td><strong><span data-slot="hazardCell">${S.hazardCell}</span></strong></td><td>77% at every band, months 6–24 · 75% at 30 · 85% final</td></tr>
    </tbody>
  </table>
  <p>The construction. Each completed term contributes snapshots at ages 6, 12, 15, 18, 24 and 30 months plus a final read three months before its last day — ninety snapshots in all. Each snapshot’s features are trailing-three-month summaries knowable at that age: net PM approval, the preferred-PM lead, the primary-vote and two-party swings against the term’s own election result, the government’s incumbency age in consecutive terms, the fraction of the term elapsed (the current term is assumed to run a full span), and the interaction of primary swing with elapsed fraction — seven features in all. Missing values are median-imputed within the training fold; features are standardised within it; the fit is ridge logistic regression with λ = 1.</p>
  <p>The validation. Leave-one-term-out: a term’s snapshots are scored only by a model trained on the other twelve. The baseline “always re-elected” scores 69 per cent. Snapshot-level AUC is 0.77 with Brier score 0.182. The interval comes from a 300-draw cluster bootstrap that resamples whole terms, refits, and re-scores the current term each draw. The live call, verbatim:</p>
  <div class="pred-code" data-slot="code">${S.code}</div>
  <p>The cross-check. A deliberately different construction — one ridge logistic per term on first-sixteen-month features — <span data-slot="ridgeCell2">${S.ridgeCell2}</span> Its best-calibrated variant, adding leadership-spill and minority-government flags, holds the same 85 per cent leave-one-term-out accuracy with AUC 0.89 and Brier 0.134. On thirteen terms the estimator is not the constraint — a diagonal LDA ties the ridge and k-nearest-neighbours collapses — and no capacity beyond logistic earns its keep: adjacent accuracies are statistically indistinguishable (85 per cent carries a 95% Wilson interval of roughly [58%, 96%]).</p>
  <p>To reproduce: from the repo root, <code>node .build/analysis/reelect-snapshot-hazard.mjs</code> (the headline — its snapshot age defaults to the canonical 16.2 months and moves via <code>--age=N.N</code>), <code>node .build/analysis/reelect-term-ridge.mjs</code> (the cross-check), plus <code>reelect-15mo-levels.mjs</code> and <code>reelect-15mo-declines.mjs</code> (the composites). Both models emit machine-readable results with <code>--json</code>; this page is regenerated from them by <code>.build/refresh-prediction.mjs</code> on a fortnightly due-date gate, and each refresh is one dated, selectable record above. The analysis scripts read poll data straight from origin/main, so they are immune to working-tree state; the canonical numbers live in <code>.build/analysis/README.md</code>. The analysis’s own closing caution stands: this is historical signature analysis, not a forecast.</p>

  <p class="ss-note">This is a satellite analysis page of <a href="/">auspol tracker</a>, an unofficial aggregate of published federal opinion polling. The live, interactive tracker carries the current aggregates, charts and per-poll archive.</p>
</main>
${pageJs}
<a class="ss-back" href="/">&larr; Back to the interactive tracker</a>
</body>
</html>
`;

// ---------- writers --------------------------------------------------------
const writeAtomic = (file, content) => {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  writeFileSync(tmp, content);
  renameSync(tmp, file);
};
const readOrNull = (f) => { try { return readFileSync(f, "utf8"); } catch { return null; } };

let changed = false;
const wrote = [];
const put = (file, content) => {
  if (readOrNull(file) !== content) {
    changed = true;
    wrote.push(file);
    if (!dry) writeAtomic(file, content);
  }
};
put(HISTORY_FILE, JSON.stringify(hist, null, 2) + "\n");
put(PAGE, html);

// The sitemap's prediction/ route reads PREDICTION_STAMP from build.mjs —
// keep it honest each refresh rather than touching generated sitemap.xml
// (the main build regenerates it from the constant).
{
  const src = readFileSync(BUILD, "utf8");
  const m = src.match(/const PREDICTION_STAMP = "\d{4}-\d{2}-\d{2}";/);
  const next = `const PREDICTION_STAMP = "${asOf}";`;
  if (!m) console.error("WARN no PREDICTION_STAMP in build.mjs — sitemap lastmod stale");
  else if (m[0] !== next) {
    changed = true;
    wrote.push(BUILD);
    if (!dry) writeAtomic(BUILD, src.replace(m[0], next));
  }
}

console.log(`PRED_STATUS ${JSON.stringify({
  due: true, ran: true, asOf, age,
  median: record.ousted.median, reelectPct: pct(1 - record.ousted.median),
  records: hist.records.length, changed, wrote: dry ? [] : wrote, dry,
})}`);

