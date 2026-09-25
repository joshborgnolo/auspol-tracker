/* issues-parse.mjs – reading pollsters' issue tables: what voters say matters
   (salience) and which party they think is best on each issue (ownership).
   Pure: text or rows in, figures out. Used by .build/issues.mjs, pinned by
   .build/test-issues.mjs against the cached reports.

   Every house words its issues its own way. ISSUES is the one list of
   issues; each house's labels map onto it only where they are the same
   issue ("The rate of immigration", "Immigration and refugees" and
   "Immigration" are one issue; RedBridge's "Climate change" and "The
   environment" are two, since it asks both). A label this doesn't know is
   left out and reported, never guessed onto an issue. */
import { RB_SECTIONS, rbLabel } from "./crosstab-parse.mjs";

export const ISSUES = {
  col: "Cost of living", housing: "Housing", health: "Health",
  economy: "Economic management", immigration: "Immigration", climate: "Climate change",
  crime: "Crime", security: "National security", tax: "Tax", debt: "Government debt",
  energy: "Energy", education: "Education", environment: "The environment",
  transport: "Transport", jobs: "Jobs and wages", welfare: "Welfare",
  ir: "Industrial relations", finances: "Managing the finances", foreign: "Foreign affairs",
  indigenous: "Indigenous affairs", disasters: "Natural disasters",
  inequality: "Inequality", pensions: "Pensions and older Australians",
};

const norm = (s) => String(s).replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();

/* RedBridge prints the same issue under slightly different labels in its
   summary tables ("The rate of immigration") and its table titles
   ("immigration", "the rate of immigration"). */
const RB_ISSUE = {
  "cost of living": "col", healthcare: "health", "housing affordability": "housing",
  "crime and public safety": "crime", "the rate of immigration": "immigration", immigration: "immigration",
  "climate change": "climate", "the environment": "environment", "economic management": "economy",
  "national security": "security", "education and training": "education", "tax reform": "tax",
  "government debt": "debt", "energy reliability": "energy", "roads and transport": "transport",
};
export const rbIssue = (label) => RB_ISSUE[norm(label)] || null;

export const RS_ISSUE = {
  "economic management": "economy", "national security and defence": "security",
  "healthcare and aged care": "health", education: "education", "transport infrastructure": "transport",
  "industrial relations": "ir", "managing the finances": "finances",
  "issues affecting aboriginal and torres strait islander people": "indigenous",
  "issues affecting aborigines and torres strait islanders": "indigenous",
  "issues affecting indigenous australians and torres strait islanders": "indigenous",
  "the environment and climate change": "climate", "jobs and wages": "jobs",
  "welfare and benefits": "welfare", "energy, inc. renewables and nuclear": "energy",
  "immigration and refugees": "immigration", "keeping the cost of living low": "col",
  "foreign affairs and trade": "foreign", "is best able to handle natural disasters": "disasters",
  "crime and anti-social behaviour": "crime", "housing affordability and rent": "housing",
};
const RS_ANSWER = { "the liberals": "lnp", labor: "alp", "one nation": "onp", "someone else": "oth", undecided: "unsure" };

export const YG_ISSUE = {
  "cost of living": "col", immigration: "immigration", "housing affordability": "housing",
  "managing the economy and debt": "economy", "climate change": "climate", healthcare: "health",
  "growing inequality": "inequality", "decent jobs and working rights": "jobs",
  "pensions and older australians": "pensions", "security and defence": "security",
  "international affairs and trade": "foreign", "education and childcare": "education",
};
const YG_ANSWER = { labor: "alp", coalition: "lnp", "one nation": "onp", "the greens": "grn", greens: "grn", "don't know": "unsure" };

// ---- RedBridge ------------------------------------------------------------------------
const lines = (txt) => txt.split("\n");
const MONTH = /(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})/g;
// a row: an optional page number the text layer glued on, a label, then cells
const ROW = /^(?:\d+\s+)?([A-Za-z][A-Za-z0-9 ,.'’/\-]*?)\s{2,}((?:-?\d+|-)(?:\s+(?:-?\d+|-))*)$/;
const cell = (s) => (s === "-" ? null : Number(s));   // "-" is a cell left empty; -2 a change

/* The summary table of issue salience (April 2026 on): each issue's share
   ranking it 1st, 2nd and 3rd, and in the top three, for the report's wave
   and the one before it. { months: ["2026-08", "2026-07"], issues: { col:
   [cur, prev] } } with each side {r1, r2, r3, top3} or null; unknown labels
   in `unknown`. Null when the report has no such table. */
export function rbSalienceSummary(txt) {
  const ls = lines(txt);
  const i = ls.findIndex((l) => /Table \d+: Issue salience in the two most recent waves/.test(l));
  if (i < 0) return null;
  const months = monthsNear(ls, i);
  if (months.length !== 2) return null;
  const issues = {}, unknown = [];
  for (let j = i + 1; j < Math.min(ls.length, i + 40); j++) {
    const t = ls[j].trim();
    if (/^(Table|Figure) \d+:/.test(t)) break;
    const m = t.match(ROW);
    if (!m) continue;
    const label = m[1].trim(), nums = m[2].split(/\s+/).map(cell);
    if (/^(something else|none of these|issue)$/i.test(label)) continue;
    const k = rbIssue(label);
    if (!k) { unknown.push(label); continue; }
    if (nums.length < 8) { unknown.push(label + " (short row)"); continue; }
    const side = (a) => (a.every((v) => v != null) ? { r1: a[0], r2: a[1], r3: a[2], top3: a[3] } : null);
    issues[k] = [side(nums.slice(0, 4)), side(nums.slice(4, 8))];
  }
  return Object.keys(issues).length ? { months, issues, unknown } : null;
}

/* The summary table of the party best able to deal with each issue (April
   2026 on), both waves. Columns are read off the header, in the order it
   prints them; the reader knows the 2026 layout (Labor, Liberal, National,
   One Nation, Greens, All about equal, None of these, Not sure) and stops at
   any other. Shares keyed alp, lnp (Liberal and National summed – the site's
   Coalition), onp, grn, equal, none, unsure. */
const RB_OWN_COLS = ["alp", "lib", "nat", "onp", "grn", "equal", "none", "unsure"];
export function rbOwnershipSummary(txt) {
  const ls = lines(txt);
  const i = ls.findIndex((l) => /Table \d+: Which of the following do you believe is best able to deal with/.test(l));
  if (i < 0) return null;
  const months = monthsNear(ls, i);
  if (months.length !== 2) return null;
  const head = ls.slice(i + 1, i + 8).find((l) => /^\s*Issue\s+Labor\s/.test(l));
  if (!head || !/Issue\s+Labor\s+Liberal\s+National\s+One\s+Greens\s+All\s+None\s+Not\s+Labor/.test(head.trim().replace(/\s+/g, " "))) return null;
  const issues = {}, unknown = [];
  for (let j = i + 1; j < Math.min(ls.length, i + 40); j++) {
    const t = ls[j].trim();
    if (/^(Table|Figure) \d+:/.test(t)) break;
    const m = t.match(ROW);
    if (!m) continue;
    const label = m[1].trim(), nums = m[2].split(/\s+/).map(cell);
    const k = rbIssue(label);
    if (!k) { if (!/^(issue|nation|equal|these|sure)$/i.test(label)) unknown.push(label); continue; }
    const side = (a) => (a.length === 8 && a.every((v) => v != null) ? rbShares(a) : null);
    issues[k] = [side(nums.slice(0, 8)), side(nums.slice(8, 16))];
  }
  return Object.keys(issues).length ? { months, issues, unknown } : null;
}
const rbShares = (a) => {
  const o = Object.fromEntries(RB_OWN_COLS.map((c, n) => [c, a[n]]));
  return { alp: o.alp, lnp: o.lib + o.nat, onp: o.onp, grn: o.grn, equal: o.equal, none: o.none, unsure: o.unsure };
};
/* the two "Month Year" labels printed over a two-wave table, newest first */
function monthsNear(ls, i) {
  for (let j = i + 1; j < Math.min(ls.length, i + 6); j++) {
    const found = [...ls[j].matchAll(MONTH)];
    if (found.length >= 2) return found.slice(0, 2).map((f) => `${f[2]}-${String(MONTH_N[f[1]]).padStart(2, "0")}`);
  }
  return [];
}
const MONTH_N = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8,
                  September: 9, October: 10, November: 11, December: 12 };

/* Every issue's table by group, as RedBridge prints one per issue for
   salience ("The salience of cost of living as a federal political issue,
   by demographic characteristics") and for the best party ("The party best
   suited to deal with cost of living, …"). { salience: { col: { total, dims
   } }, ownership: { … } }. Salience rows are {r1, r2, r3, not}; ownership
   rows are shares as rbOwnershipSummary keys them. The best-party header
   has printed the Coalition as one option (December 2025: "The Liberal
   National Party Coalition", seven columns) and as its two parties (January
   2026 on, eight) – read off the header, anything else is skipped. */
const RB_VOTE = { labor: "Labor", coalition: "Coalition", liberal: "Liberal", "clp/lnp/nat": "Nationals, LNP and CLP",
                  "one nation": "One Nation", greens: "Greens", "other parties and candidates": "Others",
                  "undecided / will not vote": "Undecided" };
const SECTIONS = { ...RB_SECTIONS, "Federal vote intention": "vote" };
export function rbGroupTables(txt) {
  const ls = lines(txt);
  const out = { salience: {}, ownership: {}, unknown: [] };
  for (let i = 0; i < ls.length; i++) {
    const sal = ls[i].match(/Table \d+: The salience of (.+?) as a federal political issue, by demographic characteristics/);
    const own = ls[i].match(/Table \d+: The party best (?:suited|able) to (?:deal|handle) with (.+?), by demographic characteristics/);
    if (!sal && !own) continue;
    const k = rbIssue((sal || own)[1]);
    if (!k) { out.unknown.push((sal || own)[1]); continue; }
    let cols;
    if (sal) cols = 4;
    else {
      const head = ls.slice(i + 1, i + 4).join(" ").replace(/\s+/g, " ");
      cols = /The Labor Party The Liberal Party The National/.test(head) ? 8
        : /The Labor Party The Liberal National/.test(head) ? 7 : 0;
      if (!cols) { out.unknown.push(`${(sal || own)[1]} (best-party header)`); continue; }
    }
    const t = groupRows(ls, i + 1, cols);
    if (!t) continue;
    const shape = sal ? (a) => ({ r1: a[0], r2: a[1], r3: a[2], not: a[3] })
      : cols === 8 ? rbShares
      : (a) => ({ alp: a[0], lnp: a[1], onp: a[2], grn: a[3], equal: a[4], none: a[5], unsure: a[6] });
    const dims = Object.fromEntries(Object.entries(t.dims).map(([d, gs]) =>
      [d, Object.fromEntries(Object.entries(gs).map(([g, a]) => [g, shape(a)]))]));
    (sal ? out.salience : out.ownership)[k] = { total: t.total ? shape(t.total) : null, dims };
  }
  return out;
}
function groupRows(ls, from, cols) {
  const dims = {};
  let cur = null, total = null;
  for (let j = from; j < Math.min(ls.length, from + 60); j++) {
    const t = ls[j].trim().replace(/^\d+\s+(?=[A-Z])/, "");
    if (!t) continue;
    if (/^(Table|Figure) \d+:/.test(t)) break;
    if (SECTIONS[t]) {
      if (dims[SECTIONS[t]]) break;               // a section seen again is the next table
      cur = SECTIONS[t]; continue;
    }
    const m = t.match(ROW);
    if (!m) { if (Object.keys(dims).length && /^[A-Z][a-z]/.test(t) && !/^(Party|Nation|Hanson|equal|Coalition)/.test(t)) break; continue; }
    const nums = m[2].split(/\s+/).map(cell);
    if (nums.length !== cols || nums.some((v) => v == null)) continue;
    const label = m[1].trim();
    if (/^all voters$/i.test(label)) { total = nums; continue; }
    if (!cur) continue;
    const g = cur === "vote" ? RB_VOTE[norm(label)] : rbLabel(cur, label);
    if (!g) continue;
    (dims[cur] ||= {})[g] = nums;
  }
  return total || Object.keys(dims).length ? { total, dims } : null;
}

// ---- Resolve ------------------------------------------------------------------------
/* data/resolve-political-monitor.csv's party_attributes rows ("Which party
   you think would perform best in each of these areas") → one wave per date:
   { date, issues: { col: { lnp, alp, onp?, oth, unsure } }, unknown, clash }.
   What the file holds, checked by hand (Sep 2026):
     - An item all of whose options are 0 wasn't asked that month and is
       left out (energy until mid-2024, for one).
     - Some items appear twice, from the two sources extract-resolve-rpm.mjs
       merges: the interactive's decimals and an older copy's whole numbers
       (Indigenous affairs under three labels). The decimals win; the whole
       numbers must match them within rounding, or the item is a clash.
     - One Nation joined the options in July 2026, but the older copy folds
       it into "someone else": July's Indigenous item reads someone else 33
       in whole numbers against 12.08 plus One Nation 21.07 in decimals, and
       July's other items carry that folded 30 beside the decimal One Nation
       figure, counting it twice (economic management sums to 121). Where the
       other options make 100 on their own and someone else is at least One
       Nation's figure, One Nation is taken back out of someone else. */
const isWhole = (v) => Math.abs(v - Math.round(v)) < 1e-9;
export function resolveOwnership(csvText) {
  const rows = csvText.split("\n");
  const head = parseCsvLine(rows[0]);
  const at = (name) => head.indexOf(name);
  const [iD, iA, iK, iT, iV] = ["dataset", "answer", "key", "date", "value_pct"].map(at);
  const byDate = new Map(), unknown = new Set();
  for (const r of rows.slice(1)) {
    if (!r.startsWith("party_attributes,")) continue;
    const c = parseCsvLine(r);
    if (c[iD] !== "party_attributes") continue;
    const k = RS_ISSUE[norm(c[iK])], a = RS_ANSWER[norm(c[iA])];
    if (!k) { unknown.add(c[iK]); continue; }
    if (!a) { unknown.add("answer: " + c[iA]); continue; }
    const date = c[iT].slice(0, 10);
    const w = byDate.get(date) || {};
    ((w[k] ||= {})[c[iK]] ||= {})[a] = Number(c[iV]);        // item → label → answer
    byDate.set(date, w);
  }
  const clash = [], waves = [];
  for (const [date, items] of [...byDate.entries()].sort()) {
    const issues = {}, notes = [];
    for (const [k, byLabel] of Object.entries(items)) {
      const sets = Object.values(byLabel).filter((sh) => Object.values(sh).some((v) => v !== 0));
      if (!sets.length) continue;                                     // not asked that month
      // the set with the most decimals is the interactive's own
      const pick = sets.slice().sort((x, y) =>
        Object.values(y).filter((v) => !isWhole(v)).length - Object.values(x).filter((v) => !isWhole(v)).length)[0];
      const sh = { ...pick };
      for (const other of sets) {
        if (other === pick) continue;
        const off = Object.keys(other).filter((q) => {
          const want = q === "oth" && sh.onp != null && other.onp == null ? sh.oth + sh.onp : sh[q];
          return want == null || Math.abs(other[q] - want) > 0.51;
        });
        if (off.length) clash.push(`${date} ${k} ${off.join("/")}`);
      }
      if (sh.onp != null && sh.oth != null) {
        const without = Object.values(sh).reduce((a, b) => a + b, 0) - sh.onp;
        if (Math.abs(without - 100) <= 3 && sh.onp > 3 && sh.oth >= sh.onp - 0.51) {
          sh.oth = Math.round((sh.oth - sh.onp) * 100) / 100;
          notes.push(k);
        }
      }
      issues[k] = sh;
    }
    if (Object.keys(issues).length) waves.push({ date, issues,
      ...(notes.length ? { note: `One Nation taken back out of someone else (${notes.length} items)` } : {}) });
  }
  return { waves, unknown: [...unknown], clash };
}
function parseCsvLine(s) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

// ---- YouGov -------------------------------------------------------------------------
/* A News24 Pulse chart "Which party is best at handling…": rows are issues,
   columns Labor, Coalition, One Nation, The Greens and Don't know. Found by
   its shape – an issue label on every row this knows, the party columns,
   each row summing to about 100 – and its question text, never by its
   position among the article's charts. Takes the chart's infographicData. */
export function ygIssuesOf(data) {
  const ents = data?.elements?.content?.content?.entities || {};
  const texts = Object.values(ents).map((e) => JSON.stringify(e?.props || {})).join(" ");
  if (!/best at handling/i.test(texts)) return null;
  const fw = texts.match(/YouGov \((\w+) (\d{1,2})[–-](?:(\w+) )?(\d{1,2}), (\d{4})\)/);
  for (const e of Object.values(ents)) {
    const cd = e?.props?.chartData;
    if (e?.type !== "CHART" || !cd?.data) continue;
    for (const sheet of cd.data) {
      if (!Array.isArray(sheet) || !Array.isArray(sheet[0])) continue;
      const rows = sheet.map((r) => r.map((c) => String(c?.value ?? c ?? "").trim()));
      const cols = rows[0].map((h) => YG_ANSWER[norm(h)] || null);
      if (!["alp", "lnp", "onp", "unsure"].every((k) => cols.includes(k))) continue;
      const issues = {}, unknown = [];
      for (const r of rows.slice(1)) {
        if (!r[0]) continue;
        const k = YG_ISSUE[norm(r[0])];
        if (!k) { unknown.push(r[0]); continue; }
        const sh = {};
        cols.forEach((c, n) => { if (c) sh[c] = Number(r[n]); });
        issues[k] = sh;
      }
      if (Object.keys(issues).length >= 5) {
        return { issues, unknown, fieldwork: fw ? fw.slice(1).join(" ") : null,
                 question: "Which party is best at handling…" };
      }
    }
  }
  return null;
}

// ---- the gate --------------------------------------------------------------------------
/* A salience row: its three ranks add to its top three, give or take a
   point of rounding. A group row: ranks and not-ranked add to 100 (±2). */
export function salienceProblem(r) {
  if (!r) return "no figures";
  const v = [r.r1, r.r2, r.r3, r.top3 ?? r.not];
  if (v.some((x) => !Number.isFinite(x) || x < 0 || x > 100)) return "a figure outside 0–100";
  if (r.top3 != null && Math.abs(r.r1 + r.r2 + r.r3 - r.top3) > 1) return `ranks ${r.r1}+${r.r2}+${r.r3} don't make top three ${r.top3}`;
  if (r.not != null && Math.abs(r.r1 + r.r2 + r.r3 + r.not - 100) > 2) return `ranks and not ranked sum to ${r.r1 + r.r2 + r.r3 + r.not}`;
  return null;
}
/* An ownership row: every option's share adds to 100 (±3: RedBridge rounds
   eight cells). A row with no Labor, Coalition or unsure figure isn't a
   row of this question. */
export function ownershipProblem(sh) {
  if (!sh) return "no figures";
  const v = Object.values(sh);
  if (v.some((x) => !Number.isFinite(x) || x < 0 || x > 100)) return "a share outside 0–100";
  if (sh.alp == null || sh.lnp == null) return "no Labor or Coalition figure";
  const t = v.reduce((a, b) => a + b, 0);
  if (Math.abs(t - 100) > 3) return `shares sum to ${Math.round(t * 10) / 10}`;
  return null;
}
