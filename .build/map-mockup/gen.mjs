// Mockup of /map/ (The House today, Map view) as one standalone SVG.
// Real 2025 seat boundaries (map/data/geo-2025-lo.json) in the page's own
// conic equal-area projection, seats coloured by today's holder (read off the
// live page's divCol), the page's palette, type and copy. Fonts embedded.
// Run from the repo root:  node .build/map-mockup/gen.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as d3 from "d3-geo";
import * as topojson from "topojson-client";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const W = JSON.parse(fs.readFileSync(path.join(HERE, "widths.json"), "utf8"));

// ---------- palette (computed from the live page) ----------
const C = {
  bg: "#faf6f0", surface: "#fefcf9", ink: "#2b2521", ink2: "#58514c", ink3: "#6e6863",
  faint: "#a29d99", line: "#dfdcd7", line2: "#ece9e5", accent: "#286f76",
  alp: "#f7310a", lnp: "#1432d5", ind: "#9b62d0", onp: "#ff8c00", csa: "#00a9c4",
  grn: "#14ad4a", oth: "#9a9a9a",
  // dial colours (shell palette)
  dAlp: "#b9463f", dLnp: "#356697", dOnp: "#cc7c37", dGrn: "#439458",
  sea: "#dcedf6", seaInk: "#5f7f95", grat: "#b9d0de",
};

// ---------- text helpers ----------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function tw(s, size, face = "p4") {
  const t = W[face]; let w = 0;
  for (const ch of s) w += (t[ch] ?? t["n"] ?? 55);
  return (w * size) / 100;
}
const F = {
  p4: `font-family="IBM Plex Sans" font-weight="400"`,
  p5: `font-family="IBM Plex Sans" font-weight="500"`,
  p6: `font-family="IBM Plex Sans" font-weight="600"`,
  c7: `font-family="Commissioner" font-weight="700"`,
  c6: `font-family="Commissioner" font-weight="600"`,
};
function T(x, y, s, { size = 13, face = "p4", fill = C.ink, anchor = "start", extra = "" } = {}) {
  return `<text x="${r(x)}" y="${r(y)}" ${F[face]} font-size="${size}" fill="${fill}"${anchor !== "start" ? ` text-anchor="${anchor}"` : ""}${extra ? " " + extra : ""}>${esc(s)}</text>`;
}
const r = (v) => Math.round(v * 10) / 10;
const out = [];
const add = (...s) => out.push(...s);

// ---------- canvas ----------
const WIDTH = 1280, HEIGHT = 1156, L = 64, R = 1216;
const PANE_W = 340, MX = L + PANE_W + 40, MW = R - MX; // map column 772

// ---------- masthead (the site shell) ----------
function dial(x, y) {
  // the shell's wordmark dial, verbatim geometry
  return `<g transform="translate(${x} ${y}) scale(1.48) translate(-0.58 -0.07)">
  <path d="M 10 24.5 A 12 12 0 0 1 22 12.5" fill="none" stroke="${C.dAlp}" stroke-width="2.2"/>
  <path d="M 22 12.5 A 12 12 0 0 1 34 24.5" fill="none" stroke="${C.dLnp}" stroke-width="2.2"/>
  <line x1="10.67" y1="16.27" x2="2.18" y2="10.1" stroke="${C.dAlp}" stroke-width="3.4" stroke-dasharray="10.5 10.5"/>
  <line x1="17.67" y1="11.19" x2="14.43" y2="1.2" stroke="${C.dOnp}" stroke-width="3.4" stroke-dasharray="10.5 10.5"/>
  <line x1="26.33" y1="11.19" x2="29.57" y2="1.2" stroke="${C.dLnp}" stroke-width="3.4" stroke-dasharray="8.95 10.5"/>
  <line x1="33.33" y1="16.27" x2="41.82" y2="10.1" stroke="${C.dGrn}" stroke-width="3.4" stroke-dasharray="5 10.5"/>
  <g transform="translate(22 24.5) rotate(-5.67)"><line x1="0" y1="0" x2="0" y2="-8.6" stroke="${C.dAlp}" stroke-width="1.7" stroke-linecap="round"/><circle cx="0" cy="-8.6" r="1.9" fill="${C.dAlp}"/></g>
  <circle cx="22" cy="24.5" r="1.7" fill="${C.ink3}"/></g>`;
}
add(`<rect width="${WIDTH}" height="${HEIGHT}" fill="${C.bg}"/>`);
add(`<text x="${L}" y="58" font-family="SS3Mark, 'Source Sans 3', 'IBM Plex Sans'" font-size="32" font-weight="800" letter-spacing="-0.8" fill="${C.ink}">auspol</text>`);
add(`<text x="${L}" y="88" font-family="SS3Mark, 'Source Sans 3', 'IBM Plex Sans'" font-size="32" font-weight="400" letter-spacing="-1" fill="${C.ink2}">tracker</text>`);
add(dial(L + 118, 36));
add(T(L, 116, "Aggregated opinion polling for the next Australian federal election,", { size: 13, fill: C.ink2 }));
add(T(L, 134, "and for all since 1943.", { size: 13, fill: C.ink2 }));
// the three stat cells
const cells = [
  [700, "Latest poll", "Roy Morgan, 26 Oct–8 Nov", "published 4 days ago", true],
  [902, "This term", "191 polls", "13 pollsters", false],
  [1022, "Next election", "By 20 May 2028", "18 months at most", false],
];
for (const [x, k, v, s, dot] of cells) {
  add(T(x, 50, k, { size: 11.5, fill: C.ink3 }));
  if (dot) add(`<circle cx="${x + 3}" cy="${66}" r="3" fill="${C.alp}"/>`);
  add(T(x + (dot ? 11 : 0), 70, v, { size: 13, face: "p6" }));
  add(T(x, 87, s, { size: 11.5, fill: C.ink3 }));
}
add(`<line x1="886" y1="40" x2="886" y2="92" stroke="${C.line}"/><line x1="1006" y1="40" x2="1006" y2="92" stroke="${C.line}"/>`);
// theme switch
add(`<rect x="1150" y="44" width="66" height="28" rx="14" fill="${C.surface}" stroke="${C.line}"/>
<circle cx="1166" cy="58" r="10" fill="${C.line2}"/><circle cx="1166" cy="58" r="4" fill="none" stroke="${C.ink2}" stroke-width="1.3"/>
<path d="M1199 52.5a6 6 0 1 0 6 8.2a4.6 4.6 0 0 1 -6 -8.2z" fill="none" stroke="${C.ink3}" stroke-width="1.3"/>`);
// nav row
let nx = L;
const NAV = ["Now", "Past cycles", "All polls", "Info", "Electoral map"];
for (const n of NAV) {
  const on = n === "Electoral map";
  add(T(nx, 176, n, { size: 15, face: on ? "p6" : "p4", fill: on ? C.ink : C.ink2 }));
  const w = tw(n, 15, on ? "p6" : "p4");
  if (on) {
    add(`<path d="M${r(nx + w + 6)} 170.5l3.5 3.5l3.5 -3.5" fill="none" stroke="${C.ink2}" stroke-width="1.4"/>`);
    add(`<rect x="${nx}" y="186" width="${r(w + 16)}" height="2.5" fill="${C.ink}"/>`);
  }
  nx += w + (on ? 0 : 30);
}
let px = 722;
add(T(px, 176, "Next", { size: 12.5, fill: C.ink3 })); px += tw("Next", 12.5) + 16;
for (const [h, d] of [["YouGov", "4 days"], ["Newspoll", "9 days"], ["Roy Morgan", "10 days"], ["Essential", "12 days"]]) {
  add(T(px, 176, h, { size: 12.5, face: "p6" })); px += tw(h, 12.5, "p6") + 5;
  add(T(px, 176, d, { size: 12.5, fill: C.ink3 })); px += tw(d, 12.5) + 16;
}
add(`<line x1="${L}" x2="${R}" y1="188.5" y2="188.5" stroke="${C.line}"/>`);

// ---------- page eyebrow ----------
const EY = 238;
add(T(L, EY, "Electoral map", { size: 22, face: "p6" }));
add(T(L + tw("Electoral map", 22, "p6") + 16, EY - 1, "The current House of Representatives, last changed 25 June 2026 · 8,940 polling places", { size: 12.5, fill: C.ink3 }));
// view tabs, right
function icoMap(x, y) { return `<path d="M${x} ${y + 3}l4 -2l5 2l4 -2v9l-4 2l-5 -2l-4 2z M${x + 4} ${y + 1}v9 M${x + 9} ${y + 3}v9" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>`; }
function icoChamber(x, y) { return `<path d="M${x} ${y + 11}a7 7 0 0 1 14 0 M${x + 3.5} ${y + 11}a3.5 3.5 0 0 1 7 0" fill="none" stroke="currentColor" stroke-width="1.3"/>`; }
function icoList(x, y) { return `<path d="M${x} ${y + 2}h1.5M${x} ${y + 6.5}h1.5M${x} ${y + 11}h1.5M${x + 4} ${y + 2}h9M${x + 4} ${y + 6.5}h9M${x + 4} ${y + 11}h9" fill="none" stroke="currentColor" stroke-width="1.4"/>`; }
function icoFull(x, y) { return `<path d="M${x} ${y + 4}v-4h4M${x + 9} ${y}h4v4M${x + 13} ${y + 9}v4h-4M${x + 4} ${y + 13}h-4v-4" fill="none" stroke="currentColor" stroke-width="1.3"/>`; }
let vx = 852;
for (const [n, ico, on] of [["Map", icoMap, true], ["Chamber", icoChamber, false], ["List", icoList, false]]) {
  const col = on ? C.ink : C.ink2;
  add(`<g color="${col}">${ico(vx, EY - 12)}</g>`);
  add(T(vx + 20, EY - 1, n, { size: 13, face: on ? "p6" : "p4", fill: col }));
  const w = 20 + tw(n, 13, on ? "p6" : "p4");
  if (on) add(`<rect x="${vx}" y="${EY + 8}" width="${r(w)}" height="2" fill="${C.ink}"/>`);
  vx += w + 22;
}
add(`<line x1="${vx - 6}" x2="${vx - 6}" y1="${EY - 14}" y2="${EY + 4}" stroke="${C.line}"/>`);
vx += 10;
add(`<g color="${C.ink2}">${icoFull(vx, EY - 12)}</g>`);
add(T(vx + 20, EY - 1, "Full screen", { size: 13, fill: C.ink2 }));
vx += 20 + tw("Full screen", 13) + 14;
add(`<rect x="${vx}" y="${EY - 15}" width="44" height="20" rx="2" fill="${C.line2}" stroke="${C.faint}"/>`);
add(T(vx + 22, EY - 1, "Retro", { size: 11.5, face: "p5", anchor: "middle", fill: C.ink2 }));
add(`<line x1="${L}" x2="${R}" y1="${EY + 10.5}" y2="${EY + 10.5}" stroke="${C.line}"/>`);

// ================= LEFT PANE: The House today =================
const P = L, PW = PANE_W, PR = P + PW;
let y = 284;
add(T(P, y, "The House today", { size: 22, face: "p6" }));
add(T(P + tw("The House today", 22, "p6") + 10, y - 1, "150 members", { size: 12.5, fill: C.ink3 }));
function rule(yy, heavy = true) { add(`<rect x="${P}" y="${yy}" width="${PW}" height="${heavy ? 1.5 : 1}" fill="${heavy ? C.ink : C.line}"/>`); }
y += 16; rule(y);

// --- Seats ---
y += 22;
add(T(P, y, "Seats", { size: 13, face: "p6" }));
add(T(P + tw("Seats", 13, "p6") + 6, y, "Labor has 62.7% of 150", { size: 13, fill: C.ink3 }));
// three figure columns separated by hairlines (labels under each figure: colour is no longer the only key)
const colW = PW / 3;
const seatFigs = [["94", "Labor", C.alp, "±0"], ["41", "Coalition", C.lnp, "−2"], ["15", "Crossbench", C.ink2, "+2"]];
const figY = y + 52;
seatFigs.forEach(([v, n, col, ch], i) => {
  const cx = P + colW * i + colW / 2;
  add(T(cx, figY, v, { size: 52, face: "c7", fill: i === 2 ? C.ink3 : col, anchor: "middle" }));
  const nw = tw(n, 13, "p6"), cw = tw(ch, 12.5), gap = 6, tot = nw + gap + cw;
  add(T(cx - tot / 2, figY + 21, n, { size: 13, face: "p6", fill: i === 2 ? C.ink2 : col }));
  add(T(cx - tot / 2 + nw + gap, figY + 21, ch, { size: 12.5, fill: C.ink3 }));
  if (i) add(`<line x1="${r(P + colW * i)}" x2="${r(P + colW * i)}" y1="${figY - 38}" y2="${figY + 24}" stroke="${C.line}"/>`);
});
y = figY + 40;
add(T(P, y, "Changes are since the 2025 election.", { size: 11.5, fill: C.ink3 }));
// seat bar: every seat in the map's own colours, crossbench sorted to match the key
y += 18;
const SEAT_PX = PW / 150;
const segs = [["alp", 94], ["lnp", 41], ["ind", 8], ["csa", 2], ["onp", 2], ["grn", 1], ["oth", 1], ["oth", 1]];
let bx = P;
const barY = y, barH = 14;
segs.forEach(([k, n], i) => {
  const w = n * SEAT_PX;
  add(`<rect x="${r(bx)}" y="${barY}" width="${r(w - (i < segs.length - 1 ? 1 : 0))}" height="${barH}" fill="${C[k]}"/>`);
  bx += w;
});
// majority tick
const mx = P + 76 * SEAT_PX;
add(`<rect x="${r(mx - 0.75)}" y="${barY - 5}" width="1.5" height="${barH + 10}" fill="${C.ink}"/>`);
add(T(mx + 6, barY + barH + 17, "76 for a majority", { size: 11.5, fill: C.ink2 }));
// brace under the crossbench stretch
const xb0 = P + 135 * SEAT_PX, xb1 = PR;
add(`<path d="M${r(xb0)} ${barY + barH + 3}v4h${r(xb1 - xb0)}v-4 M${r((xb0 + xb1) / 2)} ${barY + barH + 7}v4" fill="none" stroke="${C.ink3}" stroke-width="1"/>`);

// crossbench key: a two-column grid, size order (matches the bar), counts aligned
y = barY + barH + 42;
add(T(P, y, "Crossbench", { size: 13, face: "p6" }));
add(T(P + tw("Crossbench", 13, "p6") + 6, y, "15", { size: 13, face: "p6", fill: C.ink3 }));
const XB = [["ind", "Independents", 8], ["csa", "Community Strong", 2], ["onp", "One Nation", 2], ["grn", "Greens", 1], ["oth", "Katter", 1], ["oth", "Centre Alliance", 1]];
const kc = [[P, P + 152], [P + 186, PR]];
XB.forEach(([k, n, c], i) => {
  const col = Math.floor(i / 3), row = i % 3;
  const [x0, x1] = kc[col], yy = y + 22 + row * 20;
  add(`<rect x="${x0}" y="${yy - 9.5}" width="10" height="10" rx="1.5" fill="${C[k]}"/>`);
  add(T(x0 + 17, yy, n, { size: 13, fill: C.ink }));
  add(T(x1, yy, String(c), { size: 13, face: "c6", fill: C.ink, anchor: "end" }));
});
add(`<line x1="${P + 169}" x2="${P + 169}" y1="${y + 8}" y2="${y + 68}" stroke="${C.line2}"/>`);
y += 98;
const para = [
  "These figures are the 2025 election’s adjusted for",
  "changes since then. One Nation has taken two seats",
  "from the Coalition and two independents co-founded",
  "and joined Community Strong (see below).",
];
para.forEach((l, i) => add(T(P, y + i * 18, l, { size: 12.5, fill: C.ink2 })));
y += 3 * 18 + 22; rule(y);

// --- Two-party preferred ---
y += 22;
add(T(P, y, "Two-party preferred", { size: 13, face: "p6" }));
add(T(P + tw("Two-party preferred", 13, "p6") + 6, y, "margin of 5.2", { size: 13, fill: C.ink3 }));
const half = PW / 2, tY = y + 54;
[["55.2", "Labor", C.alp, true], ["44.8", "Coalition", C.lnp, false]].forEach(([v, n, col, govt], i) => {
  const cx = P + half * i + half / 2;
  add(T(cx, tY, v, { size: 52, face: "c7", fill: col, anchor: "middle" }));
  const nw = tw(n, 13, "p6"), gw = govt ? 34 + 6 : 0, x0 = cx - (nw + gw) / 2;
  add(T(x0, tY + 21, n, { size: 13, face: "p6", fill: col }));
  if (govt) {
    add(`<rect x="${r(x0 + nw + 6)}" y="${tY + 9}" width="34" height="16" rx="2" fill="${C.ink}"/>`);
    add(T(x0 + nw + 6 + 17, tY + 21, "govt", { size: 11, face: "p6", fill: C.bg, anchor: "middle" }));
  }
});
add(`<line x1="${P + half}" x2="${P + half}" y1="${tY - 38}" y2="${tY + 24}" stroke="${C.line}"/>`);
y = tY + 48;
add(T(P, y, "+3.1", { size: 15, face: "c7", fill: C.alp }));
add(T(P + tw("+3.1", 15, "c7") + 6, y, "swing to Labor at the 2025 election", { size: 13, fill: C.ink2 }));
y += 22; rule(y);

// --- Primaries: labelled bars on one scale, value and change aligned ---
y += 22;
add(T(P, y, "Primaries", { size: 13, face: "p6" }));
add(T(P + tw("Primaries", 13, "p6") + 6, y, "Labor and the Coalition share 66.4%", { size: 13, fill: C.ink3 }));
const PRIM = [["Labor", 34.6, "+2.0", C.alp, C.alp], ["Coalition", 31.8, "−3.9", C.lnp, C.lnp], ["Greens", 12.2, "−0.1", C.grn, "#0f8a3a"], ["Others", 21.4, "+1.9", C.oth, C.ink2]];
const bx0 = P + 82, PPX = 4.6; // px per point; 40 points = 184px
y += 10;
// a faint 10-point scale behind the bars (the bars stop where the votes do; no 100% track)
const scY = y + 22 + 3 * 25 + 10;
for (let p = 0; p <= 40; p += 10) {
  const x = bx0 + p * PPX;
  add(`<line x1="${r(x)}" x2="${r(x)}" y1="${y + 6}" y2="${scY - 4}" stroke="${C.line}" stroke-width="${p ? 0.8 : 1}"/>`);
  add(T(x, scY + 8, p === 40 ? "40%" : String(p), { size: 10.5, fill: C.faint, anchor: "middle" }));
}
add(T(PR, scY + 8, "change", { size: 10.5, fill: C.faint, anchor: "end" }));
PRIM.forEach(([n, v, ch, col, tcol], i) => {
  const yy = y + 22 + i * 25;
  add(T(P, yy, n, { size: 13, fill: C.ink }));
  add(`<rect x="${bx0}" y="${yy - 11}" width="${r(v * PPX)}" height="13" fill="${col}"/>`);
  add(T(bx0 + v * PPX + 6, yy, v.toFixed(1), { size: 15, face: "c7", fill: tcol }));
  add(T(PR, yy, ch, { size: 12.5, fill: C.ink3, anchor: "end" }));
});
y = scY + 26; rule(y);

// --- The chamber today (continues below the fold) ---
y += 22;
add(T(P, y, "The chamber today", { size: 13, face: "p6" }));
add(T(P + tw("The chamber today", 13, "p6") + 6, y, "with every member in their seat", { size: 13, fill: C.ink3 }));
const chTop = y + 14;
add(`<image x="${P}" y="${chTop}" width="340" height="422" href="data:image/png;base64,${fs.readFileSync(path.join(HERE, "chamber.png")).toString("base64")}"/>`);
add(`<defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.bg}" stop-opacity="0"/><stop offset="1" stop-color="${C.bg}" stop-opacity="1"/></linearGradient></defs>`);
add(`<rect x="${P - 2}" y="${HEIGHT - 90}" width="${PW + 4}" height="90" fill="url(#fade)"/>`);

// ================= RIGHT: control strip =================
const LX = MX, CX = MX + 76; // label column 64px + gap
let ry = 290;
function label(yy, s) { add(T(LX, yy, s, { size: 12, face: "p5", fill: C.ink3 })); }
function chips(yy, items, sel, { muted = [] } = {}) {
  let x = CX;
  for (const it of items) {
    const on = it === sel, m = muted.includes(it);
    add(T(x, yy, it, { size: 13, face: on ? "p6" : "p4", fill: on ? C.ink : m ? C.faint : C.ink2 }));
    const w = tw(it, 13, on ? "p6" : "p4");
    if (on) add(`<rect x="${r(x)}" y="${yy + 5}" width="${r(w)}" height="2" fill="${C.ink}"/>`);
    x += w + 16;
  }
  return x;
}
function sw(x, yy, on, text) {
  add(`<rect x="${x}" y="${yy - 11}" width="26" height="14" rx="7" fill="${on ? C.ink : C.line}"/><circle cx="${on ? x + 19 : x + 7}" cy="${yy - 4}" r="5" fill="${C.bg}"/>`);
  add(T(x + 32, yy, text, { size: 13, fill: C.ink2 }));
  return x + 32 + tw(text, 13);
}
// the strip's label column, quiet: labels in ink-3 on one line, not filled tags
const rows = [
  ["Base", () => { add(T(CX, ry, "Winner", { size: 13, face: "p6" })); add(`<path d="M${r(CX + tw("Winner", 13, "p6") + 6)} ${ry - 6}l3.5 3.5l3.5 -3.5" fill="none" stroke="${C.ink2}" stroke-width="1.4"/>`); }],
  ["State", () => chips(ry, ["All", "NSW", "Vic", "Qld", "WA", "SA", "Tas", "ACT", "NT"], "All")],
  ["Seat type", () => chips(ry, ["All", "Inner metro", "Outer metro", "Provincial", "Rural"], "All")],
  ["Jump to", () => chips(ry, ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Hobart", "Canberra", "Darwin"], null)],
  ["Draw", () => {
    chips(ry, ["Seats", "Balloons", "Surface", "Areas", "Chart"], "Seats", { muted: ["Areas", "Chart"] });
    let x = R - (32 + tw("City names", 13)) - 22 - (32 + tw("Water", 13));
    x = sw(x, ry, true, "Water"); sw(x + 22, ry, true, "City names");
  }],
];
for (const [lab, fn] of rows) { label(ry, lab); fn(); ry += 28; }
add(`<line x1="${LX + 64}" x2="${LX + 64}" y1="${290 - 14}" y2="${ry - 28 + 6}" stroke="${C.line}"/>`);
// hint + search on one line
ry += 6;
add(`<circle cx="${LX + 6}" cy="${ry - 4.5}" r="6" fill="none" stroke="${C.ink3}" stroke-width="1.1"/><rect x="${LX + 5.4}" y="${ry - 6}" width="1.2" height="4.5" fill="${C.ink3}"/><circle cx="${LX + 6}" cy="${ry - 8.3}" r=".8" fill="${C.ink3}"/>`);
add(T(LX + 18, ry, "Zoom in, or choose a seat, to see its polling places", { size: 12.5, fill: C.ink3 }));
const sx0 = R - 260;
add(`<rect x="${sx0}" y="${ry - 17}" width="260" height="26" rx="3" fill="${C.surface}" stroke="${C.line}"/>`);
add(`<circle cx="${sx0 + 14}" cy="${ry - 5}" r="4.5" fill="none" stroke="${C.ink3}" stroke-width="1.3"/><path d="M${sx0 + 17.3} ${ry - 1.7}l3.4 3.4" stroke="${C.ink3}" stroke-width="1.3"/>`);
add(T(sx0 + 28, ry, "Search a seat or member", { size: 12.5, fill: C.faint }));
add(`<rect x="${R - 24}" y="${ry - 13}" width="16" height="18" rx="2" fill="none" stroke="${C.line}"/>`);
add(T(R - 16, ry, "/", { size: 11, fill: C.ink3, anchor: "middle" }));

// ================= MAP =================
const MY = ry + 22, MH = 610;
const box = { x: MX, y: MY, w: MW, h: MH };
const topo = JSON.parse(fs.readFileSync(path.join(ROOT, "map/data/geo-2025-lo.json"), "utf8"));
const isl = JSON.parse(fs.readFileSync(path.join(ROOT, "map/data/islands.json"), "utf8")).islands;
const divs = topo.objects.divs;
const LNP = "Berowra Cook Cowper Hume Lindsay Lyne Mitchell Page Parkes Riverina Bowman Capricornia Dawson Fadden Fairfax Fisher Flynn Groom Herbert Hinkler Longman Maranoa McPherson Moncrieff|Wide Bay|Wright Barker Grey Casey Flinders Gippsland Goldstein|La Trobe|Mallee Monash Nicholls Wannon Canning Durack Forrest O'Connor";
const lnpSet = new Set(LNP.split(/\|/).flatMap((s, i) => (i % 2 ? [s] : s.trim().split(/\s+/))).filter(Boolean));
const HOLD = { Bradfield: "ind", Calare: "ind", Fowler: "ind", Mackellar: "ind", Clark: "ind", Indi: "ind", Kooyong: "ind", Curtin: "ind", Farrer: "onp", "New England": "onp", Warringah: "csa", Wentworth: "csa", Kennedy: "oth", Mayo: "oth", Ryan: "grn" };
const holder = (n) => HOLD[n] || (lnpSet.has(n) ? "lnp" : "alp");
{ const tally = {}; for (const g of divs.geometries) { const h = holder(g.properties.name); tally[h] = (tally[h] || 0) + 1; } if (tally.alp !== 94 || tally.lnp !== 41) throw new Error("seat tally off: " + JSON.stringify(tally)); }

const proj = d3.geoConicEqualArea().parallels([-18, -36]).rotate([-132, 0])
  .fitExtent([[box.x + 74, box.y + 40], [box.x + box.w - 84, box.y + box.h - 36]], { type: "MultiPoint", coordinates: [[112.92, -43.65], [153.64, -10.68]] });
const gp = d3.geoPath(proj).digits(1);
add(`<defs><clipPath id="mapclip"><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"/></clipPath></defs>`);
add(`<g clip-path="url(#mapclip)">`);
add(`<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="${C.sea}"/>`);
// graticule: the projection's own lines every 10 degrees, Tropic dashed
const grat = d3.geoGraticule().step([10, 10]).extent([[90, -60], [180.0001, 0.0001]]);
add(`<path d="${gp(grat())}" fill="none" stroke="${C.grat}" stroke-width="0.8"/>`);
const tropic = { type: "LineString", coordinates: Array.from({ length: 91 }, (_, i) => [90 + i, -23.44]) };
add(`<path d="${gp(tropic)}" fill="none" stroke="${C.grat}" stroke-width="1" stroke-dasharray="5 4"/>`);
// seats
const feats = topojson.feature(topo, divs).features;
const byCol = {};
for (const f of feats) { const k = holder(f.properties.name); (byCol[k] ||= []).push(gp(f)); }
for (const [k, ds] of Object.entries(byCol)) add(`<path fill="${C[k]}" d="${ds.join("")}"/>`);
const meshSeat = topojson.mesh(topo, divs, (a, b) => a !== b && a.properties.st === b.properties.st);
const meshState = topojson.mesh(topo, divs, (a, b) => a !== b && a.properties.st !== b.properties.st);
add(`<path d="${gp(meshSeat)}" fill="none" stroke="#fff" stroke-opacity="0.75" stroke-width="0.45" stroke-linejoin="round"/>`);
add(`<path d="${gp(meshState)}" fill="none" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>`);
// sea names (the page's italic serif)
const SEA = [["Timor Sea", 124.5, -11.2], ["Arafura Sea", 134.6, -9.6], ["Gulf of", 139.6, -13.9], ["Carpentaria", 139.6, -14.9], ["Coral Sea", 154.2, -17.5], ["Tasman Sea", 156.8, -42.0], ["Indian Ocean", 112.9, -36.4], ["Southern Ocean", 131.5, -42.3], ["Great Australian", 130.6, -33.9], ["Bight", 130.6, -34.9]];
for (const [n, lo, la] of SEA) { const [x, yy] = proj([lo, la]); add(`<text x="${r(x)}" y="${r(yy)}" font-family="Crimson Text" font-style="italic" font-size="14" fill="${C.seaInk}" text-anchor="middle">${esc(n)}</text>`); }
{ const [x, yy] = proj([158.6, -23.44]); add(`<text x="${r(x)}" y="${r(yy - 5)}" font-family="Crimson Text" font-style="italic" font-size="12" fill="${C.seaInk}" text-anchor="middle">Tropic of Capricorn</text>`); }
// town names: black lettering, white outline, dot
const TOWNS = [
  ["Darwin", 130.84, -12.46, "r"], ["Nhulunbuy", 136.78, -12.18, "r"], ["Weipa", 141.87, -12.63, "r"], ["Cairns", 145.77, -16.92, "r"],
  ["Townsville", 146.82, -19.26, "l"], ["Mount Isa", 139.49, -20.73, "l"], ["Alice Springs", 133.88, -23.70, "r"], ["Karratha", 116.85, -20.74, "r"],
  ["Kalgoorlie", 121.47, -30.75, "r"], ["Perth", 115.86, -31.95, "r"], ["Adelaide", 138.60, -34.93, "l"], ["Melbourne", 144.96, -37.81, "l"],
  ["Canberra", 149.13, -35.28, "l"], ["Sydney", 151.21, -33.87, "r"], ["Newcastle", 151.78, -32.93, "r"], ["Brisbane", 153.03, -27.47, "l"],
  ["Gold Coast", 153.43, -28.02, "r"], ["Sunshine Coast", 153.07, -26.65, "r"], ["Hobart", 147.33, -42.88, "r"],
];
const townG = [];
for (const [n, lo, la, side] of TOWNS) {
  const [x, yy] = proj([lo, la]);
  townG.push(`<circle cx="${r(x)}" cy="${r(yy)}" r="2.6" fill="#111" stroke="#fff" stroke-width="1.2"/>`);
  const tx = side === "r" ? x + 6 : x - 6;
  townG.push(`<text x="${r(tx)}" y="${r(yy + 4)}" ${F.p6} font-size="12" fill="#111" stroke="#fff" stroke-width="3" stroke-linejoin="round" paint-order="stroke"${side === "l" ? ' text-anchor="end"' : ""}>${esc(n)}</text>`);
}
add(...townG);
// degree marks where the lines meet the frame
function solve(f, a, b) { for (let i = 0; i < 50; i++) { const m = (a + b) / 2; (f(a) * f(m) <= 0) ? (b = m) : (a = m); } return (a + b) / 2; }
for (let lo = 100; lo <= 170; lo += 10) {
  const top = box.y + 2;
  const fy = (la) => proj([lo, la])[1] - top;
  const la = solve(fy, 5, -60); const [x] = proj([lo, la]);
  if (x > box.x + 30 && x < box.x + box.w - 70) add(T(x, box.y + 15, `${lo}°E`, { size: 10.5, fill: C.seaInk, anchor: "middle" }));
}
for (let la = -10; la >= -40; la -= 10) {
  const fx = (lo) => proj([lo, la])[0] - (box.x + 2);
  const lo = solve(fx, 60, 140); const [, yy] = proj([lo, la]);
  if (yy > box.y + 24 && yy < box.y + box.h - 10) add(T(box.x + 8, yy - 4, `${-la}°S`, { size: 10.5, fill: C.seaInk }));
}
// island insets, at the page's framing: two west, two east
function inset(key, bx, by, bw, bh) {
  const I = isl.find((d) => d.key === key);
  const f = { type: "MultiPolygon", coordinates: I.rings.map((rg) => { const g = { type: "Polygon", coordinates: [rg] }; return [d3.geoArea(g) > 2 * Math.PI ? rg.slice().reverse() : rg]; }) };
  const ip = d3.geoConicEqualArea().parallels([-18, -36]).rotate([-132, 0]).fitExtent([[bx + 8, by + 8], [bx + bw - 8, by + bh - 8]], f);
  add(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="2" fill="${C.sea}" stroke="${C.seaInk}" stroke-opacity=".55" stroke-width="1"/>`);
  add(`<path d="${d3.geoPath(ip).digits(1)(f)}" fill="${C.alp}"/>`);
  add(`<text x="${bx + bw / 2}" y="${by + bh + 13}" ${F.p4} font-size="10.5" fill="${C.ink2}" stroke="${C.sea}" stroke-width="3" paint-order="stroke" text-anchor="middle">${esc(I.name)}</text>`);
}
inset("christmas", box.x + 150, box.y + 34, 58, 48);
inset("cocos", box.x + 62, box.y + 92, 58, 52);
inset("norfolk", box.x + box.w - 90, box.y + 372, 58, 58);
inset("lordhowe", box.x + box.w - 172, box.y + 448, 48, 66);
add(`</g>`);
add(`<rect x="${box.x + 0.5}" y="${box.y + 0.5}" width="${box.w - 1}" height="${box.h - 1}" fill="none" stroke="${C.line}"/>`);
// zoom plate: + and − only (full screen lives in the eyebrow)
const zx = box.x + box.w - 40, zy = box.y + 12;
add(`<rect x="${zx}" y="${zy}" width="28" height="56" rx="3" fill="${C.surface}" stroke="${C.line}"/><line x1="${zx}" x2="${zx + 28}" y1="${zy + 28}" y2="${zy + 28}" stroke="${C.line}"/>`);
add(`<path d="M${zx + 9} ${zy + 14}h10M${zx + 14} ${zy + 9}v10M${zx + 9} ${zy + 42}h10" stroke="${C.ink2}" stroke-width="1.5"/>`);
// seat-count key in the map's corner: the map's colours read straight off the pane's bar
// (no separate legend: the pane's bar and crossbench key are the key)

// ================= elections strip =================
let ey = MY + MH + 30;
label(ey, "Elections");
chips(ey, ["Federal", "Victoria", "New South Wales", "Queensland", "South Australia", "Western Australia"], "Federal");
ey += 26;
const YRS = [["1993", 80, 65], ["1996", 49, 94], ["1998", 67, 80], ["2001", 65, 82], ["2004", 60, 87], ["2007", 83, 65], ["2010", 72, 72], ["2013", 55, 90], ["2016", 69, 76], ["2019", 68, 77], ["2022", 77, 58], ["2025", 94, 43], ["Now", 94, 41]];
const yx0 = CX, ystep = (R - CX - 20) / (YRS.length - 1);
YRS.forEach(([yr, a, l], i) => {
  const x = yx0 + i * ystep, bw = 30, on = yr === "Now";
  const o = 150 - a - l;
  const k = bw / 150;
  add(`<rect x="${r(x - bw / 2)}" y="${ey - 6}" width="${r(a * k)}" height="6" fill="${C.alp}"/>`);
  add(`<rect x="${r(x - bw / 2 + a * k)}" y="${ey - 6}" width="${r(l * k)}" height="6" fill="${C.lnp}"/>`);
  add(`<rect x="${r(x - bw / 2 + (a + l) * k)}" y="${ey - 6}" width="${r(o * k)}" height="6" fill="${C.oth}"/>`);
  add(T(x, ey + 12, yr, { size: 11.5, face: on ? "p6" : "p4", fill: on ? C.ink : C.ink3, anchor: "middle" }));
  if (on) add(`<rect x="${r(x - bw / 2)}" y="${ey + 17}" width="${bw}" height="2" fill="${C.ink}"/>`);
});
add(`<line x1="${CX}" x2="${R}" y1="${ey - 6 + 3}" y2="${ey - 6 + 3}" stroke="${C.line}" stroke-width="0" />`);

// ---------- fonts ----------
const b64 = (f) => fs.readFileSync(path.join(ROOT, "assets/fonts", f)).toString("base64");
const fonts = `<style>
@font-face{font-family:"IBM Plex Sans";src:url(data:font/woff2;base64,${b64("ibmplexsans-latin.056e4e24.woff2")}) format("woff2");font-weight:100 700}
@font-face{font-family:"Commissioner";src:url(data:font/woff2;base64,${b64("commissioner-latin.737ec8f2.woff2")}) format("woff2");font-weight:100 900}
@font-face{font-family:"Crimson Text";font-style:italic;src:url(data:font/woff2;base64,${b64("crimsontext-italic-400-latin.381a244e.woff2")}) format("woff2")}
@font-face{font-family:"SS3Mark";src:url(data:font/woff2;base64,${b64("ss3mark-wordmark.78676a6f.woff2")}) format("woff2");font-weight:200 900}
text{font-feature-settings:"tnum" 1}
</style>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">
<title>Electoral map – The House today (mockup)</title>
${fonts}
${out.join("\n")}
</svg>`;
fs.writeFileSync(path.join(HERE, "map-house-today.svg"), svg);
console.log("wrote", (svg.length / 1024).toFixed(0) + "KB");
