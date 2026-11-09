/* allpolls.mjs – the retro All polls page, /allpolls/retro/ (2026-11-08).

   The All polls archive dressed as the Electoral map's retro view dresses
   the map: a website from about 2000, the navbar in the era's words (Home,
   Edit, View, Favorites, Help, the site's pages at its right), the navy
   banner, tab buttons for the measures, and every poll in the old details
   list. The retro map's navbar opens it in place of the modern page; it is
   linked from nowhere else, and its canonical is the modern page's.

   build.mjs calls retroAllPolls() on every federal build and writes the
   result to allpolls/retro/index.html (a SITE_FILES member, so every data
   commit carries it). Nothing here computes a figure of its own: the rows
   are the dataset's individualPolls, read through the modern table's own
   formulas (rd-allpolls.jsx: rdApLeanFor, rdApHe, rdPollMargin, the month
   rows' monthAvg, rdApTppStory's head), so the two tables agree figure for
   figure. Its seven tabs are the modern table's seven facets, each with that
   facet's own row set and default scope: the vote tabs read individualPolls;
   Direction and Issues add the waves that ask no voting question
   (directionOnlyPolls, issuesOnlyPolls); Confidence lists the economic
   gauges' releases (confidenceOnlyPolls) instead of polls; and their rules
   (the demographic pairs, who leads on an issue, the business lanes) are
   lifted from the modern table's own source (facetRules). The page is one
   self-contained document: the shared chrome
   (chrome.css), its own panels (allpolls.css) and its script
   (allpolls.client.js), whose renderers also run here to write the table
   into the page as it first opens. */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(HERE, f), "utf8");
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const r1 = (v) => Math.round(v * 10) / 10;
const DAY = 864e5;
const days = (iso) => Date.parse(String(iso).slice(0, 10) + "T00:00:00Z");
/* a release stamp as a sort key: the dataset's stamps carry no zone
   ("2025-06-03T15:15"), and Date.parse reads a zone-less date-time in the
   build machine's own time, so a Sydney laptop build and a UTC CI build
   wrote keys 10-11 hours apart and the page churned with the builder. Read
   every stamp as UTC: only the order matters, and it is the same for all */
const stampMs = (s) => Date.parse(/(Z|[+-]\d\d:?\d\d)$/i.test(s) || String(s).length <= 10 ? s : s + "Z");
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dayFull = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return `${d} ${MONTH[m - 1]} ${y}`; };
const NUMW = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
const numWord = (n) => NUMW[n] || String(n);
const NAMES = { alp: "Labor", lnp: "the Coalition", grn: "the Greens", onp: "One Nation", oth: "Others" };
const LEADER = { alb: "Albanese", taylor: "Taylor", ley: "Ley", hanson: "Hanson", unc: "undecided" };
const baseHouse = (h) => h.replace(/ \((MRP|SMS|pooled|shifts)\)$/, "");

/* The dataset gen-data writes is one `const name = <JSON>;` line per table
   (build.mjs's grab, the same reader its static summaries use). */
const grabber = (src) => (name) => {
  const i = src.indexOf("const " + name + " = ");
  if (i < 0) throw new Error("retro All polls: " + name + " not found in the dataset");
  return JSON.parse(src.slice(i + name.length + 9, src.indexOf("\n", i)).replace(/;$/, ""));
};

/* ----------------------------------------------------------------- the facets' own rules, lifted
   Direction, Issues, Demographics and Confidence read their rows through
   rules that live in the modern page's tables asset: the demographic splits
   and the pair of groups each poll draws (DEM_SPLITS, demPairOf), the six
   issues the Issues facet tables and who leads on each (ISS_MAP, issOwnOf,
   issLeadOf), the parties' short names there (ISS_PARTY_META) and the
   business gauges' lanes (CONF_BUS_LANES). They are lifted from that source
   at build time, the way site-shell.mjs lifts the main page's TABS, never
   copied, so the two tables can't come to disagree. A refactor that moves
   one of the markers stops here and names it. */
const TABLES_ASSET = path.join(HERE, "..", "newtracker", "assets", "d1a1d215-370c-4ebc-878b-7eeea9ad8102.js");
export function facetRules(demoGroups) {
  const src = fs.readFileSync(TABLES_ASSET, "utf8");
  const cut = (from, to) => {
    const a = src.indexOf(from), b = a < 0 ? -1 : src.indexOf(to, a);
    if (a < 0 || b < 0) throw new Error(`retro All polls: the modern tables asset no longer holds "${a < 0 ? from : to}" – facetRules can't lift the facets' rules`);
    return src.slice(a, b);
  };
  const body = cut("const ISS_PARTY_META = {", "function issBestOf(") + cut("const DEM_SPLITS = [", "// the top-issue cell");
  const bus = (src.match(/const CONF_BUS_LANES = new Set\((\[[^\]]*\])\);/) || [])[1];
  if (!bus) throw new Error("retro All polls: the modern tables asset no longer holds CONF_BUS_LANES");
  const R = new Function("window", body + "; return { ISS_PARTY_META, DEM_SPLITS, demPairOf, ISS_MAP, ISS_MAP_LAB, issOwnOf, issLeadOf };")({ AUSPOL: { demoGroups } });
  R.CONF_BUS_LANES = JSON.parse(bus);
  return R;
}

/* ----------------------------------------------------------------- the data model */
export function retroData(dataset, { pages, built }) {
  const grab = grabber(dataset);
  const P = grab("individualPolls"), L = grab("latest"), S = grab("synthLatest");
  const synth2pp = grab("synth2pp"), synthOn = grab("synthOn"), agg2pp = grab("agg2pp"), alt2pp = grab("alt2pp"), aggPrimary = grab("aggPrimary");
  const flowTables = grab("flowTables"), effTbcUrls = grab("effTbcUrls");
  // the tables a jurisdiction's dataset may not carry (the federal one carries every one)
  const grabOr = (name, dflt) => { try { return grab(name); } catch { return dflt; } };
  const issuesOnly = grabOr("issuesOnlyPolls", []), dirOnly = grabOr("directionOnlyPolls", []), confAll = grabOr("confidenceOnlyPolls", []);
  const issueLabels = (grabOr("issues", {}) || {}).labels || {};
  const rules = facetRules(grabOr("demoGroups", []));
  const deff = (L.method && L.method.deff) || 1.6;

  /* a poll's 95% margin on its implied figure (rdPollMargin, implied branch):
     each respondent carries their party's flow to Labor, so the variance is
     the flows' over the primaries, from the effective sample or the raw
     sample over the design effect */
  const margin = (p, contest) => {
    const n = p.sampleEff || (p.sample ? p.sample / deff : 0);
    if (!n) return null;
    const q = p.p || {};
    if (["alp", "lnp", "grn", "onp"].some((k) => q[k] == null)) return null;
    const F = flowTables[contest === "on" ? "onp" : "lnp"], ks = Object.keys(F);
    const tot = ks.reduce((s, k) => s + (q[k] || 0), 0);
    if (!tot) return null;
    let e1 = 0, e2 = 0;
    ks.forEach((k) => { const s = (q[k] || 0) / tot; e1 += s * F[k]; e2 += s * F[k] * F[k]; });
    return 196 * Math.sqrt(Math.max(0, e2 - e1 * e1) / n);
  };
  /* the yardstick (gen-data §3c): the headline's estimator read at the
     wave's midpoint from the OTHER polls; a lean is the figure less that
     average as printed to one decimal (rdApLeanFor), the house lean its
     own figure to one decimal (rdApHe) */
  const yd = (p, c) => (p.yd && p.yd[c === "on" ? "onimp" : "imp"]) || null;
  const leanOf = (p, c) => { const y = yd(p, c), x = c === "on" ? p.alpOnImp : p.alpImp; return x != null && y && y.v != null ? +(x - r1(y.v)).toFixed(1) : null; };
  const heOf = (p, c) => { const y = yd(p, c); return y && y.he != null ? r1(y.he) : null; };
  const avgOf = (p, c) => { const y = yd(p, c); return y && y.v != null ? r1(y.v) : null; };

  // today's implied figures on each contest (window.AP.tppLatest(…, "imp"))
  const today = {
    lnp: S && S.alp != null ? { a: S.alp, b: S.lnp } : { a: L.alp2pp, b: L.lnp2pp },
    on: L.onImp ? { a: L.onImp.a, b: L.onImp.b } : null,
  };
  const rival = L.rivalLead === "alp_on" && today.on ? "on" : "lnp";
  /* the polls today's figure is built from: fieldwork midpoint inside the
     estimator's window, an implied figure on the contest (the modern
     table's inToday) */
  const upd = days(L.updatedISO), winDays = (L.method && L.method.windowDays) || 21;
  const midOf = (p) => (p.mid != null ? p.mid : days(p.released));
  const inWin = (p, c) => { const t = midOf(p); return t >= upd - winDays * DAY && t <= upd && (c === "on" ? p.alpOnImp : p.alpImp) != null; };

  // whether a house files effective samples, as the modern table's eff. TBC / missing gates read it
  const all = P.concat(issuesOnly);
  const effTbcHabit = (p) => p.sampleEff == null && !!p.published && all.some((q) => q.pollster === p.pollster && q.sampleEff != null
    && q.released < p.released && days(q.released) >= days(p.released) - 90 * DAY);
  const effMissHabit = (p) => p.sampleEff == null && !!p.published && all.some((q) => q.pollster === p.pollster && q.sampleEff != null
    && Math.abs(days(q.released) - days(p.released)) < 120 * DAY);

  // the opposition leader the polls name now, and whom they named before
  const oppSeq = [];
  for (const p of P) { const n = p.appr && p.appr.oppName; if (n && oppSeq[oppSeq.length - 1] !== n) oppSeq.push(n); }
  const oppNow = oppSeq[oppSeq.length - 1] || "Taylor";
  const oppWas = [...new Set(oppSeq.slice(0, -1))].filter((n) => n !== oppNow);

  /* what every row carries, a poll's or a release's: who, when, how many,
     its links (and which its name opens: rdPollNameLink, its own release,
     else the report it was read from - an index, the URL being in the list
     already), and why it stays out of the aggregates */
  const base = (p, i) => {
    const links = (p.links || []).map((l) => ({ t: l.t, u: !l.pending && l.href ? l.href : null }));
    const lki = ["release", "cite"].map((k) => (p.links || []).findIndex((l, j) => l.k === k && links[j].u)).find((j) => j >= 0);
    const fe = p.released, y = +fe.slice(0, 4);
    return {
      i, h: p.pollster, b: baseHouse(p.pollster), c: p.client || null, f: p.fieldPending ? "TBC" : p.field,
      ff: p.fieldPending ? "dates to be confirmed" : p.field + (p.field.includes(String(y)) ? "" : " " + y),
      fe, pd: p.published ? p.published.slice(0, 10) : null, pt: stampMs(p.published || p.released), x: p.x, ym: p.ym,
      pym: p.published ? p.published.slice(0, 7) : p.ym, y,
      n: p.sample != null ? p.sample : null, ne: p.sampleEff != null ? p.sampleEff : null,
      // (a confidence release prints its own sample, and an effective sample isn't one of its concepts: rdEffTbc bails on p.conf)
      et: !p.conf && effTbcHabit(p), em: !p.conf && effMissHabit(p),
      lk: lki != null ? lki : null, links,
      na: p.noAgg ? (p.noAggWhy || "It does not count towards the aggregates.") : null,
    };
  };
  /* Direction (the modern facet's cells): right, wrong, unsure and net as
     printed, each with its change on the house's previous poll; a
     two-answer reading (SEC Newgate's right v wrong sums to 100) has no
     unsure share, so it carries none. The breakdowns the house printed ride
     along for the opened poll */
  const dirOf = (p) => {
    const d = p.dir;
    if (!d) return null;
    const c = d.chg || {}, u = d.unsure > 0;
    return { r: d.right, w: d.wrong, u: u ? d.unsure : null, n: d.net,
      c: { r: c.right != null ? c.right : null, w: c.wrong != null ? c.wrong : null, u: u && c.unsure != null ? c.unsure : null, n: c.net != null ? c.net : null },
      bg: (d.bg || []).map((g) => ({ h: g.head, c: (g.cuts || []).map((x) => [x.label, x.right, x.wrong]) })) };
  };
  /* Issues: the six issues the modern facet tables (ISS_MAP), each the four
     parties' shares as printed (alp, lnp, onp, grn), the party rated best
     and its lead over the next (issLeadOf: under half a point is level);
     and for the opened poll every issue it asked, what it said matters
     most, and its question */
  const P4 = ["alp", "lnp", "onp", "grn"];
  const issOf = (p) => {
    const s = p.iss;
    if (!s) return null;
    const cell = (id) => {
      const o = rules.issOwnOf(p, id);
      if (!o) return null;
      const L = rules.issLeadOf(o);
      return { s: P4.map((k) => (o[k] != null ? +o[k] : null)), w: L ? L.who : null, l: L && L.lead != null ? +L.lead.toFixed(2) : null, lv: !!(L && L.level) };
    };
    return { m: rules.ISS_MAP.map(cell), own: Object.entries(s.own || {}).map(([id, o]) => [id, ...P4.map((k) => (o[k] != null ? +o[k] : null))]),
      bp: s.bp ? [...P4.map((k) => (s.bp[k] != null ? s.bp[k] : null)), s.bp.rest != null ? s.bp.rest : null] : null,
      sal: s.sal || null, conc: s.conc || null, q: s.q || null };
  };
  /* Demographics: for each split, the pair of the poll's own groups it draws
     (demPairOf, tried in the modern facet's order) and each party's gap
     between them in points, first group less second; Offcuts' families
     each draw their own pair, as the modern facet stacks them */
  const DK = ["alp", "lnp", "grn", "onp", "oth"];
  const pack = (pr) => ({ lab: pr.lab, a: pr.a, b: pr.b, g: Object.fromEntries(DK.map((k) => [k, pr.gap[k]])) });
  const demOf = (p) => {
    if (!p.grp) return null;
    const o = {};
    for (const sp of rules.DEM_SPLITS) {
      if (sp.fams) {
        const f = {};
        for (const fam of sp.fams) { const pr = rules.demPairOf(p, sp.id, fam.id); if (pr) f[fam.id] = pack(pr); }
        if (Object.keys(f).length) o[sp.id] = { fams: f };
      } else {
        const pr = rules.demPairOf(p, sp.id);
        if (pr) o[sp.id] = pack(pr);
      }
    }
    return Object.keys(o).length ? o : null;
  };

  const rows = P.map((p, i) => {
    const q = p.p || {};
    const pb = {
      lnp: p.alp != null && p.lnp != null ? [p.alp, p.lnp] : null,
      on: p.tppAlt && p.tppAlt.alp != null && p.tppAlt.onp != null ? [p.tppAlt.alp, p.tppAlt.onp] : null,
    };
    /* why a row has no implied figure (rdApFig's none): no primaries, a set
       short of a party, or primaries that miss 100 with no documented reason */
    const none = q.alp == null ? "no primaries published" : ["lnp", "grn", "onp"].every((k) => q[k] != null) ? "primaries don’t add to 100" : "not every primary published";
    /* Better PM, as the modern Leadership facet draws it (ppmContests): the
       Albanese-v-opposition-leader contest first, with Hanson's head-to-head
       beside it; the three-way; or Albanese v Hanson alone */
    const sets = Array.isArray(p.ppmSets) ? p.ppmSets : p.ppm ? [p.ppm] : [];
    const named = (s) => s.taylor != null || s.ley != null;
    const opp = sets.find((s) => named(s) && s.hanson == null), han = sets.find((s) => s.hanson != null && !named(s)), three = sets.find((s) => s.hanson != null && named(s));
    const oppV = (s) => (s.taylor != null ? s.taylor : s.ley), oppN = (s) => (s.taylor != null ? "Taylor" : "Ley");
    let pm = null;
    if (opp) pm = { v: [[opp.alb, "alp"], [oppV(opp), "lnp"]], sub: han ? `v ${oppN(opp)}, ${han.alb}–${han.hanson} v Hanson` : `Albanese v ${oppN(opp)}` };
    else if (three) pm = { v: [[three.alb, "alp"], [oppV(three), "lnp"], [three.hanson, "onp"]], sub: "three-way" };
    else if (han) pm = { v: [[han.alb, "alp"], [han.hanson, "onp"]], sub: "Albanese v Hanson" };
    if (pm) pm.sort = sets[0] && sets[0].alb != null ? sets[0].alb : null;
    const pmAll = sets.map((s) => ["alb", "taylor", "ley", "hanson", "unc"].filter((k) => s[k] != null).map((k) => [LEADER[k], s[k]]));
    const a = p.appr || {}, mb = a.metricBy || {};
    const ld = { alb: a.albNet != null ? a.albNet : null, opp: a.taylorNet != null ? a.taylorNet : null, han: a.hansonNet != null ? a.hansonNet : null,
                 oppN: a.oppName || null, fav: [["alb", "alb"], ["taylor", "opp"], ["hanson", "han"]].filter(([k, o]) => mb[k] === "fav" && a[k + "Net"] != null).map(([, o]) => o) };
    const r = {
      ...base(p, i),
      imp: { lnp: p.alpImp != null ? p.alpImp : null, on: p.alpOnImp != null ? p.alpOnImp : null },
      pb,
      ln: { lnp: leanOf(p, "lnp"), on: leanOf(p, "on") }, hl: { lnp: heOf(p, "lnp"), on: heOf(p, "on") },
      av: { lnp: avgOf(p, "lnp"), on: avgOf(p, "on") },
      me: { lnp: p.alpImp != null ? margin(p, "lnp") : null, on: p.alpOnImp != null ? margin(p, "on") : null },
      // in today's figure, on each contest: 1 against the Coalition, 2 against One Nation
      tw: (inWin(p, "lnp") ? 1 : 0) + (inWin(p, "on") ? 2 : 0),
      p: { alp: q.alp, lnp: q.lnp, grn: q.grn, onp: q.onp, oth: q.oth },
      pm, pmAll, ld,
      // the Leadership facet's scope (FACET_SCOPE.leadership): a Better PM question or a net rating
      lx: sets.length > 0 || ld.alb != null || ld.opp != null || ld.han != null,
      dir: dirOf(p), iss: issOf(p), dg: demOf(p),
    };
    if (p.alpImp == null || p.alpOnImp == null) r.none = none;
    for (const k of ["lnp", "on"]) if (r.me[k] != null) r.me[k] = +r.me[k].toFixed(3);
    return r;
  });

  /* the waves that ask no voting question - SEC Newgate's direction readings
     (with its concerns and best party on the cost of living) and Ipsos's
     issues monitor - join the Direction and Issues tabs only, as the modern
     facets add them; and the economic gauges' releases are the Confidence
     tab's rows instead of polls, each in its consumer or business lane.
     Their indices run on from the polls' so a row is always one row */
  const xrows = [...dirOnly, ...issuesOnly].map((p, j) => ({ ...base(p, P.length + j), dir: dirOf(p), iss: issOf(p) }));
  const crows = confAll.filter((p) => p.conf).map((p, j) => {
    const c = p.conf;
    return { ...base(p, P.length + xrows.length + j),
      // the change a release shows: its printed one, else the move on the lane's previous release (gen-data's chgCalc)
      cf: { k: c.k, lab: c.lab, v: c.v, vs: c.vs, chg: c.chg != null ? c.chg : c.chgCalc != null ? c.chgCalc : null, first: !!c.first,
            cond: c.cond != null ? c.cond : null, condChg: c.condChg != null ? c.condChg : null },
      bus: rules.CONF_BUS_LANES.includes(c.k) };
  });

  /* each month's estimates (the modern month rows' monthAvg): the month's own
     estimate overwrites its election-anchor row */
  const months = {};
  const put = (src, f) => (src || []).forEach((d) => { const v = d.alp != null ? d.alp : d.a; if (v != null) f(months[d.ym] || (months[d.ym] = {}), v, d); });
  put(synth2pp, (m, v) => { (m.imp || (m.imp = {})).lnp = v; });
  put(synthOn, (m, v) => { (m.imp || (m.imp = {})).on = v; });
  put(agg2pp, (m, v) => { (m.pub || (m.pub = {})).lnp = v; });
  put((alt2pp || {}).alp_on, (m, v) => { (m.pub || (m.pub = {})).on = v; });
  (aggPrimary || []).forEach((d) => { (months[d.ym] || (months[d.ym] = {})).prim = { alp: d.alp, lnp: d.lnp, grn: d.grn, onp: d.onp, oth: d.oth }; });

  // the pollsters, by how much they poll (the modern Pollster filter's ranking)
  const hn = {};
  rows.forEach((r) => { hn[r.b] = (hn[r.b] || 0) + 1; });
  const houses = Object.keys(hn).sort((a, b) => hn[b] - hn[a] || a.localeCompare(b)).map((h) => ({ h, n: hn[h] }));

  /* today's figure, said as the modern 2PP head says it (rdApTppStory, the
     average branch): how many polls it comes from and their range. A count
     and a range, so no margin gates it */
  const head = (c) => {
    const t = today[c];
    if (!t) return null;
    const win = P.filter((p) => inWin(p, c)), vals = win.map((p) => (c === "on" ? p.alpOnImp : p.alpImp));
    if (!win.length) return null;
    const lo = Math.min(...vals), hi = Math.max(...vals), n = win.length;
    return `Labor’s ${t.a.toFixed(1)} comes from ${numWord(n)} poll${n === 1 ? "" : "s"}`
      + (n === 1 ? "" : lo === hi ? `, which all put Labor on ${lo.toFixed(1)}` : `, which range from ${lo.toFixed(1)} to ${hi.toFixed(1)}`) + ".";
  };
  const order = (L.primaryOrder || ["alp", "lnp", "grn", "onp", "oth"]).filter((id) => id in NAMES);
  const newestPub = rows.reduce((m, r) => (r.pd && r.pd > m ? r.pd : m), "");
  return {
    built, upd: L.updatedISO, rival, today, head: { lnp: head("lnp"), on: head("on") },
    prim: order.map((id) => ({ id, v: L.primary[id] })), order,
    names: { alp: "Labor", lnp: "the Coalition", grn: "the Greens", onp: "One Nation", oth: "Others" },
    oppNow, oppWas, months, houses, rows, xrows, crows, pages, effUrls: effTbcUrls,
    // the archive's full extent, as the modern count acknowledges it ("189 of 209 polls"), and the releases'
    totalAll: P.length + xrows.length, confAll: crows.length,
    splits: rules.DEM_SPLITS.map((sp) => ({ id: sp.id, label: sp.label, scope: sp.scope, fams: sp.fams ? sp.fams.map((f) => ({ id: f.id, lab: f.lab, sub: f.sub })) : null })),
    issMap: rules.ISS_MAP.map((id) => [id, rules.ISS_MAP_LAB[id] || id]), issLabels: issueLabels,
    // the parties as the Issues facet names them: [long, short]
    issParty: Object.fromEntries(Object.entries(rules.ISS_PARTY_META).map(([k, v]) => [k, [v[0], v[1]]])),
    newestField: rows.reduce((m, r) => (r.fe > m ? r.fe : m), ""), newestPub,
    tracked: L.pollsTracked, housesTracked: L.housesTracked,
  };
}

/* ----------------------------------------------------------------- the page */
const ICON = {
  home: `<svg class="rt-ic" width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.6 8 8 2.2 14.4 8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M3.6 7v7h3.2v-4h2.4v4h3.2V7" fill="currentColor"/></svg>`,
  star: `<svg class="rt-ic" width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.7 6 6.5.6-4.9 4.3 1.5 6.4L12 16.8l-5.8 3.3 1.5-6.4-4.9-4.3 6.5-.6z" fill="#ffd21c" stroke="#a36a00" stroke-linejoin="round"/></svg>`,
  dd: `<svg width="7" height="4" viewBox="0 0 7 4" aria-hidden="true"><path d="M0 0h7L3.5 4z" fill="currentColor"/></svg>`,
  modern: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9"/><path d="M2.4 2.2v2.6h2.6"/></svg>`,
  shade: `<svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true"><path d="M1 6.5h7" stroke="#000" stroke-width="1.8"/></svg>`,
  // the tabs' own: two bars head to head, a bar chart, a leader's bust
  tpp: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 14V4h5v10zM9 14V6h5v8z" fill="currentColor"/><path d="M1 14.5h14" stroke="currentColor" stroke-width="1"/></svg>`,
  pri: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 14V5h2.4v9zM4.8 14V3h2.4v11zM8.1 14V7h2.4v7zM11.4 14V9.5h2.4V14z" fill="currentColor"/><path d="M1 14.5h14" stroke="currentColor" stroke-width="1"/></svg>`,
  ld: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5" r="3.1" fill="currentColor"/><path d="M2.2 15c.4-3.6 2.8-5.6 5.8-5.6s5.4 2 5.8 5.6z" fill="currentColor"/></svg>`,
  // …and the other four's: a signpost, a ticked clipboard, two people, a gauge
  dir: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M7.2 1.5h1.6V15H7.2z" fill="currentColor"/><path d="M8.8 2.6h4.8l1.7 1.8-1.7 1.8H8.8zM7.2 7.4H2.4L.7 9.2l1.7 1.8h4.8z" fill="currentColor"/></svg>`,
  iss: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.6h10v12.2H3z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M6 1.4h4v2.4H6z" fill="currentColor"/><path d="M4.9 7.1l1.2 1.2 2.2-2.2M4.9 11.1l1.2 1.2 2.2-2.2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M9.5 7.4h2.1M9.5 11.4h2.1" stroke="currentColor" stroke-width="1.3"/></svg>`,
  dem: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="5.2" cy="4.7" r="2.4" fill="currentColor"/><path d="M.8 14.2c.3-3.1 2-4.7 4.4-4.7s4.1 1.6 4.4 4.7z" fill="currentColor"/><circle cx="11.4" cy="5.5" r="2.1" fill="currentColor"/><path d="M9 9.9c.7-.6 1.5-.9 2.4-.9 2.1 0 3.5 1.5 3.8 5.2h-4.7c-.2-1.8-.7-3.2-1.5-4.3z" fill="currentColor"/></svg>`,
  conf: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.6 12.2a6.4 6.4 0 0 1 12.8 0" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 12.2l3.4-4.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="12.2" r="1.4" fill="currentColor"/><path d="M3.3 8.3l1 .7M8 5.1v1.2M12.7 8.3l-1 .7" stroke="currentColor" stroke-width="1.2"/></svg>`,
};
const star = (cx, cy, r, n = 7, k = 0.44) => {
  const pts = [];
  for (let i = 0; i < 2 * n; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n, rr = i % 2 ? r * k : r; pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`); }
  return `<polygon points="${pts.join(" ")}" fill="#fff"/>`;
};
// the flag and Parliament House, drawn as the retro map draws them (app-8-retro.js rtFlagSVG / rtHouseSVG)
const FLAG = (() => {
  const uj = `<g><rect width="30" height="15" fill="#00247d"/><path d="M0 0l30 15M30 0L0 15" stroke="#fff" stroke-width="3"/><path d="M0 0l30 15M30 0L0 15" stroke="#cf142b" stroke-width="1"/><path d="M15 0v15M0 7.5h30" stroke="#fff" stroke-width="5"/><path d="M15 0v15M0 7.5h30" stroke="#cf142b" stroke-width="3"/></g>`;
  return `<svg class="rt-flag" viewBox="0 0 60 30" preserveAspectRatio="none" aria-hidden="true"><rect width="60" height="30" fill="#00247d"/>${uj}${star(15, 22.5, 4.2)}${star(45, 25.2, 2.3)}${star(37.6, 14.4, 2.3)}${star(45, 5, 2.3)}${star(51.4, 12.5, 2.1)}${star(48, 17.4, 1.2, 5, 0.42)}</svg>`;
})();
const HOUSE = `<svg class="rt-house" viewBox="0 0 210 58" aria-hidden="true"><g fill="none" stroke="#cfe0ff" stroke-width="1.1" stroke-linecap="round" opacity=".85">
    <path d="M6 56 Q40 44 70 41 L140 41 Q170 44 204 56" />
    <path d="M70 41 V36 H140 V41 M74 36 V41 M80 36 V41 M86 36 V41 M92 36 V41 M98 36 V41 M112 36 V41 M118 36 V41 M124 36 V41 M130 36 V41 M136 36 V41" />
    <path d="M100 36 V30 H110 V36" /><path d="M66 36 H144" />
    <path d="M90 41 L105 2 L120 41 M96 41 L105 2 L114 41" stroke-width=".9"/>
    <path d="M98.6 19 H111.4 M95.4 28 H114.6" stroke-width=".7"/></g>
    <path d="M105.6 2.4 h10 v6 h-10z" fill="#00247d" stroke="#cfe0ff" stroke-width=".6"/><path d="M105.6 2.4 h4 v3 h-4z" fill="#cf142b" opacity=".85"/></svg>`;

/* The site's pages for the navbar, as the retro map lists them (rtPages:
   the bar's views but Now, which is Home, then the More menu's), with the
   two retro pages pointing at each other: All polls is this page, the
   Electoral map opens in its retro view. */
/* The site's pages that have a retro twin, and where it is: the navbar of
   every retro page (this one, the Electoral map's retro view, and the Now
   and Past cycles twins, .build/retro/now.mjs and cycles.mjs) opens the
   twin, so a reader in the old look stays in it. Home is the Now twin. */
export const RETRO_TWIN = { "/": "/retro/", "/cycles/": "/cycles/retro/", "/allpolls/": "/allpolls/retro/", "/map/": "/map/#retro=1" };
export function retroPages(shellPages) {
  const twin = (p) => (RETRO_TWIN[p.href] ? { ...p, href: RETRO_TWIN[p.href] } : p);
  const tabs = shellPages.tabs.filter((t) => t.href !== "/").map(twin);
  const more = shellPages.menu.filter((m) => !shellPages.tabs.some((t) => t.href === m.href)).map(twin);
  return { tabs: tabs.map(({ label, href }) => ({ label, href })), more: more.map(({ label, href }) => ({ label, href })) };
}

/* the Confidence tab's gauges, named off its releases: "the consumer gauges
   of A, B and C, the business ones of D and E" */
const andList = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
function gaugeList(D) {
  const of = (bus) => { const n = {}; for (const r of D.crows) if (r.bus === bus) n[r.b] = (n[r.b] || 0) + 1; return Object.keys(n).sort((a, b) => n[b] - n[a] || a.localeCompare(b)); };
  const c = of(false), b = of(true);
  return [c.length ? `the consumer ${c.length === 1 ? "gauge" : "gauges"} of ${andList(c)}` : "", b.length ? `the business ${b.length === 1 ? "gauge" : "ones"} of ${andList(b)}` : ""].filter(Boolean).join(", ");
}

export function retroAllPolls({ dataset, shellPages, footer, siteUrl = "https://auspoltracker.com/", built }) {
  const pages = retroPages(shellPages);
  const D = retroData(dataset, { pages, built });
  const client = read("allpolls.client.js");
  // the client's renderers, run here (no document, so its browser half never starts)
  const ctx = vm.createContext({ window: {}, console });
  vm.runInContext(client, ctx, { filename: "allpolls.client.js" });
  const RA = ctx.window.RT_AP;
  const st = RA.defaults(D), V = RA.view(D, st);
  const R = RA.RIVAL[D.rival];
  const t = D.today[D.rival];
  const mi = (k, label, extra = "") => `<button type="button" class="rt-ni" data-rt-menu="${k}" aria-haspopup="menu" aria-expanded="false">${extra}${label}</button>`;
  const meta = `Every federal poll published since the May 2025 election · ${D.tracked} polls from ${D.housesTracked} pollsters`;
  const desc = `Every published Australian federal opinion poll since the May 2025 election, in the dress of a website from about 2000: two-party, primary and leadership figures, poll by poll.`;
  const F = footer || null;
  const json = JSON.stringify(D).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16));
  const primPanel = D.prim.map((x) => `<span class="ap-fp"><b class="ap-k-${x.id}">${x.v.toFixed(1)}</b><i>${({ alp: "ALP", lnp: "L/NP", grn: "GRN", onp: "ON", oth: "OTH" })[x.id]}</i></span>`).join(`<span class="ap-fpd" aria-hidden="true">–</span>`);
  const html = `<!DOCTYPE html>
<html lang="en-AU" class="mp-retro" data-ap-m="tpp">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>auspol tracker – All polls, retro</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${siteUrl}allpolls/">
<meta name="theme-color" content="#061436">
<meta name="color-scheme" content="light">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<style>
${read("chrome.css")}
${read("allpolls.css")}
</style>
</head>
<body>
<div class="ap-frame">
<div class="rt-top">
  <nav class="rt-nav" aria-label="Site and page">
    <a class="rt-ni" href="/retro/" title="auspol tracker’s home page">${ICON.home}Home</a>${mi("edit", "Edit")}${mi("view", "View")}${mi("fav", "Favorites", ICON.star)}${mi("help", "Help")}
    <span class="rt-navgap"></span>
    <span class="rt-pages">${pages.tabs.map((p) => `<a href="${esc(p.href)}"${p.href === "/allpolls/retro/" ? ' aria-current="page"' : ""}>${esc(p.label)}</a>`).join("")}${mi("more", `More pages ${ICON.dd}`)}</span>${mi("pages", `Pages ${ICON.dd}`).replace('class="rt-ni"', 'class="rt-ni rt-pagesb"')}
  </nav>
  <div class="rt-banner"><a class="rt-home" href="/retro/" title="auspol tracker: the tracker’s home page">${FLAG}</a><div class="rt-bcol"><a class="rt-kicker" href="/retro/">auspol tracker</a><span class="rt-bline"><h1 class="rt-btitle">All polls</h1><span class="rt-bmeta">${esc(meta)}</span></span></div>${HOUSE}</div>
  <div class="rt-tabs" role="tablist" aria-label="Measure">${RA.TABS.map((x) => `<button type="button" role="tab" data-ap-tab="${x.id}" aria-selected="${x.id === st.m}">${ICON[x.id]}<span class="rt-tl">${x.label}</span><span class="ap-ts">${x.short}</span></button>`).join("")}<button type="button" class="rt-modern" data-ap="modern" title="Back to the modern look">${ICON.modern}<span class="rt-tl">Modern view</span></button></div>
</div>
<main id="ap-main">
<section class="ap-panel" id="ap-today" aria-labelledby="ap-today-cap">
  <h2 class="ap-cap" id="ap-today-cap">The polls today<button type="button" class="rt-shade" data-ap="shade" aria-expanded="true" aria-label="Roll up the panel" title="Roll up the panel">${ICON.shade}</button></h2>
  <div class="ap-tbody">
    <div class="ap-grp">
      <h3 class="ap-lab">Two-party preferred, implied flows</h3>
      <p class="ap-tpp"><b class="ap-k-alp">${t.a.toFixed(1)}</b><span class="ap-fpd" aria-hidden="true">–</span><b class="ap-k-${R.ink}">${t.b.toFixed(1)}</b></p>
      <p class="ap-who"><span class="ap-k-alp">Labor</span><span class="ap-k-${R.ink}">${esc(R.name)}</span></p>
      ${D.head[D.rival] ? `<p class="ap-say">${esc(D.head[D.rival])}</p>` : ""}
    </div>
    <div class="ap-grp">
      <h3 class="ap-lab">First preferences</h3>
      <p class="ap-fps">${primPanel}</p>
      <p class="ap-say">The tracker’s estimate from the polls of the last three weeks. The newest was released on ${dayFull(D.newestPub)}.</p>
    </div>
  </div>
</section>
<section class="ap-panel ap-polls" aria-labelledby="ap-cap">
  <h2 class="ap-cap" id="ap-cap">${esc(RA.TABS.find((x) => x.id === st.m).cap)}</h2>
  <div class="ap-tools" role="toolbar" aria-label="Filter the polls">
    <span class="ap-ctl"><span class="ap-cl">Pollsters</span><button type="button" class="ap-combo" id="ap-hbtn" data-rt-menu="houses" aria-haspopup="menu" aria-expanded="false"><span class="ap-hl">All pollsters</span><span class="ap-arr" aria-hidden="true"></span></button></span>
    <label class="ap-ctl ap-cwrap"><span class="ap-cl">Two-party</span><select id="ap-c">${Object.keys(RA.RIVAL).map((c) => `<option value="${c}"${c === st.c ? " selected" : ""}>Labor v ${RA.RIVAL[c].name}</option>`).join("")}</select></label>
    <label class="ap-ctl ap-gwrap" hidden><span class="ap-cl">Split</span><select id="ap-g">${D.splits.map((x) => `<option value="${x.id}"${x.id === st.g ? " selected" : ""}>${esc(x.label)}</option>`).join("")}</select></label>
    <label class="ap-ctl ap-bwrap" hidden><span class="ap-cl">Gauges</span><select id="ap-b"><option value="0" selected>Consumer confidence</option><option value="1">Business confidence</option></select></label>
    <label class="ap-ctl"><span class="ap-cl">Time</span><select id="ap-t">${RA.TIMES.map((x) => `<option value="${x.id}"${x.id === st.t ? " selected" : ""}>${x.label}</option>`).join("")}</select></label>
    <label class="ap-ctl ap-find"><span class="ap-cl">Find</span><span class="ap-field"><input type="search" id="ap-q" placeholder="A pollster, a month, a figure" autocomplete="off" spellcheck="false"><kbd aria-hidden="true">/</kbd></span></label>
    <span class="ap-gap"></span>
    <span class="ap-count" id="ap-count" role="status">${RA.countHTML(D, st, V)}</span>
    <button type="button" class="ap-btn" data-ap="csv" title="Download the polls in view as a spreadsheet file">Save as CSV</button>
  </div>
  <div class="ap-well" tabindex="-1">
    <table class="ap-t">
      <thead id="ap-head">${RA.headHTML(D, st)}</thead>
      <tbody id="ap-body">${RA.bodyHTML(D, st, V, null, null)}</tbody>
    </table>
  </div>
  <p class="ap-key" id="ap-key">${RA.keyHTML(D, st)}</p>
</section>
<section class="ap-panel ap-notes" id="ap-notes" aria-labelledby="ap-notes-cap">
  <h2 class="ap-cap" id="ap-notes-cap">About these polls</h2>
  <div class="ap-cols">
    <div>
      <h3>One row per poll</h3>
      <p>Every row is one published poll, never modelled or filled in. Each pollster’s name links to its own release, or to the report its figures were read from. A poll marked <span class="ap-na">†</span> is kept here but doesn’t count towards the tracker’s figures, such as a pooled release that re-counts polls already in, a Tasmanian-only poll or an SMS poll. Point at the mark for the reason.</p>
      <h3>Two-party figures</h3>
      <p>The implied figure runs a poll’s primary votes through one fixed set of preference flows, the same for every pollster. Against the Coalition the flows are the ones the AEC counted at the 2025 election. No election has ever counted a Labor v One Nation finish, so that contest runs on the site’s own estimated flows. The published figure is the pollster’s own, where it printed one.</p>
      <h3>Month rows</h3>
      <p>Sorted by date, the polls run in month groups: the month they were released, or the month they were fielded when sorted by fieldwork. On the two-party and primary tabs each month row also gives the tracker’s own figures for that month: the two-party average on each basis, or the primary vote.</p>
    </div>
    <div>
      <h3>Lean and house lean</h3>
      <p>Lean is how far a poll’s implied figure sits from the average of the other polls fielded within three weeks of it. House lean is how far its pollster has usually sat from the others, as of that poll. The bar draws both: the square is the poll, the line through it the poll’s 95% margin of error, and the tick its pollster’s usual lean. When the line misses the tick, the poll sits further from where its pollster usually lands than its margin of error, as about one poll in 20 should.</p>
      <h3>Leadership</h3>
      <p>The tab lists the polls that asked about the leaders. Net ratings are approval minus disapproval. Some pollsters ask about favourability instead, favourable minus unfavourable; an asterisk marks those. Better PM gives Albanese’s share, then his opponent’s.</p>
      <h3>Direction and issues</h3>
      <p>Direction is the share saying the country is heading in the right direction or is on the wrong track. Issues shows, for the six issues polls ask about most, the party the most voters rate best and its lead over the next. Two pollsters ask no voting question, so their polls appear only on these tabs: SEC Newgate on both, Ipsos on issues.</p>
    </div>
    <div>
      <h3>Groups</h3>
      <p>Demographics compares two of a poll’s own groups, such as 18–34 against 55+. Each figure is a party’s share in the first group less its share in the second. Pollsters draw their groups differently, so each row names the pair it used. Offcuts holds the cuts no other split can, such as birth country or religion, each family in a table of its own.</p>
      <h3>Economic sentiment</h3>
      <p>Confidence lists the economic gauges release by release: ${esc(gaugeList(D))}. They aren’t polls of voting intention and never count as polls. Most are indexes where 100 is neutral; NAB prints a net balance, where 0 is neutral.</p>
      <h3>More in the modern view</h3>
      <p>This is the <a href="/allpolls/">All polls</a> page in old clothes, with the same figures. The modern view adds charts, and opens each poll with charts of how it sits against the others. <a href="/map/#retro=1">The Electoral map</a> has a retro view too.</p>
    </div>
  </div>
</section>
</main>
${F ? `<footer class="ap-foot">
  <div class="ap-about"><p>${esc(F.lede)}</p><p>${esc(F.disc)}</p></div>
  <div class="ap-ways"><p>${esc(F.infoLead)}<a href="/info/">${esc(F.infoWord)}</a>. ${esc(F.spot)} <a href="/feedback/">${esc(F.linkWord)}</a>.</p><p>${esc(F.archLead)}<a href="${esc(F.archHref)}">${esc(F.archWord)}</a>${esc(F.archTail)}</p></div>
</footer>` : ""}
</div>
<div class="rt-drop" role="menu" hidden></div>
<script type="application/json" id="ap-data">${json}</script>
<script>
${client}
</script>
</body>
</html>
`;
  return { html, data: D };
}

// the art every retro page's banner and navbar wear (.build/retro/page.mjs draws the Now and Past cycles twins with it)
export { ICON as RT_ICON, FLAG as RT_FLAG, HOUSE as RT_HOUSE };
