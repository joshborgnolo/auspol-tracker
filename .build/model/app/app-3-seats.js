/* app-3-seats.js: every seat - who wins it how often, the contest it most often comes down to, the
   average two-candidate result in that contest - with a card per seat: first preferences 2025 v the
   simulations' average, every outcome, and the preferences the seat's own Senate ballots give. */
const SEATS = { filter: "close", st: null, q: "", sort: null, shown: 20, open: new Set() };
const FILTERS = [["close", "Closest"], ["flip", "Changing hands"], ["all", "All seats"]];
function seatList() {
  let L = seatsJoined();
  if (SEATS.st && STATE.jur !== "vic") L = L.filter((s) => s.state === SEATS.st);
  const q = SEATS.q.trim().toLowerCase();
  if (q) L = L.filter((s) => s.name.toLowerCase().includes(q) || (s.seat.held.member || "").toLowerCase().includes(q));
  if (SEATS.filter === "flip") L = L.filter((s) => s.lead.b !== s.heldB);
  const sort = SEATS.sort || (SEATS.filter === "all" ? { k: "name", dir: 1 } : { k: "close", dir: 1 });
  const key = { name: (s) => s.name, state: (s) => STATES.indexOf(s.state) * 1000 + s.name.charCodeAt(0), close: (s) => s.lead.p, lead: (s) => -s.lead.p, contest: (s) => s.topPair ? s.topPair.key : "" }[sort.k];
  L.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || (a.name < b.name ? -1 : 1); });
  return L;
}
function pbarHTML(s) {
  return `<span class="pbar" aria-hidden="true">${BUCKETS.filter((b) => (s.byB[b] || 0) > 0.002).map((b) => `<span class="t-${b}" style="width:${(100 * s.byB[b]).toFixed(1)}%"></span>`).join("")}</span>`;
}
function tcpText(s) {
  if (!s.topPair) return "";
  const [a, b] = s.topPair.key.split("|"), sh = s.topPair.share;
  const [w, v] = sh >= 0.5 ? [a, sh] : [b, 1 - sh];
  return `${esc(groupName(w, s.seat))} ${(100 * v).toFixed(1)}`;
}
function renderSeats() {
  const tabs = $("#seat-filters");
  if (!tabs.childElementCount) {
    tabs.innerHTML = FILTERS.map(([k, l]) => `<button type="button" class="rd-tab" role="tab" data-f="${k}" aria-selected="${k === SEATS.filter}"><span class="tw" data-t="${l}">${l}</span></button>`).join("");
    tabs.addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (!b) return; SEATS.filter = b.dataset.f; SEATS.sort = null; SEATS.shown = 20; for (const x of $$("[data-f]", tabs)) x.setAttribute("aria-selected", String(x === b)); renderSeats(); });
    $("#seat-states").innerHTML = [["", "All"], ...STATES.map((s) => [s, s])].map(([k, l]) => `<button type="button" class="md-chip" data-st="${k}" aria-pressed="${(SEATS.st || "") === k}">${l}</button>`).join("");
    $("#seat-states").addEventListener("click", (e) => { const b = e.target.closest("[data-st]"); if (!b) return; SEATS.st = b.dataset.st || null; SEATS.shown = 20; for (const x of $$("[data-st]")) x.setAttribute("aria-pressed", String(x === b)); renderSeats(); });
    $("#seat-q").addEventListener("input", debounce((e) => { SEATS.q = e.target.value; SEATS.shown = 20; renderSeats(); }, 120));
    $("#seat-table").addEventListener("click", (e) => {
      const sb = e.target.closest("th button[data-sort]");
      if (sb) { const k = sb.dataset.sort, cur = SEATS.sort; SEATS.sort = { k, dir: cur && cur.k === k ? -cur.dir : 1 }; renderSeats(); return; }
      const tr = e.target.closest("tr.row"); if (!tr) return;
      const n = tr.dataset.seat; SEATS.open.has(n) ? SEATS.open.delete(n) : SEATS.open.add(n); renderSeats();
    });
    $("#seat-table").addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.matches("tr.row")) { e.preventDefault(); e.target.click(); } });
    $("#seat-more").addEventListener("click", (e) => { if (e.target.closest("[data-more]")) { SEATS.shown = 1e9; renderSeats(); } });
  }
  const L = seatList(), shown = L.slice(0, SEATS.shown), r = run();
  const flips = seatsJoined().filter((s) => s.lead.b !== s.heldB).length, toss = seatsJoined().filter((s) => s.lead.p < 0.6).length, vic = STATE.jur === "vic";
  $("#seat-states").hidden = vic;
  $("#seats-meta").textContent = `${toss} ${vic ? "districts" : "seats"} where no party wins more than six simulations in ten; ${flips} where the likeliest winner is not the party that ${vic ? "holds it now" : "won in 2025"}`;
  const sortBtn = (k, label) => { const cur = SEATS.sort; const on = cur && cur.k === k; return `<button type="button" data-sort="${k}"${on ? ` aria-sort="${cur.dir > 0 ? "ascending" : "descending"}"` : ""}>${label}</button>`; };
  const head = `<thead><tr><th scope="col">${sortBtn("name", "Seat")}</th><th scope="col" class="c-held">${vic ? "Held now" : "Won in 2025"}</th><th scope="col">${sortBtn("lead", "Chance of winning")}</th><th scope="col" class="c-ct">${sortBtn("contest", "Likeliest contest")}</th><th scope="col" class="c-tcp">Average two-candidate</th></tr></thead>`;
  const rows = shown.map((s) => {
    const open = SEATS.open.has(s.name);
    const flip = s.lead.b !== s.heldB ? `<span class="flip">from ${esc(PARTY[s.heldB].short)}</span>` : "";
    const tr = `<tr class="row" tabindex="0" data-seat="${esc(s.name)}" aria-expanded="${open}">
      <td><span class="nm">${esc(s.name)}</span>${STATE.jur === "vic" ? "" : `<span class="st">${s.state}</span>`}</td>
      <td class="c-held"><span class="held t-${s.heldB}"><span class="dot"></span>${esc(heldLabel(s.seat))}</span></td>
      <td><div class="md-chance">${pbarHTML(s)}<span class="lead">${esc(PARTY[s.lead.b].name)} <small>${pctShort(s.lead.p)}</small></span>${flip}</div></td>
      <td class="c-ct"><span class="ct">${s.topPair ? esc(pairName(s.topPair.key, s.seat)) + ` <small>${pctShort(s.topPair.p)}</small>` : ""}</span></td>
      <td class="c-tcp">${tcpText(s)}</td></tr>`;
    return tr + (open ? `<tr class="det"><td colspan="5">${seatCard(s)}</td></tr>` : "");
  }).join("");
  $("#seat-table").innerHTML = head + `<tbody>${rows || `<tr><td colspan="5" class="md-fine">No seat matches.</td></tr>`}</tbody>`;
  $("#seat-more").innerHTML = L.length > shown.length ? `<button type="button" class="md-btn" data-more>Show all ${L.length}</button><span>${shown.length} of ${L.length} shown</span>` : `<span>${L.length} seat${L.length === 1 ? "" : "s"}</span>`;
}
function seatCard(s) {
  const k = s.seat;
  const base = {}; for (const c of k.cands) base[c.group] = (base[c.group] || 0) + c.base;
  const groups = Object.keys(s.primary).sort((a, b) => (s.primary[b] || 0) - (s.primary[a] || 0));
  const top = Math.max(...groups.map((g) => Math.max(s.primary[g] || 0, base[g] || 0)), 0.05);
  const prim = groups.filter((g) => (s.primary[g] || 0) >= 0.005 || (base[g] || 0) >= 0.005).map((g) => `<span class="t-${BUCKET(g)}">${esc(groupName(g, k))}</span><span class="bars t-${BUCKET(g)}"><i style="width:${(100 * (base[g] || 0) / top).toFixed(1)}%"></i><b style="width:${(100 * (s.primary[g] || 0) / top).toFixed(1)}%"></b></span><span class="v">${(100 * (s.primary[g] || 0)).toFixed(1)}</span>`).join("");
  const wins = BUCKETS.filter((b) => (s.byB[b] || 0) >= 0.005).sort((a, b) => s.byB[b] - s.byB[a]).map((b) => `<span>${esc(PARTY[b].name)}</span><b>${pctShort(s.byB[b])}</b>`).join("");
  const pairs = Object.entries(s.finalPairs).filter(([, p]) => p >= 0.01).slice(0, 5).map(([pk, p]) => {
    const [a] = pk.split("|"), sh = s.pairShare[pk];
    return `<span>${esc(pairName(pk, k))} <span class="md-fine">(${esc(groupName(a, k))} ${(100 * sh).toFixed(1)} on average)</span></span><b>${pctShort(p)}</b>`;
  }).join("");
  const f = k.flows || {}, fl = [
    ["Coalition voters putting Labor ahead of One Nation", f.coalLaborOverOn], ["Labor voters putting the Coalition ahead of One Nation", f.laborCoalitionOverOn],
    ["One Nation voters putting Labor ahead of the Coalition", f.onLaborOverCoalition], ["Greens voters putting Labor ahead of the Coalition", f.greensLaborOverCoalition],
  ].filter(([, v]) => v != null).map(([l, v]) => `<span>${l}</span><b>${Math.round(100 * v)}%</b>`).join("");
  const t = k.tcp2025 || k.tcp2022, tot = t ? t[0].votes + t[1].votes : 0, Y = BASE().year, vic = STATE.jur === "vic";
  const res25 = t ? `${esc(t[0].name)} (${esc(t[0].party)}) ${(100 * t[0].votes / tot).toFixed(1)}, ${esc(t[1].name)} (${esc(t[1].party)}) ${(100 * t[1].votes / tot).toFixed(1)}` : "";
  const added = k.cands.some((c) => c.added);
  // a Victorian district whose holder changed since 2022 (a by-election, a defection) says so: the base is the 2022 count
  const changed = vic && k.won2022 && BUCKET(k.won2022.group) !== BUCKET(k.held.group) ? ` Won by ${esc(k.won2022.name)} (${esc(k.won2022.party)}) in 2022; held now by ${esc(k.held.member)} (${k.held.party === "L/N" ? "Liberal" : k.held.party === "IND" ? "independent" : esc(k.held.party)}). The model starts from the 2022 count.` : "";
  return `<div class="md-card">${whyHTML(s)}
    <div><h4>First preferences</h4><div class="md-prim">${prim}</div><p class="md-fine" style="margin-top:8px">Thin bar: ${Y}${added ? " (One Nation, which did not stand here in 2022: its federal 2025 vote at the nearest polling places)" : ""}. Thick bar and figure: the simulations’ average${vic ? " on 28 November" : STATE.mode === "forecast" ? " on election day" : " now"}.</p></div>
    <div><h4>How often each wins</h4><div class="md-kv">${wins}</div><h4 style="margin-top:14px">The contest it comes down to</h4><div class="md-kv">${pairs}</div></div>
    <div><h4>Preferences here</h4><div class="md-kv">${fl}</div><p class="md-fine" style="margin-top:8px">${vic ? "From the 2025 Senate ballots cast at the federal polling places nearest this district’s own" : "From this seat’s 2025 Senate ballots"}, adjusted to how ${vic ? "lower-house voters differ" : "House voters differ, with One Nation’s voters mixed for where they came from"}. The ${Y} count: ${res25}.${changed}</p></div>
  </div>`;
}
/* why a changing-hands seat changes hands: the central projection's margin between the winner's candidate
   and the holder's, split over the model's inputs (.build/model/reasons.mjs, Shapley values: each input's
   average effect over every order the changes could be made in, so they add up to the whole turn), the
   three that move it most toward the winner, the biggest working the other way, and how the count goes */
const ST_NAME = { NSW: "New South Wales", VIC: "Victoria", QLD: "Queensland", WA: "Western Australia", SA: "South Australia", TAS: "Tasmania", ACT: "The ACT", NT: "The Northern Territory" };
const PKEY = (g) => (BUCKET(g) === "member" ? g : BUCKET(g));
const pts = (x) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(1)}`;
const P5_THE = { alp: "Labor", lnp: "the Coalition", on: "One Nation", grn: "the Greens", oth: "others" };
const listPP = (vals) => vals.map((v, i) => [P5[i], v]).filter(([, v]) => Math.abs(v) >= 0.3).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 2).map(([p, v]) => `${P5_THE[p]} ${pts(v)}`).join(", ");
const votersOf = (k, seat) => (String(k).startsWith("member") ? `${groupName(k, seat)}’s voters` : { alp: "Labor voters", lnp: "Coalition voters", on: "One Nation voters", grn: "Greens voters", oth: "Minor-party voters" }[k] || "Other voters");
const cap1 = (t) => t.replace(/^./, (c) => c.toUpperCase());
const poss = (n) => (/s$/.test(n) ? `${n}’` : `${n}’s`);
/* a candidate in running prose: the party (the Liberal, Labor) or the independent's name */
const WHO = { alp: "Labor", lp: "the Liberal", np: "the National", lnp: "the LNP", clp: "the CLP", on: "One Nation", grn: "the Green", oth: "another candidate" };
const whoOf = (g, seat) => esc(WHO[g] || groupName(g, seat));
function whyHTML(s) {
  if (s.lead.b === s.heldB) return "";
  const R = STATE.reasons && STATE.reasons[STATE.jur === "vic" ? "vic" : STATE.mode];
  if (!R) return STATE.reasons === false ? "" : `<div class="md-why"><h4>Why it changes hands</h4><p class="md-fine">Loading…</p></div>`;
  const d = R.seats[s.name]; if (!d) return "";
  const k = s.seat, Y = BASE().year, vic = STATE.jur === "vic", when = STATE.mode === "forecast" && !vic ? "on election day" : "now";
  const S = INP().settings[vic ? "vic" : STATE.mode];
  const W = whoOf(d.w, k), H = whoOf(d.h, k);
  const nat = (i, name) => {
    const a = R.nat25[i], b = R.now[i], key = P5[i];
    const local = key === "oth" ? k.cands.filter((c) => String(c.group).startsWith("member")).map((c) => c.group) : [key];
    const loc = local.filter((g) => d.prim25[g] != null && d.primNow[g] != null).map((g) => `${key === "oth" ? esc(groupName(g, k)) + " " : ""}${d.prim25[g].toFixed(1)} to ${d.primNow[g].toFixed(1)}`).join("; ");
    return `${name.replace("%", vic ? "statewide" : "national")} ${b < a ? "falls" : "rises"} from ${a.toFixed(1)}% in ${Y} to ${b.toFixed(1)}% ${when}${loc ? ` (here ${loc})` : ""}`;
  };
  const adjC = k.cands.filter((c) => Math.abs(c.adj || 0) >= 0.005).sort((a, b) => Math.abs(b.adj) - Math.abs(a.adj)).slice(0, 2);
  const TXT = {
    alp: () => nat(0, "Labor’s % vote"), lnp: () => nat(1, "The Coalition’s % vote"), on: () => nat(2, "One Nation’s % vote"), grn: () => nat(3, "The Greens’ % vote"),
    oth: () => nat(4, k.cands.some((c) => c.isInd) ? "The % vote for other candidates, independents included," : "Other candidates’ % vote"),
    state: () => { const v = S.states && S.states[k.st]; const l = v ? listPP(v.dev) : ""; return `${poss(ST_NAME[k.st] || k.st)} polls against the ${vic ? "statewide" : "national"} swing${l ? `: ${l} points` : ""}`; },
    demo: () => { const l = k.demoPP ? listPP(k.demoPP) : ""; return `The seat’s age and gender mix${l ? `: ${l} points against the average seat` : ""}`; },
    terms: () => `Seat terms: the sitting member’s personal vote, defections and part of ${Y}’s surprise going back${adjC.length ? ` (${adjC.map((c) => `${esc(groupName(c.group, k))} ${c.adj > 0 ? "up" : "down"}`).join(", ")})` : ""}`,
    comp: () => `One Nation’s new voters’ preferences: people who have moved to it since ${Y} keep part of their old party’s preferences`,
  };
  const ph = Object.entries(d.phi).filter(([f]) => TXT[f]);
  const pro = ph.filter(([, v]) => v >= 0.5).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const con = ph.filter(([, v]) => v <= -0.5).sort((a, b) => a[1] - b[1])[0];
  const row = ([f, v], cls) => `<li${cls ? ` class="${cls}"` : ""}><span>${TXT[f]()}</span><b>${pts(v)}</b></li>`;
  // the count in the central projection
  const pw = d.primNow[PKEY(d.w)], phh = d.primNow[PKEY(d.h)];
  let cnt;
  if (d.meet) {
    const fav = (d.prefs || []).find(([, v]) => v > 0), agn = (d.prefs || []).find(([, v]) => v < 0);
    const pv = (x) => `${poss(votersOf(x, k))} preferences`;
    const prefTxt = fav ? `${pv(fav[0])} give ${W} ${fav[1].toFixed(1)} points more than ${H}${agn ? `, while ${votersOf(agn[0], k)} favour ${H} by ${(-agn[1]).toFixed(1)}` : ""}`
      : agn ? `${pv(agn[0])} favour ${H} by ${(-agn[1]).toFixed(1)} points` : "";
    const m = d.mNow, a = 50 + m / 2;
    cnt = `In the central projection ${W} ${pw >= phh ? "leads" : "trails"} ${H} on first preferences, ${pw.toFixed(1)} to ${phh.toFixed(1)}.${prefTxt ? ` ${cap1(prefTxt)}.` : ""} ${m >= 0 ? `${cap1(W)} wins about ${a.toFixed(0)}–${(100 - a).toFixed(0)}` : `${cap1(H)} holds on about ${(100 - a).toFixed(0)}–${a.toFixed(0)}, and ${W} wins more of the simulated elections`}.`;
  } else {
    const O = d.other ? esc(groupName(d.other, k)) : "the other finalist";
    cnt = `In the central projection ${H} (${phh.toFixed(1)} on first preferences) drops out of the count before the end${d.centralW === d.w ? `, and ${W} (${pw.toFixed(1)}) beats ${O}` : `; ${whoOf(d.centralW, k)} wins it there, ${W} in more of the simulated elections`}.`;
  }
  const turn = d.m25 < 0 ? `from ${H} ${Math.abs(d.m25).toFixed(1)} points ahead at ${Y}’s vote` : `from ${W} already ${d.m25.toFixed(1)} ahead at ${Y}’s vote (the model’s count of ${Y}’s vote with this election’s candidates, though ${H} ${vic ? "holds the seat now" : `won the seat in ${Y}`})`;
  const end = d.mNow >= 0 ? `${W} ${d.mNow.toFixed(1)} ahead` : `${H} ${Math.abs(d.mNow).toFixed(1)} ahead`;
  return `<div class="md-why"><h4>Why it changes hands</h4>
    <ol>${pro.map((x) => row(x)).join("")}${con ? row(con, "con") : ""}</ol>
    <p>${cnt}</p>
    <p class="md-fine">The figures are points of the margin between ${W} and ${H}${con ? " (the grey row works the other way)" : ""}, ${turn} to ${end} in the central projection. Each one is that input’s average effect over every order the changes could be made in, so together they add up to the whole turn; the smallest are left out. <a href="${GH}.build/model/reasons.mjs">reasons.mjs</a></p>
  </div>`;
}
