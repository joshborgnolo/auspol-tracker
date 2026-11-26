/* The poll disagreement page's figures (/dawn/poll-disagreement/), the main site's own: its data
   asset, its engine (ed2260de) and its menu pages' findings (menu-lines.js) run here in node, as
   newtracker/build.mjs runs them for the More menu. So the spread against chance is the Poll
   disagreement page's (AP.discord), each pollster's lean and its head the Pollster leans page's
   (AP.leanRows, AP.leanStory).

   One figure the main site doesn't print: the spread of the One Nation–Coalition split itself. It
   is read by the same engine: the split is a "two-party figure" through a table that counts a One
   Nation vote +1 and a Coalition vote −1, so the engine's line is the model's One Nation less its
   Coalition, and its sampling floor the multinomial variance of that difference. A second copy of
   the engine reads it, so the swapped table touches nothing else.

   The election reading (each pollster's final polls against the count) is the main site's rule
   (rd-allpolls RdHouseLean): the mean miss, a one-sample t on three elections or more, Holm's
   correction across the pollsters tested. */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ENGINE = ["9f09dca2-bd46-49a8-8ae1-51847608cf92.js", "ed2260de-5b11-4bd5-8a8d-a391156c05ee.js", "menu-lines.js"];
export function engine(assets, source) {
  const win = {}, ctx = vm.createContext({ window: win, React: {}, console: { log() {}, warn() {} } });
  win.window = win;
  for (const f of ENGINE) {
    /* the menu's findings are source beside this build, not data: read from the repo where the
       given assets folder (a test's) has only the data */
    const here = path.join(assets, f), file = fs.existsSync(here) ? here : path.join(source, f);
    vm.runInContext(fs.readFileSync(file, "utf8"), ctx, { filename: f });
  }
  return { AP: win.AP, D: win.AUSPOL, run: (code) => vm.runInContext(code, ctx) };
}

const r2 = (v) => Math.round(v * 100) / 100;
const PRIMARY = [["split", "One Nation v Coalition split", "var(--kb)"], ["p_onp", "One Nation", "var(--on)"], ["p_lnp", "Coalition", "var(--lnp)"],
  ["rd_right", "One Nation + Coalition", "var(--ink2)"], ["p_alp", "Labor", "var(--alp)"], ["p_grn", "Greens", "var(--grn)"]];
const TWOPP = [["rd_on_imp", "Labor v One Nation", "var(--on)"], ["tpp_alpon", "Labor v One Nation, as published", "var(--on)", 1],
  ["rd_lnp_imp", "Labor v Coalition", "var(--lnp)"], ["tpp_alp", "Labor v Coalition, as published", "var(--lnp)", 1]];
export const PARTIES = { alp: "Labor", lnp: "Coalition", onp: "One Nation", grn: "Greens", oth: "Others" };

export function disagreeData(assets, source) {
  const E = engine(assets, source), { AP, D } = E;
  const S = engine(assets, source);
  S.D.flowTables = { ...S.D.flowTables, lnp: { onp: 1, lnp: -1, alp: 0, grn: 0, oth: 0, cnr: 0 } };
  S.AP.discordFacet("rd").find((m) => m.id === "rd_lnp_imp").val = (p) => (p.p && p.p.onp != null && p.p.lnp != null ? p.p.onp - p.p.lnp : null);
  const months = (rows) => rows.filter((d) => d.sigma != null).map((d) => [d.ym, r2(d.sigma), r2(d.floor)]);
  const spreadOf = ([id, name, color, dash]) => ({ id, name, color, ...(dash ? { dash: 1 } : {}), m: months(id === "split" ? S.AP.discord("rd_lnp_imp") : AP.discord(id)) });
  const spread = { primary: PRIMARY.map(spreadOf), twopp: TWOPP.map(spreadOf) };

  /* ---- the leans, one entry a reading: its pollsters highest first, with the site's finding */
  const HE = D.houseEffects || {};
  const valOf = { onimp: (p) => p.alpOnImp, imp: (p) => p.alpImp, onpub: (p) => (p.tppAlt ? p.tppAlt.alp : null), tpp: (p) => p.alpN,
    alp: (p) => p.p && p.p.alp, lnp: (p) => p.p && p.p.lnp, onp: (p) => p.p && p.p.onp, grn: (p) => p.p && p.p.grn, oth: (p) => p.p && p.p.oth,
    split: (p) => (p.p && p.p.onp != null && p.p.lnp != null ? p.p.onp - p.p.lnp : null) };
  const HEKEY = { onimp: "synthOn", imp: "synth", onpub: "alp_on", tpp: "tpp" };
  const countOf = (key, h) => {
    const he = HEKEY[key] && HE[HEKEY[key]] && HE[HEKEY[key]][h];
    return he && he.n ? he.n : D.individualPolls.filter((p) => p.pollster === h && valOf[key](p) != null).length;
  };
  const reading = (view, onM, pub) => {
    const key = AP.leanKey(view, onM, pub);
    const rows = AP.leanRows(key).map((r) => ({ h: r.h, v: r.v, n: countOf(key, r.h), s: r.s.map((d) => [d.ym, d.v, ...(d.on != null ? [d.on, d.co] : [])]) }))
      .sort((a, b) => b.v - a.v || b.n - a.n);
    const story = AP.leanStory(view, onM, pub);
    return { rows, head: story.head, dek: story.dek };
  };
  const leans = { split: reading("split", false, false), "tpp-lnp-imp": reading("tpp", false, false), "tpp-on-imp": reading("tpp", true, false),
    "tpp-lnp-pub": reading("tpp", false, true), "tpp-on-pub": reading("tpp", true, true),
    ...Object.fromEntries(Object.keys(PARTIES).map((k) => [k, reading(k, true, false)])) };

  /* ---- against the election */
  const tTail = E.run("tTail"), EL = D.electionLean;
  const election = EL ? { from: EL.from, years: EL.years, parties: Object.fromEntries(Object.keys(PARTIES).map((party) => {
    const rows = leans[party].rows.map((r) => {
      const cyc = (EL.parties[party] && EL.parties[party][(EL.canon && EL.canon[r.h]) || r.h]) || [];
      const n = cyc.length, mean = n ? cyc.reduce((t, c) => t + c.err, 0) / n : 0;
      let t = null, p = null;
      if (n >= 3) { const sd = Math.sqrt(cyc.reduce((a, c) => a + (c.err - mean) ** 2, 0) / (n - 1)); t = sd > 0 ? mean / (sd / Math.sqrt(n)) : 0; p = sd > 0 ? tTail(t, n - 1) : 1; }
      return { h: r.h, n, v: Math.round(mean * 10) / 10, p, s: cyc.map((c) => [+c.year, r2(c.err), r2(c.poll), r2(c.result)]) };
    }).sort((a, b) => (b.n > 0) - (a.n > 0) || b.v - a.v || b.n - a.n);
    const sig = [];
    for (const [i, r] of rows.filter((r) => r.p != null).sort((a, b) => a.p - b.p).entries()) { if (r.p >= 0.05 / (rows.filter((q) => q.p != null).length - i)) break; sig.push(r.h); }
    return [party, rows.map((r) => ({ ...r, sig: sig.includes(r.h) }))];
  })) } : null;

  /* ---- the opening panel: each pollster's split, with its latest poll as printed */
  const latestOf = (h) => D.individualPolls.filter((p) => p.pollster === h && p.p && p.p.onp != null && p.p.lnp != null)
    .sort((a, b) => (a.released < b.released ? 1 : -1))[0];
  const hero = leans.split.rows.map((r) => { const p = latestOf(r.h); return { h: r.h, v: r.v, s: r.s, ...(p ? { poll: { on: p.p.onp, lnp: p.p.lnp, released: p.released } } : {}) }; });
  const now = D.latest.primary;
  const newest = D.individualPolls.slice().sort((a, b) => (a.released < b.released ? 1 : -1))[0];
  return {
    v: 1, asOf: D.latest.updatedISO || newest.released, latestPoll: { h: newest.pollster },
    election: { date: (D.elections && D.elections.e2025 && D.elections.e2025.date) || "2025-05-03" },
    now: { onp: now.onp, lnp: now.lnp },
    order: (D.latest.primaryOrder || Object.keys(PARTIES)).filter((k) => PARTIES[k]),
    spread, leans, record: election, hero,
    siteHead: AP.disStory().head,
  };
}
