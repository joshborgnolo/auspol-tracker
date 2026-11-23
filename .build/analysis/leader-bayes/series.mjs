/* Build model series from readings.json (analysis). */
import { makeSeries, WIDE } from "./leader-model.mjs";
export const DAY = (iso) => Math.floor(Date.parse(iso.slice(0, 10) + "T00:00:00Z") / 86400000);
export const ISO = (d) => new Date(d * 86400000).toISOString().slice(0, 10);
export const ELECTIONS = ["1969-10-25", "1972-12-02", "1974-05-18", "1975-12-13", "1977-12-10", "1980-10-18", "1983-03-05", "1984-12-01", "1987-07-11", "1990-03-24", "1993-03-13", "1996-03-02", "1998-10-03", "2001-11-10", "2004-10-09", "2007-11-24", "2010-08-21", "2013-09-07", "2016-07-02", "2019-05-18", "2022-05-21", "2025-05-03"].map(DAY);
const ROLE_U = { pm: 0.10, opp: 0.20, han: 0.15 };
export const DEFF = 1.6;

/* ratings → series. opts:
     metrics: which questions enter ("approval", "fav" or both)
     compress: scale each house's net by its unsure share against the regular houses'
     tmax: only readings with t ≤ tmax (backtests) */
export function ratingSeries(R, { metrics = ["approval", "fav"], compress = true, tmax = Infinity, outStep = 0, minCore = 4, splitLikeability = true, twoLine = false } = {}) {
  const rows = R.filter((r) => metrics.includes(r.metric) && r.day <= tmax);
  /* typical unsure per house × role (split readings), for nets printed without a split */
  const uSum = new Map();
  for (const r of rows) if (r.U != null) { const k = r.house + "|" + r.role; const a = uSum.get(k) || [0, 0]; a[0] += r.U / 100; a[1]++; uSum.set(k, a); }
  const uOf = (h, role) => { const a = uSum.get(h + "|" + role); return a && a[1] >= 3 ? a[0] / a[1] : ROLE_U[role]; };
  const bySeries = new Map();
  rows.forEach((r) => { const a = bySeries.get(r.series) || []; a.push({ ...r, i: r.rid }); bySeries.set(r.series, a); });
  const out = [];
  for (const [id, rs] of bySeries) {
    const role = rs[0].role;
    const houseOf = (r) => (splitLikeability ? r.house : r.house.replace(" (likeability)", ""));
    const cnt = {}; for (const r of rs) cnt[houseOf(r)] = (cnt[houseOf(r)] || 0) + 1;
    const core = new Set(rs.filter((r) => r.metric === "approval" && !/likeability/.test(r.house) && cnt[houseOf(r)] >= minCore).map(houseOf));
    /* two lines: favourability readings (and Resolve's likeability) on their own line, with its own regular houses */
    const favLine = twoLine && rs.some((r) => r.metric === "fav");
    const core2 = new Set(favLine ? rs.filter((r) => r.metric === "fav" && cnt[houseOf(r)] >= minCore).map(houseOf) : []);
    /* each house's mean unsure in this series (split readings), and the regular houses' mean */
    const hu = new Map();
    for (const r of rs) if (r.U != null) { const h = houseOf(r); const a = hu.get(h) || [0, 0]; a[0] += r.U / 100; a[1]++; hu.set(h, a); }
    const uH = (h) => { const a = hu.get(h); return a ? a[0] / a[1] : null; };
    const refOf = (cs, test) => {
      const coreU = [...cs].map(uH).filter((x) => x != null);
      const allU = [...hu.keys()].filter(test).map(uH);
      return coreU.length ? coreU.reduce((a, b) => a + b, 0) / coreU.length : allU.length ? allU.reduce((a, b) => a + b, 0) / allU.length : null;
    };
    const metricOfHouse = {}; for (const r of rs) metricOfHouse[houseOf(r)] = r.metric;
    const uRef = favLine ? refOf(core, (h) => metricOfHouse[h] === "approval") : refOf(core, () => true);
    const uRef2 = favLine ? refOf(core2, (h) => metricOfHouse[h] === "fav") : null;
    const obs = rs.map((r) => {
      const h = houseOf(r), y = r.net / 100;
      const und = r.U != null ? r.U / 100 : uOf(h, role);
      const pq = Math.max(0.02, (1 - und) - y * y);
      const lv = favLine && r.metric === "fav" ? 1 : 0, ref = lv ? uRef2 : uRef;
      const c = compress && ref != null && uH(h) != null ? (1 - uH(h)) / (1 - ref) : 1;
      return { t: r.day, y, v: DEFF * pq / r.n, house: h, c, lv, i: r.i, raw: r };
    });
    const t0 = Math.min(...obs.map((o) => o.t)), t1 = Math.max(...obs.map((o) => o.t));
    const jumps = new Set(ELECTIONS.filter((d) => d > t0 && d <= t1));
    const outDays = outStep ? Array.from({ length: Math.floor((t1 - t0) / outStep) + 1 }, (_, k) => t0 + k * outStep) : [];
    out.push(makeSeries(id, obs, { core, core2, jumps, wide: WIDE.net, p0: 0.2, outDays }));
    out[out.length - 1].role = role; out[out.length - 1].person = rs[0].person; out[out.length - 1].party = rs[0].party; out[out.length - 1].uRef = uRef;
  }
  return out;
}

/* preferred PM → series on log(a/b), a the PM's (or Albanese's) share */
export function ppmSeries(P, { contests = ["pm-opp", "alb-han"], tmax = Infinity, minCore = 4, twoPmpOwn = true, outStep = 0 } = {}) {
  const rows = P.filter((r) => contests.includes(r.contest) && r.day <= tmax && r.a > 0 && r.b > 0);
  const bySeries = new Map();
  rows.forEach((r) => { const a = bySeries.get(r.series) || []; a.push({ ...r, i: r.rid }); bySeries.set(r.series, a); });
  const out = [];
  for (const [id, rs] of bySeries) {
    const houseOf = (r) => (r.kind === "2pmp" && twoPmpOwn ? r.house + " (2PMP)" : r.house);
    const cnt = {}; for (const r of rs) cnt[houseOf(r)] = (cnt[houseOf(r)] || 0) + 1;
    const core = new Set(rs.filter((r) => r.kind === "two" && cnt[houseOf(r)] >= minCore).map(houseOf));
    const obs = rs.map((r) => {
      const a = r.a / 100, b = r.b / 100;
      return { t: r.day, y: Math.log(a / b), v: DEFF * (1 / a + 1 / b) / r.n, house: houseOf(r), c: 1, i: r.i, raw: r };
    });
    const t0 = Math.min(...obs.map((o) => o.t)), t1 = Math.max(...obs.map((o) => o.t));
    const jumps = new Set(ELECTIONS.filter((d) => d > t0 && d <= t1));
    const outDays = outStep ? Array.from({ length: Math.floor((t1 - t0) / outStep) + 1 }, (_, k) => t0 + k * outStep) : [];
    out.push(makeSeries(id, obs, { core, jumps, wide: WIDE.logit, p0: 0.5, outDays }));
    out[out.length - 1].contest = rs[0].contest;
  }
  return out;
}
