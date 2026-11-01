/* app-2-dist.js: how many seats each party wins across the simulations - the run's histograms, lightly
   smoothed for the eye (the tooltip reads the raw counts), the majority line (76; Victoria 45), a reading of every
   seat count under the pointer. The Greens and independents sit at small counts and in the head's
   ranges instead, so the three parties that can lead are drawn here. */
const DIST_PARTIES = ["alp", "on", "lnp"];
function renderDist() {
  const host = $("#dist"), r = run(), H = r.national.histogram, draws = r.meta.draws;
  $("#dist-meta").textContent = `Share of the ${draws.toLocaleString("en-AU")} simulated elections in which each party wins each number of seats`;
  const M = majOf(r), TOT = totalOf(r);
  let top = Math.round(TOT * 2 / 3);
  for (const k of DIST_PARTIES) for (let x = H[k].length - 1; x >= 0; x--) if (H[k][x] / draws >= 0.0005) { top = Math.max(top, x); break; }
  const xmax = Math.ceil((top + 3) / 10) * 10;
  const ser = DIST_PARTIES.map((k) => {
    const v = Array.from({ length: xmax + 1 }, (_, x) => (H[k][x] || 0) / draws);
    const sm = v.map((_, x) => { let s = 0, w = 0; for (let d = -2; d <= 2; d++) { const xx = x + d; if (xx < 0 || xx > xmax) continue; const ww = 3 - Math.abs(d); s += ww * v[xx]; w += ww; } return s / w; });
    const cum = []; let c = 0; for (let x = xmax; x >= 0; x--) { c += v[x]; cum[x] = c; }
    return { k, v, sm, cum };
  });
  const W = Math.max(300, host.clientWidth), narrow = W < 560, Hh = narrow ? 210 : 250;
  const m = { l: 34, r: 8, t: 22, b: 26 };
  const ymax = Math.max(...ser.flatMap((s) => s.sm)) * 1.12;
  const X = (x) => m.l + (W - m.l - m.r) * x / xmax, Y = (y) => m.t + (Hh - m.t - m.b) * (1 - y / ymax);
  host.textContent = "";
  const s = svg("svg", { viewBox: `0 0 ${W} ${Hh}`, role: "img", "aria-label": DIST_PARTIES.map((k) => `${PARTY[k].name}: most often ${ser.find((q) => q.k === k).v.indexOf(Math.max(...ser.find((q) => q.k === k).v))} seats`).join("; ") }, host);
  const g = svg("g", { class: "grid" }, s);
  const step = ymax > 0.06 ? 0.02 : ymax > 0.03 ? 0.01 : 0.005;
  for (let y = 0; y <= ymax; y += step) { svg("line", { x1: m.l, x2: W - m.r, y1: Y(y), y2: Y(y) }, g); const t = svg("text", { x: m.l - 6, y: Y(y) + 4, "text-anchor": "end", class: "lab" }, s); t.textContent = `${Math.round(y * 1000) / 10}%`; }
  const ax = svg("g", { class: "axis" }, s);
  for (let x = 0; x <= xmax; x += xmax > 100 ? 25 : 10) { const t = svg("text", { x: X(x), y: Hh - 6, "text-anchor": "middle" }, ax); t.textContent = x; }
  svg("line", { x1: X(M), x2: X(M), y1: m.t - 8, y2: Hh - m.b, class: "maj" }, s);
  const ml = svg("text", { x: X(M) + 5, y: m.t - 10, class: "lab" }, s); ml.textContent = `${M} for a majority`;
  const labs = [];
  for (const q of ser) {
    const pts = q.sm.map((y, x) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`);
    const gp = svg("g", { class: `t-${q.k}` }, s);
    svg("path", { class: "ar", d: `M${X(0)},${Y(0)}L${pts.join("L")}L${X(xmax)},${Y(0)}Z` }, gp);
    svg("path", { class: "ln", d: `M${pts.join("L")}` }, gp);
    const peak = q.sm.indexOf(Math.max(...q.sm));
    const lab = svg("text", { x: X(peak), y: Y(q.sm[peak]) - 7, "text-anchor": "middle", class: "plab" }, gp); lab.textContent = PARTY[q.k].name;
    labs.push({ lab, x: X(peak), y: Y(q.sm[peak]) - 7, w: lab.getComputedTextLength ? lab.getComputedTextLength() : 7 * PARTY[q.k].name.length });
  }
  // peaks that sit together (Victoria: Labor and the Coalition) would print one name over the other: the
  // left one ends at its peak, the right one starts there, and a pair still touching steps up a line
  labs.sort((a, b) => a.x - b.x);
  for (let i = 1; i < labs.length; i++) {
    const A = labs[i - 1], B = labs[i];
    if (Math.abs(A.y - B.y) < 14 && Math.abs(A.x - B.x) < (A.w + B.w) / 2 + 6) {
      A.lab.setAttribute("text-anchor", "end"); A.lab.setAttribute("x", A.x - 3);
      B.lab.setAttribute("text-anchor", "start"); B.lab.setAttribute("x", B.x + 3);
      if (Math.abs(A.x - B.x) < 6) { const up = Math.min(A.y, B.y) - 14; (A.y <= B.y ? B : A).lab.setAttribute("y", Math.max(12, up)); }
    }
  }
  const guide = svg("line", { class: "guide", y1: m.t, y2: Hh - m.b, visibility: "hidden" }, s);
  const tip = document.createElement("div"); tip.className = "md-tip"; tip.hidden = true; host.appendChild(tip);
  const hit = svg("rect", { x: m.l, y: 0, width: W - m.l - m.r, height: Hh - m.b, fill: "transparent" }, s);
  const move = (ev) => {
    const box = s.getBoundingClientRect(), px = (ev.clientX - box.left) * W / box.width;
    const x = clamp(Math.round((px - m.l) / (W - m.l - m.r) * xmax), 0, xmax);
    guide.setAttribute("x1", X(x)); guide.setAttribute("x2", X(x)); guide.setAttribute("visibility", "visible");
    tip.innerHTML = `<div class="h">${x} seats</div>` + ser.map((q) => `<div class="r t-${q.k}"><span class="dot"></span>${PARTY[q.k].name} wins exactly ${x}<b>${(100 * q.v[x]).toFixed(1)}%</b></div>`).join("")
      + `<div class="r" style="margin-top:4px;color:var(--ink-3)">${x} or more: ${ser.map((q) => `${PARTY[q.k].short} ${pctShort(q.cum[x])}`).join(" · ")}</div>`;
    tip.hidden = false;
    const tx = (X(x) / W) * box.width, tw = tip.offsetWidth;
    tip.style.left = `${clamp(tx + 14 > box.width - tw ? tx - tw - 14 : tx + 14, 0, Math.max(0, box.width - tw))}px`;
    tip.style.top = "8px";
  };
  hit.addEventListener("pointermove", move);
  hit.addEventListener("pointerdown", move);
  hit.addEventListener("pointerleave", () => { tip.hidden = true; guide.setAttribute("visibility", "hidden"); });
}
