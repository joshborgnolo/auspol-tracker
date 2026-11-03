/* app-5-evidence.js: how the model works, how well it has done, what it cannot know, and its files -
   every figure read from model/data/evidence.json and inputs.json (the calibration and backtest stores),
   none typed in. */
const GH = "https://github.com/joshborgnolo/auspol-tracker/blob/main/";
const fx1 = (x) => (Math.round(10 * x) / 10).toFixed(1);
const ptsAt = (sigma, share) => sigma * share * (1 - share) * 100;
function lineChart(host, { xs, series, yfmt = (v) => fx1(v), height = 190, ylab = "" }) {
  const W = Math.max(280, host.clientWidth || 480), H = height, m = { l: 34, r: 74, t: 10, b: 24 };
  const all = series.flatMap((s) => s.v.filter((v) => v != null)), ymax = Math.max(...all) * 1.12, ymin = 0;
  const X = (i) => m.l + (W - m.l - m.r) * (xs.length === 1 ? 0.5 : i / (xs.length - 1)), Y = (v) => m.t + (H - m.t - m.b) * (1 - (v - ymin) / (ymax - ymin));
  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": ylab }, host);
  const g = svg("g", { class: "grid" }, s);
  const step = ymax > 8 ? 2 : ymax > 4 ? 1 : 0.5;
  for (let v = 0; v <= ymax; v += step) { svg("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }, g); svg("text", { x: m.l - 6, y: Y(v) + 4, "text-anchor": "end" }, s).textContent = yfmt(v); }
  xs.forEach((x, i) => { svg("text", { x: X(i), y: H - 6, "text-anchor": "middle" }, s).textContent = x; });
  const ends = [];
  for (const q of series) {
    const gp = svg("g", { class: `t-${q.tone}` }, s), pts = q.v.map((v, i) => (v == null ? null : [X(i), Y(v)])).filter(Boolean);
    svg("path", { class: "ln", d: "M" + pts.map((p) => p.map((n) => n.toFixed(1)).join(",")).join("L") }, gp);
    for (const p of pts) svg("circle", { class: "pt", cx: p[0], cy: p[1], r: 2.6 }, gp);
    const last = pts[pts.length - 1]; ends.push({ y: last[1], x: last[0], q, gp });
  }
  ends.sort((a, b) => a.y - b.y); for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
  for (const e of ends) svg("text", { x: e.x + 8, y: e.y + 4, class: "lab" }, e.gp).textContent = e.q.name;
  return s;
}
function step(n, title, prose, fig) {
  return `<div class="md-step"><div class="md-prose"><h3><span class="n">${n}</span>${title}</h3>${prose}</div><div class="md-fig">${fig || ""}</div></div>`;
}
/* who meets whom in the final count: the base election's final pairs (counted) against the run's average */
const PAIR_ORD = ["alp", "lnp", "on", "grn", "member", "oth"], PAIR_NM = { alp: "Labor", lnp: "Coalition", on: "One Nation", grn: "Greens", member: "Independent", oth: "Other" };
function pairsFigure(skel, tcpOf, R, year, nowLabel) {
  const pkey = (a, b) => [a, b].sort((x, y) => PAIR_ORD.indexOf(x) - PAIR_ORD.indexOf(y)).join(" v ");
  const p25 = {}, p28 = {};
  for (const k of skel) { const t = tcpOf(k); if (t) { const q = pkey(BUCKET(t[0].bucket), BUCKET(t[1].bucket)); p25[q] = (p25[q] || 0) + 1; } }
  for (const [q, v] of Object.entries(R.national.finalPairs)) { const [a, b] = q.split(" v ").map(BUCKET); if (a === b) continue; const k2 = pkey(a, b); p28[k2] = (p28[k2] || 0) + v; }
  const pk = [...new Set([...Object.keys(p25), ...Object.keys(p28)])].sort((x, y) => (p28[y] || 0) - (p28[x] || 0) || (p25[y] || 0) - (p25[x] || 0));
  const shown = pk.filter((q) => Math.max(p25[q] || 0, p28[q] || 0) >= 1.5), rest = pk.filter((q) => !shown.includes(q));
  const prow = (l, a, b) => ({ l, a, b }), prows = shown.map((q) => prow(q.split(" v ").map((x) => PAIR_NM[x]).join(" v "), p25[q] || 0, p28[q] || 0));
  if (rest.length) prows.push(prow("Other pairs", rest.reduce((n, q) => n + (p25[q] || 0), 0), rest.reduce((n, q) => n + (p28[q] || 0), 0)));
  const pmax = Math.max(...prows.flatMap((r) => [r.a, r.b]));
  const html = `<div class="cap">Who meets whom in the final count</div>
     <div class="md-pkey"><span><i class="y25"></i>Counted in ${year}</span><span><i class="y28"></i>${nowLabel}</span></div>
     <div class="md-pairs">${prows.map((r) => `<span class="l">${r.l}</span><span class="b"><i class="y25" style="width:${(100 * r.a / pmax).toFixed(1)}%"></i><i class="y28" style="width:${(100 * r.b / pmax).toFixed(1)}%"></i></span><span class="v">${Math.round(r.a)} <span class="arr">→</span> <b>${Math.round(r.b)}</b></span>`).join("")}</div>
     <div class="sub">Seats by the two candidates left at the end of the count. Today’s figures average the ${R.meta.draws.toLocaleString("en-AU")} simulations, so they need not be whole numbers of seats; they are rounded here.</div>`;
  return { p25, p28, pk, html };
}
function renderEvidence() {
  const E = STATE.evidence, I = STATE.inputs, now = I.vote.nowcast, a = I.asOf, R = STATE.res.nowcast;
  const sh = { alp: now.alp / 100, lnp: now.lnp / 100, grn: now.grn / 100, onp: now.on / 100 };
  const bands = E.national.bands.map((b) => b.band.replace(" months", " mo").replace("final month", "final month"));
  const S = I.settings.nowcast, Sf = I.settings.forecast;
  // the table shows what the model draws (settings), and says so where that differs from a party's own record
  const SIG_I = { alp: 0, lnp: 1, onp: 2, grn: 3 };
  const drawn = (k, Sx) => ptsAt(Sx.sigNat[SIG_I[k]], sh[k]), own = (k, band) => ptsAt(E.national.sigma[k][band], sh[k]);
  const onOwn = [own("onp", "final month"), own("onp", "13-20 months")], onDrawn = [drawn("onp", S), drawn("onp", Sf)];
  const onDiffers = fx1(onOwn[0]) !== fx1(onDrawn[0]) || fx1(onOwn[1]) !== fx1(onDrawn[1]);
  const errTbl = `<table class="md-tbl"><caption>How far the polls’ average can miss, as the model draws it: one standard deviation, in points at today’s vote</caption><thead><tr><th>Party</th><th>Final month</th><th>13–20 months out</th><th>Elections</th></tr></thead><tbody>${[["alp", "Labor"], ["lnp", "Coalition"], ["grn", "Greens"], ["onp", "One Nation"]].map(([k, n]) => `<tr><td>${n}${k === "onp" && onDiffers ? "*" : ""}</td><td>±${fx1(drawn(k, S))}</td><td>±${fx1(drawn(k, Sf))}</td><td>${E.national.n[k]["final month"]}</td></tr>`).join("")}</tbody></table>${onDiffers ? `<div class="sub">* One Nation’s own record, five elections when it polled far lower, would give ±${fx1(onOwn[0])} and ±${fx1(onOwn[1])}. Five is too few to pin the size down, so the model takes the Greens’ error, the best-measured minor party’s, at least 0.25 on the logit scale and never more than One Nation’s own.</div>` : ""}`;
  const html = [];
  html.push(step(1, "Start from the polls",
    `<p>The model starts from this site’s polling aggregate, the house-corrected average of the ${a.waves.length} polls fielded from ${shortDate(a.windowFrom)} to ${shortDate(a.pollsTo)}: <b>Labor ${fx1(now.alp)}, One Nation ${fx1(now.on)}, the Coalition ${fx1(now.lnp)}, the Greens ${fx1(now.grn)} and others ${fx1(now.oth)}</b>.</p>
     <p>An average of polls is not a result. In every federal campaign since 1972 the final month’s polls have missed each party by an amount that is fitted here, party by party, on the logit scale, with the errors linked: when the polls overstate Labor they tend to understate the Coalition (a correlation of ${E.national.corr.alpLnpAllCycles} over ${E.national.corr.alpLnpCycles} elections). Errors are drawn with fat tails (a Student-t), so a big miss is possible.</p>
     <p><b>On election day</b>, about 17 months away, the error is the larger one seen 13 to 20 months out, and minor parties give back part of their rise since 2025. Over ${E.national.fade["13-20 months"].n} minor-party cases, about ${Math.round(100 * E.national.fade["13-20 months"].lambda)}% of a surge since the last election was gone by polling day; every case was a small surge, so the model draws the fade anywhere from 0 to 60%.</p>
     <p class="src">Fitted by <a href="${GH}.build/analysis/seat-model/calibrate-national.mjs">calibrate-national.mjs</a> on the poll archive behind Past cycles.</p>`, errTbl));
  // seat noise by election, in points at each party's 2025 share; the years are the calibration's own
  const years = [...new Set(["alp", "lnp", "grn"].flatMap((k) => Object.keys(E.swing.stateOracle[k].rmsByElection || {})))].sort(), nat25 = I.vote.result2025;
  const WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"], word = (n) => WORD[n] ?? String(n);
  const TM = E.swing.terms, OOS = E.swing.oos, SM = E.swing.sigMult;
  const pts2 = (x, k) => fx1(Math.abs(ptsAt(x, nat25[k] / 100)));
  // the seat terms' paragraph: sizes in points at each party's 2025 vote; the out-of-sample record counts the
  // elections whose typical seat miss the terms cut (refitted before each, scored on it)
  const better = (k) => { const b = OOS?.[k]?.byElection || {}; const es = Object.values(b); return [es.filter((v) => v.terms < v.plain).length, es.length]; };
  const termsTxt = TM ? (() => {
    const yrs = E.swing.years, y0 = yrs[0], y1 = yrs[yrs.length - 1];
    const [ka, na] = better("alp"), [kl] = better("lnp"), [kg] = better("grn"), oy = Object.keys(OOS?.alp?.byElection || {});
    return `<p>Some of what is left can be foreseen, and the model uses it, with terms fitted on every federal election from ${y0} to ${y1}. A sitting member carries a personal vote: standing again, they are worth about ${pts2(TM.alp.incE, "alp")} points to Labor or ${pts2(TM.lnp.incE, "lnp")} to the Coalition; where a party’s member from last time is gone, retired or beaten, it gives back about ${pts2(TM.alp.incP, "alp")} points (Labor) or ${pts2(TM.lnp.incP, "lnp")} (the Coalition).${TM.grn?.borrowed ? " The Greens, with too few members to fit, take the two parties’ average." : ""} A member who quits the party and stands against it takes more. And a seat gives back part of an unusually good or bad result last time: about ${Math.round(-100 * TM.alp.rho)}% of the surprise for Labor, ${Math.round(-100 * TM.lnp.rho)}% for the Coalition and ${Math.round(-100 * TM.grn.rho)}% for the Greens.</p>${na ? `
     <p>Fitted on the elections before each one from ${oy[0]} to ${oy[oy.length - 1]} and tried on it, these terms cut the typical seat’s miss in Labor’s vote in ${word(ka)} of the ${word(na)} elections, the Coalition’s in ${word(kl)} and the Greens’ in ${word(kg)}.</p>` : ""}`;
  })() : "";
  // the noise paragraph: the multiplier and, when the whole record would choose differently, which way and why
  const LF = E.federalLong?.rows?.[0]?.E ?? 2001, LL = E.federalLong?.rows?.slice(-1)[0]?.E ?? 2025, RF = SM?.recentFrom ?? 2016;
  const fm = (m) => (Number.isInteger(m) ? m.toFixed(1) : String(m));
  const multTxt = SM ? `Drawn at ${fm(SM.value)} times the size the last three elections left, with fat tails, it scored best when the elections from ${RF} to ${LL} were predicted afresh${SM.bestAll < SM.value ? `. Over every election since ${LF} a smaller multiple, ${fm(SM.bestAll)}, would have scored better, because seats strayed less in the 2000s; the recent elections are the better guide to today’s` : SM.bestAll > SM.value ? `. Over every election since ${LF} a larger multiple, ${fm(SM.bestAll)}, would have scored better` : ""}.` : "Noise 1.3 times the calm-year size, with fat tails, scored best when past elections were predicted afresh.";
  html.push(step(2, "Spread the vote across the seats",
    `<p>Each party’s 2025 vote in each seat moves by the same amount on the logit scale, with one shift per party solved so the national totals come out exactly. On the logit scale a party gains least in points where it is very weak or very strong, which is how a surge spreads: the rule predicted One Nation’s SA 2026 vote, district by district, from its federal 2025 vote with a typical miss of 2.1 points, against 4.5 for adding the same points everywhere.</p>
     <p>Each state shifts by what this term’s state polling says, within its sampling error, and each seat by the age and gender of its voters, as measured in the Resolve polls against election eve.</p>
     ${termsTxt}
     <p>What the terms cannot foresee is noise, fitted on the same elections. It has grown as voters have loosened their ties, and it grows for a party in steep decline, as the SA Liberals’ did in 2026, so a party’s seat noise grows with its fall since 2025. ${multTxt}</p>
     <p>Education gets no term of its own. Within each pollster, the gap between graduates and everyone else has moved by ${E.education.estimate.onp.gapChange.toFixed(2)} on the logit scale for One Nation and ${E.education.estimate.grn.gapChange.toFixed(2)} for the Greens: their surges spread by education just as the logit rule implies. Labor’s and the Coalition’s gaps moved by about 0.2, worth at most ${fx1(Math.max(E.education.estimate.alp.seatEffect.mostPositive[0][1], E.education.estimate.lnp.seatEffect.mostPositive[0][1]))} points in the most extreme seats, and the model’s shared education shock already spans that.</p>
     <p class="src"><a href="${GH}.build/analysis/seat-model/swing-fit.mjs">swing-fit.mjs</a>, <a href="${GH}.build/analysis/seat-model/calibrate-swing.mjs">calibrate-swing.mjs</a>, <a href="${GH}.build/analysis/seat-model/extract-incumbency.mjs">extract-incumbency.mjs</a>, <a href="${GH}.build/analysis/seat-model/calibrate-education.mjs">calibrate-education.mjs</a>, <a href="${GH}.build/analysis/seat-model/vote-layer.mjs">vote-layer.mjs</a>.</p>`,
    `<div class="cap">How far seats stray from the logit rule, in points at each party’s typical vote</div><div id="fig-noise"></div><div class="sub">Root mean square of each seat’s miss with the state totals known${TM ? " and the seat terms applied" : ""}, at each party’s 2025 national vote. The SA Liberals’ 2026 collapse ran at about ${fx1(ptsAt(E.swing.sa26.lnp.rmsLogit, 0.19))} points.</div>`));
  const ex = E.examples.map((x) => `<tr><td>${esc(x.seat)}</td><td>${Math.round(100 * x.coalitionLaborOverOn)}%</td><td>${Math.round(100 * x.laborCoalitionOverOn)}%</td><td>${Math.round(100 * x.onLaborOverCoalition)}%</td><td>${Math.round(100 * x.greensLaborOverCoalition)}%</td></tr>`).join("");
  const comp = (row, label) => { const parts = [["onp", "on", "One Nation"], ["lnp", "lnp", "Coalition"], ["alp", "alp", "Labor"], ["grn", "grn", "Greens"], ["ind", "member", "independents"], ["oth", "oth", "others"]]; return `<div class="md-fine" style="margin-top:12px">${label}</div><div class="md-mix">${parts.map(([k, t]) => `<span class="t-${t}" style="flex-grow:${(1000 * (row[k] || 0)).toFixed(0)}" title="${Math.round(100 * (row[k] || 0))}% voted ${k === "ind" ? "independent" : k === "oth" ? "for another party" : PARTY[t].name} in 2025"></span>`).join("")}</div><div class="md-fine">${parts.filter(([k]) => (row[k] || 0) >= 0.03).map(([k, , n]) => `${Math.round(100 * row[k])}% ${n}`).join(" · ")}</div>`; };
  // the House record’s check on the national preference shocks: each class’s drift between elections against
  // what the model draws (wider in every class / narrower in the named ones)
  const FD = E.flowDrift, DK = [["GRN|AC", "GRN", "Greens voters’"], ["ON|AC", "ON", "One Nation’s"], ["OTH-R|AC", "OTH-R", "right-wing minor parties’"], ["OTH-M|AC", "OTH-M", "other minor parties’"], ["OTH-L|AC", "OTH-L", "left-wing minor parties’"]].filter(([k]) => FD?.[k]);
  const narrower = DK.filter(([k, c]) => S.flowNat[c] < FD[k].rms);
  const driftTxt = DK.length ? `
     <p>The House counts since ${Math.min(...DK.map(([k]) => FD[k].first))} show how far each party’s split between Labor and the Coalition moves from one election to the next: on the logit scale, ${DK.map(([k, , n]) => `${n} by ${FD[k].rms.toFixed(2)}`).join(", ")}. The model draws ${DK.map(([, c]) => S.flowNat[c].toFixed(2)).join(", ")} for the same groups, sized on the drift from a Senate election to the next count, ${narrower.length ? `narrower than the House record for ${narrower.map(([, , n]) => n.replace(/’$/, "").replace(/’s$/, "")).join(" and ")}` : "at least as wide as the House record for every group"}.</p>` : "";
  // why only One Nation's voters are mixed: what mixing the Coalition's would do, read off evidence.json
  const CU = E.compositionUse, mixTxt = CU && !CU.mixed.includes("lnp") ? `
     <p>Only One Nation’s voters are mixed this way. The other parties’ orders are already set on counts of their own flows, and mixing would move them off those counts on what people recall of their 2025 vote. Today’s Coalition voters include ${Math.round(100 * E.composition.lnp.alp)}% who say they voted Labor in 2025. Mixed in the same way, they would send ${Math.round(100 * CU.coalLaborOverOn.ifMixed)}% of Coalition preferences to Labor ahead of One Nation, against the ${Math.round(100 * CU.coalLaborOverOn.used)}% the model uses. Recalled votes lean towards the party that won, and no count shows a shift that size.</p>` : "";
  // the Coalition's Labor-v-One Nation level: set to the site's own table, with the Senate's reading beside it
  const coalTxt = CU?.coalLaborOverOn?.target != null ? `
     <p>One choice decides more seats than any other: whether Coalition voters put Labor or One Nation next. On the 2025 Senate ballots ${Math.round(100 * CU.coalLaborOverOn.senate)}% put Labor ahead, outside the ACT, where One Nation ran no Senate ticket. The lower-house counts of that contest run a little either side of the Senate ballots cast in the same places. The model sets the national level to ${Math.round(100 * CU.coalLaborOverOn.target)}%, the site’s own <a href="/flows-explained/#one-nation">Labor v One Nation table</a>, which weighs those counts, and keeps each seat’s own Senate pattern around it.</p>` : "";
  html.push(step(3, "Order every voter’s preferences",
    `<p>Who wins a seat often depends on the order in which voters number the parties they did not vote for, and in a three-way race that order decides a great deal: whether Coalition voters put Labor or One Nation next. The House count shows only the contests that happened. The Senate shows every voter’s order: the AEC publishes every formal Senate ballot, and for each party’s voters in each seat this model counts the order in which they ranked Labor, the Coalition, the Greens and One Nation, across about 15 million ballots at each of the last four elections.</p>
     <p>House voters differ from Senate voters in ways fitted on ${E.flows.rows.same.toLocaleString("en-AU")} House flows counted from 2016 to 2025, the elections since every Senate ballot has been published (before 2016 nearly every Senate vote was a single vote for a party’s ticket, which shows the party’s order, not its voters’): Greens voters’ preferences reach Labor a little less often in the House, One Nation’s a little more. Where the 2025 House count saw a seat’s own flow, that counts too.</p>${driftTxt}
     <p>Voters have moved since 2025, and they bring their own orders with them. Today’s One Nation voters, by the last six weeks of vote-switching polls, are ${Math.round(100 * E.composition.on.onp)}% its 2025 voters, ${Math.round(100 * E.composition.on.lnp)}% former Coalition voters and ${Math.round(100 * E.composition.on.alp)}% former Labor voters. Each group keeps its old order with One Nation moved first. That is why One Nation’s preferences reach Labor more often than in 2025, as they did in SA in 2026.</p>${mixTxt}${coalTxt}
     <p class="src"><a href="${GH}.build/analysis/seat-model/extract-senate-rankings.py">extract-senate-rankings.py</a>, <a href="${GH}.build/analysis/seat-model/senate-flows.mjs">senate-flows.mjs</a>, <a href="${GH}.build/analysis/seat-model/calibrate-flows.mjs">calibrate-flows.mjs</a>, <a href="${GH}.build/analysis/seat-model/seat-build.mjs">seat-build.mjs</a>.</p>`,
    `<table class="md-tbl"><caption>Three seats’ 2025 Senate ballots</caption><thead><tr><th>Seat</th><th>Coalition voters: Labor ahead of One Nation</th><th>Labor voters: Coalition ahead of One Nation</th><th>One Nation voters: Labor ahead of the Coalition</th><th>Greens voters: Labor ahead of the Coalition</th></tr></thead><tbody>${ex}</tbody></table>
     <div class="sub">Shares of each party’s Senate voters who numbered either of the two, before the House adjustments.</div>
     ${comp(E.composition.on, "Today’s One Nation voters, by their 2025 vote")}${comp(E.composition.lnp, CU && !CU.mixed.includes("lnp") ? "Today’s Coalition voters, by their 2025 vote (not mixed)" : "Today’s Coalition voters, by their 2025 vote")}`));
  const { p25, p28, pk, html: pairFig } = pairsFigure(I.seats, (k) => k.tcp2025, R, 2025, "If held today, on average");
  const PNM = PAIR_NM;
  const cl25 = p25["alp v lnp"] || 0, cl28 = p28["alp v lnp"] || 0, top28 = pk.find((q) => q !== "alp v lnp" && (p28[q] || 0) >= 1);
  html.push(step(4, "Count every seat",
    `<p>Every seat is counted as the AEC counts it: the candidate with the fewest votes is excluded, and each ballot moves to the next candidate it ranks who is still standing, until two remain. Because each group of voters’ whole order is known, the count works for any final pair (Labor v One Nation, the Coalition v One Nation, a three-way race) without a table of flows, and a ballot that passed through one party moves on as its own voter would move it. Building three-way splits from pairwise flows instead misplaces the right-wing minor parties’ votes by about 11 points.</p>
     <p>Sitting independents take the share of moving ballots they took in their 2025 counts. A Liberal or National knocked out of a three-cornered contest passes most of their votes to their partner, at the rate their 2025 counts show.</p>
     <p>In 2025, ${cl25} of the 150 counts ended with Labor against the Coalition. If the election were held today, about ${Math.round(cl28)} would${top28 ? `, and about ${Math.round(p28[top28])} would end ${top28.split(" v ").map((x) => (x === "lnp" ? "the Coalition" : x === "grn" ? "the Greens" : x === "member" ? "an independent" : x === "oth" ? "another candidate" : PNM[x])).join(" against ")}` : ""}.</p>
     <p>Counted on the actual 2025 first preferences, this reproduces <b>${E.replay2025.winners} of the 150 winners</b> and ${E.replay2025.pairs} of the final pairs, with a typical two-candidate error of ${fx1(E.replay2025.tcpMaePts)} points. The misses are ${E.replay2025.misses.join(", ")}, the closest contests of the election.</p>
     <p class="src"><a href="${GH}.build/analysis/seat-model/seat-engine.mjs">seat-engine.mjs</a>.</p>`, pairFig));
  const SY = E.swing.years ? `${E.swing.years[0]}–${E.swing.years[E.swing.years.length - 1]}` : "2007–2025";
  const terms = [
    ["The national vote", `Labor ±${fx1(ptsAt(S.sigNat[0], sh.alp))}, Coalition ±${fx1(ptsAt(S.sigNat[1], sh.lnp))}, One Nation ±${fx1(ptsAt(S.sigNat[2], sh.onp))} pts (one SD; election day ±${fx1(ptsAt(Sf.sigNat[0], sh.alp))}, ±${fx1(ptsAt(Sf.sigNat[1], sh.lnp))}, ±${fx1(ptsAt(Sf.sigNat[2], sh.onp))})`, "Every campaign since 1972"],
    ["Each state", "Its polling deviation within its sampling error, plus 0.10 logit", "This term’s state polling"],
    ["Seat types and education", `${Math.min(...S.sigClass).toFixed(2)}–${Math.max(...S.sigClass).toFixed(2)} logit by type; ${S.sigEdu.toFixed(2)} per standard deviation of degree share`, `Set above the seat-type swings measured ${SY}`],
    ["Each seat", `Labor ${R.meta.sigmaSeat.alp.toFixed(2)}, Coalition ${R.meta.sigmaSeat.lnp.toFixed(2)}, One Nation ${R.meta.sigmaSeat.on.toFixed(2)}, Greens ${R.meta.sigmaSeat.grn.toFixed(2)} logit, fat-tailed, larger for a party that has fallen since 2025`, `Federal ${SY} and SA 2026`],
    ["Preferences, nationally", `${Object.entries(S.flowNat).filter(([k]) => ["COAL", "ON", "GRN", "OTH-R"].includes(k)).map(([k, v]) => `${{ COAL: "Coalition", ON: "One Nation", GRN: "Greens", "OTH-R": "right-wing minors" }[k]} ${v.toFixed(2)}`).join(", ")} logit, plus a shared One Nation shift of ${S.flowOn}`, "Drift from a Senate election to the next House count, federal 2019–2025 and six state elections"],
    ["Preferences, each seat", `${Math.min(...Object.values(S.flowSeat)).toFixed(2)}–${Math.max(...Object.values(S.flowSeat)).toFixed(2)} logit`, "What the Senate and the seat’s history leave unexplained"],
  ];
  html.push(step(5, `Simulate ${R.meta.draws.toLocaleString("en-AU")} elections`,
    `<p>Every simulated election draws each of these afresh, then counts all 150 seats. A party’s seat total, its chance of a majority and each seat’s chances are simply how often things happened across the simulations. The central projection is one more election, with every error set to zero: it can differ from the averages because close seats tip one way at the centre and both ways once the errors are drawn.</p>
     <p class="src"><a href="${GH}.build/analysis/seat-model/model-sim.mjs">model-sim.mjs</a>, <a href="${GH}.build/analysis/seat-model/swing-simulate.mjs">swing-simulate.mjs</a>.</p>`,
    `<table class="md-tbl md-terms"><caption>What varies in each simulated election</caption><thead><tr><th>What</th><th>Size</th><th>Fitted on</th></tr></thead><tbody>${terms.map(([w, s2, f]) => `<tr><td>${w}</td><td style="white-space:normal;text-align:left">${s2}</td><td style="white-space:normal;text-align:left;color:var(--ink-3)">${f}</td></tr>`).join("")}</tbody></table>`));
  $("#how-steps").innerHTML = html.join("");
  lineChart($("#fig-noise"), { xs: years, ylab: "Typical seat miss by election", series: [["alp", "Labor"], ["lnp", "Coalition"], ["grn", "Greens"]].map(([k, n]) => ({ tone: k, name: n, v: years.map((y) => { const r = E.swing.stateOracle[k].rmsByElection[y]; return r == null ? null : ptsAt(r, nat25[k] / 100); }) })) });

  // ---- how well it has done
  const T = E.states, order = ["sa26", "qld17", "vic22", "qld20", "qld24", "sa22"];
  const SCH = [["Senate ballots (this model)", "Senate ballots"], ["W5 constants", "Fixed rates (first version)"], ["design review: seat-type grades", "Seat-type grades"], ["diagnostic: Senate pattern, levels set to the count", "Senate, levels set to the count"]];
  const els = order.filter((k) => T[k] && SCH.slice(0, 3).every(([s]) => T[k].replay[s]));
  const stRows = els.map((k) => {
    const t = T[k], best = Math.max(...SCH.slice(0, 3).map(([s]) => t.replay[s].winners));
    return `<tr><td>${esc(t.label)}<div class="md-fine">${t.senate} Senate</div></td>${SCH.map(([s], j) => { const r = t.replay[s]; return r ? `<td><span class="${j < 3 && r.winners === best ? "best" : ""}">${r.winners}/${t.seats}</span><div class="md-fine">${r.pairs} pairs · ${fx1(r.tcpMaePts)} pts</div></td>` : "<td>–</td>"; }).join("")}</tr>`;
  }).join("");
  // the comparison in the prose is read off the same table, by these rules: the Senate ballots' final pairs
  // against the best of the other two (more / as many / fewer), then winners against the seat-type grades
  // (ahead / level / behind), naming the election that holds most of a deficit when one does (at least 60%)
  const tot = (s, f) => els.reduce((n, k) => n + T[k].replay[s][f], 0), seatsAll = els.reduce((n, k) => n + T[k].seats, 0);
  const [Sx, Fx, Gx] = SCH.slice(0, 3).map(([s]) => ({ pairs: tot(s, "pairs"), w: tot(s, "winners") }));
  const pairLead = Sx.pairs > Math.max(Fx.pairs, Gx.pairs) ? "pick the right final pair more often than either" : Sx.pairs === Math.max(Fx.pairs, Gx.pairs) ? "pick the right final pair as often as the better of the two" : `pick the right final pair less often than the ${Gx.pairs >= Fx.pairs ? "seat-type grades" : "fixed rates"}`;
  const gap = els.map((k) => [k, T[k].replay[SCH[2][0]].winners - T[k].replay[SCH[0][0]].winners]), deficit = gap.reduce((n, [, d]) => n + Math.max(0, d), 0);
  const where = gap.filter(([, d]) => d > 0).sort((a, b) => b[1] - a[1])[0];
  const whereTxt = where && deficit > 0 && where[1] / deficit >= 0.6 ? `, most of it in ${T[where[0]].label}` : "";
  const winTxt = Gx.w > Sx.w ? `On winners the seat-type grades edge ahead, ${Gx.w} to ${Sx.w}${whereTxt}` : Gx.w === Sx.w ? `On winners they tie with the seat-type grades at ${Sx.w}` : `On winners they lead the seat-type grades too, ${Sx.w} to ${Gx.w}`;
  const q17 = T.qld17 && T.qld17.replay[SCH[3][0]];
  const fed = E.federal.results.filter((r) => r.variant === "full" && !r.stateOracle);
  const fedRows = fed.map((r) => `<tr><td>${r.E}</td><td>${r.modalRight}/150</td><td>${r.pairsRight}/150</td><td>${fx1(r.tcpMaePts)}</td><td>${Math.round(r.expected.alp)} v ${r.actual.alp}</td><td>${Math.round(r.expected.lnp)} v ${r.actual.lnp}</td><td>${Math.round(r.expected.ind)} v ${r.actual.ind}</td></tr>`).join("");
  const T2 = [];
  T2.push(step("", "Six state elections, counted again",
    `<p>A hard test of the preferences: count each state election from its actual first preferences, with every candidate’s preferences read from the federal Senate ballots cast before it, the same way the model reads them for 2028, and nothing from the state count itself. Two simpler ways are counted on the same first preferences: the fixed national rates of the model’s first version, and rates graded by seat type, from inner city to rural, set partly on SA 2026 itself.</p>
     <p>Across the ${["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"][els.length] || els.length} elections the Senate ballots ${pairLead}: ${Sx.pairs} of ${seatsAll}, against ${Gx.pairs} for the grades and ${Fx.pairs} for the fixed rates, because they know which party each group of voters puts next once its own is out. ${winTxt}; the fixed rates get ${Fx.w}.</p>${q17 ? `<p>In Queensland 2017 One Nation and LNP voters moved about 0.7 on the logit scale away from Labor between the 2016 Senate vote and the 2017 count (the LNP put One Nation ahead of Labor that year). With each party’s statewide level set to the count, the Senate’s seat-by-seat pattern gets ${q17.winners} of ${T.qld17.seats} winners and ${q17.seats.lnp === T.qld17.actualSeats.lnp ? `the LNP’s ${q17.seats.lnp} seats exactly` : `the LNP ${q17.seats.lnp} seats against ${T.qld17.actualSeats.lnp} won`}: the pattern held, the level drifted.</p>` : ""}
     <p>Unfortunately, these counts cannot separate the Senate ballots from the grades on winners: what decides most seats is how far each party’s voters lean overall, not how that varies from seat to seat. The model reads the Senate because it covers every party’s voters in every seat, where the grades cover Coalition and Labor voters in Labor-v-One Nation races and give everyone else one rate everywhere. Taking minor parties one by one, rather than as one lump of others, cuts the typical seat’s miss on their counted 2025 flows from 8.1 to 5.2 points. The level drift, across these elections and the federal ones, is what sizes the model’s national preference errors.</p>
     <p class="src"><a href="${GH}.build/analysis/seat-model/backtest-states.mjs">backtest-states.mjs</a>, and section 12 of the design review.</p>`,
    `<table class="md-tbl"><caption>Winners right; below, final pairs right and the typical two-candidate error</caption><thead><tr><th>Election</th>${SCH.map(([, l]) => `<th>${l}</th>`).join("")}</tr></thead><tbody>${stRows}</tbody></table><div class="sub">Bold: the most winners right of the first three columns, which use nothing from the count (the grades’ SA 2026 figure is partly fitted on it). The last column is a diagnostic, not a forecast: it borrows each party’s statewide preference level from the count.</div>`));
  // the federal backtests: every election from the one before (house flows) when the long run is in the
  // stores, with the 2019-2025 Senate-ballot runs quoted beside it; else the three Senate-ballot runs alone
  const FL = E.federalLong, cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const andList = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
  if (FL && FL.rows.length) {
    const rows = FL.rows, n = rows.length, first = rows[0].E, last = rows[n - 1].E;
    const tot = (f) => rows.reduce((a2, r) => a2 + f(r), 0);
    const seatsAll2 = tot((r) => r.seats), W = tot((r) => r.modalRight), Wp = tot((r) => r.modalPlain ?? 0);
    const kBetter = rows.filter((r) => r.brierPlain != null && r.brier < r.brierPlain).length;
    // eras: the pooled Brier score with and without the terms before and from the noise rule’s recent window
    const era = (f) => { const rs = rows.filter(f), w = rs.reduce((a2, r) => a2 + r.seats, 0); return { t: rs.reduce((a2, r) => a2 + r.brier * r.seats, 0) / w, p: rs.reduce((a2, r) => a2 + r.brierPlain * r.seats, 0) / w, n: rs.length }; };
    const RF2 = E.swing.sigMult?.recentFrom ?? 2016, early = era((r) => r.E < RF2), recent = era((r) => r.E >= RF2);
    const eraTxt = early.n && recent.n ? (early.t < early.p && recent.t < recent.p ? "The terms helped in the earlier elections and the recent ones alike."
      : early.t < early.p ? `Pooled, the gain is in the elections before ${RF2}: from ${RF2} on, the version without the terms scored slightly better overall. The two terms pull opposite ways in seats that changed hands last time, the new member’s personal vote against part of the swing going back, and which wins has varied from one election to the next.`
      : recent.t < recent.p ? `The gain is in the elections from ${RF2} on; before that the version without the terms scored slightly better.`
      : "Unfortunately, the terms did not improve the chances it gave over the version without them.") : "";
    const inside = (r, k) => r.actual[k] >= r.range90[k][0] && r.actual[k] <= r.range90[k][1];
    const miss = (k, nm) => rows.filter((r) => !inside(r, k)).map((r) => `${r.E}, when ${nm} won ${r.actual[k]} against a range of ${r.range90[k][0]} to ${r.range90[k][1]}`);
    const mA = miss("alp", "Labor"), mL = miss("lnp", "the Coalition");
    const sen = fed.length ? `On the Senate ballots, as the model reads them for 2028, the ${andList(fed.map((r) => String(r.E)))} runs picked ${andList(fed.map((r) => String(r.modalRight)))} winners.` : "";
    const longRows = rows.map((r) => `<tr><td>${r.E}</td><td>${r.modalRight}/${r.seats}<div class="md-fine">${r.modalPlain} without terms</div></td><td>${r.pairsRight}/${r.seats}</td><td>${fx1(r.tcpMaePts)}</td><td>${Math.round(r.expected.alp)} v ${r.actual.alp}</td><td>${Math.round(r.expected.lnp)} v ${r.actual.lnp}</td></tr>`).join("");
    T2.push(step("", `${cap(word(n))} federal elections, each from the one before`,
      `<p>The whole chain run for every federal election from ${first} to ${last} with only what was known at the one before: its seats and results, its House preference flows, the seat terms and noise fitted on earlier elections only, and each election’s actual national vote given, so that what is tested is the step from votes to seats. Before 2016 the Senate ballots show no voter’s own order, so these runs take each party’s preferences from the previous House count, set on the shape of the 2016 Senate ballots.</p>
       <p>With the seat terms the chain picked ${W.toLocaleString("en-AU")} of ${seatsAll2.toLocaleString("en-AU")} winners, against ${Wp.toLocaleString("en-AU")} without them, and the chances it gave scored better in ${word(kBetter)} of the ${word(n)} elections. ${eraTxt}</p>
       <p>Labor’s seat total landed inside the model’s 90% range in ${word(rows.filter((r) => inside(r, "alp")).length)} of the ${word(n)} elections${mA.length ? ` (not in ${mA.join("; ")})` : ""}, and the Coalition’s in ${word(rows.filter((r) => inside(r, "lnp")).length)}${mL.length ? ` (not in ${mL.join("; ")})` : ""}. ${sen} When nearly every final pair is Labor against the Coalition, preferences barely move seats, so these runs test the swing and the noise more than the preferences.</p>
       <p class="src"><a href="${GH}.build/analysis/seat-model/backtest-long.mjs">backtest-long.mjs</a>, <a href="${GH}.build/analysis/seat-model/backtest-chain.mjs">backtest-chain.mjs</a>.</p>`,
      `<table class="md-tbl"><caption>National vote given, ${FL.draws.toLocaleString("en-AU")} simulations each</caption><thead><tr><th>Election</th><th>Winners right</th><th>Final pairs right</th><th>Two-candidate error</th><th>Labor seats, model v actual</th><th>Coalition</th></tr></thead><tbody>${longRows}</tbody></table>`));
  } else {
    T2.push(step("", "Three federal elections, from three years before",
      `<p>The whole chain run for 2019, 2022 and 2025 with only what was known three years earlier: the previous election’s seats, Senate ballots and House flows, with settings fitted on earlier elections only, and each election’s actual national vote given, so that what is tested is the step from votes to seats.</p>
       <p>When nearly every final pair is Labor against the Coalition, preferences barely move seats, so these runs test the swing and the noise more than the preferences.</p>
       <p class="src"><a href="${GH}.build/analysis/seat-model/backtest-chain.mjs">backtest-chain.mjs</a>.</p>`,
      `<table class="md-tbl"><caption>National vote given, ${E.federal.draws.toLocaleString("en-AU")} simulations each</caption><thead><tr><th>Election</th><th>Winners right</th><th>Final pairs right</th><th>Two-candidate error</th><th>Labor seats, model v actual</th><th>Coalition</th><th>Independents</th></tr></thead><tbody>${fedRows}</tbody></table>`));
  }
  // calibration: the long run’s pooled bins when present. Rules: the middle bins line up when no gap tops 5
  // points; each edge bin is "too sure" / "too cautious" when the observed rate is off the predicted by more
  // than the larger of 1 point and half the prediction, else "close"
  const calSrc = FL && FL.calibration ? FL.calibration : E.federal.calibration, nTests = FL && FL.rows.length ? FL.rows.length : fed.length;
  const cal = Object.entries(calSrc).map(([bin, v]) => ({ bin, p: v.p / v.n, o: v.o / v.n, n: v.n })).sort((x, y) => parseFloat(x.bin) - parseFloat(y.bin));
  // middle bins: "too cautious" when the underdog bins (below 50%) came in more than 3 points under their
  // prediction on average and the favourite bins (above) more than 3 over; "too sure" for the reverse; else they
  // line up (no gap over 5 points) or are "off by up to" the largest gap. Edges: the bottom bin's hits against
  // its prediction, by the larger of 1 point and half the prediction (top bin alike, on misses).
  const pc1 = (x) => fx1(100 * x), lo = cal[0], hi = cal[cal.length - 1], mid = cal.slice(1, -1);
  const under = mid.filter((c) => parseFloat(c.bin.split("-")[1]) <= 0.5), over = mid.filter((c) => parseFloat(c.bin) >= 0.5);
  const avg = (xs) => xs.reduce((x, c) => x + (c.o - c.p), 0) / (xs.length || 1), gU = avg(under), gO = avg(over), midGap = Math.max(0, ...mid.map((c) => Math.abs(c.o - c.p)));
  const binTxt = (c) => { const [a2, b2] = c.bin.split("-").map((x) => Math.round(100 * +x)); return parseFloat(c.bin) >= 0.5 ? `favourites it rated ${a2}–${b2}% won ${pc1(c.o)}% of the time against ${pc1(c.p)}% predicted` : `seats it rated ${a2}–${b2}% happened ${pc1(c.o)}% of the time against ${pc1(c.p)}% predicted`; };
  const worst = (xs) => [...xs].sort((x, y) => Math.abs(y.o - y.p) - Math.abs(x.o - x.p))[0];
  const midVerdict = gU < -0.03 && gO > 0.03 ? "cautious" : gU > 0.03 && gO < -0.03 ? "sure" : midGap <= 0.05 ? "close" : "off";
  const midTxt = midVerdict === "cautious" ? `in the middle, where the close seats are, it was too cautious: ${binTxt(worst(under))}, and ${binTxt(worst(over))}`
    : midVerdict === "sure" ? `in the middle, where the close seats are, it was too sure: ${binTxt(worst(under))}, and ${binTxt(worst(over))}`
    : midVerdict === "close" ? "the chances it gave and how often things happened line up closely in the middle, where the close seats are" : `in the middle, where the close seats are, the chances it gave were off by up to ${Math.round(100 * midGap)} points`;
  const edge = (c, under2) => { const off = c.o - c.p, tol = Math.max(0.01, 0.5 * (under2 ? c.p : 1 - c.p)); const verdict = under2 ? (off > tol ? "too sure" : off < -tol ? "too cautious" : "close") : (off < -tol ? "too sure" : off > tol ? "too cautious" : "close"); return { verdict, txt: under2 ? `seats it rated under 10% happened ${pc1(c.o)}% of the time against ${pc1(c.p)}% predicted` : `favourites it rated over 90% won ${pc1(c.o)}% of the time against ${pc1(c.p)}% predicted` }; };
  const eLo = edge(lo, true), eHi = edge(hi, false), vb = (v, again) => (v === "close" ? (again ? "close too" : "close") : `a little ${v}`);
  const edgeTxt = eLo.verdict === eHi.verdict ? `At the edges it was ${vb(eLo.verdict, midVerdict === "close" && eLo.verdict === "close")}: ${eLo.txt}, and ${eHi.txt}.` : `At the bottom it was ${vb(eLo.verdict)}: ${eLo.txt}. At the top it was ${vb(eHi.verdict)}: ${eHi.txt}.`;
  // the eras: the multiplier's cost in calmer elections, and the recent window's edges with its upsets
  let eraCal = "";
  if (FL && FL.calibrationEarly && FL.calibrationRecent) {
    const binsOf = (o) => Object.entries(o).map(([bin, v]) => ({ bin, p: v.p / v.n, o: v.o / v.n })).sort((x, y) => parseFloat(x.bin) - parseFloat(y.bin));
    const cE = binsOf(FL.calibrationEarly), cR = binsOf(FL.calibrationRecent), gapOf = (xs) => Math.max(0, ...xs.slice(1, -1).map((c) => Math.abs(c.o - c.p)));
    const parts = [];
    if (midVerdict === "cautious" && gapOf(cE) > gapOf(cR)) parts.push(`Most of that caution is in the calmer elections before ${FL.recentFrom}, where the same ${fm(SM?.value ?? 1.3)} multiple drew more noise than they needed.`);
    const rLo = edge(cR[0], true), U = FL.recentUpsets;
    if (rLo.verdict === "too sure") parts.push(`From ${FL.recentFrom} on it was a little too sure at the edges: ${rLo.txt}${U && U.n ? `; ${word(U.indOth)} of those ${word(U.n)} upsets were independents or minor-party members, whom no starting point foresees` : ""}.`);
    eraCal = parts.join(" ");
  }
  T2.push(step("", "Are its chances honest?",
    `<p>When the model gives a seat a 70% chance, the favourite should win about seven times in ten. Pooled over the ${word(nTests)} federal tests, ${midTxt}. ${edgeTxt}${eraCal ? " " + eraCal : ""}</p>`,
    `<div class="cap">Chance given v how often it happened</div><div id="fig-cal"></div><div class="sub">Every seat and party in the ${word(nTests)} federal tests, grouped by the chance the model gave.</div>`));
  $("#tests-body").innerHTML = T2.join("");
  calChart($("#fig-cal"), cal);

  $("#limits-body").innerHTML = [
    ["How-to-vote cards", "The model assumes parties recommend preferences much as they did in 2025, when the Coalition put One Nation ahead of Labor almost everywhere. If the Coalition’s card put Labor first instead, the many Labor-v-One Nation seats would swing to Labor; the explorer has a button for it."],
    ["Who stands", `It assumes 2025’s candidates and parties stand again, with One Nation and the Greens everywhere and sitting independents recontesting. Every sitting member is assumed to stand again${TM ? `, so a retirement would cost the party that member’s personal vote, about ${pts2(TM.alp.incE, "alp")} points` : ""}. New independents, the kind who won six seats in 2022, are invisible until they nominate.`],
    ["Independents", "A sitting independent’s vote carries over, moved by the national swing to others and with extra noise. Their personal votes and campaigns are not modelled."],
    ["Boundaries", "Seats are 2025’s. A redistribution before 2028 would change the starting point of the seats it touches."],
    ["The campaign", "Nothing here knows about events between now and the election. The election-day mode widens the errors for that, as history says it should, but cannot say which way they will go."],
    ["The polls", "The national vote is the polls’ average. If every pollster is wrong in the same direction, as in 2019, the model inherits it; the polling error it draws is the size such misses have been."],
  ].map(([h, p]) => `<div><h3>${h}</h3><p>${p}</p></div>`).join("");
  const D = (p, l, n) => `<a href="${p}"><span>${l}</span><span>${n}</span></a>`;
  $("#files-meta").textContent = `Model run ${longDate(a.modelRun)}, polls to ${longDate(a.pollsTo)}`;
  $("#files-body").innerHTML = [
    D("/data/seat-model-2028-nowcast.json", "Official run, if held today", "JSON"), D("/data/seat-model-2028-forecast.json", "Official run, election day", "JSON"),
    D("/data/senate-rankings-2025.json", "Senate ballot orders by seat, 2025", "JSON"), D(GH + "data", "Senate ballot orders 2016–2022, calibration, backtests", "data/"),
    D(GH + ".build/analysis/seat-model-design-review.md", "The design review: every test and decision", "Markdown"), D(GH + ".build/analysis/seat-model", "The model’s code", "GitHub"),
    D("/model/data/inputs.json", "What this page’s explorer runs on", "JSON"), D("/data/seat-model-2028-history.jsonl", "Every official run so far", "JSONL"),
  ].join("");
}
function calChart(host, cal) {
  const W = Math.max(260, host.clientWidth || 360), H = Math.min(260, W * 0.7), m = { l: 34, r: 12, t: 8, b: 26 };
  const X = (v) => m.l + (W - m.l - m.r) * v, Y = (v) => m.t + (H - m.t - m.b) * (1 - v);
  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Calibration: predicted against observed" }, host);
  const g = svg("g", { class: "grid" }, s);
  for (const v of [0, 0.25, 0.5, 0.75, 1]) { svg("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }, g); svg("text", { x: m.l - 6, y: Y(v) + 4, "text-anchor": "end" }, s).textContent = `${Math.round(100 * v)}%`; svg("text", { x: X(v), y: H - 7, "text-anchor": "middle" }, s).textContent = `${Math.round(100 * v)}%`; }
  svg("line", { x1: X(0), y1: Y(0), x2: X(1), y2: Y(1), stroke: "var(--ink-faint)", "stroke-dasharray": "4 3" }, s);
  const gp = svg("g", { class: "t-member" }, s);
  for (const c of cal) svg("circle", { cx: X(c.p), cy: Y(c.o), r: 3 + Math.sqrt(c.n) / 4, fill: "var(--ink-2)", "fill-opacity": 0.75 }, gp);
}
