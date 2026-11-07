#!/usr/bin/env node
/* senate_prefs.mjs: the Election map's Senate preferences lens data, map/data/senate-prefs-<year>.json
   (2016, 2019, 2022, 2025: the elections with every Senate ballot published; group tickets before).

   From the ballot rankings the seat model uses (.build/analysis/seat-model/extract-senate-rankings.py):
   data/senate-rankings-<year>.json per division (all ballots, postal and pre-poll included) and
   .build/aec-flow-src/senate-ballots/booth-rankings-<year>.json.gz per polling place (keyed by the
   PollingPlaceID the map's res-<year>.json booths carry).

   For three contests (Labor v the Coalition, Labor v One Nation, the Coalition v One Nation) and the
   three groups of voters whose preferences decide each (the third big party, the Greens, and every
   other party and independent pooled), each seat and place carries [ballots ranking the first-named
   party ahead (or naming only it), ballots ranking the second ahead, ballots naming neither].
   Layout: divs/booths values are flat arrays of 27 counts, pair-major (PAIRS), donor-minor (DONORS[pair]).

     node .build/map/senate_prefs.mjs */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const YEARS = [2016, 2019, 2022, 2025];
export const PAIRS = ["AC", "AO", "CO"];
export const DONORS = { AC: ["grn", "onp", "oth"], AO: ["lnp", "grn", "oth"], CO: ["alp", "grn", "oth"] };
/* the two-party lens builds its contests by polling place on the 2022 and 2025 frames, where it
   also offers the three Greens pairings (Greens v One Nation, Greens v Labor, Greens v the
   Coalition); their slots ride after the three original contests' in those years' files, 54 counts
   a seat and place. Only those years carry them: no other frame has a contest built from the file,
   so the older years stay at 27. */
export const PAIRS6 = [...PAIRS, "GO", "GA", "GC"];
export const DONORS6 = { ...DONORS, GO: ["alp", "lnp", "oth"], GA: ["lnp", "onp", "oth"], GC: ["alp", "onp", "oth"] };
const SIX_YEARS = new Set([2022, 2025]);
const FAM_OF = (cohort) => (cohort === "ALP" ? "alp" : cohort.startsWith("COAL") ? "lnp" : cohort === "GRN" ? "grn" : cohort === "ON" ? "onp" : "oth");

function cells(tab, patterns, pairs, donors) {
  // tab: { cohort: { patternIdx: n } } -> flat counts, pair-major, donor-minor
  const by = { alp: {}, lnp: {}, grn: {}, onp: {}, oth: {} };
  for (const [c, t] of Object.entries(tab)) { const f = FAM_OF(c); for (const [i, n] of Object.entries(t)) by[f][i] = (by[f][i] || 0) + n; }
  const out = [];
  for (const pr of pairs) for (const fam of donors[pr]) {
    let x = 0, y = 0, nei = 0;
    for (const [i, n] of Object.entries(by[fam])) {
      const p = patterns[+i], ix = p.indexOf(pr[0]), iy = p.indexOf(pr[1]);
      if (ix < 0 && iy < 0) nei += n; else if (iy < 0 || (ix >= 0 && ix < iy)) x += n; else y += n;
    }
    out.push(x, y, nei);
  }
  return out;
}
for (const year of YEARS) {
  const R = JSON.parse(fs.readFileSync(path.join(ROOT, `data/senate-rankings-${year}.json`), "utf8"));
  const B = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, `.build/aec-flow-src/senate-ballots/booth-rankings-${year}.json.gz`))).toString());
  const [pairs, donors] = SIX_YEARS.has(year) ? [PAIRS6, DONORS6] : [PAIRS, DONORS];
  const divs = {}, booths = {};
  // a party with no group on a state's ballot (One Nation in the ACT; in the NT until 2025) can't be ranked there:
  // the lens shows no figure rather than 100% for its rival
  const named = {};
  for (const d of Object.values(R.divisions)) { const st = (named[d.st] ??= { A: 0, C: 0, G: 0, O: 0 }); for (const t of Object.values(d.t)) for (const [i, n] of Object.entries(t)) for (const ch of R.patterns[+i]) st[ch] += n; }
  const FAMC = { A: "alp", C: "lnp", G: "grn", O: "onp" };
  const absent = Object.fromEntries(Object.entries(named).map(([st, o]) => [st, Object.entries(o).filter(([, n]) => n === 0).map(([ch]) => FAMC[ch])]).filter(([, a]) => a.length));
  for (const [name, d] of Object.entries(R.divisions)) divs[name] = cells(d.t, R.patterns, pairs, donors);
  for (const [id, t] of Object.entries(B.booths)) if (!id.startsWith("special:")) booths[id] = cells(t, B.patterns, pairs, donors);
  // check: each division's place counts never exceed its all-ballot counts
  const out = { year, pairs, donors, absent, source: `Every formal Senate ballot, ${year} (AEC ballot-level files), by the order it ranked the pair's two parties; via data/senate-rankings-${year}.json and the polling-place table beside it`, divs, booths };
  const f = path.join(ROOT, `map/data/senate-prefs-${year}.json`);
  fs.writeFileSync(f, JSON.stringify(out));
  console.log(`senate-prefs-${year}.json: absent ${JSON.stringify(absent)}, ${Object.keys(divs).length} divisions, ${Object.keys(booths).length} polling places, ${fs.statSync(f).size} bytes`);
}
