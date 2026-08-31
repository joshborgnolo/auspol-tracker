// Infogram rung for the Newspoll extractor (spec: .build/newspoll-infogram-rung.md).
// The Australian's Newspoll graphics are Infogram projects served ANONYMOUSLY:
//   - one rolling "live" project (current wave's primaries / better-PM / tpp /
//     PM-net-satisfaction archive back to 2022), addressable by a stable slug
//     with no article, no cookies, no Chrome;
//   - per-wave STATIC embeds inside each article's rendered DOM
//     (div.infogram-embed[data-id]), carrying Hanson's satisfaction, the
//     three-way PPM, the ALB–ONP distributed pair and the true fieldwork window.
//
// Governing trap (verified 2026-08-31): embeds are NOT pinned to the article
// that carried them — the publisher republishes the same project each wave, so
// an old story's charts silently roll forward. Every figure here is therefore
// dated ONLY from the chart's own labels, never from the story it rode in on.

export const IG_SLUG = "https://infogram.com/federal-newspoll-regular-1h7v4pdj7oj184k";
export const IG_EMBED = (id) => `https://e.infogram.com/${id}?src=embed`;

export const IG_LIVE_TITLES = {
  "Newspoll Federal Primary Vote": "primary",
  "Newspoll Federal Two-party preferred": "tpp",
  "Newspoll Federal Better PM": "betterpm",
  "Newspoll Federal PM Net Satisfaction": "netsat",
};

const IG_MONTHS = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };
const pad = (n) => String(n).padStart(2, "0");
const isoOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

// "August 30" (no year) / "Aug 30, 2026" → iso. Anchor year is the caller's
// (refreshed timestamp or a release window), NEVER the bare wall clock when
// attaching: if the anchored candidate lands after the anchor itself, it was
// last year's label.
export function igDate(label, anchorIso) {
  const m = String(label).trim().match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:,\s*(\d{4}))?$/);
  if (!m) return null;
  const mo = IG_MONTHS[m[1].toLowerCase()];
  if (mo == null) return null;
  if (m[3]) return isoOf(+m[3], mo, +m[2]);
  const y = anchorIso ? +anchorIso.slice(0, 4) : new Date().getUTCFullYear();
  let cand = isoOf(y, mo, +m[2]);
  if (anchorIso && cand > anchorIso) cand = isoOf(y - 1, mo, +m[2]);
  return cand;
}

// "August 24-28" → {start, end} anchored like igDate.
export function igWindow(label, anchorIso) {
  const m = String(label).trim().match(/^([A-Za-z]+)\.?\s+(\d{1,2})\s*[-–]\s*(?:(\d{1,2})\s*)?$/);
  if (!m) return null;
  const y = anchorIso ? +anchorIso.slice(0, 4) : new Date().getUTCFullYear();
  const mo = IG_MONTHS[m[1].toLowerCase()];
  if (mo == null || !m[3]) return null;
  let run = (yr) => ({ start: isoOf(yr, mo, +m[2]), end: isoOf(yr, mo, +m[3]) });
  let w = run(y);
  if (anchorIso && w.start > anchorIso) w = run(y - 1);
  return w;
}

// window.infographicData carries tens of KB of JSON; brace-match from the
// first "{" after the marker — a lazy };</script> regex misses the real close.
export function infographicDataOf(html) {
  const i = html.indexOf("window.infographicData");
  if (i < 0) return null;
  const j = html.indexOf("{", i);
  if (j < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let k = j; k < html.length; k++) {
    const c = html[k];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (!depth) { try { return JSON.parse(html.slice(j, k + 1)); } catch { return null; } }
    }
  }
  return null;
}

// Live charts announce themselves as objects with chartData.custom.live
// {title, key}; dedupe by key (the data tree repeats nodes).
export function liveChartsOf(data) {
  const out = new Map();
  (function walk(o) {
    if (!o || typeof o !== "object") return;
    const live = o?.chartData?.custom?.live ?? (o.live?.key && o.live.title ? o.live : null);
    if (live?.key && live.title && !out.has(live.key)) out.set(live.key, { title: live.title, key: live.key });
    for (const k in o) walk(o[k]);
  })(data);
  return [...out.values()];
}

// Static charts carry their values inline at chartData.data (cells {value}).
// Returns [{header, rows}] where rows are arrays of plain cell strings.
export function staticChartsOf(data) {
  const out = [];
  (function walk(o) {
    if (!o || typeof o !== "object") return;
    const cd = o.chartData;
    if (cd?.data && !cd.custom?.live) {
      const sheet = cd.data[0];
      if (Array.isArray(sheet) && Array.isArray(sheet[0]) && sheet[0]?.[0]) {
        const rows = sheet.map((r) => r.map((c) => String(c?.value ?? "").trim()));
        out.push({ header: rows[0][0], rows });
      }
    }
    for (const k in o) walk(o[k]);
  })(data);
  return out;
}

const pct = (s) => {
  const m = /^\s*(-?[\d.]+)\s*%\s*$/.exec(String(s ?? ""));
  return m ? parseFloat(m[1]) : null;
};
const numOrNull = (s) => {
  const m = /^\s*(-?[\d.]+)\s*$/.exec(String(s ?? ""));
  return m ? parseFloat(m[1]) : null;
};

// ------------------------------------------------------------------- rungs
// Orchestration takes the caller's fetchText (retry policy stays with the
// extractor). Unavailability degrades to state "unavailable"|"note" — the
// prose pipeline must survive an Infogram outage; structural drift (missing
// infographicData, fewer than the four titled live charts, a live-key fetch
// failure) returns state "guard" and the extractor fails loudly.
export const IG_DAY_WINDOW = 5; // rung A: label (publication date) sits 0–5d after fieldwork end
export const IG_STA_WINDOW = 3; // rung B: static label's fieldwork end ±3d of cluster date

export async function infogramLive(fetchText, latestNp) {
  let page;
  try { page = await fetchText(IG_SLUG); }
  catch (e) { return { state: "unavailable", why: `slug fetch: ${e.message}` }; }
  const data = infographicDataOf(page.text);
  if (!data) return { state: "guard", why: "slug page carries no window.infographicData — structure changed" };
  const lives = liveChartsOf(data);
  const byKind = {};
  for (const l of lives) { const k = IG_LIVE_TITLES[l.title]; if (k) byKind[k] ??= l; }
  const missing = Object.values(IG_LIVE_TITLES).filter((k) => !byKind[k]);
  if (missing.length)
    return { state: "guard", why: `live titles unresolved (${lives.length} seen): ${missing.join(", ")}` };
  const feeds = {};
  for (const [kind, l] of Object.entries(byKind)) {
    try { feeds[kind] = JSON.parse((await fetchText(`https://live-data.jifo.co/${l.key}`)).text); }
    catch (e) { return { state: "guard", why: `live feed "${l.title}" fetch/parse failed: ${e.message}` }; }
  }
  const primary = parsePrimary(feeds.primary.data[0]);
  const tpp = parseTpp(feeds.tpp.data[0]);
  const betterpm = parseBetterPm(feeds.betterpm.data[0]);
  const netsat = parseNetsat(feeds.netsat.data[0]);
  const refreshed = Object.values(feeds).map((f) => f.refreshed).filter(Boolean).sort().pop() ?? null;
  // The primary label is a PUBLICATION date ("August 30", no year) — anchor
  // the year to the feed's own refreshed timestamp, never the wall clock.
  const pubIso = igDate(primary.label, refreshed?.slice(0, 10));
  if (!pubIso) return { state: "guard", why: `primary label "${primary.label}" unparsable` };
  if (latestNp && (pubIso < latestNp || (refreshed && refreshed.slice(0, 10) < latestNp)))
    return { state: "stale", why: `label ${pubIso} / refreshed ${refreshed} vs recorded wave ${latestNp}`, pubIso };
  // Netsat row for this wave: the one whose publication label matches the
  // primary feed's. Its OL column is era-keyed by the CLUSTER's date, so
  // leader identity is resolved at attach time in the caller.
  const waveNet = netsat.filter((r) => r.iso === pubIso).pop() ?? netsat[netsat.length - 1];
  return {
    state: "ok", pubIso, refreshed,
    figs: { alp: primary.alp, lnp: primary.lnp, grn: primary.grn, onp: primary.onp, ind: primary.ind,
      tpp_alp: tpp.tpp_alp, tpp_lnp: tpp.tpp_lnp,
      ppmA: betterpm.ppmA, ppmO: betterpm.ppmO,
      pmNet: waveNet?.pm ?? null, oppNetByEra: { dutton: waveNet?.dutton ?? null, ley: waveNet?.ley ?? null, taylor: waveNet?.taylor ?? null } },
    ppmUnc: betterpm.ppmUnc, betterpmOppName: betterpm.oppName,
    tppResumed: tpp.resumed, netsat,
  };
}

// Rung B: fetch each embed id, classify, parse. Live-project embeds are
// rung A's own charts riding in the article — skipped, not double-read.
export async function infogramStatic(fetchText, ids) {
  const out = [];
  for (const id of ids) {
    let html;
    try { html = (await fetchText(IG_EMBED(id))).text; }
    catch (e) { out.push({ id, state: "note", why: `embed fetch: ${e.message}` }); continue; }
    const data = infographicDataOf(html);
    if (!data) { out.push({ id, state: "note", why: "no infographicData in embed" }); continue; }
    const parsed = parseStatic(data);
    if (parsed.live) { out.push({ id, state: "live-skip" }); continue; }
    if (!parsed.hanson && !parsed.ranked) { out.push({ id, state: "note", why: "no recognised static charts" }); continue; }
    out.push({ id, state: "ok", parsed });
  }
  return out;
}

// A rung-A record attaches to the cluster whose fieldwork end sits 0..N days
// before the chart's publication label — the LATEST such cluster wins, and
// only when the prose-read ALP figure (when present) agrees with the chart's
// within 0.5pp. Naive date equality mispairs (labels lag the tracker date
// 0–3 days, and a mismatch there is a mispaired wave, not a real conflict).
// mergeProse is the extractor's mergeCluster, injected so this stays pure.
export function attachTarget(clusterDates, pubIso, backDays, alp, mergeProse, DAY) {
  const cands = [...clusterDates]
    .filter((d) => { const w = (new Date(pubIso) - new Date(d)) / DAY; return w >= 0 && w <= backDays; })
    .sort().reverse();
  for (const d of cands) {
    if (alp == null) return d;
    const m = mergeProse(d);
    if (m.alp == null || Math.abs(m.alp - alp) <= 0.5) return d;
  }
  return null;
}

// ----------------------------------------------------------- live parsers
export function parsePrimary(sheet) {
  // [["Primary","August 30"],["Coalition","19%"],["Labor","29%"],…]
  const label = sheet?.[0]?.[1] ?? null;
  const map = {};
  for (const [name, val] of sheet.slice(1)) map[String(name).toLowerCase()] = pct(val);
  return {
    label,
    alp: map["labor"] ?? null, lnp: map["coalition"] ?? null,
    grn: map["greens"] ?? null, onp: map["one nation"] ?? null,
    ind: map["other"] ?? null, // tracker Newspoll convention: Others bucket → ind, never oth
  };
}

export function parseTpp(sheet) {
  // [["DATE","March 1"],["ALP","N/A"],["Coalition","N/A"]] — Newspoll stopped
  // publishing 2PP; N/A maps to null, and a future numeric value is a real
  // resumption, surfaced via the returned flag.
  const rows = Object.fromEntries(sheet.slice(1).map(([k, v]) => [String(k).toUpperCase(), String(v)]));
  const resumed = rows.ALP != null && rows.ALP !== "N/A";
  return { label: sheet?.[0]?.[1] ?? null,
    tpp_alp: resumed ? numOrNull(rows.ALP) : null,
    tpp_lnp: resumed ? numOrNull(rows.COALITION) : null, resumed };
}

export function parseBetterPm(sheet) {
  // [["Name","Anthony Albanese","Uncommitted","Angus Taylor"],["%","44%","21%","35%"]]
  const names = sheet[0].slice(1), vals = sheet[1].slice(1);
  const at = (re) => { const i = names.findIndex((n) => re.test(n)); return i < 0 ? null : { name: names[i], v: pct(vals[i]) }; };
  const alb = at(/albanese/i);
  const unc = at(/uncommitted|undecided|don.?t know/i);
  const others = names.map((n, i) => ({ n, v: pct(vals[i]) }))
    .filter((x) => !/albanese|uncommitted|undecided|don.?t know/i.test(x.n));
  return {
    ppmA: alb?.v ?? null,
    ppmUnc: unc?.v ?? null, // carried for status output only — NOT written to rows
    oppName: others[0]?.n ?? null, ppmO: others[0]?.v ?? null,
  };
}

export function parseNetsat(sheet) {
  // [["Date","Anthony Albanese","Peter Dutton","Sussan Ley","Angus Taylor"],
  //  ["July 31, 2022","35","-4","",""], …] — genuine 2022→now archive,
  //  satisfaction NETS per leader (labels are PUBLICATION dates).
  const leaders = sheet[0].slice(1);
  const rows = [];
  for (const r of sheet.slice(1)) {
    const vals = {};
    leaders.forEach((L, i) => {
      const key = /albanese/i.test(L) ? "pm" : /dutton/i.test(L) ? "dutton"
        : /ley/i.test(L) ? "ley" : /taylor/i.test(L) ? "taylor" : null;
      if (key) vals[key] = numOrNull(r[i + 1]); // "" → null (pre-tenure)
    });
    rows.push({ label: r[0], iso: igDate(r[0]), ...vals });
  }
  return rows;
}

// ---------------------------------------------------------- static parsers
// Identify by first header cell; names read positionally from the chart
// itself, never assumed.
export function parseHansonTable(rows) {
  // ["Hanson's Performance","August 24-28","August 3-7","July 13-16","June 22-25"]
  // ["Satisfied",47…],["Dissatisfied",48…],["Uncommitted",5…] — latest column
  // only; earlier columns are corroborated history, not writes.
  const label = rows[0][1];
  const col = (re) => { const r = rows.find((x) => re.test(x[0])); return r ? pct(r[1]) : null; };
  return { fieldworkLabel: label, hanApp: col(/^satisfied$/i), hanDis: col(/^dissatisfied$/i),
    hanUnc: col(/^uncommitted$/i) };
}

export function parseRanked(rows) {
  // ["Ranked 1st PM","Ranked 1st PM"],["Anthony Albanese","46%"],["Angus Taylor","23%"],["Pauline Hanson","31%"]
  const picks = {};
  for (const [n, v] of rows.slice(1)) {
    if (/albanese/i.test(n)) picks.ppm3A = pct(v);
    else if (/hanson/i.test(n)) picks.ppm3H = pct(v);
    else if (n) { picks.oppName = n; picks.ppm3O = pct(v); }
  }
  return picks;
}

export function parseDistributed(rows) {
  // [["Name","Anthony Albanese","Pauline Hanson"],["%","56%","44%"]] — the
  // "top two leaders" pair. Only Albanese–Hanson belongs in the tracker's
  // ppmHeadToHead section; a different pairing is reported, not inserted.
  const names = rows[0].slice(1), vals = rows[1].slice(1);
  const ai = names.findIndex((n) => /albanese/i.test(n));
  const hi = names.findIndex((n) => /hanson/i.test(n));
  return { isAlbHan: ai >= 0 && hi >= 0,
    alb: ai >= 0 ? pct(vals[ai]) : null, han: hi >= 0 ? pct(vals[hi]) : null,
    names };
}

export function parseStatic(data) {
  const out = { hanson: null, ranked: null, distributed: null, live: liveChartsOf(data).length > 0 };
  for (const c of staticChartsOf(data)) {
    if (/hanson.?s performance/i.test(c.header)) out.hanson = parseHansonTable(c.rows);
    else if (/ranked 1st pm/i.test(c.header)) out.ranked = parseRanked(c.rows);
    else if (/^name$/i.test(c.header)) out.distributed = parseDistributed(c.rows);
  }
  return out;
}
