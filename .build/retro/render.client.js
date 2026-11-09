/* =============================== the retro pages' panels and charts ===============================
   The drawing half of the retro Now and Past cycles pages (/retro/,
   /cycles/retro/). Their content is the modern pages' own: harvest.mjs runs
   the modern page in node and blocks.mjs reads each section as blocks (a
   headline, its dek, figures, tables, chart specs). This file turns those
   blocks into the era's dress: panels under navy caption bars, group boxes,
   trackbars and progress bars, details lists, and charts drawn the way an
   office chart of about 2000 drew them (a grey plot area, gridlines, square
   and diamond markers, a boxed legend).

   One file, two readers. now.mjs and cycles.mjs run it in node (no
   document, so only the renderers load) to write every panel into the page
   as it first opens; the browser runs it again (pages.client.js) to draw a
   panel's other views when a control picks one, and to redraw each chart at
   the width its frame really has. Nothing here works out a figure: every
   number and word is the block's, as the modern page printed it. */
(function () {
"use strict";
const W = typeof window !== "undefined" ? window : globalThis;
const R = (W.RT_R = {});

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
R.esc = esc;
const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
const num = (v) => (Math.round(v * 100) / 100).toString();

/* ----------------------------------------------------------------- the palette
   The modern page's colour tokens, as the era printed them: the retro map's
   party colours (vivid, on grey), their darker text inks, and the other
   series' colours pushed to the old 216-colour web palette's neighbours */
const COL = {
  "--alp": "#f7310a", "--lnp": "#1432d5", "--onp": "#ff8c00", "--grn": "#14ad4a", "--oth": "#6e6e6e",
  "--alp-text": "#c8240a", "--lnp-text": "#1432d5", "--onp-text": "#b45500", "--grn-text": "#0b7a33", "--oth-text": "#505050",
  "--onp-deep": "#b35a00",
  "--ink": "#000000", "--ink-2": "#202020", "--ink-3": "#404040", "--ink-faint": "#808080", "--line": "#808080", "--line-2": "#a0a0a0",
  "--mood-pos": "#008080", "--mood-neg": "#804000",
  "--confidence-main": "#800080", "--confidence-alt": "#b08800", "--confidence-third": "#00806a",
  "--cyc-fill": "#707070",
  "--tint-alp": "#ffd6cc", "--tint-lnp": "#ccd4ff", "--tint-onp": "#ffe2bf", "--tint-grn": "#c8f0d4", "--tint-oth": "#e4e4e4",
};
// a party's ramp (a group's shades in Who votes): from its colour to a deep tone
const RAMP = { alp: ["#ff6a4d", "#f7310a", "#b81e00", "#7a1400"], lnp: ["#5c74ff", "#1432d5", "#0c2296", "#06145a"],
  onp: ["#ffb04d", "#ff8c00", "#c26400", "#7a3c00"], grn: ["#4fd67a", "#14ad4a", "#0b7a33", "#064d1f"], oth: ["#a0a0a0", "#7a7a7a", "#505050", "#2a2a2a"] };
for (const p in RAMP) RAMP[p].forEach((c, i) => { COL["--ramp-" + p + "-" + (i + 1)] = c; });
const col = (c) => {
  if (!c) return "#000000";
  const m = /^var\((--[\w-]+)\)$/.exec(String(c).trim());
  if (m) return COL[m[1]] || "#000080";
  return /^(#|rgb|hsl)/.test(c) ? c : "#000080";
};
R.col = col;
R.COL = COL;
// a token's text ink: party colours darkened for 12px type
const ink = (c) => { const m = /^var\(--(alp|lnp|onp|grn|oth)\)$/.exec(String(c || "").trim()); return m ? COL["--" + m[1] + "-text"] : col(c); };
R.ink = ink;
// the parties by name, for words that carry no token (a bar's segment, a table's head)
const PARTY_OF = [[/^(labor|alp|albanese)/i, "alp"], [/^(the )?coalition|^l\/np|^liberal|^ley\b|^taylor\b|^dutton/i, "lnp"], [/^(pauline )?hanson|^one nation|^on\b/i, "onp"], [/^(the )?greens|^grn/i, "grn"], [/^others?\b|^oth\b|^independ/i, "oth"]];
const partyOf = (s) => { for (const [re, p] of PARTY_OF) if (re.test(String(s || "").trim())) return p; return null; };
R.partyOf = partyOf;

/* ----------------------------------------------------------------- the chart
   An office chart of the era: the chart area white, the plot area grey,
   gridlines across it, black axes, the series in heavy lines with markers
   where they are few, the polls as small squares, bands as tinted areas,
   the end of each line labelled, events as dotted rules. Drawn into a
   viewBox the frame's own width, so text stays its own size at any width. */
const MARK = ["square", "diamond", "triangle", "circle", "square", "diamond", "triangle", "circle", "square", "diamond"];
function marker(kind, x, y, r, fill, stroke) {
  const a = `fill="${fill}" stroke="${stroke}" stroke-width="1"`;
  if (kind === "diamond") return `<path d="M${num(x)} ${num(y - r - 0.6)}L${num(x + r + 0.6)} ${num(y)}L${num(x)} ${num(y + r + 0.6)}L${num(x - r - 0.6)} ${num(y)}Z" ${a}/>`;
  if (kind === "triangle") return `<path d="M${num(x)} ${num(y - r - 0.5)}L${num(x + r + 0.5)} ${num(y + r)}L${num(x - r - 0.5)} ${num(y + r)}Z" ${a}/>`;
  if (kind === "circle") return `<circle cx="${num(x)}" cy="${num(y)}" r="${num(r)}" ${a}/>`;
  return `<rect x="${num(x - r)}" y="${num(y - r)}" width="${num(2 * r)}" height="${num(2 * r)}" ${a}/>`;
}
const textW = (s, px) => String(s).length * px * 0.56;
R.chart = function chart(spec, o = {}) {
  if (!spec) return "";
  const w = Math.max(240, Math.round(o.w || 760)), small = !!o.small || w < 300;
  const phone = w < 520;
  const fs = small ? 10 : 11;
  // the end labels' room: the widest label that will print
  const ends = spec.series.filter((s) => s.end && s.o !== 0);
  const endW = small ? 0 : Math.min(phone ? 66 : 120, Math.max(0, ...ends.map((s) => textW(s.end, fs) + 10)));
  const evRows = small || !spec.events.length ? 0 : phone ? 1 : 2;
  // room over the plot for the events' names, and for a note set just above the top line (the small charts' "50%")
  const noteAbove = spec.notes.some((n) => n[1] != null && n[2] < 0 && spec.y.length === 2 && n[1] >= spec.y[1] - 1e-9);
  const L = Math.max(30, Math.min(56, 10 + Math.max(...spec.yt.map((t) => textW(t[1], fs))))), Rm = 8 + endW, T = 8 + evRows * 13 + (noteAbove ? 8 : 0), B = small ? 18 : 22;
  const ph = Math.round(small ? 116 : Math.max(150, Math.min(phone ? 210 : 290, (spec.h || 330) * (phone ? 0.6 : 0.74))));
  const H = T + ph + B;
  // x arrives as its place along the axis, 0–1000 (harvest.mjs chartSpec)
  const [y0, y1] = spec.y.length === 2 ? spec.y : [0, 100];
  const X = (v) => L + (v / 1000) * (w - L - Rm);
  const Y = (v) => T + ph - ((v - y0) / (y1 - y0 || 1)) * ph;
  const inX = (v) => v >= -0.5 && v <= 1000.5;
  const pairs = (a, n) => { const o = []; for (let i = 0; i + n - 1 < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
  const out = [];
  out.push(`<svg class="rc-svg" viewBox="0 0 ${w} ${H}" width="${w}" height="${H}" role="img" aria-label="${esc(spec.title || "Chart")}" xmlns="http://www.w3.org/2000/svg">`);
  out.push(`<defs><clipPath id="${o.id || "rc"}-clip"><rect x="${L}" y="${T}" width="${w - L - Rm}" height="${ph}"/></clipPath></defs>`);
  // the plot area, its gridlines and the axes
  out.push(`<rect class="rc-plot" x="${L}" y="${T}" width="${w - L - Rm}" height="${ph}"/>`);
  for (const [v, lab] of spec.yt) {
    if (v < y0 - 1e-9 || v > y1 + 1e-9) continue;
    const y = num(Y(v));
    out.push(`<path class="rc-grid" d="M${L} ${y}H${w - Rm}"/>`);
    out.push(`<path class="rc-tick" d="M${L - 4} ${y}H${L}"/>`);
    if (lab) out.push(`<text class="rc-yl" x="${L - 6}" y="${y}" dy="0.32em" text-anchor="end" font-size="${fs}">${esc(lab)}</text>`);
  }
  let lastX = -1e9;
  const xts = spec.xt.filter((t) => inX(t[0]));
  for (const [v, lab, strong] of xts) {
    const x = X(v);
    out.push(`<path class="rc-tick" d="M${num(x)} ${T + ph}V${T + ph + 4}"/>`);
    const tw = textW(lab, fs);
    if (x - tw / 2 < lastX + 6 && !strong) continue;
    if (x + tw / 2 > w - 2) continue;
    out.push(`<text class="rc-xl${strong ? " rc-strong" : ""}" x="${num(Math.max(tw / 2 + 1, x))}" y="${T + ph + (small ? 13 : 16)}" text-anchor="middle" font-size="${fs}">${esc(lab)}</text>`);
    lastX = x + tw / 2;
  }
  // events: a dotted rule each, their names stacked over the plot
  if (spec.events.length) {
    const rows = [];
    for (const [v, lab] of spec.events) {
      if (!inX(v)) continue;
      const x = X(v);
      out.push(`<path class="rc-ev" d="M${num(x)} ${T}V${T + ph}"/>`);
      if (!evRows || !lab) continue;
      const tw = textW(lab, 10);
      let r = 0;
      while (r < evRows && rows[r] != null && x - 2 < rows[r]) r++;
      if (r >= evRows) continue;
      const tx = Math.min(w - Rm - tw, Math.max(L, x + 2));
      rows[r] = tx + tw + 6;
      out.push(`<text class="rc-evl" x="${num(tx)}" y="${8 + r * 13}" dy="0.6em" font-size="10">${esc(lab)}</text>`);
    }
  }
  out.push(`<g clip-path="url(#${o.id || "rc"}-clip)">`);
  // bands: a party's interval tinted on the grey; the past terms' spread in greys
  for (const a of spec.areas) {
    const c = col(a.c), grey = /cyc-fill|ink|line/.test(a.c);
    const op = grey ? (/(^|\s)hi(\s|$)/.test(a.cls) ? 0.42 : 0.26) * (/thin/.test(a.cls) ? 0.55 : 1) : Math.max(0.26, Math.min(0.45, (a.o || 0.18) * 2));
    const ap = pairs(a.p, 3);
    const top = ap.map((p) => `${num(X(p[0]))} ${num(Y(p[2]))}`), bot = ap.slice().reverse().map((p) => `${num(X(p[0]))} ${num(Y(p[1]))}`);
    out.push(`<path d="M${top.join("L")}L${bot.join("L")}Z" fill="${grey ? "#ffffff" : c}" fill-opacity="${op}" stroke="none"/>`);
  }
  for (const [v, lab] of spec.refs) {
    if (v < y0 || v > y1) continue;
    out.push(`<path class="rc-ref" d="M${L} ${num(Y(v))}H${w - Rm}"/>`);
  }
  // the polls, as the era's small squares, one path a colour
  if (spec.dots.length && !o.noDots) {
    const r = small ? 1.3 : 1.6;
    for (const [c, hollow, xy] of spec.dots) {
      const ds = [];
      for (let i = 0; i + 1 < xy.length; i += 2) {
        if (!inX(xy[i])) continue;
        ds.push(`M${num(X(xy[i]) - r)} ${num(Y(xy[i + 1]) - r)}h${num(2 * r)}v${num(2 * r)}h${num(-2 * r)}z`);
      }
      if (!ds.length) continue;
      out.push(hollow ? `<path d="${ds.join("")}" fill="none" stroke="${col(c)}" stroke-width="0.9" opacity="0.85"/>` : `<path d="${ds.join("")}" fill="${col(c)}" fill-opacity="0.55" stroke="${col(c)}" stroke-opacity="0.8" stroke-width="0.5"/>`);
    }
  }
  // the lines, heaviest last; markers where the line has few points
  const ser = spec.series.slice().sort((a, b) => (a.w || 2) - (b.w || 2));
  ser.forEach((s) => {
    const c = col(s.c), pts = pairs(s.p, 2).filter((p) => inX(p[0]));
    if (!pts.length) return;
    const sw = Math.max(1, Math.min(3, (s.w || 2) * (small ? 0.6 : 0.75)));
    const d = pts.map((p, i) => (i ? "L" : "M") + num(X(p[0])) + " " + num(Y(p[1]))).join("");
    out.push(`<path d="${d}" fill="none" stroke="${c}" stroke-width="${num(sw)}" stroke-linejoin="round"${s.d ? ' stroke-dasharray="5 3"' : ""}${s.o < 1 ? ` stroke-opacity="${s.o}"` : ""}/>`);
  });
  if (!small) {
    let mi = 0;
    spec.series.forEach((s) => {
      const pts = pairs(s.p, 2).filter((p) => inX(p[0]));
      if (pts.length > 46 || (s.w || 2) < 2 || s.d || s.o < 1) return;
      const kind = MARK[mi++ % MARK.length], c = col(s.c);
      for (const p of pts) out.push(`${marker(kind, X(p[0]), Y(p[1]), 2.4, c, "#000000").replace("/>", `><title>${esc((s.l || "") + ": " + p[1])}</title></${kind === "circle" ? "circle" : kind === "square" ? "rect" : "path"}>`)}`);
    });
  }
  out.push(`</g>`);
  // the election results: a ring each, as the modern chart rings them
  for (const [x, y, c, lab] of spec.marks) {
    if (!inX(x) || y < y0 || y > y1) continue;
    out.push(`<circle cx="${num(X(x))}" cy="${num(Y(y))}" r="${small ? 3 : 4}" fill="#ffffff" stroke="${col(c)}" stroke-width="2"><title>${esc(lab)}</title></circle>`);
  }
  // the axes over everything
  out.push(`<path class="rc-axis" d="M${L} ${T}V${T + ph}H${w - Rm}"/>`);
  // words on the plot: the modern chart's notes (▲ Labor ahead …)
  for (const [nx, ny, dy, t] of spec.notes) {
    if (ny == null || ny < y0 || ny > y1) continue;
    const x = nx === "left" ? L + (small ? 3 : 6) : X(nx);
    out.push(`<text class="rc-note" x="${num(x)}" y="${num(Y(ny) + dy * 0.9)}" font-size="${small ? 9 : 10}">${esc(t)}</text>`);
  }
  // each line's name at its end, pushed apart where two ends meet
  if (endW) {
    const labs = ends.map((s) => { const pts = pairs(s.p, 2).filter((p) => inX(p[0])); const p = pts[pts.length - 1]; return p ? { s, y: Y(p[1]), x: X(p[0]) } : null; }).filter(Boolean).sort((a, b) => a.y - b.y);
    const gap = fs + 2;
    for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < gap) labs[i].y = labs[i - 1].y + gap;
    for (let i = labs.length - 2; i >= 0; i--) if (labs[i + 1].y > T + ph + 4 && labs[i + 1].y - labs[i].y < gap) labs[i].y = labs[i + 1].y - gap;
    for (const l of labs) out.push(`<text class="rc-end" x="${num(w - Rm + 5)}" y="${num(l.y)}" dy="0.32em" font-size="${fs}" fill="${ink(l.s.c)}">${esc(phone && l.s.end.length > 10 ? l.s.end.replace(/^v /, "") : l.s.end)}</text>`);
  }
  out.push(`</svg>`);
  return out.join("");
};
// the legend box under a chart: the modern chart's own key, each entry with its swatch
R.legend = function legend(spec, keyWords) {
  const items = spec && spec.legend && spec.legend.length ? spec.legend : (keyWords || []).map((l) => ({ l, c: null, k: /dot|poll|release/i.test(l) ? "dot" : /band|interval|middle/i.test(l) ? "band" : "line" }));
  if (!items.length) return "";
  const sw = (it) => {
    const c = it.c ? col(it.c) : "#404040";
    if (it.k === "dot") return `<svg width="14" height="10" aria-hidden="true"><rect x="5" y="3" width="4" height="4" fill="${c}" stroke="${c}"/></svg>`;
    if (it.k === "band" || it.k === "area") return `<svg width="18" height="10" aria-hidden="true"><rect x="1" y="1" width="16" height="8" fill="${c}" fill-opacity=".35" stroke="#808080"/></svg>`;
    if (it.k === "ring") return `<svg width="14" height="10" aria-hidden="true"><circle cx="7" cy="5" r="3.2" fill="#fff" stroke="${c}" stroke-width="1.6"/></svg>`;
    return `<svg width="22" height="10" aria-hidden="true"><path d="M1 5h20" stroke="${c}" stroke-width="2"${it.k === "dash" ? ' stroke-dasharray="4 2"' : ""}/><rect x="9" y="3" width="4" height="4" fill="${c}" stroke="#000" stroke-width=".8"/></svg>`;
  };
  return `<div class="rc-legend">${items.map((it) => `<span class="rc-li">${sw(it)}${esc(it.l)}</span>`).join("")}</div>`;
};

/* ----------------------------------------------------------------- the blocks */
const P = (cls, t) => (t ? `<p class="${cls}">${esc(t)}</p>` : "");
// a figure's arrow, coloured as the era coloured gains and losses: up green, down red
const arrows = (s) => esc(s).replace(/▲/g, '<span class="rp-up">▲</span>').replace(/▼/g, '<span class="rp-dn">▼</span>');
// a party's name in its ink
const inked = (name, extra = "") => { const p = partyOf(name); return `<span class="rp-k-${p || "0"}"${extra}>${esc(name)}</span>`; };
let chartN = 0;
R.resetIds = () => { chartN = 0; };
/* a chart in its frame: the title row, the readings above it as group
   boxes, the chart, its legend. data-spec points the browser at the spec
   to redraw it at the frame's real width */
function chartFrame(b, o) {
  const id = (o.idp || "c") + (++chartN);
  const reads = (b.reads || []).length ? `<div class="rp-reads">${b.reads.map((r) => `<fieldset class="rp-read"><legend>${esc(r.title)}</legend><span class="rp-rv">${esc(r.v)}</span>${r.ci ? `<span class="rp-rci">${arrows(r.ci)}</span>` : ""}${r.desc ? `<span class="rp-rdesc">${esc(r.desc)}</span>` : ""}</fieldset>`).join("")}</div>` : "";
  // drawn at the desktop frame's widths (the full panel, half of it, a quarter); the browser redraws to fit
  const w = b.small ? 262 : o.half ? 540 : 1110;
  if (o.specs && b.spec) o.specs[id] = b.spec;
  return `<figure class="rp-chart${b.small ? " rp-small" : ""}" data-chart="${id}"${b.small ? ' data-small="1"' : ""}>`
    + `<figcaption class="rp-ctitle"><b>${esc(b.title || (b.spec && b.spec.title) || "")}</b>${b.meta ? `<span>${esc(b.meta)}</span>` : ""}${b.fig ? `<em>${esc(b.fig)}</em>` : ""}</figcaption>`
    + (b.hed ? `<p class="rp-ched">${esc(b.hed)}</p>` : "") + (b.csub ? `<p class="rp-csub">${esc(b.csub)}</p>` : "")
    + reads
    + (b.spec ? `<div class="rp-cwell">${R.chart(b.spec, { w, small: b.small, id })}</div>` : "")
    + (b.spec && !b.small ? R.legend(b.spec, b.key) : "")
    + `</figure>`;
}
// the trackbar the era drew for a value on a scale: a groove, ticks, a thumb
function trackbar(o) {
  const parts = [];
  for (const g of o.grid || []) parts.push(`<i class="tb-g" style="left:${num(g)}%"></i>`);
  if (o.zero != null) parts.push(`<i class="tb-a" style="left:${num(o.zero)}%"></i>`);
  if (o.band80) parts.push(`<i class="tb-b80" style="left:${num(o.band80[0])}%;width:${num(o.band80[1])}%"></i>`);
  if (o.band50) parts.push(`<i class="tb-b50" style="left:${num(o.band50[0])}%;width:${num(o.band50[1])}%"></i>`);
  for (const d of o.dots || []) parts.push(`<i class="tb-p" style="left:${num(d[0])}%"${d[1] ? ` title="${esc(d[1])}"` : ""}></i>`);
  if (o.mean != null) parts.push(`<i class="tb-m" style="left:${num(o.mean)}%"></i>`);
  if (o.ci) parts.push(`<i class="tb-w" style="left:${num(o.ci[0])}%;width:${num(o.ci[1])}%"></i>`);
  if (o.dot != null) parts.push(`<i class="tb-d" style="left:${num(o.dot)}%;background:${o.color || "#000"}"></i>`);
  return `<span class="tb${o.cls ? " " + o.cls : ""}" role="img"${o.title ? ` aria-label="${esc(o.title)}" title="${esc(o.title)}"` : ' aria-hidden="true"'}>${parts.join("")}</span>`;
}
const pairHTML = (a, b, pa, pb) => `<b class="rp-pair"><span class="rp-k-${pa || "alp"}">${esc(a)}</span><span class="rp-dash">–</span><span class="rp-k-${pb || "lnp"}">${esc(b)}</span></b>`;

const BLOCK = {
  hed: (b) => `<h3 class="rp-hed${b.top ? " rp-hed-top" : ""}">${esc(b.t)}</h3>`,
  dek: (b) => P("rp-dek", b.t),
  sub: (b) => `<h4 class="rp-sub">${esc(b.t)}</h4>`,
  subdek: (b) => P("rp-subdek", b.t),
  p: (b) => P("rp-p", b.t),
  note: (b) => P("rp-note", b.t),
  foot: (b) => `<p class="rp-foot"><b>Note:</b> ${esc(b.t)}</p>`,
  key: (b) => `<p class="rp-keyline">${b.items.map(esc).join(" · ")}</p>`,
  how: (b) => `<details class="rp-how"><summary>${esc(b.summary)}</summary>${b.paras.map((t) => P("", t)).join("")}</details>`,
  tsig: (b) => `<details class="rp-how"><summary>${esc(b.summary)}</summary>${b.table ? BLOCK.table(b.table) : ""}${P("rp-note", b.note)}</details>`,
  /* the two-party pair, big, the era's way: the parties' names under their
     figures, the lead on a trackbar, the verdict and the month's change */
  tpp(b) {
    const pa = partyOf(b.a && b.a.name) || "alp", pb = partyOf(b.b && b.b.name) || "lnp";
    let gauge = "";
    if (b.gauge && b.gauge.lead != null) {
      const g = b.gauge, D = 12, X = (v) => ((Math.max(-D, Math.min(D, -v)) + D) / (2 * D)) * 100;
      const lo = g.margin != null ? g.lead - g.margin : g.lead, hi = g.margin != null ? g.lead + g.margin : g.lead;
      gauge = `<div class="rp-gauge"><div class="rp-gside"><span class="rp-k-${pa}">◀ ${esc(g.a)} ahead</span><span class="rp-k-${pb}">${esc(g.b)} ahead ▶</span></div>`
        + trackbar({ grid: [-10, -5, 5, 10].map(X), zero: 50, ci: [X(hi), X(lo) - X(hi)], dot: X(g.lead), color: col("var(--" + (g.lead >= 0 ? pa : pb) + ")"), title: g.say, cls: "tb-lg" })
        + `<div class="rp-gticks"><span style="left:${num(X(10))}%">10 pts</span><span style="left:${num(X(5))}%">5</span><span style="left:50%">Tied</span><span style="left:${num(X(-5))}%">5</span><span style="left:${num(X(-10))}%">10 pts</span></div></div>`;
    }
    const verdict = b.verdict ? `<p class="rp-verdict">${b.verdict.map(([t, bold]) => (bold ? `<b>${esc(t)}</b>` : esc(t))).join("")}</p>` : "";
    return `<div class="rp-tpp"><p class="rp-tppfig">${b.a ? `<span class="rp-tside"><b class="rp-k-${pa}">${esc(b.a.v)}</b><i class="rp-k-${pa}">${esc(b.a.name)}</i></span>` : ""}<span class="rp-tdash" aria-hidden="true">–</span>${b.b ? `<span class="rp-tside"><b class="rp-k-${pb}">${esc(b.b.v)}</b><i class="rp-k-${pb}">${esc(b.b.name)}</i></span>` : ""}</p>`
      + gauge + verdict + (b.change ? `<p class="rp-change">${arrows(b.change)}</p>` : "") + (b.prov ? P("rp-prov", b.prov) : "") + `</div>`;
  },
  pvstats: (b) => `<div class="rp-stats">${b.bracket ? `<p class="rp-bracket">${esc(b.bracket)}</p>` : ""}<div class="rp-statrow">${b.stats.map((s) => `<fieldset class="rp-stat"><legend>${inked(s.name)}</legend><b class="rp-k-${partyOf(s.name) || "0"}">${esc(s.v)}<small>%</small></b><span>${arrows(s.chg)}</span></fieldset>`).join("")}</div></div>`,
  /* the latest-and-next table as the old details list: a row per pollster,
     its MRP and pooled series nested under it */
  polls(b) {
    const head = `<tr><th scope="col">Pollster</th><th scope="col">Latest</th><th scope="col" class="r">${esc(b.cols[2] || "")}</th><th scope="col">Next, at the earliest</th></tr>`;
    const row = (r, sub) => {
      const name = r.href ? `<a href="${esc(r.href)}" target="_blank" rel="noopener">${esc(r.name)}</a>` : esc(r.name);
      let fig = "";
      if (r.fig) {
        if (r.fig.pair && r.fig.pair.length === 2) fig = pairHTML(r.fig.pair[0], r.fig.pair[1], "alp", /One Nation/.test(b.cols[2] || "") ? "onp" : "lnp") + (r.fig.tag ? ` <span class="rp-tag">${esc(r.fig.tag)}</span>` : "");
        else if (r.fig.pair && r.fig.pair.length) fig = `<b class="rp-figs">${r.fig.pair.map(esc).join(" · ")}</b>`;
        else fig = esc(r.fig.text || "");
        if (r.fig.long) fig += `<small>${arrows(r.fig.long)}</small>`;
      }
      const nx = r.next ? (r.next.href ? `<a href="${esc(r.next.href)}" target="_blank" rel="noopener">${esc(r.next.main)}</a>` : esc(r.next.main)) : "";
      return `<tr class="${sub ? "rp-subr" : ""}${r.faded ? " rp-faded" : ""}"><th scope="row">${sub ? '<span class="rp-tree" aria-hidden="true">└</span>' : ""}${name}${r.who ? `<small>${esc(r.who)}</small>` : ""}</th>`
        + `<td>${r.latest ? `${esc(r.latest.main)}<small>${esc(r.latest.sub)}</small>` : ""}</td><td class="r">${fig}</td>`
        + `<td>${nx}${r.next && r.next.sub ? `<small class="rp-rel" data-rel="${esc(r.next.main)}">${esc(r.next.sub)}</small>` : ""}</td></tr>`;
    };
    return `<div class="rp-well"><table class="rp-t rp-polls"><thead>${head}</thead><tbody>${b.rows.map((r) => row(r, false) + (r.subs || []).map((s) => row(s, true)).join("")).join("")}</tbody></table></div>`;
  },
  // preferred PM: a bar per contest, each leader's share, "neither" between
  hbars: (b) => `<div class="rp-hbars">${b.bars.map((x) => {
    const pa = partyOf(x.a && x.a.name) || "alp", pb = partyOf(x.b && x.b.name) || "lnp";
    const wa = x.a && x.a.w != null ? x.a.w : x.a ? parseFloat(x.a.v) : 0, wb = x.b && x.b.w != null ? x.b.w : x.b ? parseFloat(x.b.v) : 0, wn = x.neither && x.neither.w != null ? x.neither.w : Math.max(0, 100 - wa - wb);
    return `<div class="rp-hb"><p class="rp-hbtop"><b>${esc(x.title)}</b><span class="rp-k-${pa}">${esc(x.lead)}</span></p>`
      + `<div class="rp-hbbar" role="img" aria-label="${esc(`${x.a ? x.a.name + " " + x.a.v : ""}, ${x.b ? x.b.name + " " + x.b.v : ""}`)}"><span class="rp-hbseg rp-b-${pa}" style="width:${num(wa)}%">${x.a ? `${esc(x.a.name)} <b>${esc(x.a.v)}</b>` : ""}</span><span class="rp-hbseg rp-hbn" style="width:${num(wn)}%">${x.neither ? esc(x.neither.t) : ""}</span><span class="rp-hbseg rp-b-${pb}" style="width:${num(wb)}%">${x.b ? `${esc(x.b.name)} <b>${esc(x.b.v)}</b>` : ""}</span></div>`
      + (x.ci.length ? `<p class="rp-hbci"><span>${esc(x.ci[0] || "")}</span><span>${esc(x.ci[1] || "")}</span></p>` : "") + `</div>`;
  }).join("")}</div>`,
  // net approval: a row per leader, the reading on a trackbar with its interval
  dp: (b) => `<div class="rp-well"><table class="rp-t rp-dp"><thead><tr><th scope="col">Leader</th><th scope="col" class="rp-dpaxis">${(b.axis || []).map(([l, t]) => `<span style="left:${num(l)}%">${esc(t)}</span>`).join("")}</th><th scope="col" class="r">${esc(b.head[2] || "Now")}</th><th scope="col" class="r">${esc(b.head[3] || "Change")}</th></tr></thead><tbody>`
    + b.rows.map((r) => { const p = partyOf(r.name); return `<tr><th scope="row">${inked(r.name)}</th><td class="rp-dptd">${trackbar({ zero: r.zero, ci: r.ci, dot: r.dot, color: col("var(--" + (p || "oth") + ")"), title: r.name + ": " + r.now })}</td><td class="r"><b class="rp-k-${p || "0"}">${esc(r.now)}</b></td><td class="r${r.sig ? " rp-sig" : ""}">${arrows(r.chg)}</td></tr>`; }).join("")
    + `</tbody></table></div>`,
  // the national mood: the two figures, the bar between them, the net
  dir(b) {
    const [a, z] = b.figs;
    const bar = b.bar ? `<div class="rp-pbar" role="img" aria-label="${esc((a ? a.v + "% " + a.k : "") + ", " + (b.bar.uns ? b.bar.uns.t : "") + ", " + (z ? z.v + "% " + z.k : ""))}"><span class="rp-pseg rp-pos" style="width:${num(b.bar.pos ? b.bar.pos.w : 0)}%"></span><span class="rp-pseg rp-uns" style="width:${num(b.bar.uns ? b.bar.uns.w : 0)}%">${b.bar.uns ? esc(b.bar.uns.t) : ""}</span><span class="rp-pseg rp-neg" style="width:${num(b.bar.neg ? b.bar.neg.w : Math.max(0, 100 - (b.bar.pos ? b.bar.pos.w : 0) - (b.bar.uns ? b.bar.uns.w : 0)))}%"></span></div>` : "";
    return `<div class="rp-dir"><p class="rp-dirfigs">${a ? `<span class="rp-dirf rp-posk"><b>${esc(a.v)}<small>%</small></b><i>${esc(a.k)}</i></span>` : ""}${z ? `<span class="rp-dirf rp-negk"><b>${esc(z.v)}<small>%</small></b><i>${esc(z.k)}</i></span>` : ""}</p>${bar}${b.net ? `<p class="rp-dirnet">${arrows(b.net)}</p>` : ""}</div>`;
  },
  // who votes for whom: each set as a list, the share, its margin and its gap to all voters
  wv(b, o) {
    const party = (o && o.party) || null;
    return `<div class="rp-wv">${b.sets.map((s) => {
      const vals = s.rows.map((r) => [parseFloat(r.v), parseFloat(r.ci) || 0]).filter(([v]) => isFinite(v));
      const allV = parseFloat(String(s.all).replace(/[^\d.]/g, "")) || null;
      const hi = Math.max(10, ...vals.map(([v, c]) => v + c), allV || 0), top = Math.ceil(hi / 10) * 10, X = (v) => (v / top) * 100;
      const c = col("var(--" + (party || "onp") + ")");
      return `<fieldset class="rp-wvset"><legend>${esc(s.title)}${s.src ? ` <span>${esc(s.src)}</span>` : ""}</legend>`
        + `<table class="rp-t rp-wvt"><thead><tr><th scope="col">Group</th><th scope="col" class="rp-wvaxis"><span style="left:0">0</span>${[0.25, 0.5, 0.75].map((f) => `<span style="left:${f * 100}%">${num(top * f)}</span>`).join("")}<span style="left:100%">${top}%</span></th><th scope="col" class="r">Share</th><th scope="col" class="r rp-wvci">±</th><th scope="col" class="r rp-wvvs">${esc(s.vs || "vs all voters")}</th></tr></thead><tbody>`
        + s.rows.map((r) => { const v = parseFloat(r.v), ci = parseFloat(r.ci) || 0; return `<tr><th scope="row">${esc(r.lab)}</th><td class="rp-wvtd">${isFinite(v) ? trackbar({ grid: [25, 50, 75], zero: allV != null ? X(allV) : null, ci: [X(Math.max(0, v - ci)), X(Math.min(top, v + ci)) - X(Math.max(0, v - ci))], dot: X(v), color: c, title: r.lab + ": " + r.v + "%, ±" + r.ci, cls: r.sig ? "" : "tb-hollow" }) : ""}</td><td class="r"><b>${esc(r.v)}%</b><small class="rp-ph">±${esc(r.ci)}</small></td><td class="r rp-wvci">${esc(r.ci)}</td><td class="r${r.sig ? " rp-sig" : ""}">${esc(r.d)}</td></tr>`; }).join("")
        + `</tbody></table>${s.all ? `<p class="rp-wvall">${esc(s.all)}</p>` : ""}</fieldset>`;
    }).join("")}</div>`;
  },
  /* where One Nation's voters come from: the mosaic's columns as rows - each
     2025 vote, its share of the electorate, the share now backing One
     Nation (as a progress bar), and what that adds to its vote */
  mosaic(b) {
    // the columns are the mosaic's fill rects (one each); a word belongs to the column it sits over, a right-set name to the one it ends on
    const fills = b.rects.filter((r) => /rd-mo-fill/.test(r.c)).sort((x, y) => x.x - y.x);
    const colOf = (t) => {
      let best = 0, bd = 1e9;
      fills.forEach((f, i) => { const d = t.x < f.x - 1 ? f.x - t.x : t.x > f.x + f.w + 1 ? t.x - f.x - f.w : 0; if (d < bd) { bd = d; best = i; } });
      return best;
    };
    const rows = fills.map((f, i) => {
      const mine = b.texts.filter((t) => colOf(t) === i);
      const pick = (re) => (mine.find((t) => re.test(t.c)) || {}).t || "";
      return { name: pick(/rd-mo-nm/), size: pick(/^rd-mo-sz$/), rate: pick(/rd-mo-rates?\b/), kept: mine.some((t) => /^kept$/.test(t.t)), pts: pick(/rd-mo-pts/), sh: pick(/rd-mo-sh/), deep: /deep/.test(f.fill) };
    });
    return `<div class="rp-well"><table class="rp-t rp-mo"><thead><tr><th scope="col">How they voted in 2025</th><th scope="col">Share of 2025 voters</th><th scope="col">Now backing One Nation</th><th scope="col" class="r">Points of One Nation’s vote</th></tr></thead><tbody>`
      + rows.map((r) => { const v = parseFloat(r.rate); return `<tr><th scope="row">${inked(r.name)}</th><td>${esc(r.size)}</td><td class="rp-motd"><span class="pg" role="img" aria-label="${esc(r.rate + (r.kept ? " kept" : " now back One Nation"))}"><span class="pg-f${r.kept || r.deep ? " pg-deep" : " pg-on"}" style="width:${num(isFinite(v) ? v : 0)}%"></span></span><b>${esc(r.rate)}</b>${r.kept ? " kept" : ""}</td><td class="r">${esc(r.pts)}${r.sh ? `<small>${esc(r.sh)}${/kept/.test(r.sh) ? "" : " of the gain"}</small>` : ""}</td></tr>`; }).join("")
      + `</tbody></table></div>`;
  },
  // the issues: what matters (a progress bar of how many rank it top three) and who is trusted on it
  issues(b) {
    const leg = (b.head && b.head.leg) || ["One Nation", "Labor", "Coalition"];
    return `<div class="rp-well"><table class="rp-t rp-is"><thead><tr><th scope="col">Issue</th><th scope="col">${esc(b.head ? b.head.imp : "In voters’ top three")}</th>${leg.map((l) => `<th scope="col" class="r">${inked(l)}</th>`).join("")}<th scope="col">Best on it</th></tr></thead><tbody>`
      + b.rows.map((r) => `<tr class="${r.sel ? "rp-picked" : ""}"><th scope="row">${esc(r.lab)}</th><td>${r.imp ? `<span class="pg"><span class="pg-f pg-grey" style="width:${num(r.bar || parseFloat(r.imp) || 0)}%"></span></span><b>${esc(r.imp)}</b>` : `<span class="rp-na">${esc(r.impNa || "not asked")}</span>`}</td>`
        + leg.map((l, i) => `<td class="r"><b class="rp-k-${partyOf(l) || "0"}">${esc(r.nums[i] || "")}</b></td>`).join("") + `<td class="${r.strong ? "rp-strong" : ""}">${esc(r.verdict)}${r.extra ? `<small class="rp-k-grn">${esc(r.extra)}</small>` : ""}</td></tr>`).join("")
      + (b.score ? `<tr class="rp-tally"><th scope="row" colspan="2">${esc(b.score.t)}<small>${esc(b.score.d)}</small></th>${leg.map((l) => { const v = b.score.vals.find((x) => x.p === l) || {}; return `<td class="r"><b class="rp-k-${partyOf(l) || "0"}">${esc(v.v || "")}</b></td>`; }).join("")}<td></td></tr>` : "")
      + `</tbody></table>${b.head && b.head.cap ? `<p class="rp-tcap">${esc(b.head.cap)}</p>` : ""}</div>`;
  },
  un100(b) {
    const cls = { "rd-un-f": "rp-un-f", "rd-un-s": "rp-un-s", "rd-un-u": "rp-un-u" };
    return `<fieldset class="rp-un"><legend>${esc(b.head)}</legend>${b.sub ? `<p class="rp-unsub">${esc(b.sub)}</p>` : ""}`
      + `<div class="rp-unlab">${(b.descs || []).map((d, i) => `<span>${b.labels && b.labels[i] ? `<b>${esc(b.labels[i])}</b> ` : ""}${esc(b.labels && b.labels[i] ? d.replace(b.labels[i], "").trim() : d)}</span>`).join("")}</div>`
      + `<div class="rp-unbar">${b.bar.map((s) => `<span class="${cls[s.c.split(" ")[0]] || "rp-un-f"}" style="width:${num(s.w)}%">${esc(s.v)}</span>`).join("")}</div>${P("rp-note", b.note)}</fieldset>`;
  },
  chart: (b, o) => chartFrame(b, o),
  smgrid: (b, o) => `<div class="rp-smgrid">${b.items.map((x) => chartFrame({ ...x, small: true }, o)).join("")}</div>`,
  // the past-terms scorecard: a row per measure, this term's figure against every past term's at the same point
  cs(b) {
    const h = b.head;
    return `<div class="rp-well"><table class="rp-t rp-cs"><thead><tr><th scope="col">${esc(h[0] || "Measure")}</th><th scope="col" class="r">${esc(h[1] || "Now")}</th><th scope="col">${esc(h[2] || "")}</th><th scope="col">${esc(h[3] || "")}</th><th scope="col">${esc(h[4] || "")}</th></tr></thead><tbody>`
      + b.groups.map((g) => `<tr class="rp-csg"><th scope="rowgroup" colspan="2"><b>${esc(g.name)}</b> <span>${esc(g.unit)}</span></th><td class="rp-csscale">${g.scale.map(([l, t]) => `<span style="left:${num(l)}%">${esc(t)}</span>`).join("")}</td><td colspan="2"></td></tr>`
        + g.rows.map((r) => {
          const c = r.color ? col(r.color.replace("-text", "")) : "#000";
          return `<tr><th scope="row"><b>${esc(r.name)}</b><small>${esc(r.sub)}</small></th><td class="r"><b class="rp-csnow" style="color:${r.color ? col(r.color) : "#000"}">${esc(r.now)}</b></td>`
            + `<td class="rp-cstd">${r.strip ? trackbar({ grid: r.strip.gl, band80: r.strip.b80 ? [r.strip.b80.l, r.strip.b80.w] : null, band50: r.strip.b50 ? [r.strip.b50.l, r.strip.b50.w] : null, dots: r.strip.dots, mean: r.strip.mean, dot: r.strip.cur, color: c, cls: "tb-cs", title: r.name + ": " + r.now }) : ""}</td>`
            + `<td>${r.avg ? `${arrows(r.avg.b)}<small>${esc(r.avg.s)}</small>` : ""}</td><td>${r.rank ? `<b>${esc(r.rank.b)}</b>${r.rank.s ? `<small>${esc(r.rank.s)}</small>` : ""}` : ""}</td></tr>`;
        }).join("")).join("")
      + `</tbody></table></div>`;
  },
  tiles: (b) => `<div class="rp-tiles">${b.tiles.map((t) => `<fieldset class="rp-tile"><legend>${esc(t.b)}</legend><b>${esc(t.v)}</b>${t.s ? `<span>${esc(t.s)}</span>` : ""}</fieldset>`).join("")}</div>`,
  table: (b) => `<div class="rp-well rp-twell"><table class="rp-t rp-gt">${b.caption ? `<caption>${esc(b.caption)}</caption>` : ""}<thead><tr>${b.head.map((x) => `<th scope="col"${x.num ? ' class="r"' : ""}>${esc(x.t)}</th>`).join("")}</tr></thead><tbody>`
    + b.rows.map((r) => `<tr>${r.map((c, i) => (c.th ? `<th scope="row"${r.length === 1 ? ` colspan="${b.head.length}" class="rp-tgrp"` : ""}>${esc(c.t)}</th>` : `<td${b.head[i] && b.head[i].num ? ' class="r"' : ""}${c.color ? ` style="color:${col(c.color)}"` : ""}>${esc(c.t)}</td>`)).join("")}</tr>`).join("")
    + `</tbody></table></div>`,
  // the final polls, election by election: each pollster's miss on a strip about the result
  accrows: (b) => `${b.title ? `<p class="rp-ctitle"><b>${esc(b.title)}</b></p>` : ""}<div class="rp-well"><table class="rp-t rp-acc"><thead><tr><th scope="col">Election</th><th scope="col" class="rp-accaxis">${b.scale.map(([l, t]) => `<span style="left:${num(l)}%">${esc(t)}</span>`).join("")}</th>${(b.groups[0] && b.groups[0].rows[0] ? b.groups[0].rows[0].cells : []).map((c, i) => `<th scope="col"${i === 0 ? ' class="r"' : ""}>${i === 0 ? "Miss" : i === 1 ? "Final polls" : ""}</th>`).join("")}</tr></thead><tbody>`
    + b.groups.map((g) => (g.name ? `<tr class="rp-csg"><th scope="rowgroup" colspan="${2 + (g.rows[0] ? g.rows[0].cells.length : 0)}"><b>${esc(g.name)}</b></th></tr>` : "")
      + g.rows.map((r) => `<tr><th scope="row"><b>${esc(r.year)}</b><small>${esc(r.pair)}</small></th><td class="rp-acctd"><span class="tb tb-acc" aria-hidden="true"><i class="tb-a" style="left:50%"></i>${r.dots.map((d) => `<i class="tb-p${/\bbig\b|mean|avg/.test(d.c) ? " tb-big" : ""}" style="left:${num(d.l)}%;background:${d.col ? col(d.col) : "#404040"}"${d.t ? ` title="${esc(d.t)}"` : ""}></i>`).join("")}</span></td>`
        + r.cells.map((c, i) => `<td${i === 0 ? ' class="r"' : ""}${c.color ? ` style="color:${col(c.color)}"` : ""}>${i === 0 ? `<b>${esc(c.t)}</b>` : esc(c.t)}${c.flag ? ` <span class="rp-badge">${esc(c.flag)}</span>` : ""}</td>`).join("") + `</tr>`).join("")).join("")
    + `</tbody></table></div>${b.ends && b.ends.length ? `<p class="rp-keyline">${b.ends.map(esc).join(" · ")}</p>` : ""}`,
  events: (b) => `<ol class="rp-events">${b.items.map((it) => `<li><b>${esc(it.t)}</b>${it.d ? ` ${esc(it.d)}` : ""}</li>`).join("")}</ol>`,
};
/* a run of blocks. Two charts that sit side by side on the modern page
   (the leadership pair, the decidedness pair, the primary-vote pair) pair
   up here too where the frame has room; the browser lays them out */
R.blocks = function blocks(list, o = {}) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const b = list[i], f = BLOCK[b.k];
    if (!f) continue;
    if (b.k === "chart" && list[i + 1] && list[i + 1].k === "chart" && o.pairCharts !== false && !b.small && b.reads && list[i + 1].reads && (b.reads.length || list[i + 1].reads.length || o.pairCharts === true)) {
      out.push(`<div class="rp-pair2">${chartFrame(b, { ...o, half: true })}${chartFrame(list[i + 1], { ...o, half: true })}</div>`);
      i++;
      continue;
    }
    out.push(f(b, o));
  }
  return out.join("");
};
R.BLOCK = BLOCK;
R.trackbar = trackbar;
})();
