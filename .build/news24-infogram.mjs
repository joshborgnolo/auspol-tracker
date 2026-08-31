// The News24 / YouGov half of the Infogram rung (spec: .build/newspoll-infogram-rung.md).
// Every News24 Pulse article embeds six static Infogram projects (`_/` ids, fresh
// per wave → pinned), all anonymously fetchable at e.infogram.com. Authority
// ranking: per-wave crosstab + dedicated tables are authoritative (Σ100, field-
// for-field verified against canon 2026-08-24); the horserace time-series is
// hand-maintained with proven errors (Jul-14 Σ=94, Jan-8 Σ=102) and is
// corroboration only, never a figure source.
import { infographicDataOf, staticChartsOf, liveChartsOf, IG_EMBED } from "./infogram.mjs";

// Id format: "data-id=\"_/…\"" in the article DOM. The DOM normaliser
// handles JSON \" and \/ escapes plus the &#47; entity before matching;
// ids are deduped in DOM order.
export function n24IdsOf(html) {
  const t = String(html ?? "").replace(/\\"/g, `"`).replace(/\\\//g, "/").replace(/&#47;/g, "/");
  const ids = [];
  for (const m of t.matchAll(/data-id="(_\/[A-Za-z0-9]+)"/g)) if (!ids.includes(m[1])) ids.push(m[1]);
  return ids;
}

// Chart+text entities live in elements.content.content.entities with editor
// coords (left/top) — the deterministic basis for positional tables.
function chartEntitiesOf(data) {
  const ents = data?.elements?.content?.content?.entities;
  if (!ents || typeof ents !== "object") return [];
  const out = [];
  for (const e of Object.values(ents)) {
    const cd = e?.props?.chartData;
    if (e?.type !== "CHART" || !cd?.data) continue;
    const sheets = cd.data.filter((s) => Array.isArray(s) && Array.isArray(s[0]) && s.length >= 2);
    for (const sheet of sheets) {
      out.push({ left: +e.left || 0, top: +e.top || 0,
        rows: sheet.map((r) => r.map((c) => String(c?.value ?? "").trim())) });
    }
  }
  return out;
}

// DraftJS text leaves; the fieldwork window caption is one of them.
function textsOf(o, out = []) {
  if (!o || typeof o !== "object") return out;
  for (const k in o) {
    const v = o[k];
    if (typeof v === "string" && k === "text" && v.trim()) out.push(v.trim());
    else if (v && typeof v === "object") textsOf(v, out);
  }
  return out;
}

const IG_MONTHS = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };
const isoOf = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// "Source: News24 Pulse / YouGov (August 18-24, 2026)" — same- and cross-month.
export function n24WindowOf(data) {
  for (const t of textsOf(data)) {
    const m = t.match(/\(([A-Za-z]+)\.?\s+(\d{1,2})\s*[-–]\s*(?:([A-Za-z]+)\.?\s+)?(\d{1,2}),\s*(\d{4})\)/);
    if (!m) continue;
    const m1 = IG_MONTHS[m[1].toLowerCase()], m2 = m[3] ? IG_MONTHS[m[3].toLowerCase()] : m1;
    if (m1 == null || m2 == null) continue;
    return {
      start: isoOf(m1 > m2 ? +m[5] - 1 : +m[5], m1, +m[2]),
      end: isoOf(+m[5], m2, +m[4]),
    };
  }
  return null;
}

const pct = (s) => { const m = /^\s*(-?[\d.]+)\s*%?\s*$/.exec(String(s ?? "")); return m && s !== "" ? parseFloat(m[1]) : null; };
const num = (s) => { const m = /^\s*(-?[\d.]+)\s*$/.exec(String(s ?? "")); return m ? parseFloat(m[1]) : null; };

// Leader keys mentioned in a title, in mention order: "Albanese-Taylor
// approvals N24P 24082026" → ["albanese","taylor"].
const N24_NAME = /albanese|taylor|hanson|dutton|ley|morrison/gi;
function leadersInTitle(title) {
  const out = [];
  for (const m of String(title ?? "").matchAll(N24_NAME)) if (!out.includes(m[0].toLowerCase())) out.push(m[0].toLowerCase());
  return out;
}

// Approvals: N cornerless tables headed ["", "Support"] {Satisfied,Dissatisfied,
// Don't know}, identified by the chart TITLE's leader-name order zipped to
// geometry order (sorted by `left`). Title or count mismatch → null (decline,
// never guess): there is no name inside the tables themselves.
export function parseN24Approvals(data) {
  const title = data?.title;
  const leaders = leadersInTitle(title);
  const tables = chartEntitiesOf(data)
    .filter((t) => t.rows[0][0] === "" && /^support$/i.test(t.rows[0][1] ?? ""))
    .sort((a, b) => a.left - b.left);
  if (leaders.length < 2 || tables.length !== leaders.length) {
    return { pairs: null, why: `title leaders [${leaders}] vs ${tables.length} approval tables — positional mapping unsafe` };
  }
  const pairs = {};
  for (let i = 0; i < tables.length; i++) {
    const cell = (re) => { const r = tables[i].rows.find((x) => re.test(x[0])); return r ? pct(r[1]) : null; };
    pairs[leaders[i]] = { app: cell(/^satisfied$/i), dis: cell(/^dissatisfied$/i), unc: cell(/^don.?t know$/i) };
  }
  for (const [k, v] of Object.entries(pairs)) {
    const sum = (v.app ?? 0) + (v.dis ?? 0) + (v.unc ?? 0);
    if (v.app == null || v.dis == null || Math.abs(sum - 100) > 1)
      return { pairs: null, why: `approvals ${k} Σ=${sum} or missing cells` };
  }
  return { pairs, why: null };
}

// Preferred PM: N cornerless tables keyed BY COLUMN NAMES — header
// ["", "Anthony Albanese", "Don't know", <opp>], row label "Preferred PM".
export function parseN24Ppm(data) {
  const out = [];
  for (const t of chartEntitiesOf(data)) {
    const head = t.rows[0];
    if (head[0] !== "" || !/albanese/i.test(head[1] ?? "")) continue;
    const row = t.rows.find((r) => /^preferred pm$/i.test(r[0]));
    const ai = head.findIndex((h) => /albanese/i.test(h));
    const di = head.findIndex((h) => /don.?t know/i.test(h));
    const oi = head.findIndex((h, i) => i > 0 && i !== ai && i !== di && h);
    if (!row || ai < 0 || oi < 0) continue;
    out.push({ alb: pct(row[ai]), dk: di > 0 ? pct(row[di]) : null,
      opp: pct(row[oi]), oppRaw: head[oi], table: "ppm" });
  }
  return out.length ? out : null;
}

// 2PP: cornerless, header ["", "Labor vs Coalition", "Labor vs One Nation"];
// blanks are structural (each pairing occupies its own column).
export function parseN24Tpp(data) {
  for (const t of chartEntitiesOf(data)) {
    const head = t.rows[0];
    const ci = head.findIndex((h) => /labor vs coalition/i.test(h));
    const hi = head.findIndex((h) => /labor vs one nation/i.test(h));
    if (ci < 0 && hi < 0) continue;
    const rowVals = (re) => t.rows.find((r) => re.test(r[0]));
    const lab = rowVals(/^labor$/i), coa = rowVals(/^coalition$/i), onp = rowVals(/^one nation$/i);
    const out = {};
    if (ci > 0 && lab && coa && num(lab[ci]) != null && num(coa[ci]) != null)
      out.coalition = { alp: num(lab[ci]), lnp: num(coa[ci]) };
    if (hi > 0 && lab && onp && num(lab[hi]) != null && num(onp[hi]) != null)
      out.oneNation = { alp: num(lab[hi]), onp: num(onp[hi]) };
    if (!out.coalition && !out.oneNation)
      return { tpp: null, why: `2pp header matched but no filled pairing (labor=${JSON.stringify(lab?.slice(1))})` };
    return { tpp: out, why: null };
  }
  return { tpp: null, why: "no 2pp table" };
}

// Crosstab: corner "Party", second column "Total". `oth` = Other + Community
// Strong (verified vs canon oth:7 = 5+2 on 2026-08-24); both constituents are
// returned separately as provenance. Σ100 on the Total column is the
// authority gate — fail ⇒ null, the caller falls back to prose/Wikipedia.
export function parseN24Crosstab(data) {
  for (const t of chartEntitiesOf(data)) {
    const head = t.rows[0];
    if (head[0] !== "Party" || head[1] !== "Total") continue;
    const get = (re) => { const r = t.rows.find((x) => re.test(x[0])); return r ? num(r[1]) : null; };
    const vi = {
      alp: get(/^labor$/i), lnp: get(/^coalition$/i), onp: get(/^one nation$/i),
      grn: get(/^the greens$/i), ind: get(/^independent$/i),
      other: get(/^other$/i), csa: get(/^community strong$/i),
    };
    if ([vi.alp, vi.lnp, vi.onp, vi.grn].some((v) => v == null))
      return { vi: null, why: "crosstab missing a core party row" };
    const parts = [[vi.alp], [vi.lnp], [vi.onp], [vi.grn]];
    for (const k of ["ind", "other", "csa"]) if (vi[k] != null) parts.push([vi[k]]);
    const sum = Math.round(parts.reduce((a, [v]) => a + v, 0) * 10) / 10;
    if (Math.abs(sum - 100) > 1) return { vi: null, why: `crosstab Total Σ=${sum} not ~100 — declining authority` };
    return {
      vi: {
        alp: vi.alp, lnp: vi.lnp, onp: vi.onp, grn: vi.grn,
        ind: vi.ind, oth: vi.other == null && vi.csa == null ? null
          : Math.round(((vi.other ?? 0) + (vi.csa ?? 0)) * 10) / 10,
      },
      detail: { other: vi.other, csa: vi.csa },
      why: null,
    };
  }
  return { vi: null, why: "no crosstab sheet" };
}

// Horserace: corner "Party" with party-name columns (header[1] !== "Total").
// CORROBORATION ONLY — hand-maintained, proven Σ=94/Σ=102 columns. Every row
// is Σ100-guarded; failures are reported, never consumed.
export function parseN24Horserace(data) {
  for (const t of chartEntitiesOf(data)) {
    const head = t.rows[0];
    if (head[0] !== "Party" || head[1] === "Total") continue;
    const col = (re) => head.findIndex((h) => re.test(h));
    const cA = col(/^labor$/i), cL = col(/^coalition$/i), cO = col(/^one nation$/i),
      cG = col(/^greens|the greens$/i), cI = col(/independent\/other/i), cC = col(/community strong/i);
    if ([cA, cL, cO, cG].some((i) => i < 0)) return { rows: null, why: `horserace header drifted: ${JSON.stringify(head)}` };
    const rows = [], bad = [];
    for (const r of t.rows.slice(1)) {
      const label = (r[0] ?? "").trim();
      if (!label || label === "◦") continue;
      const dm = label.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),\s*(\d{4})$/);
      const tag = /^2025 election$/i.test(label) ? "2025-election" : null;
      if (!dm && !tag) continue;
      const g = (i) => (i > 0 ? num(r[i]) : null);
      const row = {
        date: dm ? isoOf(+dm[3], IG_MONTHS[dm[1].toLowerCase()], +dm[2]) : null, tag,
        alp: g(cA), lnp: g(cL), onp: g(cO), grn: g(cG),
        indoth: g(cI), csa: g(cC), // Independent/Other is a MERGED column; CSA separate
      };
      const sum = [row.alp, row.lnp, row.onp, row.grn, row.indoth]
        .filter((v) => v != null).reduce((a, b) => a + b, 0) + (row.csa ?? 0);
      if ([row.alp, row.lnp, row.onp, row.grn, row.indoth].some((v) => v == null)) continue; // sparse lead-in rows
      row.sum = Math.round(sum * 10) / 10;
      // Integer cells and exact-100 published rows: >1.5 off 100 = a paste
      // error (proven: Jul-14 Σ=94, Jan-8 Σ=102), never rounding noise.
      if (Math.abs(row.sum - 100) > 1.5) { bad.push({ label, sum: row.sum }); continue; }
      rows.push(row);
    }
    return { rows, bad, why: null };
  }
  return { rows: null, why: "no horserace sheet" };
}

// Fetch and classify every embed of one article. fetchEmbed(idString) ->
// html; supplied by the caller (plain fetchText against e.infogram.com in
// production, a fixture dir under N24_IG_DIR in tests). classify only — the
// summary step below assigns figures.
export async function n24InfogramFetch(fetchEmbed, ids) {
  const projects = [];
  for (const id of ids) {
    let html;
    try { html = await fetchEmbed(id); } catch (e) {
      projects.push({ id, state: "note", why: `embed fetch: ${e.message}` }); continue;
    }
    const data = infographicDataOf(html);
    if (!data) { projects.push({ id, state: "note", why: "no infographicData in embed" }); continue; }
    if (liveChartsOf(data).length) { projects.push({ id, state: "note", why: "unexpected live charts" }); continue; }
    const proj = { id, state: "ok", window: n24WindowOf(data), title: data?.title ?? null };
    // classify by shape — at most one kind per project in the six-project layout
    const ap = parseN24Approvals(data);
    const ppm = parseN24Ppm(data);
    const tppR = parseN24Tpp(data);
    const ct = parseN24Crosstab(data);
    const hr = parseN24Horserace(data);
    if (ct.vi) { proj.kind = "crosstab"; proj.vi = ct.vi; proj.detail = ct.detail; }
    else if (ap.pairs) { proj.kind = "approvals"; proj.approvals = ap.pairs; }
    else if (ppm) { proj.kind = "ppm"; proj.ppm = ppm; }
    else if (tppR.tpp) { proj.kind = "tpp"; proj.tpp = tppR.tpp; }
    else if (hr.rows) { proj.kind = "horserace"; proj.horserace = hr.rows; proj.horseraceBad = hr.bad; }
    else if (staticChartsOf(data).length) { proj.kind = "unmodelled"; } // e.g. issue ownership
    else { proj.state = "note"; proj.why = [ct.why, ap.why, tppR.why, hr.why].filter(Boolean).join("; "); }
    projects.push(proj);
  }
  return projects;
}

// Horserace corroboration, tolerating the +1-day label offset seen pre-June
// 2026: a chart row matches the wave date if |chartDate − date| ≤ 1d, exact
// match preferred. `ind`/`oth` compare against the chart's merged column
// (indoth + csa). Returns problem strings; never figures.
export function n24Corroborate(horserace, date, figures) {
  const problems = [];
  if (!horserace?.length || !date) return problems;
  const target = new Date(date).getTime();
  const best = horserace
    .filter((r) => r.date)
    .map((r) => ({ r, d: Math.abs(new Date(r.date) - target) / 86400000 }))
    .filter((x) => x.d <= 1)
    .sort((a, b) => a.d - b.d)[0]?.r;
  if (!best) { problems.push(`horserace has no column within ±1d of ${date}`); return problems; }
  const cmp = (k, got, want) => {
    if (got != null && want != null && Math.abs(got - want) > 1)
      problems.push(`horserace ${best.date ?? best.tag} ${k} ${got} != wave ${want}`);
  };
  cmp("alp", best.alp, figures?.alp);
  cmp("lnp", best.lnp, figures?.lnp);
  cmp("onp", best.onp, figures?.onp);
  cmp("grn", best.grn, figures?.grn);
  const merged = best.indoth != null ? best.indoth + (best.csa ?? 0) : null;
  const want = figures?.ind != null || figures?.oth != null ? (figures?.ind ?? 0) + (figures?.oth ?? 0) : null;
  cmp("ind+oth", merged, want);
  return problems;
}

// Assemble the authoritative figures from classified projects. Missing
// projects degrade to null sections — the caller substitutes prose/Wikipedia
// for exactly those fields. All cross-project window labels must agree.
export function n24Figures(projects) {
  const fig = { vi: null, tpp: null, altTpp: null, approval: null, ppm: [], problems: [] };
  const window = { start: null, end: null };
  for (const p of projects.filter((x) => x.state === "ok")) {
    if (p.window) {
      for (const k of ["start", "end"]) {
        if (window[k] && p.window[k] !== window[k])
          fig.problems.push(`caption window drift: ${p.window[k]} (${p.id}) != ${window[k]}`);
        else window[k] ??= p.window[k];
      }
    }
    if (p.kind === "crosstab") fig.vi ??= p.vi;
    if (p.kind === "tpp" && p.tpp) {
      if (p.tpp.coalition) fig.tpp ??= { tpp_alp: p.tpp.coalition.alp, tpp_lnp: p.tpp.coalition.lnp };
      if (p.tpp.oneNation) fig.altTpp ??= { alpVsOnp_alp: p.tpp.oneNation.alp, alpVsOnp_onp: p.tpp.oneNation.onp };
    }
    if (p.kind === "approvals" && p.approvals) {
      const alb = p.approvals.albanese ?? null;
      const oppName = Object.keys(p.approvals).find((k) => k !== "albanese");
      fig.approval ??= { alb, opp: oppName ? p.approvals[oppName] : null, oppName: oppName ?? null };
    }
    if (p.kind === "ppm" && p.ppm) fig.ppm = p.ppm;
    if (p.kind === "horserace") {
      fig.horserace ??= p.horserace ?? null;
      for (const b of p.horseraceBad ?? []) fig.problems.push(`horserace ${b.label} sums to ${b.sum} — column excluded`);
    }
  }
  if (window.start && window.end) fig.window = window;
  for (const pm of fig.ppm) {
    if (pm.alb == null || pm.opp == null) fig.problems.push(`ppm table vs ${pm.oppRaw}: missing cell`);
  }
  return fig;
}
