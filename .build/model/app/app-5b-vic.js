/* app-5b-vic.js: the Victorian view - its run and inputs load on first use (about 500 KB), the switch
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

function renderVic() {
  const I = STATE.vicInputs, R = STATE.res.vic, a = I.asOf, now = I.vote.nowcast, was = I.vote.result2022, S = I.settings.vic, E = I.evidence;
  const days = Math.round((Date.parse(a.election) - Date.parse(a.pollsTo)) / 864e5);
  const P = [["lnp", "lnp", "the Coalition"], ["alp", "alp", "Labor"], ["on", "onp", "One Nation"], ["grn", "grn", "the Greens"], ["oth", null, "others"]];
  const byNow = P.slice().sort((x, y) => now[y[0]] - now[x[0]]);
  const sh = (k) => now[k] / 100, sigI = { alp: 0, lnp: 1, on: 2, grn: 3 };
  const voteTbl = `<table class="md-tbl"><caption>The vote, 2022 and now, and the polling error the model draws (one standard deviation, in points)</caption><thead><tr><th>Party</th><th>2022</th><th>Now</th><th>Change</th><th>Polling error</th></tr></thead><tbody>${P.map(([k, , n]) => `<tr><td>${n[0].toUpperCase() + n.slice(1)}</td><td>${fx1(was[k])}</td><td>${fx1(now[k])}</td><td>${now[k] - was[k] >= 0 ? "+" : "−"}${fx1(Math.abs(now[k] - was[k]))}</td><td>${sigI[k] != null ? "±" + fx1(ptsAt(S.sigNat[sigI[k]], sh(k))) : ""}</td></tr>`).join("")}</tbody></table>`;
  const html = [];
  html.push(step(1, "Start from the Victorian polls",
    `<p>The model starts from the /vic/ page's polling average, its trend through the ${a.polls} Victorian polls of this term, to ${shortDate(a.pollsTo)}: <b>${byNow.map(([k, , n]) => `${n} ${fx1(now[k])}`).join(", ").replace(/, ([^,]+)$/, " and $1")}</b>. In 2022 Victoria voted Labor ${fx1(was.alp)}, the Coalition ${fx1(was.lnp)}, the Greens ${fx1(was.grn)} and One Nation ${fx1(was.on)}.</p>
     <p>With the election ${days} days after the latest poll, the polls' error is drawn at the size seen in the final month of federal campaigns since 1972, linked and fat-tailed as in the federal model. No record of Victorian polls against Victorian results is in the repo to fit a state's own size, and state polls are fewer, so if anything this is too small.</p>
     <p class="src"><a href="/vic/">The /vic/ page</a>, <a href="${GH}.build/analysis/seat-model/vic-inputs.mjs">vic-inputs.mjs</a>.</p>`, voteTbl));
  const pf = pairsFigure(I.seats, (k) => k.tcp2022, R, 2022, "On 28 November, on average");
  html.push(step(2, "Spread it across the districts",
    `<p>Each of the 88 districts starts from its 2022 count, on boundaries that stand for 2026. Each party's vote moves by one shift on the logit scale, solved so the statewide totals come out exactly: the rule that predicted One Nation's SA 2026 vote district by district.</p>
     <p>One Nation stood in only five districts in 2022. In the other ${E.onAdded} it starts from its federal 2025 vote at the federal polling places nearest each district's own, and rises from there with everyone else. Every 2022 candidate's party is assumed to stand again, independents included.</p>
     <p>Districts then stray from the rule by the federal model's fitted amounts. Labor's stray most, because it has fallen furthest since 2022: ${R.meta.sigmaSeat.alp.toFixed(2)} on the logit scale, against ${R.meta.sigmaSeat.lnp.toFixed(2)} for the Coalition.</p>
     <p>In 2022, ${pf.p25["alp v lnp"] || 0} of the 88 counts ended with Labor against the Coalition. On these polls about ${Math.round(pf.p28["alp v lnp"] || 0)} would, and about ${Math.round((pf.p28["alp v on"] || 0) + (pf.p28["lnp v on"] || 0))} would end with One Nation in the final two.</p>`, pf.html));
  const flowRow = (key, label) => { const v = I.seats.filter((s) => s.flows[key] != null); if (!v.length) return ""; const avg = v.reduce((n, s) => n + s.w * s.flows[key], 0) / v.reduce((n, s) => n + s.w, 0), xs = v.map((s) => s.flows[key]); return `<tr><td style="white-space:normal">${label}</td><td>${Math.round(100 * avg)}%</td><td>${Math.round(100 * Math.min(...xs))}–${Math.round(100 * Math.max(...xs))}%</td></tr>`; };
  const v22 = E.vic22.replay, sen = v22["Senate ballots (this model)"], fixed = v22["W5 constants"], grades = v22["design review: seat-type grades"];
  html.push(step(3, "Order every voter's preferences",
    `<p>No record of Victorian ballots shows each voter's whole order, so the model reads the federal Senate's, as it does federally: for each district, the 2025 Senate ballots cast at the federal polling places nearest its own, adjusted for how lower-house voters differ from Senate voters, then mixed for today's voters by the federal vote-switching polls (no Victorian ones are in the repo).</p>
     <p>Read this way from the 2022 Senate ballots and counted on Victoria's actual 2022 first preferences, the preferences gave <b>${sen.winners} of the 88 winners</b> and ${sen.pairs} of the final pairs, with a typical two-candidate error of ${fx1(sen.tcpMaePts)} points. The fixed rates of the model's first version got ${fixed.winners}, rates graded by seat type ${grades.winners}.</p>
     <p class="src"><a href="${GH}.build/analysis/seat-model/state-tables.mjs">state-tables.mjs</a>, <a href="${GH}.build/analysis/seat-model/backtest-states.mjs">backtest-states.mjs</a>.</p>`,
    `<table class="md-tbl"><caption>The preferences the model holds, across the 88 districts</caption><thead><tr><th>Voters</th><th>Average</th><th>District range</th></tr></thead><tbody>${flowRow("coalLaborOverOn", "Coalition voters putting Labor ahead of One Nation")}${flowRow("laborCoalitionOverOn", "Labor voters putting the Coalition ahead of One Nation")}${flowRow("onLaborOverCoalition", "One Nation voters putting Labor ahead of the Coalition")}${flowRow("greensLaborOverCoalition", "Greens voters putting Labor ahead of the Coalition")}</tbody></table><div class="sub">Today's voters, after the mixing; averages weighted by each district's 2022 vote.</div>`));
  const chain = E.sa26chain["Senate ballots (this model)"];
  html.push(step(4, "Count, and simulate",
    `<p>The rest is the federal model unchanged: every district counted as the VEC counts it, from the last candidate up, with each group of voters' whole order replayed at every exclusion; ${R.meta.draws.toLocaleString("en-AU")} simulated elections, each drawing the polling error, the district noise, seat-type and education shocks and the preference drift afresh.</p>
     <p>The nearest test of a surge like One Nation's is SA 2026, where it went from 2.6% to 22.9%. Run the same way from the federal footprint with the statewide totals given, the chain picked the likeliest winner in ${chain.modal} of ${E.sa26.seats} districts.</p>
     <p>The engine and every fitted setting are set out in full in <a href="#how" data-jur-go="fed">the federal view</a>.</p>`, ""));
  const changed = I.seats.filter((s) => s.won2022 && BUCKET(s.won2022.group) !== BUCKET(s.held.group));
  $("#vic-steps").innerHTML = html.join("") + `<div class="md-limits">${[
    ["Who stands", "It assumes every 2022 candidate's party stands again, independents included, with One Nation in every district. The candidates are not read from the nominations."],
    ["Changes since 2022", `The base is the 2022 count. ${changed.length ? `${changed.map((s) => `${esc(s.name)} (now ${s.held.party === "L/N" ? "Liberal" : s.held.party === "IND" ? "independent" : esc(s.held.party)})`).join(", ").replace(/, ([^,]+)$/, " and $1")} changed hands or members since, by by-election or defection; the table shows who holds each district now.` : ""}`],
    ["Borrowed pieces", "Polling error, district noise, the House-v-Senate offsets and today's-voter mixing are the federal model's, fitted on federal elections. No age or gender term: no Victorian baseline poll measures them."],
    ["The upper house", "The Legislative Council is not modelled."],
  ].map(([h, p]) => `<div><h3>${h}</h3><p>${p}</p></div>`).join("")}</div>
  <p class="md-fine" style="margin-top:18px">The run: <a href="/data/seat-model-vic-2026.json">data/seat-model-vic-2026.json</a> · what the explorer runs on: <a href="/model/data/inputs-vic.json">inputs-vic.json</a> · the code: <a href="${GH}.build/analysis/seat-model/vic-simulate.mjs">vic-simulate.mjs</a>, <a href="${GH}.build/analysis/seat-model/vic-inputs.mjs">vic-inputs.mjs</a>.</p>`;
}
