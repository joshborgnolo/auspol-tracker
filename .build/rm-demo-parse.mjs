// rm-demo-parse.mjs — pure parsers for Roy Morgan's "Primary Vote by …"
// release tables. No I/O: tableImages() reads the release cache's content
// HTML, parseStateTable()/parseCityTable() read the Vision OCR line arrays
// (ocr-image.swift output: [{x,y,w,h,text}], coordinates 0..1 fractions).
// Shared by extract-roymorgan-demo.mjs and test-roymorgan-demo.mjs.
//
// The two table shapes proven by finding 10363 (29 Sep 2026, the first
// release ever to publish them):
//
//   Primary Vote by State — one column PAIR per mainland state
//   (Last election | Now), rows ALP / One Nation / L-NP / Greens /
//   Independents-Others / TOTAL; only the Now sub-columns are filed.
//   One Nation's row has no Last-election cells (it did not run in 2025's
//   lower-house general election sense the table means).
//
//   Primary Vote by City/Country — three single columns TOTAL / Capital
//   Cities / Regional-Rural Areas, same five party rows plus TOTAL.
//
// Everything the parsers accept as anchors is a constant below; group labels
// filed in demographics.json are constants too, never OCR text (the OCR
// reads "Capital Crties" and "RegionallRual" — confusable-l letterforms).
// A table whose skeleton doesn't match returns null; a matched table with
// figure cells the OCR missed returns them in `missing` — the extractor
// treats a non-empty `missing` as a guard trip (exit 2), never completing a
// cell from the row sum (a complement is computed, not printed).

export const STATES_AU = { nsw: "NSW", vic: "Vic", qld: "Qld", sa: "SA", wa: "WA", tas: "Tas" };
export const CITY_GROUP = "Capital Cities";
export const REGION_GROUP = "Regional/Rural Areas";
export const PARTIES = ["alp", "lnp", "onp", "grn", "oth"];

const squash = (s) => String(s ?? "").toLowerCase().replace(/[^a-z]/g, "");
const centre = (t) => t.x + (t.w ?? 0) / 2;

// "28.5" / "28,5" / "28·5" / "100" / "100." / "9" → number; anything else null.
export function num(t) {
  const m = /^(\d{1,3})[.,·]?(\d?)%?[.,]?$/.exec(String(t ?? "").trim());
  if (!m) return null;
  const v = +m[1] + (m[2] ? +`0.${m[2]}` : 0);
  return v >= 0 && v <= 100 ? v : null;
}

// The release content's table captions → the full-size image each captions.
// The caption text sits immediately BEFORE its <img>; srcset thumbnails
// (…-300x160.png) ride inside the same tag, but src is the full image.
// CAPTION_RES is exported for the extractor's drift guard: a caption found
// but no image resolved is a moved layout, not a table-less release — the
// extractor and this parser must read the captions through the ONE regex
// pair, or the two drift apart silently.
const gap = "(?:<[^>]+>|\\s|&nbsp;)+";
export const CAPTION_RES = {
  city: new RegExp(`Primary${gap}Vote${gap}by${gap}City`, "i"),
  state: new RegExp(`Primary${gap}Vote${gap}by${gap}(?:the${gap})?State\\b`, "i"),
};
export const SEEN_IMG_RE = /<img[\s>]/i;
export function tableImages(html) {
  const find = (re) => {
    const i = String(html ?? "").search(re);
    if (i < 0) return null;
    const m = /<img[^>]+src="([^"]+?\.png[^"]*)"/i.exec(String(html).slice(i));
    return m ? m[1] : null;
  };
  return { city: find(CAPTION_RES.city), state: find(CAPTION_RES.state) };
}

// Greedy y-clustering: tokens on one printed row agree in y within ~0.02,
// printed rows sit ≥0.08 apart, 0.06 splits them without merging.
function bandsOf(lines) {
  const toks = [...lines].sort((a, b) => a.y - b.y);
  const bands = [];
  for (const t of toks) {
    const last = bands[bands.length - 1];
    if (last && t.y - last.yMax <= 0.06) { last.toks.push(t); last.yMax = Math.max(last.yMax, t.y); }
    else bands.push({ yMax: t.y, toks: [t] });
  }
  for (const b of bands) b.toks.sort((a, b2) => a.x - b2.x);
  return bands.map((b) => b.toks);
}

// Party key for a row band's left-column text, null when it isn't one.
function partyOfBand(toks) {
  const label = toks.filter((t) => centre(t) < 0.25).map((t) => squash(t.text)).join("");
  if (/^total/.test(label)) return "total";
  if (/^onen/.test(label)) return "onp";                    // "One Nation" (OCR: "One Nalion")
  if (/^l.?np|^liberal/.test(label)) return "lnp";
  if (/green/.test(label)) return "grn";
  if (/independent|others|^other$/.test(label)) return "oth"; // "Independents/Others" (OCR: "IndependentslOthers")
  if (/^alp|labor/.test(label)) return "alp";
  return null;
}

// Row bands by party + every band above the first party row (the header
// region). Returns null when the five party rows and the TOTAL row are not
// each found in their own band.
function skeleton(lines) {
  const rows = {};
  for (const band of bandsOf(lines)) {
    const p = partyOfBand(band);
    if (!p) continue;
    if (rows[p]) return null;                                   // two bands claim one party
    rows[p] = band;
    if (!rows.firstParty && p !== "total") rows.firstParty = band;
  }
  if (!rows.alp || !rows.lnp || !rows.onp || !rows.grn || !rows.oth || !rows.total || !rows.firstParty) return null;
  return rows;
}

// The header-region tokens above the first party row.
function headTokens(lines, rows) {
  const tops = lines.filter((t) => !rows.firstParty.includes(t) && t.y < Math.min(...rows.firstParty.map((r) => r.y)) + 0.03);
  return tops.filter((t) => !PARTIES.some((p) => rows[p].includes(t)) && !rows.total.includes(t));
}

// Assign figure-bearing tokens of one band to the nearest of `slots`
// ([{name, x}]); collisions push [name] onto `conflicts`.
function assignBand(band, slots, out, conflicts, minX) {
  for (const t of band) {
    const c = centre(t);
    if (c < minX) continue;
    const v = num(t.text);
    if (v == null) continue;
    let best = null;
    for (const s of slots) if (best == null || Math.abs(c - s.x) < Math.abs(c - best.x)) best = s;
    if (best == null) continue;
    if (out[best.name] == null) out[best.name] = v;
    else if (out[best.name] !== v) conflicts.push(best.name);
  }
}

// "Primary Vote by State" OCR lines → Now shares per state per party.
// null = this is not the state table's skeleton (a guard, not silence).
export function parseStateTable(lines) {
  const rows = skeleton(lines);
  if (!rows) return null;
  const head = headTokens(lines, rows);
  // state tokens anywhere in the header region (unscaled OCR may sever one
  // — "Ic" for "Vic" — we need every printed state, so all are required)
  const states = [];
  for (const t of head) {
    const st = STATES_AU[squash(t.text)];
    if (st && !states.some((s) => s.name === st)) states.push({ name: st, x: centre(t) });
  }
  states.sort((a, b) => a.x - b.x);
  if (states.length < 4) return null;
  // one Now sub-column per state, anchored by the "Now" sub-header token
  const nows = head.filter((t) => squash(t.text) === "now");
  const lasts = head.filter((t) => squash(t.text) === "last");
  for (const st of states) {
    const near = (ts) => ts.filter((t) => Math.abs(centre(t) - st.x) < 0.1);
    const nn = near(nows), ll = near(lasts);
    if (nn.length !== 1) return null;                          // every state's Now pair-head must read
    st.now = centre(nn[0]);
    st.last = ll.length === 1 ? centre(ll[0]) : 2 * st.x - st.now; // unseen "Last" falls back to the mirror
  }
  const slots = states.flatMap((st) => [{ name: `${st.name}|now`, x: st.now }, { name: `${st.name}|last`, x: st.last }]);
  const minX = Math.min(...states.map((st) => st.last)) - 0.03;
  const missing = [], conflicts = [];
  const now = {};
  for (const p of PARTIES) {
    const got = {};
    assignBand(rows[p], slots, got, conflicts, minX);
    now[p] = Object.fromEntries(states.map((st) => [st.name, got[`${st.name}|now`] ?? null]));
    for (const st of states) if (now[p][st.name] == null) missing.push(`${p} ${st.name}`);
  }
  const tot = {};
  assignBand(rows.total, slots, tot, conflicts, minX);
  const totalOk = states.every((st) => tot[`${st.name}|now`] != null && Math.abs(tot[`${st.name}|now`] - 100) <= 0.6);
  return { states: states.map((st) => st.name), now, missing, conflicts, totalOk };
}

// "Primary Vote by City/Country" OCR lines → {total, Capital Cities,
// Regional/Rural Areas} shares per party. null = not this table's skeleton.
export function parseCityTable(lines) {
  const rows = skeleton(lines);
  if (!rows) return null;
  const head = headTokens(lines, rows).filter((t) => centre(t) > 0.25);
  const tot = head.find((t) => squash(t.text) === "total");
  const cap = head.find((t) => squash(t.text).startsWith("capital"));
  const reg = head.find((t) => squash(t.text).startsWith("regional"));
  if (!tot || !cap || !reg) return null;
  const cols = [{ key: "total", x: centre(tot) }, { key: "city", x: centre(cap) }, { key: "region", x: centre(reg) }];
  if (!(tot.x < cap.x && cap.x < reg.x)) return null;          // a column head misattached is not this table
  const slots = cols.map((c) => ({ name: c.key, x: c.x }));
  const missing = [], conflicts = [];
  const byParty = {};
  for (const p of PARTIES) {
    const got = {};
    assignBand(rows[p], slots, got, conflicts, 0.25);
    byParty[p] = { total: got.total ?? null, city: got.city ?? null, region: got.region ?? null };
    for (const k of ["total", "city", "region"]) if (byParty[p][k] == null) missing.push(`${p} ${k}`);
  }
  const totRow = {};
  assignBand(rows.total, slots, totRow, conflicts, 0.25);
  const totalOk = ["total", "city", "region"].every((k) => totRow[k] != null && Math.abs(totRow[k] - 100) <= 0.6);
  return {
    groups: {
      [CITY_GROUP]: Object.fromEntries(PARTIES.map((p) => [p, byParty[p].city])),
      [REGION_GROUP]: Object.fromEntries(PARTIES.map((p) => [p, byParty[p].region])),
    },
    total: Object.fromEntries(PARTIES.map((p) => [p, byParty[p].total])),
    missing, conflicts, totalOk,
  };
}
