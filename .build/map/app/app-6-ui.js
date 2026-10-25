/* =============================== lens words =============================== */
function lensShort() {
  switch (S.lens) {
    case "winner": return isNow() ? "Held by" : "Winner";
    case "tpp": return S.tppMode === "swing" ? "Swing to Labor" : "Labor 2PP";
    case "fp": return S.fpMode === "change" ? `${FAM_LEG[S.party]} change` : `${FAM_LEG[S.party]} primary`;
    case "flow": return `${FAM_LEG[S.from]} to Labor`;
    case "informal": return "Informal";
    case "cls": return "Seat type";
    case "seifa": return isDemo() ? DM_SHORT[S.index] : `${IX_ABBR[S.index]} decile`;
  }
  return "";
}
/* the lens as a list-table column head: every party coded, all of one register */
function lensHead() {
  switch (S.lens) {
    case "fp": return S.fpMode === "change" ? `${FAM_CODE[S.party]} change` : `${FAM_CODE[S.party]} primary`;
    case "flow": return `${FAM_CODE[S.from]} to Labor`;
    default: return lensShort();
  }
}
function valueText(v, kind) {
  if (v == null) {
    switch (S.lens) {
      case "tpp": return S.tppMode === "swing" ? (kind === "booth" ? "New place, so no swing" : "No swing recorded") : "No Labor v Coalition count";
      case "flow": return "Final two weren’t Labor and the Coalition";
      case "seifa": return isDemo() ? (S.year !== "now" && S.year < DEMO_FROM ? "Counted from 2016 on" : "No census figure here") : "No score here";
      case "fp": return S.fpMode === "change" ? "Didn’t stand both times" : "Didn’t stand";
      default: return "No data";
    }
  }
  switch (S.lens) {
    case "winner": return kind === "booth" ? `${FAM_NAME[v]} led here` : FAM_NAME[v];
    case "tpp": return S.tppMode === "swing" ? (Math.abs(v) < 0.05 ? "No swing" : `${f1(Math.abs(v))} swing to ${v > 0 ? "Labor" : "the Coalition"}`) : `Labor ${f1(v)} · Coalition ${f1(100 - v)}`;
    case "fp": return S.fpMode === "change" ? `${FAM_LEG[S.party]} ${sgn(v)} points` : `${FAM_LEG[S.party]} ${f1(v)}%`;
    case "flow": return `${f0(v)}% of ${FAM_LEG[S.from]} preferences to Labor`;
    case "informal": return `${f1(v)}% informal`;
    case "cls": return CLS_SHORT[v] || v;
    case "seifa": return isDemo() ? `${f1(v)}% ${DM_VERB[S.index]}` : `Decile ${v} of 10`;
  }
  return "";
}

/* =============================== the lens tabs =============================== */
function renderLenses() {
  $("#lenses").innerHTML = LENSES.map((l) => `<button type="button" class="rd-tab" role="tab" data-lens="${l.id}" aria-selected="${S.lens === l.id}"><span class="tw" data-t="${l.label}">${l.label}</span></button>`).join("");
}

/* =============================== the legend =============================== */
let legendKey = "";
const boothsShown = () => S.view === "map" && (selDiv() != null || T.k >= K_ALL);
const legendState = () => [S.view, boothsShown(), S.lens, S.tppMode, S.fpMode, S.party, S.from, S.index, S.basis, S.year, TH && TH.dark].join("|");
function legendIfChanged() { if (legendState() !== legendKey) renderLegend(); }
const RANGE = () => {
  switch (S.lens) {
    case "tpp": return S.tppMode === "swing" ? [-10, 10] : [30, 70];
    case "fp": return S.fpMode === "change" ? [-15, 15] : [0, FPMAX[S.party]];
    case "flow": return [10, 90];
    case "informal": return [0, 12];
    case "seifa": return isDemo() ? DM_RANGE[S.index] : [1, 10];
  }
  return null;
};
function legendHist(m, lo, hi) {
  const vals = m.divs.map((d) => divValue(m, d.i)).filter((v) => v != null);
  if (vals.length < 10) return "";
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
  const prev = m.year === "now" ? 2022 : prevYearOf(m.year);
  const grad = (tbl, from, to) => { const st = []; for (let k = 0; k <= 10; k++) st.push(`${css(tbl[Math.round(lerp(from, to, k / 10))])} ${k * 10}%`); return `linear-gradient(90deg, ${st.join(",")})`; };
  const ticks = (vals, lo, hi, fmt) => `<div class="lg-ticks">${vals.map((v) => `<span style="left:${(100 * (v - lo)) / (hi - lo)}%">${fmt(v)}</span>`).join("")}</div>`;
  const mark = (v, lo, hi) => (v == null ? "" : `<span class="mk" style="left:${(100 * (clamp(v, lo, hi) - lo)) / (hi - lo)}%" title="Australia ${f1(v)}"></span>`);
  const aus = m.areas.AUS;
  const boothsOn = boothsShown();
  const opt = (name, cur, list) => `<select data-opt="${name}" aria-label="${name}">${list.map(([v, t]) => `<option value="${v}"${cur === v ? " selected" : ""}>${t}</option>`).join("")}</select>`;
  const partyOpts = FAMS.map((f) => [f, FAM_LEG[f]]);
  let h = "";
  switch (S.lens) {
    case "winner": {
      const cnt = {}; for (const d of m.divs) cnt[d.hold.fam] = (cnt[d.hold.fam] || 0) + 1;
      h += `<div class="lg-t">${boothsOn ? "Who led the final count at each place" : isNow() ? "Who holds each seat today" : `Who won each seat in ${m.year}`}</div>`;
      h += `<div class="lg-cats">${["alp", "lnp", "grn", "ind", "onp", "oth"].filter((f) => cnt[f] || boothsOn).map((f) => `<span><i style="${swc(f)}"></i>${FAM_LEG[f]}${boothsOn ? "" : ` <b>${cnt[f]}</b>`}</span>`).join("")}</div>`;
      if (isNow() && !boothsOn) h += `<div class="lg-note">Independents include Community Strong’s two members.</div>`;
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
    case "flow": {
      h += `<div class="lg-t">Where ${opt("from", S.from, [["grn", "the Greens’"], ["onp", "One Nation’s"], ["ind", "independents’"], ["oth", "other candidates’"]])} preferences went</div>`;
      h += legendHist(m, 10, 90);
      h += `<div class="lg-ramp" style="background:${grad(RAMP.div, 0, 200)}"></div>${ticks([10, 30, 50, 70, 90], 10, 90, (v) => `${v}%`)}<div class="lg-ends"><span class="t-alp">◀ Mostly to Labor</span><span class="t-lnp">Mostly to the Coalition ▶</span></div><div class="lg-note"><span class="lg-hatch"></span>Final two weren’t Labor and the Coalition</div>`;
      break;
    }
    case "informal":
      h += `<div class="lg-t">Informal ballots</div>${legendHist(m, 0, 12)}<div class="lg-ramp" style="background:${grad(RAMP.inf, 0, 100)}">${mark(aus.infPct, 0, 12)}</div>${ticks([0, 3, 6, 9, 12], 0, 12, (v) => `${v}%${v === 12 ? "+" : ""}`)}<div class="lg-note">The line marks Australia: ${f1(aus.infPct)}%.</div>`;
      break;
    case "cls":
      h += `<div class="lg-t">The AEC’s seat types</div><div class="lg-cats">${CLS.map((c, k) => `<span><i style="background:${css(TH.cls[k])}"></i>${CLS_SHORT[c]} <b>${m.divs.filter((d) => d.cls === c).length}</b></span>`).join("")}</div>`;
      break;
    case "seifa": {
      // one picker for the census: the ABS's advantage indexes, then the people measures
      const og = (label, list) => `<optgroup label="${label}">${list.map(([v, t]) => `<option value="${v}"${S.index === v ? " selected" : ""}>${t}</option>`).join("")}</optgroup>`;
      h += `<div class="lg-t"><select data-opt="index" aria-label="Census measure">${og("Advantage, ABS SEIFA", IX.map((x) => [x, `${IX_NAME[x]} (${IX_ABBR[x]})`]))}${og("People", DM.map((x) => [x, DM_NAME[x]]))}</select></div>`;
      if (isDemo()) {
        const [lo, hi] = DM_RANGE[S.index], early = m.year !== "now" && m.year < DEMO_FROM;
        if (!early) h += legendHist(m, lo, hi);
        h += `<div class="lg-ramp" style="background:${grad(RAMP.demo[S.index], 0, 100)}">${early || !aus.demo ? "" : mark(aus.demo[S.index], lo, hi)}</div>${ticks([lo, (lo + hi) / 2, hi], lo, hi, (v) => `${v}%${v === hi ? "+" : ""}`)}`;
        h += `<div class="lg-note">${early ? "Counted from the 2016 election on: earlier elections don’t record where voters live." : `Share of residents, 2021 census, where each ${boothsOn ? "place’s" : "seat’s"} voters live.${aus.demo ? ` The line marks Australia: ${f1(aus.demo[S.index])}%.` : ""}`}</div>`;
        break;
      }
      h += `<div class="lg-ramp" style="background:${grad(RAMP.seifa, 0, 100)}"></div>${ticks([1, 10], 1, 10, (v) => `${v}`)}<div class="lg-ends"><span style="color:var(--ink-3)">◀ Least advantaged</span><span style="color:var(--ink-3)">Most ▶</span></div>`;
      h += boothsOn ? `<div class="lg-note">Places scored ${opt("basis", S.basis, [["venue", "where they stand"], ["voters", "where their voters live"]])}</div>` : `<div class="lg-note">Seats ranked into tenths of the ${m.divs.length}.</div>`;
      break;
    }
  }
  if (boothsOn) h += `<div class="lg-shapes"><span><i></i>Polling place</span><span><i class="sq"></i>Early voting</span><span>Size: votes</span></div>`;
  el.innerHTML = h;
}

/* =============================== the timeline =============================== */
let SUM = null;
function renderTimeline() {
  const el = $("#time"); if (!el) return;
  const W = el.clientWidth || 600, H = el.clientHeight || 66, m = M();
  // the elections sit at even steps: a run of results, not a calendar
  const X = (y) => 22 + (YEARS.indexOf(y) / (YEARS.length - 1)) * (W - 44);
  const short = W < 560;
  const base = H - 24, cur = S.year;
  const sd = m ? selDiv() : null;
  let g = `<line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="var(--line)"/>`;
  // the glyph above each stop: the House's make-up, or the chosen seat's two-party line
  if (sd != null && m) {
    const d = m.divs[sd], hh = d.h;
    const vs = hh.map((r) => r[1]).filter((v) => v != null);
    let lo = Math.min(...vs, 50) - 3, hi = Math.max(...vs, 50) + 3;
    if (hi - lo < 16) { const c = (lo + hi) / 2; lo = c - 8; hi = c + 8; }
    const yv = (v) => base - 6 - ((clamp(v, lo, hi) - lo) / (hi - lo)) * (base - 14);
    const pl = hh.filter((r) => r[1] != null && !r[4]).map((r) => `${X(r[0]).toFixed(1)},${yv(r[1]).toFixed(1)}`).join(" ");
    g += `<line x1="0" x2="${W}" y1="${yv(50)}" y2="${yv(50)}" stroke="var(--line)" stroke-dasharray="2 3"/><polyline points="${pl}" fill="none" stroke="var(--ink-faint)" stroke-width="1.4"/>`;
    for (const r of hh) {
      const yr = r[4] ? "now" : r[0];
      const cy = r[1] != null ? yv(r[1]) : yv(50);
      g += `<circle cx="${X(yr)}" cy="${cy}" r="${yr === cur ? 5 : 3.6}" fill="var(--m-${FAM(r[2])})" stroke="var(--bg)" stroke-width="1.5"><title>${r[4] ? "By-election" : r[0]}: ${esc(r[3])} (${esc(partyName(r[2]))})${r[1] != null ? `, Labor two-party ${f1(r[1])}` : ""}</title></circle>`;
    }
    if (cur === "now" && !hh.some((r) => r[4])) { const last = hh[hh.length - 1]; if (last) g += `<circle cx="${X("now")}" cy="${last[1] != null ? yv(last[1]) : yv(50)}" r="5" fill="var(--m-${m.divs[sd].hold.fam})" stroke="var(--bg)" stroke-width="1.5"/>`; }
  } else if (SUM) {
    const st = S.sel.level === "state" ? S.sel.st : "AUS";
    for (const y of YEARS) {
      const s = SUM.seats[y] && SUM.seats[y][st]; if (!s) continue;
      const tot = sum(Object.values(s)), bw = 30, x = X(y) - bw / 2;
      let acc = 0;
      for (const f of ["alp", "grn", "ind", "oth", "onp", "lnp"]) { const n = s[f] || 0; if (!n) continue; const w = (bw * n) / tot; g += `<rect x="${(x + acc).toFixed(2)}" y="${base - 18}" width="${Math.max(0.6, w - 0.6).toFixed(2)}" height="8" fill="var(--m-${f})" opacity="${y === cur ? 1 : 0.62}"/>`; acc += w; }
    }
  }
  for (const y of YEARS) {
    const on = y === cur, x = X(y), lab = short && y !== "now" ? "’" + String(y).slice(2) : yearLabel(y);
    g += `<g class="stop" data-year="${y}" style="cursor:pointer"><rect class="hit" x="${x - 24}" y="0" width="48" height="${H}"/><line x1="${x}" x2="${x}" y1="${base - 3}" y2="${base + 3}" stroke="${on ? "var(--ink)" : "var(--ink-faint)"}"/><text class="yr${on ? " on" : ""}" x="${x}" y="${base + 17}" text-anchor="middle">${lab}</text>${on ? `<line x1="${x - 16}" x2="${x + 16}" y1="${base + 22}" y2="${base + 22}" stroke="var(--ink)" stroke-width="2"/>` : ""}</g>`;
  }
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Elections from 2004 to now; choose one">${g}</svg>`;
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
  const m = M(); if (!h || !m) return "";
  if (h.kind === "div") {
    const d = m.divs[h.i];
    const v = divValue(m, h.i);
    const sp = h.i === m.speaker ? " · Speaker" : "";
    const holder = d.hold;
    return `<div class="tn">${esc(d.n)}<span>${STATE_SHORT[d.st]}${sp}</span></div><div class="tv">${esc(valueText(v, "div"))}</div><div class="ts">${esc(holder.n)}, ${esc(leaderName(holder))}${S.lens === "winner" ? ` · ${d.by ? "by-election" : "margin"} ${f1(d.margin)}` : ""}</div>`;
  }
  const b = m.booth, j = h.i, D = m.divs[b.d[j]];
  const ld = b.lead[j], lname = ld ? pairNames(ld, ld === D.A ? D.B : D.A)[0] : "";
  return `<div class="tn">${esc(b.name[j])}<span>${esc(D.n)}</span></div><div class="tv">${esc(valueText(boothValue(m, j), "booth"))}</div><div class="ts">${int(b.votes[j])} votes${ld ? ` · ${esc(lname)} ${f1(b.leadPct[j])}` : ""}</div>`;
}

/* =============================== selection =============================== */
function select(sel, opts = {}) {
  const prevDiv = selDiv();
  S.sel = sel;
  if (selDiv() !== prevDiv) quietSince = performance.now();
  S.hover = null; hideTip();
  if (opts.view && opts.view !== S.view) setView(opts.view, true);
  if (S.view === "map" && opts.fly !== false) fitSelection(opts.dur ?? 800);
  renderStory(true);
  if (S.view === "list") renderList(true);
  renderFilterPill(); legendIfChanged(); updateHint(); renderTimeline(); writeURL();
  if (isPhone() && opts.scroll !== false && sel.level !== "aus") { /* the story sits under the map on a phone: nothing to scroll */ }
  schedule();
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
  const m = M(), el = $("#sugg"), q = S.q.trim();
  if (S.view === "list") { el.hidden = true; renderList(); return; }
  if (!m || q.length < 2) { el.hidden = true; sugg = []; $("#q").setAttribute("aria-expanded", "false"); return; }
  const toks = norm(q).split(/\s+/).filter(Boolean);
  const scored = [];
  for (const it of m.search.items) {
    const h = it.h; let ok = true, score = it.rank * 10;
    for (const t of toks) { const p = h.indexOf(t); if (p < 0) { ok = false; break; } if (p === 0) score -= 4; else if (h[p - 1] === " ") score -= 2; }
    if (ok) scored.push([score, it]);
    if (scored.length > 4000) break;
  }
  scored.sort((a, b) => a[0] - b[0]);
  const groups = { state: [], div: [], mp: [], cand: [], booth: [] };
  for (const [, it] of scored) { const g = groups[it.k]; if (g.length < (it.k === "booth" ? 6 : 4)) g.push(it); }
  sugg = [...groups.state, ...groups.div, ...groups.mp, ...groups.cand, ...groups.booth];
  suggAt = sugg.length ? 0 : -1;
  const label = { state: "States and territories", div: "Seats", mp: isNow() ? "Members" : "Members elected", cand: "Candidates", booth: "Polling places" };
  let html = "", n = 0;
  for (const k of ["state", "div", "mp", "cand", "booth"]) {
    if (!groups[k].length) continue;
    html += `<div class="g">${label[k]}</div>`;
    for (const it of groups[k]) {
      const color = it.k === "booth" ? colCss(m.boothCol[it.j]) : it.k === "state" ? "var(--line)" : colCss(m.divCol[it.i]);
      html += `<button type="button" role="option" data-n="${n}" aria-selected="${n === suggAt}"><i class="sw" style="background:${color}"></i><span class="t">${esc(it.t)}</span><span class="s">${esc(it.s)}</span></button>`;
      n++;
    }
  }
  el.innerHTML = html || `<div class="none">No seat, member or place matches “${esc(q)}”.</div>`;
  el.hidden = false; $("#q").setAttribute("aria-expanded", "true");
}
function chooseSugg(k) {
  const it = sugg[k]; if (!it) return;
  $("#sugg").hidden = true; $("#q").value = ""; S.q = ""; $("#q").blur();
  const view = it.k === "booth" && S.view === "chamber" ? "map" : undefined;
  if (it.k === "state") goState(it.st, { view });
  else if (it.k === "div" || it.k === "mp" || it.k === "cand") goDiv(it.i, { view });
  else goBooth(it.j, { view });
}

/* =============================== views, lenses, years =============================== */
function setView(v, quiet) {
  if (v === S.view) return;
  const prev = S.view;
  S.view = v;
  $$(".mp-views .rd-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === v)));
  const list = v === "list";
  $("#list").hidden = !list;
  $("#view").classList.toggle("v-chamber", v === "chamber");
  for (const id of ["#cities", "#zoomer", "#hint"]) $(id).hidden = v !== "map";
  canvas.style.visibility = list ? "hidden" : "visible";
  canvas.classList.toggle("grab", v === "map");
  hideTip(); S.hover = null;
  if (list) { $("#sugg").hidden = true; renderList(); }
  else {
    if ((prev === "map" && v === "chamber") || (prev === "chamber" && v === "map")) morph = reduceMotion ? null : { t0: performance.now(), dur: 1000, to: v };
    if (v === "map" && prev === "list") fitSelection(0);
  }
  renderLegend(); renderFilterPill(); updateHint(); writeURL();
  if (!quiet) renderStory(true);
  schedule();
}
function setLens(id) {
  if (S.lens === id) return;
  S.lens = id; S.sort = null; S.dist = null;
  if (S.f.range && S.f.range.key === "lens") S.f.range = null;
  $$("#lenses .rd-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.lens === id)));
  startChamberGlide();
  recolor(true); renderLegend(); renderStory(true); writeURL();
  if (S.view === "list") renderList(true);
}
function lensParamChanged() {
  S.sort = null; if (S.f.range && S.f.range.key === "lens") S.f.range = null;
  startChamberGlide(); recolor(true); renderLegend(); renderStory(true); writeURL();
  if (S.view === "list") renderList(true);
}
let yearFade = null;
async function setYear(y) {
  if (y === S.year) return;
  const from = S.year, a = M();
  $("#loading").hidden = false; $("#loading").textContent = `Loading ${yearLabel(y)}`;
  try { await loadYear(y); } catch (e) { $("#loading").textContent = "That election didn’t load. Try again."; return; }
  $("#loading").hidden = true;
  const b = Y[y];
  // carry the selection across by seat name and polling-place ID
  const s = S.sel;
  if ((s.level === "div" || s.level === "booth") && a) {
    const ni = b.byName.get(a.divs[s.div].n);
    if (ni == null) S.sel = { level: "state", st: s.st };
    else if (s.level === "booth") { const id = a.booth.id[s.booth]; const nj = b.booth.byDiv[ni].find((j) => b.booth.id[j] === id); S.sel = nj != null ? { level: "booth", st: s.st, div: ni, booth: nj } : { level: "div", st: s.st, div: ni }; }
    else S.sel = { level: "div", st: s.st, div: ni };
  }
  startChamberGlide();
  S.year = y;
  recolor(false);
  if (S.view === "map") yearFade = reduceMotion ? null : { from, t0: performance.now(), dur: 520 };
  setExtent();
  renderTimeline(); renderLegend(); renderStory(true); renderFilterPill(); writeURL();
  $("#mp-meta").textContent = metaLine();
  if (S.view === "list") renderList(true);
  schedule();
}
function metaLine() {
  const m = M(); if (!m) return "";
  return m.year === "now" ? `The House as it stands, ${longDate(m.asOf)} · ${m.booth.n.toLocaleString("en-AU")} polling places` : `The ${m.year} federal election, ${longDate(m.date)} · ${m.divs.length} seats · ${m.booth.n.toLocaleString("en-AU")} polling places`;
}

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
  let yf = 1;
  if (yearFade) { yf = ease(clamp((ts - yearFade.t0) / yearFade.dur, 0, 1)); if (yf < 1) again = true; else yearFade = null; }
  if (morph) {
    const t = clamp((ts - morph.t0) / morph.dur, 0, 1);
    drawMorph(m, morph.to === "chamber" ? t : 1 - t);
    if (t < 1) again = true; else { morph = null; again = true; }
  } else if (S.view === "map") {
    if (yearFade && Y[yearFade.from] && Y[yearFade.from].divs) drawGeo(Y[yearFade.from], 1 - yf);
    drawGeo(m, yearFade ? yf : 1, streetK());
    drawFocus(m); drawBooths(m); drawLabels(m);
  } else if (S.view === "chamber") {
    drawChamberMain(m, 1);
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
  const moved = keyOnly && !atLastFit();
  Wpx = r.width; Hpx = r.height;
  canvas.width = Math.round(Wpx * dpr); canvas.height = Math.round(Hpx * dpr);
  if (M()) {
    setExtent();
    if (moved) d3.select(canvas).call(zoom.transform, d3.zoomIdentity.translate(T.x, T.y + dh / 2).scale(T.k));
    else if (first || changed) fitSelection(keyOnly && !reduceMotion ? 320 : 0);
  }
  renderTimeline();
  schedule();
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
  if (S.lens === "flow") p.set("p", S.from);
  if (S.lens === "seifa") { p.set("i", S.index); if (S.basis === "voters") p.set("b", "voters"); }
  if (S.view !== "map") p.set("v", S.view);
  if (m) {
    const s = S.sel;
    if (s.level === "state") p.set("s", s.st);
    else if (s.level === "div") p.set("s", m.divs[s.div].n);
    else if (s.level === "booth") p.set("s", m.divs[s.div].n + "/" + m.booth.id[s.booth]);
  }
  const h = p.toString();
  try { history.replaceState(null, "", h ? "#" + h : location.pathname + location.search); } catch (e) {}
}
function readURL() {
  const p = new URLSearchParams(location.hash.slice(1));
  const y = p.get("y"); if (y && YEARS.includes(+y)) S.year = +y;
  const l = p.get("l"); if (l && LENSES.some((x) => x.id === l)) S.lens = l;
  const mm = p.get("m"); if (mm === "swing") S.tppMode = "swing"; if (mm === "change") S.fpMode = "change";
  const pp = p.get("p"); if (pp && FAMS.includes(pp)) { if (S.lens === "flow") S.from = pp; else S.party = pp; }
  const i = p.get("i"); if (i && (IX.includes(i) || DM.includes(i))) S.index = i;
  if (p.get("b") === "voters") S.basis = "voters";
  const v = p.get("v"); if (v === "chamber" || v === "list") S.view = v;
  return p.get("s");
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
  if (!h) { if (S.sel.level !== "aus" && S.view === "map" && T.k < HOME.k * 1.4) goAus(); return; }
  if (h.kind === "booth") goBooth(h.i);
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
  const g = e.target.closest("g[data-year]"); if (g) { setYear(g.dataset.year === "now" ? "now" : +g.dataset.year); }
});
$("#time").addEventListener("click", (e) => { const g = e.target.closest("[data-year]"); if (g) setYear(g.dataset.year === "now" ? "now" : +g.dataset.year); });
// a stop under the pointer starts loading its election, so the click finds it ready
$("#time").addEventListener("pointerover", (e) => { const g = e.target.closest("[data-year]"); if (g) { const y = g.dataset.year === "now" ? "now" : +g.dataset.year; if (!Y[y]) setTimeout(() => loadYear(y).catch(() => {}), 120); } });
document.addEventListener("click", (e) => {
  const city = e.target.closest("[data-city]");
  if (city) { flyToCity(+city.dataset.city); return; }
  const t = e.target.closest("[data-go],[data-lens],[data-view],[data-sort],[data-unit],[data-unseat],[data-unrange],[data-distclose],[data-dist],[data-listbooths],[data-showmap],[data-more],[data-clear],[data-n],[data-flip]");
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
  if (t.dataset.view) { setView(t.dataset.view); return; }
  if (t.dataset.flip === "tpp") { S.tppMode = S.tppMode === "swing" ? "share" : "swing"; lensParamChanged(); return; }
  if (t.dataset.flip === "fp") { S.fpMode = S.fpMode === "change" ? "share" : "change"; lensParamChanged(); return; }
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
    if (k === "party") S.party = t.value; else if (k === "from") S.from = t.value; else if (k === "index") S.index = t.value; else if (k === "basis") S.basis = t.value;
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
document.addEventListener("keydown", (e) => {
  const typing = e.target.closest && e.target.closest("input,select,textarea");
  if (e.key === "/" && !typing) { e.preventDefault(); q.focus({ preventScroll: true }); q.scrollIntoView({ block: "nearest", behavior: "smooth" }); return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "Escape") goUp();
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") { const k = YEARS.indexOf(S.year) + (e.key === "ArrowRight" ? 1 : -1); if (YEARS[k] != null) { e.preventDefault(); setYear(YEARS[k]); } }
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

/* =============================== boot =============================== */
(async () => {
  TH = readTheme(); buildRamps();
  const selFromURL = readURL();
  renderLenses();
  $$(".mp-views .rd-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === S.view)));
  $("#cities").innerHTML = CITIES.map(([n], k) => `<button type="button" data-city="${k}">${n}</button>`).join("");
  getJSON("/map/data/summary.json").then((s) => { SUM = s; renderTimeline(); }).catch(() => {});
  try { await loadYear(S.year); } catch (err) { $("#loading").textContent = "The map’s data didn’t load. Reload the page to try again."; return; }
  $("#loading").hidden = true;
  $("#mp-meta").textContent = metaLine();
  recolor(false);
  resize();
  const view = S.view; S.view = "map"; if (view !== "map") setView(view, true);
  $("#view").classList.toggle("v-chamber", S.view === "chamber");
  if (!applySelFromURL(selFromURL)) goAus({ fly: false });
  fitSelection(0);
  urlReady = true; writeURL();
  renderLegend(); updateHint(); renderTimeline();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { schedule(); renderTimeline(); paintMiniChamber(); });
  window.__map = { S, Y, select, goDiv, goBooth, goState, goAus, setLens, setView, setYear, get T() { return T; }, get HOME() { return HOME; },
    drawNow() { const t0 = performance.now(); frame(t0); if (raf) { cancelAnimationFrame(raf); raf = 0; } return performance.now() - t0; },
    panBy(dx, dy) { return panPx(dx, dy); } };
})();
