/* app-5b-vic.js: the Victorian view - its run and inputs load on first use (about 600 KB), the switch
   between the two elections, and the notes on how the Victorian model differs from the federal one.
   Every figure is read from data/seat-model-vic-2026.json and model/data/inputs-vic.json. */
let vicLoad = null;
const ensureVic = () => (vicLoad = vicLoad || Promise.all([getJSON(URLS.vic), getJSON(URLS.inputsVic)]).then(([r, i]) => { STATE.res.vic = r; STATE.vicInputs = i; }));

async function setJur(j, { scroll = false } = {}) {
  j = j === "vic" ? "vic" : "fed";
  if (j === STATE.jur) return;
  if (j === "vic") {
    for (const b of $$(".md-jur [data-jur]")) b.setAttribute("aria-busy", String(b.dataset.jur === "vic"));
    try { await ensureVic(); }
    catch (e) { const n = $("#md-note"); if (n) n.insertAdjacentHTML("beforeend", ` · <span style="color:var(--m-alp)">the Victorian run could not load (${esc(e.message)})</span>`); return; }
    finally { for (const b of $$(".md-jur [data-jur]")) b.removeAttribute("aria-busy"); }
  }
  STATE.jur = j;
  Object.assign(SEATS, { filter: "close", st: null, sort: null, shown: 20, open: new Set() });
  for (const x of $$("[data-f]", $("#seat-filters"))) x.setAttribute("aria-selected", String(x.dataset.f === "close"));
  for (const x of $$("[data-st]")) x.setAttribute("aria-pressed", String(!x.dataset.st));
  renderHead(); renderDist(); renderSeats(); renderJurSections(); EX.onJur();
  writeHash();
  if (scroll) $("#sh-content").scrollIntoView({ block: "start" });
}

function renderJurSections() {
  const vic = STATE.jur === "vic";
  for (const id of ["how", "tests", "limits", "files"]) $(`#${id}`).hidden = vic;
  $("#vic-how").hidden = !vic;
  if (vic && !$("#vic-steps").childElementCount) renderVic();
}

/* The Victorian method notes. Every figure is read from the run and inputs-vic.json's `evidence`; every
   claim of a difference is gated on its own test:
     - the polls' lean to a party is named only where its mean error over the state elections differs from
       zero at under 1 in 20 (a t-test across the elections; the critical value for n - 1 degrees of freedom)
     - the sitting-member terms are quoted with what the fit found, and the parties are pooled because their
       own estimates do not differ significantly (evidence.terms.partyDifference, a bootstrap over districts)
     - lists (cards, departures) are written from the stores, with their zero cases */
const T_CRIT = [0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];
const tCrit = (df) => T_CRIT[Math.min(df, 30)] || 1.96;
const listAnd = (xs) => (xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);
const nWord = (n) => (n >= 0 && n <= 10 ? ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] : String(n));
function renderVic() {
  const I = STATE.vicInputs, R = STATE.res.vic, a = I.asOf, now = I.vote.nowcast, was = I.vote.result2022, S = I.settings.vic, E = I.evidence;
  const days = Math.round((Date.parse(a.election) - Date.parse(a.pollsTo)) / 864e5);
  const P = [["lnp", "lnp", "the Coalition"], ["alp", "alp", "Labor"], ["on", "onp", "One Nation"], ["grn", "grn", "the Greens"], ["oth", "oth", "others"]];
  const byNow = P.slice().sort((x, y) => now[y[0]] - now[x[0]]);
  const sh = (k) => now[k] / 100, sigI = { alp: 0, lnp: 1, on: 2, grn: 3, oth: 4 }, pc0 = (x) => Math.round(100 * x);
  const Cap = (n) => n[0].toUpperCase() + n.slice(1);
  const voteTbl = `<table class="md-tbl"><caption>The vote, 2022 and now, and the polling error the model draws (one standard deviation, in points)</caption><thead><tr><th>Party</th><th>2022</th><th>Now</th><th>Change</th><th>Polling error</th></tr></thead><tbody>${P.map(([k, , n]) => `<tr><td>${Cap(n)}</td><td>${fx1(was[k])}</td><td>${fx1(now[k])}</td><td>${now[k] - was[k] >= 0 ? "+" : "−"}${fx1(Math.abs(now[k] - was[k]))}</td><td>±${fx1(ptsAt(S.sigNat[sigI[k]], sh(k)))}</td></tr>`).join("")}</tbody></table>`;
  const html = [];
  // ---- 1. the polls, and their error at state elections ----
  const PE = E.polls, pe = (k, kk) => fx1(ptsAt(PE.sigma[kk], sh(k))), fe = (k, kk) => fx1(ptsAt(PE.federal[kk], sh(k)));
  const lean = [["alp", "alp", "Labor"], ["lnp", "lnp", "the Coalition"], ["grn", "grn", "the Greens"]].filter(([, kk]) => Math.abs(PE.z[kk]) > tCrit(PE.elections - 1));
  const leanTxt = lean.length ? ` ${lean.map(([k, kk, n]) => `Across those elections the polls ${PE.bias[kk] > 0 ? "understated" : "overstated"} ${n} on average: its vote came in ${PE.bias[kk] > 0 ? "above" : "below"} the final month’s polls in ${PE.bias[kk] > 0 ? PE.above[kk] : PE.elections - PE.above[kk]} of the ${PE.elections}, by an average worth ${fx1(Math.abs(ptsAt(PE.bias[kk], sh(k))))} points at today’s vote, a significant lean (a t-test across the elections, at under 1 in 20).`).join(" ")} The model does not add ${lean.length > 1 ? "these leans" : "this lean"}: ${PE.federalBias && lean.some(([, kk]) => PE.federalBias[kk] * PE.bias[kk] < 0) ? "federal polls have leaned the other way, and " : ""}it draws its errors around the polls as they stand.` : "";
  html.push(step(1, "Start from the Victorian polls",
    `<p>The model starts from the /vic/ page’s polling average, its trend through the ${a.polls} Victorian polls of this term, to ${shortDate(a.pollsTo)}: <b>${byNow.map(([k, , n]) => `${n} ${fx1(now[k])}`).join(", ").replace(/, ([^,]+)$/, " and $1")}</b>. In 2022 Victoria voted Labor ${fx1(was.alp)}, the Coalition ${fx1(was.lnp)}, the Greens ${fx1(was.grn)} and One Nation ${fx1(was.on)}.</p>
     <p>With the election ${days} days after the latest poll, the polls’ error is drawn at the size state polls have shown. At the ${PE.elections} state elections from ${PE.from} to ${PE.to} with a polling record, the final month’s polls missed Labor by ±${pe("alp", "alp")} points at today’s vote, the Coalition by ±${pe("lnp", "lnp")} and the Greens by ±${pe("grn", "grn")}; the federal record gives ±${fe("alp", "alp")}, ±${fe("lnp", "lnp")} and ±${fe("grn", "grn")}, so state polls have been no less accurate than federal ones.${PE.onpLarge ? ` One Nation polled 5% or more at only ${nWord(PE.onpLarge.n)} of them, so its error keeps the federal model’s size.` : ""} The errors are linked and fat-tailed as in the federal model.</p>${leanTxt ? `
     <p>${leanTxt.trim()}</p>` : ""}
     <p class="src"><a href="/vic/">The /vic/ page</a>, <a href="${GH}.build/analysis/seat-model/calibrate-state-polls.mjs">calibrate-state-polls.mjs</a>, <a href="/data/state-election-final-polls.json">the state polling record</a>.</p>`, voteTbl));
  // ---- 2. the districts: who stands, sitting members, noise ----
  const F = E.field, T = E.terms, pf = pairsFigure(I.seats, (k) => k.tcp2022, R, 2022, "On 28 November, on average");
  const src = F.src, newInd = F.independents.all - F.independents.known.length;
  const at35 = (x) => fx1(Math.abs(ptsAt(x, 0.35)));
  const gone = F.members.gone, byP = (p) => gone.filter((g) => g.party === p).length;
  const goneTxt = [[byP("ALP"), "Labor"], [byP("L/N"), "Coalition"], [byP("GRN"), "Greens"], [byP("IND"), "independent"]].filter(([n]) => n).map(([n, w]) => `${n} ${w}`);
  const sameParty = Math.abs(T.partyDifference.rec / T.partyDifference.recSe) < 1.96 && Math.abs(T.partyDifference.ret / T.partyDifference.retSe) < 1.96;
  html.push(step(2, "Spread it across the seats",
    `<p>Each of the 88 seats starts from its 2022 count, on boundaries that stand for 2026, with the candidates the Victorian Electoral Commission declared when nominations closed: <b>${F.candidates} candidates</b>. Each party’s vote then moves by one shift on the logit scale, solved so the statewide totals come out exactly: the rule that predicted One Nation’s SA 2026 vote seat by seat.</p>
     <p>${src["2022"] + (src["same-person"] || 0)} candidates start from their party’s 2022 vote in the seat, or their own. One Nation stood in only five seats in 2022, so in all 88 it starts from its federal 2025 vote at the federal polling places nearest the seat’s own. ${src.council} candidates of minor parties that did not stand in their seat in 2022 start from the party’s upper-house vote there. The other ${src.median} are new: a party new to the ballot starts at the median 2022 minor-party candidate’s ${fx1(100 * F.medianMinor)}%, and an independent at the median 2022 independent’s ${fx1(100 * F.medianIndependent)}%.</p>
     <p>${F.independents.all} independents stand in ${F.independents.districts} seats, and only ${F.independents.known.length} of them stood in the same seat in 2022. Unfortunately, nothing tells the model which of the other ${newInd} is strong. It gives each the spread of 2022’s ${F.independents2022} independents around that ${fx1(100 * F.medianIndependent)}%, wide enough that an independent wins in some simulations without the model naming one${R.national.expectedSeats.member >= 0.05 ? `: ${fx1(R.national.expectedSeats.member)} seats on average` : ""}.</p>
     <p><b>Sitting members.</b> ${F.members.standing} of the 88 sitting members stand again; ${gone.length} do not (${listAnd(goneTxt)}). At four state elections fought on unchanged boundaries (${E.districts.pairs.map((p) => p.label).join(", ").replace(/, ([^,]+)$/, " and $1")}), a member standing again was worth ${at35(T.rec)} points on a 35% vote, and a party whose member had gone lost ${at35(T.ret)}, each measured against seats the party did not hold. ${sameParty ? "Labor’s and the Coalition’s own figures do not differ significantly (a bootstrap over seats), so one pair serves both parties and the Greens." : "Labor’s and the Coalition’s own figures differ, and each party keeps its own."}</p>
     <p>Seats then stray from the rule by the amounts those four elections show, a little more than federal seats do. Labor strays most, because it has fallen furthest since 2022: ${R.meta.sigmaSeat.alp.toFixed(2)} on the logit scale, against ${R.meta.sigmaSeat.lnp.toFixed(2)} for the Coalition.</p>
     <p>In 2022, ${pf.p25["alp v lnp"] || 0} of the 88 counts ended with Labor against the Coalition. On these polls about ${Math.round(pf.p28["alp v lnp"] || 0)} would, and about ${Math.round((pf.p28["alp v on"] || 0) + (pf.p28["lnp v on"] || 0))} would end with One Nation in the final two.</p>
     <p class="src"><a href="/data/vic-candidates-2026.json">The nominations</a>, <a href="${GH}.build/analysis/seat-model/vic-field.mjs">vic-field.mjs</a>, <a href="${GH}.build/analysis/seat-model/calibrate-state-swing.mjs">calibrate-state-swing.mjs</a>.</p>`, pf.html));
  // ---- 3. preferences: Victoria's counts, respondents where there is no count, the cards ----
  const flowRow = (key, label) => { const v = I.seats.filter((s) => s.flows[key] != null); if (!v.length) return ""; const avg = v.reduce((n, s) => n + s.w * s.flows[key], 0) / v.reduce((n, s) => n + s.w, 0), xs = v.map((s) => s.flows[key]); return `<tr><td style="white-space:normal">${label}</td><td>${Math.round(100 * avg)}%</td><td>${Math.round(100 * Math.min(...xs))}–${Math.round(100 * Math.max(...xs))}%</td></tr>`; };
  const v22 = E.vic22.replay, sen = v22["Senate ballots (this model)"], fixed = v22["W5 constants"], grades = v22["design review: seat-type grades"];
  const C = E.calibration, X = E.cells, RSP = E.respondents;
  const cellRow = (k, label) => (X[k] && X[k].respondents != null ? `<tr><td style="white-space:normal">${label}</td><td>${pc0(X[k].federal)}%</td><td>${pc0(X[k].respondents)}%</td><td><b>${pc0(X[k].model)}%</b></td></tr>` : "");
  const cellRows = cellRow("on", "One Nation voters putting Labor ahead of the Coalition") + cellRow("coalOn", "Coalition voters putting Labor ahead of One Nation") + cellRow("grnOn", "Greens voters putting Labor ahead of One Nation") + cellRow("othOn", "Minor-party voters and independents’ voters putting Labor ahead of One Nation");
  const houses = [...new Set(Object.values(X).flatMap((c) => c.respondentPolls || []).map((t) => t.replace(/ \d{4}-\d{2}-\d{2}.*$/, "")))];
  const sF = (E.sens || []).find((x) => x.k === "federal"), sR = (E.sens || []).find((x) => x.k === "respondents");
  const sensTxt = cellRows && sF && sR ? ` The choice moves seats. On the federal readings alone the Coalition would average ${Math.round(sF.expected.lnp)} seats and One Nation ${Math.round(sF.expected.on)}, with a Coalition majority in ${pc0(sF.majority.coalition)}% of simulations; on the respondents alone, ${Math.round(sR.expected.lnp)} and ${Math.round(sR.expected.on)}, and ${pc0(sR.majority.coalition)}%.` : "";
  /* why halfway, from the readings themselves: the first Victorian reading of One Nation's voters against the
     count it followed (matched = within 3 points), and how far the reading has moved since (moved = 3 points
     or more; under that, the two ends agree and the sentence says so) */
  const f1 = RSP.first, on = X.on;
  const whyHalf = !(f1 && on && on.respondents != null) ? "" : (() => {
    const mon = new Date(f1.end + "T00:00:00Z").toLocaleDateString("en-AU", { month: "long", timeZone: "UTC" });
    const matched = Math.abs(f1.on - on.federal) < 0.03, moved = Math.abs(on.respondents - f1.on) >= 0.03;
    const a = ` The first Victorian reading, in ${mon}, put One Nation’s voters at ${pc0(f1.on)}% for Labor, ${matched ? `matching the ${pc0(on.federal)}% counted in Victoria at the 2025 federal election, so respondents are worth hearing` : `against the ${pc0(on.federal)}% counted in Victoria at the 2025 federal election`}.`;
    const b = moved ? ` Since then the reading has ${on.respondents < f1.on ? "fallen" : "risen"} to ${pc0(on.respondents)}%, and no count has yet tested a reading that moved.` : ` The reading has barely moved since (${pc0(on.respondents)}%), so the two ends are close.`;
    return a + b;
  })();
  const CD = E.cards, tl = CD.tally, inList = (xs) => listAnd(xs.map((x) => x.district));
  const openOf = (p) => CD.open.filter((x) => x.party === p), flipOf = (ps) => CD.flip.filter((x) => ps.includes(x.party));
  const labOpen = openOf("Labor"), coalOpen = [...openOf("Liberal"), ...openOf("National")], coalFlip = flipOf(["Liberal", "National"]);
  const cardsTxt = `<p><b>How-to-vote cards.</b> The cards registered with the Commission were read for every seat. They follow the pattern the federal ballots were cast under almost everywhere. Labor’s card puts the Greens, then the Coalition, then One Nation in ${tl.labor.pattern} seats${labOpen.length ? ` and numbers only its own candidate in ${inList(labOpen)}` : ""}. The Liberal or National card puts One Nation ahead of Labor, and Labor ahead of the Greens, in ${tl.coalition.pattern}${coalFlip.length ? `; it puts Labor ahead of One Nation in ${inList(coalFlip)}` : ""}${coalOpen.length ? `, and numbers only its own candidate in ${inList(coalOpen)}` : ""}${CD.missing.length ? ` (none was registered in ${inList(CD.missing)})` : ""}. One Nation’s card puts the Coalition ahead of Labor in ${tl.on.pattern === 88 ? "all 88" : tl.on.pattern}. Where a card departs from the pattern, the model moves that party’s voters by what a card proved to be worth the one time a major party reversed its own: when the Liberal card switched from the Greens to Labor between the 2010 and 2013 federal elections, Coalition voters’ preferences to Labor went from ${pc0(CD.against)}% to ${pc0(CD.with)}% in Melbourne and Batman. A card that now points the other way moves its voters that far, on the logit scale; a card that numbers only its own candidate, half as far.</p>`;
  const pubC = E.published && E.published.coalition, pubO = E.published && E.published.on;
  html.push(step(3, "Order every voter’s preferences",
    `<p>No record of Victorian ballots shows each voter’s whole order, so the model reads the federal Senate’s, as it does federally: for each seat, the 2025 Senate ballots cast at the federal polling places nearest its own, adjusted for how lower-house voters differ from Senate voters.</p>
     <p><b>Where Victoria has a count, the count sets the level.</b> Counted on Victoria’s 2022 primaries, the 2022 Senate ballots read this way would have sent ${pc0(C.grn.senate)}% of the Greens’ preferences and ${pc0(C.oth.senate)}% of minor parties’ and independents’ to Labor over the Coalition; the Commission’s 2022 counts show ${pc0(C.grn.target)}% and ${fx1(100 * C.oth.target)}%. One shift for each group closes that gap and is carried into 2026.</p>
     ${cellRows ? `<p><b>Where it has none, respondents help.</b> Victoria has never counted a choice involving One Nation at anything like this size. For those the model starts from the federal reading and moves halfway, on the logit scale, to what Victorians tell pollsters about their own preferences (${listAnd(houses)}, the waves of the six weeks to ${shortDate(RSP.to)}). Halfway is a judgement.${whyHalf}${sensTxt}</p>` : ""}
     ${cardsTxt}
     <p>At these primaries the model’s preferences give Labor <b>${fx1(100 * E.tppModel)}%</b> of the two-party vote against the Coalition${pubC ? `; the ${pubC.polls} polls publishing a figure since ${shortDate(E.published.from)} range from ${fx1(pubC.lo)} to ${fx1(pubC.hi)}` : ""}. Against One Nation it gives Labor ${fx1(100 * E.tppOnModel)}%${pubO ? ` (${pubO.polls} polls: ${fx1(pubO.lo)} to ${fx1(pubO.hi)})` : ""}.</p>
     <p>Before any Victorian level was set, the Senate reading counted on 2022’s actual primaries picked <b>${sen.winners} of the 88 winners</b> and ${sen.pairs} of the final pairs (the fixed rates of the model’s first version ${fixed.winners}, rates graded by seat type ${grades.winners}); setting the levels from the same count leaves no out-of-sample test of them.</p>
     <p class="src"><a href="${GH}.build/analysis/seat-model/state-tables.mjs">state-tables.mjs</a>, <a href="${GH}.build/analysis/seat-model/vic-inputs.mjs">vic-inputs.mjs</a>, <a href="/data/vic-htv-2026.json">the cards as read</a>, <a href="${GH}.build/analysis/seat-model/backtest-states.mjs">backtest-states.mjs</a>.</p>`,
    `${cellRows ? `<table class="md-tbl"><caption>The levels Victoria has never counted</caption><thead><tr><th>Voters</th><th>Federal reading</th><th>Victorian respondents</th><th>Model</th></tr></thead><tbody>${cellRows}</tbody></table><div class="sub">Federal reading: One Nation’s voters at the 2025 federal count in Victoria; the others from the 2025 Senate ballots. Respondents: ${Object.values(X)[0].respondentPolls.length} waves, weighted by sample.</div>` : ""}
     <table class="md-tbl" style="margin-top:14px"><caption>The preferences the model holds, across the 88 seats</caption><thead><tr><th>Voters</th><th>Average</th><th>Seat range</th></tr></thead><tbody>${flowRow("coalLaborOverOn", "Coalition voters putting Labor ahead of One Nation")}${flowRow("laborCoalitionOverOn", "Labor voters putting the Coalition ahead of One Nation")}${flowRow("onLaborOverCoalition", "One Nation voters putting Labor ahead of the Coalition")}${flowRow("greensLaborOverCoalition", "Greens voters putting Labor ahead of the Coalition")}</tbody></table><div class="sub">After the Victorian levels and the cards; averages weighted by each seat’s 2022 vote. The ranges are widest where a card departs from the pattern.</div>`));
  // ---- 4. the count and the simulation ----
  const chain = E.sa26chain["Senate ballots (this model)"], cen = R.national.central, exp = R.national.expectedSeats;
  const gap = (k) => exp[k] - cen[k], far = ["alp", "lnp", "on"].map((k) => [k, gap(k)]).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))[0];
  const NM = { alp: "Labor", lnp: "the Coalition", on: "One Nation" };
  const cenTxt = Math.abs(far[1]) >= 1.5 ? ` The central projection, one election with every error at zero, gives Labor ${cen.alp}, the Coalition ${cen.lnp} and One Nation ${cen.on}. The averages differ most for ${NM[far[0]]} (${fx1(exp[far[0]])} against ${cen[far[0]]}): ${far[1] > 0 ? "it trails narrowly in many seats at the centre and wins some of them once the errors are drawn" : "it leads narrowly in many seats at the centre and loses some of them once the errors are drawn"}.` : ` The central projection, one election with every error at zero, gives Labor ${cen.alp}, the Coalition ${cen.lnp} and One Nation ${cen.on}, close to the averages.`;
  html.push(step(4, "Count, and simulate",
    `<p>The count and the simulation are the federal model’s: every seat counted as the Commission counts it, from the last candidate up, with each group of voters’ whole order replayed at every exclusion; ${R.meta.draws.toLocaleString("en-AU")} simulated elections, each drawing the polling error, the seat noise, seat-type and education shocks and the preference drift afresh.</p>
     <p>The averages are the forecast.${cenTxt}</p>
     <p>The nearest test of a surge like One Nation’s is SA 2026, where it went from 2.6% to 22.9%. Run the same way from the federal footprint with the statewide totals given, the chain picked the likeliest winner in ${chain.modal} of ${E.sa26.seats} seats.</p>
     <p>The engine and every borrowed setting are set out in full in <a href="#how" data-jur-go="fed">the federal view</a>.</p>`, ""));
  const changed = I.seats.filter((s) => s.won2022 && BUCKET(s.won2022.group) !== BUCKET(s.held.group));
  const medians = (F.src.median || 0);
  $("#vic-steps").innerHTML = html.join("") + `<div class="md-limits">${[
    ["New candidates", `${medians} of the ${F.candidates} candidates have no 2022 vote in their seat, their own or their party’s, and start at a median. The model cannot know which new independent or new party will do far better than that; it only allows for it.`],
    ["Changes since 2022", `The starting vote is the 2022 count. By-elections and departures since change who sits and who stands, which the sitting-member terms use, and nothing else.${changed.length ? ` ${listAnd(changed.map((s) => `${esc(s.name)} (now ${s.held.party === "L/N" ? "Liberal" : s.held.party === "IND" ? "independent" : esc(s.held.party)})`))} changed hands or members’ parties.` : ""} A candidate disendorsed after nominations closed stays on the ballot paper under the party’s name and is counted as its candidate. The cards are those on the Commission’s register on ${shortDate(CD.listed)}.`],
    ["Borrowed pieces", "The engine, the shape of each group’s preferences, the extra noise a falling party carries, and the seat-type and education shocks are the federal model’s, fitted on federal elections and the Senate. No age or gender term: no Victorian baseline poll measures them."],
    ["The upper house", "The Legislative Council is not modelled."],
  ].map(([h, p]) => `<div><h3>${h}</h3><p>${p}</p></div>`).join("")}</div>
  <p class="md-fine" style="margin-top:18px">The run: <a href="/data/seat-model-vic-2026.json">data/seat-model-vic-2026.json</a> · what the explorer runs on: <a href="/model/data/inputs-vic.json">inputs-vic.json</a> · the code: <a href="${GH}.build/analysis/seat-model/vic-simulate.mjs">vic-simulate.mjs</a>, <a href="${GH}.build/analysis/seat-model/vic-inputs.mjs">vic-inputs.mjs</a>.</p>`;
}
