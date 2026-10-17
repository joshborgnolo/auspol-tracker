/* ---- Beyond the vote: the page's curation and its figures ------------------
   The /beyond-the-vote/ page (the ☰ menu page that replaced the /ad-hocs/
   catalogue on 2026-10-18) shows what the pollsters ask beyond voting
   intention: the questions worth a reader's time, by topic, with the
   recurring ones charted. Three layers decide what a reader sees:

   1. adhoc-themes.mjs files every store question under a topic, or cuts it.
   2. FEATURES below picks, per topic, the trackers and cards that lead it,
      in reading order. A featured card names its store entries exactly
      (id, house, wave), so a store edit that drops one fails the build.
   3. Everything else filed under a topic joins its "More questions" list,
      newest first, with the figures as each wave printed them.

   Every number comes from the stores, read through one set of rules:
   - a card's main table is the all-voters one (Essential's "All voters"
     table where the store's first table is a single-answer slice);
   - answers are sorted into the agreeing side, the disagreeing side and the
     middle (neither, unsure, don't know) by their wording, unless the card
     names its sides; a store's TOTAL row stands in for a side only when the
     side's own answers are missing;
   - figures are never rescaled: a bar is drawn on a 0-100 track and keeps
     whatever the published shares leave over.

   The margin rule behind every "level": a lead of one side over the other is
   called only when it clears its 95% margin, 1.96 x sqrt((p + q - (p - q)^2)
   / n_eff) for shares p and q of one sample (the two move against each
   other, so the margin is wider than either share's own). n_eff is the
   pollster's published effective sample, or its sample over the site's
   design effect (gen-data's HL_DEFF) where none is published; a card with no
   published sample names no lead or level at all. Two readings of the same
   question (a tracker's first and latest) differ only when the gap clears
   1.96 x sqrt(se1^2 + se2^2). */

import fs from "node:fs";
import path from "node:path";
import { THEMES, themeOf } from "./adhoc-themes.mjs";

/* ---- the eight stores, read into one shape ----------------------------------
   The stores are hand-curated research products, each on its own pipeline
   and commit; this reshapes them to one entry shape and drops what the page
   never reads (RedBridge's verification haystacks, News24's embed ids). No
   rewording happens here: questions, answers and notes travel verbatim. An
   absent store (a fresh clone ahead of its first landing) reads as empty;
   a present-but-broken one throws. */
export function readStores(root) {
  const read = (f, pick) => {
    const p = path.join(root, "data", f);
    if (!fs.existsSync(p)) { console.log("  note: data/" + f + " absent – its questions ride the next landing"); return []; }
    return pick(JSON.parse(fs.readFileSync(p, "utf8")));
  };
  const entries = [];
  /* YouGov (News24), Newspoll, DemosAU: .one_offs, data.tables/data.prose,
     fieldwork{start,end}, articleUrl */
  for (const [house, file] of [["news24", "news24-one-offs.json"], ["newspoll", "newspoll-one-offs.json"], ["demosau", "demosau-one-offs.json"]]) {
    for (const e of read(file, (j) => j.one_offs || [])) {
      const tables = (e.data && e.data.tables || []).map((t) => ({ title: t.title || null, headers: t.headers || null, rows: t.rows || [] }));
      entries.push({ house, id: e.id, waveDate: e.waveDate,
        dateStart: e.fieldwork ? e.fieldwork.start : null, dateEnd: e.fieldwork ? e.fieldwork.end : null,
        sample: e.sample ?? null, sampleEff: e.sampleEff ?? null, published: e.published || null,
        question: e.question, note: e.note || null, url: e.articleUrl || null,
        tables, prose: (e.data && e.data.prose) || [] });
    }
  }
  /* RedBridge and SEC Newgate: .entries, tables of entities{name, values};
     SEC Newgate's wide tables carry a "columns" array as their headers */
  for (const [house, file] of [["redbridge", "redbridge-one-offs.json"], ["secnewgate", "secnewgate-one-offs.json"]]) {
    for (const e of read(file, (j) => j.entries || [])) {
      entries.push({ house, id: e.id, waveDate: e.waveDate, dateStart: e.dateStart || null, dateEnd: e.dateEnd || null,
        sample: e.sample ?? null, sampleEff: e.sampleEff ?? null, published: e.published || null,
        question: e.question, note: e.notes || null, url: e.url || null,
        tables: (e.tables || []).map((t) => ({ title: t.title || null, headers: t.columns || null,
          rows: (t.entities || []).map((en) => [en.name, ...(en.values || [])]) })),
        prose: [] });
    }
  }
  /* Essential, Resolve, Freshwater: .entries, tables already [label, ...values] */
  for (const [house, file] of [["essential", "essential-one-offs.json"], ["resolve", "resolve-one-offs.json"], ["freshwater", "freshwater-one-offs.json"]]) {
    for (const e of read(file, (j) => j.entries || [])) {
      entries.push({ house, id: e.id, waveDate: e.waveDate, dateStart: e.dateStart || null, dateEnd: e.dateEnd || null,
        sample: e.sample ?? null, sampleEff: e.sampleEff ?? null, published: e.published || null,
        question: e.question, note: e.notes || null, url: e.url || null,
        tables: (e.tables || []).map((t) => ({ title: t.title || null, headers: t.headers || null, rows: t.rows || [] })),
        prose: [] });
    }
  }
  /* every id must be filed (themeOf throws), before anything is drawn */
  for (const e of entries) themeOf(e.id);
  return entries;
}

export const HOUSES = {
  essential: { short: "Essential", full: "Essential Report" },
  resolve: { short: "Resolve", full: "Resolve Political Monitor" },
  secnewgate: { short: "SEC Newgate", full: "SEC Newgate Mood of the Nation" },
  news24: { short: "YouGov", full: "YouGov for News24" },
  newspoll: { short: "Newspoll", full: "Newspoll" },
  redbridge: { short: "RedBridge", full: "RedBridge/Accent" },
  freshwater: { short: "Freshwater", full: "Freshwater Strategy" },
  demosau: { short: "DemosAU", full: "DemosAU" },
};

const MONF = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthYear = (iso) => MONF[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4);
/* gen-data's dx: an exact decimal year, leap years 366 days long */
const dx = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  const yrLen = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 366 : 365;
  return y + (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000 / yrLen;
};
const num = (v) => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[%\s,]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const r1 = (v) => Math.round(v * 10) / 10;
const byDateDesc = (a, b) => (a < b ? 1 : a > b ? -1 : 0);

/* ---- answer wording → side ---------------------------------------------
   An answer's side turns on its first words once a store's TOTAL wrapper is
   off ("% TOTAL: Positive", "Support (total)"): the middle (neither, unsure,
   no difference) is tested first, then the disagreeing side (so "not likely"
   is never read as "likely"), then the agreeing side. */
const PRE = "(?:strongly |somewhat |mostly |very |quite |reasonably |fairly |generally |a little |a lot |much |significantly |definitely |slightly )?";
const RX = {
  x: /never heard|not heard|haven.?t heard|have not heard|not applicable|prefer not/i,
  m: /neither|neutral|unsure|undecided|don.?t know|do not know|not sure|no view|no opinion|no difference|no real difference|no change|no impact|won.?t have any impact|about the same|stay(?:s)? (?:about )?the same|unchanged|about right|depends|mixed/i,
  b: new RegExp("^" + PRE + "(?:oppose|disagree|disapprove|unfavourable|negative|bad|worse|less likely|unlikely|badly|poorly|weak|distrust|no\\b)|^not (?:likely|confident|important|well|at all|very|that)", "i"),
  a: new RegExp("^" + PRE + "(?:support|agree|approve|favourable|positive|good|better|more likely|likely|confident|important|well|strong|trust|yes\\b)", "i"),
  strong: /^(?:strongly|very|much|a lot|significantly|definitely|extremely|completely|totally)\b|not (?:likely|confident|important|well) at all|^not at all/i,
  summary: /^%?\s*total\b|^total:|\(total\)|^net\b|\bnet (?:agree|support|trust|positive|favourab|approve|awareness|expect)/i,
};
const core = (label) => String(label).replace(/^%?\s*total:?\s*/i, "").replace(/\s*\((?:total|per report intro)\)\s*$/i, "").trim();
/* a side's name, from its answers: the word the answer turned on, so
   "Strongly support" and "Support (total)" both name "support" */
const KEYWORDS = ["support", "oppose", "agree", "disagree", "approve", "disapprove", "favourable", "unfavourable",
  "positive", "negative", "good", "bad", "better", "worse", "yes", "no", "likely", "unlikely", "confident",
  "important", "trust", "distrust", "strong", "weak", "well", "badly"];
const nameOf = (label) => {
  const l = core(label || "").toLowerCase();
  return KEYWORDS.find((w) => new RegExp("(^|\\s)" + w + "\\b").test(l) && !(w === "no" && /\bno (?:view|difference|change|impact|opinion)/.test(l))) || null;
};
function classify(label, sides) {
  const c = core(label);
  if (sides) {
    for (const s of ["x", "m", "a", "b"]) {
      const r = sides[s];
      if (r && (r instanceof RegExp ? r.test(label) : r.includes(label) || r.includes(c))) return s;
    }
  }
  if (RX.x.test(c)) return "x";
  if (RX.m.test(c)) return "m";
  if (RX.b.test(c)) return "b";
  if (RX.a.test(c)) return "a";
  return "o";
}

/* ---- store access --------------------------------------------------------- */
function makeIndex(entries) {
  const byId = new Map();
  for (const e of entries) {
    if (!byId.has(e.id)) byId.set(e.id, []);
    byId.get(e.id).push(e);
  }
  for (const ws of byId.values()) ws.sort((a, b) => byDateDesc(a.waveDate, b.waveDate));
  const find = (ref) => {
    const ws = (byId.get(ref.id) || []).filter((e) => (!ref.house || e.house === ref.house) && (!ref.wave || e.waveDate === ref.wave));
    if (!ws.length) throw new Error(`beyond-the-vote: no store entry for ${JSON.stringify(ref)}`);
    return ws[0];
  };
  const waves = (id, house) => (byId.get(id) || []).filter((e) => !house || e.house === house);
  return { find, waves };
}

/* A table's own rows. The Essential extraction appends each question's
   crosstab blocks (by gender, age, vote) to its all-voters rows and prints
   some blocks twice; a table keeps only rows as wide as its header (or its
   first row), first copy of each label. */
function tableRows(t) {
  const rows = (t.rows || []).map((r) => (Array.isArray(r) ? r : [r]));
  if (!rows.length) return [];
  const width = t.headers && t.headers.length ? t.headers.length : rows[0].length;
  const seen = new Set();
  return rows.filter((r) => {
    if (r.length !== width) return false;
    const k = String(r[0]).trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
/* the all-voters table: Essential's "All voters" table where the store
   leads with a one-answer slice ("Strongly support", "Very positive"), else
   the first table with rows; an explicit pick (index or title) wins */
function mainTable(e, pick) {
  const ts = e.tables || [];
  if (typeof pick === "number") return ts[pick] || null;
  if (typeof pick === "string") return ts.find((t) => t.title === pick) || null;
  const all = ts.find((t) => /^all voters$/i.test(t.title || "") && (t.rows || []).length);
  return all || ts.find((t) => (t.rows || []).length) || null;
}
/* a card's [answer, share] pairs: spelt out, one row of a wide table read
   across its header (a crosstab's all-voters row), or the table itself */
function pairsOf(spec, e) {
  if (spec.rows) return spec.rows;
  const t = mainTable(e, spec.table);
  if (!t) throw new Error("beyond-the-vote: no table for " + e.id + " " + e.house + " " + e.waveDate);
  if (spec.wideRow != null) {
    const rows = tableRows(t);
    const r = typeof spec.wideRow === "number" ? rows[spec.wideRow] : rows.find((x) => String(x[0]).trim() === spec.wideRow);
    if (!r) throw new Error("beyond-the-vote: no row " + spec.wideRow + " in " + e.id);
    /* a printed net or change column is not an answer */
    return t.headers.slice(1).map((h, i) => [String(h).replace(/\s*%\s*$/, "").trim(), r[i + 1]])
      .filter(([h]) => !/^net\b|change|haven.?t heard|not heard/i.test(h));
  }
  return tableRows(t).map((r) => [r[0], r[spec.col || 1]]);
}
const neffOf = (e, deff) => e.sampleEff || (e.sample ? e.sample / deff : null);
const fieldOf = (e) => ({ start: e.dateStart || null, end: e.dateEnd || e.waveDate });
const sourceOf = (e) => ({ house: e.house, wave: e.waveDate, field: fieldOf(e), n: e.sample ?? null,
  neff: e.sampleEff ?? null, url: e.url || null });

/* ---- one question's split --------------------------------------------------
   [answer, share] pairs → the agreeing side's answers first (strongest
   outermost), the middle, the disagreeing side last (strongest outermost).
   A side's TOTAL row stands in only where its own answers are missing. A
   featured card is strict: an answer the rules cannot place stops the build
   until the card names its sides. */
function splitOf(pairs, opt = {}) {
  const items = pairs.map(([label, v]) => ({ label: String(label).trim(), v: num(v) })).filter((r) => r.v != null);
  const cls = items.map((r) => ({ ...r, side: classify(r.label, opt.sides), sum: RX.summary.test(r.label),
    strong: opt.strong ? opt.strong.test(r.label) : RX.strong.test(core(r.label)) }));
  const loose = cls.filter((r) => r.side === "o" && !r.sum);
  if (loose.length && opt.strict !== false) {
    throw new Error("beyond-the-vote: unplaced answers " + JSON.stringify(loose.map((r) => r.label)) + " in " + (opt.where || "?"));
  }
  /* a side's segments are its own answers; its total is the printed TOTAL
     where the pollster printed one (a restated figure is quoted exactly,
     even where the rounded answers sum a point away), else their sum */
  const tot = (xs) => r1(xs.reduce((s, r) => s + r.v, 0));
  const side = (s) => {
    const all = cls.filter((r) => r.side === s);
    const parts = all.filter((r) => !r.sum), sums = all.filter((r) => r.sum);
    return { segs: parts.length ? parts : sums.slice(0, 1), total: sums.length ? sums[0].v : tot(parts) };
  };
  const SA = side("a"), SB = side("b"), SM = side("m"), SX = side("x");
  const A = SA.segs, B = SB.segs, M = SM.segs.concat(loose), X = SX.segs;
  const a = SA.total, b = SB.total, m = r1(SM.total + tot(loose)), x = SX.total;
  /* a side drawn in two weights only when it has both a strong and a mild
     answer; otherwise every segment of it carries the full colour */
  const tones = (xs) => (xs.some((r) => r.strong) && xs.some((r) => !r.strong) ? (r) => (r.strong ? 2 : 1) : () => 2);
  const tA = tones(A), tB = tones(B);
  const disp = (l) => (opt.relabel && opt.relabel[l]) || core(l);
  const segs = [
    ...[...A].sort((p, q) => (q.strong ? 1 : 0) - (p.strong ? 1 : 0)).map((r) => ({ side: "a", tone: tA(r), label: disp(r.label), v: r.v })),
    ...(opt.keepMid
      ? M.map((r) => ({ side: "m", tone: 0, label: disp(r.label), v: r.v }))
      : M.length ? [{ side: "m", tone: 0, label: opt.midName || (M.length === 1 ? disp(M[0].label) : "Neither or unsure"), v: m }] : []),
    /* "never heard of them" is drawn too, hatched, between the middle and
       the disagreeing side: a share that never had a view */
    ...X.map((r) => ({ side: "x", tone: 0, label: disp(r.label), v: r.v })),
    ...[...B].sort((p, q) => (p.strong ? 1 : 0) - (q.strong ? 1 : 0)).map((r) => ({ side: "b", tone: tB(r), label: disp(r.label), v: r.v })),
  ];
  const names = opt.names || [nameOf((A.find((r) => !r.strong) || A[0] || {}).label) || "yes",
    nameOf((B.find((r) => !r.strong) || B[0] || {}).label) || "no"];
  return { segs, a, b, m, x, xLabel: X.length ? X.map((r) => disp(r.label)).join(", ") : null, names };
}
/* the lead and its margin; sig null where the sample is unpublished */
function leadOf(a, b, neff) {
  const lead = r1(a - b);
  if (!neff) return { lead, moe: null, sig: null };
  const p = a / 100, q = b / 100;
  const moe = 1.96 * 100 * Math.sqrt(Math.max(0, p + q - (p - q) ** 2) / neff);
  return { lead, moe: r1(moe), sig: Math.abs(lead) > moe };
}
const seNet = (a, b, neff) => 100 * Math.sqrt(Math.max(0, a / 100 + b / 100 - ((a - b) / 100) ** 2) / neff);
const seShare = (p, neff) => 100 * Math.sqrt((p / 100) * (1 - p / 100) / neff);

/* ---- block builders ------------------------------------------------------- */
const where = (e) => e.id + " / " + e.house + " / " + e.waveDate;

function buildSplit(spec, ix, deff) {
  const e = ix.find(spec.ref);
  const s = splitOf(pairsOf(spec, e).filter((p) => !spec.only || spec.only.includes(String(p[0]).trim())), { ...spec, where: where(e) });
  return { kind: "split", id: spec.key || spec.ref.id, title: spec.title, question: spec.question || e.question,
    note: spec.note || null, src: sourceOf(e), segs: s.segs, a: s.a, b: s.b, m: s.m, x: s.x, xLabel: s.xLabel,
    names: s.names, ...(spec.noLead ? { lead: null, moe: null, sig: null } : leadOf(s.a, s.b, neffOf(e, deff))),
    folds: foldsOf(e, mainTable(e, spec.table)) };
}

/* rows of splits: a battery's statements (one poll), or one question across
   several polls ("compare") or across one pollster's waves ("waves") */
function buildStack(spec, ix, deff) {
  const rows = [];
  if (spec.mode === "battery") {
    const e = ix.find(spec.ref);
    const t = mainTable(e, spec.table);
    const hdr = (t.headers || []).map((h) => String(h).replace(/\s*%\s*$/, "").trim());
    const netCol = hdr.findIndex((h, i) => i > 0 && /^net\b/i.test(h) && !/change/i.test(h));
    for (const r of tableRows(t)) {
      const label = String(r[0]).trim();
      if (spec.skipRows && spec.skipRows.includes(label)) continue;
      const cells = hdr.map((h, i) => [h, r[i]]).filter(([h], i) => i > 0 && !/^net\b|change/i.test(h));
      const s = splitOf(cells, { ...spec, where: where(e) });
      const printed = netCol > 0 ? num(r[netCol]) : null;
      rows.push({ label: (spec.relabel && spec.relabel[label]) || label, segs: s.segs, a: s.a, b: s.b, m: s.m,
        net: printed != null ? printed : r1(s.a - s.b), ...(spec.noLead ? { lead: null, moe: null, sig: null } : leadOf(s.a, s.b, neffOf(e, deff))) });
    }
    if (spec.sort !== false) rows.sort((p, q) => q.net - p.net);
    if (spec.reverse) rows.reverse();
    const s0 = splitOf(hdr.slice(1).filter((h) => !/^net\b|change/i.test(h)).map((h) => [h, 1]), { ...spec, where: where(e) });
    return { kind: "stack", mode: "battery", id: spec.key, title: spec.title, question: spec.question || e.question,
      note: spec.note || null, src: sourceOf(e), names: s0.names, legend: legendOf(s0.segs, spec), rows, show: spec.show || null };
  }
  const items = spec.mode === "waves"
    ? ix.waves(spec.ref.id, spec.ref.house).filter((e) => !(spec.skipWaves || []).includes(e.waveDate))
      .map((e) => ({ ref: { id: e.id, house: e.house, wave: e.waveDate } }))
    : spec.items;
  let legendSegs = null, names = null;
  for (const it of items) {
    const e = ix.find(it.ref);
    const s = splitOf(pairsOf({ ...spec, ...it }, e).filter((p) => !it.only || it.only.includes(String(p[0]).trim())), { ...spec, ...it, where: where(e) });
    if (!legendSegs || s.segs.length > legendSegs.length) legendSegs = s.segs;
    names = names || s.names;
    rows.push({ label: it.label || null, when: it.when || null, src: sourceOf(e), segs: s.segs, a: s.a, b: s.b, m: s.m,
      net: r1(s.a - s.b), ...leadOf(s.a, s.b, it.when ? null : neffOf(e, deff)), wording: it.wording || null });
  }
  rows.sort((p, q) => byDateDesc((p.when || p.src.field.end), (q.when || q.src.field.end)));
  names = spec.names || names;
  /* one pollster's readings of one question, however they were filed, read
     as its waves: a row a month, the latest set against the first */
  const oneHouse = spec.mode === "waves" || spec.byWave;
  return { kind: "stack", mode: oneHouse ? "waves" : spec.mode, id: spec.key, title: spec.title, question: spec.question || null,
    note: spec.note || null, src: oneHouse ? { house: rows[0].src.house } : null, names,
    legend: oneHouse ? legendOf(legendSegs, spec) : [{ side: "a", tone: 2, label: names[0] }, { side: "m", tone: 0, label: "neither or unsure" }, { side: "b", tone: 2, label: names[1] }],
    shades: !oneHouse && rows.some((r) => r.segs.some((g) => g.tone === 1)), rows,
    summary: spec.tally === null ? null : oneHouse ? wavesSummary(rows, names) : tallyOf(rows, spec.tally || [names[0] + " leads", names[1] + " leads"]) };
}
/* the key under a stack: one swatch per weight drawn */
function legendOf(segs, spec) {
  const out = [];
  for (const s of segs || []) {
    const k = s.side + s.tone;
    if (out.some((o) => o.k === k)) continue;
    out.push({ k, side: s.side, tone: s.tone, label: (spec.legend && spec.legend[k]) || s.label });
  }
  return out.map(({ side, tone, label }) => ({ side, tone, label }));
}
/* several pollsters on one question: in how many does each side lead by
   more than its margin. `tally` names each side's lead as a clause
   ("support leads", "opposition leads") so the count reads as a sentence. */
const NUMW = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
function tallyOf(rows, tally) {
  const n = rows.length, w = (k) => NUMW[k] || String(k);
  const aL = rows.filter((r) => r.sig === true && r.lead > 0).length, bL = rows.filter((r) => r.sig === true && r.lead < 0).length;
  const lev = rows.filter((r) => r.sig === false).length, unk = rows.filter((r) => r.sig == null).length;
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  if (aL === n || bL === n) return cap(aL === n ? tally[0] : tally[1]) + (n === 2 ? " in both polls." : " in all " + w(n) + " polls.");
  const parts = [];
  if (aL) parts.push(tally[0] + " in " + w(aL) + " of the " + w(n) + " polls");
  if (bL) parts.push(tally[1] + " in " + w(bL) + (aL ? "" : " of the " + w(n) + " polls"));
  const tail = [];
  if (lev) tail.push(lev === n ? "every one is level" : (lev === 1 ? "one is" : w(lev) + " are") + " level");
  if (unk) tail.push((unk === 1 ? "one has" : w(unk) + " have") + " no sample size on file to judge by");
  const s = (parts.length ? parts.join(" and ") + (tail.length ? "; " : "") : "") + tail.join(", and ");
  return cap(s) + ".";
}
/* one pollster's waves: the side ahead in the latest, against its share in
   the first, the change gated on its own margin */
function wavesSummary(rows, names) {
  if (rows.length < 2) return null;
  const last = rows[0], first = rows[rows.length - 1];
  const k = last.b > last.a ? "b" : "a", name = k === "a" ? names[0] : names[1];
  const nl = last.src.neff || (last.src.n && last.src.n / 1.6), nf = first.src.neff || (first.src.n && first.src.n / 1.6);
  const head = name.charAt(0).toUpperCase() + name.slice(1) + ": " + Math.round(last[k]) + "%";
  if (!nl || !nf || first.when) return null;
  const d = r1(last[k] - first[k]);
  const sig = Math.abs(d) > 1.96 * Math.hypot(seShare(last[k], nl), seShare(first[k], nf));
  return sig ? head + ", " + (d > 0 ? "up" : "down") + " from " + Math.round(first[k]) + "% in " + monthYear(first.src.field.end) + "."
    : head + ", much the same as the " + Math.round(first[k]) + "% in " + monthYear(first.src.field.end) + ".";
}

/* a ranked list: one share per answer, largest first */
function buildRank(spec, ix) {
  const e = ix.find(spec.ref);
  const rows = pairsOf(spec, e).map(([l, v]) => ({ label: (spec.relabel && spec.relabel[String(l).trim()]) || core(l), v: num(v) }))
    .filter((r) => r.v != null && !RX.summary.test(r.label) && !(spec.drop || []).includes(r.label));
  if (spec.sort !== false) rows.sort((p, q) => q.v - p.v);
  return { kind: "rank", id: spec.key || spec.ref.id, title: spec.title, question: spec.question || e.question,
    note: spec.note || null, src: sourceOf(e), base: spec.base || null, rows, show: spec.show || 6,
    folds: foldsOf(e, mainTable(e, spec.table)) };
}

/* net scores from zero (a message test's "net more willing") */
function buildNets(spec, ix) {
  const e = ix.find(spec.ref);
  const rows = pairsOf(spec, e).map(([l, v]) => ({ label: (spec.relabel && spec.relabel[String(l).trim()]) || String(l).trim().replace(spec.strip || /$^/, ""), v: num(v) }))
    .filter((r) => r.v != null).sort((p, q) => q.v - p.v);
  return { kind: "nets", id: spec.key || spec.ref.id, title: spec.title, question: spec.question || e.question,
    note: spec.note || null, src: sourceOf(e), unit: spec.unit, rows };
}

/* the breakdown tables a card keeps behind its fold: every table but the
   one it draws, cleaned the same way, repeats dropped */
function foldsOf(e, drawn) {
  const seen = new Set();
  return (e.tables || []).filter((t) => t !== drawn && (t.rows || []).length && !/^all voters$/i.test(t.title || ""))
    .map((t) => ({ title: t.title || null, headers: t.headers || null, rows: tableRows(t) }))
    .filter((t) => {
      const k = JSON.stringify(t);
      if (!t.rows.length || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

/* ---- trackers ---------------------------------------------------------------
   One question asked again and again, by several pollsters in their own
   words: a small chart per pollster on one shared scale (levels differ with
   the wording, so readings are never pooled or joined across pollsters),
   every reading listed beneath. */
function buildTracker(spec, ix, deff) {
  const panels = spec.series.map((sr) => {
    const pts = ix.waves(sr.id, sr.house).filter((e) => !(sr.skip || []).includes(e.waveDate)).map((e) => {
      const s = splitOf(sr.pick ? sr.pick(e) : pairsOf(sr, e), { sides: sr.sides || spec.sides, where: where(e) });
      const neff = neffOf(e, deff);
      const v = spec.measure === "net" ? r1(s.a - s.b) : s.a;
      const se = neff ? (spec.measure === "net" ? seNet(s.a, s.b, neff) : seShare(s.a, neff)) : null;
      return { ...sourceOf(e), x: Math.round(dx(fieldOf(e).end) * 1e4) / 1e4, a: s.a, b: s.b, m: r1(s.m + s.x), v,
        se: se != null ? r1(se) : null };
    }).sort((p, q) => p.x - q.x);
    return { house: sr.house, label: sr.label, question: sr.question || ix.waves(sr.id, sr.house)[0].question, points: pts };
  }).filter((p) => p.points.length);
  const all = panels.flatMap((p) => p.points);
  const copy = TRACKER_COPY[spec.copy](panels);
  return { kind: "tracker", id: spec.key, title: spec.title, measure: spec.measure, names: spec.names,
    cols: spec.cols, yDomain: spec.yDomain, ref: spec.ref ?? null, refLabel: spec.refLabel || null, panels,
    head: copy.head, dek: copy.dek, note: spec.note || null,
    first: all.reduce((m, p) => (p.field.end < m ? p.field.end : m), "9999"),
    last: all.reduce((m, p) => (p.field.end > m ? p.field.end : m), "0000") };
}

/* a pollster's latest reading against its first */
function moved(panel) {
  const pts = panel.points;
  if (pts.length < 2) return null;
  const f = pts[0], l = pts[pts.length - 1];
  if (f.se == null || l.se == null) return null;
  const d = r1(l.v - f.v);
  return { d, sig: Math.abs(d) > 1.96 * Math.hypot(f.se, l.se), first: f, last: l };
}
const listJoin = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
const possessive = (h) => HOUSES[h].short + "’s";

/* the movement sentences both trackers share: each pollster with two or
   more readings, its latest against its first, gated on the margin of the
   change. They compare two readings and say so; they never call a trend. */
function movementSentences(panels) {
  const mv = panels.map((p) => ({ p, m: moved(p) })).filter((x) => x.m);
  const out = [];
  for (const [word, test] of [["lower", (x) => x.m.sig && x.m.d < 0], ["higher", (x) => x.m.sig && x.m.d > 0]]) {
    const xs = mv.filter(test);
    if (!xs.length) continue;
    out.push(xs.map((x, i) => possessive(x.p.house) + (i ? " is " : " latest reading is ") + Math.abs(Math.round(x.m.d))
      + " points " + word + " than its first, in " + monthYear(x.m.first.field.end)).join("; ") + ".");
  }
  const same = mv.filter((x) => !x.m.sig);
  if (same.length === 1) out.push(possessive(same[0].p.house) + " latest is much the same as its first, in " + monthYear(same[0].m.first.field.end) + ".");
  else if (same.length > 1) out.push(listJoin(same.map((x) => possessive(x.p.house))) + " latest readings are much the same as their first.");
  return out.join(" ");
}

const TRACKER_COPY = {
  /* Trump: "deeply" only when every pollster's latest net sits at -30 or
     below, and any "unpopular" only when every latest net clears its own
     margin below zero */
  trump(panels) {
    const latest = panels.map((p) => p.points[p.points.length - 1]);
    const under = latest.every((l) => l.se != null && l.v + 1.96 * l.se < 0);
    const head = under
      ? (Math.max(...latest.map((l) => l.v)) <= -30 ? "Every pollster finds Donald Trump deeply unpopular" : "Every pollster finds Donald Trump unpopular")
      : "Pollsters differ on how Australians see Donald Trump";
    const rng = (k) => { const v = latest.map((l) => Math.round(l[k])); const lo = Math.min(...v), hi = Math.max(...v); return lo === hi ? lo + "%" : lo + "–" + hi + "%"; };
    const dek = "In each pollster’s latest reading, " + rng("b") + " view him unfavourably or negatively and " + rng("a")
      + " favourably or positively. " + movementSentences(panels);
    return { head, dek: dek.trim() };
  },
  /* Immigration: a majority only when every pollster's latest share wanting
     less clears 50% by its own margin */
  immigration(panels) {
    const latest = panels.map((p) => p.points[p.points.length - 1]);
    const major = latest.every((l) => l.se != null && l.v - 1.96 * l.se > 50);
    const most = latest.every((l) => l.v > Math.max(l.b, l.m));
    const head = major ? "In every poll, a majority want less immigration"
      : most ? "In every poll, wanting less immigration is the most common answer"
      : "Pollsters differ on whether Australians want less immigration";
    const rng = (k) => { const v = latest.map((l) => Math.round(l[k])); const lo = Math.min(...v), hi = Math.max(...v); return lo === hi ? lo + "%" : lo + "–" + hi + "%"; };
    const dek = "In each pollster’s latest reading, " + rng("v") + " say immigration is too high or should be cut, and "
      + rng("b") + " want more. " + movementSentences(panels);
    return { head, dek: dek.trim() };
  },
};

/* ---- the curation ------------------------------------------------------------
   Per topic, in reading order. `title` is the card's plain question; the
   pollster's own wording travels beside it. Sides are named where the
   wording rules would misplace an answer or the side's word reads badly. */
const R = (id, house, wave) => ({ id, house, wave });
const LESS = { a: /too high|decrease|fewer|reduc|cut/i, b: /too low|increase|more\b/i, m: /about right|same|undecided|don.?t know|unsure|not sure/i };

export const FEATURES = {
  immigration: [
    { kind: "tracker", key: "immigration-less", copy: "immigration", measure: "share",
      title: "Share wanting less immigration, by pollster", names: ["want less", "want more"],
      cols: ["Want less", "Same or unsure", "Want more"],
      yDomain: [40, 80], ref: 50, refLabel: "Half",
      note: "Each pollster asks in its own words, so compare a pollster’s readings with each other rather than with another pollster’s. Resolve and SEC Newgate ask whether immigration is too high; YouGov and Newspoll whether arrivals should fall; Essential whether the yearly intake should.",
      sides: LESS,
      series: [
        { house: "resolve", id: "immigration-level", label: "Is immigration too high?" },
        { house: "secnewgate", id: "immigration-level", label: "Is immigration too high?" },
        { house: "news24", id: "immigration-levels", label: "Should arrivals fall?",
          /* May and September print only the crosstab of net change: its
             all-voters row, read across the header */
          pick: (e) => {
            const t = e.tables[0];
            if ((t.headers || []).some((h) => /net decrease/i.test(h))) {
              const r = t.rows.find((x) => /^total$/i.test(String(x[0])));
              return t.headers.slice(1).map((h, i) => [h, r[i + 1]]);
            }
            return tableRows(t).map((r) => [r[0], r[1]]);
          } },
        { house: "newspoll", id: "immigration-levels", label: "Fewer immigrants?" },
        { house: "essential", id: "immigration-intake", label: "Should the intake fall?" },
      ] },
    { kind: "split", title: "Would people still want immigration cut if housing and services kept pace?", ref: R("immigration-if-services", "essential"),
      names: ["still want cuts", "would not"] },
    { kind: "split", title: "Is the government running immigration in a planned way?", ref: R("immigration-program-handling", "resolve"),
      sides: { a: ["Carefully planned and managed"], b: ["Unplanned and unmanaged"] }, names: ["planned", "unplanned"] },
    { kind: "stack", mode: "waves", key: "immigration-feeling", title: "Do Australians feel positive or negative about immigration?",
      ref: R("attitudes-immigration", "essential"), names: ["positive", "negative"] },
    { kind: "rank", title: "Where should cuts to immigration fall?", ref: R("immigration-reduction-source", "essential"),
      base: "% choosing each as the first place to cut" },
    { kind: "stack", mode: "battery", key: "immigration-steps", title: "Which steps to control immigration do voters back?",
      ref: R("immigration-control-steps", "essential"), names: ["support", "oppose"] },
    { kind: "split", title: "Has multiculturalism been good for Australia?", ref: R("multiculturalism", "news24"),
      sides: { a: ["Good for Australia, and continues to be"], m: ["Good for Australia, becoming a problem", "Undecided"], b: ["Not served Australia well"] },
      names: ["good, and still is", "has not served us well"], keepMid: true, noLead: true,
      relabel: { "Good for Australia, becoming a problem": "Good, but becoming a problem" } },
    { kind: "split", title: "Would Australia be better off as a ‘monocultural’ country?", ref: R("australia-monoculture", "resolve"),
      sides: { a: ["Support"], b: ["Disagree"] }, names: ["yes", "no"] },
  ],

  "trump-us": [
    { kind: "tracker", key: "trump", copy: "trump", measure: "net",
      title: "Donald Trump’s net favourability, by pollster", names: ["favourable", "unfavourable"],
      cols: ["Favourable", "Neither or unsure", "Unfavourable"],
      yDomain: [-75, 0], ref: 0, refLabel: "Even",
      note: "Net favourability is the favourable share less the unfavourable. Freshwater, RedBridge and Essential ask whether people view Trump favourably; SEC Newgate whether they feel positive or negative towards him. Essential offers no neutral answer, which lifts both sides of its reading.",
      series: [
        { house: "freshwater", id: "trump-favourability", label: "Favourable or unfavourable?" },
        { house: "redbridge", id: "trump-favourability", label: "Favourable or unfavourable?" },
        { house: "secnewgate", id: "trump-sentiment", label: "Positive or negative feelings?" },
        { house: "essential", id: "trump-favourability", label: "Favourable or unfavourable?" },
      ] },
    { kind: "stack", mode: "battery", key: "aukus", title: "Do Australians support AUKUS?",
      ref: R("aukus-security", "secnewgate", "2026-09-14"), table: 1, sort: false, names: ["support", "oppose"],
      relabel: { "September 2026": "Sep 2026", "July 2026": "Jul 2026", "May 2026": "May 2026", "November 2025": "Nov 2025" },
      note: "SEC Newgate’s Mood of the Nation, each wave’s figures as its September 2026 report reprints them." },
    { kind: "split", title: "Is the United States a reliable military ally?", ref: R("us-reliable-military-ally", "demosau"), names: ["yes", "no"] },
    { kind: "stack", mode: "battery", key: "trump-distance", title: "Should the government back Trump closely or keep its distance?",
      ref: R("government-relationship-with-trump", "demosau"), sort: false, reverse: true,
      sides: { a: /closely support/i, b: /distance/i }, names: ["back him closely", "keep its distance"],
      relabel: { "Nov 2024": "Nov 2024", "Jan 2025": "Jan 2025", "April 2026": "Apr 2026" },
      note: "DemosAU’s April 2026 report reprints its two earlier readings." },
    { kind: "stack", mode: "compare", byWave: true, key: "pm-like-trump", title: "Does Australia need a prime minister like Donald Trump?", names: ["agree", "disagree"],
      items: [
        { ref: R("trump-democracy-statements-2026-07", "demosau"), wideRow: "Australia needs a Prime Minister like Donald Trump" },
        { ref: R("pm-like-trump", "demosau"), wideRow: "April 2026" },
        { ref: R("pm-like-trump", "demosau"), wideRow: "Jan 2025", when: "2025-01-31" },
      ],
      note: "DemosAU; the January 2025 reading is as its April 2026 report reprints it." },
    { kind: "stack", mode: "compare", byWave: true, key: "trump-safety", title: "Is Trump making the world safer or less safe?",
      sides: { a: /more safe/i, b: /less safe/i, m: /no difference|don.?t know/i }, names: ["safer", "less safe"],
      items: [
        { ref: R("trump-description", "secnewgate", "2026-05-18"), table: 1, wideRow: 0 },
        { ref: R("trump-description", "secnewgate", "2026-02-09") },
      ] },
    { kind: "split", title: "Should national security lean on the US alliance or on other partners?",
      ref: R("national-security-priorities", "secnewgate"), table: 1, wideRow: 0,
      sides: { a: /alliance with the USA/i, b: /other countries/i }, names: ["the US alliance", "other alliances"] },
    { kind: "stack", mode: "battery", key: "countries", title: "How Australians see other countries", ref: R("views-on-countries", "essential"),
      names: ["positive", "negative"], show: 12 },
  ],

  "one-nation": [
    { kind: "rank", title: "Why One Nation appeals to its supporters", ref: R("one-nation-appeal", "secnewgate"),
      base: "% of One Nation supporters giving each reason, in their own words" },
    { kind: "rank", title: "What draws voters open to One Nation?", ref: R("one-nation-consideration-reason", "essential"),
      base: "% of voters open to One Nation choosing each as their main reason" },
    { kind: "rank", title: "What gives voters pause about One Nation?", ref: R("one-nation-most-hesitant", "redbridge"),
      base: "% of all voters choosing each as what makes them most hesitant", show: 9 },
    { kind: "nets", title: "Which messages move voters towards or away from One Nation?", ref: R("one-nation-message-experiment", "redbridge"),
      unit: "Net more willing to vote One Nation: the share more willing after hearing each statement, less the share less willing",
      strip: /\s*[—–-]\s*net more willing\s*$/i },
    { kind: "split", title: "Is the rise of One Nation good or bad for Australia?", ref: R("one-nation-rise-impact", "secnewgate"), names: ["good", "bad"] },
    { kind: "split", title: "Do voters approve of Pauline Hanson as leader?", ref: R("hanson-approval", "essential") },
    { kind: "split", title: "Should renters and mortgage holders get a quarter of their super as pay, as One Nation proposes?",
      ref: R("one-nation-super-policy", "secnewgate") },
    { kind: "stack", mode: "battery", key: "contested-ideas", title: "Seven contested ideas, put to voters", ref: R("hanson-statements", "demosau"),
      names: ["agree", "disagree"],
      note: "DemosAU put these without naming a party. A ‘monocultural’ Australia was Pauline Hanson’s suggestion." },
  ],

  "housing-budget": [
    { kind: "stack", mode: "compare", key: "budget-verdicts", title: "How did voters judge the May 2026 budget?", names: ["positive", "negative"],
      tally: ["positive verdicts lead", "negative verdicts lead"],
      items: [
        { ref: R("post-budget-economy-verdict", "newspoll"), wording: "Good or bad for the economy?" },
        { ref: R("post-budget-personal-impact", "newspoll"), wording: "Will you be better or worse off?" },
        { ref: R("budget-better-or-worse-off", "news24"), wording: "Will your household be better or worse off?" },
        { ref: R("budget-2026-overall-opinion", "demosau"), wording: "Overall opinion of the budget" },
        { ref: R("budget-good-for-household", "resolve"), wording: "Good or bad for your household?" },
        { ref: R("budget-approval-2026", "essential"), wording: "Approve or disapprove of the budget?" },
        { ref: R("budget-2026-impact", "secnewgate", "2026-05-18"), table: 1, wideRow: 1, wording: "Its impact on you and your family" },
      ],
      note: "Newspoll and YouGov printed only the two sides, so their bars leave the rest blank." },
    { kind: "stack", mode: "compare", key: "cgt", title: "Do voters back cutting the capital gains tax discount?", names: ["support", "oppose"],
      tally: ["support leads", "opposition leads"],
      items: [
        { ref: R("cgt-discount-removal", "resolve", "2026-08-15"), wording: "Removing the 50% discount" },
        { ref: R("cgt-changes-support", "secnewgate"), wording: "The budget’s changes, described in full" },
        { ref: R("tax-measures-tracker-2026-06", "demosau"), wideRow: 1, wording: "Scrapping the 50% discount for indexation" },
        { ref: R("cgt-discount-removal", "resolve", "2026-06-13"), wording: "Removing the 50% discount" },
        { ref: R("budget-2026-measures", "secnewgate"), table: 0, wording: "The budget’s changes, described in full" },
        { ref: R("budget-2026-tax-measures", "demosau"), wideRow: 1, wording: "Scrapping the 50% discount for indexation" },
        { ref: R("cgt-discount-removal", "resolve", "2026-05-16"), wording: "Removing the 50% discount" },
        { ref: R("budget-measures-2026", "essential"), wideRow: 2, wording: "Winding it back for shares and investments" },
      ] },
    { kind: "stack", mode: "compare", key: "negative-gearing", title: "Do voters back limiting negative gearing?", names: ["support", "oppose"],
      tally: ["support leads", "opposition leads"],
      items: [
        { ref: R("negative-gearing-restriction", "resolve", "2026-08-15"), wording: "Restricting it to new homes" },
        { ref: R("tax-measures-tracker-2026-06", "demosau"), wideRow: 0, wording: "Ending it for existing homes bought from 12 May" },
        { ref: R("negative-gearing-restriction", "resolve", "2026-06-13"), wording: "Restricting it to new homes" },
        { ref: R("budget-2026-measures", "secnewgate"), table: 1, wording: "The budget’s changes, described in full" },
        { ref: R("budget-2026-tax-measures", "demosau"), wideRow: 0, wording: "Ending it for existing homes bought from 12 May" },
        { ref: R("negative-gearing-restriction", "resolve", "2026-05-16"), wording: "Restricting it" },
        { ref: R("budget-measures-2026", "essential"), wideRow: 1, wording: "Winding back negative gearing and the CGT discount for property" },
      ] },
    { kind: "split", title: "Do the budget’s broken promises make people less likely to vote Labor?", ref: R("budget-broken-promises-labor-vote", "resolve"),
      sides: { a: ["More likely"], b: ["Less likely"], m: ["No impact or unsure"] }, names: ["more likely", "less likely"] },
    { kind: "split", title: "Will the housing tax changes push rents up or down?", ref: R("budget-rent-effect", "redbridge"),
      sides: { a: /increase rents/i, b: /reduce rents/i }, names: ["push rents up", "bring rents down"] },
    { kind: "split", title: "What is more to blame for the housing shortage: immigration or investor tax breaks?", ref: R("housing-shortage-blame", "demosau"),
      sides: { a: /immigration/i, b: /negative gearing/i }, names: ["immigration", "investor tax breaks"] },
    { kind: "stack", mode: "compare", key: "house-prices", title: "Should house prices fall?", names: ["lower prices", "steady or higher prices"],
      tally: null,
      items: [
        { ref: R("house-prices-direction", "newspoll"), wording: "Prices staying the same or rising, or falling?",
          sides: { a: ["Decrease"], b: ["Stay the same or increase"] } },
        { ref: R("lower-house-prices", "resolve", "2026-09-12"), wording: "Support or oppose lower house prices?",
          sides: { a: ["Support"], b: ["Oppose"] } },
      ],
      note: "Asked as a choice between steady prices and falling ones, most pick steady; asked about ‘lower house prices’ alone, most say yes." },
    { kind: "split", title: "Should people be able to use their super to buy a home?", ref: R("super-for-housing", "secnewgate") },
  ],

  "cost-of-living": [
    { kind: "rank", title: "Who is to blame for the cost-of-living crunch?", ref: R("cost-of-living-blame", "resolve", "2026-10-10"),
      base: "% naming each as primarily responsible",
      note: "Resolve published only these three answers. In November 2025, 42% blamed the federal government, 16% global factors and 7% the Reserve Bank." },
    { kind: "split", title: "Was the latest rate rise mainly caused by the Middle East conflict, as the Treasurer says?",
      ref: R("chalmers-middle-east-rate-rise", "news24"), wideRow: 0, names: ["agree", "disagree"] },
    { kind: "stack", mode: "waves", key: "household-finances", title: "Is your household better or worse off than three months ago?",
      ref: R("financial-situation-3m", "news24"), sides: { a: ["Better"], b: ["Worse"], m: ["No change", "Unsure", "Don't know"] }, names: ["better off", "worse off"] },
    { kind: "rank", title: "How should the government respond to inflation?", ref: R("inflation-response-priorities", "newspoll"),
      base: "% naming each as one of their top two priorities", sort: false },
    { kind: "rank", title: "Skipped care because of the cost", ref: R("healthcare-cost-impact", "essential"),
      base: "% who, in the past year, needed to see each but did not go because of the cost" },
    { kind: "rank", title: "What have people put off because of the economy?", ref: R("life-decision-delays", "redbridge"),
      base: "% who have delayed each, of those for whom it applies",
      relabel: { "When you plan to retire — delayed": "Retiring", "Buying a home — delayed": "Buying a home",
        "Buying a vehicle (car, truck, motorbike) — delayed": "Buying a vehicle", "Big household items (furniture/appliances) — delayed": "Big household items",
        "Receiving medical treatment — delayed": "Medical treatment", "Getting married — delayed": "Getting married", "Having children — delayed": "Having children" }, show: 7 },
    { kind: "split", title: "Will the next generation have a better or worse life than their parents?", ref: R("next-generation-outlook", "redbridge"),
      sides: { a: /better life/i, b: /worse life/i, m: /about the same/i }, names: ["better", "worse"],
      relabel: { "The next generation will have about the same quality of life as my parents' generation": "About the same" } },
    { kind: "split", title: "Would you struggle to pay an unexpected bill of a few thousand dollars?", ref: R("unexpected-expense-struggle", "resolve"),
      names: ["would struggle", "would not"] },
  ],

  "war-security": [
    { kind: "stack", mode: "compare", key: "iran-strikes", title: "Did voters back the US strikes on Iran?", names: ["approve", "disapprove"],
      tally: ["approval leads", "disapproval leads"],
      items: [
        { ref: R("iran-us-military-action", "newspoll"), wording: "US military action against Iran" },
        { ref: R("iran-strikes-approval", "essential"), wording: "The US and Israel’s decision to strike Iran" },
      ] },
    { kind: "split", title: "Should Australia send ships to help keep the Strait of Hormuz open?", ref: R("hormuz-naval-deployment", "newspoll") },
    { kind: "stack", mode: "battery", key: "middle-east-role", title: "What role should Australia play in the Middle East war?",
      ref: R("middle-east-involvement", "essential"), names: ["support", "oppose"] },
    { kind: "rank", title: "The biggest worry about the Iran war", ref: R("iran-war-biggest-concern", "news24"), wideRow: "Total",
      base: "% naming each as their biggest concern", show: 6 },
    { kind: "rank", title: "Who is responsible for the fuel crisis?", ref: R("fuel-crisis-responsibility", "essential"),
      base: "% naming each as most responsible" },
    { kind: "split", title: "Should the government spend $20 billion on a 90-day fuel reserve?", ref: R("fuel-reserve-20bn", "news24") },
    { kind: "stack", mode: "compare", key: "palestine", title: "Should Australia recognise a Palestinian state?", names: ["support", "oppose"],
      tally: ["support leads", "opposition leads"],
      items: [
        { ref: R("palestine-recognition", "essential", "2025-09-30") },
        { ref: R("palestine-recognition", "demosau") },
      ],
      note: "Australia announced its recognition in August 2025 and made it formal at the United Nations in September." },
    { kind: "split", title: "Should Australia strengthen, keep or reduce its economic ties with China?", ref: R("china-economic-relationship", "secnewgate"),
      sides: { a: /strengthen/i, b: /reduce/i, m: /maintain|don.?t know/i }, names: ["strengthen", "reduce"], keepMid: true, noLead: true,
      relabel: { "Australia should maintain its economic relationship with China": "Keep them as they are" } },
  ],

  "bondi-cohesion": [
    { kind: "stack", mode: "compare", key: "bondi-response", title: "How well did the government respond to the Bondi attack?", names: ["well", "badly"],
      tally: ["a good verdict leads", "a poor verdict leads"],
      items: [
        { ref: R("bondi-albanese-handling", "essential"), wording: "Albanese’s handling of the issues since" },
        { ref: R("bondi-response-strength", "resolve"), wording: "The federal government’s response",
          sides: { a: /strong/i, b: /weak/i } },
      ] },
    { kind: "stack", mode: "battery", key: "bondi-leaders", title: "How did each leader respond to Bondi?", ref: R("bondi-response-leaders", "resolve"),
      sides: { a: ["Good"], b: ["Poor"] }, names: ["good", "poor"], sort: false,
      note: "Resolve did not publish Sussan Ley’s undecided share." },
    { kind: "stack", mode: "battery", key: "bondi-measures", title: "Which measures after Bondi do voters back?", ref: R("bondi-initiatives", "essential"),
      names: ["support", "oppose"] },
    { kind: "split", title: "Should immigration screening be tougher on antisemitic or extremist views?", ref: R("immigration-screening-extremism", "resolve") },
    { kind: "split", title: "Have racism and religious intolerance risen since the Gaza war began?", ref: R("racism-rise-since-gaza", "resolve") },
    { kind: "rank", title: "Who should hate speech laws protect?", ref: R("hate-speech-laws", "essential"),
      base: "% choosing each view", sort: false },
    { kind: "split", title: "Is Australia becoming more united or more divided?", ref: R("australia-division-trajectory", "essential"),
      sides: { a: ["More united"], b: ["More divided"], m: ["Staying about the same"] }, names: ["more united", "more divided"] },
  ],

  "climate-energy": [
    { kind: "split", title: "Do voters support net zero emissions by 2050?", ref: R("net-zero-2050", "essential") },
    { kind: "split", title: "Should Australia drill for more oil and gas, even if it undermines net zero?", ref: R("oil-gas-exploration-vs-net-zero", "news24"),
      sides: { a: /^yes/i, b: /^no/i }, names: ["yes", "no"] },
    { kind: "split", title: "How fast should Australia move to renewable energy?", ref: R("energy-supply-attitudes", "essential"),
      sides: { a: /move as quickly|steady pace/i, b: /slow down|not shift away/i }, strong: /as quickly as possible|not shift away/i,
      names: ["move to renewables", "slow or stop the shift"],
      note: "Full colour marks the ends: ‘as quickly as possible’ and ‘do not shift away from coal, oil and gas’." },
    { kind: "split", title: "Is the 2035 emissions target too ambitious?", ref: R("emissions-target-2035", "essential"),
      sides: { a: ["Too ambitious"], b: ["Not ambitious enough"], m: ["About right"] }, names: ["too ambitious", "not ambitious enough"] },
    { kind: "stack", mode: "waves", key: "climate-cause", title: "Is climate change caused by people?", ref: R("climate-acceptance", "essential"),
      sides: { a: /caused by human activity/i, b: /normal fluctuation/i }, names: ["caused by people", "natural fluctuation"] },
    { kind: "stack", mode: "waves", key: "climate-effort", title: "Is Australia doing enough on climate change?", ref: R("climate-action", "essential"),
      sides: { a: ["Not doing enough"], b: ["Doing too much"], m: ["Doing enough", "Don’t know"] }, names: ["not doing enough", "doing too much"] },
  ],

  "tech-society": [
    { kind: "stack", mode: "compare", key: "social-ban", title: "Do voters back the under-16 social media ban?", names: ["support", "oppose"],
      tally: ["support leads", "opposition leads"],
      items: [
        { ref: R("social-media-ban-under16", "news24") },
        { ref: R("social-media-ban", "essential", "2025-12-10") },
        { ref: R("social-media-ban", "essential", "2025-09-30") },
      ],
      note: "The ban took effect on 10 December 2025." },
    { kind: "split", title: "Should social media companies be regulated more or less?", ref: R("social-media-regulation", "essential"),
      sides: { a: /regulated much more|regulated a little more/i, b: /less/i, m: /about right|don.?t know/i }, strong: /much/i,
      names: ["more", "less"] },
    { kind: "split", title: "Does AI bring more opportunity or more risk?", ref: R("ai-opportunities-risks", "essential", "2026-05-26"),
      sides: { a: /more opportunity/i, b: /more risk/i, m: /about the same/i }, names: ["more opportunity", "more risk"] },
    { kind: "stack", mode: "battery", key: "ai-impact", title: "Will AI be good or bad, for you and for society?", ref: R("ai-impact", "secnewgate"), table: 1,
      names: ["positive", "negative"], sort: false },
    { kind: "split", title: "Would you support a data centre being built in your area?", ref: R("data-centre-local", "essential") },
    { kind: "rank", title: "What should the rules be for gambling ads?", ref: R("gambling-ad-rules", "essential"),
      base: "% choosing each", relabel: {
        "There should be ban on all gambling advertising on TV, radio, on social media and online, at all times": "A ban on all gambling ads, everywhere, at all times",
        "There should be restrictions on gambling advertising during live sport and a ban on gambling ads on social media and online": "Limits during live sport, and a ban online and on social media",
        "There should be restrictions on gambling advertising only during live sport broadcasts": "Limits only during live sport broadcasts",
        "There should be no restrictions on gambling advertising": "No restrictions" } },
    { kind: "split", title: "Should abortion be legal?", ref: R("abortion-views", "essential"),
      sides: { a: /^legal/i, b: /^illegal/i }, strong: /all cases/i, names: ["legal", "illegal"],
      note: "Full colour marks ‘in all cases’." },
    { kind: "split", title: "Would workers be better off if unions were stronger?", ref: R("stronger-unions-impact", "essential"),
      sides: { a: /better off/i, b: /worse off/i, m: /unsure/i }, names: ["better off", "worse off"],
      relabel: { "Unsure / Makes no difference": "Unsure or no difference" } },
  ],

  "trust-democracy": [
    { kind: "split", title: "Has the Albanese government lived up to expectations?", ref: R("government-performance", "essential"),
      sides: { a: ["Exceeded expectations", "Met expectations"], b: ["Fallen short of expectations"] }, names: ["met or exceeded them", "fallen short"] },
    { kind: "rank", title: "How much does the political system need to change?", ref: R("state-of-politics-system", "redbridge"),
      base: "% choosing each", sort: false, relabel: {
        "The system is fine as it is and doesn't need any change": "It is fine as it is",
        "The system needs minor changes": "It needs minor changes",
        "The system needs major changes": "It needs major changes",
        "The system needs to be burned down so we can start over": "It needs to be burned down so we can start over" } },
    { kind: "split", title: "Is Australia stronger or weaker than a year ago?", ref: R("australia-stronger-or-weaker", "news24"),
      sides: { a: /stronger/i, b: /weaker/i, m: /not changed/i }, names: ["stronger", "weaker"],
      relabel: { "Australia has not changed": "Not changed" } },
    { kind: "stack", mode: "battery", key: "institutions", title: "Which institutions do Australians trust?", ref: R("trustwatch-institutions", "demosau"),
      names: ["trust", "distrust"], show: 12 },
    { kind: "stack", mode: "battery", key: "politicians", title: "How voters rate the political figures", ref: R("politician-ratings-2026-07", "demosau"),
      names: ["positive", "negative"], show: 10 },
    { kind: "split", title: "Does the Greens’ change of leader change people’s vote?", ref: R("greens-leadership-vote-impact", "resolve"),
      names: ["more likely", "less likely"] },
  ],
};

/* ---- the payload ------------------------------------------------------------- */
export function buildBeyond(entries, { deff }) {
  const shown = entries.filter((e) => themeOf(e.id) !== "cut");
  const ix = makeIndex(shown);
  /* a featured card takes its question-and-pollster pairs out of the topic's
     list (a pollster's other waves of the question with them), and must
     feature only questions filed under its own topic */
  const used = new Set();
  const refsOf = (spec) => (spec.kind === "tracker" ? spec.series.map((s) => ({ id: s.id, house: s.house }))
    : spec.mode === "compare" ? spec.items.map((it) => it.ref) : [spec.ref]);
  const topics = THEMES.map((t) => {
    const blocks = (FEATURES[t.id] || []).map((spec) => {
      const b = spec.kind === "tracker" ? buildTracker(spec, ix, deff)
        : spec.kind === "split" ? buildSplit(spec, ix, deff)
        : spec.kind === "stack" ? buildStack(spec, ix, deff)
        : spec.kind === "rank" ? buildRank(spec, ix)
        : spec.kind === "nets" ? buildNets(spec, ix)
        : null;
      if (!b) throw new Error("beyond-the-vote: unknown block kind " + spec.kind);
      for (const ref of refsOf(spec)) {
        if (themeOf(ref.id) !== t.id) throw new Error("beyond-the-vote: " + ref.id + " is featured under " + t.id + " but filed under " + themeOf(ref.id));
        used.add(ref.id + "|" + ix.find(ref).house);
      }
      return b;
    });
    /* everything else filed here, by question and pollster, newest first */
    const more = new Map();
    for (const e of shown) {
      if (themeOf(e.id) !== t.id || used.has(e.id + "|" + e.house)) continue;
      const k = e.id + "|" + e.house;
      if (!more.has(k)) more.set(k, []);
      more.get(k).push(e);
    }
    const moreList = [...more.values()].map((ws) => {
      ws.sort((a, b) => byDateDesc(a.waveDate, b.waveDate));
      return {
        id: ws[0].id, house: ws[0].house, title: TITLES[ws[0].id + "|" + ws[0].house] || TITLES[ws[0].id] || cleanQuestion(ws[0]), last: ws[0].waveDate,
        waves: ws.map((e) => {
          const t0 = mainTable(e);
          return { ...sourceOf(e), question: e.question, note: e.note || null,
            prose: t0 ? [] : (e.prose || []).slice(0, 3),
            tables: t0 ? [{ title: t0.title || null, headers: t0.headers || null, rows: tableRows(t0) }].concat(foldsOf(e, t0)) : [] };
        }),
      };
    }).sort((a, b) => byDateDesc(a.last, b.last) || a.title.localeCompare(b.title));
    return { id: t.id, title: t.title, short: t.short, about: t.about, dek: t.dek, blocks, more: moreList };
  });
  const houses = new Set(shown.map((e) => e.house));
  return {
    generated: "beyond-the-vote",
    houses: Object.fromEntries(Object.entries(HOUSES).filter(([k]) => houses.has(k))),
    counts: {
      questions: new Set(shown.map((e) => e.id + "|" + e.house)).size,
      waves: shown.length,
      featured: topics.reduce((n, t) => n + t.blocks.length, 0),
      cut: new Set(entries.filter((e) => themeOf(e.id) === "cut").map((e) => e.id)).size,
    },
    first: shown.reduce((m, e) => ((e.dateEnd || e.waveDate) < m ? (e.dateEnd || e.waveDate) : m), "9999"),
    topics,
  };
}

/* a store question as a list title: survey codes off (Essential's "E1170",
   SEC Newgate's "N22 —", "G6:"), and the first question of a pair */
function cleanQuestion(e) {
  let q = String(e.question || "").trim();
  q = q.replace(/^'?E\d+\s*[-–—]?\s*/, "").replace(/^[A-Z]\d+[a-z]?\s*[:—–-]\s*/, "").replace(/^Q[ivx]+\s*\/\s*Q[ivx]+\.\s*/i, "");
  q = q.split(/\s+\/\s+[A-Z]\d*/)[0].split(/\s+[A-Z]\d+[a-z]?\s+—\s+/)[0];
  return q.trim();
}

/* short titles for list entries whose store question runs long, opens on
   context, or names only a chart ("To what extent do you agree..."); keyed
   by id, or id|house where pollsters filed different questions under one id.
   The exact wording stays a tap away under each entry. */
const TITLES = {
  /* immigration */
  "immigration-impact|newspoll": "Does immigration mainly benefit or harm most Australians?",
  "immigration-impact|essential": "The impact of immigration, area by area",
  "immigration-views": "Four views of immigration: which is closest to yours?",
  "immigration-terror-controlled-regions": "Should immigration from regions run by terrorist groups be restricted?",
  "best-party-immigration-policies": "Which party is best at managing immigration?",
  "immigration-cap": "Is the immigration cap too high, too low or about right?",
  "hanson-immigration-settings": "Is Pauline Hanson right that immigration settings are wrong?",
  "migration-skills-restriction": "Should permanent migration be limited to needed skills?",
  "immigration-pause-housing": "Should immigration pause until housing catches up?",
  "immigration-reduction-support": "Should immigration numbers be cut significantly?",
  /* Trump and the United States */
  "country-relations": "How good is Australia’s relationship with each country?",
  "us-vs-middle-powers": "The US, or other middle powers: which relationship should come first?",
  "international-relationships": "Which countries should Australia get closer to?",
  "trump-presidency-effects": "Will Trump’s presidency be good or bad for each of these?",
  "trump-presidency-impact": "The impact of Trump’s presidency, area by area",
  "aukus-security": "Will AUKUS make Australia more or less secure?",
  "us-alignment": "Should Australia be more or less like the United States?",
  "us-tariff-pressures": "Should Australia hold its ground against US tariff pressure?",
  "albanese-trump-confidence": "Can Albanese work with Trump?",
  "albanese-trump-meeting-importance": "How important is it that Albanese meets Trump?",
  "albanese-trump-meeting": "Was Albanese’s meeting with Trump good for Australia?",
  "meeting-outcomes-support": "Support for what came out of the Albanese–Trump meeting",
  "relationships-with-countries": "How positive is Australia’s relationship with each country?",
  "country-to-strengthen": "Which relationship would it pay most to strengthen, the US or China?",
  "aukus-delivery": "Will AUKUS deliver?",
  /* One Nation and the Coalition */
  "vote-recall-2025-flows": "Where 2025 Labor and Coalition voters have gone",
  "one-nation-motivations": "Why One Nation’s supporters back it: the party or a dislike of the others?",
  "serious-consideration": "Which parties would voters seriously consider?",
  "vote-driver-most-important": "What matters most in deciding a vote: policies, understanding, or character?",
  "abbott-led-coalition-hypothetical-vi": "How would people vote if Tony Abbott led the Coalition?",
  "hanson-retirement-hypothetical-vi": "How would people vote if Pauline Hanson retired?",
  "coalition-one-nation-cooperation": "Should the Coalition and One Nation team up to form government?",
  "party-messaging-battery": "Eight party messages: agree or disagree?",
  "openness-one-nation": "Would you vote for One Nation?",
  "best-liberal-leader": "Who would give the Liberals the best chance at the next election?",
  "preferred-coalition-leader|newspoll": "Who should lead the Coalition?",
  "preferred-coalition-leader|essential": "Who should lead the Coalition?",
  "preferred-coalition-leader|resolve": "Who would you prefer as Liberal leader?",
  "liberal-direction|resolve": "Should the Coalition move right, to the centre, or stay put?",
  "liberal-direction|essential": "Should the Liberals become more progressive or more conservative?",
  "gender-quotas-coalition": "Should the Liberals use quotas to lift female representation?",
  "coalition-vote-flows": "How 2025 Coalition voters would vote now",
  "liberal-vote-shift-since-2025": "How 2025 Liberal voters would vote now",
  "one-nation-concern": "How concerning are claims about One Nation?",
  "one-nation-vote-impacts": "What would make people more or less likely to vote One Nation?",
  "angus-taylor-impact": "Does Angus Taylor as leader make people more likely to vote Liberal?",
  "barnaby-next-move": "What will Barnaby Joyce do next?",
  "joyce-one-nation-effect": "Would Barnaby Joyce joining One Nation change people’s vote?",
  "taylor-awareness": "Had people heard of Angus Taylor when he became leader?",
  "ever-support-one-nation": "Would you ever support One Nation?",
  "reason-considering-one-nation": "The main reason for considering One Nation",
  "one-nation-readiness-to-govern": "Is One Nation ready to govern?",
  "vote-regret-2025": "Do people regret their 2025 vote?",
  "hanson-poverty-serious": "Is poverty a serious problem the government must address?",
  "hanson-young-workers-lazy": "Is Pauline Hanson right that many young workers are lazy?",
  "hanson-ndis-priorities": "Do people share Pauline Hanson’s concerns about the NDIS?",
  "easier-to-sack-workers": "Should it be easier to sack people?",
  /* housing, tax and the budget */
  "budget-awareness-and-perceptions": "How much have people heard about the budget, and what do they make of it?",
  "housing-value-expectations": "Will house prices be higher or lower in a year?",
  "housing-values-fall": "Would falling house prices be good or bad, for you and for Australia?",
  "housing-market-timing": "Is it a good time to buy or sell a home?",
  "cigarette-tax-black-market": "What should be done about the black market in cigarettes?",
  "super-access-statements": "Views on super contributions and early access",
  "housing-affordability-contributors": "What is driving the housing affordability crisis?",
  "superannuation-views": "Views on superannuation",
  "cgt-changes-impact": "Would the capital gains tax changes make it harder to get ahead?",
  "government-funding-increases": "Where should government spend more?",
  "initiatives-menu": "Support for policies from ending multiculturalism to leaving the UN",
  "negative-gearing-cgt-youth": "Will the housing tax changes make things fairer for younger people?",
  "taxing-wages-vs-investments": "Should investment income be taxed more, less, or the same as wages?",
  "housing-concerns-ranking": "The biggest housing concerns, ranked",
  "budget-in-reply-2026": "Support for the Coalition’s budget-reply proposals",
  "investment-income-tax-preference": "Should investment income be taxed at a lower rate than work?",
  "budget-2026-tax-statements": "Views on the budget’s tax changes",
  "cgt-negative-gearing-housing-verdict": "Will the housing tax changes make homes more affordable?",
  "post-budget-housing-verdict": "Are Labor’s housing measures a step in the right direction?",
  "budget-revenue-options": "Ten ways to raise revenue: which do people back?",
  "deficit-response-preferences": "How should the deficit be cut: tax the rich, or cut spending?",
  "deficit-seriousness": "How serious is the budget deficit?",
  "government-financial-assistance": "Should governments prop up struggling smelters, steelworks and refineries?",
  "super-3m-tax-support": "Should super balances over $3 million pay more tax?",
  "tax-reforms": "Support for possible tax reforms",
  "budget-priorities|news24": "What should the budget prioritise?",
  "budget-priorities|essential": "What should the budget prioritise?",
  "budget-changes-support": "Support for possible budget changes, before the budget",
  "election-commitments": "Should governments always keep their election promises?",
  "budget-2026-trust": "Has the budget changed people’s trust in the government?",
  /* cost of living and the economy */
  "rate-hike-blame": "Who is to blame for the September 2026 rate rise?",
  "regulation-attitudes": "Does Australia have too much regulation, or too little?",
  "working-life-concerns": "Worries about working life over the next five years",
  "large-company-behaviour": "Are big companies behaving ethically?",
  "standard-of-living-parents": "Are people better or worse off than their parents were?",
  "job-security": "How secure do workers feel in their jobs?",
  "economy-outlook-6m|essential": "Will the economy improve or worsen in the next six months?",
  "economy-outlook-6m|resolve": "Will the economic outlook improve or worsen?",
  "healthcare-affordability-working-class": "Have working-class Australians delayed healthcare because of the cost?",
  "chalmers-cost-of-living-verdict": "How well have Jim Chalmers’s policies dealt with the cost of living?",
  "rate-hike-government-responsibility": "Is the government responsible for the February 2026 rate rise?",
  "col-coping-actions": "How people have coped with the rising cost of living",
  "personal-standard-of-living": "Will your standard of living improve or worsen this year?",
  "wealthy-income-threshold": "How much does a household need to earn to be wealthy?",
  "energy-prices-next-12-months": "Will energy prices rise over the next year?",
  "unemployment-next-12-months": "Will unemployment rise over the next year?",
  "interest-rate-contributors": "What is behind the rate rises?",
  "interest-rate-expectations": "Will interest rates be higher by the end of 2026?",
  "better-or-worse-off": "Are people better or worse off than a year ago?",
  "economy-2026-expectations": "What will rise in 2026: prices, rates, unemployment?",
  "gov-action-economy": "Is the government doing enough on the economy?",
  "christmas-spending-cutback": "Are people cutting back on Christmas spending?",
  "groups-views-economy": "Whose views of the economy match yours?",
  "regulation-australia": "Is there enough regulation in Australia?",
  "support-economic-measures": "Support for economic reform ideas",
  "economic-roundtable": "Views on the August 2025 economic roundtable",
  /* war, fuel and security */
  "economy-important-country": "Which country will matter most to Australia’s economy?",
  "fuel-rationing-support": "Should fuel be rationed?",
  "fuel-security-module": "Is fuel availability a problem, and is the government doing enough?",
  "fuel-impact-expectations": "How much will fuel shortages hit prices and the economy?",
  "fuel-crisis-personal": "What people are doing to save fuel",
  "fuel-price-driving-changes": "How people changed their driving as petrol prices surged",
  "fuel-consumption-action": "Have people cut their fuel use?",
  "trump-iran-war-handling": "How well is Trump handling the war in Iran?",
  "iran-australia-response": "Do people approve of Australia’s response to the strikes on Iran?",
  "national-security-feeling": "How secure is Australia from external threats?",
  "palestine-recognition-consequences": "What will recognising Palestine achieve?",
  "gaza-war-response": "Has the government’s response to the Gaza war been right?",
  "israel-gaza-action": "Should Israel continue its military action in Gaza?",
  "iran-military-action-support": "Did people support the US and Israeli strikes on Iran in 2025?",
  "china-economic-relationship": "Should Australia strengthen or reduce its economic ties with China?",
  /* Bondi and social cohesion */
  "social-cohesion-outlook": "Will social cohesion get better or worse?",
  "social-cohesion-roles": "Who has a role in improving social cohesion?",
  "social-cohesion": "How cohesive is Australian society?",
  "social-cohesion-improvement": "What could improve social cohesion?",
  "australia-day-views": "How people mark Australia Day",
  "indigenous-national-day": "Should there be a separate national day for Indigenous Australians?",
  "racism": "Views on racism in Australia",
  "bondi-antisemitism-views": "Views on antisemitism after the Bondi attack",
  "bondi-attack-response-rating": "How well did Albanese respond to the Bondi attack?",
  "antisemitism-royal-commission": "Should there be a royal commission into antisemitism?",
  "social-cohesion-rating": "How would you rate social cohesion in Australia?",
  "racism-driver": "What is driving the rise in racism?",
  "world-division-trajectory": "Is the world becoming more divided?",
  "protest-support": "Where should large protests be allowed?",
  "antisemitism-policies": "Support for measures against antisemitism, before Bondi",
  /* climate and energy */
  "best-party-climate-and-energy": "Which party is best at managing climate change?",
  "gov-action-environment": "Is the government doing enough on the environment?",
  "preventing-global-warming": "Will the world prevent dangerous global warming?",
  "cop31-hosting": "Should Australia host COP31?",
  "renewable-approvals-reform": "Should approvals for energy projects be sped up?",
  "renewables-bills-impact": "Will the shift to renewables raise or lower power bills?",
  "renewables-reliability-impact": "Will the shift to renewables make the grid more or less reliable?",
  "emissions-target-2035-likelihood": "Will Australia meet its 2035 emissions target?",
  "emissions-targets-views": "Views on emissions targets",
  /* technology and society */
  "algorithm-opt-out": "Should users be able to opt out of social media algorithms?",
  "social-media-duty-of-care": "Should social media companies owe their users a duty of care?",
  "manosphere-awareness": "Have people heard of ‘the manosphere’?",
  "worker-protections-confidence": "Will worker protections hold as employers bring in AI?",
  "unions-importance": "How important are unions today?",
  "violence-against-women": "Has violence against women increased?",
  "manosphere-attitudes": "Views on the ‘manosphere’",
  "ai-workplace-regulation": "Should employers’ use of AI be regulated?",
  "social-media-feed-control": "Do people want more control over their social media feeds?",
  "data-centre-local-effects": "What would a local data centre do to power prices, pollution and jobs?",
  "data-centres-good-bad": "Will more data centres be good or bad for Australians?",
  "in-your-area-new-builds": "Apartments, a data centre, a nuclear plant: would people back them locally?",
  "data-centre-concerns": "The biggest worries about a local data centre",
  "abortion-care": "Views on access to abortion care",
  "abortion-access-20-weeks": "Should abortion be available after 20 weeks?",
  "generative-ai-use": "How often people use generative AI",
  "misinformation-confidence": "Can people spot misinformation?",
  "ai-concerns": "Are people concerned about AI?",
  "ai-usage-frequency": "How often do people use AI?",
  "ai-concern-types": "What worries people about AI?",
  "ai-usage-purposes": "What people use AI for",
  "ai-employment-impact": "Will AI take your job, or make it easier?",
  "social-media-ban-effectiveness": "Will the under-16 social media ban work?",
  "ai-impacts-concern": "How concerning are AI’s side effects?",
  "existential-threats": "How worried are people about AI, climate, nuclear war and pandemics?",
  "gambling-advertising": "What should be done about gambling ads?",
  "working-from-home": "Who should decide on working from home?",
  "ai-development": "Should AI develop freely, or only with guardrails?",
  "four-day-week": "Should Australia move to a four-day work week?",
  "ai-copyright": "Should AI companies be allowed to use copyrighted work?",
  "regulation-by-area": "Where is there too little regulation?",
  "youtube-ban-circumvent": "Would parents help their children get around the YouTube ban?",
  "youtube-ban-u16s": "Should under-16s be banned from YouTube?",
  "male-childcare-worker-ban": "Should men be banned from working in childcare?",
  "childcare-sector-statements": "Views on the childcare sector",
  "ai-workplace-views": "Will AI help workers or replace them?",
  /* leaders, trust and democracy */
  "greens-leaders-familiarity": "How familiar are the Greens’ leaders?",
  "greens-leader-awareness": "Did people know the Greens had a new leader?",
  "happiness-personal": "How happy are people with their own situation?",
  "best-party-placement-12-issues": "Which party is best on each of twelve issues?",
  "best-party-placement-4-issues": "Which party is best on each issue?",
  "best-party-economy-security": "Which party is best on the economy, security and immigration?",
  "former-pm-ratings": "How voters rate former leaders",
  "most-important-issue|resolve": "Which issue matters most?",
  "most-important-issue|news24": "Which issue matters most?",
  "pride-and-superannuation": "Are people proud of Australia? Is super a national asset?",
  "issue-importance": "Which issues matter most?",
  "government-issue-performance": "How is the government performing, issue by issue?",
  "health-services-performance": "How is the government performing on health?",
  "public-health-confidence": "Will the public health system be there when you need it?",
  "better-pm-for-cohorts": "Albanese or Hanson: who would be the better PM for each group?",
  "billionaire-ratings": "How people see Australia’s billionaires",
  "politics-overdue-shakeup": "Is Australian politics overdue for a shake-up?",
  "trustwatch-media-trust": "Which sources of information do people trust?",
  "leader-attributes": "Albanese, Taylor and Hanson, trait by trait",
  "policy-support-battery": "Support for a range of policies",
  "trust-institutions": "Trust in government, business and family",
  "party-trust-issues": "Which party is trusted more on each issue?",
  "information-trust": "Which news sources do people trust?",
  "bondi-policies": "Support for social policies, January 2026",
  "leader-traits-history": "Newspoll’s leader traits since 2008",
  "leader-traits-matchup": "Albanese and Ley, trait by trait",
  "australia-vs-countries": "Is Australia a better place to live than most countries?",
  "expectations-2026": "Will 2026 be better or worse than 2025?",
  "democracy-wellbeing-statements": "Views on Australian democracy",
  "disaster-response-confidence": "Can governments handle a local natural disaster?",
  "future-outlook": "How optimistic are people about the future?",
  "party-trust-economy": "Which party is trusted on the economy?",
  "fed-govt-priorities": "What should the government’s top priorities be?",
  "vote-counted-fairly": "Was your vote counted fairly at the 2025 election?",
  "more-mps": "Should Parliament have more MPs?",
  "how-to-vote-cards": "Should how-to-vote cards be handed out at polling booths?",
  "trustwatch-democracy-statements": "Is Australian democracy healthy?",
  "aec-statements": "Do people trust the Australian Electoral Commission?",
  "voting-systems": "Which voting system should the House use?",
  "labor-second-term-expectations": "What should Labor move faster on in its second term?",
  "labor-mandate": "Should Labor stick to its election policies?",
  "new-government-issues": "What should the new government act on first?",
};

/* the rules, for .build/test-beyond.mjs to pin branch by branch */
export const __test = { classify, splitOf, leadOf, tallyOf, wavesSummary, TRACKER_COPY, tableRows, pairsOf };
