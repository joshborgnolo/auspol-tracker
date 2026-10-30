/* =============================== lens words =============================== */
function lensShort() {
  switch (S.lens) {
    case "winner": return isNow() ? "Held by" : "Winner";
    case "tpp": return S.tppMode === "swing" ? "Swing to Labor" : "Labor 2PP";
    case "fp": return S.fpMode === "change" ? `${famLeg(S.party)} change` : `${famLeg(S.party)} primary`;
    case "senate": return senGap() ? `${famLeg(S.party)}, Senate v House` : `${famLeg(S.party)} Senate vote`;
    case "flow": return `${famLeg(S.from)} to Labor`;
    case "informal": return infModeOf(M()) === "exhaust" ? "Exhausted ballots" : "Informal";
    case "cls": return "Seat type";
    case "seifa": return isDemo() ? (isRel() ? `Religion: ${REL_NAME[S.rel]}` : isTen() ? TEN_NAME[S.ten] : DM_SHORT[S.index]) : `${IX_ABBR[S.index]} decile`;
  }
  return "";
}
/* the lens as a list-table column head: every party coded, all of one register */
function lensHead() {
  switch (S.lens) {
    case "fp": return S.fpMode === "change" ? `${FAM_CODE[S.party]} change` : `${FAM_CODE[S.party]} primary`;
    case "senate": return senGap() ? `${FAM_CODE[S.party]} gap` : `${FAM_CODE[S.party]} Senate`;
    case "flow": return `${FAM_CODE[S.from]} to Labor`;
    default: return lensShort();
  }
}
function valueText(v, kind, ctx) {
  if (v == null) {
    switch (S.lens) {
      case "senate": return ctx ? senNoValue(ctx.m, kind, ctx.d) : "No Senate count here";
      case "tpp": return S.tppMode === "swing" ? (kind === "booth" ? "New place, so no swing" : "No swing recorded") : "No Labor v Coalition count";
      case "flow": return "Final two weren’t Labor and the Coalition";
      case "seifa": return isDemo() ? (S.year !== "now" && S.year < DEMO_FROM ? "Counted from 1993 on" : "No census figure here") : "No score here";
      case "fp": return S.fpMode === "change" ? "Didn’t stand both times" : "Didn’t stand";
      default: return "No data";
    }
  }
  switch (S.lens) {
    case "winner": return kind === "booth" ? `${FAM_NAME[v]} led here` : FAM_NAME[v];
    case "tpp": return S.tppMode === "swing" ? (Math.abs(v) < 0.05 ? "No swing" : `${f1(Math.abs(v))} swing to ${v > 0 ? "Labor" : "the Coalition"}`) : `Labor ${f1(v)} · Coalition ${f1(100 - v)}`;
    case "fp": return S.fpMode === "change" ? `${famLeg(S.party)} ${sgn(v)} points` : `${famLeg(S.party)} ${f1(v)}%`;
    case "senate": return senGap() ? `${famLeg(S.party)} ${Math.abs(v) < 0.05 ? "level" : `${pts(v)} ${v > 0 ? "higher" : "lower"}`} in the Senate` : `${famLeg(S.party)} ${f1(v)}% in the Senate`;
    case "flow": return `${f0(v)}% of ${famLeg(S.from)} preferences to Labor`;
    case "informal": return infModeOf(M()) === "exhaust" ? `${f1(v)}% exhausted` : `${f1(v)}% informal`;
    case "cls": return CLS_SHORT[v] || v;
    case "seifa": return isDemo() ? `${f1(v)}% ${dmVerb(M(), S.index)}` : `Decile ${v} of 10`;
  }
  return "";
}

/* =============================== the lens tabs =============================== */
// the search box promises as much as its width can show, never clipped mid-word
let phCtx = null;
function fitSearchPlaceholder() {
  const input = $("#q"), sen = S.view === "chamber" && S.house === "senate";
  const list = sen ? ["Search a senator or state", "Search a senator", "Search"] : ["Search a seat, member or place", "Search a seat or member", "Search"];
  if (!phCtx) phCtx = document.createElement("canvas").getContext("2d");
  const cs = getComputedStyle(input);
  phCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const room = input.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) - 4;
  for (const t of list) if (phCtx.measureText(t).width <= room) { input.placeholder = t; return; }
  input.placeholder = "Search";
}
// a lens row with chips off the far edge flags itself: the fade asks to be scrolled
const lensRowEl = $(".mp-lensrow");
function lensOverflow() {
  const el = $("#lenses"); if (!el || !lensRowEl) return;
  lensRowEl.classList.toggle("more", el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
}
// the House's lenses, or in the Senate's chamber the Senate's own
function renderLenses() {
  const sen = S.view === "chamber" && S.house === "senate";
  const list = sen ? SEN_LENSES : yearLenses(S.year), cur = sen ? S.senLens : S.lens, attr = sen ? "data-slens" : "data-lens";
  $("#lenses").innerHTML = list.map((l) => `<button type="button" class="rd-tab" role="tab" ${attr}="${l.id}" aria-selected="${cur === l.id}"><span class="tw" data-t="${l.label}">${l.label}</span></button>`).join("");
  $("#lenses").setAttribute("aria-label", sen ? "Colour the senators by" : "Colour the seats by");
  $("#lenses").addEventListener("scroll", lensOverflow, { passive: true });
  lensOverflow();
  fitSearchPlaceholder();
}

/* =============================== the legend =============================== */
let legendKey = "";
// (boothsAs: the key's measure asks for one side or the other, below)
let boothsAs = null;
const boothsShown = () => boothsAs ?? (S.view === "map" && (selDiv() != null || T.k >= K_ALL));
const legendState = () => [S.view, boothsShown(), S.lens, S.tppMode, S.fpMode, S.senMode, S.infMode, S.party, S.from, S.vs, S.index, S.basis, S.year, S.seat, S.house, S.senLens, TH && TH.dark].join("|");
function legendIfChanged() { if (legendState() !== legendKey) renderLegend(); }
const RANGE = () => {
  switch (S.lens) {
    case "tpp": return S.tppMode === "swing" ? [-10, 10] : [30, 70];
    case "fp": return S.fpMode === "change" ? [-15, 15] : [0, FPMAX[S.party]];
    case "senate": return senGap() ? [-10, 10] : [0, FPMAX[S.party]];
    case "flow": return [10, 90];
    case "informal": return [0, infHi(M())];
    case "seifa": return isDemo() ? demoRange() : [1, 10];
  }
  return null;
};
function legendHist(m, lo, hi) {
  const vals = m.divs.map((d) => divValue(m, d.i)).filter((v) => v != null);
  // a stand-in year (holdLegendHeight) keeps the bars' room even where the loaded year has no values
  // (the Senate lens before its votes load, or in a year without them, holds the bars' room too)
  if (vals.length < 10) return m.standIn || S.lens === "senate" ? '<div class="lg-hist" aria-hidden="true"></div>' : "";
  const dec = S.lens === "seifa" && !isDemo();
  const n = dec ? 10 : 20, w = (hi - lo) / n, counts = new Array(n).fill(0);
  for (const v of vals) counts[clamp(Math.floor((v - lo) / w + (dec ? 0.5 : 0)), 0, n - 1)]++;
  const max = Math.max(...counts);
  return `<div class="lg-hist" aria-hidden="true">${counts.map((c, k) => `<i style="height:${(100 * c) / max}%;background:${colCss(colorOf(lo + (k + 0.5) * w))}"></i>`).join("")}</div>`;
}
function renderLegend() {
  legendKey = legendState();
  const el = $("#legend"), m = M();
  if (!m || S.view === "list") { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = senOn() ? senateLegendHTML(SENM) : legendHTML(m);
  holdLegendHeight(m);
}
/* the key holds the height of the CURRENT lens at its tallest election, so stepping
   through the years never moves the figure (the stage below it on a wide screen, the
   timeline below it on a phone); switching lens or flip re-holds it once, which reads
   as the key's own change. A year not loaded yet is measured on a stand-in: the loaded
   year's figures with that year's own words (its seat counts, seating-plan note,
   census basis) */
const legendHeights = new Map();
const SEAT_META = new Map(); // year -> the seating plan's { plan, note }
let legendMeta = null;
function loadLegendMeta() {
  return (legendMeta ??= Promise.all([
    SUM ? null : getJSON("/map/data/summary.json").then((s) => { SUM = s; renderTimeline(); }),
    // today's Senate's senators (not its floor): its key, the tallest the Senate's gets (it alone has a seating
    // plan's row), is measured with the House's, so switching chamber moves nothing
    loadSenate("now"),
    ...[...SEATED].map((y) => getJSON(`/map/data/seats-${y}.json`).then((j) => SEAT_META.set(y, { plan: j.plan, note: j.note }))),
  ].map((p) => p && p.catch(() => {}))).then(() => { legendHeights.clear(); if (M()) renderLegend(); })); // a measure taken before the words were in is dropped
}
function legendStandIn(m, y) {
  if (Y[y] && Y[y].search) return Y[y];
  const st = Object.create(m);
  st.year = y; st.standIn = true;
  st.seating = SEATED.has(y) ? SEAT_META.get(y) || null : null;
  st.demoBasis = STATE_YEARS.has(y) ? "sa1" : y === 2013 ? "venue" : null;
  const c = S.lens === "winner" && SUM && SUM.seats[y] && SUM.seats[y].AUS;
  if (c) st.divs = Object.entries(c).flatMap(([fam, n]) => Array.from({ length: n }, () => ({ hold: { fam } })));
  return st;
}
function legendHeightOf(m, y, w, probe) {
  const real = !!(Y[y] && Y[y].search);
  // the hold is per lens and mode: stepping through the years reuses the tallest
  // measure of the CURRENT key, so the figure never moves; switching the lens (or
  // its flip) re-holds it once, which reads as the key's own change. On the map
  // it holds the taller of its two faces, seats and polling places, so zooming in
  // to the places (or out of them) never moves the stage under the reader
  const key = [w, S.view, y, real, S.lens, S.tppMode, S.fpMode, S.senMode, S.infMode, S.index, S.cob, S.basis, S.seat].join("|");
  if (!legendHeights.has(key)) {
    const keep = { seat: S.seat, year: S.year };
    let hMax = 0;
    try {
      S.year = y;
      const my = legendStandIn(m, y);
      for (const seat of S.view === "chamber" && my.seating ? ["plan", "sort"] : [keep.seat]) {
        S.seat = seat;
        for (const bo of S.view === "map" ? [false, true] : [false]) {
          boothsAs = bo;
          probe.innerHTML = legendHTML(my);
          hMax = Math.max(hMax, probe.getBoundingClientRect().height);
        }
      }
    } finally { Object.assign(S, keep); boothsAs = null; }
    legendHeights.set(key, Math.ceil(hMax));
  }
  return legendHeights.get(key);
}
function holdLegendHeight(m) {
  const el = $("#legend"), w = el.clientWidth;
  if (!w) return;
  const probe = el.cloneNode(false);
  probe.removeAttribute("id"); probe.removeAttribute("hidden");
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;width:${w}px;min-height:0`;
  el.parentNode.appendChild(probe);
  let h = 0;
  try {
    for (const y of YEARS) h = Math.max(h, legendHeightOf(m, y, w, probe));
    // the Senate chamber walks its Senates with the timeline: every loaded one's
    // current-lens key joins the hold, so the switch between Senates stays quiet
    if (S.view === "chamber") for (const sm of new Set([...Object.values(SENY), SENM])) if (sm) h = Math.max(h, senLegendHeight(sm, w, probe));
  } finally { probe.remove(); }
  el.style.minHeight = h + "px";
  el.style.boxSizing = "border-box";
}
// the Senate's key, current lens, as seated and sorted
function senLegendHeight(sm, w, probe) {
  const key = `senate|${sm.year}|${w}|${S.senLens}|${S.seat}`;
  if (!legendHeights.has(key)) {
    const keep = { seat: S.seat };
    let hMax = 0;
    try {
      for (const seat of ["plan", "sort"]) {
        S.seat = seat;
        probe.innerHTML = senateLegendHTML(sm);
        hMax = Math.max(hMax, probe.getBoundingClientRect().height);
      }
    } finally { Object.assign(S, keep); }
    legendHeights.set(key, Math.ceil(hMax));
  }
  return legendHeights.get(key);
}
/* the census pickers: the ABS's advantage indexes, then the people measures,
   then the active lane's own option picker. The legend lays each line out in
   its own .lg-t block on the map and chamber; the list bar lays the same
   selects out bare in its row (the legend is hidden in the list view) */
function censusSelects(m, cls = "") {
  const c = cls ? ` class="${cls}"` : "";
  const og = (label, list) => `<optgroup label="${label}">${list.map(([v, t]) => `<option value="${v}"${S.index === v ? " selected" : ""}>${t}</option>`).join("")}</optgroup>`;
  const peopleExtra = [
    ...(m.relKeys && m.relKeys.length ? [[LENS_REL, "Religion"]] : []),
    ...(m.tenKeys && m.tenKeys.length ? [[LENS_TEN, "Housing tenure"]] : []),
    ...(m.ancKeys && m.ancKeys.length ? [[LENS_ANC, "Ancestry"]] : []),
  ];
  const out = [`<select${c} data-opt="index" aria-label="Census measure">${og("Advantage, ABS SEIFA", IX.map((x) => [x, `${IX_NAME[x]} (${IX_ABBR[x]})`]))}${og("People", [...dmFor(m).map((x) => [x, DM_NAME[x]]), ...peopleExtra])}</select>`];
  if (isDemo()) {
    // on Born overseas a second picker reads a birthplace country per year
    // (the year's own census-edition menu; the informal lens's own
    // measure-switcher idiom)
    if (S.index === "fborn" && m.cobKeys && m.cobKeys.length) out.push(`<select${c} data-opt="cob" aria-label="Birthplace country"><option value=""${!S.cob ? " selected" : ""}>All overseas-born</option>${m.cobKeys.map((k) => `<option value="${k}"${S.cob === k ? " selected" : ""}>Born in ${COB_BORN[k]}</option>`).join("")}</select>`);
    // the Religion and Housing-tenure lenses' own option pickers
    // (No religion and owned-with-mortgage are the landing views)
    if (S.index === LENS_REL && m.relKeys && m.relKeys.length) out.push(`<select${c} data-opt="rel" aria-label="Religion">${m.relKeys.map((k) => `<option value="${k}"${S.rel === k ? " selected" : ""}>${REL_NAME[k]}</option>`).join("")}</select>`);
    if (S.index === LENS_TEN && m.tenKeys && m.tenKeys.length) out.push(`<select${c} data-opt="ten" aria-label="Housing tenure">${m.tenKeys.map((k) => `<option value="${k}"${S.ten === k ? " selected" : ""}>${TEN_NAME[k]}</option>`).join("")}</select>`);
    if (S.index === LENS_ANC && m.ancKeys && m.ancKeys.length) out.push(`<select${c} data-opt="anc" aria-label="Ancestry">${m.ancKeys.map((k) => `<option value="${k}"${S.anc === k ? " selected" : ""}>${ANC_NAME[k]}</option>`).join("")}</select>`);
  }
  return out;
}
function legendHTML(m) {
  const prev = m.year === "now" ? 2022 : prevYearOf(m.year) ?? (m.res && m.res.prev);
  const grad = (tbl, from, to) => { const st = []; for (let k = 0; k <= 10; k++) st.push(`${css(tbl[Math.round(lerp(from, to, k / 10))])} ${k * 10}%`); return `linear-gradient(90deg, ${st.join(",")})`; };
  const ticks = (vals, lo, hi, fmt) => `<div class="lg-ticks">${vals.map((v) => `<span style="left:${(100 * (v - lo)) / (hi - lo)}%">${fmt(v)}</span>`).join("")}</div>`;
  const mark = (v, lo, hi) => (v == null ? "" : `<span class="mk" style="left:${(100 * (clamp(v, lo, hi) - lo)) / (hi - lo)}%" title="Australia ${f1(v)}"></span>`);
  const aus = m.areas.AUS;
  const boothsOn = boothsShown();
  const opt = (name, cur, list) => `<select data-opt="${name}" aria-label="${name}">${list.map(([v, t]) => `<option value="${v}"${cur === v ? " selected" : ""}>${t}</option>`).join("")}</select>`;
  const partyOpts = FAMS.map((f) => [f, famLeg(f)]);
  // the chamber view chooses its chamber first
  let h = S.view === "chamber" ? houseSwitchHTML() : "";
  switch (S.lens) {
    case "winner": {
      const cnt = {}; for (const d of m.divs) cnt[holdFam(d.hold)] = (cnt[holdFam(d.hold)] || 0) + 1;
      h += `<div class="lg-t">${boothsOn ? "Who led the final count at each place" : isNow() ? "Who holds each seat today" : `Who won each seat in ${yearLabel(m.year)}`}</div>`;
      // in the chamber the counts are on the canvas's bloc labels and in the story, not three times
      h += `<div class="lg-cats">${["alp", "lnp", "grn", "ind", "csa", "onp", "oth"].filter((f) => cnt[f] || boothsOn).map((f) => `<span><i style="${swc(f)}"></i>${famLeg(f)}${boothsOn || S.view === "chamber" ? "" : ` <b>${cnt[f]}</b>`}</span>`).join("")}</div>`;
      break;
    }
    case "tpp": {
      const sw = S.tppMode === "swing";
      h += `<div class="lg-t">Two-party preferred: <button type="button" class="flip" data-flip="tpp">${sw ? `swing since ${prev}` : "share"}<span>⇄</span></button></div>`;
      const [lo, hi] = RANGE();
      h += legendHist(m, lo, hi);
      h += `<div class="lg-ramp" style="background:${grad(RAMP.div, 0, 200)}">${mark(sw ? -aus.tppSw : 100 - aus.tpp, lo, hi)}</div>`;
      h += sw ? ticks([-10, -5, 0, 5, 10], -10, 10, (v) => (v === 0 ? "0" : Math.abs(v))) : ticks([30, 40, 50, 60, 70], 30, 70, (v) => (v === 50 ? "50" : v < 50 ? `${100 - v}` : `${v}`));
      h += `<div class="lg-ends"><span class="t-alp">◀ ${sw ? "To Labor" : "Labor ahead"}</span><span class="t-lnp">${sw ? "To the Coalition" : "Coalition ahead"} ▶</span></div>`;
      if (boothsOn && sw) h += `<div class="lg-note"><span class="lg-hatch"></span>Place not used last time</div>`;
      break;
    }
    case "fp": {
      const ch = S.fpMode === "change";
      h += `<div class="lg-t">${opt("party", S.party, partyOpts)} first preferences: <button type="button" class="flip" data-flip="fp">${ch ? `change on ${prev}` : "share"}<span>⇄</span></button></div>`;
      const [lo, hi] = RANGE();
      h += legendHist(m, lo, hi);
      if (ch) h += `<div class="lg-ramp" style="background:linear-gradient(90deg, ${css(RAMP.loss[100])} 0%, ${css(RAMP.loss[45])} 30%, ${css(RAMP.loss[0])} 50%, ${css(RAMP.fp[S.party][45])} 70%, ${css(RAMP.fp[S.party][100])} 100%)">${mark(aus.fpSw[S.party], lo, hi)}</div>${ticks([-15, -5, 0, 5, 15], -15, 15, (v) => (v > 0 ? "+" + v : v < 0 ? "−" + -v : "0"))}<div class="lg-ends"><span style="color:var(--ink-3)">◀ Lost ground</span><span class="t-${S.party}">Gained ▶</span></div>`;
      else h += `<div class="lg-ramp" style="background:${grad(RAMP.fp[S.party], 0, 100)}">${mark(aus.fp[S.party], 0, FPMAX[S.party])}</div>${ticks([0, FPMAX[S.party] / 2, FPMAX[S.party]], 0, FPMAX[S.party], (v) => `${v}%${v === FPMAX[S.party] ? "+" : ""}`)}`;
      h += `<div class="lg-note">The line marks Australia: ${ch ? sgn(aus.fpSw[S.party]) + " points" : f1(aus.fp[S.party]) + "%"}.</div>`;
      break;
    }
    case "senate": {
      const gap = senGap(), A = senArea(m, m.areas.AUS.idx, S.party), none = svYear(m.year) == null;
      h += `<div class="lg-t">${opt("party", S.party, partyOpts)} <button type="button" class="flip" data-flip="sen">${gap ? "Senate less House" : "Senate share"}<span>⇄</span></button></div>`;
      const [lo, hi] = RANGE();
      h += legendHist(m, lo, hi);
      if (gap) h += `<div class="lg-ramp" style="background:linear-gradient(90deg, ${css(RAMP.loss[100])} 0%, ${css(RAMP.loss[45])} 30%, ${css(RAMP.loss[0])} 50%, ${css(RAMP.fp[S.party][45])} 70%, ${css(RAMP.fp[S.party][100])} 100%)">${A ? mark(A.gap, lo, hi) : ""}</div>${ticks([-10, -5, 0, 5, 10], -10, 10, (v) => (v > 0 ? "+" + v : v < 0 ? "−" + -v : "0"))}<div class="lg-ends"><span style="color:var(--ink-3)">◀ Better in the House</span><span class="t-${S.party}">Better in the Senate ▶</span></div>`;
      else h += `<div class="lg-ramp" style="background:${grad(RAMP.fp[S.party], 0, 100)}">${A ? mark(A.sen, 0, FPMAX[S.party]) : ""}</div>${ticks([0, FPMAX[S.party] / 2, FPMAX[S.party]], 0, FPMAX[S.party], (v) => `${v}%${v === FPMAX[S.party] ? "+" : ""}`)}`;
      // (the note's words don't wait on the votes: the key's height is measured before they load, and the
      // story gives Australia's figure)
      h += `<div class="lg-note">${none ? "A state election: there was no Senate vote." : `The line marks Australia${gap ? "; drawn where the party stood for the House" : ""}.${boothsOn && svYear(m.year) === 2004 ? " The AEC published no 2004 Senate counts by polling place." : ""}`}</div>`;
      break;
    }
    case "flow": {
      // Labor's rival in the final: the Coalition, or One Nation where the year has such finals on file;
      // the groups whose preferences can be read are the other parties'
      const from = [["grn", "the Greens’"], S.vs === "onp" ? ["lnp", STATE_YEARS.has(m.year) ? "the Liberals’" : "the Coalition’s"] : ["onp", "One Nation’s"], ["ind", "independents’"], ["oth", "other candidates’"]];
      h += `<div class="lg-t">Where ${opt("from", S.from, from)} preferences went${hasVsOnp(m) ? `, Labor v ${opt("vs", S.vs, [["lnp", STATE_YEARS.has(m.year) ? "the Liberals" : "the Coalition"], ["onp", "One Nation"]])}` : ""}</div>`;
      h += legendHist(m, 10, 90);
      h += `<div class="lg-ramp" style="background:${grad(S.vs === "onp" ? RAMP.divOn : RAMP.div, 0, 200)}"></div>${ticks([10, 30, 50, 70, 90], 10, 90, (v) => `${v}%`)}<div class="lg-ends"><span class="t-alp">◀ Mostly to Labor</span><span class="${S.vs === "onp" ? "t-onp" : "t-lnp"}">Mostly to ${vsW()} ▶</span></div><div class="lg-note"><span class="lg-hatch"></span>Final two weren’t Labor and ${vsW()}</div>`;
      const fe = m.res.flBasis === "modelled" ? flowErrOf(m, S.from) : null;
      if (fe) h += `<div class="lg-note">Modelled estimates — South Australia publishes no per-candidate splits. ${fe.seat ? `Nine in ten of the model’s per-seat estimates land within ${f0(fe.v)} points of a counted split.` : `Labor v One Nation splits are checked only in total, to within about ${f0(fe.v)} points, never seat by seat.`}</div>`;
      if (m.res.flOpv) h += `<div class="lg-note">Counted, not modelled — New South Wales re-counted every ballot paper. Preferences there are optional, so a ballot can exhaust before the final two; a share reads the ballots that reached them.</div>`;
      break;
    }
    case "informal": {
      const exh = infModeOf(m) === "exhaust", hi = infHi(m);
      // the exhausted view is offered only where the count is optional-preferential —
      // like the census switcher, the same legend swaps measure under the lens
      const opts = m.res && m.res.flOpv ? `<select data-opt="infm" aria-label="Informal lens view"><option value="informal"${S.infMode === "informal" ? " selected" : ""}>Informal</option><option value="exhaust"${S.infMode === "exhaust" ? " selected" : ""}>Exhausted ballots</option></select> ` : "";
      h += `<div class="lg-t">${opts}${exh ? "ballots exhausting before the final two" : "Informal ballots"}</div>`;
      if (exh) h += `${legendHist(m, 0, hi)}<div class="lg-ramp" style="background:${grad(RAMP.inf, 0, 100)}">${mark(aus.exhPct, 0, hi)}</div>${ticks([0, 6, 12, 18, 25], 0, hi, (v) => `${v}%${v === hi ? "+" : ""}`)}<div class="lg-note">Share of formal ballots that ran out of preferences — New South Wales votes optional-preferential, so a ballot leaves the count when its numbered candidates are gone. The line marks ${stNameCap(m.year)}: ${f1(aus.exhPct)}%.</div>`;
      else h += `${legendHist(m, 0, hi)}<div class="lg-ramp" style="background:${grad(RAMP.inf, 0, 100)}">${mark(aus.infPct, 0, hi)}</div>${ticks([0, 3, 6, 9, 12], 0, hi, (v) => `${v}%${v === hi ? "+" : ""}`)}<div class="lg-note">The line marks Australia: ${f1(aus.infPct)}%.</div>`;
      break;
    }
    case "cls":
      h += `<div class="lg-t">The AEC’s seat types</div><div class="lg-cats">${CLS.map((c, k) => `<span><i style="background:${css(TH.cls[k])}"></i>${CLS_SHORT[c]} <b>${m.divs.filter((d) => d.cls === c).length}</b></span>`).join("")}</div>`;
      break;
    case "seifa": {
      // the census pickers come from the shared builder: the list bar lays
      // the same selects out too (this legend is hidden in the list view)
      for (const s of censusSelects(m)) h += `<div class="lg-t">${s}</div>`;
      if (isDemo()) {
        const [lo, hi] = demoRange(), early = m.year !== "now" && m.year < DEMO_FROM;
        // an income lane can arrive by hash on a year whose store carries
        // none (income starts 2001); it reads as its own kind of early
        const noInc = isInc(S.index) && !hasInc(m);
        if (!early) h += legendHist(m, lo, hi);
        const ausShare = aus.demo && demoAreaShare(aus.demo);
        h += `<div class="lg-ramp" style="background:${grad(demoRamp(), 0, 100)}">${early || !aus.demo || ausShare == null ? "" : mark(ausShare, lo, hi)}</div>${ticks([lo, (lo + hi) / 2, hi], lo, hi, (v) => `${v}%${v === hi ? "+" : ""}`)}`;
        // the income lanes' note names their own cut in the census
        // year's dollars, then the same census-basis tail (interpolated
        // years name the blend, never one epoch)
        const incNote = `Share of adults in households earning ${S.index === "loinc" ? incLoFrag(m) : `${mny(m.incomeCuts && m.incomeCuts.hiEdgeWeekly)} or more a week`}${m.demoInterp ? " (census-year dollars)" : m.incomeCuts && m.incomeCuts.dollarsYear ? ` (${m.incomeCuts.dollarsYear} dollars)` : ""}`;
        // the 2026-10-31 lane notes: each carries its basis the way the
        // older lanes do (the older lanes' honest phrasing is part of
        // the lane-set's contract now)
        const NOTE_ARC = {
          pt: "Share of employed people who travelled to work by train, bus, tram or ferry — any one or more of those legs",
          noncit: "Share of residents not listed as Australian citizens (the census doesn't break out a not-stated share separately here: they're inside the complement)",
          bigfam: "Share of women aged 15+ who have had more than two children",
          hl: "Share of residents counted homeless in the ABS's census estimate, measured per SA2 statistical area (coarser than the other census measures)",
        };
        const headNote = isDemo() && isInc(S.index) ? incNote
          : isCob() ? `Share of residents born in ${COB_NAME[S.cob]}`
          : isRel() ? `Share of residents who ${RELISMS[S.rel]}`
          : isTen() ? `Share of residents whose dwellings ${TENESMS[S.ten]}`
          : isAnc() ? `Share of residents who ${ANCISMS[S.anc]} (people could name up to two ancestries, so the options don't add up to a whole)`
          : NOTE_ARC[S.index] || "Share of residents";
        const basisTail = m.demoInterp ? `interpolated between the ${m.demoInterp.c0} and ${m.demoInterp.c1} censuses to election day${m.demoBasis === "venue" ? `, of the census areas ${boothsOn ? "the places stand" : "the polling places stand"} in` : `, where each ${boothsOn ? "place’s" : "seat’s"} voters live`}.` : m.demoBasis === "venue" ? `${m.year < 2004 ? 2001 : m.year < 2013 ? 2006 : 2011} census, of the census areas ${boothsOn ? "the places stand" : "the polling places stand"} in.` : m.demoBasis === "sa1" ? `${m.demoYear ?? 2021} census, of the SA1 census area${boothsOn ? " each polling place stands in" : "s that make up each district"}.` : `2021 census, where each ${boothsOn ? "place’s" : "seat’s"} voters live.`;
        // a birthplace sub-view's tail ignores the blend epoch (cob rides
        // the measured census — 2004's measured side is the 2001 census)
        const cobTail = m.demoBasis === "venue" ? `${m.year < 2007 ? 2001 : m.year < 2013 ? 2006 : 2011} census, of the census areas ${boothsOn ? "the places stand" : "the polling places stand"} in.` : m.demoBasis === "sa1" ? `${m.demoYear ?? 2021} census, of the SA1 census area${boothsOn ? " each polling place stands in" : "s that make up each district"}.` : `2021 census, where each ${boothsOn ? "place’s" : "seat’s"} voters live.`;
        h += `<div class="lg-note">${early ? "Census people figures start at the 1993 election: 1993, 1996 and 1998 read blended census shares over the two censuses that bracket each election; 2001 reads its own census; 2004 to 2019 blend between the two censuses that bracket them; 2022 reads the 2021 census." : noInc ? "Income figures start at the 2001 election, in the census year's own dollars: 2001 to 2013 read the census areas the polling places stand in; from 2016 they follow the voters." : `${headNote}${headNote.endsWith(")") || headNote.endsWith('"') || headNote.endsWith(".") ? " " : ", "}${isCob() ? cobTail : basisTail}${aus.demo && ausShare != null ? ` The line marks ${m.demoBasis === "sa1" ? stNameCap(m.year) : "Australia"}: ${f1(ausShare)}%.` : ""}`}</div>`;
        break;
      }
      h += `<div class="lg-ramp" style="background:${grad(RAMP.seifa, 0, 100)}"></div>${ticks([1, 10], 1, 10, (v) => `${v}`)}<div class="lg-ends"><span style="color:var(--ink-3)">◀ Least advantaged</span><span style="color:var(--ink-3)">Most ▶</span></div>`;
      h += boothsOn ? `<div class="lg-note">Places scored ${opt("basis", S.basis, [["venue", "where they stand"], ["voters", "where their voters live"]])}</div>` : `<div class="lg-note">Seats ranked into tenths of the ${m.divs.length}.</div>`;
      break;
    }
  }
  // in the chamber, a year with a seating plan can show the members where they sit or sorted by the lens
  if (S.view === "chamber" && m.seating) {
    const md = seatMode(m);
    const by = { winner: "winning share", tpp: S.tppMode === "swing" ? "swing" : "two-party share", fp: "primary vote", flow: "preference flow", informal: "informal vote", cls: "seat type", seifa: "census measure" }[S.lens];
    h += `<div class="lg-seat" role="group" aria-label="How the chamber is arranged"><button type="button" data-seat="plan" aria-pressed="${md === "plan"}">As seated</button><button type="button" data-seat="sort" aria-pressed="${md === "sort"}">Sorted</button><span>${md === "plan" ? `From the Parliament’s seating plan of ${m.seating.plan}${m.seating.note ? `, ${m.seating.note}` : ""}.` : `By ${by}, each side from the Speaker’s end.`}</span></div>`;
  }
  if (boothsOn) h += `<div class="lg-shapes"><span><i></i>Polling place</span><span><i class="sq"></i>Early voting</span><span>Size: votes</span></div>`;
  return h;
}

/* =============================== the timeline =============================== */
let SUM = null;
let tlCtx = null; // shared canvas context for measuring stop-label widths
/* one dated row per jurisdiction: the federal elections on top, Victoria's,
   New South Wales' and South Australia's state ones on their own rows below
   (2026-10-28 user call — Vic rides above NSW on the rail), each stop
   at its date on the one scale */
function renderTimeline() {
  const el = $("#time"); if (!el) return;
  const W = el.clientWidth || 600, H = el.clientHeight || 106, m = M();
  // the rail's left anchor is the years list's own head – 2004 when the span
  // opened there, 2001 now: a year before the literal anchor used to render
  // off the left edge with a NaN-ish hit rect (the 2001 stop the first day)
  const FED0 = YEAR_X[YEARS_FED[0]] ?? YEARS_FED[0];
  const X = (y) => 22 + ((xOfYear(y) - FED0) / (YEAR_X.now - FED0)) * (W - 44);
  const NX = (nx) => 22 + ((nx - FED0) / (YEAR_X.now - FED0)) * (W - 44);
  // a state row's cursor: its own previous elections (2018/2019 before the frames
  // open, 2022 on the SA row is sa22, not the federal 2022), then the frames' spots
  const STATE_ROW_PREV_X = { sa: SA_PREV_X, nsw: NSW_PREV_X, vic: VIC_PREV_X, qld: QLD_PREV_X };
  const stGx = (st) => (ry) => NX(STATE_ROW_PREV_X[st][ry] ?? YEAR_X[st + String(ry).slice(2)] ?? ry);
  const short = W < 560, cur = S.year;
  /* five rows since the Queensland stops landed (2026-10-29, user call appending
     the jurisdiction at the bottom): equal pitch, one labels band under the
     lowest base, each row's whole read (line, labels, the selected stop's
     underline) inside its band */
  const pitch = (H - 17) / 5;
  const rows = [
    { ys: YEARS_FED, base: Math.round(pitch), top: 2 },
    { ys: YEARS_VIC, base: Math.round(pitch * 2), top: Math.round(pitch) + 16, gx: stGx("vic") },
    { ys: YEARS_NSW, base: Math.round(pitch * 3), top: Math.round(pitch * 2) + 16, gx: stGx("nsw") },
    { ys: YEARS_SA, base: Math.round(pitch * 4), top: Math.round(pitch * 3) + 16, gx: stGx("sa") },
    { ys: YEARS_QLD, base: Math.round(pitch * 5), top: Math.round(pitch * 4) + 16, gx: stGx("qld") },
  ];
  const rowIx = (y) => (VIC_YEARS.has(y) ? 1 : NSW_YEARS.has(y) ? 2 : SA_YEARS.has(y) ? 3 : QLD_YEARS.has(y) ? 4 : 0);
  const sd = m ? selDiv() : null;
  let g = "";
  for (const r of rows) g += `<line x1="0" x2="${W}" y1="${r.base}" y2="${r.base}" stroke="var(--line)"/>`;
  // the glyph above a stop: the House's make-up, or the chosen seat's two-party line
  if (sd != null && m) {
    const d = m.divs[sd], hh = d.h, row = rows[rowIx(m.year)];
    const gx = row.gx || X;
    const vs = hh.map((r) => r[1]).filter((v) => v != null);
    let lo = Math.min(...vs, 50) - 3, hi = Math.max(...vs, 50) + 3;
    if (hi - lo < 16) { const c = (lo + hi) / 2; lo = c - 8; hi = c + 8; }
    const yv = (v) => row.base - 6 - ((clamp(v, lo, hi) - lo) / (hi - lo)) * (row.base - 8 - row.top);
    const pl = hh.filter((r) => r[1] != null && !r[4]).map((r) => `${gx(r[0]).toFixed(1)},${yv(r[1]).toFixed(1)}`).join(" ");
    g += `<line x1="0" x2="${W}" y1="${yv(50)}" y2="${yv(50)}" stroke="var(--line)" stroke-dasharray="2 3"/><polyline points="${pl}" fill="none" stroke="var(--ink-faint)" stroke-width="1.4"/>`;
    for (const r of hh) {
      const cy = r[1] != null ? yv(r[1]) : yv(50);
      g += `<circle cx="${r[4] ? X("now") : gx(r[0])}" cy="${cy}" r="${(r[4] ? "now" : r[0]) === cur ? 5 : 3.6}" fill="var(--m-${FAM(r[2])})" stroke="var(--bg)" stroke-width="1.5"><title>${r[4] ? "By-election" : r[0]}: ${ds(r[3])} (${esc(partyName(r[2]))})${r[1] != null ? `, Labor two-party ${f1(r[1])}` : ""}</title></circle>`;
    }
    if (cur === "now" && !hh.some((r) => r[4])) { const last = hh[hh.length - 1]; if (last) g += `<circle cx="${X("now")}" cy="${last[1] != null ? yv(last[1]) : yv(50)}" r="5" fill="var(--m-${holdFam(m.divs[sd].hold)})" stroke="var(--bg)" stroke-width="1.5"/>`; }
  } else if (SUM) {
    // in the Senate's chamber each stop reads that election's upper house
    const sen = senOn();
    const st = sen ? (S.ssel.level !== "aus" ? S.ssel.st : "AUS") : S.sel.level === "state" ? S.sel.st : "AUS";
    for (const r of rows) {
      // as wide as the row's closest two stops allow (2025 and Now sit close on a phone)
      const xs = r.ys.map(X), bw = Math.min(30, ...xs.slice(1).map((x, j) => x - xs[j] - 4));
      for (const y of r.ys) {
        // (a state election's House from the facts stamped into the script: summary.json is federal)
        const s = sen ? SENY[y] && senCounts(SENY[y], (d) => st === "AUS" || d.st === st) : SUM.seats[y] ? SUM.seats[y][st] : st !== "NSW" && META_FACTS.mix && META_FACTS.mix[y]; if (!s) continue;
        const tot = sum(Object.values(s)), x = X(y) - bw / 2;
        let acc = 0;
        // the make-up bar hugs its own row's line: the SA row's read sits with
        // the state's stops, not midway to the federal labels
        for (const f of ["alp", "grn", "ind", "oth", "onp", "lnp"]) { const n = s[f] || 0; if (!n) continue; const w = (bw * n) / tot; g += `<rect x="${(x + acc).toFixed(2)}" y="${r.base - 10}" width="${Math.max(0.6, w - 0.6).toFixed(2)}" height="8" fill="var(--m-${f})" opacity="${y === cur ? 1 : 0.62}"/>`; acc += w; }
      }
    }
  }
  /* the stops' labels sit on their row; a pair whose boxes touch nudge apart a
     little (2025 and Now on a phone), never far from the stop they name */
  if (!tlCtx) tlCtx = document.createElement("canvas").getContext("2d");
  tlCtx.font = `400 12px ${getComputedStyle(el).fontFamily}`;
  const tW = (s) => tlCtx.measureText(s).width;
  const rowsOf = [
    { i: 0, items: YEARS_FED.map((y) => ({ y, lab: short && y !== "now" ? "’" + String(y).slice(2) : yearLabel(y) })) },
    { i: 1, items: YEARS_VIC.map((y) => ({ y, lab: short ? "’" + String(y).slice(-2) : yearLabel(y) })) },
    { i: 2, items: YEARS_NSW.map((y) => ({ y, lab: short ? "’" + String(y).slice(-2) : yearLabel(y) })) },
    { i: 3, items: YEARS_SA.map((y) => ({ y, lab: short ? "’" + String(y).slice(-2) : yearLabel(y) })) },
    { i: 4, items: YEARS_QLD.map((y) => ({ y, lab: short ? "’" + String(y).slice(-2) : yearLabel(y) })) },
  ];
  for (const R of rowsOf) {
    const r = rows[R.i], labY = r.base + 15;
    const its = R.items.map((t) => ({ ...t, x: NX(xOfYear(t.y)), w: tW(t.lab), dx: 0, on: t.y === cur }));
    for (const t of its) { t.dx = -t.w / 2; }
    for (let k = 0; k < 4; k++) for (let i = 1; i < its.length; i++) {
      const a = its[i - 1], b = its[i], gap = b.x + b.dx - (a.x + a.dx + a.w);
      if (gap < 6) { const push = Math.min(6 - gap, 12), pa = Math.min(push / 2, 6), pb = Math.min(push - pa, 6); a.dx -= pa; b.dx += pb; }
    }
    // each state row named at its empty start, as a caption — never a stop
    if (R.i) {
      const x0 = its.length ? its[0].x - 24 : W;
      if (x0 > (short ? 30 : 110)) g += `<text class="yr row" x="0" y="${labY}" text-anchor="start">${short ? stOfYear(r.ys[0]) : stNameCap(r.ys[0])}</text>`;
    }
    for (const [i, t] of its.entries()) {
      const lx = t.x + t.dx + t.w / 2;
      // Split adjacent touch areas between their visible labels. Fixed-width
      // targets overlap on phones and let a later year intercept an earlier tap.
      const centre = (v) => v.x + v.dx + v.w / 2;
      const hitLeft = i ? Math.max(lx - 24, (centre(its[i - 1]) + lx) / 2) : lx - 24;
      const hitRight = i + 1 < its.length ? Math.min(lx + 24, (lx + centre(its[i + 1])) / 2) : lx + 24;
      const hitTop = R.i ? r.top : 0, hitBot = R.i + 1 < rows.length ? rows[R.i + 1].top : H;
      const uline = t.on ? `<line x1="${lx - t.w / 2}" x2="${lx + t.w / 2}" y1="${labY + 2}" y2="${labY + 2}" stroke="var(--ink)" stroke-width="2"/>` : "";
      g += `<g class="stop" data-year="${t.y}" style="cursor:pointer"><rect class="hit" x="${hitLeft}" y="${hitTop}" width="${hitRight - hitLeft}" height="${hitBot - hitTop}"/><line x1="${t.x}" x2="${t.x}" y1="${r.base - 3}" y2="${r.base + 3}" stroke="${t.on ? "var(--ink)" : "var(--ink-faint)"}"/><text class="yr${t.on ? " on" : ""}" x="${lx}" y="${labY}" text-anchor="middle">${esc(t.lab)}</text>${uline}</g>`;
    }
  }
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Federal elections ${YEARS[0]} to now, and Victorian, New South Wales, South Australian and Queensland state elections; choose one">${g}</svg>`;
}

/* =============================== tooltip =============================== */
const tip = $("#tip");
document.body.appendChild(tip);
tip.style.position = "fixed";
function hideTip() { tip.hidden = true; }
function showTipAt(html, cx, cy) {
  tip.innerHTML = html; tip.hidden = false;
  const r = tip.getBoundingClientRect();
  let tx = cx + 14, ty = cy + 16;
  if (tx + r.width > innerWidth - 8) tx = cx - r.width - 14;
  if (ty + r.height > innerHeight - 8) ty = cy - r.height - 14;
  tip.style.transform = `translate(${Math.max(6, tx)}px, ${Math.max(6, ty)}px)`;
}
function tipFor(h) {
  if (h && h.kind === "sen") return SENM ? senTip(SENM, h.i) : "";
  const m = M(); if (!h || !m) return "";
  const goes = h.go ? `<div class="ts">Click to go out to the island</div>` : "";
  if (h.kind === "isl") return `<div class="tn">${esc(h.isl)}</div><div class="ts">In no seat at this election</div>${goes}`;
  if (h.kind === "div") {
    const d = m.divs[h.i];
    const v = divValue(m, h.i);
    const sp = h.i === m.speaker ? " · Speaker" : "";
    const holder = d.hold;
    return `<div class="tn">${ds(d.n)}<span>${h.isl ? esc(h.isl) + " · " : ""}${STATE_SHORT[d.st]}${sp}</span></div><div class="tv">${esc(valueText(v, "div", { m, d }))}</div><div class="ts">${ds(holder.n)}, ${esc(leaderName(holder))}${S.lens === "winner" ? ` · ${d.by ? "by-election" : "margin"} ${f1(d.margin)}` : ""}</div>${goes}`;
  }
  const b = m.booth, j = h.i, D = m.divs[b.d[j]];
  const ld = b.lead[j], lname = ld ? pairNames(ld, ld === D.A ? D.B : D.A)[0] : "";
  return `<div class="tn">${ds(b.name[j])}<span>${ds(D.n)}</span></div><div class="tv">${esc(valueText(boothValue(m, j), "booth", { m, d: D }))}</div><div class="ts">${int(b.votes[j])} votes${ld ? ` · ${esc(lname)} ${f1(b.leadPct[j])}` : ""}</div>`;
}

/* =============================== selection =============================== */
function select(sel, opts = {}) {
  const prevDiv = selDiv();
  S.sel = sel;
  if (selDiv() !== prevDiv) quietSince = performance.now();
  S.hover = null; hideTip();
  if (opts.view && opts.view !== S.view) setView(opts.view, true);
  if (S.view === "map" && opts.fly !== false) fitSelection(opts.dur ?? 800);
  renderBack();
  renderStory(true);
  if (S.view === "list") renderList(true);
  renderFilterPill(); legendIfChanged(); updateHint(); renderTimeline(); writeURL();
  if (isPhone() && opts.scroll !== false && sel.level !== "aus") { /* the story sits under the map on a phone: nothing to scroll */ }
  schedule();
}
/* the way back from an island: to its seat on the mainland (or the country,
   for an island in no seat that year) */
const backBtn = document.createElement("button");
backBtn.type = "button"; backBtn.className = "mp-back"; backBtn.hidden = true;
$("#stage").appendChild(backBtn);
backBtn.addEventListener("click", () => { const q = islOf(M(), away), i = q ? q.seat : null; if (i != null) goDiv(i); else goAus(); });
function renderBack() {
  const m = M(), q = S.view === "map" ? islOf(m, away) : null;
  backBtn.hidden = !q;
  if (!q) return;
  const t = q.seat != null ? `Back to ${dn(m.divs[q.seat].n)}` : "Back to the mainland";
  if (backBtn.dataset.t !== t) { backBtn.dataset.t = t; backBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M7.5 2.5 4 6l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>${esc(t)}`; }
}
const goAus = (o) => select({ level: "aus" }, o);
const goState = (st, o) => select({ level: "state", st }, o);
const goDiv = (i, o) => { const m = M(); select({ level: "div", st: m.divs[i].st, div: i }, o); };
const goBooth = (j, o) => { const m = M(); const i = m.booth.d[j]; select({ level: "booth", st: m.divs[i].st, div: i, booth: j }, o); };
function goUp() { const s = S.sel; if (s.level === "booth") goDiv(s.div); else if (s.level === "div") goState(s.st); else if (s.level === "state") goAus(); }

function renderFilterPill() {
  const el = $("#filterpill"), m = M();
  const on = filtersOn() || (S.f.range && S.f.range.unit === "booths");
  if (!on || S.view === "list" || !m) { el.hidden = true; return; }
  const n = m.divs.filter((d) => passes(m, d.i)).length;
  const w = filterWords(m);
  el.innerHTML = `<span>${S.f.range && S.f.range.unit === "booths" ? "Places" : `<b>${n}</b> ${plural(n, "seat")}`}: ${esc(w.join(" · "))}</span><button type="button" data-clear>Clear</button>`;
  el.hidden = false;
}
function filtersChanged() {
  renderFilterPill(); renderStory(true); if (S.view === "list") renderList(); schedule(); paintMiniChamber(); writeURL();
}
function updateHint() {
  const el = $("#hint"); if (!el) return;
  const show = S.view === "map" && selDiv() == null && T.k < K_ALL && !!M();
  el.textContent = show ? "Zoom in, or choose a seat, to see its polling places" : "";
  el.style.opacity = show ? "1" : "0";
  $("#cities").hidden = S.view !== "map" || selDiv() != null || T.k > HOME.k * 3;
}

/* =============================== search =============================== */
let sugg = [], suggAt = -1;
function runSearch() {
  const m = M(), el = $("#sugg"), q = S.q.trim(), sen = senOn();
  if (S.view === "list") { el.hidden = true; renderList(); return; }
  if (!m || q.length < 2) { el.hidden = true; sugg = []; $("#q").setAttribute("aria-expanded", "false"); return; }
  const toks = norm(q).split(/\s+/).filter(Boolean);
  const scored = [];
  for (const it of sen ? (SENM.search ??= senSearchItems(SENM)) : m.search.items) {
    const h = it.h; let ok = true, score = it.rank * 10;
    for (const t of toks) { const p = h.indexOf(t); if (p < 0) { ok = false; break; } if (p === 0) score -= 4; else if (h[p - 1] === " ") score -= 2; }
    if (ok) scored.push([score, it]);
    if (scored.length > 4000) break;
  }
  scored.sort((a, b) => a[0] - b[0]);
  const groups = { state: [], sen: [], div: [], mp: [], cand: [], booth: [] };
  for (const [, it] of scored) { const g = groups[it.k]; if (g.length < (it.k === "booth" || it.k === "sen" ? 6 : 4)) g.push(it); }
  sugg = [...groups.state, ...groups.sen, ...groups.div, ...groups.mp, ...groups.cand, ...groups.booth];
  suggAt = sugg.length ? 0 : -1;
  const label = { state: "States and territories", sen: "Senators", div: "Seats", mp: isNow() ? "Members" : "Members elected", cand: "Candidates", booth: "Polling places" };
  let html = "", n = 0;
  for (const k of ["state", "sen", "div", "mp", "cand", "booth"]) {
    if (!groups[k].length) continue;
    html += `<div class="g">${label[k]}</div>`;
    for (const it of groups[k]) {
      const color = it.k === "booth" ? colCss(m.boothCol[it.j]) : it.k === "state" ? "var(--line)" : it.k === "sen" ? colCss(SENM.divCol[it.i]) : colCss(m.divCol[it.i]);
      html += `<button type="button" role="option" data-n="${n}" aria-selected="${n === suggAt}"><i class="sw" style="background:${color}"></i><span class="t">${ds(it.t)}</span><span class="s">${ds(it.s)}</span></button>`;
      n++;
    }
  }
  el.innerHTML = html || `<div class="none">${sen ? "No senator or state" : "No seat, member or place"} matches “${esc(q)}”.</div>`;
  el.hidden = false; $("#q").setAttribute("aria-expanded", "true");
}
function chooseSugg(k) {
  const it = sugg[k]; if (!it) return;
  $("#sugg").hidden = true; $("#q").value = ""; S.q = ""; $("#q").blur();
  if (senOn()) { selectSen(it.k === "state" ? { level: "state", st: it.st } : { level: "sen", st: SENM.divs[it.i].st, i: it.i }); return; }
  const view = it.k === "booth" && S.view === "chamber" ? "map" : undefined;
  if (it.k === "state") goState(it.st, { view });
  else if (it.k === "div" || it.k === "mp" || it.k === "cand") goDiv(it.i, { view });
  else goBooth(it.j, { view });
}

/* =============================== views, lenses, years =============================== */
/* chrome can leave a composited element's layer painted over the page's
   bottom band once the element has scrolled out of the window — the tide
   art then carries a stale slice of the page. First seen as the stage and
   mini-chamber canvases mis-compositing a few rows (the original fix below);
   the DESKTOP case is grosser: the whole story column (.mp-story, metres
   tall and fully off-window at the band) paints a stale slice across the
   band's full width. Killing any one canvas doesn't clear it, clipping
   does, and visibility:hidden on the column clears it with no reflow. Here
   at the band zero story children are inside the viewport, so hiding the
   whole column the moment none of it is on window costs the user nothing —
   the rAF scroll listener and resize() put it back the instant any part
   re-enters. The stage canvas is hidden only when ALL of it is off the window
   (matching the story column's own full-cull rule) — at page load the stage
   partially overlaps the viewport, and culling it then would blank the hero
   map. The mini-chamber at a ±half-viewport margin, and the list view
   hides the stage canvas outright. visibility, not display, everywhere so
   nothing reflows */
function updateCanvasVis() {
  const vh = window.innerHeight;
  const story = $("#story");
  if (story) {
    const r = story.getBoundingClientRect();
    story.style.visibility = r.bottom <= 0 || r.top >= vh ? "hidden" : "";
  }
  const stage = canvas.parentElement.getBoundingClientRect();
  canvas.style.visibility =
    S.view === "list" || stage.bottom <= 0 || stage.top >= vh ? "hidden" : "visible";
  if (miniCh.canvas) {
    const r = miniCh.canvas.getBoundingClientRect();
    miniCh.canvas.style.visibility = r.bottom < -vh * 0.5 || r.top > vh * 1.5 ? "hidden" : "";
  }
}
function setView(v, quiet) {
  if (v === S.view) return;
  const prev = S.view;
  // the Senate has no map: into or out of its chamber the view changes without the morph
  const senate = S.house === "senate" && (prev === "chamber" || v === "chamber");
  S.view = v;
  $$(".mp-views .rd-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === v)));
  if (senate) { renderLenses(); $("#mp-meta").textContent = metaLine(); if (v === "chamber") needSenateFloor(); }
  holdEyebrow();
  const list = v === "list";
  $("#list").hidden = !list;
  $("#view").classList.toggle("v-chamber", v === "chamber");
  for (const id of ["#cities", "#zoomer", "#hint"]) $(id).hidden = v !== "map";
  updateCanvasVis();
  canvas.classList.toggle("grab", v === "map");
  updateTouch();
  hideTip(); S.hover = null;
  if (list) { $("#sugg").hidden = true; renderList(); }
  else {
    if (!senate && ((prev === "map" && v === "chamber") || (prev === "chamber" && v === "map"))) morph = reduceMotion ? null : { t0: performance.now(), dur: 1000, to: v };
    // the map always opens at its fit — the transform persists across views,
    // and an unfitted one lands on the country's north-west corner
    if (v === "map" && prev !== "map") fitSelection(0);
  }
  renderLegend(); renderFilterPill(); updateHint(); renderBack(); writeURL();
  if (!quiet) renderStory(true);
  schedule();
}
function setLens(id) {
  if (S.lens === id) return;
  if (FED_LENS.has(id) && STATE_YEARS.has(S.year)) return;
  // the Senate's votes load with their lens (about 120KB a year, gzipped)
  if (id === "senate" && svYear(S.year) != null && !SV[svYear(S.year)]) {
    const spot = takeSpot();
    showLoading(true);
    loadSenateVote(S.year).then(() => { showLoading(false); walkSpot = spot && { ...spot, at: performance.now() }; setLens(id); })
      .catch(() => showLoading(true, "The Senate’s votes didn’t load. Try again."));
    return;
  }
  const hold = walkHold(takeSpot());
  S.lens = id; S.sort = null; S.dist = null;
  if (S.f.range && S.f.range.key === "lens") S.f.range = null;
  $$("#lenses .rd-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.lens === id)));
  startChamberGlide();
  recolor(true); renderLegend(); renderStory(true); writeURL();
  if (S.view === "list") renderList(true);
  if (hold) hold.land();
}
function setSenLens(id) {
  if (S.senLens === id) return;
  const hold = walkHold(takeSpot());
  S.senLens = id;
  $$("#lenses .rd-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.slens === id)));
  startChamberGlide(); recolor(true); renderLegend(); renderStory(true); writeURL();
  if (hold) hold.land();
}
/* the chamber view's chamber: the House or the Senate, both at the timeline's election; the two
   cross-fade, the chairs being different people */
let houseFade = null;
async function setHouse(h) {
  if (h === S.house) return;
  const spot = takeSpot(), from = CM();
  // a state election has no Senate: the one sitting then is the last federal election's
  if (h === "senate" && !SEN_YEARS.includes(S.year)) await setYear(senYearFor(S.year));
  if (h === "senate" && (!senFloor || !SENY[S.year])) {
    showLoading(true);
    try { await Promise.all([loadSenateFloor(), loadSenate(S.year)]); } catch (e) { showLoading(true, "The Senate didn’t load. Try again."); return; }
    showLoading(false);
    loadSenates();
  }
  syncSenate();
  const hold = walkHold(spot);
  S.house = h; S.hover = null; hideTip();
  chAnim = null; chLast.clear();
  houseFade = from && !reduceMotion && S.view === "chamber" ? { from, t0: performance.now(), dur: 420 } : null;
  renderLenses(); renderLegend(); renderStory(true); renderTimeline(); writeURL();
  $("#mp-meta").textContent = metaLine(); holdEyebrow();
  if (hold) hold.land();
  schedule();
}
// the Senate's floor, fetched the first time its chamber is shown
function needSenateFloor() {
  if (senFloor && SENY[S.year]) return;
  showLoading(true);
  Promise.all([loadSenateFloor(), loadSenate(S.year)]).then(() => { syncSenate(); showLoading(false); renderLenses(); renderLegend(); renderStory(true); renderTimeline(); $("#mp-meta").textContent = metaLine(); holdEyebrow(); schedule(); loadSenates(); })
    .catch(() => showLoading(true, "The Senate didn’t load. Try again."));
}
function lensParamChanged() {
  const hold = walkHold(takeSpot());
  S.sort = null; if (S.f.range && S.f.range.key === "lens") S.f.range = null;
  startChamberGlide(); recolor(true); renderLegend(); renderStory(true); writeURL();
  if (S.view === "list") renderList(true);
  if (hold) hold.land();
}
/* the wait for an election's data: a ring, centred on the map; on the chamber, in the aisle
   between the Hansard desk and the back rows. Words only when the data fails */
function showLoading(on, msg) {
  const el = $("#loading");
  el.hidden = !on; el.classList.toggle("err", !!msg); el.textContent = msg || "";
  el.setAttribute("aria-label", msg ? "" : "Loading");
  el.style.left = el.style.top = "";
  if (!on || msg || S.view !== "chamber") return;
  const r = $("#stage").getBoundingClientRect();
  if (!r.width) return;
  // (the states' floors are drawn from the start; the Senate's only once fetched)
  const geom = chamberGeom(STATE_YEARS.has(S.year) ? { year: S.year, house: S.house } : S.house === "senate" && senFloor ? SENM : null);
  const F = chamberFrame(geom, r.width, r.height, chamberPads(r.width));
  el.style.left = F.X(0) + "px"; el.style.top = F.Yp(geom.aisle) + "px";
}
async function setYear(y) {
  if (y === S.year) return;

  // the spot is taken now, while it's fresh: the election may take a while to load
  const from = S.year, a = M(), spot = takeSpot();
  // a state election on the timeline has no Senate: it opens in the House's chamber
  if (S.house === "senate" && !SEN_YEARS.includes(y)) { S.house = "reps"; chAnim = null; chLast.clear(); renderLenses(); }
  // ... and the Senate-vote/seat-type lenses are AEC reads the state frames don't offer
  if (STATE_YEARS.has(y) && FED_LENS.has(S.lens)) S.lens = "winner";
  // the stamp names the election at the press; while it loads the stamp's rule runs and a
  // sheen crosses the map (an election already loaded lands within the frame)
  const dir = yearDir(from, y), tok = ++yearTok;
  showStamp(y, dir);
  const ready = Y[y] && Y[y].divs;
  if (!ready) { ywait = { t0: performance.now(), dir }; schedule(); }
  // the Senate's chamber moves with the timeline: that election's Senate too
  try { await Promise.all([loadYear(y), S.house === "senate" ? loadSenate(y) : null, S.lens === "senate" ? loadSenateVote(y) : null]); } catch (e) { if (tok === yearTok) { ywait = null; stampDone(); } showLoading(true, "That election didn’t load. Try again."); return; }
  if (tok === yearTok) ywait = null;
  showLoading(false);
  const b = Y[y];
  // the view the reader left as the page framed it (or the page is still flying to) is framed again in the new election
  const framed = S.view === "map" && a && (atLastFit() || !!flight || T.k <= HOME.k * 1.001);
  // a year's birthplace menu is its own census edition's: a country it
  // doesn't print (England/Scotland before 2016) falls back to all overseas-born
  if (S.cob != null && !(b.cobKeys || []).includes(S.cob)) S.cob = null;
  // the Religion/Tenure menus appear only where their rows are; an
  // unknown option falls back to the menu's landing view
  if (!(b.relKeys || []).includes(S.rel)) S.rel = (b.relKeys || [])[0] || "norel";
  if (!(b.tenKeys || []).includes(S.ten)) S.ten = (b.tenKeys || [])[0] || "mort";
  if (!(b.ancKeys || []).includes(S.anc)) S.anc = (b.ancKeys || [])[0] || "english";
  if (!b.relKeys && S.index === LENS_REL) S.index = "irsad";
  if (!b.tenKeys && S.index === LENS_TEN) S.index = "irsad";
  if (!b.ancKeys && S.index === LENS_ANC) S.index = "irsad";
  proj = b.proj; // the year now shown (a year loaded ahead keeps the live projection)
  // carry the selection across by seat name and polling-place ID
  const s = S.sel;
  if ((s.level === "div" || s.level === "booth") && a) {
    const ni = b.byName.get(a.divs[s.div].n);
    if (ni == null) S.sel = { level: "state", st: s.st };
    else if (s.level === "booth") { const id = a.booth.id[s.booth]; const nj = b.booth.byDiv[ni].find((j) => b.booth.id[j] === id); S.sel = nj != null ? { level: "booth", st: s.st, div: ni, booth: nj } : { level: "div", st: s.st, div: ni }; }
    else S.sel = { level: "div", st: s.st, div: ni };
  }
  if (s.isl && S.sel !== s) S.sel = { ...S.sel, isl: s.isl }; // still out at the island
  // a state the new frame doesn't hold (New South Wales open, on to Victoria's election) opens the whole frame
  if (S.sel.level === "state" && !b.areas[S.sel.st]) S.sel = { level: "aus" };
  const hold = walkHold(spot);
  startChamberGlide();
  S.year = y;
  laneMem.set(yearLane(y), y);
  if (S.house === "senate") {
    // the chosen senator carries across by name where they sat in both Senates, else their state
    const was = SENM, ss = S.ssel;
    syncSenate();
    if (ss.level === "sen" && was) { const i = SENM.byName.get(was.divs[ss.i].n); S.ssel = i != null ? { level: "sen", st: ss.st, i } : { level: "state", st: ss.st }; }
    renderLenses();
  }
  renderLenses(); // the SA frames offer fewer lenses — the chip row changes with the year
  recolor(false);
  setExtent();
  ymorph = null;
  if (S.view === "map" && a && a !== b) {
    // the camera first shows on the new election's plane the ground it showed on the old;
    // a framed view then flies to its frame in the new (federal to a state: in to the state)
    const C0 = intoFrame(T, frameMap(a, b));
    glideCancel(); flight = null; d3.select(canvas).interrupt().call(zoom.transform, C0);
    if (framed || C0.k < HOME.k * 0.999) fitSelection(jurOf(a.year) !== jurOf(y) ? 1000 : 640);
    if (!startYearMorph(a, b, framed && lastFit ? lastFit : T, dir)) carryColours(a, b);
  }
  const ul = tlMark();
  renderTimeline(); tlGlide(ul); renderLegend(); renderStory(true); renderFilterPill(); renderBack(); writeURL();
  $("#mp-meta").textContent = metaLine(); holdEyebrow();
  if (S.view === "list") renderList(true);
  if (hold) hold.land();
  stampDone(ymorph ? ymorph.dur : 300);
  schedule();
}
let yearTok = 0;
// +1 going forward in time, -1 back (Now is the latest of all)
const yearWhen = (y) => (y === "now" ? "9999" : Y[y] && Y[y].date ? Y[y].date : META_FACTS.house && META_FACTS.house[y] ? META_FACTS.house[y][0] : String(xOfYear(y)));
const yearDir = (a, b) => (yearWhen(b) < yearWhen(a) ? -1 : 1);
/* the stamp: the election just chosen, set large in the stage's corner while the map turns
   to it, rolling over from the one before like a counter (up going forward in time, down
   going back), a kicker naming its parliament above. Up at the press, before the data
   lands, its rule running while the election loads; it goes once the map has turned */
const stampEl = (() => {
  const el = document.createElement("div");
  el.className = "mp-stamp"; el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<div class="mp-stamp-k"></div><div class="mp-stamp-y"></div><div class="mp-stamp-r"><i></i></div>`;
  $("#stage").appendChild(el);
  return el;
})();
let stampShown = "", stampOff = 0;
function stampParts(y) {
  if (y === "now") return ["The House today", "Now"];
  if (STATE_YEARS.has(y)) return [`${NSW_YEARS.has(y) ? "New South Wales" : VIC_YEARS.has(y) ? "Victorian" : "South Australian"} election`, "20" + String(y).slice(-2)];
  return ["Federal election", String(y)];
}
function showStamp(y, dir) {
  clearTimeout(stampOff);
  const [kick, big] = stampParts(y), el = stampEl, yel = $(".mp-stamp-y", el), was = el.classList.contains("on") ? stampShown : "";
  $(".mp-stamp-k", el).textContent = kick;
  el.classList.add("on", "wait");
  if (big === was) return;
  stampShown = big;
  // each character rolls on its own, left to right, where it changed; the rest stay put
  yel.innerHTML = [...big].map((ch, k) => `<span class="c">${was[k] !== ch && was ? `<span class="o">${esc(was[k] || "")}</span>` : ""}<span class="n">${esc(ch)}</span></span>`).join("");
  if (reduceMotion || !was) return;
  $$(".c", yel).forEach((c, k) => {
    const o = $(".o", c), n = $(".n", c); if (!o) return;
    const opt = { duration: 420, delay: k * 55, easing: "cubic-bezier(.3,.7,.2,1)", fill: "both" };
    o.animate([{ transform: "translateY(0)", opacity: 1 }, { transform: `translateY(${-dir * 70}%)`, opacity: 0 }], opt);
    n.animate([{ transform: `translateY(${dir * 70}%)`, opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], opt);
  });
}
// the election has landed: the rule fills, and the stamp goes once the map has turned
function stampDone(after = 300) {
  stampEl.classList.remove("wait");
  clearTimeout(stampOff);
  stampOff = setTimeout(() => stampEl.classList.remove("on"), after + 900);
}
// the timeline's underline glides from the stop it left to the one chosen
const tlMark = () => { const t = $("#time .yr.on"), l = t && t.nextElementSibling; return l ? l.getBoundingClientRect() : null; };
function tlGlide(r0) {
  const t = $("#time .yr.on"), l = t && t.nextElementSibling;
  if (!r0 || !l || reduceMotion || !l.animate) return;
  const r1 = l.getBoundingClientRect();
  if (!r1.width || (Math.abs(r1.left - r0.left) < 0.5 && Math.abs(r1.top - r0.top) < 0.5)) return;
  l.style.transformBox = "fill-box"; l.style.transformOrigin = "left center";
  l.animate([{ transform: `translate(${r0.left - r1.left}px, ${r0.top - r1.top}px) scaleX(${r0.width / r1.width})` }, { transform: "none" }], { duration: 520, easing: "cubic-bezier(.65,0,.35,1)" });
}
function metaLine(m = M(), sen = senOn() ? SENM : null) {
  if (!m) return "";
  if (sen) return sen.lc ? `${STATE_POSS[stOfYear(sen.year)]} Legislative Council from ${longDate(sen.asOf)} · ${sen.divs.length} members` : sen.year === "now" ? `The Senate as it sits, ${longDate(sen.asOf)} · ${sen.divs.length} senators` : `The Senate from ${longDate(sen.asOf)}, after the ${sen.year} election · ${sen.divs.length} senators`;
  return m.year === "now" ? `The House as it stands, ${longDate(m.asOf)} · ${m.booth.n.toLocaleString("en-AU")} polling places` : STATE_YEARS.has(m.year) ? `${NSW_YEARS.has(m.year) ? "New South Wales" : VIC_YEARS.has(m.year) ? "Victorian" : "South Australian"} election, ${longDate(m.date)} · ${m.divs.length} districts · ${m.booth.n.toLocaleString("en-AU")} polling places` : `The ${m.year} federal election, ${longDate(m.date)} · ${m.divs.length} seats · ${m.booth.n.toLocaleString("en-AU")} polling places`;
}
/* the eyebrow holds the height of its jurisdiction family's longest line, so a walk through one
   family never moves the figure under it: between 414 and 600px an election's line wraps to two
   and Now's fits on one, and with the page at its top no scroll can take that back. Federal and
   each state's lines hold separately — a state's line is short and would sit in the tall federal
   hold — with a family walk moving the head once. Every unloaded year's line is measured from the
   facts assemble.mjs stamps in (data-stamp.mjs); only the chamber view walks into a Senate (and
   back to the House at SA 2026), so only it floors on its family's Senate lines too */
const META_FACTS = /*@meta-facts*/{};
const ebHeights = new Map();
function holdEyebrow() {
  const eb = $(".mp-sec > .rd-eyebrow"), meta = $("#mp-meta"), w = eb.clientWidth;
  if (!w || !M()) return;
  const famOf = (y) => YEAR_JUR[y] || "fed";
  const ch = S.view === "chamber", fam = famOf(S.year), at = `${w}|${ch}|${fam}`;
  if (!ebHeights.has(at)) {
    const keep = meta.textContent, lines = [], H = META_FACTS.house || {}, SN = META_FACTS.senate || {};
    for (const y of YEARS) {
      if (famOf(y) !== fam) continue;
      if (Y[y] && Y[y].divs) { lines.push(metaLine(Y[y], null)); continue; }
      const f = H[y]; if (!f) continue;
      lines.push(metaLine({ year: y, date: f[0], asOf: f[0], divs: { length: f[1] }, booth: { n: f[2] } }, null));
    }
    if (ch) for (const y of SEN_YEARS) {
      if (famOf(y) !== fam) continue;
      const s = SENY[y], f = s ? [s.asOf, s.divs.length] : SN[y]; if (!f) continue;
      lines.push(metaLine(M(), { year: y, lc: s ? s.lc : STATE_YEARS.has(y), asOf: f[0], divs: { length: f[1] } }));
    }
    eb.style.minHeight = "";
    let h = 0;
    for (const t of lines) { meta.textContent = t; h = Math.max(h, eb.getBoundingClientRect().height); }
    meta.textContent = keep;
    ebHeights.set(at, Math.ceil(h - 0.01));
  }
  eb.style.minHeight = ebHeights.get(at) + "px";
}
addEventListener("resize", holdEyebrow);
addEventListener("resize", fitSearchPlaceholder);
addEventListener("resize", lensOverflow);

/* =============================== the frame =============================== */
let raf = 0;
function schedule() { if (!raf) raf = requestAnimationFrame(frame); }
function frame(ts) {
  raf = 0;
  const m = M(); const th = TH;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, Wpx, Hpx);
  if (!m) return;
  let again = false;
  fadeT = 1;
  if (fade) { fadeT = clamp((ts - fade.t0) / fade.dur, 0, 1); if (fadeT < 1) again = true; else { fade = null; for (const y of Object.values(Y)) { y.prevDivCol = y.prevBoothCol = null; } } }
  if (morph) {
    const t = clamp((ts - morph.t0) / morph.dur, 0, 1);
    drawMorph(m, morph.to === "chamber" ? t : 1 - t);
    if (t < 1) again = true; else { morph = null; again = true; }
  } else if (S.view === "map") {
    let mt = 1;
    if (ymorph) { mt = clamp((ts - ymorph.t0) / ymorph.dur, 0, 1); if (mt >= 1 || ymorph.to !== m) ymorph = null; }
    if (ymorph) {
      again = true;
      drawYearMorph(ymorph, mt);
      ovA = smooth(0.55, 1, mt);
      const mo = ymorph;
      drawFocus(m, (i) => mo.cur[i] || geoOf(m).paths[i]);
      drawOldBooths(mo, mt); ovA = smooth(0.55, 1, mt); drawBooths(m);
      if (mo.cross) withT(viaFrame(T, mo.A), () => drawIslands(mo.from, 1 - smooth(0, 0.6, mt)));
      drawIslands(m, mo.cross ? smooth(0.4, 1, mt) : 1); drawLabels(m);
      ovA = 1;
    } else {
      drawGeo(m, 1, streetK());
      drawFocus(m); drawBooths(m); drawIslands(m); drawLabels(m);
    }
    if (ywait) { waitSheen(ts); again = true; }
  } else if (S.view === "chamber") {
    const c = CM();
    if (houseFade) {
      const t = clamp((ts - houseFade.t0) / houseFade.dur, 0, 1), e = ease(t);
      if (t < 1) { again = true; drawChamberMain(houseFade.from, 1 - e); } else houseFade = null;
      if (c) drawChamberMain(c, houseFade ? e : 1);
    } else if (c) drawChamberMain(c, 1);
  }
  showCredit(!morph && S.view === "map" && streetK() > 0.02);
  if (miniCh.canvas && (fade || chAnim || again || miniCh.dirty)) { paintMiniChamber(); miniCh.dirty = false; }
  if (needFrame) { again = true; needFrame = false; }
  if (again) schedule();
  void th;
}
function resize() {
  const r = $("#stage").getBoundingClientRect();
  if (!r.width || !r.height) return;
  const first = !Wpx;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const changed = Math.abs(Wpx - r.width) > 0.5 || Math.abs(Hpx - r.height) > 0.5;
  // only the height moved (the key above the stage grew or shrank): a view the page framed
  // glides to the new fit; one the reader has moved keeps its zoom, centred as before
  const dh = r.height - Hpx, keyOnly = !first && Math.abs(Wpx - r.width) <= 0.5 && changed && S.view === "map";
  const moved = keyOnly && !atLastFit() && !flight;
  Wpx = r.width; Hpx = r.height;
  canvas.width = Math.round(Wpx * dpr); canvas.height = Math.round(Hpx * dpr);
  if (M()) {
    setExtent();
    if (moved) d3.select(canvas).call(zoom.transform, d3.zoomIdentity.translate(T.x, T.y + dh / 2).scale(T.k));
    else if (flight && keyOnly) flight.redo();
    else if (first || changed) fitSelection(keyOnly && !reduceMotion ? 320 : 0);
  }
  updateCanvasVis();
  renderTimeline();
  // setting the canvas's size blanks it: paint it again now, not a frame later (the resize
  // lands between the frame's callbacks and its paint, so a scheduled repaint left one blank frame)
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  frame(performance.now());
}

/* =============================== the URL =============================== */
let urlReady = false;
function writeURL() {
  if (!urlReady) return;
  const m = M(), p = new URLSearchParams();
  if (S.year !== "now") p.set("y", S.year);
  if (S.lens !== "winner") p.set("l", S.lens);
  if (S.lens === "tpp" && S.tppMode === "swing") p.set("m", "swing");
  if (S.lens === "fp") { p.set("p", S.party); if (S.fpMode === "change") p.set("m", "change"); }
  if (S.lens === "senate") { p.set("p", S.party); if (!senGap()) p.set("m", "share"); }
  if (S.lens === "flow") { p.set("p", S.from); if (S.vs !== "lnp") p.set("f", S.vs); }
  if (S.lens === "seifa") { p.set("i", S.index); if (S.basis === "voters") p.set("b", "voters"); if (isCob()) p.set("cb", S.cob); if (isRel() && S.rel !== "norel") p.set("rl", S.rel); if (isTen() && S.ten !== "mort") p.set("tn", S.ten); if (isAnc()) p.set("an", S.anc); }
  if (S.lens === "informal" && S.infMode === "exhaust") p.set("im", "exhaust");
  if (S.view !== "map") p.set("v", S.view);
  if (S.seat) p.set("o", S.seat);
  if (S.house === "senate") {
    p.set("c", "senate");
    if (S.senLens !== "party") p.set("sl", S.senLens);
    const ss = S.ssel;
    if (ss.level === "state") p.set("ss", ss.st);
    else if (ss.level === "sen" && SENM) p.set("ss", SENM.divs[ss.i].n);
  }
  if (m) {
    const s = S.sel;
    if (s.level === "state") p.set("s", s.st);
    else if (s.level === "div") p.set("s", m.divs[s.div].n);
    else if (s.level === "booth") p.set("s", m.divs[s.div].n + "/" + m.booth.id[s.booth]);
    if (s.isl) p.set("at", s.isl);
  }
  const h = p.toString();
  try { history.replaceState(null, "", h ? "#" + h : location.pathname + location.search); } catch (e) {}
}
function readURL() {
  const p = new URLSearchParams(location.hash.slice(1));
  const yr = p.get("y"); if (yr && YEARS.includes(yearOf(yr))) S.year = yearOf(yr);
  const l = p.get("l"); if (l && yearLenses(S.year).some((x) => x.id === l)) S.lens = l;
  const mm = p.get("m"); if (mm === "swing") S.tppMode = "swing"; if (mm === "change") S.fpMode = "change"; if (mm === "share" && S.lens === "senate") S.senMode = "share";
  const pp = p.get("p"); if (pp && FAMS.includes(pp)) { if (S.lens === "flow") S.from = pp; else S.party = pp; }
  S.vs = p.get("f") === "onp" ? "onp" : "lnp";
  const i = p.get("i"); if (i && (IX.includes(i) || DM.includes(i) || i === LENS_REL || i === LENS_TEN || i === LENS_ANC)) S.index = i;
  S.cob = COB_NAME[p.get("cb")] ? p.get("cb") : null;
  S.rel = REL_NAME[p.get("rl")] ? p.get("rl") : "norel";
  S.ten = TEN_NAME[p.get("tn")] ? p.get("tn") : "mort";
  S.anc = ANC_NAME[p.get("an")] ? p.get("an") : "english";
  if (p.get("b") === "voters") S.basis = "voters";
  if (p.get("im") === "exhaust") S.infMode = "exhaust";
  const v = p.get("v"); if (v === "chamber" || v === "list") S.view = v;
  const o = p.get("o"); if (o === "plan" || o === "sort") S.seat = o;
  if (p.get("c") === "senate") { S.house = "senate"; if (SEN_LENSES.some((l) => l.id === p.get("sl"))) S.senLens = p.get("sl"); senFromURL = p.get("ss"); }
  return p.get("s");
}
let senFromURL = null;
function applySenFromURL() {
  const v = senFromURL; senFromURL = null;
  if (!v || !SENM) return;
  if (STATES.includes(v)) S.ssel = { level: "state", st: v };
  else { const i = SENM.byName.get(v); if (i != null) S.ssel = { level: "sen", st: SENM.divs[i].st, i }; }
}
function applySelFromURL(sv) {
  const m = M(); if (!m || !sv) return false;
  if (STATES.includes(sv)) { goState(sv, { fly: false }); return true; }
  const [dn, bid] = sv.split("/");
  const i = m.byName.get(dn); if (i == null) return false;
  if (bid) { const j = m.booth.byDiv[i].find((x) => String(m.booth.id[x]) === bid); if (j != null) { goBooth(j, { fly: false }); return true; } }
  goDiv(i, { fly: false }); return true;
}

/* =============================== events =============================== */
canvas.addEventListener("pointermove", (e) => {
  if (e.buttons || e.pointerType === "touch") return;
  const r = canvas.getBoundingClientRect();
  const h = hitTest(e.clientX - r.left, e.clientY - r.top);
  const same = (h && S.hover && h.kind === S.hover.kind && h.i === S.hover.i) || (!h && !S.hover);
  if (!same) { S.hover = h; schedule(); }
  if (h) showTipAt(tipFor(h), e.clientX, e.clientY); else hideTip();
  canvas.style.cursor = h ? "pointer" : "";
});
canvas.addEventListener("pointerleave", () => { S.hover = null; hideTip(); schedule(); });
canvas.addEventListener("click", (e) => {
  const r = canvas.getBoundingClientRect();
  const h = hitTest(e.clientX - r.left, e.clientY - r.top);
  if (h && h.kind === "sen") { selectSen({ level: "sen", st: SENM.divs[h.i].st, i: h.i }); return; }
  if (!h && senOn()) { if (S.ssel.level !== "aus") selectSen({ level: "aus" }); return; }
  if (!h) {
    // a miss lets the selection go — on the map only near the whole-country
    // fit (a zoomed miss is a pan mis-tap); the chamber has no camera, so a
    // click away from the seats always deselects
    if (S.sel.level === "aus") return;
    if (S.view === "chamber" || (S.view === "map" && T.k < HOME.k * 1.4)) goAus();
    return;
  }
  if (h.go) goIsland(h.go);
  else if (h.kind === "booth") goBooth(h.i);
  else goDiv(h.i, { fly: S.view === "map" });
});
// the small chamber in the story
$("#story").addEventListener("pointermove", (e) => {
  const c = e.target.closest("#minich");
  if (!c) { if (miniCh.hover != null) { miniCh.hover = null; miniCh.dirty = true; S.hover = null; hideTip(); schedule(); } return; }
  const r = c.getBoundingClientRect(), i = miniHit(e.clientX - r.left, e.clientY - r.top);
  if (i !== miniCh.hover) { miniCh.hover = i; miniCh.dirty = true; S.hover = i == null ? null : { kind: "div", i }; schedule(); }
  if (i != null) showTipAt(tipFor({ kind: "div", i }), e.clientX, e.clientY); else hideTip();
  c.style.cursor = i != null ? "pointer" : "";
});
$("#story").addEventListener("click", (e) => {
  const c = e.target.closest("#minich");
  if (c) { const r = c.getBoundingClientRect(), i = miniHit(e.clientX - r.left, e.clientY - r.top); if (i != null) goDiv(i); return; }
  const g = e.target.closest("g[data-year]"); if (g) { setYear(yearOf(g.dataset.year)); }
});
// a tap names the fixed view's spot before any handler acts on it
document.addEventListener("click", (e) => walkAim(e.clientY), true);
$("#time").addEventListener("click", (e) => { const g = e.target.closest("[data-year]"); if (g) setYear(yearOf(g.dataset.year)); });
// a stop under the pointer starts loading its election, so the click finds it ready
$("#time").addEventListener("pointerover", (e) => { const g = e.target.closest("[data-year]"); if (g) { const y = yearOf(g.dataset.year); if (!Y[y]) setTimeout(() => loadYear(y).catch(() => {}), 120); } });
document.addEventListener("click", (e) => {
  const city = e.target.closest("[data-city]");
  if (city) { flyToCity(+city.dataset.city); return; }
  const t = e.target.closest("[data-go],[data-lens],[data-view],[data-sort],[data-unit],[data-unseat],[data-unrange],[data-distclose],[data-dist],[data-listbooths],[data-showmap],[data-more],[data-clear],[data-n],[data-flip],[data-seat],[data-house],[data-slens],[data-sgo]");
  if (!t) { if (!e.target.closest(".mp-search")) $("#sugg").hidden = true; return; }
  const m = M();
  if (t.dataset.n != null && t.closest("#sugg")) { chooseSugg(+t.dataset.n); return; }
  if (t.dataset.go != null) {
    const [k, ...rest] = t.dataset.go.split(":"); const v = rest.join(":");
    if (k === "aus") goAus(); else if (k === "state") goState(v); else if (k === "div") goDiv(+v, { fly: S.view === "map" }); else if (k === "booth") goBooth(+v, { view: S.view === "chamber" ? "map" : undefined });
    else if (k === "divname") { const i = m.byName.get(v); if (i != null) goDiv(i, { fly: S.view === "map" }); }
    return;
  }
  if (t.dataset.lens) { setLens(t.dataset.lens); return; }
  if (t.dataset.house) { setHouse(t.dataset.house); return; }
  if (t.dataset.slens) { setSenLens(t.dataset.slens); return; }
  if (t.dataset.sgo && SENM) { const [k, v] = t.dataset.sgo.split(":"); selectSen(k === "aus" ? { level: "aus" } : k === "state" ? { level: "state", st: v } : { level: "sen", st: SENM.divs[+v].st, i: +v }); return; }
  if (t.dataset.view) { setView(t.dataset.view); return; }
  if (t.dataset.seat) { if (t.dataset.seat !== seatMode(CM() || M())) { S.seat = t.dataset.seat; startChamberGlide(); renderLegend(); writeURL(); schedule(); miniCh.dirty = true; } return; }
  if (t.dataset.flip === "tpp") { S.tppMode = S.tppMode === "swing" ? "share" : "swing"; lensParamChanged(); return; }
  if (t.dataset.flip === "fp") { S.fpMode = S.fpMode === "change" ? "share" : "change"; lensParamChanged(); return; }
  if (t.dataset.flip === "sen") { S.senMode = senGap() ? "share" : "gap"; lensParamChanged(); return; }
  if (t.dataset.dist) { S.dist = S.dist === t.dataset.dist ? null : t.dataset.dist; renderList(true); return; }
  if (t.hasAttribute("data-distclose")) { S.dist = null; renderList(true); return; }
  if (t.dataset.sort) { const k = t.dataset.sort; const cur = S.sort && S.sort.key === k ? S.sort : null; const col = listCache && listCache.cols.find((c) => c.key === k); S.sort = { key: k, dir: cur ? -cur.dir : col && !col.num ? 1 : -1 }; renderList(true); return; }
  if (t.dataset.unit) { S.listUnit = t.dataset.unit; S.sort = null; S.dist = S.dist; if (S.f.range && S.f.range.unit !== S.listUnit) S.f.range = null; renderList(); renderFilterPill(); schedule(); return; }
  if (t.hasAttribute("data-unseat")) { goState(S.sel.st); return; }
  if (t.hasAttribute("data-unrange")) { S.f.range = null; filtersChanged(); return; }
  if (t.hasAttribute("data-listbooths")) { S.listUnit = "booths"; S.sort = null; if (S.f.range && S.f.range.unit !== "booths") S.f.range = null; setView("list"); return; }
  if (t.hasAttribute("data-showmap")) { setView("map"); fitSelection(700); return; }
  if (t.hasAttribute("data-more")) { $$("[data-extra]", t.parentElement).forEach((r) => (r.hidden = false)); t.remove(); return; }
  if (t.hasAttribute("data-clear")) { S.f = { st: null, cls: null, win: null, margin: null, range: null }; filtersChanged(); return; }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.opt) {
    const k = t.dataset.opt;
    // (a new rival takes the place of the group it was: One Nation's preferences can't be read against One Nation)
    if (k === "vs") { S.vs = t.value; if (S.from === t.value) S.from = t.value === "onp" ? "lnp" : "onp"; }
    if (k === "party") S.party = t.value; else if (k === "from") S.from = t.value; else if (k === "index") S.index = t.value; else if (k === "basis") S.basis = t.value; else if (k === "infm") S.infMode = t.value; else if (k === "cob") S.cob = t.value || null; else if (k === "rel") S.rel = t.value || "norel"; else if (k === "ten") S.ten = t.value || "mort"; else if (k === "anc") S.anc = t.value || "english";
    lensParamChanged(); return;
  }
  if (t.dataset.fsel) { S.f[t.dataset.fsel] = t.value || null; filtersChanged(); return; }
});
document.addEventListener("keydown", (e) => {
  const sp = e.target.closest && e.target.closest(".ls-spark");
  if (sp && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); sp.click(); }
});
const q = $("#q");
q.addEventListener("input", () => { S.q = q.value; runSearch(); });
q.addEventListener("keydown", (e) => {
  const el = $("#sugg");
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { if (el.hidden || !sugg.length) return; e.preventDefault(); suggAt = (suggAt + (e.key === "ArrowDown" ? 1 : -1) + sugg.length) % sugg.length; $$("button", el).forEach((b) => b.setAttribute("aria-selected", String(+b.dataset.n === suggAt))); $(`button[data-n="${suggAt}"]`, el)?.scrollIntoView({ block: "nearest" }); }
  else if (e.key === "Enter") { if (S.view !== "list" && suggAt >= 0) { e.preventDefault(); chooseSugg(suggAt); } }
  else if (e.key === "Escape") { el.hidden = true; q.blur(); }
});
q.addEventListener("focus", () => { if (S.q.trim().length >= 2 && S.view !== "list") runSearch(); });
// with the pointer over the lens row the arrows walk the lenses, not the years;
// on a phone the row scrolls horizontally, the All-polls menubar way
let lensHover = false;
$("#lenses").addEventListener("pointerenter", () => { lensHover = true; });
$("#lenses").addEventListener("pointerleave", () => { lensHover = false; });
document.addEventListener("keydown", (e) => {
  const typing = e.target.closest && e.target.closest("input,select,textarea");
  if (e.key === "/" && !typing) { e.preventDefault(); q.focus({ preventScroll: true }); q.scrollIntoView({ block: "nearest", behavior: "smooth" }); return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "Escape") {
    if (senOn()) { const s = S.ssel; if (s.level === "sen") selectSen({ level: "state", st: s.st }); else if (s.level === "state") selectSen({ level: "aus" }); }
    else goUp();
  }
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); (lensHover ? walkLens : walkYear)(e.key === "ArrowRight" ? 1 : -1); }
  if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); walkLane(e.key === "ArrowDown" ? 1 : -1); }
});
$("#zin").addEventListener("click", () => zoomBy(1.8));
$("#zout").addEventListener("click", () => zoomBy(1 / 1.8));
$("#zhome").addEventListener("click", () => goAus());
function themeChanged() {
  TH = readTheme(); buildRamps(); hatchCanvas = null; recolor(false); renderLegend(); renderStory(true); renderTimeline();
  if (S.view === "list") renderList(true);
  schedule();
}
// the site's theme switch sets sh-light / sh-dark on <html> (site-shell.js); "auto" follows the system
new MutationObserver(() => { if (TH && TH.dark !== isDark()) themeChanged(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (TH && TH.dark !== isDark()) themeChanged(); });
new ResizeObserver(() => resize()).observe($("#stage"));
new ResizeObserver(() => { renderTimeline(); }).observe($("#time"));
let storyW = 0;
new ResizeObserver((es) => { const w = es[0].contentRect.width; if (Math.abs(w - storyW) > 1) { storyW = w; paintMiniChamber(); hydrateDists(); } }).observe($("#story"));
let cullRaf = 0;
addEventListener("scroll", () => { if (!cullRaf) cullRaf = requestAnimationFrame(() => { cullRaf = 0; updateCanvasVis(); }); }, { passive: true });

/* once the page is up, every other election loads in the background — nearest
   timeline stops first, one idle slice at a time — so a timeline jump, a
   chamber switch or the Senate lens finds its data already here. Skipped where
   the connection asks to save data (the timeline's hover preload still covers
   a stop the reader nears); a year's failed fetch drops its record so a real
   click tries it again. The Handbook years never ride this loop — their
   lossless geometry is 6.5–19MB a year, fetched only on hover/click demand */
const idleSlice = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 900));
function preloadYears() {
  const conn = navigator.connection || {};
  if (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "")) return;
  const at = YEARS.indexOf(S.year);
  const stops = YEARS.filter((y) => !Y[y] && !HANDBOOK_YEARS.has(y)).sort((a, b) => Math.abs(YEARS.indexOf(a) - at) - Math.abs(YEARS.indexOf(b) - at));
  const next = () => {
    const y = stops.shift();
    if (y != null) return void loadYear(y).catch(() => { if (Y[y] && !Y[y].divs) delete Y[y]; }).then(() => idleSlice(next));
    // the chambers' lane, cheap beside the years: every Senate (~7KB each) and
    // its floor, then the Senate-vote lens files (the AEC served no 2004 count)
    loadSenates().catch(() => {});
    loadSenateFloor().catch(() => {});
    for (const sy of SEN_YEARS) { const k = svYear(sy); if (k != null && k !== 2004) loadSenateVote(sy).catch(() => {}); }
  };
  idleSlice(next);
}

/* =============================== boot =============================== */
(async () => {
  TH = readTheme(); buildRamps();
  const selFromURL = readURL();
  renderLenses();
  $$(".mp-views .rd-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === S.view)));
  $("#cities").innerHTML = CITIES.map(([n], k) => `<button type="button" data-city="${k}">${n}</button>`).join("");
  const meta = loadLegendMeta();
  showLoading(true);
  try { await Promise.all([loadYear(S.year), meta, S.lens === "senate" ? loadSenateVote(S.year) : null]); } catch (err) { showLoading(true, "The map’s data didn’t load. Reload the page to try again."); return; }
  // a deep-linked birthplace picks what the year's own menu can't print
  // (England on 2013): clamp before the first render, at the model —
  // never inside loadYear (idle preloads of every year mustn't touch S)
  const bmc = M();
  if (S.cob != null && bmc && !(bmc.cobKeys || []).includes(S.cob)) S.cob = null;
  if (bmc && !(bmc.relKeys || []).includes(S.rel)) S.rel = (bmc.relKeys || [])[0] || "norel";
  if (bmc && !(bmc.tenKeys || []).includes(S.ten)) S.ten = (bmc.tenKeys || [])[0] || "mort";
  if (bmc && !(bmc.ancKeys || []).includes(S.anc)) S.anc = (bmc.ancKeys || [])[0] || "english";
  if (bmc && !bmc.ancKeys && S.index === LENS_ANC) S.index = "irsad";
  if (bmc && !bmc.relKeys && S.index === LENS_REL) S.index = "irsad";
  if (bmc && !bmc.tenKeys && S.index === LENS_TEN) S.index = "irsad";
  if (S.house === "senate") { try { await Promise.all([loadSenateFloor(), loadSenate(S.year)]); syncSenate(); applySenFromURL(); loadSenates(); } catch (e) { S.house = "reps"; } }
  showLoading(false);
  $("#mp-meta").textContent = metaLine(); holdEyebrow();
  recolor(false);
  resize();
  const view = S.view; S.view = "map"; if (view !== "map") setView(view, true);
  renderLenses();
  morph = null; // landing mid-state is not a transition between views
  $("#view").classList.toggle("v-chamber", S.view === "chamber");
  if (!applySelFromURL(selFromURL)) goAus({ fly: false });
  { const at = new URLSearchParams(location.hash.slice(1)).get("at"); if (at && islOf(M(), at)) S.sel = { ...S.sel, isl: at }; }
  fitSelection(0, true); // frame the map's transform even when the page opened on the chamber
  urlReady = true; writeURL();
  renderLegend(); updateHint(); renderTimeline(); renderBack();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { schedule(); renderTimeline(); paintMiniChamber(); ebHeights.clear(); holdEyebrow(); });
  window.__map = { S, Y, walk(dir, y) { walkAim(y); walkYear(dir, true); }, walkLane, select, goDiv, goBooth, goState, goAus, setLens, setView, setYear, get T() { return T; }, get HOME() { return HOME; }, get ymorph() { return ymorph; },
    get away() { return away; },
    get islands() { return islDrawn.map((c) => ({ key: c.s.key, r: c.r, docked: c.docked, dots: c.dots.map((d) => ({ j: d.j, x: d.x, y: d.y })) })); },
    landAt(px, py) { const m = M(); if (!m) return false; const g = geoOf(m); if (!g || !g.paths) return false; const bx = (px - T.x) / T.k, by = (py - T.y) / T.k; for (let i = 0; i < m.divs.length; i++) { const q = g.bb[i]; if (!q || bx < q[0][0] || bx > q[1][0] || by < q[0][1] || by > q[1][1]) continue; if (hitCtx.isPointInPath(g.paths[i], bx, by)) return true; } return false; },
    drawNow() { const t0 = performance.now(); frame(t0); if (raf) { cancelAnimationFrame(raf); raf = 0; } return performance.now() - t0; },
    panBy(dx, dy) { return panPx(dx, dy); },
    view(ll, k) { const p = proj(ll); d3.select(canvas).call(zoom.transform, d3.zoomIdentity.translate(Wpx / 2 - p[0] * k, Hpx / 2 - p[1] * k).scale(k)); } };
  preloadYears();
})();
