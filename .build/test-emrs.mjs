/* Tests for extract-emrs.mjs – the EMRS (Tas) federal voting-intentions
   reader behind the EMRS (Tas) poll rows – against the cached reports
   (.build/emrs-src, tracked) and synthetic listing/PDF text for the
   discovery and parsing rules.
   Run: node .build/test-emrs.mjs */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { titleYmOf, listFederalReports, fieldworkOf, federalPageOf, primariesOf, tppOf, parseWave }
  from "./extract-emrs.mjs";

const SRC = ".build/emrs-src";

// ---- the cached wave set, pinned ---------------------------------------------
const waves = fs.readdirSync(SRC).filter((f) => f.endsWith(".json"))
  .map((f) => ({
    ym: f.replace(/\.json$/, ""),
    sidecar: JSON.parse(fs.readFileSync(path.join(SRC, f), "utf8")),
  }))
  .sort((a, b) => (a.ym < b.ym ? -1 : 1));
assert.deepEqual(waves.map((w) => w.ym), ["2026-02", "2026-08"], "the cached federal waves");
for (const w of waves) w.text = fs.readFileSync(path.join(SRC, w.ym + ".txt"), "utf8");

assert.deepEqual(waves.map((w) => [w.ym, w.sidecar.url, w.sidecar.title]), [
  ["2026-02", "https://www.emrs.com.au/sites/default/files/documents/2026-02/EMRS%20-%20Federal%20Voting%20Intentions%20Report%20-%20February%202026.pdf", "EMRS - Federal Voting Intentions Report - February 2026"],
  ["2026-08", "https://www.emrs.com.au/sites/default/files/documents/EMRS%20State%20and%20Federal%20Voting%20Intentions%20Report%20-%20August%202026%20-%20FINAL.pdf", "EMRS State and Federal Voting Intentions Report - August 2026"],
], "the sidecar report links and listing titles");
for (const w of waves) {
  assert.equal(w.sidecar.firstSeen, "2026-10-10", `${w.ym}: first-seen the day the pipeline shipped`);
  assert.equal(w.sidecar.published, w.sidecar.firstSeen,
    `${w.ym}: a machine-found wave's published stamp is its first-seen date`);
}

// ---- parseWave against the cache reproduces the canon figures exactly ---------
// (the hand-entered polls.json rows parseWave verifies every run against)
const CANON = {
  "2026-02": { date: "2026-02-19", dateStart: "2026-02-16", sample: 953,
               alp: 30, lnp: 19, grn: 13, onp: 24, ind: 12, oth: 1, tpp_alp: 60, tpp_lnp: 40 },
  "2026-08": { date: "2026-08-18", dateStart: "2026-08-17", sample: 968,
               alp: 29, lnp: 17, grn: 15, onp: 26, ind: 13, oth: 1, tpp_alp: 57, tpp_lnp: 43 },
};
for (const w of waves) {
  const p = parseWave(w.text, w.ym);
  assert.deepEqual(p.problems, [], `${w.ym}: clean parse`);
  for (const k of Object.keys(CANON[w.ym]))
    assert.equal(p[k], CANON[w.ym][k], `${w.ym}: ${k}`);
  const s = [p.alp, p.lnp, p.grn, p.onp, p.ind, p.oth].reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(s - 100) <= 1, `${w.ym}: primaries ${s} within a point of 100 (canon prints 99 and 101)`);
  // the cache's sidecar records the same figures the guard verifies
  assert.equal(w.sidecar.date, p.date, `${w.ym}: sidecar date`);
  assert.equal(w.sidecar.sample, p.sample, `${w.ym}: sidecar sample`);
  assert.deepEqual([w.sidecar.primaries.alp, w.sidecar.primaries.lnp, w.sidecar.primaries.grn,
                    w.sidecar.primaries.onp, w.sidecar.primaries.ind, w.sidecar.primaries.oth],
                   [p.alp, p.lnp, p.grn, p.onp, p.ind, p.oth], `${w.ym}: sidecar primaries`);
  assert.deepEqual([w.sidecar.tpp.alp, w.sidecar.tpp.lnp], [p.tpp_alp, p.tpp_lnp], `${w.ym}: sidecar tpp`);
}
// the Aug-2026 exec summary's "August 2025" fieldwork typo really is in
// the report — the title-month filter in fieldworkOf (below) is why the
// parse still lands the methodology bullet's 17–18 Aug 2026
assert.ok(waves.find((w) => w.ym === "2026-08").text
  .includes("conducted from the 17th to the 18th of August 2025"),
  "the Aug-2026 report's typo line is pinned in the cache");

// ---- titleYmOf ----------------------------------------------------------------
assert.equal(titleYmOf("EMRS - Federal Voting Intentions Report - February 2026"), "2026-02",
  "dash-separated trailing month");
assert.equal(titleYmOf("EMRS State and Federal Voting Intentions Report - August 2026"), "2026-08",
  "state-and-federal title");
assert.equal(titleYmOf("Federal Voting Intentions Report February 2026"), "2026-02",
  "the title may drop the dash");
assert.equal(titleYmOf("EMRS &#8211; Federal Voting Intentions Report &#8211; March 2026"), "2026-03",
  "entities decode");
assert.equal(titleYmOf("EMRS Federal Voting Intentions Report - February 2026 FINAL"), "2026-02",
  "a FINAL suffix stays the same month");
assert.equal(titleYmOf("EMRS Federal Voting Intentions Report"), null, "no month, no wave");
assert.equal(titleYmOf("EMRS Federal Voting Intentions Report - Smarch 2026"), null, "an unknown month is null");

// ---- listFederalReports --------------------------------------------------------
const anchor = (inner, href) => `<a class="file-link" href="${href}">${inner}</a>`;
{
  const html = [
    anchor("EMRS - Federal Voting Intentions Report - February 2026",
      "https://www.emrs.com.au/sites/default/files/documents/2026-02/EMRS%20-%20Federal%20Voting%20Intentions%20Report%20-%20February%202026.pdf"),
    anchor("<b>Federal</b> and State <em>Voting Intentions</em> Report - August 2026",
      "/sites/default/files/documents/aug-2026.pdf"),
    anchor("EMRS State Voting Intentions Report - March 2026", "/files/state-mar.pdf"),
    anchor("Media Release: voters say cost of living is the issue", "/files/mr.pdf"),
    anchor("Federal Voting Intentions November 2024", "/files/old.pdf"),
    anchor("Federal Voting Intentions Report - October 2026", "/files/not-a-pdf.docx"),
    anchor("Voting Intentions Report - May 2026", "/files/no-federal-word.pdf"),
  ].join("\n");
  assert.deepEqual(listFederalReports(html), [
    { ym: "2026-02",
      url: "https://www.emrs.com.au/sites/default/files/documents/2026-02/EMRS%20-%20Federal%20Voting%20Intentions%20Report%20-%20February%202026.pdf",
      title: "EMRS - Federal Voting Intentions Report - February 2026", variants: 1 },
    { ym: "2026-08", url: "https://www.emrs.com.au/sites/default/files/documents/aug-2026.pdf",
      title: "Federal and State Voting Intentions Report - August 2026", variants: 1 },
  ], "federal reports only: <b>/<em> wrapping reads, relative hrefs absolutise, " +
     "state-only / media-release / pre-first-wave / non-PDF / no-'report' links stay out");
}
{
  const html = [
    anchor("Federal Voting Intentions Report - March 2026", "/files/mar-2026.pdf"),
    anchor("Federal Voting Intentions Report - March 2026 - FINAL", "/files/mar-2026-FINAL.pdf"),
  ].join("\n");
  const got = listFederalReports(html);
  assert.equal(got.length, 1, "one row per wave month");
  assert.equal(got[0].url, "https://www.emrs.com.au/files/mar-2026.pdf", "page order keeps the first twin");
  assert.equal(got[0].variants, 2, "the re-hosted twin is noted");
}

// ---- fieldworkOf ---------------------------------------------------------------
assert.deepEqual(
  fieldworkOf("The survey was conducted from the 16th to the 19th of February 2026.", "2026-02"),
  { date: "2026-02-19", dateStart: "2026-02-16", problems: [] },
  "the exec-summary form, ordinals and 'the … of' glued in");
assert.deepEqual(
  fieldworkOf("The most recent Omnibus survey was conducted from 17-18 August 2026 utilising EMRS' in-house call centre.",
    "2026-08"),
  { date: "2026-08-18", dateStart: "2026-08-17", problems: [] },
  "the methodology bullet's hyphen form");
{
  // the agreeing pair a healthy report prints: exec summary + methodology
  const fw = fieldworkOf(
    "The survey was conducted from the 16th to the 19th of February 2026.\n" +
    "•   The survey was conducted from 16-19 February 2026 utilising EMRS' in-house call centre (44%), and online panels (56%),",
    "2026-02");
  assert.deepEqual(fw, { date: "2026-02-19", dateStart: "2026-02-16", problems: [] },
    "two conducted lines in agreement stay clean");
}
{
  // the Aug-2026 wave's own trap: the exec summary says 2025, the
  // methodology bullet 2026 — the typo ends in the wrong year and dies
  const fw = fieldworkOf(
    "The current survey was conducted from the 17th to the 18th of August 2025.\n" +
    "•   The most recent Omnibus survey was conducted from 17-18 August 2026 utilising EMRS' in-house call centre and online, ensuring",
    "2026-08");
  assert.deepEqual(fw, { date: "2026-08-18", dateStart: "2026-08-17", problems: [] },
    "the title-month filter kills the exec-summary typo");
  const typoOnly = fieldworkOf(
    "The current survey was conducted from the 17th to the 18th of August 2025.", "2026-08");
  assert.equal(typoOnly.date, null, "a typo-only report finds no fieldwork");
  assert.equal(typoOnly.problems.length, 1, "and says why");
  assert.ok(typoOnly.problems[0].includes("no fieldwork span ending in the title month 2026-08"),
    "the problem names the title month");
  assert.ok(typoOnly.problems[0].includes("2025-08-18"), "and shows the rejected candidate");
}
{
  const disagree = fieldworkOf(
    "The survey was conducted from the 16th to the 19th of February 2026.\n" +
    "The survey was conducted from the 17th to the 19th of February 2026.", "2026-02");
  assert.ok(disagree.problems[0].includes("fieldwork lines disagree"),
    "same-month conducted lines that disagree are a problem, never a coin flip");
}
assert.deepEqual(
  fieldworkOf("conducted from the 27th of August to the 2nd of September 2026", "2026-09"),
  { date: "2026-09-02", dateStart: "2026-08-27", problems: [] },
  "a month-straddling window files under its END month");
assert.equal(fieldworkOf("no fieldwork sentence here", "2026-05").date, null,
  "no conducted line, no date");

// ---- federalPageOf: whole-state page vs electorate cuts ------------------------
const fpage = (base) =>
  `If a federal election were being held today, who would you vote for? Would it be...\n` +
  `Base: ${base}`;
{
  const text = "cover" + "\f" + fpage("All respondents in Bass (n=182)") + "\f" +
    fpage("All respondents who gave a vote preference (n=968)");
  const fp = federalPageOf(text);
  assert.deepEqual(fp.problems, [], "a whole-state base behind electorate cuts still finds its page");
  assert.equal(fp.sample, 968, "the gave-a-preference base is the sample");
  assert.equal(fp.pageNo, 3, "1-based page number");
}
assert.equal(federalPageOf("\f" + fpage("All respondents in Bass (n=182)") + "\fmore pages").sample, null,
  "an electorate base line (…in Bass) never qualifies as the federal page");
assert.equal(federalPageOf("\f" + fpage("All respondents (n=1000)")).page, null,
  "a base with no gave-a-preference clause never qualifies");

// ---- primariesOf: the chart label lines -----------------------------------------
// -layout glues same-baseline prose ahead of the labels, as the real pages
// print them:
const LABELS_BLOCK = [
  "indicate a preference for the Greens,                                 ",
  "indicate a preference for One Nation.                The Labor Party                                           30%",
  "were more likely to indicate a                            The Greens                         13%",
  "and those aged 70 or older (20%) were              The National Party           1%",
  "Tasmanian residents in the west and       Pauline Hanson's One Nation                                    24%",
  "                                                      An Independent                       12%",
  "                                              Some other minor party           1%",
  "                                                     The Liberal Party                            18%",
].join("\n");
{
  const p = primariesOf(LABELS_BLOCK);
  assert.deepEqual([p.alp, p.lnp, p.grn, p.onp, p.ind, p.oth], [30, 19, 13, 24, 12, 1],
    "labels trailing wrapped prose still read (the Aug-2026 failure that shaped the anchors)");
  assert.equal(p.natFolded, 1, "the National Party line folds into lnp");
  assert.deepEqual(p.problems, []);
}
{
  const noNat = primariesOf(LABELS_BLOCK.replace(/\n.*The National Party.*$/m, ""));
  assert.equal(noNat.lnp, 18, "no National Party line: lnp is the Liberal figure alone");
  assert.equal(noNat.natFolded, null, "nothing folded");
}
{
  const missing = primariesOf(LABELS_BLOCK.replace(/Pauline Hanson's One Nation\s+\d+%/, ""));
  assert.ok(missing.problems.some((s) => s.includes('"onp"')), "a missing ONP label is a problem");
  assert.equal(missing.alp, null, "any missing label nulls the whole read");
}
{
  const proseOnly = primariesOf(
    "23 said they would vote Liberal (17%), One Nation or the Greens 23 per cent, while the Liberals lead.");
  assert.notEqual(proseOnly.problems.length, 0, "prose mentions of figures never read as labels");
}
assert.equal(primariesOf("The Labor Party 30% extra words").alp, null,
  "trailing junk after the % kills the label line");
assert.equal(primariesOf(LABELS_BLOCK.replace("30%", "30.5%")).alp, 30.5, "a decimal figure reads");
{
  const curly = LABELS_BLOCK.replace(/Pauline Hanson's One Nation\s+\d+%/, "Pauline Hanson’s One Nation 24%");
  assert.equal(primariesOf(curly).onp, 24, "the cache's curly-apostrophe One Nation form reads");
  assert.deepEqual(primariesOf(curly).problems, []);
}

// ---- tppOf: the Labor-v-Liberal section, never the v-One-Nation one -------------
const aug2pp = [
  "                                        Two Party Preferred Order – Labor and Liberal",
  "Respondents who would vote for the       Labor Ahead                                                                                              57%",
  "Nation were more likely to place the    Liberal Ahead                                                                         43%",
  "                                        Two Party Preferred Order – Labor and One Nation",
  "                                                  Labor Ahead                                                                                                63%",
  " One Nation Ahead                                                                                        37%",
].join("\n");
{
  const t = tppOf(aug2pp);
  assert.deepEqual([t.alp, t.lnp, t.problems], [57, 43, []],
    "the Aug-2026 'Preferred Order – Labor and Liberal' heading, with the v-One-Nation section sliced off");
}
{
  const feb = aug2pp
    .replace("Two Party Preferred Order – Labor and Liberal", "Two Party Preferred – Labor v Liberal")
    .replace("57%", "60%").replace("43%", "40%");
  assert.deepEqual(tppOf(feb), { alp: 60, lnp: 40, problems: [] },
    "the Feb-2026 'Preferred – Labor v Liberal' heading form");
}
{
  const onlyOn = ["Two Party Preferred Order – Labor and One Nation", "Labor Ahead 63%", "One Nation Ahead 37%"].join("\n");
  const t = tppOf(onlyOn);
  assert.ok(t.problems[0].includes("Labor v|and Liberal"), "a report with only the v-One-Nation section files no 2PP");
  assert.equal(t.alp, null);
}
{
  const noFigs = "Two Party Preferred – Labor v Liberal\nsome prose without figures";
  assert.ok(tppOf(noFigs).problems[0].includes("didn't parse"), "a figureless section is a problem");
}

// ---- parseWave on a synthetic full report ----------------------------------------
{
  const report = [
    "\fEMRS State and Federal Voting Intentions Report",
    "The current survey was conducted from the 17th to the 18th of August 2025.",
    "•   The most recent Omnibus survey was conducted from 17-18 August 2026 utilising EMRS' in-house call centre and online, ensuring",
    "\f" + fpage("All respondents in Bass (n=182)") + "\nThe Labor Party                                            34%",
    "\f" + fpage("All respondents who gave a vote preference (n=968)") + "\n" + LABELS_BLOCK.replace("30%", "29%")
      .replace("18%", "16%").replace("13%", "15%").replace("24%", "26%").replace("24%", "26%"),
    "\f" + aug2pp,
  ].join("\n");
  const w = parseWave(report, "2026-08");
  assert.deepEqual(w.problems, [], "a healthy synthetic report parses clean");
  assert.deepEqual([w.date, w.dateStart, w.sample], ["2026-08-18", "2026-08-17", 968]);
  assert.deepEqual([w.alp, w.lnp, w.grn, w.onp, w.ind, w.oth], [29, 17, 15, 26, 12, 1],
    "primaries read from the whole-state page only, the Bass page's 34% beside the point");
  assert.deepEqual([w.tpp_alp, w.tpp_lnp], [57, 43]);
}

// ---- data/polls.json carries exactly these rows -----------------------------------
{
  const D = JSON.parse(fs.readFileSync("data/polls.json", "utf8"));
  const rows = D.polls.filter((p) => p.pollster === "EMRS (Tas)");
  assert.equal(rows.length, waves.length, "a poll row per cached federal wave");
  for (const w of waves) {
    const row = rows.find((r) => r.date === w.sidecar.date);
    assert.ok(row, `${w.ym}: row dates match exactly`);
    assert.deepEqual(
      [row.dateStart, row.sample, row.alp, row.lnp, row.grn, row.onp, row.ind, row.oth, row.tpp_alp, row.tpp_lnp],
      [w.sidecar.dateStart, w.sidecar.sample, w.sidecar.primaries.alp, w.sidecar.primaries.lnp,
       w.sidecar.primaries.grn, w.sidecar.primaries.onp, w.sidecar.primaries.ind, w.sidecar.primaries.oth,
       w.sidecar.tpp.alp, w.sidecar.tpp.lnp],
      `${w.ym}: the canon row is the sidecar's parse`);
    assert.equal(row.url, w.sidecar.url, `${w.ym}: the row links the report PDF`);
  }
  assert.equal(rows.find((r) => r.date === "2026-02-19").published, "2026-02-20",
    "the canon rows keep their hand-entered published stamps …");
  assert.equal(rows.find((r) => r.date === "2026-08-18").published, "2026-08-22",
    "… never the sidecar's first-seen date");
}

console.log("test-emrs: all OK");
