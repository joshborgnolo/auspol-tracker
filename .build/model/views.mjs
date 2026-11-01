/* views.mjs: the /model/ page's written lines and head figures, by rule - one implementation.
   assemble.mjs imports it to write the page's static head (what a reader sees before the script runs,
   and what a crawler reads) and inlines the same source into model.js, which redraws the head with it
   on a mode switch and draws the explorer's results with it.

   The headline names the party most likely to win the most seats and grades the claim by the share of
   simulations behind it; every scenario is covered:
     majority chance >= 90%            "X would win a majority"            / "X is very likely to win a majority"
     60-90%                            "X would probably win a majority"   / "X is likely to win a majority"
     most-seats chance >= 90%          "X would win the most seats, ..."   / "X is very likely to win the most seats, ..."
     60-90%                            "X would probably win the most seats, ..." / "X is favoured to win the most seats, ..."
     otherwise                         "No party is clearly ahead on seats"
   with the majority clause, when a majority is under 60%:
     under 20%  "probably short of a majority"
     20-40%     "more likely short of a majority than not"
     40-60%     "with a majority about as likely as not"
   The first column is "if an election were held now", the second election day. */
export const PARTY = {
  alp: { name: "Labor", lower: "Labor", short: "ALP" },
  lnp: { name: "The Coalition", lower: "the Coalition", short: "L/NP" },
  on: { name: "One Nation", lower: "One Nation", short: "ON" },
  grn: { name: "The Greens", lower: "the Greens", short: "GRN" },
  member: { name: "Independents", lower: "independents", short: "IND" },
  oth: { name: "Others", lower: "others", short: "OTH" },
};
export const MAJ_KEY = { alp: "alp", lnp: "coalition", on: "on" };
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const pct = (p) => (p < 0.005 ? "less than 1%" : p > 0.995 ? "more than 99%" : `${Math.round(100 * p)}%`);
export const pctShort = (p) => (p < 0.005 ? "<1%" : p > 0.995 ? ">99%" : `${Math.round(100 * p)}%`);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const longDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
export const shortDate = (iso) => { const [, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]}`; };

/* the run's House: 150 seats and 76 for a majority federally; a state run says its own (meta.seatsTotal, meta.majority) */
export const majOf = (res) => res.meta?.majority || 76;
export const totalOf = (res) => res.meta?.seatsTotal || 150;

/* mode: "nowcast" (an election held now), "forecast" (election day, months out) or "vic" (the Victorian
   election, weeks out, on today's polls) - the last two speak of the election to come */
export function headline(res, mode) {
  const nat = res.national;
  const cands = ["alp", "lnp", "on"].sort((a, b) => nat.mostSeats[b] - nat.mostSeats[a]);
  const L = cands[0], pMost = nat.mostSeats[L], pMaj = nat.majority[MAJ_KEY[L]];
  const who = PARTY[L].name, now = mode === "nowcast" || mode == null;
  const clause = pMaj < 0.2 ? "probably short of a majority" : pMaj < 0.4 ? "more likely short of a majority than not" : "with a majority about as likely as not";
  if (pMaj >= 0.9) return now ? `${who} would win a majority` : `${who} is very likely to win a majority`;
  if (pMaj >= 0.6) return now ? `${who} would probably win a majority` : `${who} is likely to win a majority`;
  if (pMost >= 0.9) return now ? `${who} would win the most seats, ${clause}` : `${who} is very likely to win the most seats, ${clause}`;
  if (pMost >= 0.6) return now ? `${who} would probably win the most seats, ${clause}` : `${who} is favoured to win the most seats, ${clause}`;
  // no clear leader: name a two-party race when the top two share nearly every simulation (each at least
  // 30%, together 80%+), then say how likely a hung parliament is (60% / 90%; 40-60% "as likely as not")
  const B = cands[1], pB = nat.mostSeats[B], noMaj = nat.majority.noMajority;
  const race = pMost >= 0.3 && pB >= 0.3 && pMost + pB >= 0.8 ? `${who} and ${PARTY[B].lower} are close on seats` : "No party is clearly ahead on seats";
  const hung = noMaj >= 0.9 ? ", and a hung parliament is very likely" : noMaj >= 0.6 ? ", and a hung parliament is likely" : noMaj >= 0.4 ? ", and a hung parliament is about as likely as not" : "";
  return race + hung;
}

/* "In 20,000 simulated elections held on the polls to 27 October, Labor wins 71 seats on average (51 to 90
   in nine of ten), One Nation 36 (13 to 63) and the Coalition 31 (15 to 48). Labor reaches the 76 seats
   needed to govern alone in 38% of them." - parties in order of expected seats */
export function dek(res, mode, asOf) {
  const nat = res.national, d = nat.seatDistribution, e = nat.expectedSeats;
  const [a, b, c] = ["alp", "on", "lnp"].sort((x, y) => e[y] - e[x]);
  const sims = res.meta.draws.toLocaleString("en-AU");
  const lead = mode === "forecast"
    ? `Projected to election day, ${sims} simulated elections from the polls to ${shortDate(asOf)} give ${PARTY[a].lower}`
    : mode === "vic"
      ? `On the polls to ${shortDate(asOf)}, ${sims} simulated elections for ${shortDate(res.meta.election)} give ${PARTY[a].lower}`
      : `In ${sims} simulated elections held on the polls to ${shortDate(asOf)}, ${PARTY[a].lower} wins`;
  const rest = (k) => `${PARTY[k].lower} ${Math.round(e[k])} (${d[k].p05} to ${d[k].p95})`;
  const pMaj = nat.majority[MAJ_KEY[a]];
  return `${lead} ${Math.round(e[a])} seats on average (${d[a].p05} to ${d[a].p95} in nine of ten), ${rest(b)} and ${rest(c)}. `
    + `${PARTY[a].name} reaches the ${majOf(res)} seats needed to govern alone in ${pct(pMaj)} of them.`;
}

/* the run's provenance line under the dek */
export function headNote(res, mode, asOf) {
  if (mode === "vic") return `Polls to <b>${longDate(asOf.pollsTo)}</b> (the /vic/ page's trend through ${asOf.polls} polls this term) · model run ${longDate(asOf.modelRun)} · `
    + `${res.meta.draws.toLocaleString("en-AU")} simulated elections · election ${res.meta.electionLabel} · <a href="#vic-how">how it works</a>`;
  const n = asOf.waves ? asOf.waves.length : null;
  return `Polls to <b>${longDate(asOf.pollsTo)}</b>${n ? ` (${n} polls since ${shortDate(asOf.windowFrom)})` : ""} · model run ${longDate(asOf.modelRun)} · `
    + `${res.meta.draws.toLocaleString("en-AU")} simulated elections`
    + (mode === "forecast" ? " · election day taken as about 17 months away, with minor parties giving back 0–60% of their rise since 2025" : "")
    + ` · <a href="#how">how it works</a>`;
}

/* mutually exclusive outcomes: who wins the most seats, and whether alone */
export function outcomes(res) {
  const m = res.national.majority, ms = res.national.mostSeats, seg = [];
  const add = (tone, soft, p, label) => { if (p > 0.0005) seg.push({ tone, soft, p, label }); };
  add("alp", false, m.alp, "Labor majority");
  add("alp", true, Math.max(0, ms.alp - m.alp), "Labor most seats, no majority");
  add("on", false, m.on, "One Nation majority");
  add("on", true, Math.max(0, ms.on - m.on), "One Nation most seats, no majority");
  add("lnp", false, m.coalition, "Coalition majority");
  add("lnp", true, Math.max(0, ms.lnp - m.coalition), "Coalition most seats, no majority");
  const rest = 1 - seg.reduce((a, s) => a + s.p, 0);
  if (rest > 0.0005) seg.push({ tone: "oth", soft: true, p: rest, label: "Another party first, or a tie" });
  return seg;
}
export function outcomesHTML(res) {
  const seg = outcomes(res);
  const bar = seg.map((s) => `<span class="t-${s.tone}${s.soft ? " soft" : ""}" style="flex-grow:${(1000 * s.p).toFixed(1)}" title="${esc(s.label)}: ${pctShort(s.p)}"></span>`).join("");
  const leg = seg.filter((s) => s.p >= 0.005).map((s) => `<span class="it t-${s.tone}"><span class="sw${s.soft ? " soft" : ""}"></span>${esc(s.label)} <b>${pctShort(s.p)}</b></span>`).join("");
  return `<div class="md-obar" role="img" aria-label="${esc(seg.map((s) => s.label + " " + pctShort(s.p)).join(", "))}">${bar}</div><div class="md-olegend">${leg}</div>`;
}

/* the seat ranges: per party the middle half and nine-tenths of the simulations, the median and the
   average; `compare` (another run) leaves a grey tick at its median and a signed change beside the number */
export const RANGE_PARTIES = ["alp", "on", "lnp", "member", "grn"];
export function axisMaxFor(...runs) {
  const rs = runs.filter(Boolean);
  const top = Math.max(Math.round(totalOf(rs[0]) * 2 / 3), ...rs.flatMap((r) => RANGE_PARTIES.map((k) => r.national.seatDistribution[k].p95)));
  return Math.ceil((top + 4) / 25) * 25;
}
export function rangesHTML(res, { compare = null, axisMax = axisMaxFor(res, compare), labels = true } = {}) {
  const nat = res.national, X = (v) => `${(100 * v / axisMax).toFixed(2)}%`, M = majOf(res);
  const order = RANGE_PARTIES.slice().sort((a, b) => nat.expectedSeats[b] - nat.expectedSeats[a]);
  const rows = order.map((k, i) => {
    const d = nat.seatDistribution[k], e = nat.expectedSeats[k];
    const ms = nat.mostSeats[k] ?? 0;
    const sub = k === "alp" || k === "on" || k === "lnp" ? `most seats ${pctShort(ms)}` : "";
    // against the official run: a short signed badge beside the average (the key under the explorer's
    // chart says what it is); written out in full for screen readers in the summary paragraph
    let delta = "";
    if (compare) { const dv = Math.round(e) - Math.round(compare.national.expectedSeats[k]); delta = `<span class="md-delta${dv === 0 ? " zero" : ""}" title="${dv === 0 ? "The same as" : `${Math.abs(dv)} ${dv > 0 ? "more" : "fewer"} than`} the official run's average">${dv > 0 ? "+" : dv < 0 ? "−" : "±"}${Math.abs(dv)}</span>`; }
    const ghost = compare ? `<span class="ghost" style="left:${X(compare.national.seatDistribution[k].p50)}"></span>` : "";
    return `<div class="md-rrow t-${k}">
      <div class="md-rname"><span class="dot"></span>${esc(PARTY[k].name)}${labels && sub ? ` <small>${sub}</small>` : ""}</div>
      <div class="md-rtrack" aria-hidden="true"><span class="majl" style="left:${X(M)}"></span>${i === 0 ? `<span class="md-maj-lab" style="left:${X(M)}">${M} for a majority</span>` : ""}<span class="b90" style="left:${X(d.p05)};width:${X(Math.max(0.6, d.p95 - d.p05))}"></span><span class="b50" style="left:${X(d.p25)};width:${X(Math.max(0.6, d.p75 - d.p25))}"></span>${ghost}<span class="med" style="left:${X(d.p50)}"></span></div>
      <div class="md-rnum">${Math.round(e)}${delta}<small>${d.p05}–${d.p95}</small></div>
    </div>`;
  }).join("");
  const ticks = [0, 25, 50, 75, 100, 125, 150].filter((t) => t <= axisMax).map((t) => `<span style="left:${X(t)}">${t}</span>`).join("");
  const srDelta = (k) => { if (!compare) return ""; const dv = Math.round(nat.expectedSeats[k]) - Math.round(compare.national.expectedSeats[k]); return dv === 0 ? " (the same as the official run)" : ` (${Math.abs(dv)} ${dv > 0 ? "more" : "fewer"} than the official run)`; };
  const sr = order.map((k) => `${PARTY[k].name} ${Math.round(nat.expectedSeats[k])} seats on average${srDelta(k)}, ${nat.seatDistribution[k].p05} to ${nat.seatDistribution[k].p95} in nine simulations of ten`).join("; ");
  const key = compare ? `<p class="md-ckey" aria-hidden="true"><span class="i"><span class="md-delta">+3</span>change in the average on the official run</span><span class="i"><span class="kghost"></span>the official run's median</span></p>` : "";
  return `<p class="md-sr">${esc(sr)}.</p>${rows}<div class="md-raxis" aria-hidden="true"><span></span><div class="ax">${ticks}</div><span></span></div>${key}`;
}
export const RANGE_KEY = `<div class="md-rkey"><span><i></i>nine simulations in ten</span><span><i class="k50"></i>the middle half</span><span><i class="kmed"></i>the median</span><span>The large figure is the average; the small range is the nine-in-ten band.</span></div>`;

/* the whole static head, written into model/index.html by assemble.mjs */
export function staticHead(res, mode, asOf) {
  return `  <h2 class="sh-hed" id="md-hed">${esc(headline(res, mode))}</h2>
  <p class="sh-dek" id="md-dek">${esc(dek(res, mode, asOf.pollsTo))}</p>
  <p class="md-head-note" id="md-note">${headNote(res, mode, asOf)}</p>
  <div class="md-outcomes" id="md-outcomes">${outcomesHTML(res)}</div>
  <div class="md-ranges" id="md-ranges">${rangesHTML(res)}</div>
  ${RANGE_KEY}`;
}
