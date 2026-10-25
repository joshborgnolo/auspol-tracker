/* demo-groups.mjs – the groups the Snapshot's vote-by-group panel pools
   across pollsters (gen-data §7g), and each house's own groups mapped onto
   them. Pure; pinned by .build/test-crosstabs.mjs.

   A house's group joins a common one only where it is the same people:
     gender      Men, Women – every house.
     age         18–34, 35–54 and 55+ – Resolve, DemosAU and Essential print
                 them. Every other house's bands are read at them along
                 the adults' age distribution (ageStandardise, §7g-age):
                 Newspoll's, Roy Morgan's and Fox & Hedgehog's 35–49,
                 50–64 and 65+, YouGov's 35–49 and 50+ (earlier 50–64 and
                 65+, or five bands from 18–24), Freshwater's 18–35, 36–53
                 and 54+. A band a house prints joins as printed.
     generation  Gen Z, Millennials, Gen X, Boomers – YouGov and RedBridge.
                 YouGov's Silent generation (RedBridge prints none) doesn't.
     education   three levels of highest qualification. DemosAU's School,
                 YouGov's Year 12 or less, and RedBridge's Below Year 12 and
                 Year 12 together are Year 12 or less; TAFE, TAFE or college
                 and TAFE or trade are TAFE or trade; University is University.
                 DemosAU (MRP)'s five-level scale shares only its TAFE row;
                 its Less than year 12 and Year 12 pair and its
                 Undergraduate and Postgraduate pair are the common school
                 and university groups split in two, filed as printed.
                 RedBridge's two school rows merge 39:61, the split of its own
                 printed group sizes (Jul–Aug 2026: 216 and 343 respondents;
                 its earlier reports print none).
     state       NSW, Vic, Qld and Non-NSW/Vic/Qld – Resolve's four (its
                 fourth cut is filed "Rest of Australia"), every month of
                 the term. YouGov (Jun 2026 on) prints NSW, VIC and QLD,
                 then SA, WA and ACT/NT/TAS. SA and WA are common groups of
                 their own (YouGov and Roy Morgan both cut them); the three
                 together are Non-NSW/Vic/Qld, merged at their shares of the
                 2025 formal vote (AEC event 31496) – a known split, not an
                 estimate. A wave missing any of the three doesn't join
                 there. ACT/NT/Tas is a common group of its own, fed only by
                 cuts of exactly that trio: YouGov as printed (Jun 2026 on),
                 and DemosAU (MRP)'s Tas, ACT and NT rows merged at the
                 trio's own 2025 vote split (MRP_TRIO below) – again a known
                 split, not an estimate. Roy Morgan's Tas-alone cut and
                 EMRS (Tas)'s Tasmania-only polls are different people, so
                 the trio never pools them (gen-data carries them onto the
                 trio's view as solo display points instead). Roy Morgan
                 (from the 2026-09-27 wave's fortnight
                 release PDF) prints NSW, Vic, Qld, SA and WA, so it joins
                 at those five and never at ACT/NT/Tas or Non-NSW/Vic/Qld.
     location    Inner metro, Outer metro, Provincial and Rural – YouGov and
                 RedBridge cut identically. DemosAU's Regional/Rural is
                 provincial and rural voters together, so it joins only at
                 the two metro groups (as YouGov's age bands join only at
                 18–34). DemosAU (MRP)'s Reg & Rur is that same combined
                 cut, also filed as printed.
     housing     Own outright, Mortgage and Renting – YouGov and DemosAU.
                 RedBridge's Renting and other is wider than renters, so it
                 joins only at the two owner groups.
     language    English only and Other language at home – YouGov and
                 DemosAU.
     working     Full time, Part time and Retired – Newspoll (pooled)
                 prints the three rows quarterly (a not-working "Other"
                 residual besides); YouGov just the three, fortnightly
                 from Jun 2026. RedBridge's one demographic detail sheet
                 (Oct 2025) reads "Working full time" and "Working part
                 time" across the same first two. The residual –
                 Newspoll's Other, RedBridge's Not working – is one group
                 of people, but Newspoll is its only live printer, so it
                 joins nothing.

   Income joins no harmonized group below – the houses' brackets share no
   cut points – but it is no longer the ruled-out cut: instead of folding
   the brackets onto common PEOPLE (impossible when a group of people
   appears in no single table), gen-data §7g-income maps every house's
   brackets onto the income-QUANTILE axis where they can meet. Per wave
   and party it fits a vote-share line over quantile space (weighted
   least squares through the wave's printed bracket cells, each cell
   weighted by its census share of the electorate), then reads that
   line at two standard bands of the electorate – the bottom half and
   the top 15%+. The standardised shares pool through the same
   tilt-vs-all-voters machinery as every group below. INCOME_GRIDS
   defines each house's printed brackets as annual-$k edges plus its
   income basis, and incomeQuantiles maps them onto quantiles through
   the national census histogram of adults (data/income-dist.json, built
   by .build/extract-income-dist.mjs – adults by household income for the
   household-income houses, adults by personal income for DemosAU's
   tables), each wave's dollars deflated to census dollars by the wage
   index at its own fieldwork. Both bases pool (INCOME_POOL_BASES). RedBridge's "Prefer not to say" cell never joins
   a grid. Resolve and Morgan print no income cut at all. */

export const DEMO_TABS = [
  { id: "age", label: "Age" },
  { id: "gender", label: "Gender" },
  { id: "education", label: "Education" },
  { id: "place", label: "Place" },
  { id: "home", label: "Home" },
];
export const DEMO_SETS = [
  { tab: "age", id: "age", label: "By age", groups: ["18–34", "35–54", "55+"] },
  { tab: "age", id: "generation", label: "By generation", groups: ["Gen Z", "Millennials", "Gen X", "Boomers"] },
  { tab: "gender", id: "gender", label: null, groups: ["Men", "Women"] },
  { tab: "education", id: "education", label: null, groups: ["Year 12 or less", "TAFE or trade", "University"] },
  { tab: "place", id: "state", label: "By state", groups: ["NSW", "Vic", "Qld", "SA", "WA", "ACT/NT/Tas", "Non-NSW/Vic/Qld"] },
  { tab: "place", id: "location", label: "By location", groups: ["Inner metro", "Outer metro", "Provincial", "Rural"] },
  { tab: "home", id: "housing", label: "By housing", groups: ["Own outright", "Mortgage", "Renting"] },
  { tab: "home", id: "language", label: "By language at home", groups: ["English only", "Other language"] },
  { tab: "home", id: "working", label: "By work status", groups: ["Full time", "Part time", "Retired"] },
];

/* Rough shares of the adult population. They size each group's sampling-
   error floor – a group of a 1,500-person poll is about 1,500 × its share –
   and nothing else: every poll's group carries the same share, so it
   cancels out of the pooled figure. States: their shares of the 2025 formal
   vote. Location: RedBridge's own printed group sizes (Aug 2026: 280, 307,
   144 and 196 of 927), the same cut as YouGov's. Housing and language: the
   2021 census (dwellings owned outright 31%, with a mortgage 35%, rented
   31%; persons speaking only English at home 72%, another language 22%),
   each taken to 100. Work status: ABS Labour Force (March 2026 trend: 44%
   of the civilian population 15 and over in a full-time job, 20% in a
   part-time job) and Retirement and Retirement Intentions 2022-23 (4.2
   million retirees, 19% of 15+); the not-working-not-retired residual
   (~16%) joins no group. */
export const DEMO_SHARE = {
  Men: 0.49, Women: 0.51,
  "18–34": 0.28, "35–54": 0.33, "55+": 0.39,
  "Gen Z": 0.19, Millennials: 0.28, "Gen X": 0.25, Boomers: 0.28,
  "Year 12 or less": 0.40, "TAFE or trade": 0.31, University: 0.29,
  NSW: 0.31, Vic: 0.26, Qld: 0.20, SA: 0.07, WA: 0.10, "ACT/NT/Tas": 0.049, "Non-NSW/Vic/Qld": 0.23,
  "Inner metro": 0.30, "Outer metro": 0.33, Provincial: 0.16, Rural: 0.21,
  "Own outright": 0.32, Mortgage: 0.36, Renting: 0.32,
  "English only": 0.76, "Other language": 0.24,
  "Full time": 0.44, "Part time": 0.20, Retired: 0.19,
  /* the income tab's two standard bands (gen-data §7g-income): the
     bottom half of the income scale and the top 15%+. These size only
     the sampling-error floor and cancel out of the pooled figure – the
     values equal INCOME_STD_BANDS' widths, and the probe pins that. */
  "Lower earners (bottom 50%)": 0.5, "Higher earners (top 15%)": 0.15,
};

/* The income tab's standard bands on the income-quantile axis: the
   pooled line is read at each band's midpoint. */
export const INCOME_STD_BANDS = [
  { group: "Lower earners (bottom 50%)", lo: 0, hi: 0.5 },
  { group: "Higher earners (top 15%)", lo: 0.85, hi: 1 },
];

/* The income bases the tab pools, in the order the cut-offs print (user
   call 2026-10-18, reversing the same day's household-only pool). A
   personal-income bracket sorts people by their own pay – a high earner's
   non-working spouse lands among the "lower earners" – so its bands are not
   quite the household axis's people. But every household grid's top cell
   opens at ~0.59 of adults, so without DemosAU the top-15% read is a line
   carried from the 0.80 mid out to 0.925; DemosAU's $125k+ personal cell
   spans 0.85-1.00 - the only house measuring that band directly. In the Oct
   2026 window its bottom-half read matched the household houses' and its
   top read sat inside the pair's combined interval, and a basis gap shows up
   as house disagreement the pool's interval already widens for. Removing a
   basis here drops its houses from the pools, slots, roster and cut-offs. */
export const INCOME_POOL_BASES = ["household", "personal"];

/* $k a year per $1,000 a week, the census's own 365.25-day year – the one
   income-dist.json's weeksPerYear carries, so a weekly bracket edge lands
   back on its own census-weekly dollars */
const WK = 365.25 / 7;

/* Each income-printing house's bracket layout, exactly as demographics.json
   stores it, as ordered [storedKey, lowerEdgeInAnnual$k] cells over whose
   basis (household or personal income) the wave was asked. RedBridge's
   weekly brackets convert at WK; its "Prefer not to say" cell joins no
   grid. The closing edge of a cell is the next cell's lower edge; the last
   cell is open. A house that changed its brackets gets a variant per layout
   (YouGov's four brackets went binary in April 2026) – a wave matches a
   variant only on that variant's own keys, so eras never mix. */
export const INCOME_GRIDS = {
  "YouGov": { basis: "household", variants: [
    { cells: [["Under $100k", 0], ["$100k or more", 100]] },
    { cells: [["Under $50k", 0], ["$50–99k", 50], ["$100–149k", 100], ["$150k+", 150]] },
  ] },
  "Newspoll (pooled)": { basis: "household", variants: [
    { cells: [["Under $50k", 0], ["$50–99k", 50], ["$100–149k", 100], ["$150k+", 150]] },
  ] },
  "DemosAU": { basis: "personal", variants: [
    { cells: [["Under $45k", 0], ["$45–125k", 45], ["$125k+", 125]] },
  ] },
  "DemosAU (MRP)": { basis: "personal", variants: [
    { cells: [["Under $45k", 0], ["$45–75k", 45], ["$75–125k", 75], ["$125–200k", 125], ["$200k+", 200]] },
  ] },
  "RedBridge/Accent": { basis: "household", variants: [
    { cells: [["Under $1,000 a week", 0], ["$1,000–1,999 a week", WK],
      ["$2,000–2,999 a week", 2 * WK], ["$3,000+ a week", 3 * WK]] },
  ] },
  "Freshwater": { basis: "household", variants: [
    { cells: [["Under $75k", 0], ["$75–150k", 75], ["$150k or more", 150]] },
  ] },
};

/* incomeIndex(dist, ms): how far wages had moved from census night to the
   moment ms – AWE (income-dist.json's awe.series, ABS 6302.0 full-time
   adult ordinary-time earnings, May and November) at ms over AWE at the
   census. Linear between survey points; past the last point it compounds
   at the trailing year's growth, until the next release is extracted; before
   the first it holds the first. Null without a series. A poll's dollar
   edges divide by it to land on the census's 2021 dollars, so a Sept-2025
   wave and an Oct-2026 one each deflate by their own wage level. */
export function incomeIndex(dist, ms) {
  const a = dist && dist.awe;
  if (!a || !Array.isArray(a.series) || !a.series.length || !(a.census && a.census.value > 0)) return null;
  const s = a.series.map(([d, v]) => [Date.parse(d), v]);
  const t = Number.isFinite(ms) ? ms : s[s.length - 1][0];
  const [tl, vl] = s[s.length - 1];
  let v;
  if (t <= s[0][0]) v = s[0][1];
  else if (t >= tl) {
    const prev = s[Math.max(0, s.length - 3)];        // a year back (half-yearly series)
    v = prev[0] < tl ? vl * Math.exp(Math.log(vl / prev[1]) * (t - tl) / (tl - prev[0])) : vl;
  } else {
    const i = s.findIndex(([d]) => d >= t);
    v = s[i - 1][1] + (s[i][1] - s[i - 1][1]) * (t - s[i - 1][0]) / (s[i][0] - s[i - 1][0]);
  }
  return v / a.census.value;
}

/* the open top band's Pareto tail: the adults above the open band's floor
   and above the band below it fix alpha, so the mass above w inside the
   open band is top.n × (w / top.lo)^−alpha (household ≈ 2.1, personal
   ≈ 2.9 on the 2021 census) */
function openTail(bands) {
  const top = bands[bands.length - 1], below = bands[bands.length - 2];
  return { lo: top.lo, n: top.n, alpha: Math.log((top.n + below.n) / top.n) / Math.log(top.lo / below.lo) };
}

/* incomeQuantiles(house, dist, ms): each of the house's grid variants with
   every cell's quantile interval [{key, qLo, qHi, qMid, sh}] through the
   national histogram of adults (data/income-dist.json: {weeksPerYear, awe,
   axes:{household|personal:{bands,total}}}), the dollar edges deflated by
   incomeIndex at ms (the wave's fieldwork midpoint). An edge's quantile is
   the histogram mass below it, interpolating uniformly inside the band it
   falls in and along the Pareto tail inside the open top band. */
export function incomeQuantiles(house, dist, ms) {
  const g = INCOME_GRIDS[house];
  const ax = g && dist && dist.axes && dist.axes[g.basis];
  const r = incomeIndex(dist, ms);
  if (!ax || !r) return null;
  const { bands, total } = ax, tail = openTail(bands);
  const qOf = (edgeK) => {
    if (!(edgeK > 0)) return 0;
    const w = edgeK * 1000 / dist.weeksPerYear / r;
    let cum = 0;
    for (const b of bands) {
      if (b.hi != null && w > b.hi) { cum += b.n; continue; }
      if (w <= b.lo) return cum / total;
      if (b.hi == null) return (total - tail.n * (w / tail.lo) ** -tail.alpha) / total;
      return (cum + b.n * (w - b.lo) / (b.hi - b.lo + 1)) / total;
    }
    return 1;
  };
  return g.variants.map((v) => ({
    basis: g.basis,
    cells: v.cells.flatMap(([key, edge], i, cs) => {
      const qLo = qOf(edge), qHi = i + 1 < cs.length ? qOf(cs[i + 1][1]) : 1;
      return qHi > qLo ? [{ key, qLo, qHi, qMid: (qLo + qHi) / 2, sh: qHi - qLo }] : [];
    }),
  }));
}

/* incomeEdge(basis, share, dist, ms): the annual-$k edge carrying the given
   cumulative share of the electorate on one basis axis, in dollars of the
   moment ms – the inverse of incomeQuantiles' qOf, interpolated inside the
   histogram band it lands in (along the Pareto tail in the open top band)
   and rounded to the nearest $1k. gen-data reads the two standard bands'
   outer edges through it at the build's reference date for the earner
   rows' income-cut bracket (rd-panels' RdIncomeCut). */
export function incomeEdge(basis, share, dist, ms) {
  const ax = basis && dist && dist.axes && dist.axes[basis];
  const r = incomeIndex(dist, ms);
  if (!ax || !r || !(share >= 0 && share < 1)) return null;
  const target = share * ax.total;
  let cum = 0;
  for (const b of ax.bands) {
    if (cum + b.n < target) { cum += b.n; continue; }
    const tail = openTail(ax.bands);
    const w = b.hi == null
      ? tail.lo * (tail.n / ((1 - share) * ax.total)) ** (1 / tail.alpha)
      : b.lo + (target - cum) * (b.hi - b.lo + 1) / b.n;
    return Math.round(w * dist.weeksPerYear * r / 1000);
  }
  return null;
}

/* incomeFit(cells, dim): the weighted-least-squares vote-share line over
   quantile space for one wave's income dim – one {alpha, beta} per party
   key present in the printed cells, each cell a point at its mid-quantile
   weighted by its census share of the electorate. Returns null unless at
   least two cells printed parties (a single point pins no slope – every
   standard band would collapse to that cell's figure). */
export function incomeFit(cells, dim) {
  const pts = cells.filter((c) => dim[c.key]);
  if (pts.length < 2) return null;
  const keys = Object.keys(Object.assign({}, ...pts.map((c) => dim[c.key])));
  const out = {};
  for (const k of keys) {
    const us = pts.filter((c) => dim[c.key][k] != null);
    if (us.length < 2) { out[k] = null; continue; }
    let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const c of us) {
      const wt = c.sh, x = c.qMid, y = +dim[c.key][k] || 0;
      sw += wt; sx += wt * x; sy += wt * y; sxx += wt * x * x; sxy += wt * x * y;
    }
    const det = sw * sxx - sx * sx;
    out[k] = det > 1e-12 ? { a: (sy * sxx - sx * sxy) / det, b: (sw * sxy - sx * sy) / det } : null;
    /* a party printing in every present cell but one still fits through
       the cells it printed – the fit's support is computed over its own
       points, so a gap cells never extrapolates it */
  }
  const support = (k) => {
    const us = pts.filter((c) => dim[c.key][k] != null);
    return us.length ? [Math.min(...us.map((c) => c.qLo)), Math.max(...us.map((c) => c.qHi))] : null;
  };
  return { fits: out, support: Object.fromEntries(keys.map((k) => [k, support(k)])) };
}

/* §7g-age: the common age groups as edges in years, the open top null */
export const AGE_STD_BANDS = [
  { group: "18–34", lo: 18, hi: 35 },
  { group: "35–54", lo: 35, hi: 55 },
  { group: "55+", lo: 55, hi: null },
];
// a printed age label as [lo, hi) in years ("65+" → [65, null]), else null
const ageEdges = (lab) => {
  let m = /^(\d+)\s*[–-]\s*(\d+)$/.exec(lab);
  if (m) return [+m[1], +m[2] + 1];
  m = /^(\d+)\+$/.exec(lab);
  return m ? [+m[1], null] : null;
};
/* Fritsch–Carlson monotone cubic through (xs, ys), at x: a non-decreasing
   ys stays non-decreasing between knots, so no read goes below zero */
function pchip(xs, ys, x) {
  const n = xs.length, h = [], dl = [];
  for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; dl[i] = (ys[i + 1] - ys[i]) / h[i]; }
  const m = new Array(n).fill(0);
  if (n === 2) m[0] = m[1] = dl[0];
  else {
    // the three-point end slopes, held to the shape of the end interval
    const end = (h0, h1, d0, d1) => {
      const s = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
      if (Math.sign(s) !== Math.sign(d0)) return 0;
      return Math.sign(d0) !== Math.sign(d1) && Math.abs(s) > 3 * Math.abs(d0) ? 3 * d0 : s;
    };
    m[0] = end(h[0], h[1], dl[0], dl[1]);
    m[n - 1] = end(h[n - 2], h[n - 3], dl[n - 2], dl[n - 3]);
    for (let i = 1; i < n - 1; i++) {
      if (dl[i - 1] * dl[i] <= 0) continue;
      const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / dl[i - 1] + w2 / dl[i]);
    }
  }
  let i = 0;
  while (i < n - 2 && x > xs[i + 1]) i++;
  const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i]
    + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
}

/* ageStandardise(dim, dist): a wave's age table read at the common groups
   it doesn't print. The bands must tile adulthood – 18 to an open top, no
   gaps – or nothing is read. Each age maps to its share of adults below it
   (dist: data/age-dist.json, adults by single year, built by
   .build/extract-age-dist.mjs), and per party the cumulative vote, known
   exactly at every printed edge, is drawn between edges by a monotone
   cubic; a group's share is the vote it gains across the group over the
   adults it spans. A printed band reads back exactly as printed, so only
   the slivers between a house's edges and the common ones are estimated
   (Newspoll's 50–64 split at 55; YouGov's 50+ at 55). A straight line
   over the axis, the income tab's fit, is no use here: age bends the vote
   (Greens fall steeply then flatten, One Nation peaks at 50–64), and on
   2026-10-26 holdouts – each of 25 four-band waves rebuilt with an edge
   removed – the line missed by 2.0 points where this missed 1.3–1.6, of
   which ~1.1 is the cells' own sampling. Read at the common groups, the
   four-band houses' 35–54 and 55+ move under half a point between this
   and a flat split. Generations stay their own set: rebuilt from age
   tables, Gen Z read 3 points high on One Nation, and the Silent row sits
   past every printed edge.
   Returns { shares: {group: {party: share}}, read: [groups] } for the
   groups it read (printed groups are harmonize's own), or null. A party
   any cell leaves unprinted is read in no group. */
export function ageStandardise(dim, dist) {
  if (!dim || !dist || !Array.isArray(dist.adults)) return null;
  const cells = Object.entries(dim).map(([lab, sh]) => { const e = ageEdges(lab); return e && { lab, lo: e[0], hi: e[1], sh }; });
  if (!cells.length || cells.some((c) => !c)) return null;
  cells.sort((a, b) => a.lo - b.lo);
  if (cells[0].lo !== 18 || cells.at(-1).hi != null) return null;
  for (let i = 1; i < cells.length; i++) if (cells[i].lo !== cells[i - 1].hi) return null;
  const todo = AGE_STD_BANDS.filter((b) => !dim[b.group]);
  if (!todo.length || cells.length < 2) return null;
  // share of adults younger than age a; the open top is everyone
  const from = dist.from || 18, A = dist.adults, all = A.reduce((s, x) => s + x, 0);
  const U = (a) => {
    if (a == null) return 1;
    let s = 0;
    for (let y = from; y < a && y - from < A.length; y++) s += A[y - from];
    return s / all;
  };
  const xs = [0, ...cells.map((c) => U(c.hi))];
  const shares = {};
  for (const k of KEYS) {
    if (cells.some((c) => c.sh[k] == null)) continue;
    const ys = [0];
    cells.forEach((c, i) => ys.push(ys[i] + (xs[i + 1] - xs[i]) * (+c.sh[k] || 0)));
    for (const b of todo) {
      const u0 = U(b.lo), u1 = U(b.hi);
      (shares[b.group] ||= {})[k] = (pchip(xs, ys, u1) - pchip(xs, ys, u0)) / (u1 - u0);
    }
  }
  const read = todo.map((b) => b.group).filter((g) => shares[g]);
  return read.length ? { shares, read } : null;
}

const KEYS = ["alp", "lnp", "onp", "grn", "oth"];
const RB_SCHOOL = [["Below Year 12", 0.39], ["Year 12", 0.61]];
/* YouGov's three smaller regions as shares of their combined 2025 formal
   vote (AEC event 31496: SA 7.3%, WA 10.3%, Tas, ACT and NT 4.9% of the
   national vote). */
const YG_REST = [["SA", 0.324], ["WA", 0.457], ["ACT/NT/Tas", 0.219]];
/* DemosAU (MRP)'s Tas, ACT and NT rows as shares of the trio's combined
   2025 formal vote (event 31496: Tas 367,259 votes, ACT 290,565, NT
   105,762). */
const MRP_TRIO = [["Tas", 0.481], ["ACT", 0.3805], ["NT", 0.1385]];

/* One wave's groups on the common sets:
   { gender: { Men: shares, … }, age: { "18–34": shares, … }, generation, education,
     state, location, housing, language, working }.
   A party that printed a zero (a segment that rounded to nothing) stays 0;
   a key ABSENT from the printed table stays null – RedBridge's July 2025
   AFR table folds One Nation into Others, and reading that fold as a zero
   share would pollute every One Nation pool the wave's groups join.
   With opts.ageDist (data/age-dist.json) an age table whose bands miss the
   common ones is read at them (ageStandardise); without it only printed
   bands join, as before §7g-age. */
export function harmonize(w, opts) {
  const d = (w && w.dims) || {}, out = {};
  const put = (set, group, sh) => {
    if (sh) (out[set] ||= {})[group] = Object.fromEntries(KEYS.map((k) => [k, sh[k] == null ? null : (+sh[k] || 0)]));
  };
  for (const g of ["Men", "Women"]) put("gender", g, d.gender && d.gender[g]);
  // a printed band joins as printed; one the table lacks is read off its own bands
  const ag = opts && opts.ageDist ? ageStandardise(d.age, opts.ageDist) : null;
  for (const g of ["18–34", "35–54", "55+"]) put("age", g, (d.age && d.age[g]) || (ag && ag.shares[g]));
  for (const g of ["Gen Z", "Millennials", "Gen X", "Boomers"]) put("generation", g, d.generation && d.generation[g]);
  const e = d.education;
  if (e) {
    const school = RB_SCHOOL.every(([l]) => e[l])
      ? Object.fromEntries(KEYS.map((k) => [k, RB_SCHOOL.reduce((t, [l, wt]) => t + (+e[l][k] || 0) * wt, 0)]))
      : e["School"] || e["Year 12 or less"];
    put("education", "Year 12 or less", school);
    put("education", "TAFE or trade", e["TAFE"] || e["TAFE or college"] || e["TAFE or trade"]);
    put("education", "University", e["University"]);
  }
  const st = d.state;
  if (st) {
    for (const g of ["NSW", "Vic", "Qld", "SA", "WA"]) put("state", g, st[g]);
    /* the trio joins only from cuts of exactly that trio – a Tas-alone or
       ACT-alone row (Roy Morgan, EMRS) is never read into it */
    const trio = st["ACT/NT/Tas"] || (MRP_TRIO.every(([l]) => st[l])
      ? Object.fromEntries(KEYS.map((k) => [k, MRP_TRIO.reduce((t, [l, wt]) => t + (+st[l][k] || 0) * wt, 0)]))
      : null);
    put("state", "ACT/NT/Tas", trio);
    const rest = st["Rest of Australia"] || (YG_REST.every(([l]) => st[l])
      ? Object.fromEntries(KEYS.map((k) => [k, YG_REST.reduce((t, [l, wt]) => t + (+st[l][k] || 0) * wt, 0)]))
      : null);
    put("state", "Non-NSW/Vic/Qld", rest);
  }
  // DemosAU's Regional or rural finds no key here; RedBridge's Renting and other neither
  for (const g of ["Inner metro", "Outer metro", "Provincial", "Rural"]) put("location", g, d.location && d.location[g]);
  for (const g of ["Own outright", "Mortgage", "Renting"]) put("housing", g, d.housing && d.housing[g]);
  for (const g of ["English only", "Other language"]) put("language", g, d.language && d.language[g]);
  const wk = d.working;
  if (wk) {
    /* Newspoll's Other and RedBridge's Not working – the not-working,
       not-retired residual – find no key here: Newspoll is its only
       live printer */
    put("working", "Full time", wk["Full time"] || wk["Working full time"]);
    put("working", "Part time", wk["Part time"] || wk["Working part time"]);
    put("working", "Retired", wk.Retired);
  }
  return out;
}
