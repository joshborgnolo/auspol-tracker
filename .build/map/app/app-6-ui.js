/* =============================== lens words =============================== */
function lensShort() {
  switch (S.lens) {
    case "winner": return isNowY(S.year) ? "Held by" : "Winner";
    case "tpp": return S.tppMode === "swing" ? "Swing to Labor" : axisNow(M()) !== "AC" ? `${axisCap()[0]} v ${axisNames()[1]}` : "Labor 2PP";
    case "fp": return S.fpMode === "change" ? `${famLeg(S.party)} change` : `${famLeg(S.party)} primary`;
    case "senate": return senGap() ? `${famLeg(S.party)}, Senate v House` : `${famLeg(S.party)} Senate vote`;
    case "flow": return `${famLeg(S.from)} to Labor`;
    case "senpref": return `${famLeg(S.spFrom)} Senate: ${spA(true)} v ${spB()}`;
    case "informal": return infModeOf(M()) === "exhaust" ? "Exhausted ballots" : "Informal";
    case "cls": return "Seat type";
    case "seifa": return isDemo() ? (isRel() ? REL_NAME[S.rel] : isTen() ? TEN_NAME[S.ten] : isAnc() ? `${ANC_NAME[S.anc]} ancestry` : isInc() ? `Income: ${INC_SHORT[S.incMode]}` : isAge() ? `Age: ${AGE_SHORT[S.ageMode]}` : isEdu() ? `Education: ${EDU_SHORT[S.eduMode]}` : isCob() ? `Born in ${COB_SHORT[S.cob]}` : DM_SHORT[S.index]) : `${IX_ABBR[S.index]} decile`;
  }
  return "";
}
/* the lens as a list-table column head: every party coded, all of one register */
function lensHead() {
  switch (S.lens) {
    case "fp": return S.fpMode === "change" ? `${FAM_CODE[S.party]} change` : `${FAM_CODE[S.party]} primary`;
    case "senate": return senGap() ? `${FAM_CODE[S.party]} gap` : `${FAM_CODE[S.party]} Senate`;
    case "flow": return `${FAM_CODE[S.from]} to Labor`;
    case "senpref": return `${FAM_CODE[S.spFrom]} Senate to ${FAM_CODE[SP_PAIRS[S.spPair][0]]}`;
    default: return lensShort();
  }
}
function valueText(v, kind, ctx) {
  if (v == null) {
    switch (S.lens) {
      case "senate": return ctx ? senNoValue(ctx.m, kind, ctx.d) : "No Senate count here";
      case "tpp": return S.tppMode === "swing" ? (kind === "booth" ? "New place, so no swing" : "No swing recorded") : axisNow(M()) !== "AC" ? "These two didn’t both stand here" : "No Labor v Coalition count";
      case "flow": return "Final two weren’t Labor and the Coalition";
      case "senpref": return ctx ? spNoValue(ctx.m, kind, ctx.d) : "Too few of these ballots";
      case "seifa": return isDemo() ? (S.year !== "now" && S.year < DEMO_FROM ? "Counted from 1993 on" : "No census figure here") : "No score here";
      case "fp":
        if (S.fpMode !== "change") return "Didn’t stand";
        if (kind !== "booth") return "Didn’t stand both times";
        // a booth's null is never about the party: it's a lapsed venue (the
        // frame carries the same-place lane) or no lane existed for the year
        return ctx && ctx.m.res.booths && ctx.m.res.booths.prevFp ? "New place since last time, so no change" : "No like-for-like count on file for this election";
      default: return "No data";
    }
  }
  switch (S.lens) {
    case "winner": return kind === "booth" ? `${FAM_NAME[v]} led here` : FAM_NAME[v];
    case "tpp": {
      if (S.tppMode !== "swing" && axisNow(M()) !== "AC") { const [A, B] = axisCap(); return `${A} ${f1(v)} · ${B.replace(/^The /, "")} ${f1(100 - v)}`; }
      return S.tppMode === "swing" ? (Math.abs(v) < 0.05 ? "No swing" : `${f1(Math.abs(v))} swing to ${v > 0 ? "Labor" : "the Coalition"}`) : `Labor ${f1(v)} · Coalition ${f1(100 - v)}`;
    }
    case "fp": return S.fpMode === "change" ? `${famLeg(S.party)} ${sgn(v)} points` : `${famLeg(S.party)} ${f1(v)}%`;
    case "senate": return senGap() ? `${famLeg(S.party)} ${Math.abs(v) < 0.05 ? "level" : `${pts(v)} ${v > 0 ? "higher" : "lower"}`} in the Senate` : `${famLeg(S.party)} ${f1(v)}% in the Senate`;
    case "flow": return `${f0(v)}% of ${famLeg(S.from)} preferences to Labor`;
    case "senpref": return `${f0(v)}% ranked ${spA()} ahead of ${spB()}`;
    case "informal": return infModeOf(M()) === "exhaust" ? `${f1(v)}% exhausted` : `${f1(v)}% informal`;
    case "cls": return CLS_SHORT[v] || v;
    case "seifa": return isDemo() ? (incMed() ? `${mny(v)} a week, the median household income` : ageMed() ? `age ${Math.round(v)}, the median age` : `${f1(v)}% ${dmVerb(M(), S.index)}`) : `Decile ${v} of 10`;
  }
  return "";
}

/* =============================== the lens tabs =============================== */
// the search box promises as much as its width can show, never clipped mid-word
let phCtx = null;
function fitSearchPlaceholder() {
  const input = $("#q"), sen = S.view === "chamber" && S.house === "senate";
  const list = sen ? ["Search a senator or state", "Search a senator", "Search"] : ["Search a seat, town, member or place", "Search a seat, member or place", "Search a seat or member", "Search"];
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
  // (the row's holder: the page's lens row, or in full screen its plate)
  el.parentElement.classList.toggle("more", el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
}
// the House's lenses, or in the Senate's chamber the Senate's own
function renderLenses() {
  // Basis now lives with the map key; retain the empty mount for fullscreen parking.
  $("#lenses").innerHTML = "";
  $("#lenses").hidden = true;
  fitSearchPlaceholder();
}

/* =============================== the legend =============================== */
let legendKey = "";
// (boothsAs: the key's measure asks for one side or the other, below)
let boothsAs = null;
const boothsShown = () => boothsAs ?? (S.view === "map" && (selDiv() != null || T.k >= K_ALL || drawOf(M()) !== "seats"));
const legendState = () => [S.view, boothsShown(), S.draw, S.axis, S.draw === "balloons" ? Math.round(2 * Math.log2(Math.max(1, T.k / HOME.k))) : 0, S.lens, S.tppMode, S.fpMode, S.senMode, S.infMode, S.incMode, S.ageMode, S.eduMode, S.party, S.from, S.vs, S.spPair, S.spFrom, S.index, S.year, S.seat, S.house, S.senLens, TH && TH.dark].join("|");
// the Preferences key's source switch: the House's counted splits, or the Senate's ballots (federal years)
let lensFlip = false;
const flowSrcBtn = (m) => (STATE_YEARS.has(m.year) || (spYear(m.year) == null && S.lens !== "senpref") ? "" : ` <button type="button" class="flip" data-flip="flowsrc">${S.lens === "senpref" ? (spGvtYear(m.year) != null ? "Senate tickets" : "Senate ballots") : "Counted in the House"}<span>⇄</span></button>`);
function legendIfChanged() { if (legendState() !== legendKey) renderLegend(); }
const RANGE = () => {
  switch (S.lens) {
    case "tpp": return S.tppMode === "swing" ? [-10, 10] : axisNow(M()) !== "AC" ? [50 - axisSpan(), 50 + axisSpan()] : [30, 70];
    case "fp": return S.fpMode === "change" ? [-15, 15] : [0, FPMAX[S.party]];
    case "senate": return senGap() ? [-10, 10] : [0, FPMAX[S.party]];
    case "flow": case "senpref": return [10, 90];
    case "informal": return [0, infHi(M())];
    case "seifa": return isDemo() ? demoRange() : [1, 10];
  }
  return null;
};
function renderLegend() {
  legendKey = legendState();
  const el = $("#legend"), m = M();
  // the key shows in all three views: the list reads the same lens values
  // (its coloured cells) as the map and chamber, so it needs the same key —
  // census measure picker, ramps and switchers included
  if (!m) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = senOn() ? senateLegendHTML(SENM) : legendHTML(m);
  renderJumpSel();
  el.style.minHeight = "";
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
    SUM ? null : getJSON("/map/data/summary.json").then((s) => { SUM = s; renderTimeline(); if (M() && pickerLens()) renderStory(true); }),
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
  const key = [w, S.view, y, real, S.lens, S.draw, S.tppMode, S.fpMode, S.senMode, S.infMode, S.index, S.cob, S.seat].join("|");
  if (!legendHeights.has(key)) {
    const keep = { seat: S.seat, year: S.year, draw: S.draw };
    let hMax = 0;
    try {
      S.year = y;
      const my = legendStandIn(m, y);
      for (const seat of S.view === "chamber" && my.seating ? ["plan", "sort"] : [keep.seat]) {
        S.seat = seat;
        // the hold is the current draw's two faces (seats · polling places), not
        // every surface's — slimmer views stop inheriting taller surfaces' peaks
        for (const bo of S.view === "map" ? [false, true] : [false]) for (const dw of [S.draw]) {
          boothsAs = bo; S.draw = dw;
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
  // (on a 4px lattice: frames load behind the reader and each can round a pixel taller, which would nudge the stage)
  el.style.minHeight = Math.ceil(h / 4) * 4 + "px";
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
  const out = [`<select${c} data-opt="index" aria-label="Census measure">${og("Advantage, ABS SEIFA", ixFor(m).map((x) => [x, `${IX_NAME[x]} (${IX_ABBR[x]})`]))}${og("People", [...dmFor(m).map((x) => [x, DM_NAME[x]]), ...peopleExtra])}</select>`];
  if (isDemo()) {
    // on Household income a second picker reads the measure: the median
    // spectrum lands; the two share views sit beside it (loinc/hiinc as
    // standalone menu lanes until 2026-10-31)
    if (S.index === LENS_INC && hasInc(m)) out.push(`<select${c} data-opt="incv" aria-label="Income measure">${INC_MODES.map((k) => `<option value="${k}"${S.incMode === k ? " selected" : ""}>${INC_NAME[k]}</option>`).join("")}</select>`);
    // on Age the same picker reads the six views: the median-age spectrum
    // lands, the aged shares beside it (a65/a2034 as menu lanes until
    // 2026-10-31, three new brackets same day)
    if (S.index === LENS_AGE) out.push(`<select${c} data-opt="agev" aria-label="Age view">${AGE_MODES.map((k) => `<option value="${k}"${S.ageMode === k ? " selected" : ""}>${AGE_NAME[k]}</option>`).join("")}</select>`);
    // on Education the same picker reads the two schooling views: the
    // university share lands, the left-school-early read beside it
    // (uni/y12less as standalone menu lanes until 2026-10-31). The picker
    // appears only between reads the frame actually printed: the
    // statistics-era frames carry the qualification read alone
    {
      const eduOpts = EDU_MODES.filter((k) => !m.hasLane || m.hasLane[k] !== false);
      if (S.index === LENS_EDU && eduOpts.length > 1) out.push(`<select${c} data-opt="eduv" aria-label="Education view">${eduOpts.map((k) => `<option value="${k}"${S.eduMode === k ? " selected" : ""}>${EDU_NAME[k]}</option>`).join("")}</select>`);
    }
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
function basisHTML() {
  const sen = S.view === "chamber" && S.house === "senate";
  const list = sen ? SEN_LENSES : yearLenses(S.year);
  const cur = sen ? S.senLens : S.lens === "senpref" ? "flow" : S.lens;
  return `<label class="lg-t lg-basis">Basis: <select data-opt="${sen ? "senbasis" : "basis"}" aria-label="Basis">${list.map((l) => `<option value="${l.id}"${cur === l.id ? " selected" : ""}>${l.id === "informal" ? "Informality" : l.label}</option>`).join("")}</select></label>`;
}
function legendHTML(m) {
  const prev = isNowY(m.year) ? m.res.prev : prevYearOf(m.year) ?? (m.res && m.res.prev);
  const aus = m.areas.AUS;
  const boothsOn = boothsShown();
  const opt = (name, cur, list) => `<select data-opt="${name}" aria-label="${name}">${list.map(([v, t]) => `<option value="${v}"${cur === v ? " selected" : ""}>${t}</option>`).join("")}</select>`;
  const partyOpts = famEraOpts(m).map((f) => [f, famLeg(f)]);
  // the Drawn-as switch closes the winner strip's bottom line (user call 2026-11-07)
  const drawRow = S.view === "map" ? drawRowHTML(m) : "";
  // the chamber view chooses its chamber first
  let h = (S.view === "chamber" ? houseSwitchHTML() : "") + basisHTML();
  switch (S.lens) {
    case "winner": {
      break;
    }
    case "tpp": {
      const sw = S.tppMode === "swing", pair = axisNow(m);
      h += `<div class="lg-t">Two-party preferred: <button type="button" class="flip" data-flip="tpp">${sw ? `swing since ${prev}` : "share"}<span>⇄</span></button></div>`;
      // as balloons or a surface, where One Nation stood widely, the two parties can be another two
      if (!sw && S.view === "map" && S.draw !== "seats" && axisFrame(m) != null) h += `<div class="lg-t lg-contest">${opt("axis", S.axis, axisOpts(m))}<span>${pair === "AC" ? "counted" : "estimate"}</span></div>`;
      if (pair !== "AC") break;
      if (boothsOn && sw) h += `<div class="lg-note"><span class="lg-hatch"></span>Place not used last time</div>`;
      break;
    }
    case "fp": {
      const ch = S.fpMode === "change";
      h += `<div class="lg-t">${opt("party", S.party, partyOpts)} first preferences: <button type="button" class="flip" data-flip="fp">${ch ? `change on ${prev}` : "share"}<span>⇄</span></button></div>`;

      h += `<div class="lg-note">Australia: ${ch ? sgn(aus.fpSw[S.party]) + " points" : f1(aus.fp[S.party]) + "%"}.</div>`;
      if (boothsOn && ch && m.res.booths && m.res.booths.prevFp) h += `<div class="lg-note"><span class="lg-hatch"></span>Place not used last time</div>`;
      break;
    }
    case "senate": {
      const gap = senGap(), none = svYear(m.year) == null;
      h += `<div class="lg-t">${opt("party", S.party, partyOpts)} <button type="button" class="flip" data-flip="sen">${gap ? "Senate less House" : "Senate share"}<span>⇄</span></button></div>`;

      if (none || gap || (boothsOn && svYear(m.year) === 2004)) h += `<div class="lg-note">${none ? "A state election: there was no Senate vote." : `${gap ? "Drawn where the party stood for the House." : ""}${boothsOn && svYear(m.year) === 2004 ? " The AEC published no 2004 Senate counts by polling place." : ""}`}</div>`;
      break;
    }
    case "flow": {
      // Labor's rival in the final: the Coalition, or One Nation where the year has such finals on file;
      // the groups whose preferences can be read are the other parties'
      const from = [["grn", "the Greens’"], S.vs === "onp" ? ["lnp", STATE_YEARS.has(m.year) ? "the Liberals’" : "the Coalition’s"] : ["onp", "One Nation’s"], ["ind", "independents’"], ["oth", "other candidates’"]];
      h += `<div class="lg-t">Where ${opt("from", S.from, from)} preferences went${hasVsOnp(m) ? `, Labor v ${opt("vs", S.vs, [["lnp", STATE_YEARS.has(m.year) ? "the Liberals" : "the Coalition"], ["onp", "One Nation"]])}` : ""}${flowSrcBtn(m)}</div>`;

      h += `<div class="lg-note"><span class="lg-hatch"></span>Final two weren’t Labor and ${vsW()}</div>`;
      const fe = m.res.flBasis === "modelled" ? flowErrOf(m, S.from) : null;
      if (fe) h += `<div class="lg-note">Modelled estimates — South Australia publishes no per-candidate splits. ${fe.seat ? `Nine in ten of the model’s per-seat estimates land within ${f0(fe.v)} points of a counted split.` : `Labor v One Nation splits are checked only in total, to within about ${f0(fe.v)} points, never seat by seat.`}</div>`;
      if (m.res.flOpv) h += `<div class="lg-note">Counted, not modelled — New South Wales re-counted every ballot paper. Preferences there are optional, so a ballot can exhaust before the final two; a share reads the ballots that reached them.</div>`;
      break;
    }
    case "senpref": {
      const none = spYear(m.year) == null, gvt = spGvtYear(m.year) != null;
      h += `<div class="lg-t">How ${opt("spfrom", S.spFrom, spDonorOpts())} Senate ${gvt ? "tickets put" : "voters ranked"} ${opt("sppair", S.spPair, SP_PAIR_OPTS)}${flowSrcBtn(m)}</div>`;

      h += `<div class="lg-note">${spYear(m.year) == null ? "A state election has no Senate-ballot preference record here." : none ? "No Senate preference record before 2004 — group tickets are published from then, every ballot's own order only from 2016." : gvt ? `Lodged group voting tickets, ${m.year} — the order a party-box vote copied that year; how voters numbered their own papers is published only from 2016.` : STATE_YEARS.has(m.year) ? "Every formal upper-house ballot in New South Wales, by which of the two it numbered first; ballots numbering neither are set aside." : "Every formal Senate ballot, by which of the two it numbered first; ballots numbering neither are set aside."}</div><div class="lg-note"><span class="lg-hatch"></span>Fewer than ${SP_MIN} of these ballots name either</div>`;
      break;
    }
    case "informal": {
      const exh = infModeOf(m) === "exhaust";
      // the exhausted view is offered only where the count is optional-preferential —
      // like the census switcher, the same legend swaps measure under the lens
      const opts = m.res && m.res.flOpv ? `<select data-opt="infm" aria-label="Informal lens view"><option value="informal"${S.infMode === "informal" ? " selected" : ""}>Informal</option><option value="exhaust"${S.infMode === "exhaust" ? " selected" : ""}>Exhausted ballots</option></select> ` : "";
      h += `<div class="lg-t">${opts}${exh ? "ballots exhausting before the final two" : "Informal ballots"}</div>`;
      if (exh) h += `<div class="lg-note">Share of formal ballots that ran out of preferences — New South Wales votes optional-preferential, so a ballot leaves the count when its numbered candidates are gone. ${stNameCap(m.year)}: ${f1(aus.exhPct)}%.</div>`;
      else h += `<div class="lg-note">Australia: ${f1(aus.infPct)}%.</div>`;
      break;
    }
    case "cls":
      break;
    case "seifa": {
      // the census pickers come from the shared builder: the list bar lays
      // the same selects out too (this legend is hidden in the list view)
      for (const s of censusSelects(m)) h += `<div class="lg-t">${s}</div>`;
      if (isDemo()) {
        const early = m.year !== "now" && m.year < DEMO_FROM;
        // the Areas drawing keys off the pack's own per-lane extents (a
        // population-weighted 99.5th percentile rounded up), never the seats'
        // caps; a lane's little histogram is the SEATS' spread, so it stays out
        const arOn = drawOf(m) === "areas" && AR.packOf != null && AR.pack, arLane = arOn && areasLane();
        const arCap = arOn && arLane && arOn.caps[arLane];
        const [lo, hi] = arCap || demoRange();
        // an income lane can arrive by hash on a year whose store carries
        // none (income starts 2001); it reads as its own kind of early
        const noInc = isInc() && !hasInc(m);

        // the Australia's-line marker: pooled shares as ever; the Age
        // family's median and three new views ride the ageCuts record
        // (medians and pool-computed national reads, never pooled here)
        const ausShare = isAge()
          ? (S.ageMode === "med" ? (m.ageCuts && m.ageCuts.medAge) : (["a1824", "a3554", "a75"].includes(S.ageMode) ? (m.ageCuts && m.ageCuts[S.ageMode]) : (aus.demo && demoAreaShare(aus.demo))))
          : (aus.demo && demoAreaShare(aus.demo));
        // the median lanes price their axes in dollars and years; every
        // other people lane reads percentages
        const demoTick = incMed() ? (v) => `${mny(v)}${v === hi ? "+" : ""}` : ageMed() ? (v) => `${Math.round(v)}${v === hi ? "+" : ""}` : (v) => `${v}%${v === hi ? "+" : ""}`;
        // the income lanes' note names their own cut in the census
        // year's dollars — the median spectrum reads the national
        // household line straight — then the same census-basis tail
        // (interpolated years name the blend, never one epoch)
        const incEpochBrk = `${m.demoInterp ? " (census-year dollars)" : m.incomeCuts && m.incomeCuts.dollarsYear ? ` (${m.incomeCuts.dollarsYear} dollars)` : ""}`;
        // a frame without a national median record (the state frames'
        // GCP lanes today) shows the seats' medians only — the note says
        // why the places carry none
        const incMedNote = m.incomeCuts && m.incomeCuts.medWeekly == null ? "; this frame doesn't carry a national line or median-figure reads for individual places" : "";
        // the era print's own households-basis lane names it — only the
        // GCP-era lanes are adult shares
        const incHouse = m.incomeCuts && m.incomeCuts.basis === "households";
        const incNote = incMed()
          ? `Median weekly household income${incEpochBrk}${incMedNote}`
          : `${incHouse ? "Share of households" : "Share of adults in households"} earning ${S.incMode === "lo" ? incLoFrag(m) : incHiQFrag(m)}${incEpochBrk}`;
        // the Age family's per-view notes: the median names its band
        // interpolation, the 18–24 view admits its 15–19 estimate, and a
        // frame without the band dicts says why the new views are empty
        const AGE_NOTE = { med: "Median resident age, interpolated from census age bands", a1824: "Share of residents aged 18 to 24 (the 18–19 share of the 15–19 band)", a2034: "Share of residents aged 20 to 34", a3554: "Share of residents aged 35 to 54", a65: "Share of residents aged 65 and over", a75: "Share of residents aged 75 and over" };
        const ageMedNote = m.ageCuts == null && !(S.ageMode === "a65" || S.ageMode === "a2034") ? "; this frame doesn't carry the census age bands this view needs" : "";
        const ageNote = AGE_NOTE[S.ageMode] + (ageMedNote || "");
        // the 2026-10-31 lane notes: each carries its basis the way the
        // older lanes do (the older lanes' honest phrasing is part of
        // the lane-set's contract now)
        const PT_SINGLE = "Share of employed people whose ONE listed method of travel to work was train, bus or ferry+tram — the 1991 census's journey-to-work print keeps a single method per worker (no multi-method legs before the 1996 edition)";
        const NOTE_ARC = {
          pt: "Share of employed people who travelled to work by train, bus, tram or ferry — any one or more of those legs",
          noncit: "Share of residents not listed as Australian citizens (the census doesn't break out a not-stated share separately here: they're inside the complement)",
          bigfam: "Share of women aged 15+ who have had more than two children",
          hl: "Share of residents counted homeless in the ABS's census estimate, measured per SA2 statistical area (coarser than the other census measures)",
        };
        const ptNote = m.demoInterp && m.demoInterp.c0 === 1991 ? PT_SINGLE : NOTE_ARC.pt;
        const headNote = isInc() ? incNote
          : isAge() ? ageNote
          : isEdu() ? EDU_NOTE[S.eduMode]
          : isCob() ? `Share of residents born in ${COB_NAME[S.cob]}`
          : isRel() ? `Share of residents who ${RELISMS[S.rel]}`
          : isTen() ? `Share of residents whose dwellings ${TENESMS[S.ten]}`
          : isAnc() ? `Share of residents who ${ANCISMS[S.anc]} (people could name up to two ancestries, so the options don't add up to a whole)`
          : S.index === "pt" ? ptNote
          : NOTE_ARC[S.index] || "Share of residents";
        const basisTail = m.demoInterp ? `interpolated between the ${m.demoInterp.c0} and ${m.demoInterp.c1} censuses to election day${m.demoBasis === "venue" ? `, of the census areas ${boothsOn ? "the places stand" : "the polling places stand"} in` : `, where each ${boothsOn ? "place’s" : "seat’s"} voters live`}.` : m.demoBasis === "venue" ? `${m.year < 2004 ? 2001 : m.year < 2013 ? 2006 : 2011} census, of the census areas ${boothsOn ? "the places stand" : "the polling places stand"} in.` : m.demoBasis === "sa1" ? `${m.demoYear ?? 2021} census, of the SA1 census area${boothsOn ? " each polling place stands in" : "s that make up each district"}.` : `2021 census, where each ${boothsOn ? "place’s" : "seat’s"} voters live.`;
        // a birthplace sub-view's tail ignores the blend epoch (cob rides
        // the measured census — 2004's measured side is the 2001 census)
        const cobTail = m.demoBasis === "venue" ? `${m.year < 2007 ? 2001 : m.year < 2013 ? 2006 : 2011} census, of the census areas ${boothsOn ? "the places stand" : "the polling places stand"} in.` : m.demoBasis === "sa1" ? `${m.demoYear ?? 2021} census, of the SA1 census area${boothsOn ? " each polling place stands in" : "s that make up each district"}.` : `2021 census, where each ${boothsOn ? "place’s" : "seat’s"} voters live.`;
        // the Areas drawing names its own ground: the census's areas as counted
        const arTail = arOn ? `${areasVintage(m)} census, as counted in each of the census’s own areas${m.demoInterp && m.demoInterp.nearestSide === areasVintage(m) ? " (this frame’s figures blend two censuses — the areas paint the nearest single one)" : ""}.` : null;
        h += `<div class="lg-note">${early ? "Census people figures start at the 1993 election: 1993, 1996 and 1998 read blended census shares over the two censuses that bracket each election; 2001 reads its own census; 2004 to 2019 blend between the two censuses that bracket them; 2022 reads the 2021 census." : noInc ? "Income figures follow the era prints — the 1991 household share (weekly-equivalent) on the 1993 and 1996 elections, 2001 onward per-adult (the 1996 census prints no household-income table at all): 2001 to 2013 read the census areas the polling places stand in, from 2016 they follow the voters." : `${headNote}${headNote.endsWith(")") || headNote.endsWith('"') || headNote.endsWith(".") ? " " : ", "}${arOn ? arTail : isCob() ? cobTail : basisTail}${aus.demo && ausShare != null ? ` ${m.demoBasis === "sa1" ? stNameCap(m.year) : "Australia"}: ${incMed() ? mny(ausShare) : ageMed() ? Math.round(ausShare) : `${f1(ausShare)}%`}.` : ""}`}</div>`;
        break;
      }
      const arSf = drawOf(m) === "areas" && AR.packOf != null && AR.pack;
      h += arSf ? `<div class="lg-note">Each census area with the ABS’s own national decile for its SA1, as published with the ${areasVintage(m)} census — the areas ranked into tenths across Australia, not this sheet’s seats into tenths of themselves.</div>`
        : boothsOn ? `<div class="lg-note">Places scored ${seifaBasis(m) === "voters" ? "where each place’s voters live" : "on the census areas they stand in"}.</div>` : `<div class="lg-note">Seats ranked into tenths of the ${m.divs.length}.</div>`;
      break;
    }
  }
  // in the chamber, a year with a seating plan can show the members where they sit or sorted by the lens
  if (S.view === "chamber" && m.seating) {
    const md = seatMode(m);
    const by = { winner: "winning share", tpp: S.tppMode === "swing" ? "swing" : "two-party share", fp: "primary vote", flow: "preference flow", informal: "informal vote", cls: "seat type", seifa: "census measure" }[S.lens];
    h += `<div class="lg-seat" role="group" aria-label="How the chamber is arranged"><button type="button" data-seat="plan" aria-pressed="${md === "plan"}">As seated</button><button type="button" data-seat="sort" aria-pressed="${md === "sort"}">Sorted</button><span>${md === "plan" ? `From the Parliament’s seating plan of ${m.seating.plan}${m.seating.note ? `, ${m.seating.note}` : ""}.` : `By ${by}, each side from the Speaker’s end.`}</span></div>`;
  }
  if (boothsOn && drawOf(m) !== "balloons" && (S.view !== "map" || drawOf(m) === "seats" || selDiv() != null || T.k >= K_ALL)) h += `<div class="lg-shapes"><span><i></i>Polling place</span><span><i class="sq"></i>Early voting</span><span>Size: votes</span></div>`;
  if (S.view === "map") {
    h += jumpHTML();
    if (S.lens !== "winner") h += drawRow;
    h += drawNoteHTML(m);
    // the switch then the hint at the strip's close — user call: Drawn-as sits
    // above the zoom hint, not the other way round
    if (S.lens === "winner") h += drawRow;
    // the zoom hint rides the strip too, off the stage's top-left overlay with
    // the cities — re-rendered fresh every write, and updateHint fills it by id
    h += `<div class="lg-hint mp-hint" id="hint"></div>`;
  }

  return h;
}

/* =============================== the timeline =============================== */
let SUM = null;
let tlCtx = null; // shared canvas context for measuring stop-label widths
/* one dated rung for the selected jurisdiction alone, in the top rail's old
   spot (rows declared federal, Vic, NSW, SA, Qld, WA — the rowIx order); each
   stop at its date on the one scale */
function renderTimeline() {
  const el = $("#time"); if (!el) return;
  const W = el.clientWidth || 600, H = el.clientHeight || 54, m = M();
  // the rail's left anchor is the years list's own head – 2004 when the span
  // opened there, 2001 now: a year before the literal anchor used to render
  // off the left edge with a NaN-ish hit rect (the 2001 stop the first day)
  const FED0 = YEAR_X[YEARS_FED[0]] ?? YEARS_FED[0];
  const X = (y) => 22 + ((xOfYear(y) - FED0) / (YEAR_X.now - FED0)) * (W - 44);
  const NX = (nx) => 22 + ((nx - FED0) / (YEAR_X.now - FED0)) * (W - 44);
  // a state row's cursor: its own previous elections (2018/2019 before the frames
  // open, 2022 on the SA row is sa22, not the federal 2022), then the frames' spots
  const STATE_ROW_PREV_X = { sa: SA_PREV_X, nsw: NSW_PREV_X, vic: VIC_PREV_X, qld: QLD_PREV_X, wa: WA_PREV_X };
  const stGx = (st) => (ry) => NX(STATE_ROW_PREV_X[st][ry] ?? YEAR_X[st + String(ry).slice(2)] ?? ry);
  const short = W < 560, cur = S.year;
  /* only the selected jurisdiction's rung draws at a time, so the rows all
     collapse onto the one band — the position the top (federal) rail sat in:
     the rail a shade under the strip's middle, its labels tucked under it */
  const TOP = 2, BASE = H - 23;
  const rows = [
    { ys: YEARS_FED, base: BASE, top: TOP },
    { ys: YEARS_VIC, base: BASE, top: TOP, gx: stGx("vic") },
    { ys: YEARS_NSW, base: BASE, top: TOP, gx: stGx("nsw") },
    { ys: YEARS_SA, base: BASE, top: TOP, gx: stGx("sa") },
    { ys: YEARS_QLD, base: BASE, top: TOP, gx: stGx("qld") },
    { ys: YEARS_WA, base: BASE, top: TOP, gx: stGx("wa") },
  ];
  const rowIx = (y) => (VIC_YEARS.has(y) ? 1 : NSW_YEARS.has(y) ? 2 : SA_YEARS.has(y) ? 3 : QLD_YEARS.has(y) ? 4 : WA_YEARS.has(y) ? 5 : 0);
  // a rung belongs to the selected election alone — the rest of the timeline steps aside
  const activeIx = rowIx(m ? m.year : cur);
  const sd = m ? selDiv() : null;
  let g = "";
  for (const r of rows.filter((_, i) => i === activeIx)) g += `<line x1="0" x2="${W}" y1="${r.base}" y2="${r.base}" stroke="var(--line)"/>`;
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
      // a by-election stop glues to its frame's "now" stop, on its own row
      g += `<circle cx="${r[4] ? X(isNowY(cur) ? cur : "now") : gx(r[0])}" cy="${cy}" r="${(r[4] ? (isNowY(cur) ? cur : "now") : r[0]) === cur ? 5 : 3.6}" fill="var(--m-${FAM(r[2])})" stroke="var(--bg)" stroke-width="1.5"><title>${r[4] ? "By-election" : r[0]}: ${ds(r[3])} (${esc(partyName(r[2]))})${r[1] != null ? `, Labor two-party ${f1(r[1])}` : ""}</title></circle>`;
    }
    if (isNowY(cur) && !hh.some((r) => r[4])) { const last = hh[hh.length - 1]; if (last) g += `<circle cx="${X(cur)}" cy="${last[1] != null ? yv(last[1]) : yv(50)}" r="5" fill="var(--m-${holdFam(m.divs[sd].hold)})" stroke="var(--bg)" stroke-width="1.5"/>`; }
  } else if (SUM) {
    // in the Senate's chamber each stop reads that election's upper house
    const sen = senOn();
    const st = sen ? (S.ssel.level !== "aus" ? S.ssel.st : "AUS") : S.sel.level === "state" ? S.sel.st : "AUS";
    // as the rail and the labels do, the bars draw on the selected election's row alone
    for (const r of rows.filter((_, i) => i === activeIx)) {
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
  const tlStops = (ys) => ys.map((y) => ({ y, lab: isNowY(y) ? (short || y === "now" ? "Now" : yearLabel(y)) : short ? (typeof y === "number" ? "’" + String(y).slice(2) : "’" + String(y).slice(-2)) : yearLabel(y) }));
  const rowsOf = [
    { i: 0, items: tlStops(YEARS_FED) },
    { i: 1, items: tlStops(YEARS_VIC) },
    { i: 2, items: tlStops(YEARS_NSW) },
    { i: 3, items: tlStops(YEARS_SA) },
    { i: 4, items: tlStops(YEARS_QLD) },
    { i: 5, items: tlStops(YEARS_WA) },
  ];
  for (const R of rowsOf) {
    if (R.i !== activeIx) continue; // only the selected jurisdiction's rung shows
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
      // the one visible rung takes the whole strip's height as its touch window
      const hitTop = 0, hitBot = H;
      const uline = t.on ? `<line x1="${lx - t.w / 2}" x2="${lx + t.w / 2}" y1="${labY + 2}" y2="${labY + 2}" stroke="var(--ink)" stroke-width="2"/>` : "";
      g += `<g class="stop" data-year="${t.y}" style="cursor:pointer"><rect class="hit" x="${hitLeft}" y="${hitTop}" width="${hitRight - hitLeft}" height="${hitBot - hitTop}"/><line x1="${t.x}" x2="${t.x}" y1="${r.base - 3}" y2="${r.base + 3}" stroke="${t.on ? "var(--ink)" : "var(--ink-faint)"}"/><text class="yr${t.on ? " on" : ""}" x="${lx}" y="${labY}" text-anchor="middle">${esc(t.lab)}</text>${uline}</g>`;
    }
  }
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Federal elections ${YEARS[0]} to now, and Victorian, New South Wales, South Australian, Queensland and Western Australian state elections; choose one">${g}</svg>`;
  // the strips follow the frame and the selection
  renderJumpSel();
  if (FS.on) fsRail();
}

/* the Jump to: row, off the map's top-left overlay and into the legend strip
   (2026-11-07). Its cities pair name and state, a state election keeps just
   its capital unlabelled — and the row closes with the city-names toggle,
   which governs the names the map canvas paints (the Jump-to links stay) */
function jumpHTML() {
  const j = stOfYear(S.year);
  const on = !S.townsOff;
  const toggle = `<span class="lg-jgap"></span><button type="button" class="lg-jtoggle" data-towns aria-pressed="${on}" aria-label="City names on the map">City names</button></div>`;
  if (j) {
    const k = CITIES.findIndex(([, st]) => st === j);
    if (k >= 0) return `<div class="lg-jump" id="cities" role="group" aria-label="Go to a city"><b>Jump to:</b><div class="mp-ca"><button type="button" data-city="${k}">${CITIES[k][0]}</button></div>${toggle}`;
  }
  return `<div class="lg-jump" id="cities" role="group" aria-label="Go to a city"><b>Jump to:</b>${CITIES.map(([n, st], k) => `<div class="mp-ca"><button type="button" data-city="${k}">${n}</button><button type="button" data-state="${st}">${STATE_ABBR[st] || st}</button></div>`).join("")}${toggle}`;
}
/* the selected entry keeps the hover underline (the city/state column and the election alike) */
function renderJumpSel() {
  const on = S.sel.level === "state" ? S.sel.st : null;
  const cit = $("#cities");
  // the strip's jump row hides while a seat is chosen or the view is deep-zoomed —
  // re-fixed here because renderLegend re-creates it on every render
  if (cit) cit.hidden = S.view !== "map" || selDiv() != null || (T.k > HOME.k * 3 && S.sel.level !== "state");
  $$("#cities .mp-ca").forEach((ca) => { const b = $("button[data-state]", ca); ca.classList.toggle("on", !!(on && b && b.dataset.state === on)); });
  FRAME_JUMPS.forEach(([, ys], k) => { const b = $(`#frames-jump [data-fjump="${k}"]`); if (b) b.classList.toggle("on", ys.includes(S.year)); });
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
let tipAt = null, tipClient = null; // the pointer on the map's plane, for the surface's own reading of the spot, and on the screen
const tipRefresh = () => { if (S.hover && !tip.hidden && tipClient) showTipAt(tipFor(S.hover), tipClient[0], tipClient[1]); };
function tipFor(h) {
  if (h && h.kind === "sen") return SENM ? senTip(SENM, h.i) : "";
  const m = M(); if (!h || !m) return "";
  if (h.kind === "bal") return balloonTip(m, h.g);
  const goes = h.go ? `<div class="ts">Click to go out to the island</div>` : "";
  if (h.kind === "isl") return `<div class="tn">${esc(h.isl)}</div><div class="ts">In no seat at this election</div>${goes}`;
  if (h.kind === "div") {
    const d = m.divs[h.i];
    const v = divValue(m, h.i);
    const sp = h.i === m.speaker ? " · Speaker" : "";
    const holder = d.hold;
    // on a surface the pointer reads the spot first; the seat's own figure follows
    const here = drawOf(m) === "surface" ? SF.here : null;
    // on Areas the census's own area answers first, with its counted figure
    const arh = drawOf(m) === "areas" && AR.pack ? AR.here : null;
    const first = arh && arh.v != null
      ? `<div class="tv">In ${esc(arh.sa2)}: ${esc(valueText(arh.v, "div", { m, d }))}</div><div class="ts">A census area of ${int(arh.pop)} residents, as counted at the ${areasVintage(m)} census</div>`
      : here ? `<div class="tv">Around here: ${esc(here.fam ? `${FAM_NAME[here.fam]} by ${f0(here.lead)}` : valueText(here.v, "div", { m, d }))}</div>` : "";
    return `<div class="tn">${ds(d.n)}<span>${h.isl ? esc(h.isl) + " · " : ""}${STATE_SHORT[d.st]}${sp}</span></div>${first}<div class="${here || first ? "ts" : "tv"}">${here || first ? "The whole seat: " : ""}${esc(valueText(v, "div", { m, d }))}</div><div class="ts">${ds(holder.n)}, ${esc(leaderName(holder))}${S.lens === "winner" ? ` · ${d.by ? "by-election" : "margin"} ${f1(d.margin)}` : ""}</div>${goes}`;
  }
  const b = m.booth, j = h.i, D = m.divs[b.d[j]];
  const ld = b.lead[j], lname = ld ? pairNames(ld, ld === D.A ? D.B : D.A)[0] : "";
  const nominal = Number.isNaN(b.x[j]) ? `<div class="ts">No fixed spot: placed nominally in its seat</div>` : "";
  return `<div class="tn">${ds(b.name[j])}<span>${ds(D.n)}</span></div><div class="tv">${esc(valueText(drawOf(m) === "seats" ? boothValue(m, j) : drawValue(m, j), "booth", { m, d: D }))}</div><div class="ts">${int(b.votes[j])} votes${ld ? ` · ${esc(lname)} ${f1(b.leadPct[j])}` : ""}</div>${nominal}`;
}

/* =============================== selection =============================== */
function select(sel, opts = {}) {
  const prevDiv = selDiv();
  S.sel = sel;
  // a Winner-lens state slice is one pick shared with the head's figures
  // menu: a state arrived at any side writes the menu's store, and the whole
  // frame again ("All seats") clears it back
  const sm = M();
  if (pickerLens() && sm && !STATE_YEARS.has(sm.year)) {
    if (sel.level === "state" && S.lens === "winner" && sm.areas[sel.st] && sm.areas[sel.st].formal > 0) statScopeStore = { k: "st", st: sel.st, open: statScopeStore.open };
    else if (sel.level === "aus") statScopeStore = { k: "aus", open: statScopeStore.open };
  }
  if (!opts.keepTown) townPick = -1;
  reframe = null; // (a town's or city's flight sets its own again, after this)
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

function setStatScope(sel) {
  const m = M(); if (!m) return;
  // a state named in the menu is selected on the map too — the slice is the
  // one pick (select re-stamps the store). A class or the whole frame steps
  // the selection back out first.
  if (sel.k === "st" && statScopeOk(m, sel)) { select({ level: "state", st: sel.st }, { fly: false }); return; }
  if (S.sel.level === "state") select({ level: "aus" }, { fly: false });
  statScopeStore = sel;
  renderStory(true);
}
// armed once a scope-menu choice has been made (item picked, or the menu shut
// by its label): the spacebar then steps through the menu's views in order
let scopeSpace = false;
function cycleStatScope(step) {
  const m = M(); if (!m) return;
  const opts = statScopeOpts(m, "AUS").map((o) => o[0]);
  if (!opts.length) return;
  setStatScope(statScopeParse(opts[(opts.indexOf(statScopeVal(statScopeOf(m))) + step + opts.length) % opts.length]));
}

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
  renderLegend(); renderFilterPill(); renderStory(true); if (S.view === "list") renderList(); schedule(); paintMiniChamber(); writeURL();
}
function updateHint() {
  const el = $("#hint"); if (!el) return;
  const show = S.view === "map" && selDiv() == null && (T.k < K_ALL || drawOf(M()) === "surface") && !!M();
  el.textContent = !show ? "" : drawOf(M()) === "balloons" ? "Balloons join where they’d overlap; zoom in to part them" : drawOf(M()) === "surface" ? "Hover for the reading at any spot, or choose a seat to see its polling places" : "Zoom in, or choose a seat, to see its polling places";
  el.style.opacity = show ? "1" : "0";
  // the row stays while a jump selection is live, so it can be toggled back off
  const citRow = $("#cities");
  if (citRow) citRow.hidden = S.view !== "map" || selDiv() != null || (T.k > HOME.k * 3 && S.sel.level !== "state");
  // the jump-back control lives wherever the default view no longer is
  $("#zback").hidden = !(S.view === "map" && (S.sel.level !== "aus" || T.k > HOME.k * 1.001));
}

/* =============================== search =============================== */
let sugg = [], suggAt = -1;
function runSearch() {
  const m = M(), el = $("#sugg"), q = S.q.trim(), sen = senOn();
  if (S.view === "list") { el.hidden = true; renderList(); return; }
  if (!m || q.length < 2) { el.hidden = true; sugg = []; $("#q").setAttribute("aria-expanded", "false"); return; }
  const toks = norm(q).split(/\s+/).filter(Boolean);
  const scored = [];
  // (the towns ahead of the long run of polling places, which can fill the match cap)
  for (const list of sen ? [SENM.search ??= senSearchItems(SENM)] : [townSearchItems(m), m.search.items]) for (const it of list) {
    const h = it.h; let ok = true, score = it.rank * 10;
    for (const t of toks) { const p = h.indexOf(t); if (p < 0) { ok = false; break; } if (p === 0) score -= 4; else if (h[p - 1] === " ") score -= 2; }
    if (ok) scored.push([score, it]);
    if (scored.length > 4000) break;
  }
  scored.sort((a, b) => a[0] - b[0]);
  const groups = { state: [], sen: [], div: [], town: [], mp: [], cand: [], booth: [] };
  for (const [, it] of scored) { const g = groups[it.k]; if (g.length < (it.k === "booth" || it.k === "sen" ? 6 : 4)) g.push(it); }
  const order = ["state", "sen", "div", "town", "mp", "cand", "booth"];
  sugg = order.flatMap((k) => groups[k]);
  suggAt = sugg.length ? 0 : -1;
  const label = { state: "States and territories", sen: "Senators", div: "Seats", town: "Towns and cities", mp: isNowY(S.year) ? "Members" : "Members elected", cand: "Candidates", booth: "Polling places" };
  let html = "", n = 0;
  for (const k of order) {
    if (!groups[k].length) continue;
    html += `<div class="g">${label[k]}</div>`;
    for (const it of groups[k]) {
      const color = it.k === "booth" ? colCss(m.boothCol[it.j]) : it.k === "state" ? "var(--line)" : it.k === "town" ? "var(--ink)" : it.k === "sen" ? colCss(SENM.divCol[it.i]) : colCss(m.divCol[it.i]);
      const sub = it.k === "town" ? townSub(m, it) : it.s;
      html += `<button type="button" role="option" data-n="${n}" aria-selected="${n === suggAt}"><i class="sw${it.k === "town" ? " sw-town" : ""}" style="background:${color}"></i><span class="t">${ds(it.t)}</span><span class="s">${ds(sub)}</span></button>`;
      n++;
    }
  }
  el.innerHTML = html || `<div class="none">${sen ? "No senator or state" : "No seat, town, member or place"} matches “${esc(q)}”.</div>`;
  el.hidden = false; $("#q").setAttribute("aria-expanded", "true");
}
function chooseSugg(k) {
  const it = sugg[k]; if (!it) return;
  $("#sugg").hidden = true; $("#q").value = ""; S.q = ""; $("#q").blur();
  if (senOn()) { selectSen(it.k === "state" ? { level: "state", st: it.st } : { level: "sen", st: SENM.divs[it.i].st, i: it.i }); return; }
  const view = (it.k === "booth" || it.k === "town") && S.view === "chamber" ? "map" : undefined;
  if (it.k === "town") flyToTown(it.ti, { view });
  else if (it.k === "state") goState(it.st, { view });
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
  townHits.length = 0; townHiIdx = -1;
  // (a built contest is the map's alone: the chamber and the list go back to the counted figures, colours too)
  if (S.axis !== "AC" && S.lens === "tpp" && S.draw !== "seats") recolor(false);
  $$(".mp-views .rd-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === v)));
  if (senate) { renderLenses(); if (v === "chamber") needSenateFloor(); }
  // the count word follows the view (divisions / seats / members), so the
  // eyebrow re-words on every swap even when the election stays the same
  $("#mp-meta").textContent = metaLine();
  holdEyebrow();
  const list = v === "list";
  $("#list").hidden = !list;
  $("#view").classList.toggle("v-chamber", v === "chamber");
  for (const id of ["#cities", "#hint"]) { const e = $(id); if (e) e.hidden = v !== "map"; }
  // the zoom plate stays up in the chamber, for its full-screen button alone
  $("#zoomer").hidden = list; $("#zoomer").dataset.view = v;
  if (FS.on) fsView();
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
  // the Preferences tab, clicked while it reads the Senate's ballots, stays where it is
  if (id === "flow" && S.lens === "senpref" && !lensFlip) return;
  if (FED_LENS.has(id) && STATE_YEARS.has(S.year) && !(id === "senpref" && SEN_PREF_STATE_FRAMES.has(S.year))) return;
  // the Senate's votes load with their lens (about 120KB a year, gzipped)
  if (id === "senate" && svYear(S.year) != null && !SV[svYear(S.year)]) {
    const spot = takeSpot();
    showLoading(true);
    loadSenateVote(S.year).then(() => { showLoading(false); walkSpot = spot && { ...spot, at: performance.now() }; setLens(id); })
      .catch(() => showLoading(true, "The Senate’s votes didn’t load. Try again."));
    return;
  }
  // ... and the Senate's ballot rankings with theirs (about 300KB a year, gzipped)
  if (id === "senpref" && spYear(S.year) != null && !SPD[spYear(S.year)]) {
    const spot = takeSpot();
    showLoading(true);
    loadSenatePrefs(S.year).then(() => { showLoading(false); walkSpot = spot && { ...spot, at: performance.now() }; setLens(id); })
      .catch(() => showLoading(true, "The Senate’s ballots didn’t load. Try again."));
    return;
  }
  const hold = walkHold(takeSpot());
  S.lens = id; S.sort = null; S.dist = null;
  // the slice follows its lens: a state the figures menu had under Winner
  // re-selects on the map when the lens comes back to it
  if (id === "winner" && S.sel.level === "aus" && statScopeStore.k === "st" && !STATE_YEARS.has(S.year)) {
    const mm = M();
    if (mm && mm.areas[statScopeStore.st] && mm.areas[statScopeStore.st].formal > 0) S.sel = { level: "state", st: statScopeStore.st };
  }
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
  if (!FS.auto) fsStop();

  // the spot is taken now, while it's fresh: the election may take a while to load
  const from = S.year, a = M(), spot = takeSpot();
  // a state election on the timeline has no Senate: it opens in the House's chamber
  if (S.house === "senate" && !SEN_YEARS.includes(y)) { S.house = "reps"; chAnim = null; chLast.clear(); renderLenses(); }
  // ... and the Senate-vote/seat-type lenses are AEC reads the state frames don't offer
  if (STATE_YEARS.has(y) && FED_LENS.has(S.lens) && !(S.lens === "senpref" && SEN_PREF_STATE_FRAMES.has(y))) S.lens = S.lens === "senpref" ? "flow" : "winner";
  // the stamp names the election at the press; while it loads the stamp's rule runs and a
  // sheen crosses the map (an election already loaded lands within the frame)
  const dir = yearDir(from, y), tok = ++yearTok;
  showStamp(y, dir);
  const ready = Y[y] && Y[y].divs;
  if (!ready) { ywait = { t0: performance.now(), dir }; schedule(); }
  // the Senate's chamber moves with the timeline: that election's Senate too
  try { await Promise.all([needPpl() ? loadYear(y).then(() => loadPpl(y)) : loadYear(y), S.house === "senate" ? loadSenate(y) : null, S.lens === "senate" ? loadSenateVote(y) : null, S.lens === "senpref" ? loadSenatePrefs(y) : null, S.axis !== "AC" && S.lens === "tpp" && AXIS_FRAMES[y] != null && !STATE_YEARS.has(y) ? loadSenatePrefs(AXIS_FRAMES[y]) : null]); } catch (e) { if (tok === yearTok) { ywait = null; stampDone(); } console.error(e && e.stack || e); showLoading(true, "That election didn’t load. Try again."); return; }
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
  // a People lane the frame's era never printed (menu omits it) drops
  // the selection to the always-printed language share
  if (b.hasLane && (DM.includes(S.index) || S.index === LENS_EDU) && b.hasLane[S.index] === false) S.index = "lang";
  // a schooling read the era never prints falls back to the frame's own
  // (the statistics-era frames keep University educated alone)
  if (S.index === LENS_EDU && b.hasLane && b.hasLane[S.eduMode] === false) S.eduMode = EDU_MODES.find((k) => b.hasLane[k] !== false) || "uni";
  if (b.hasIx && IX.includes(S.index) && b.hasIx[S.index] === false) S.index = "irsd";
  if (S.party === "onp" && !famEraOpts(b).includes("onp")) S.party = "lnp";
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
  // …and the slice's other side catches up: a state kept on the new frame
  // re-stamps the menu's store, a pick the frame can't select waits in the
  // store, and it selects again on a frame that has it
  if (S.lens === "winner" && !STATE_YEARS.has(y)) {
    if (S.sel.level === "state") { if (b.areas[S.sel.st] && b.areas[S.sel.st].formal > 0) statScopeStore = { k: "st", st: S.sel.st, open: statScopeStore.open }; }
    else if (S.sel.level === "aus" && statScopeStore.k === "st" && b.areas[statScopeStore.st] && b.areas[statScopeStore.st].formal > 0) S.sel = { level: "state", st: statScopeStore.st };
  }
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
    // (balloons and a surface change election by a crossfade: they aren't made of the seats that morph)
    balloonsLeave(a, b);
    if (drawOf(b) !== "seats" || !startYearMorph(a, b, framed && lastFit ? lastFit : T, dir)) carryColours(a, b);
  }
  const ul = tlMark();
  renderTimeline(); tlGlide(ul); renderLegend(); renderStory(true); renderFilterPill(); renderBack(); writeURL();
  $("#mp-meta").textContent = metaLine(); holdEyebrow();
  if (S.view === "list") renderList(true);
  if (hold) hold.land();
  stampDone(ymorph ? ymorph.dur : 300);
  // now that it's shown, this frame earns its hi geometry and its place in the
  // cache; the morph above keeps its own references, so eviction can't hurt it
  // (the hi download runs under the morph, when the network has nothing else to do)
  warmHi(y);
  Y[y].viewedAt = performance.now();
  evictFrames();
  schedule();
}
let yearTok = 0;
// +1 going forward in time, -1 back (the "as it stands" frames are the latest
// of all, the federal Now on top)
const yearWhen = (y) => (y === "now" ? "9999" : isNowY(y) ? "9998" : Y[y] && Y[y].date ? Y[y].date : META_FACTS.house && META_FACTS.house[y] ? META_FACTS.house[y][0] : String(xOfYear(y)));
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
const stateAdj = (y) => (NSW_YEARS.has(y) ? "New South Wales" : VIC_YEARS.has(y) ? "Victorian" : QLD_YEARS.has(y) ? "Queensland" : WA_YEARS.has(y) ? "Western Australian" : "South Australian");
function stampParts(y) {
  if (y === "now") return ["The House today", "Now"];
  if (isNowY(y)) return ["The Assembly today", "Now"];
  if (STATE_YEARS.has(y)) return [`${stateAdj(y)} election`, "20" + String(y).slice(-2)];
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
  // (full screen keeps the election up on a wide screen, the map's own title plate;
  // a phone's small map shows it only while it turns, as the page does)
  if (FS.on && !FS.phone) return;
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
  // the federal Now names its last move over a data tick: the newest "Since the election" entry
  const changed = (m.changes || []).reduce((a, c) => (c.date > a ? c.date : a), "") || m.asOf;
  return m.year === "now" ? `The current House of Representatives, last changed ${longDate(changed)} · ${m.booth.n.toLocaleString("en-AU")} polling places` : isNowY(m.year) ? `The Legislative Assembly as it stands, ${longDate(m.asOf)} · ${m.booth.n.toLocaleString("en-AU")} polling places` : STATE_YEARS.has(m.year) ? `${stateAdj(m.year)} election, ${longDate(m.date)} · ${m.divs.length} ${seatNoun()} · ${m.booth.n.toLocaleString("en-AU")} polling places` : `The ${m.year} federal election, ${longDate(m.date)} · ${m.divs.length} ${seatNoun()} · ${m.booth.n.toLocaleString("en-AU")} polling places`;
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
  // the hold keys on the view now the count word does (divisions wraps longer
  // than seats or members)
  const ch = S.view === "chamber", fam = famOf(S.year), at = `${w}|${S.view}|${fam}`;
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
  // (nor a frame not yet coloured: at boot the landing election can land before the
  // legend's metadata, and a resize's frame in that gap had no colours to fill with)
  if (!m || !m.divCol) return;
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
  // (full screen: the plates' room is read before any framing below uses it)
  if (FS.on) fsMeasure(true);
  const first = !Wpx;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  // full screen on a big retina display would be a 15-megapixel canvas, drawn every frame
  // the map moves (2560 x 1440 at 2x dropped one frame in eight): its backing store keeps to a
  // budget, the resolution falling only as far as that needs (FS.px, app-7-full.js)
  if (FS.on) dpr = Math.max(1, Math.min(dpr, Math.sqrt(FS.px / (r.width * r.height))));
  const changed = Math.abs(Wpx - r.width) > 0.5 || Math.abs(Hpx - r.height) > 0.5;
  // only the height moved (the key above the stage grew or shrank): a view the page framed
  // glides to the new fit; one the reader has moved keeps its zoom, centred as before
  const dh = r.height - Hpx, dw = r.width - Wpx, keyOnly = !first && Math.abs(Wpx - r.width) <= 0.5 && changed && S.view === "map";
  const moved = keyOnly && !atLastFit() && !flight;
  Wpx = r.width; Hpx = r.height;
  canvas.width = Math.round(Wpx * dpr); canvas.height = Math.round(Hpx * dpr);
  if (M()) {
    setExtent();
    // the step into or out of full screen brings its own camera (app-7-full.js)
    if (FS.move) { const mv = FS.move; FS.move = null; mv(); }
    // (full screen resized under a view the reader moved: the middle holds, the zoom too)
    else if (FS.on && changed && !first && S.view === "map" && !atLastFit() && !flight) d3.select(canvas).call(zoom.transform, d3.zoomIdentity.translate(T.x + dw / 2, T.y + dh / 2).scale(T.k));
    else if (moved) d3.select(canvas).call(zoom.transform, d3.zoomIdentity.translate(T.x, T.y + dh / 2).scale(T.k));
    else if (flight && (keyOnly || FS.on)) flight.redo();
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
  if (S.lens === "senpref") { p.set("sp", S.spPair); p.set("p", S.spFrom); }
  if (S.lens === "seifa") { p.set("i", S.index); if (isInc() && S.incMode !== "med") p.set("iv", S.incMode); if (isAge() && S.ageMode !== "med") p.set("av", S.ageMode); if (isEdu() && S.eduMode !== "uni") p.set("ev", S.eduMode); if (isCob()) p.set("cb", S.cob); if (isRel() && S.rel !== "norel") p.set("rl", S.rel); if (isTen() && S.ten !== "mort") p.set("tn", S.ten); if (isAnc()) p.set("an", S.anc); }
  if (S.lens === "informal" && S.infMode === "exhaust") p.set("im", "exhaust");
  if (S.draw !== "seats") p.set("draw", S.draw);
  if (S.lens === "tpp" && S.draw !== "seats" && S.axis !== "AC") p.set("ax", S.axis);
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
  if (FS.on) p.set("fs", "1");
  const h = p.toString();
  try { history.replaceState(FS.on ? { mpFs: 1 } : null, "", h ? "#" + h : location.pathname + location.search); } catch (e) {}
}
function readURL() {
  const p = new URLSearchParams(location.hash.slice(1));
  const yr = p.get("y"); if (yr && YEARS.includes(yearOf(yr))) S.year = yearOf(yr);
  const l = p.get("l"); if (l && (yearLenses(S.year).some((x) => x.id === l) || (l === "senpref" && (!STATE_YEARS.has(S.year) || SEN_PREF_STATE_FRAMES.has(S.year))))) S.lens = l;
  const mm = p.get("m"); if (mm === "swing") S.tppMode = "swing"; if (mm === "change") S.fpMode = "change"; if (mm === "share" && S.lens === "senate") S.senMode = "share";
  const dw = p.get("draw"); if (dw && DRAWS.some(([k]) => k === dw)) S.draw = dw;
  const ax = p.get("ax"); if (ax && SP_PAIRS[ax]) S.axis = ax;
  const spp = p.get("sp"); if (spp && SP_PAIRS[spp] && !AXIS_GREEN_SET.has(spp)) S.spPair = spp;
  const pp = p.get("p"); if (pp && FAMS.includes(pp)) { if (S.lens === "flow") S.from = pp; else if (S.lens === "senpref") { if (SP_DONORS[S.spPair].includes(pp)) S.spFrom = pp; } else S.party = pp; }
  if (!SP_DONORS[S.spPair].includes(S.spFrom)) S.spFrom = SP_DONORS[S.spPair][0];
  S.vs = p.get("f") === "onp" ? "onp" : "lnp";
  const i = p.get("i");
  // the loinc/hiinc, a65/a2034 and uni/y12less menu ids and the hi mode id
  // pre-date the merged lenses and the top-quarter lane: a legacy hash
  // naming one lands on the lens with its share view picked (hiq where
  // hi once sat)
  if (i === "loinc" || i === "hiinc") { S.index = LENS_INC; S.incMode = i === "loinc" ? "lo" : "hiq"; }
  else if (i === "a65" || i === "a2034") { S.index = LENS_AGE; S.ageMode = i; }
  else if (i === "uni" || i === "y12less") { S.index = LENS_EDU; S.eduMode = i === "y12less" ? "y12less" : "uni"; }
  else if (i && (IX.includes(i) || DM.includes(i) || i === LENS_INC || i === LENS_AGE || i === LENS_EDU || i === LENS_REL || i === LENS_TEN || i === LENS_ANC)) S.index = i;
  const iv = p.get("iv"); S.incMode = iv === "lo" ? "lo" : iv === "hi" || iv === "hiq" ? "hiq" : (i === "loinc" ? "lo" : i === "hiinc" ? "hiq" : "med");
  const av = p.get("av"); S.ageMode = AGE_MODES.includes(av) ? av : (i === "a65" || i === "a2034" ? i : "med");
  const ev = p.get("ev"); S.eduMode = ev === "y12less" ? "y12less" : (i === "y12less" ? "y12less" : "uni");
  S.cob = COB_NAME[p.get("cb")] ? p.get("cb") : null;
  S.rel = REL_NAME[p.get("rl")] ? p.get("rl") : "norel";
  S.ten = TEN_NAME[p.get("tn")] ? p.get("tn") : "mort";
  S.anc = ANC_NAME[p.get("an")] ? p.get("an") : "english";
  if (p.get("im") === "exhaust") S.infMode = "exhaust";
  const v = p.get("v"); if (v === "chamber" || v === "list") S.view = v;
  const o = p.get("o"); if (o === "plan" || o === "sort") S.seat = o;
  if (p.get("c") === "senate") { S.house = "senate"; if (SEN_LENSES.some((l) => l.id === p.get("sl"))) S.senLens = p.get("sl"); senFromURL = p.get("ss"); }
  fsFromURL = p.get("fs") === "1";
  return p.get("s");
}
let senFromURL = null, fsFromURL = false;
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
  // a town's label under the pointer reads as a click target (the label inverts here, the click flies)
  const ti = townAtPoint(e.clientX - r.left, e.clientY - r.top);
  if (ti !== townHiIdx) { townHiIdx = ti; schedule(); }
  const h = hitTest(e.clientX - r.left, e.clientY - r.top);
  tipAt = [(e.clientX - r.left - T.x) / T.k, (e.clientY - r.top - T.y) / T.k]; tipClient = [e.clientX, e.clientY];
  if (h && drawOf(M()) === "surface") surfaceAsk(tipAt[0], tipAt[1]);
  if (drawOf(M()) === "areas") {
    const mm = M(), hit = h && AR.pack ? areasHit(mm, tipAt[0], tipAt[1]) : null;
    AR.here = hit ? { ...hit, v: areasValue(AR.pack, mm, hit.i, AR.lane) } : null;
  }
  const same = (h && S.hover && h.kind === S.hover.kind && h.i === S.hover.i) || (!h && !S.hover);
  if (!same) { S.hover = h; schedule(); }
  if (h) showTipAt(tipFor(h), e.clientX, e.clientY); else hideTip();
  canvas.style.cursor = h ? "pointer" : "";
});
canvas.addEventListener("pointerleave", () => { S.hover = null; AR.here = null; townHiIdx = -1; hideTip(); schedule(); });
canvas.addEventListener("click", (e) => {
  const r = canvas.getBoundingClientRect();
  // a town's label is a click target of its own: the map flies to the town and rings it
  const ti = townAtPoint(e.clientX - r.left, e.clientY - r.top);
  if (ti >= 0) { flyToTown(ti); return; }
  const h = hitTest(e.clientX - r.left, e.clientY - r.top);
  if (h && h.kind === "sen") { selectSen({ level: "sen", st: SENM.divs[h.i].st, i: h.i }); return; }
  if (!h && senOn()) { if (S.ssel.level !== "aus") selectSen({ level: "aus" }); return; }
  if (!h) {
    // a click on open water lets the selection out — always in the chamber,
    // which has no camera to move; on the map it leaves the camera alone at
    // any zoom, and the double click below is the one that takes it home
    if (S.sel.level === "aus") return;
    if (S.view === "chamber") goAus();
    else if (S.view === "map") select({ level: "aus" }, { fly: false });
    return;
  }
  if (h.go) goIsland(h.go);
  else if (h.kind === "booth") goBooth(h.i);
  else if (h.kind === "bal") goBalloon(h.g);
  else goDiv(h.i, { fly: S.view === "map" });
});
// a double click on open water takes the map all the way out home (the pair's
// first click has already let any selection out where the camera stands)
canvas.addEventListener("dblclick", (e) => {
  if (S.view !== "map") return;
  const r = canvas.getBoundingClientRect();
  if (hitTest(e.clientX - r.left, e.clientY - r.top)) return;
  goAus();
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
  const voteMode = e.target.closest("[data-vt-mode]");
  if (voteMode) { setVtMode(voteMode.dataset.vtMode); return; }
  const oth = e.target.closest("[data-othx]");
  if (oth) { statOthersToggle(); return; }
  const primary = e.target.closest("[data-pv-action]");
  if (primary) { statBreakdownClick(primary); return; }
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
  if (city) { const k = +city.dataset.city; if (S.sel.level === "state" && S.sel.st === CITIES[k][1]) goAus(); else flyToCity(k); return; }
  const scT = e.target.closest("[data-scope-trigger]");
  if (scT) {
    const pop = scT.parentElement.querySelector(".st-scm"), was = !pop.hidden;
    $$(".st-scwrap .st-scm").forEach((m2) => { m2.hidden = true; });
    $$(".st-scwrap [data-scope-trigger]").forEach((t) => t.setAttribute("aria-expanded", "false"));
    if (!was) { pop.hidden = false; scT.setAttribute("aria-expanded", "true"); }
    scopeSpace = was;
    return;
  }
  if (!e.target.closest(".st-scwrap")) { $$(".st-scwrap .st-scm").forEach((m2) => { m2.hidden = true; }); $$(".st-scwrap [data-scope-trigger]").forEach((t) => t.setAttribute("aria-expanded", "false")); scopeSpace = false; }
  const scO = e.target.closest("[data-scope]");
  if (scO) { scopeSpace = true; setStatScope(statScopeParse(scO.dataset.scope)); return; }
  const stj = e.target.closest("[data-state]");
  if (stj) { if (S.sel.level === "state" && S.sel.st === stj.dataset.state) goAus(); else goState(stj.dataset.state); return; }
  const fj = e.target.closest("[data-fjump]");
  if (fj) { const ys = FRAME_JUMPS[+fj.dataset.fjump][1]; setYear(ys[ys.length - 1]); return; }
  const tn = e.target.closest("[data-towns]");
  // the Jump-to row's city-names toggle: the map stops (restart) painting town names
  if (tn) { S.townsOff = !S.townsOff; renderLegend(); schedule(); return; }
  const t = e.target.closest("[data-go],[data-lens],[data-view],[data-sort],[data-unit],[data-unseat],[data-unrange],[data-distclose],[data-dist],[data-listbooths],[data-showmap],[data-more],[data-clear],[data-n],[data-flip],[data-seat],[data-house],[data-slens],[data-sgo],[data-draw]");
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
  if (t.dataset.draw) { setDraw(t.dataset.draw); return; }
  if (t.dataset.flip === "tpp") { S.tppMode = S.tppMode === "swing" ? "share" : "swing"; lensParamChanged(); return; }
  if (t.dataset.flip === "fp") { S.fpMode = S.fpMode === "change" ? "share" : "change"; lensParamChanged(); return; }
  if (t.dataset.flip === "flowsrc") { lensFlip = true; setLens(S.lens === "senpref" ? "flow" : "senpref"); lensFlip = false; return; }
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
    if (k === "basis") { setLens(t.value); return; }
    if (k === "senbasis") { setSenLens(t.value); return; }
    if (k === "axis") { setAxis(t.value); return; }
    // (a new rival takes the place of the group it was: One Nation's preferences can't be read against One Nation)
    if (k === "vs") { S.vs = t.value; if (S.from === t.value) S.from = t.value === "onp" ? "lnp" : "onp"; }
    // (a new contest keeps the voters where it can: the Greens' and everyone else's read in all three)
    if (k === "sppair") { S.spPair = t.value; if (!SP_DONORS[S.spPair].includes(S.spFrom)) S.spFrom = SP_DONORS[S.spPair][0]; }
    if (k === "spfrom") S.spFrom = t.value;
    if (k === "party") S.party = t.value; else if (k === "from") S.from = t.value; else if (k === "index") S.index = t.value; else if (k === "infm") S.infMode = t.value; else if (k === "incv") S.incMode = t.value; else if (k === "agev") S.ageMode = t.value; else if (k === "eduv") S.eduMode = t.value; else if (k === "cob") S.cob = t.value || null; else if (k === "rel") S.rel = t.value || "norel"; else if (k === "ten") S.ten = t.value || "mort"; else if (k === "anc") S.anc = t.value || "english";
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
    const open = $(".st-scm:not([hidden])");
    if (open) { open.hidden = true; $(".st-scwrap [data-scope-trigger]")?.setAttribute("aria-expanded", "false"); return; }
    if (senOn()) { const s = S.ssel; if (s.level === "sen") selectSen({ level: "state", st: s.st }); else if (s.level === "state") selectSen({ level: "aus" }); }
    else goUp();
  }
  // the spacebar steps the figures menu along once a choice has been made there
  // A focused chart toggle keeps its native keyboard activation.
  if (e.key === " " && e.target.closest("[data-vt-mode]")) return;
  if (e.key === " " && scopeSpace) {
    const wrap = $(".st-scwrap");
    if (!wrap || !wrap.querySelector(".st-scm").hidden) { scopeSpace = false; return; }
    e.preventDefault(); cycleStatScope(e.shiftKey ? -1 : 1); return;
  }
  if (e.key === "b") { if (S.view === "map" && !$("#zback").hidden) { e.preventDefault(); goAus(); } }
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); (lensHover ? walkLens : walkYear)(e.key === "ArrowRight" ? 1 : -1); }
  if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); walkLane(e.key === "ArrowDown" ? 1 : -1); }
});
$("#zin").addEventListener("click", () => zoomBy(1.8));
$("#zout").addEventListener("click", () => zoomBy(1 / 1.8));
$("#zback").addEventListener("click", () => goAus());
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

/* once the page is up, the nearest elections load in the background — nearest
   timeline stops first, one idle slice at a time and paced a breath apart — so
   a timeline jump, a chamber switch or the Senate lens finds its data already
   here. Skipped where the connection asks to save data (the timeline's hover
   preload still covers a stop the reader nears); a year's failed fetch drops
   its record so a real click tries it again. The Handbook years never ride this
   loop — their lossless geometry is 6.5–19MB a year, fetched only on hover/click
   demand. Two brakes keep this a polite background job: it stops when the frame
   cache is full (FRAME_CAP), and each stop's hi geometry waits for a real visit
   (warmHi) — fetching and building every stop's hi Path2D set here was the
   2026-10 idle-time long-task storm (≈15s of main-thread jank in the first
   minute) and most of the page's half-gigabyte heap */
const idleSlice = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 900));
const PRELOAD_GAP = 1800;
function preloadYears() {
  const conn = navigator.connection || {};
  if (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "")) return;
  const at = YEARS.indexOf(S.year);
  const stops = YEARS.filter((y) => !Y[y] && !HANDBOOK_YEARS.has(y)).sort((a, b) => Math.abs(YEARS.indexOf(a) - at) - Math.abs(YEARS.indexOf(b) - at));
  // (the reader waiting on an election of their own: theirs goes first, alone)
  const later = (fn) => setTimeout(fn, 500);
  const senateLane = () => {
    // the chambers' lane, cheap beside the years: every Senate (~7KB each) and
    // its floor, then the Senate-vote lens files (the AEC served no 2004 count),
    // one at a time - all twelve at once (~1.3MB) slowed whichever election the
    // reader opened meanwhile by half again
    loadSenates().catch(() => {});
    loadSenateFloor().catch(() => {});
    const ks = SEN_YEARS.filter((sy) => { const k = svYear(sy); return k != null && k !== 2004; });
    const one = () => {
      if (ywait) return void later(one);
      const sy = ks.shift();
      if (sy != null) loadSenateVote(sy, true).catch(() => {}).then(() => idleSlice(() => setTimeout(one, 400)));
    };
    one();
  };
  const next = () => {
    if (ywait) return void later(next);
    const y = frameLoad() < FRAME_CAP ? stops.shift() : null;
    if (y != null && Y[y]) return void next(); // the reader got there first
    if (y != null) return void loadYear(y, true).catch(() => { if (Y[y] && !Y[y].divs) delete Y[y]; }).then(() => idleSlice(() => setTimeout(next, PRELOAD_GAP)));
    senateLane();
  };
  idleSlice(next);
}

/* the state each capital sits in, named the short way (NSW Vic Qld WA SA Tas ACT NT) */
const STATE_ABBR = { NSW: "NSW", VIC: "Vic", QLD: "Qld", WA: "WA", SA: "SA", TAS: "Tas", ACT: "ACT", NT: "NT" };

/* the "View elections" strip under the timeline: each jurisdiction's newest frame */
const FRAME_JUMPS = [["Federal", YEARS_FED], ["Victoria", YEARS_VIC], ["New South Wales", YEARS_NSW], ["Queensland", YEARS_QLD], ["South Australia", YEARS_SA], ["Western Australia", YEARS_WA]];

/* =============================== boot =============================== */
(async () => {
  TH = readTheme(); buildRamps();
  const selFromURL = readURL();
  renderLenses();
  $$(".mp-views .rd-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === S.view)));
  $("#frames-jump").innerHTML = `<b>View elections:</b>${FRAME_JUMPS.map(([n], k) => `<button type="button" data-fjump="${k}">${n}</button>`).join("")}`;
  const meta = loadLegendMeta();
  showLoading(true);
  try { await Promise.all([loadYear(S.year), meta, S.lens === "senate" ? loadSenateVote(S.year) : null, S.lens === "senpref" ? loadSenatePrefs(S.year) : null, S.axis !== "AC" && S.lens === "tpp" && AXIS_FRAMES[S.year] != null && !STATE_YEARS.has(S.year) ? loadSenatePrefs(AXIS_FRAMES[S.year]) : null]); } catch (err) { showLoading(true, "The map’s data didn’t load. Reload the page to try again."); return; }
  warmHi(S.year); // the landing frame earns its hi geometry at once; every other frame's waits for its first visit
  Y[S.year].viewedAt = performance.now();
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
  // yesterday's hash on a statistics-era frame: the schooling read falls
  // back to University educated, the era's only education lane
  if (bmc && bmc.hasLane && S.index === LENS_EDU && bmc.hasLane[S.eduMode] === false) S.eduMode = EDU_MODES.find((k) => bmc.hasLane[k] !== false) || "uni";
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
  $("#zoomer").dataset.view = S.view; $("#zoomer").hidden = S.view === "list";
  if (fsFromURL) fsEnter({ native: false, push: false, animate: false });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { schedule(); renderTimeline(); paintMiniChamber(); ebHeights.clear(); holdEyebrow(); });
  window.__map = { S, Y, SF, AR, setDraw, setAxis, axisOf, axisArea, surfaceAt, balloonSet, balloonLevel, undrawnOf, estBooths, drawOf, areasHit, areasValue, areasLane, areasVintage, M, walk(dir, y) { walkAim(y); walkYear(dir, true); }, walkLane, select, goDiv, goBooth, goState, goAus, setLens, setView, setYear, get T() { return T; }, get townPick() { return townPick; }, get townHitsNow() { return townHits.map((h) => h.slice()); }, get urbanOk() { return townPick >= 0 && !!urbanEntry(townPick); }, get projDrift() { const m = M(), ll = [115.8614, -31.9522], a = proj(ll), b = m.proj(ll); return [proj === m.proj, +((a[0] - b[0]) * T.k).toFixed(1), +((a[1] - b[1]) * T.k).toFixed(1)]; }, get townsDrawn() { return [...townSince.keys()].map((i) => PLACES[i][0]); }, get HOME() { return HOME; }, get ymorph() { return ymorph; },
    get away() { return away; },
    fs: { enter: (o) => fsEnter(o), exit: (o) => fsExit(o), play: () => fsPlay(), stop: () => fsStop(), panel: (v) => fsPanel(v), sheet: (v) => fsSheet(v), get on() { return FS.on; }, get ins() { return { ...FS.ins }; }, get playing() { return !!FS.play; }, get native() { return FS.native; }, get px() { return FS.px; }, set px(v) { FS.px = v; Wpx = 0; resize(); } },
    get islands() { return islDrawn.map((c) => ({ key: c.s.key, r: c.r, docked: c.docked, dots: c.dots.map((d) => ({ j: d.j, x: d.x, y: d.y })) })); },
    landAt(px, py) { const m = M(); if (!m) return false; const g = geoOf(m); if (!g || !g.paths) return false; const bx = (px - T.x) / T.k, by = (py - T.y) / T.k; for (let i = 0; i < m.divs.length; i++) { const q = g.bb[i]; if (!q || bx < q[0][0] || bx > q[1][0] || by < q[0][1] || by > q[1][1]) continue; if (hitCtx.isPointInPath(g.paths[i], bx, by)) return true; } return false; },
    drawNow() { const t0 = performance.now(); frame(t0); if (raf) { cancelAnimationFrame(raf); raf = 0; } return performance.now() - t0; },
    panBy(dx, dy) { return panPx(dx, dy); },
    view(ll, k) { const p = proj(ll); d3.select(canvas).call(zoom.transform, d3.zoomIdentity.translate(Wpx / 2 - p[0] * k, Hpx / 2 - p[1] * k).scale(k)); } };
  preloadYears();
})();
