#!/usr/bin/env node
/* extract-division-classifications.mjs — the AEC's per-division demographic
   classification (Inner Metropolitan / Outer Metropolitan / Provincial /
   Rural), previous-and-current seat status, and parties, for nine election
   blocks: canonical-on-page 2001 and 2004 blocks plus the seven VTR
   elections (2007/2010/2013/2016/2019/2022/2025). The classification is
   the AEC's own geography rating — the flow-strength findings name
   "regional" composition as a confound; this is the covariate that answers
   for it.

   The 2001 block is canonical-on-page, not derived (the online VTR starts
   at 2004 and carries no classifications): the AEC's own 2001-epoch
   division profile pages, Wayback-harvested Nov 2001–Apr 2002 while they
   still displayed the "Demographic Rating" token beside the "3 October
   1998 Election" Seat Status block, transcribed into the committed
   aec-2001-epoch-profile-ratings.tsv (147 on-page rows + 3 RR5 fills —
   Bradfield/Maribyrnong were never archived, Wide Bay's page never printed
   a rating). Two real era tokens normalise into the four-class vocabulary
   ("Outer Urban" macarthur and "Outer Metropolitan/Provincial" canning
   → Outer Metropolitan). AEC Research Report 5 (Newman, Jan 2005,
   www.aec.gov.au/About_AEC/research/files/research_paper5.pdf) demotes to
   gap-fill + corroboration: attachment 3 fills the 3 holes, attachment 2's
   FROM column purports to record the 2001-election class (confirms v2 on
   12 of 16 rows; the four page-vs-paper divergences Macarthur/Maribyrnong/
   Fisher/Pearce are pinned below — and see the 2004 paragraph: those four
   are real 2001→2004 re-ratings, so att2's FROM actually records the
   2004-epoch printed rating), and the 20 divisions where v2's raw
   token disagrees with attachment 3's never-adopted proposed re-rating
   land as an explicit delta in out.deltas. 2001 rows carry previous:null
   (neither source has a prior/after pair), and the division set is the
   2001-era one (Gwydir present; no Gorton/Bonner/Flynn/Wright).

   The 2004 block is canonical-on-page from the LIVE 2004 division profile
   pages (www.aec.gov.au/Elections/federal_elections/2004/profiles/<Name>.htm
   — no Wayback needed), transcribed into the committed
   aec-2004-epoch-profile-ratings.tsv (all 150 divisions carry an on-page
   rating; no RR5 patches needed). Two page templates exist in that
   directory (split vs inline label/value) — both were parsed. Seat Status
   supplies each division's 2004-election party/status. RR5 att2's FROM
   column matches these 2004 pages on all 15 comparable rows (Burke was
   abolished, uncomparable), settling that Newman's FROM describes the
   rating as printed in Jan 2005 — i.e. the 2004 epoch. The division set
   pivots on the 2003–04 redistributions: Bonner/Gorton in,
   Bonython/Burke out.

   Source: the VTR per-state HouseDivisionClassifications pages
   (https://results.aec.gov.au/<event>/Website/HouseDivisionClassifications-<event>-<STATE>.htm
   — natn page HouseDivisionClassifications-<event>-NAT.htm also exists).
   Live fetch, no cache: seven events x eight states, 56 GETs, pages are
   ~60KB. Two markup eras, handled below: 2016+ self-label cells with
   headers="c*" attributes; 2007/2010/2013 have no headers attributes and
   are parsed positionally (2007/2010: 7 cols, no state column — state is
   the page's own; 2013: 8 cols, state is col 2).

   Invariants pinned by test-division-classifications.mjs: seat counts
   (2001-2016 150 blocks, 2019/2022 151, 2025 150), every division carries
   one of the four classes, the 2001→2004 and 2004→2007 reclassification
   sets are pinned exactly, and seat names line up with
   data/aec-2025-seat-flows.json for 2025.

   Run from the repo root:
     node .build/analysis/seat-model/extract-division-classifications.mjs
   Then: node .build/analysis/seat-model/test-division-classifications.mjs */
import { readFileSync, writeFileSync as write } from "node:fs";

const EVENTS = { 2007: "13745", 2010: "15508", 2013: "17496", 2016: "20499", 2019: "24310", 2022: "27966", 2025: "31496" };
const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];
const CLASSES = ["Inner Metropolitan", "Outer Metropolitan", "Provincial", "Rural"];
const RR5_FIXTURES = {
  att3: ".build/analysis/seat-model/rr5-att3-proposed-classifications.tsv",
  att2: ".build/analysis/seat-model/rr5-att2-changes.tsv",
};
const V2_FIXTURE = ".build/analysis/seat-model/aec-2001-epoch-profile-ratings.tsv";
const V2_2004_FIXTURE = ".build/analysis/seat-model/aec-2004-epoch-profile-ratings.tsv";
// The 2004-division-set pivots on the 2003-04 redistributions.
const ADDED_2004 = ["Bonner", "Gorton"];
const ABOLISHED_2004 = ["Bonython", "Burke"];
const PARTIES_2004 = ["Labor", "Liberal", "National", "Independent", "Country Liberal"];
const STATUSES_2004 = ["Marginal", "Fairly Safe", "Safe"];
const STATE_COUNTS_2004 = { NSW: 50, VIC: 37, QLD: 28, SA: 11, WA: 15, TAS: 5, NT: 2, ACT: 2 };
// Two real 2001-era page tokens normalise into the four-class vocabulary
// (raw tokens stay visible in the delta).
const NORMALISE_2001 = { "Outer Urban": "Outer Metropolitan", "Outer Metropolitan/Provincial": "Outer Metropolitan" };
// att2's recorded 2001-election class disagrees with the v2 page here —
// Macarthur/Maribyrnong/Fisher/Pearce. Pinned so any NEW divergence throws.
const ATT2_DIVERGES_2001 = ["Fisher", "Macarthur", "Maribyrnong", "Pearce"];
const OUT = "data/division-classifications.json";

const url = (ev, st) => `https://results.aec.gov.au/${ev}/Website/HouseDivisionClassifications-${ev}-${st}.htm`;
const cell = (row, id) => row.match(new RegExp(`<td headers="${id}"[^>]*>([\\s\\S]*?)</td>`, "i"))?.[1];
const strip = (s) => s?.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();

/* 2007/2010/2013 pages self-label nothing: cells are bare uppercase <TD>s in
   a fixed order, and 2007/2010 carry no state column at all (the row's state
   is the state page it was fetched from). Parse positionally:
     7 cells: div, enr, dem, prevParty, prevStatus, party, status
     8 cells: div, STATE, enr, dem, prevParty, prevStatus, party, status */
const legacyRows = function* (html, st) {
  for (const row of html.split(/<tr[\s>]/i).slice(1)) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (cells.length !== 7 && cells.length !== 8) continue;
    const d = cells.length === 8 ? { div: 0, stt: 1, dem: 3, pp: 4, pss: 5, sp: 6, ss: 7 }
                                 : { div: 0, dem: 2, pp: 3, pss: 4, sp: 5, ss: 6 };
    if (!/HouseDivision(FirstPrefs|Page)-\d+-\d+\.htm/i.test(cells[d.div])) continue;
    yield {
      div: strip(cells[d.div]), dem: strip(cells[d.dem]), stt: d.stt != null ? strip(cells[d.stt]) : st,
      pp: strip(cells[d.pp]), pss: strip(cells[d.pss]), sp: strip(cells[d.sp]), ss: strip(cells[d.ss]),
    };
  }
};

/* The 2001 block: canonical from the v2 Wayback-harvested profile-page
   ratings (header has the provenance). classificationV2page is the raw
   on-page token; provenance=aecPage | rr5Patch (the 3 RR5 fills). att3
   supplies state/party/status + the gap-fill rows + the delta's comparison
   value; att2's recorded 2001-election class must corroborate the
   normalised v2 class except on the four pinned ATT2_DIVERGES_2001 rows —
   a roll-back of either check means a fixture regen drifted. */
const loadTsv = (p) => {
  const lines = readFileSync(p, "utf8").trim().split("\n");
  if (!lines[0]?.startsWith("# ")) throw new Error(`${p}: missing '# '-prefixed schema header`);
  const cols = lines[0].slice(2).split("\t");
  return lines.slice(1).filter((l) => l && !l.startsWith("#")).map((l) => {
    const cells = l.split("\t");
    if (cells.length !== cols.length) throw new Error(`${p}: bad row: ${l}`);
    return Object.fromEntries(cols.map((c, i) => [c, cells[i]]));
  });
};

const elections2001 = () => {
  const att3 = new Map(loadTsv(RR5_FIXTURES.att3).map((r) => [r.division, r]));
  const att2 = new Map(loadTsv(RR5_FIXTURES.att2).map((r) => [r.division, r.classification2001election]));
  const block = {}, delta = [], att2Diverges = [];
  for (const r of loadTsv(V2_FIXTURE)) {
    const a3 = att3.get(r.division);
    if (!a3) throw new Error(`${V2_FIXTURE}: ${r.division} absent from ${RR5_FIXTURES.att3}`);
    if (!CLASSES.includes(a3.classificationRR5proposed)) throw new Error(`${RR5_FIXTURES.att3}: ${r.division}: bad class ${a3.classificationRR5proposed}`);
    if (!STATES.includes(a3.state)) throw new Error(`${RR5_FIXTURES.att3}: ${r.division}: bad state ${a3.state}`);
    if (!["aecPage", "rr5Patch"].includes(r.provenance)) throw new Error(`${V2_FIXTURE}: ${r.division}: bad provenance ${r.provenance}`);
    const raw = r.classificationV2page;
    const cls = NORMALISE_2001[raw] ?? raw;
    if (!CLASSES.includes(cls)) throw new Error(`${V2_FIXTURE}: ${r.division}: bad class ${raw}`);
    if (block[r.division]) throw new Error(`${V2_FIXTURE}: duplicate ${r.division}`);
    if (r.provenance === "aecPage" && raw !== a3.classificationRR5proposed)
      delta.push({ division: r.division, pageRating: raw, rr5att3Proposed: a3.classificationRR5proposed });
    if (att2.has(r.division) && cls !== att2.get(r.division)) att2Diverges.push(r.division);
    block[r.division] = {
      state: a3.state,
      classification: cls,
      previous: null,
      current: { party: a3.party, status: a3.status },
    };
  }
  for (const name of att3.keys()) if (!(name in block)) throw new Error(`${V2_FIXTURE}: ${name} missing (present in ${RR5_FIXTURES.att3})`);
  if (Object.keys(block).length !== 150) throw new Error(`${V2_FIXTURE}: ${Object.keys(block).length} rows (expect 150)`);
  if (delta.length !== 20) throw new Error(`2001 v2-vs-RR5att3 delta: ${delta.length} rows (expect 20)`);
  if (att2Diverges.sort().join() !== ATT2_DIVERGES_2001.join())
    throw new Error(`att2 corroboration diverges: [${att2Diverges}] (expect [${ATT2_DIVERGES_2001}])`);
  return { block, delta };
};

/* The 2004 block: fully canonical-on-page from the LIVE 2004 division
   profile pages (www.aec.gov.au/Elections/federal_elections/2004/profiles/
   <Name>.htm — no Wayback needed), harvested 2026-10-22 into the committed
   aec-2004-epoch-profile-ratings.tsv. All 150 rows are aecPage (no RR5
   patches needed — unlike 2001, the 2004 set survived intact). Like 2001,
   the pages are single-epoch so previous:null. Guards: 150 rows, the
   division set is exactly the 2001 set + Bonner/Gorton - Bonython/Burke,
   per-state chamber counts (Qld gained Bonner; SA lost Bonython), closed
   party/status vocabularies, classification vocabulary, provenance. */
const elections2004 = () => {
  const att3Names = new Set(loadTsv(RR5_FIXTURES.att3).map((r) => r.division));
  const block = {}, stateCounts = {};
  for (const r of loadTsv(V2_2004_FIXTURE)) {
    if (!CLASSES.includes(r.classification)) throw new Error(`${V2_2004_FIXTURE}: ${r.division}: bad class ${r.classification}`);
    if (!STATES.includes(r.state)) throw new Error(`${V2_2004_FIXTURE}: ${r.division}: bad state ${r.state}`);
    if (!PARTIES_2004.includes(r.party)) throw new Error(`${V2_2004_FIXTURE}: ${r.division}: bad party ${r.party}`);
    if (!STATUSES_2004.includes(r.status)) throw new Error(`${V2_2004_FIXTURE}: ${r.division}: bad status ${r.status}`);
    if (r.provenance !== "aecPage") throw new Error(`${V2_2004_FIXTURE}: ${r.division}: bad provenance ${r.provenance}`);
    if (block[r.division]) throw new Error(`${V2_2004_FIXTURE}: duplicate ${r.division}`);
    block[r.division] = {
      state: r.state,
      classification: r.classification,
      previous: null,
      current: { party: r.party, status: r.status },
    };
    stateCounts[r.state] = (stateCounts[r.state] || 0) + 1;
  }
  if (Object.keys(block).length !== 150) throw new Error(`${V2_2004_FIXTURE}: ${Object.keys(block).length} rows (expect 150)`);
  const wantStates = Object.fromEntries(STATES.map((s) => [s, STATE_COUNTS_2004[s]]));
  const sortKeys = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).sort()));
  if (sortKeys(stateCounts) !== sortKeys(wantStates))
    throw new Error(`2004 state counts ${JSON.stringify(stateCounts)} (expect ${JSON.stringify(wantStates)})`);
  const expected = new Set([...att3Names, ...ADDED_2004].filter((n) => !ABOLISHED_2004.includes(n)));
  for (const n of expected) if (!(n in block)) throw new Error(`${V2_2004_FIXTURE}: ${n} missing (expected from 2001 set ± 2003-04 redistributions)`);
  for (const n of Object.keys(block)) if (!expected.has(n)) throw new Error(`${V2_2004_FIXTURE}: ${n} unexpected`);
  return { block };
};

const out = {
  _about: "AEC demographic classification per division (Inner Metropolitan / Outer Metropolitan / Provincial / Rural — AEC definitions: inner = capital-city established suburbs; outer = capital-city expansion areas; provincial = majority of enrolment in major provincial cities; rural = the rest), with previous/current seat status (marginal <56%, fairly safe 56-60%, safe >60%) and parties, per election 2001, 2004 and 2007/2010/2013/2016/2019/2022/2025. 2001 is CANONICAL-ON-PAGE from the AEC's own 2001-epoch division profile pages (Wayback captures Nov 2001-Apr 2002 of the 'Demographic Rating' token beside the '3 October 1998 Election' Seat Status block, transcribed in aec-2001-epoch-profile-ratings.tsv: 147 on-page ratings + 3 RR5-att3 gap fills — Bradfield/Maribyrnong unarchived, Wide Bay never printed; the era tokens Outer Urban / Outer Metropolitan/Provincial normalise to Outer Metropolitan). 2004 is likewise CANONICAL-ON-PAGE, from the LIVE 2004 division profile pages (www.aec.gov.au/Elections/federal_elections/2004/profiles/, transcribed 2026-10-22 in aec-2004-epoch-profile-ratings.tsv: all 150 divisions carry an on-page rating, no patches; the 2004 set is the 2001 set plus Bonner/Gorton minus Bonython/Burke after the 2003-04 redistributions, and the division's 2004-election Seat Status string supplies current party/status). AEC Research Report 5 (Newman, Jan 2005) is gap-fill + corroboration only: its attachment-2 FROM column independently confirms 12 of 16 change rows — the four exceptions Macarthur/Maribyrnong/Fisher/Pearce are four of the seven REAL 2001->2004 on-page reclassifications (Newman's '2001' FROM column actually describes the 2004-epoch printed rating, matching the 2004 pages on all 15 comparable rows) — and the 20 v2-vs-attachment-3 divergences (attachment 3 being a never-adopted proposed re-rating) land in deltas['2001']; 2001 and 2004 rows carry previous:null (their pages have no prior/after pair) and the year-era division sets (2001: Gwydir present, no Bonner/Gorton; 2004: Bonner/Gorton in, Bonython/Burke out). 2007+ extracted from the VTR HouseDivisionClassifications per-state pages. The AEC rates divisions per election; names stay in AEC canonical case for that election's era (2001-2013 names predate the 2016-17 renames: e.g. 'Denison' not 'Clark', 'Throsby' not 'Whitlam'); join to that year's flows/baseline by exact name.",
  _provenance: { sourcePattern: "https://results.aec.gov.au/<event>/Website/HouseDivisionClassifications-<event>-<STATE>.htm", rr5: "https://www.aec.gov.au/About_AEC/research/files/research_paper5.pdf", wayback2001: "AEC 2001-epoch division profile pages, Wayback captures Nov 2001-Apr 2002 (harvest kit: .matilda/divclass-pre2001/harvest-1998-v2.py)", live2004: "AEC 2004 division profile pages, live www.aec.gov.au/Elections/federal_elections/2004/profiles/<Name>.htm (harvest kit: .matilda/divclass-2004/harvest-2004.py)", fixtures: [V2_FIXTURE, V2_2004_FIXTURE, ...Object.values(RR5_FIXTURES)], events: EVENTS, extractedAt: new Date().toISOString().slice(0, 10) },
  elections: {},
  deltas: {},
};
const e01 = elections2001();
out.elections["2001"] = e01.block;
out.deltas["2001"] = {
  _about: "v2 on-page rating token vs RR5 attachment-3's proposed (never-adopted) re-rating, rows where they disagree; all adjacent-class calls, two being the era tokens Outer Urban / Outer Metropolitan/Provincial that normalise to Outer Metropolitan.",
  v2vsRR5att3: e01.delta,
};
console.log(`2001: ${Object.keys(out.elections["2001"]).length} divisions (v2 pages canonical; ${e01.delta.length}-row delta vs RR5 att3)`);
const e04 = elections2004();
out.elections["2004"] = e04.block;
console.log(`2004: ${Object.keys(out.elections["2004"]).length} divisions (live 2004 profile pages canonical)`);

for (const [year, ev] of Object.entries(EVENTS)) {
  const divisions = {};
  for (const st of STATES) {
    const res = await fetch(url(ev, st));
    if (!res.ok) throw new Error(`${year} ${st}: HTTP ${res.status}`);
    const html = await res.text();
    const seen = { InnerMetropolitan: 0, OuterMetropolitan: 0, Provincial: 0, Rural: 0 };
    const modern = +ev >= 20499;
    const rows = modern
      ? html.split(/<tr[\s>]/).slice(1).map((row) => ({
          div: strip(cell(row, "cDiv")), dem: strip(cell(row, "cDem")), stt: strip(cell(row, "cStt")),
          pp: strip(cell(row, "cPP")), pss: strip(cell(row, "cPSS")), sp: strip(cell(row, "cScss")), ss: strip(cell(row, "cSS")),
        })).filter((r) => r.div && r.dem)
      : [...legacyRows(html, st)];
    for (const r of rows) {
      const name = r.div, demo = r.dem, state = r.stt;
      if (!name || !CLASSES.includes(demo))
        throw new Error(`${year} ${st}: unparseable row ${JSON.stringify(r).slice(0, 160)}`);
      if (state !== st) throw new Error(`${year} ${st}: row state ${state}`);
      if (divisions[name]) throw new Error(`${year}: duplicate division ${name}`);
      divisions[name] = {
        state,
        classification: demo,
        previous: { party: r.pp, status: r.pss },
        current: { party: r.sp, status: r.ss },
      };
      seen[demo.replace(/ /g, "")]++;
    }
    console.log(`${year} ${st}: ${Object.values(seen).reduce((a, b) => a + b, 0)} divisions (${Object.entries(seen).map(([k, v]) => `${k} ${v}`).join(" / ")})`);
  }
  out.elections[year] = divisions;
}

write(OUT, JSON.stringify(out, null, 2) + "\n");
for (const [year, divs] of Object.entries(out.elections))
  console.log(`wrote ${year}: ${Object.keys(divs).length} divisions`);
console.log(`-> ${OUT}`);
