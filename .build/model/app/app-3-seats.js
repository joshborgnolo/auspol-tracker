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
    const open = SEATS.open.has(s.name), h = s.seat.held;
    const flip = s.lead.b !== s.heldB ? `<span class="flip">from ${esc(PARTY[s.heldB].short)}</span>` : "";
    const tr = `<tr class="row" tabindex="0" data-seat="${esc(s.name)}" aria-expanded="${open}">
      <td><span class="nm">${esc(s.name)}</span>${STATE.jur === "vic" ? "" : `<span class="st">${s.state}</span>`}</td>
      <td class="c-held"><span class="held t-${s.heldB}"><span class="dot"></span>${esc(GROUP_NAME[h.group] || (s.heldB === "member" ? "Independent" : h.party))}</span></td>
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
  return `<div class="md-card">
    <div><h4>First preferences</h4><div class="md-prim">${prim}</div><p class="md-fine" style="margin-top:8px">Thin bar: ${Y}${added ? " (One Nation, which did not stand here in 2022: its federal 2025 vote at the nearest polling places)" : ""}. Thick bar and figure: the simulations’ average${vic ? " on 28 November" : STATE.mode === "forecast" ? " on election day" : " now"}.</p></div>
    <div><h4>How often each wins</h4><div class="md-kv">${wins}</div><h4 style="margin-top:14px">The contest it comes down to</h4><div class="md-kv">${pairs}</div></div>
    <div><h4>Preferences here</h4><div class="md-kv">${fl}</div><p class="md-fine" style="margin-top:8px">${vic ? "From the 2025 Senate ballots cast at the federal polling places nearest this district’s own" : "From this seat’s 2025 Senate ballots"}, adjusted to how ${vic ? "lower-house" : "House"} voters differ and mixed for today’s voters. The ${Y} count: ${res25}.${changed}</p></div>
  </div>`;
}
