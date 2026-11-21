// electoral-map-redesign.mjs — draws .build/map-mockup/electoral-map-redesign.svg:
// a design drawing of /map/ (the House today, Winner lens), not a build step.
// The map is the page's own 2025 boundaries, projection, winners and palette;
// type is measured in Chrome with the site's fonts, which are embedded in the SVG.
//   node .build/map-mockup/electoral-map-redesign.mjs [--png]
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const OUT = path.join(HERE, "electoral-map-redesign.svg");
const rd = (p) => fs.readFileSync(path.join(REPO, p));
const b64 = (p) => rd(p).toString("base64");

const FONT_CSS = `
@font-face{font-family:"IBM Plex Sans";font-weight:100 700;font-style:normal;src:url(data:font/woff2;base64,${b64("assets/fonts/ibmplexsans-latin.056e4e24.woff2")}) format("woff2")}
@font-face{font-family:"Commissioner";font-weight:100 900;font-style:normal;src:url(data:font/woff2;base64,${b64("assets/fonts/commissioner-latin.737ec8f2.woff2")}) format("woff2")}
@font-face{font-family:"Crimson Text";font-weight:400;font-style:italic;src:url(data:font/woff2;base64,${b64("assets/fonts/crimsontext-italic-400-latin.381a244e.woff2")}) format("woff2")}
`;

// today's holder of every seat: the 2025 winner, then the changes since
const core = JSON.parse(rd("map/data/core-2025.json"));
const now = JSON.parse(rd("map/data/data-now.json"));
const fam = {};
for (const d of core.divs) {
  const w = d.c.find((c) => c[6] === 1) || d.c[d.tcp[0][0]];
  fam[d.n] = w[3];
}
for (const [n, h] of Object.entries(now.holders)) fam[n] = h.ab === "CSA" ? "csa" : h.ab === "ON" ? "onp" : fam[n];
const tally = {};
for (const f of Object.values(fam)) tally[f] = (tally[f] || 0) + 1;
console.log("seats today", tally);

const data = {
  geo: JSON.parse(rd("map/data/geo-2025-lo.json")),
  islands: JSON.parse(rd("map/data/islands.json")).islands,
  fam,
  tally,
  agg: core.agg.AUS,
  fontCss: FONT_CSS,
};

/* ------------------------------------------------------------------ */
/* runs in the page: Chrome measures the type, d3 projects the map     */
function build(D) {
  const C = {
    paper: "#faf6f0", ink: "#2b2521", ink2: "#58514c", ink3: "#6f6965", dim: "#b4aea8",
    rule: "#dfdcd7", rule2: "#cfcac3",
    alp: "#f7310a", lnp: "#1432d5", grn: "#14ad4a", onp: "#ff8c00", ind: "#9b62d0", csa: "#00a9c4", oth: "#9a9a9a",
    sea: "#deeff8", grat: "#c6deec", gratLab: "#698ea8", seaName: "#376891",
  };
  const SANS = '"IBM Plex Sans"', FIG = "Commissioner", SERIF = '"Crimson Text"';
  const cv = document.createElement("canvas").getContext("2d");
  const tw = (s, size, weight = 400, fam = SANS, style = "normal") => { cv.font = `${style} ${weight} ${size}px ${fam}`; return cv.measureText(s).width; };
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const n1 = (v) => (Math.round(v * 10) / 10).toString();
  const o = [];
  const T = (x, y, s, a = {}) => {
    const at = [`x="${n1(x)}"`, `y="${n1(y)}"`, `font-size="${a.size || 13}"`];
    if (a.weight && a.weight !== 400) at.push(`font-weight="${a.weight}"`);
    if (a.fam === FIG) at.push(`class="fig"`);
    if (a.fam === SERIF) at.push(`class="sea"`);
    at.push(`fill="${a.fill || C.ink}"`);
    if (a.anchor) at.push(`text-anchor="${a.anchor}"`);
    if (a.extra) at.push(a.extra);
    return `<text ${at.join(" ")}>${esc(s)}</text>`;
  };
  const R = (x, y, w, h, fill, extra = "") => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" fill="${fill}" ${extra}/>`;
  const L = (x1, y1, x2, y2, stroke = C.rule, w = 1, extra = "") => `<line x1="${n1(x1)}" y1="${n1(y1)}" x2="${n1(x2)}" y2="${n1(y2)}" stroke="${stroke}" stroke-width="${w}" ${extra}/>`;
  const dbl = (x, y, w) => L(x, y + 0.5, x + w, y + 0.5, C.ink) + L(x, y + 3.5, x + w, y + 3.5, C.ink);
  // a bold title and its lighter trailing note: the site's section-head idiom
  const head = (x, y, title, meta, size = 14) => {
    let s = T(x, y, title, { size, weight: 600 });
    if (meta) s += T(x + tw(title, size, 600) + 8, y, meta, { size: 12.5, fill: C.ink3 });
    return s;
  };
  const tag = (x, y, label, w = 64) => R(x, y - 9.5, w, 19, C.ink, 'rx="2"') + T(x + 7, y + 4, label, { size: 11.5, weight: 600, fill: C.paper });
  // a row of choices: the chosen one bold and underlined, each holding its bold width
  const choices = (x, y, items, a = {}) => {
    const size = a.size || 13, gap = a.gap || 15;
    let s = "", cx = x;
    for (const it of items) {
      const on = it === a.active, dim = (a.dim || []).includes(it);
      const w = tw(it, size, 600);
      s += T(cx, y + 4.5, it, { size, weight: on ? 600 : 400, fill: on ? C.ink : dim ? C.dim : C.ink2 });
      if (on) s += R(cx, y + 9, tw(it, size, 600), 2, C.ink);
      cx += w + gap;
    }
    return { s, end: cx - gap };
  };
  const chev = (x, y, stroke = C.ink2) => `<path d="M${n1(x)} ${n1(y - 1.5)}l3.2 3.2 3.2-3.2" fill="none" stroke="${stroke}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  const sw = (x, y, label) => {
    const s = R(x, y - 7, 26, 14, C.ink, 'rx="7"') + `<circle cx="${n1(x + 19)}" cy="${n1(y)}" r="4.6" fill="${C.paper}"/>` + T(x + 33, y + 4.5, label, { size: 13, fill: C.ink2 });
    return { s, w: 33 + tw(label, 13) };
  };

  const W = 1536, M = 32;
  const PX = M, PW = 360;                 // the side pane
  const MX = PX + PW + 40, MW = W - M - MX; // the map column

  /* ---------- the shell's pinned tab row ---------- */
  o.push(R(0, 0, W, 46, C.paper));
  {
    const nav = choices(PX, 23, ["Now", "Past cycles", "All polls", "Info"], { size: 13.5, gap: 26 });
    o.push(nav.s);
    const ex = nav.end + 26, lab = "Electoral map", lw = tw(lab, 13.5, 600);
    o.push(T(ex, 27.5, lab, { size: 13.5, weight: 600 }), chev(ex + lw + 5, 24, C.ink), R(ex, 44, lw + 14, 2, C.ink));
    let nx = ex + lw + 14 + 64;
    o.push(T(nx, 27.5, "Next", { size: 13, weight: 600, fill: C.ink2 })); nx += tw("Next", 13, 600) + 16;
    for (const [h, d] of [["YouGov", "4 days"], ["Newspoll", "9 days"], ["Roy Morgan", "10 days"], ["Essential", "12 days (maybe)"]]) {
      o.push(T(nx, 27.5, h, { size: 13, weight: 600 })); nx += tw(h, 13, 600) + 4;
      o.push(`<path d="M${n1(nx)} ${n1(26)}l4.5-4.5m-3.6 0h3.6v3.6" fill="none" stroke="${C.ink2}" stroke-width="1.1"/>`); nx += 11;
      o.push(T(nx, 27.5, d, { size: 13, fill: C.ink3 })); nx += tw(d, 13) + 18;
    }
    let rx = W - M;
    const put = (s, a) => { rx -= tw(s, a.size, a.weight, a.fam || SANS); o.push(T(rx, a.y || 27.5, s, a)); };
    put("L/NP", { size: 11, weight: 600, fill: C.ink2 }); rx -= 5;
    put("49.0", { size: 17, weight: 600, fill: "#35579e", y: 29 }); rx -= 9;
    o.push(L(rx, 15, rx, 32, C.rule2)); rx -= 9;
    put("51.0", { size: 17, weight: 600, fill: "#cf4a2e", y: 29 }); rx -= 5;
    put("ALP", { size: 11, weight: 600, fill: C.ink2 }); rx -= 10;
    put("2PP", { size: 11, weight: 600, fill: C.ink2 });
  }
  o.push(L(0, 46.5, W, 46.5, C.rule));

  /* ---------- title row: the page name and its three views ---------- */
  const TY = 82;
  o.push(T(PX, TY, "Electoral map", { size: 22, weight: 600 }));
  {
    let rx = W - M;
    // Retro: the raised button the page already has
    const rw = tw("Retro", 12) + 16; rx -= rw;
    o.push(R(rx, TY - 16, rw, 21, "#d9d5cf", `stroke="#8d8782" stroke-width="1"`), L(rx + 0.5, TY - 15.5, rx + rw - 1, TY - 15.5, "#fff"), L(rx + 0.5, TY - 15.5, rx + 0.5, TY + 4, "#fff"), T(rx + 8, TY - 1, "Retro", { size: 12 }));
    rx -= 18;
    const fsw = tw("Full screen", 13.5); rx -= fsw; o.push(T(rx, TY, "Full screen", { size: 13.5, fill: C.ink2 }));
    rx -= 20; o.push(`<path d="M${rx} ${TY - 7}v-3.5h3.5M${rx + 7.5} ${TY - 10.5}h3.5v3.5M${rx + 11} ${TY - 3.5}v3.5h-3.5M${rx + 3.5} ${TY}h-3.5v-3.5" fill="none" stroke="${C.ink2}" stroke-width="1.3"/>`);
    rx -= 18; o.push(L(rx, TY - 16, rx, TY + 6, C.rule2)); rx -= 22;
    const views = [["List", `<path d="M0 -9h1.2M0 -5h1.2M0 -1h1.2M4 -9h9M4 -5h9M4 -1h9" fill="none" stroke-width="1.3"/>`], ["Chamber", `<path d="M1 -10v4.5a5.5 5.5 0 0 0 11 0V-10M4.5 -10v4.5a2 2 0 0 0 4 0V-10" fill="none" stroke-width="1.3"/>`], ["Map", `<path d="M1 -6.2l2.2-2 2.1.6.9-2.2 2 .6.7-1.6 1.6 2.9 2.1 1 .9 3-1.1 2.6-2.2.9-1.6-1.2-1.7-.8-2.6.6-2.6.5-1-2.1zM10.6 -0.2l1.1.2-.5 1.1z" fill="none" stroke-width="1.2" stroke-linejoin="round"/>`]];
    for (const [lab, icon] of views) {
      const on = lab === "Map", lw = tw(lab, 13.5, 600);
      rx -= lw; o.push(T(rx, TY, lab, { size: 13.5, weight: on ? 600 : 400, fill: on ? C.ink : C.ink2 }));
      rx -= 21; o.push(`<g transform="translate(${n1(rx)} ${TY})" stroke="${on ? C.ink : C.ink2}">${icon}</g>`);
      if (on) o.push(R(rx - 6, 101, lw + 21 + 12, 2, C.ink));
      rx -= 26;
    }
  }
  o.push(L(M, 103.5, W - M, 103.5, C.rule));

  /* ================= the side pane ================= */
  let y = 142;
  o.push(head(PX, y, "The House today", null, 22), T(PX + tw("The House today", 22, 600) + 10, y, "150 members", { size: 12.5, fill: C.ink3 }));
  y += 22; o.push(T(PX, y, "Six changes since the 2025 election.", { size: 13, fill: C.ink2 }));
  y += 14; o.push(dbl(PX, y, PW));

  /* --- seats --- */
  y += 25; o.push(head(PX, y, "Seats", "Labor has 62.7% of 150"));
  {
    const cols = [[94, "Labor", C.alp, C.alp, "0"], [41, "Coalition", C.lnp, C.lnp, "−2"], [15, "Crossbench", C.oth, C.ink2, "+2"]];
    const cw = PW / 3, fy = y + 58;
    cols.forEach(([n, name, col, tcol, d], i) => {
      const cx = PX + cw * (i + 0.5);
      o.push(T(cx, fy, n, { size: 50, weight: 600, fam: FIG, fill: col, anchor: "middle" }));
      o.push(T(cx, fy + 21, name, { size: 13.5, weight: 500, fill: tcol, anchor: "middle" }));
      o.push(T(cx, fy + 39, d, { size: 13, weight: 500, fam: FIG, fill: C.ink2, anchor: "middle" }));
      if (i) o.push(L(PX + cw * i, fy - 38, PX + cw * i, fy + 42, C.rule));
    });
    y = fy + 39;
    // the bar, with the majority line
    const by = y + 14, bh = 12, u = PW / 150;
    const segs = [["alp", 94], ["lnp", 41], ["oth", 15]];
    let bx = PX;
    o.push(`<g clip-path="url(#barclip)">`);
    for (const [k, n] of segs) { o.push(R(bx, by, n * u + 0.3, bh, C[k])); bx += n * u; }
    o.push(`</g>`);
    o.push(`<clipPath id="barclip"><rect x="${PX}" y="${by}" width="${PW}" height="${bh}" rx="2"/></clipPath>`);
    const mx = PX + 76 * u;
    o.push(R(mx - 2.5, by - 4, 5, bh + 8, C.paper), R(mx - 1, by - 4, 2, bh + 8, C.ink));
    o.push(T(mx, by + bh + 17, "76 for a majority", { size: 12, fill: C.ink3, anchor: "middle" }));
    // the crossbench's grey stretch, opened out: one cell a member
    const cell = 13, cg = 2, sx1 = PX + PW, sx0 = sx1 - 15 * cell - 14 * cg, sy = by + bh + 34;
    let k = 0;
    for (const [f, n] of [["ind", 8], ["csa", 2], ["onp", 2], ["grn", 1], ["oth", 2]]) for (let j = 0; j < n; j++, k++) o.push(R(sx0 + k * (cell + cg), sy, cell, cell, C[f], 'rx="1.5"'));
    o.push(T(PX, sy + 11, "Crossbench", { size: 13, weight: 600 }));
    // the key: two columns, counts in line
    const key = [["ind", "Independents", 8], ["csa", "Community Strong", 2], ["onp", "One Nation", 2], ["grn", "Greens", 1], ["oth", "Centre Alliance", 1], ["oth", "Katter", 1]];
    const ky = sy + cell + 22, kcol = [PX, PX + 200], kw = 160;
    key.forEach(([f, name, n], i) => {
      const x = kcol[Math.floor(i / 3)], yy = ky + (i % 3) * 21;
      o.push(R(x, yy - 9, 9, 9, C[f], 'rx="1"'), T(x + 16, yy, name, { size: 13, fill: C.ink2 }), T(x + kw, yy, n, { size: 13, weight: 600, fam: FIG, anchor: "end" }));
    });
    y = ky + 2 * 21;
  }
  y += 16; o.push(dbl(PX, y, PW));

  /* --- two-party preferred --- */
  y += 25; o.push(head(PX, y, "Two-party preferred", "at the 2025 election"));
  {
    const fy = y + 48, cw = PW / 2;
    [["55.2", "Labor", C.alp], ["44.8", "Coalition", C.lnp]].forEach(([v, name, col], i) => {
      const cx = PX + cw * (i + 0.5);
      o.push(T(cx, fy, v, { size: 44, weight: 600, fam: FIG, fill: col, anchor: "middle" }));
      if (!i) {
        const nw = tw(name, 13.5, 500), gw = tw("govt", 11, 600) + 10, x0 = cx - (nw + 7 + gw) / 2;
        o.push(T(x0, fy + 21, name, { size: 13.5, weight: 500, fill: col }), R(x0 + nw + 7, fy + 8, gw, 17, C.ink, 'rx="2"'), T(x0 + nw + 12, fy + 20.5, "govt", { size: 11, weight: 600, fill: C.paper }));
      } else o.push(T(cx, fy + 21, name, { size: 13.5, weight: 500, fill: col, anchor: "middle" }));
    });
    o.push(L(PX + cw, fy - 34, PX + cw, fy + 24, C.rule));
    const by = fy + 36, bh = 8, sp = PW * 0.552;
    o.push(`<clipPath id="tppclip"><rect x="${PX}" y="${by}" width="${PW}" height="${bh}" rx="2"/></clipPath><g clip-path="url(#tppclip)">`, R(PX, by, sp, bh, C.alp), R(PX + sp, by, PW - sp, bh, C.lnp), `</g>`);
    const hx = PX + PW / 2;
    o.push(R(hx - 2.5, by - 3, 5, bh + 6, C.paper), R(hx - 1, by - 3, 2, bh + 6, C.ink));
    const sy = by + bh + 22, a = "Swing to Labor ", b = "+3.1", aw = tw(a, 13.5), bw = tw(b, 15, 600, FIG), x0 = PX + (PW - aw - bw) / 2;
    o.push(T(x0, sy, a, { size: 13.5, fill: C.ink2, extra: 'xml:space="preserve"' }), T(x0 + aw, sy, b, { size: 15, weight: 600, fam: FIG, fill: C.alp }));
    y = sy;
  }
  y += 16; o.push(dbl(PX, y, PW));

  /* --- primary votes --- */
  y += 25; o.push(head(PX, y, "Primary votes"), T(PX + PW, y, "change since 2022", { size: 12, fill: C.ink3, anchor: "end" }));
  {
    const rows = [["Labor", 34.6, "+2.0", C.alp], ["Coalition", 31.8, "−3.9", C.lnp], ["Greens", 12.2, "−0.1", C.grn], ["Others", 21.4, "+1.9", C.oth]];
    const bx = PX + 78, full = 166, pitch = 24; // the bars' scale ends at 50%
    const y0 = y + 12;
    rows.forEach(([name, v, d, col], i) => {
      const yy = y0 + 14 + i * pitch;
      o.push(T(PX, yy, name, { size: 13.5, fill: C.ink }));
      o.push(R(bx, yy - 10, (v / 50) * full, 11, col));
      o.push(T(PX + PW - 56, yy, v.toFixed(1), { size: 15, weight: 600, fam: FIG, anchor: "end" }));
      o.push(T(PX + PW, yy, d, { size: 13, weight: 500, fam: FIG, fill: C.ink2, anchor: "end" }));
    });
    o.push(L(bx - 0.5, y0, bx - 0.5, y0 + 4 * pitch - 4, C.ink3));
    y = y0 + 14 + 3 * pitch;
    y += 22; o.push(T(PX, y, "Labor and the Coalition share 66.4%.", { size: 12.5, fill: C.ink3 }));
  }
  y += 16; o.push(dbl(PX, y, PW));

  /* --- since the election --- */
  y += 25; o.push(head(PX, y, "Since the election", "six changes"));
  {
    const ch = [["25 Jun ’26", "Warringah.", "Zali Steggall co-founded Community Strong Australia."], ["25 Jun ’26", "Wentworth.", "Allegra Spender co-founded Community Strong Australia."], ["9 May ’26", "Farrer.", "David Farley won the by-election for One Nation."], ["27 Feb ’26", "Farrer.", "Sussan Ley resigned from Parliament."], ["8 Dec ’25", "New England.", "Barnaby Joyce joined One Nation."], ["27 Nov ’25", "New England.", "Barnaby Joyce left the Nationals to sit as an independent."]];
    const tx = PX + 66, mw = PW - 66, size = 13, lh = 17;
    y += 8;
    ch.forEach(([date, seat, text], i) => {
      if (i) o.push(L(PX, y + 0.5, PX + PW, y + 0.5, C.rule));
      y += 19;
      o.push(T(PX, y, date, { size: 12, fill: C.ink3 }));
      // wrap: the seat's name bold, the rest plain
      const words = [[seat, 600], ...text.split(" ").map((w) => [w, 400])];
      let line = [], lw = 0, lines = [];
      const sp = tw(" ", size);
      for (const [w, wt] of words) { const ww = tw(w, size, wt); if (line.length && lw + sp + ww > mw) { lines.push(line); line = []; lw = 0; } lw += (line.length ? sp : 0) + ww; line.push([w, wt]); }
      lines.push(line);
      lines.forEach((ln, j) => {
        const sp2 = ln.map(([w, wt], q) => `<tspan${wt === 600 ? ` font-weight="600" fill="${C.ink}"` : ""}>${esc(w)}${q < ln.length - 1 ? " " : ""}</tspan>`).join("");
        o.push(`<text x="${tx}" y="${y + j * lh}" font-size="${size}" fill="${C.ink2}" xml:space="preserve">${sp2}</text>`);
      });
      y += (lines.length - 1) * lh + 9;
    });
  }
  const paneBottom = y;

  /* ================= the map column ================= */
  const r1 = 131, r2 = 166, r3 = 200, col2 = MX + 452;
  // find: search, then the cities
  {
    const sw_ = col2 - 40 - MX;
    o.push(R(MX + 0.5, r1 - 16.5, sw_, 33, "#fffdfa", `rx="3" stroke="${C.rule2}"`));
    o.push(`<circle cx="${MX + 17}" cy="${r1 - 1}" r="5" fill="none" stroke="${C.ink2}" stroke-width="1.5"/><path d="M${MX + 20.8} ${r1 + 2.8}l4 4" stroke="${C.ink2}" stroke-width="1.5" stroke-linecap="round"/>`);
    o.push(T(MX + 34, r1 + 4.5, "Search a seat, member or place", { size: 13.5, fill: C.ink3 }));
    o.push(R(MX + sw_ - 27.5, r1 - 9.5, 17, 19, "none", `rx="3" stroke="${C.rule2}"`), T(MX + sw_ - 19, r1 + 4.5, "/", { size: 12, fill: C.ink3, anchor: "middle" }));
    o.push(tag(col2, r1, "Jump to"), choices(col2 + 76, r1, ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Hobart", "Canberra", "Darwin"]).s);
  }
  // narrow: state, then seat type
  o.push(tag(MX, r2, "State"), choices(MX + 76, r2, ["All", "NSW", "Vic", "Qld", "WA", "SA", "Tas", "ACT", "NT"], { active: "All" }).s);
  o.push(tag(col2, r2, "Seat type"), choices(col2 + 76, r2, ["All", "Inner metro", "Outer metro", "Provincial", "Rural"], { active: "All" }).s);
  // the map itself: what it shows, how it is drawn, and its two layers
  {
    o.push(tag(MX, r3, "Show"), T(MX + 76, r3 + 4.5, "Winner", { size: 13, weight: 600 }), chev(MX + 76 + tw("Winner", 13, 600) + 6, r3 + 0.5, C.ink));
    o.push(tag(col2, r3, "Draw"), choices(col2 + 76, r3, ["Seats", "Balloons", "Surface", "Areas", "Chart"], { active: "Seats", dim: ["Areas", "Chart"] }).s);
    const b = sw(0, r3, "City names"), a = sw(0, r3, "Water");
    const bx = MX + MW - b.w, ax = bx - 22 - a.w;
    o.push(sw(ax, r3, "Water").s, sw(bx, r3, "City names").s);
  }

  /* ---------- the map ---------- */
  const MY = 224, MH = 690;
  const m = [];
  {
    const topo = D.geo, [kx, ky] = topo.transform.scale, [tx, ty] = topo.transform.translate;
    const arcsLL = topo.arcs.map((a) => { let x = 0, yv = 0; return a.map(([dx, dy]) => { x += dx; yv += dy; return [x * kx + tx, yv * ky + ty]; }); });
    const fitPts = [];
    for (const a of arcsLL) for (const p of a) if (p[0] > 112 && p[0] < 154.6 && p[1] > -44.5 && p[1] < -9.5) fitPts.push(p);
    const proj = d3.geoConicEqualArea().parallels([-18, -36]).rotate([-132, 0]).fitExtent([[0, 40], [MW, MH - 26]], { type: "MultiPoint", coordinates: fitPts });
    // each shared border thinned once, so neighbours still meet exactly
    const dp = (pts, tol) => {
      if (pts.length < 3) return pts;
      const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
      const st = [[0, pts.length - 1]];
      while (st.length) {
        const [a, b] = st.pop(); let md = 0, mi = -1;
        const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
        for (let i = a + 1; i < b; i++) { const d = len < 1e-6 ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay) : Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len; if (d > md) { md = d; mi = i; } }
        if (md > tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
      }
      return pts.filter((_, i) => keep[i]);
    };
    const arcsXY = arcsLL.map((a) => dp(a.map((p) => proj(p)), 0.3));
    const arcPts = (i) => (i < 0 ? arcsXY[~i].slice().reverse() : arcsXY[i]);
    const pd = (pts, close) => "M" + pts.map((p) => n1(p[0]) + " " + n1(p[1])).join("L") + (close ? "Z" : "");
    const fills = {}, use = new Map();
    topo.objects.divs.geometries.forEach((g, gi) => {
      const polys = g.type === "Polygon" ? [g.arcs] : g.arcs;
      const f = D.fam[g.properties.name] || "oth";
      for (const poly of polys) {
        const ll = arcsLL[poly[0][0] < 0 ? ~poly[0][0] : poly[0][0]][0];
        if (ll[0] < 110 || ll[0] > 155.5) continue; // the far islands ride in their boxes
        for (const ring of poly) {
          let pts = [];
          for (const ai of ring) { const a = arcPts(ai); pts = pts.concat(pts.length ? a.slice(1) : a); const k = ai < 0 ? ~ai : ai; if (!use.has(k)) use.set(k, []); use.get(k).push(gi); }
          let area = 0; for (let i = 0; i < pts.length - 1; i++) area += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
          if (Math.abs(area) / 2 < 0.35) continue;
          (fills[f] = fills[f] || []).push(pd(pts.slice(0, -1), true));
        }
      }
    });
    const seatB = [], stateB = [];
    const geoms = topo.objects.divs.geometries;
    for (const [k, gs] of use) { if (gs.length < 2 || gs[0] === gs[1]) continue; const d = pd(arcsXY[k], false); (geoms[gs[0]].properties.st === geoms[gs[1]].properties.st ? seatB : stateB).push(d); }

    // the sea: paper, then the graticule
    m.push(R(0, 0, MW, MH, C.sea));
    m.push(`<rect x="0" y="0" width="${MW}" height="${MH}" filter="url(#mottle)" opacity="0.55"/>`);
    m.push(`<rect x="0" y="0" width="${MW}" height="${MH}" filter="url(#grain)" opacity="0.5"/>`);
    const line = (f) => { const pts = []; for (let t = 0; t <= 1.0001; t += 0.01) { const p = proj(f(t)); pts.push(p); } return pd(pts, false); };
    const gl = [];
    for (let lon = 100; lon <= 170; lon += 10) gl.push(line((t) => [lon, -2 - 54 * t]));
    for (let lat = -10; lat >= -50; lat -= 10) gl.push(line((t) => [92 + 84 * t, lat]));
    m.push(`<path d="${gl.join("")}" fill="none" stroke="${C.grat}" stroke-width="1"/>`);
    m.push(`<path d="${line((t) => [92 + 84 * t, -23.4358])}" fill="none" stroke="${C.grat}" stroke-width="1" stroke-dasharray="5 4"/>`);
    // degree marks where each line meets the edge
    const cross = (f, axis, at) => { let prev = null; for (let t = 0; t <= 1.0001; t += 0.002) { const p = proj(f(t)); if (prev && (prev[axis] - at) * (p[axis] - at) <= 0) return p; prev = p; } return null; };
    for (let lon = 110; lon <= 160; lon += 10) { const p = cross((t) => [lon, -2 - 54 * t], 1, 15); if (p && p[0] > 30 && p[0] < MW - 90) m.push(T(p[0] + 5, 19, `${lon}°E`, { size: 11, fill: C.gratLab })); }
    for (let lat = -10; lat >= -40; lat -= 10) { const p = cross((t) => [92 + 84 * t, lat], 0, 10); if (p && p[1] > 30) m.push(T(8, p[1] - 5, `${-lat}°S`, { size: 11, fill: C.gratLab })); }
    // the waters' names
    const SEA = [["Indian Ocean", 19, [109.6, -30.2]], ["Southern Ocean", 19, [127, -40.4]], ["Coral Sea", 16, [155.2, -17.8]], ["Tasman Sea", 16, [157.2, -39.2]], ["Arafura Sea", 15.5, [135.3, -9.5]], ["Timor Sea", 15.5, [125.6, -11.9]], ["Great Australian\nBight", 14.5, [130.6, -34.3]], ["Gulf of\nCarpentaria", 14, [139.2, -14.5]]];
    for (const [name, size, ll] of SEA) {
      const p = proj(ll), ls = name.split("\n");
      // set along its parallel, as the page sets them
      const q = proj([ll[0] + 1, ll[1]]), ang = (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI;
      ls.forEach((s, i) => m.push(T(0, (i - (ls.length - 1) / 2) * size * 1.08 + size * 0.3, s, { size, fam: SERIF, fill: C.seaName, anchor: "middle", extra: `transform="translate(${n1(p[0])} ${n1(p[1])}) rotate(${n1(ang)})" opacity="0.92"` })));
    }
    {
      const p = proj([158.2, -23.4358]), q = proj([159.2, -23.4358]), ang = (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI;
      m.push(T(0, -5, "Tropic of Capricorn", { size: 11.5, fam: SERIF, fill: C.seaName, anchor: "middle", extra: `transform="translate(${n1(p[0])} ${n1(p[1])}) rotate(${n1(ang)})" opacity="0.85"` }));
    }
    // the seats
    for (const f of ["lnp", "alp", "oth", "onp", "ind", "csa", "grn"]) if (fills[f]) m.push(`<path d="${fills[f].join("")}" fill="${C[f]}" fill-rule="evenodd"/>`);
    m.push(`<path d="${seatB.join("")}" fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="0.5" stroke-linejoin="round"/>`);
    m.push(`<path d="${stateB.join("")}" fill="none" stroke="#fff" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"/>`);

    // the four far islands, each in its box and in its seat's colour
    const wa = proj([113.2, -24])[0], ec = proj([153.6, -28])[0];
    const boxes = { christmas: [wa + 6, 58, "Christmas Island", "Lingiari"], cocos: [wa - 92, 136, "Cocos Islands", "Lingiari"], norfolk: [ec + 100, 350, "Norfolk Island", "Bean"], lordhowe: [ec + 34, 456, "Lord Howe Island", "Sydney"] };
    for (const isl of D.islands) {
      const b = boxes[isl.key]; if (!b) continue;
      const [bx, by, label, seat] = b, S = 60, pad = 9;
      const c = Math.cos(((isl.box[1] + isl.box[3]) / 2) * Math.PI / 180);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      const rings = isl.rings.map((r) => r.map(([lo, la]) => { const X = lo * c, Y = -la; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); return [X, Y]; }));
      const k = Math.min((S - 2 * pad) / (x1 - x0), (S - 2 * pad) / (y1 - y0)), ox = bx + (S - (x1 - x0) * k) / 2, oy = by + (S - (y1 - y0) * k) / 2;
      m.push(R(bx + 0.5, by + 0.5, S, S, "#fff", `fill-opacity="0.42" rx="4" stroke="#a9c6d8"`));
      m.push(`<path d="${rings.map((r) => pd(dp(r.map(([X, Y]) => [ox + (X - x0) * k, oy + (Y - y0) * k]), 0.25), true)).join("")}" fill="${C[D.fam[seat]]}" fill-rule="evenodd"/>`);
      m.push(T(bx + S / 2, by + S + 14, label, { size: 11, fill: "#5f7385", anchor: "middle" }));
    }

    // town names: black on a white outline, as the page letters them
    const TOWNS = [["Darwin", 130.84, -12.46, "r"], ["Nhulunbuy", 136.78, -12.18, "r"], ["Weipa", 141.87, -12.63, "r"], ["Townsville", 146.82, -19.26, "l"], ["Mount Isa", 139.49, -20.73, "l"], ["Alice Springs", 133.88, -23.7, "r"], ["Karratha", 116.85, -20.74, "r"], ["Kalgoorlie", 121.47, -30.75, "r"], ["Perth", 115.86, -31.95, "r"], ["Adelaide", 138.6, -34.93, "r"], ["Melbourne", 144.96, -37.81, "l"], ["Canberra", 149.13, -35.28, "l"], ["Sydney", 151.21, -33.87, "l"], ["Newcastle", 151.78, -32.93, "l"], ["Brisbane", 153.03, -27.47, "l"], ["Sunshine Coast", 153.07, -26.65, "r"], ["Gold Coast", 153.43, -28.0, "r"], ["Hobart", 147.33, -42.88, "r"]];
    for (const [name, lo, la, side] of TOWNS) {
      const p = proj([lo, la]);
      m.push(`<circle cx="${n1(p[0])}" cy="${n1(p[1])}" r="3.1" fill="#111" stroke="#fff" stroke-width="1.4"/>`);
      m.push(T(p[0] + (side === "r" ? 7 : -7), p[1] + 4.5, name, { size: 13, weight: 600, fill: "#111", anchor: side === "r" ? "start" : "end", extra: `stroke="#fff" stroke-width="3" stroke-linejoin="round" paint-order="stroke"` }));
    }
    // zoom: one small plate
    const zx = MW - 46, zy = 14;
    m.push(R(zx + 0.5, zy + 0.5, 32, 64, C.paper, `rx="4" stroke="#b9c9d3"`), L(zx + 6, zy + 32.5, zx + 27, zy + 32.5, C.rule));
    m.push(`<path d="M${zx + 10.5} ${zy + 16.5}h11M${zx + 16} ${zy + 11}v11M${zx + 10.5} ${zy + 48.5}h11" stroke="${C.ink}" stroke-width="1.5" fill="none"/>`);
  }
  o.push(`<clipPath id="mapclip"><rect x="0" y="0" width="${MW}" height="${MH}"/></clipPath>`);
  o.push(`<g transform="translate(${MX} ${MY})" clip-path="url(#mapclip)">${m.join("")}</g>`);
  o.push(R(MX + 0.5, MY + 0.5, MW - 1, MH - 1, "none", `stroke="#bdd3e0"`));

  /* ---------- under the map: what there is to find, then the elections ---------- */
  let fy = MY + MH + 21;
  o.push(`<circle cx="${MX + 6.5}" cy="${fy - 4.5}" r="6" fill="none" stroke="${C.ink3}" stroke-width="1.1"/><path d="M${MX + 6.5} ${fy - 5.5}v4M${MX + 6.5} ${fy - 8.2}v.6" stroke="${C.ink3}" stroke-width="1.3"/>`);
  {
    const a = "8,940 polling places.", aw = tw(a, 12.5, 600);
    o.push(T(MX + 19, fy, a, { size: 12.5, weight: 600, fill: C.ink2 }), T(MX + 19 + aw + 5, fy, "Zoom in, or choose a seat, to see them.", { size: 12.5, fill: C.ink3 }));
  }
  fy += 31;
  o.push(tag(MX, fy, "View elections", 96), choices(MX + 108, fy, ["Federal", "Victoria", "New South Wales", "Queensland", "South Australia", "Western Australia"], { active: "Federal" }).s);
  {
    // the strip of elections: each a small seats bar on a time axis, today's chosen
    const stops = [[1993.2, "1993", 80, 65, 2], [1996.17, "1996", 49, 94, 5], [1998.76, "1998", 67, 80, 1], [2001.86, "2001", 65, 82, 3], [2004.77, "2004", 60, 87, 3], [2007.9, "2007", 83, 65, 2], [2010.64, "2010", 72, 73, 5], [2013.68, "2013", 55, 90, 5], [2016.5, "2016", 69, 76, 5], [2019.38, "2019", 68, 77, 6], [2022.39, "2022", 77, 58, 16], [2025.34, "2025", 94, 43, 13], [2027.0, "Now", 94, 41, 15]];
    const x0 = MX + 16, x1 = MX + MW - 16, t0 = stops[0][0], t1 = stops[stops.length - 1][0], bw = 28, by = fy + 24;
    o.push(L(MX, by + 12.5, MX + MW, by + 12.5, C.rule));
    for (const [t, lab, a, c, x] of stops) {
      const cx = x0 + ((t - t0) / (t1 - t0)) * (x1 - x0), on = lab === "Now", tot = a + c + x;
      let bx = cx - bw / 2;
      o.push(`<g${on ? "" : ' opacity="0.5"'}>`, R(bx, by, (a / tot) * bw, 8, C.alp), R(bx + (a / tot) * bw, by, (c / tot) * bw, 8, C.lnp), R(bx + ((a + c) / tot) * bw, by, (x / tot) * bw, 8, C.oth), `</g>`);
      o.push(L(cx, by + 10, cx, by + 15, on ? C.ink : C.rule2));
      o.push(T(cx, by + 29, lab, { size: 12, weight: on ? 600 : 400, fill: on ? C.ink : C.ink3, anchor: "middle" }));
      if (on) o.push(R(cx - tw(lab, 12, 600) / 2, by + 33, tw(lab, 12, 600), 2, C.ink));
    }
    fy = by + 35;
  }
  const H = Math.ceil(Math.max(paneBottom, fy) + 26);
  const defs = `<defs>
<filter id="mottle" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.0045 0.007" numOctaves="3" seed="11"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  3.2 0 0 0 -1.25"/></filter>
<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/><feColorMatrix type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.42  0 0 0 0 0.55  0 0 0 0.32 -0.1"/></filter>
</defs>`;
  const style = `<style>${D.fontCss}
text{font-family:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif}
.fig{font-family:Commissioner,"IBM Plex Sans",system-ui,sans-serif}
.sea{font-family:"Crimson Text",Georgia,serif;font-style:italic}
</style>`;
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Electoral map: a design drawing of the page, the House today">\n<title>Electoral map — design drawing</title>\n${style}\n${defs}\n${R(0, 0, W, H, C.paper)}\n${o.join("\n")}\n</svg>\n`, H, paneBottom, mapBottom: fy };
}
/* ------------------------------------------------------------------ */

const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await page.setContent(`<!doctype html><html><head><style>${FONT_CSS}</style></head><body></body></html>`);
await page.addScriptTag({ path: path.join(REPO, "map/vendor/d3-7.9.0.min.js") });
await page.evaluate(async () => {
  await Promise.all(['400 13px "IBM Plex Sans"', '500 13px "IBM Plex Sans"', '600 13px "IBM Plex Sans"', "500 13px Commissioner", "600 13px Commissioner", 'italic 400 13px "Crimson Text"'].map((f) => document.fonts.load(f)));
  await document.fonts.ready;
});
const res = await page.evaluate(build, data);
fs.writeFileSync(OUT, res.svg);
console.log(`wrote ${path.relative(REPO, OUT)}: ${(res.svg.length / 1024).toFixed(0)} KB, 1536×${res.H} (pane ends ${res.paneBottom.toFixed(0)}, map column ends ${res.mapBottom.toFixed(0)})`);

if (process.argv.includes("--png")) {
  const png = process.argv[process.argv.indexOf("--png") + 1];
  const p2 = await browser.newPage();
  await p2.setViewport({ width: 1536, height: res.H, deviceScaleFactor: 1 });
  await p2.goto("file://" + OUT);
  await new Promise((r) => setTimeout(r, 600));
  await p2.screenshot({ path: png });
  await p2.setViewport({ width: 1536, height: res.H, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 400));
  await p2.screenshot({ path: png.replace(/\.png$/, "@2x.png") });
}
await browser.close();
