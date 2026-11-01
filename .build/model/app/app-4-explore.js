/* app-4-explore.js: "Try your own numbers" - the reader moves the national vote, the preference levers,
   the uncertainty and (on election day) the fade; a worker (model/js/worker.mjs) re-runs the official
   engine on those settings: the central projection at once, then 1,000 simulated elections. The model
   loads only when the section comes near (about 300 KB) or a shared scenario opens the page. */
const EX = (() => {
  const st = { vote: null, lev: {}, unc: true, pol: 1, seat: 1, flow: 1, fade: null, touched: false };
  const W = { w: null, ready: false, levels: null, busy: false, id: 0, pending: null };
  const DRAWS = 1000;
  const LEV = [
    ["COAL|AO", "Coalition voters, between Labor and One Nation", "to Labor"],
    ["ALP|CO", "Labor voters, between the Coalition and One Nation", "to the Coalition"],
    ["ON|AC", "One Nation voters, between Labor and the Coalition", "to Labor"],
    ["GRN|AC", "Greens voters, between Labor and the others", "to Labor"],
    ["OTH|OA", "Minor-party voters, between One Nation and the majors", "to One Nation"],
  ];
  let built = false;
  const lid = (k) => k.replace("|", "-"); // element ids: "|" is not valid in a selector
  // the aggregate's own printed figures (they need not sum to exactly 100; the engine renormalises)
  const defaults = () => { const n = STATE.inputs.vote.nowcast; st.vote = P5.map((k) => n[k]); };
  const fill = (inp) => { const a = +inp.min, b = +inp.max; inp.style.setProperty("--fill", `${(100 * (+inp.value - a) / (b - a)).toFixed(1)}%`); };
  const levDelta = (k) => { const L = W.levels && W.levels[k]; const pts = st.lev[k] || 0; if (L == null || !pts) return 0; return logit(clamp(L + pts / 100, 0.01, 0.99)) - logit(L); };
  const status = (t) => { const e = $("#ex-status"); if (e) e.textContent = t; };
  const prog = (p) => { const e = $("#ex-prog"); if (e) e.style.width = `${Math.round(100 * p)}%`; };

  function build() {
    if (built) return; built = true;
    defaults();
    const host = $("#ex");
    host.innerHTML = `<div class="md-ctl">
      <div class="md-grp" id="ex-vote"><h3>The national vote <button type="button" data-reset="vote">Back to the polls</button></h3></div>
      <div class="md-grp" id="ex-lev"><h3>How voters order their preferences <button type="button" data-reset="lev">Back to the model</button></h3>
        <div class="md-preset"><button type="button" class="md-btn" data-preset="card">Coalition card puts Labor above One Nation</button></div></div>
      <div class="md-grp" id="ex-unc"><h3>How unsure the model is <button type="button" data-reset="unc">Back to the model</button></h3>
        <label class="md-tog"><input type="checkbox" id="ex-unc-on" checked> Simulate ${DRAWS.toLocaleString("en-AU")} elections with errors</label></div>
      <div class="md-grp" id="ex-fade" hidden><h3>Election day</h3></div>
    </div>
    <div class="md-res" aria-live="polite">
      <div class="md-res-h"><h3 id="ex-title">The official run</h3><span class="md-status" id="ex-status"></span></div>
      <div class="md-prog"><i id="ex-prog"></i></div>
      <div class="md-outcomes" id="ex-out"></div>
      <div class="md-ranges" id="ex-ranges"></div>
      <p class="md-fine" id="ex-central" style="margin-top:12px"></p>
      <div class="md-flips" id="ex-flips"></div>
      <p class="md-share" id="ex-share"></p>
    </div>`;
    const vote = $("#ex-vote");
    P5.forEach((k, i) => vote.insertAdjacentHTML("beforeend", `<div class="md-sl t-${P5_TONE[k]}"><label for="v-${k}"><span class="dot"></span>${P5_NAME[k]}</label><output id="vo-${k}"></output><input type="range" id="v-${k}" min="0" max="50" step="0.1" data-v="${i}"></div>`));
    vote.insertAdjacentHTML("beforeend", `<p class="note">Move one party and the others make room in proportion. The polls' figures are this site's aggregate to ${shortDate(STATE.inputs.asOf.pollsTo)}.</p>`);
    const lev = $("#ex-lev");
    for (const [k, l, unit] of LEV) lev.insertAdjacentHTML("beforeend", `<div class="md-sl"><label for="l-${lid(k)}">${l}</label><output id="lo-${lid(k)}"></output><input type="range" id="l-${lid(k)}" min="-30" max="40" step="1" value="0" data-l="${k}" data-unit="${unit}"></div>`);
    lev.insertAdjacentHTML("beforeend", `<p class="note">Each lever shifts that voter group's choice in every seat by the same amount (on the logit scale), keeping each seat's own leaning. The card button assumes about a third of Coalition voters follow their party's how-to-vote card; switching the card's order moves them, about 35 points.</p>`);
    const unc = $("#ex-unc");
    for (const [k, l] of [["pol", "Polling error"], ["seat", "Seat-to-seat noise"], ["flow", "Preference drift"]]) unc.insertAdjacentHTML("beforeend", `<div class="md-sl"><label for="u-${k}">${l}</label><output id="uo-${k}"></output><input type="range" id="u-${k}" min="0" max="2" step="0.25" value="1" data-u="${k}"></div>`);
    unc.insertAdjacentHTML("beforeend", `<p class="note">1 is the size fitted on past elections; 0 removes that source of error.</p>`);
    $("#ex-fade").insertAdjacentHTML("beforeend", `<label class="md-tog"><input type="checkbox" id="ex-fade-draw" checked> Draw the fade anywhere from 0 to 60%, as the official run does</label><div class="md-sl" style="margin-top:8px"><label for="ex-fade-v">Share of minor parties' rise since 2025 given back</label><output id="ex-fade-o"></output><input type="range" id="ex-fade-v" min="0" max="60" step="5" value="30" disabled></div><p class="note">History: about 0.6 of a minor party's surge since the last election has been gone by polling day, but every case was a small surge.</p>`);
    host.addEventListener("input", onInput);
    host.addEventListener("change", onInput);
    host.addEventListener("click", onClick);
    syncControls(); showOfficial();
  }
  function syncControls() {
    P5.forEach((k, i) => { const inp = $(`#v-${k}`); inp.value = st.vote[i]; fill(inp); $(`#vo-${k}`).textContent = `${st.vote[i].toFixed(1)}%`; });
    for (const [k] of LEV) {
      const inp = $(`#l-${lid(k)}`); inp.value = st.lev[k] || 0; fill(inp);
      const L = W.levels && W.levels[k], pts = st.lev[k] || 0;
      $(`#lo-${lid(k)}`).innerHTML = L == null ? "…" : pts ? `${Math.round(100 * L)}% → <b>${Math.round(100 * clamp(L + pts / 100, 0.01, 0.99))}%</b> <small>${inp.dataset.unit}</small>` : `${Math.round(100 * L)}% <small>${inp.dataset.unit}</small>`;
    }
    for (const k of ["pol", "seat", "flow"]) { const inp = $(`#u-${k}`); inp.value = st[k]; inp.disabled = !st.unc; fill(inp); $(`#uo-${k}`).textContent = `× ${st[k]}`; }
    $("#ex-unc-on").checked = st.unc;
    $("#ex-fade").hidden = STATE.mode !== "forecast";
    const fd = $("#ex-fade-draw"), fv = $("#ex-fade-v");
    fd.checked = st.fade == null; fv.disabled = st.fade == null; if (st.fade != null) fv.value = st.fade; fill(fv);
    $("#ex-fade-o").textContent = st.fade == null ? "0–60%" : `${st.fade}%`;
  }
  function onInput(e) {
    const t = e.target;
    if (t.dataset.v != null) {
      const i = +t.dataset.v, v = clamp(+t.value, 0, 60), rest = 100 - v, others = st.vote.reduce((a, x, j) => a + (j === i ? 0 : x), 0);
      st.vote = st.vote.map((x, j) => (j === i ? v : others > 0 ? x * rest / others : rest / 4));
    } else if (t.dataset.l) st.lev[t.dataset.l] = +t.value;
    else if (t.dataset.u) st[t.dataset.u] = +t.value;
    else if (t.id === "ex-unc-on") st.unc = t.checked;
    else if (t.id === "ex-fade-draw") st.fade = t.checked ? null : +$("#ex-fade-v").value;
    else if (t.id === "ex-fade-v") st.fade = +t.value;
    else return;
    st.touched = true; syncControls(); schedule();
  }
  function onClick(e) {
    const r = e.target.closest("[data-reset]"), p = e.target.closest("[data-preset]");
    if (r) {
      if (r.dataset.reset === "vote") defaults();
      if (r.dataset.reset === "lev") st.lev = {};
      if (r.dataset.reset === "unc") Object.assign(st, { unc: true, pol: 1, seat: 1, flow: 1 });
      st.touched = !isOfficial(); syncControls(); st.touched ? schedule() : showOfficial(); writeHash();
    }
    if (p && p.dataset.preset === "card") { const L = W.levels && W.levels["COAL|AO"]; st.lev["COAL|AO"] = L == null ? 35 : Math.min(35, Math.round(95 - 100 * L)); st.touched = true; syncControls(); schedule(); }
    if (e.target.closest("[data-copy]")) { navigator.clipboard && navigator.clipboard.writeText(location.href); e.target.textContent = "Link copied"; }
  }
  const voteIsPolls = () => { const n = STATE.inputs.vote.nowcast; return st.vote.every((x, i) => Math.abs(x - n[P5[i]]) < 0.051); };
  const isOfficial = () => voteIsPolls() && !Object.values(st.lev).some((v) => v) && st.unc && st.pol === 1 && st.seat === 1 && st.flow === 1 && st.fade == null;
  const schedule = debounce(() => { writeHash(); runJob(); }, 220);
  function job() {
    const tot = st.vote.reduce((a, b) => a + b, 0);
    const levers = {}; for (const [k] of LEV) { const d = levDelta(k); if (d) levers[k] = d; }
    return { type: "run", mode: STATE.mode, now5: st.vote.map((x) => x / tot), levers: Object.keys(levers).length ? levers : null,
      uncertainty: st.unc, polErrMult: st.pol, seatNoiseMult: st.seat, flowNoiseMult: st.flow,
      fade: STATE.mode === "forecast" ? (st.fade == null ? null : { fixed: st.fade / 100 }) : null, draws: DRAWS, seed: 20261101 };
  }
  function start() {
    if (W.w) return;
    try { W.w = new Worker(URLS.worker, { type: "module" }); }
    catch (err) { status("This browser cannot run the model here."); return; }
    W.ready = false; W.busy = false;
    W.w.onmessage = onMsg;
    W.w.onerror = (e) => status("The model could not start in this browser" + (e.message ? `: ${e.message}` : "") + ".");
    W.w.postMessage({ type: "init", inputsUrl: URLS.inputs, senateUrl: URLS.senate });
    if (!W.levels) status("Loading the model (about 300 KB)…");
  }
  function runJob() {
    if (isOfficial()) { st.touched = false; showOfficial(); return; }
    const j = job(); j.id = ++W.id;
    if (W.w && W.busy) { W.w.terminate(); W.w = null; }
    if (!W.w) start();
    if (!W.ready) { W.pending = j; return; }
    send(j);
  }
  function send(j) { W.busy = j.uncertainty; prog(0); status(j.uncertainty ? "Simulating…" : "Projecting…"); W.w.postMessage(j); }
  function onMsg(e) {
    const m = e.data;
    if (m.type === "ready") {
      W.ready = true; W.levels = m.levels; syncControls();
      if (W.pending) { const j = W.pending; W.pending = null; if (!j.levers && Object.values(st.lev).some((v) => v)) Object.assign(j, { levers: job().levers }); send(j); }
      else if (!st.touched) status("");
      return;
    }
    if (m.id !== W.id) return;
    if (m.type === "central") { showCentral(m.result); if (!st.unc) { status("Central projection, no errors"); prog(1); W.busy = false; } }
    else if (m.type === "progress") { prog(m.p); status(`Simulating… ${Math.round(100 * m.p)}%`); }
    else if (m.type === "result") { W.busy = false; prog(1); showResult(m.result); }
    else if (m.type === "error") { W.busy = false; status("Something went wrong: " + m.message); }
  }
  function centralLine(c, label) {
    const order = ["alp", "on", "lnp", "grn", "member"].sort((a, b) => c[b] - c[a]);
    return `${label}: ${order.map((k) => `${PARTY[k].name} ${c[k]}`).join(" · ")}.`;
  }
  function showOfficial() {
    const r = run();
    $("#ex-title").textContent = "The official run";
    status(`${r.meta.draws.toLocaleString("en-AU")} simulated elections · change a setting to re-run`); prog(0);
    $("#ex-out").innerHTML = outcomesHTML(r);
    $("#ex-ranges").innerHTML = rangesHTML(r, { labels: false });
    $("#ex-central").textContent = centralLine(r.national.central, "The central projection, with no errors at all");
    $("#ex-flips").innerHTML = ""; $("#ex-share").innerHTML = "";
  }
  let lastCentral = null;
  function showCentral(c) {
    lastCentral = c;
    $("#ex-title").textContent = "Your scenario";
    $("#ex-central").textContent = centralLine(c.seats, "Central projection, with no errors at all");
    const off = run().seats, flips = [];
    c.perSeat.forEach((p, i) => { const a = BUCKET(off[i].central.w), b = BUCKET(p.w); if (a !== b) flips.push([p.name, a, b]); });
    $("#ex-flips").innerHTML = flips.length
      ? `<h4>${flips.length} seat${flips.length === 1 ? "" : "s"} change hands in the central projection against the official run</h4><ul>${flips.slice(0, 40).map(([n, a, b]) => `<li><span class="dot t-${b}"></span>${esc(n)} <span class="arr">${PARTY[a].short} → ${PARTY[b].short}</span></li>`).join("")}${flips.length > 40 ? `<li>and ${flips.length - 40} more</li>` : ""}</ul>`
      : `<h4>No seat changes hands in the central projection against the official run</h4>`;
    if (!st.unc) {
      // no errors: one election, so each party's range collapses onto its central figure
      const s = c.seats, top = ["alp", "on", "lnp"].sort((a, b) => s[b] - s[a])[0];
      const pseudo = { meta: { draws: 1 }, national: {
        expectedSeats: s, seatDistribution: Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { p05: v, p25: v, p50: v, p75: v, p95: v }])),
        mostSeats: { alp: 0, on: 0, lnp: 0, [top]: 1 },
        majority: { alp: top === "alp" && s.alp >= 76 ? 1 : 0, coalition: top === "lnp" && s.lnp >= 76 ? 1 : 0, on: top === "on" && s.on >= 76 ? 1 : 0, noMajority: s[top] >= 76 ? 0 : 1 } } };
      $("#ex-out").innerHTML = outcomesHTML(pseudo);
      $("#ex-ranges").innerHTML = rangesHTML(pseudo, { compare: run(), labels: false });
    }
    $("#ex-share").innerHTML = `This scenario is in the address bar. <button type="button" class="md-btn" data-copy>Copy the link</button>`;
  }
  function showResult(res) {
    const wrapped = { national: res, meta: { draws: res.draws } };
    status(`${res.draws.toLocaleString("en-AU")} simulated elections on your settings`);
    $("#ex-out").innerHTML = outcomesHTML(wrapped);
    $("#ex-ranges").innerHTML = rangesHTML(wrapped, { compare: run(), labels: false });
  }
  function onMode() {
    if (!built) return;
    if (!st.touched) { defaults(); syncControls(); showOfficial(); return; }
    syncControls(); schedule();
  }
  function hashParts() {
    if (!st.touched) return [];
    const p = voteIsPolls() ? [] : [`vote=${st.vote.map((x) => x.toFixed(1)).join(",")}`];
    const l = Object.entries(st.lev).filter(([, v]) => v).map(([k, v]) => `${k.replace("|", ".")}:${v}`);
    if (l.length) p.push(`lev=${l.join(",")}`);
    if (!st.unc) p.push("unc=0");
    for (const k of ["pol", "seat", "flow"]) if (st[k] !== 1) p.push(`${k}=${st[k]}`);
    if (st.fade != null) p.push(`fade=${st.fade}`);
    return p;
  }
  function applyHash(q) {
    if (!q.vote && !q.lev && !q.unc && !q.pol && !q.seat && !q.flow && !q.fade) return false;
    build();
    if (q.vote) { const v = q.vote.split(",").map(Number); if (v.length === 5 && v.every((x) => x >= 0)) { const t = v.reduce((a, b) => a + b, 0); st.vote = v.map((x) => 100 * x / t); } }
    if (q.lev) for (const it of q.lev.split(",")) { const [k, v] = it.split(":"); const key = k.replace(".", "|"); if (LEV.some(([x]) => x === key)) st.lev[key] = clamp(+v || 0, -30, 40); }
    if (q.unc === "0") st.unc = false;
    for (const k of ["pol", "seat", "flow"]) if (q[k] != null) st[k] = clamp(+q[k] || 0, 0, 2);
    if (q.fade != null) st.fade = clamp(+q.fade || 0, 0, 60);
    st.touched = true; syncControls(); start(); runJob();
    return true;
  }
  function init() {
    const sec = $("#explore");
    const go = () => { build(); start(); };
    if ("IntersectionObserver" in window) { const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: "600px 0px" }); io.observe(sec); }
    else go();
  }
  return { init, onMode, applyHash, hashParts, state: st };
})();
function readHash() { const q = {}; for (const kv of location.hash.replace(/^#/, "").split("&")) { const [k, v] = kv.split("="); if (k && v != null) q[k] = decodeURIComponent(v); } return q; }
function writeHash() {
  const parts = [];
  if (STATE.mode === "forecast") parts.push("mode=forecast");
  parts.push(...EX.hashParts());
  const h = parts.length ? "#" + parts.join("&") : "";
  if (location.hash.replace(/^#/, "") === h.replace(/^#/, "")) return;
  if (!h && /^#(how|tests|limits|files|seats|explore|chances)$/.test(location.hash)) return;
  history.replaceState(null, "", h || location.pathname + location.search);
}
