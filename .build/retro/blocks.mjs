/* blocks.mjs – a modern section, read as the retro pages' blocks (2026-11-09).

   harvest.mjs renders a modern section in node; this walks what it rendered,
   in reading order, and keeps what a reader sees as plain blocks: the
   headline and its dek, sub-heads, notes, every chart (as a chart spec),
   and each kind of figure the modern page draws (the big two-party pair,
   the primary-vote figures, the latest-polls rows, the leaders' bars and
   ratings, who votes for whom, the issues, the past-terms scorecard, the
   final-polls record…), as rows of the figures and words it printed. The
   retro pages lay the blocks out in the era's dress (now.mjs, cycles.mjs);
   no figure is worked out here, only read.

   A kind of figure this doesn't know is passed over, and its words still
   come through where they sit in plain text elements, so a new modern
   widget shows up as a gap, never as a wrong number. */
import { match, find as findSelf, findAll as findAllSelf, words, runs, hasCls, clsOf, chartSpec } from "./harvest.mjs";
// every query here looks inside its container, never at the container itself
const findAll = (t, pred, out = []) => findAllSelf(t && typeof t === "object" && !Array.isArray(t) ? t.kids : t, pred, out);
const find = (t, pred) => findAll(t, pred)[0] || null;
const q = (t, sel) => find(t, match(sel));
const qa = (t, sel) => findAll(t, match(sel));

const kids = (t) => (t && !Array.isArray(t) && typeof t === "object" ? [t.kids].flat(Infinity).filter((x) => x != null && x !== "" && x !== false) : []);
const els = (t) => kids(t).filter((x) => typeof x === "object");
const pctOf = (v) => (v == null ? null : typeof v === "number" ? v : parseFloat(String(v)));
const styleOf = (t) => (t && t.props && t.props.style) || {};
// a bar segment's share: its width, or the flex basis the modern bars lay out by
const wOf = (t) => { const st = styleOf(t); return pctOf(st.width != null ? st.width : st.flexBasis != null ? st.flexBasis : st.flexGrow); };
const hidden = (t) => t.props && (t.props["aria-hidden"] === true || t.props["aria-hidden"] === "true");
const W = (t) => (t ? words(t) : "");
const textKids = (t) => els(t).map((x) => W(x)).filter(Boolean);

/* ---------------------------------------------------------------- the figure widgets */
function tppTop(t) {
  const side = (s) => s && { name: W(q(s, ".rd-tpp-name")), v: W(q(s, ".rd-tpp-num")) };
  const sides = qa(t, ".rd-tpp-side");
  const lg = find(t, (x) => x.tag === "$c" && x.name === "RdLeadGauge");
  const out = { k: "tpp", a: side(sides[0]), b: side(sides[1]) };
  if (lg) {
    const g = lg.props, el = q(lg, ".rd-lg");
    out.gauge = { lead: g.lead, margin: g.margin != null ? g.margin : null, a: g.aName, b: g.bName, say: el ? el.props.title || el.props["aria-label"] || "" : "",
      sides: el ? qa(el, ".rd-lg-side").map(W) : [] };
  }
  const v = q(t, ".rd-tpp-verdict"); if (v) out.verdict = runs(v).filter(([s]) => s);
  const c = q(t, ".rd-tpp-change"); if (c) out.change = W(c);
  const p = find(t, (x) => /rd-tpp-(prov|basis|src)/.test(clsOf(x))); if (p) out.prov = W(p);
  return out;
}
function pvStats(t) {
  return { k: "pvstats", bracket: W(q(t, ".rd-pv-bracket")) || null,
    stats: qa(t, ".rd-pv-stat").map((s) => ({ name: W(q(s, ".rd-pv-long") || q(s, ".rd-pv-name")), v: W(q(s, ".rd-pv-val")).replace(/%$/, ""), chg: W(q(s, ".rd-pv-chg")) })) };
}
/* the latest-and-next table: a row per pollster (its sub-rows nested), what
   each column prints, wide words and phone words alike */
function pollsTable(t) {
  const head = q(t, ".rd-pl-head");
  const cols = head ? els(head).map((c) => W(c)) : [];
  const ticks = head ? qa(head, ".rd-pl-ticks").flatMap((x) => els(x).map(W)) : [];
  const cell = (row, c) => q(row, ".rd-pl-c-" + c);
  const two = (x) => (x ? { main: W(q(x, ".rd-pl-main")), sub: W(q(x, ".rd-pl-long") ? q(x, ".rd-pl-sub") : q(x, ".rd-pl-sub")) } : null);
  const items = qa(t, ".rd-pl-item").map((it) => {
    const rows = findAll(it, (x) => hasCls(x, "rd-pl-row") || hasCls(x, "rd-pl-subrow"));
    const one = (row) => {
      const nm = cell(row, "name"), fig = cell(row, "figs"), nx = cell(row, "next"), la = cell(row, "latest");
      const a = nm && find(nm, (x) => x.tag === "a");
      const figMain = fig && q(fig, ".rd-pl-main");
      const nxA = nx && find(nx, (x) => x.tag === "a");
      return {
        sub: hasCls(row, "rd-pl-subrow") || !hasCls(row, "rd-pl-row"),
        faded: /\b(rd-pl-stale|rd-pl-out|faded|dim)\b/.test(clsOf(row)) || /\b(rd-pl-stale|rd-pl-out)\b/.test(clsOf(it)),
        name: a ? W(a) : W(q(nm, ".rd-pl-nm") || q(nm, ".rd-pl-main")), href: a ? a.props.href || null : null,
        who: W(q(nm, ".rd-pl-sub")),
        latest: la ? { main: W(q(la, ".rd-pl-main")), sub: W(q(la, ".rd-pl-sub")) } : null,
        fig: fig ? {
          pair: figMain ? els(figMain).filter((x) => !hasCls(x, "rd-pl-tag") && !hasCls(x, "rd-pl-dash")).map(W).filter(Boolean) : [],
          tag: W(q(fig, ".rd-pl-tag")), long: W(q(fig, ".rd-pl-long")) || W(q(fig, ".rd-pl-sub")), short: W(q(fig, ".rd-pl-short")),
          text: !figMain ? W(fig) : null,
        } : null,
        next: nx ? { main: nxA ? W(nxA) : W(q(nx, ".rd-pl-main")).replace(/^Next\s*/, ""), href: nxA ? nxA.props.href || null : null, sub: W(q(nx, ".rd-pl-sub")) } : null,
      };
    };
    const list = rows.map(one);
    return { ...list[0], faded: hasCls(it, "stale") || list[0].faded, isSub: hasCls(it, "rd-pl-subitem"), subs: list.slice(1) };
  });
  // a house's MRP or pooled series is an item of its own under the house's: nest it there
  const nested = [];
  for (const it of items) {
    if (it.isSub && nested.length) nested[nested.length - 1].subs.push({ ...it, sub: true });
    else nested.push(it);
  }
  return { k: "polls", cols, ticks, rows: nested };
}
function headBars(t) {
  return { k: "hbars", bars: qa(t, ".rd-hb").map((hb) => {
    const top = q(hb, ".rd-hb-top"), segs = qa(hb, ".rd-hb-seg");
    const seg = (s) => s && { name: W(q(s, ".rd-hb-name")), v: W(find(s, (x) => x.tag === "b")), w: wOf(s) };
    const cis = q(hb, ".rd-hb-cis");
    // every leader's segment (two head to head, three in the three-way question), "neither" apart
    const ab = segs.filter((s) => !hasCls(s, "rd-hb-neither"));
    const ne = segs.find((s) => hasCls(s, "rd-hb-neither"));
    return { title: W(find(top, (x) => x.tag === "b")), lead: W(find(top, (x) => x.tag === "span")),
      a: seg(ab[0]), b: seg(ab[1]), segs: ab.map(seg), neither: ne ? { t: W(ne), w: wOf(ne) } : null,
      ci: cis ? els(cis).map(W).filter(Boolean) : [] };
  }) };
}
function dotPlot(t) {
  const head = q(t, ".rd-dp-head");
  return { k: "dp", head: head ? els(head).map(W) : [],
    axis: head ? qa(q(head, ".rd-dp-axis") || head, "span").map((x) => [pctOf(styleOf(x).left), W(x)]).filter(([l, s]) => s) : [],
    rows: qa(t, ".rd-dp-row").map((r) => {
      const ci = q(r, ".rd-dp-ci"), dot = q(r, ".rd-dp-dot"), zero = q(r, ".rd-dp-zero");
      return { name: W(q(r, ".rd-dp-name")), now: W(q(r, ".rd-dp-now")), chg: W(q(r, ".rd-dp-chg")), sig: hasCls(q(r, ".rd-dp-chg"), "sig"),
        dot: dot ? pctOf(styleOf(dot).left) : null, ci: ci ? [pctOf(styleOf(ci).left), pctOf(styleOf(ci).width)] : null, zero: zero ? pctOf(styleOf(zero).left) : null,
        rug: qa(r, ".rd-dp-rug").flatMap((g) => els(g).map((b) => pctOf(styleOf(b).left))).filter((v) => v != null) };
    }) };
}
function dirFigs(t, sec) {
  const figs = qa(t, ".rd-dir-fig").map((f) => ({ v: W(q(f, ".rd-dir-v")).replace(/%$/, ""), k: W(q(f, ".rd-dir-k")) }));
  const bar = q(sec, ".rd-dir-bar");
  const seg = (c) => { const s = bar && q(bar, c); return s ? { w: wOf(s), t: W(s) } : null; };
  return { k: "dir", figs, bar: bar ? { pos: seg(".rd-dir-pos"), uns: seg(".rd-dir-uns"), neg: seg(".rd-dir-neg") } : null, net: W(q(sec, ".rd-dir-net")) };
}
function wvSets(t) {
  return { k: "wv", sets: qa(t, ".rd-wv-set").map((s) => {
    const h = q(s, ".rd-wv-sethead");
    const hb = h ? find(h, (x) => x.tag === "b") : null;
    return { title: W(hb), src: hb ? W(find(h, (x) => x.tag === "span" && !hasCls(x, "rd-wv-allcap") && !hasCls(x, "rd-wv-vs") && W(x) !== W(hb) && !find(x, (y) => y.tag === "b"))) : "",
      all: W(q(s, ".rd-wv-allcap")), vs: W(q(s, ".rd-wv-vs")),
      rows: qa(s, ".rd-wv-row").map((r) => {
        const v = q(r, ".rd-wv-v"), d = q(r, ".rd-wv-d");
        const vb = v && find(v, (x) => x.tag === "b"), vs = v && find(v, (x) => x.tag === "span" && /^±/.test(W(x)));
        const ci = q(r, ".rd-wv-ci"), dot = q(r, ".rd-wv-dot"), all = q(r, ".rd-wv-all");
        const labEl = q(r, ".rd-wv-lab");
        const lab = labEl ? [labEl.kids].flat(Infinity).map((x) => (typeof x === "string" ? x : x && typeof x === "object" ? " " + W(x) : "")).join("").replace(/\s+/g, " ").trim() : "";
        return { lab, v: W(vb).replace(/%$/, ""), ci: W(vs).replace(/^±\s*/, ""), d: W(d), sig: hasCls(d, "sig"),
          hollow: hasCls(dot, "hollow") || hasCls(dot, "ring") || /hollow|ring/.test(clsOf(dot)),
          dot: dot ? pctOf(styleOf(dot).left) : null, cil: ci ? [pctOf(styleOf(ci).left), pctOf(styleOf(ci).width)] : null, allx: all ? pctOf(styleOf(all).left) : null };
      }) };
  }) };
}
/* the vote-switching mosaic is an svg: its words sit in text elements by
   column, its geometry in the rects */
function mosaic(t) {
  const texts = findAll(t, (x) => x.tag === "text").map((x) => ({ c: clsOf(x), x: +x.props.x || 0, y: +x.props.y || 0, t: W(x) }));
  const rects = findAll(t, (x) => x.tag === "rect").map((x) => ({ c: clsOf(x), x: +x.props.x || 0, y: +x.props.y || 0, w: +x.props.width || 0, h: +x.props.height || 0, fill: (x.props.style && x.props.style.fill) || x.props.fill || "" }));
  const vb = String(t.props.viewBox || "0 0 0 0").split(/\s+/).map(Number);
  return { k: "mosaic", w: vb[2], h: vb[3], texts, rects };
}
function issuesTable(t) {
  const head = q(t, ".rd-is-head");
  const verdictOf = (r) => { const v = q(r, ".rd-is-verdict"); if (!v) return { t: "", x: null }; const x = find(v, (y) => y.tag === "small"); return { t: x ? W(v).replace(W(x), "").trim() : W(v), x: x ? W(x) : null }; };
  const tally = q(t, ".rd-is-tally");
  return { k: "issues", head: head ? { imp: W(q(head, ".rd-is-imph")), cap: W(q(head, ".rd-is-cap")), leg: qa(head, ".rd-is-leg").flatMap((l) => els(l).map(W)) } : null,
    rows: qa(t, ".rd-is-row").filter((r) => !hasCls(r, "rd-is-tally")).map((r) => {
      const imp = q(r, ".rd-is-imp"), bar = imp && q(imp, ".rd-is-bar");
      const vd = verdictOf(r);
      return { lab: W(q(r, ".rd-is-lab")), sel: hasCls(r, "sel"),
        imp: imp ? (q(imp, ".rd-is-na") ? null : W(find(imp, (x) => x.tag === "b"))) : null, impNa: imp && q(imp, ".rd-is-na") ? W(q(imp, ".rd-is-na")) : null,
        bar: bar ? wOf(find(bar, (x) => x.tag === "span") || bar) : null,
        nums: qa(r, ".rd-is-nums").flatMap((n) => els(n).map(W)), verdict: vd.t, strong: hasCls(q(r, ".rd-is-verdict"), "strong"), extra: vd.x };
    }),
    score: tally ? { t: W(find(q(tally, ".rd-is-tallab"), (x) => x.tag === "b")), d: W(find(q(tally, ".rd-is-tallab"), (x) => x.tag === "small")),
      vals: qa(tally, ".rd-is-score").map((sc) => ({ v: W(find(sc, (x) => x.tag === "b")), p: W(find(sc, (x) => x.tag === "i")) })) } : null };
}
function un100(t) {
  const bar = q(t, ".rd-un-bar");
  return { k: "un100", head: W(q(t, ".rd-un-100h") && find(q(t, ".rd-un-100h"), (x) => x.tag === "b")), sub: W(q(t, ".rd-un-100b")),
    labels: (() => { const l = q(t, ".rd-un-100l"); if (!l) return [];
      return findAll(l, (x) => x.tag === "b").map((b) => b ? W(b) : ""); })(),
    descs: (() => { const l = q(t, ".rd-un-100l"); if (!l) return [];
      return els(l).map((x) => W(x)); })(),
    bar: bar ? els(bar).map((s) => ({ c: clsOf(s), v: W(s), w: wOf(s) || +W(s) || 0 })) : [],
    note: W(q(t, ".rd-note")) };
}
function reads(t) {
  return qa(t, ".rd-un-read").map((r) => ({ title: W(q(r, ".rd-un-rtop") && find(q(r, ".rd-un-rtop"), (x) => x.tag === "b")), v: W(q(r, ".rd-un-rv")), ci: W(q(r, ".rd-un-rci")), desc: W(find(r, (x) => x.tag === "p")) }));
}
function scorecard(t) {
  const head = q(t, ".rd-cs-head");
  const groups = [];
  for (const x of els(t)) {
    if (hasCls(x, "rd-cs-group")) {
      const sc = q(x, ".rd-cs-scale");
      groups.push({ name: W(find(x, (y) => y.tag === "b")), unit: W(x).replace(W(find(x, (y) => y.tag === "b")), "").replace(W(sc), "").trim(),
        scale: sc ? els(sc).map((s) => [pctOf(styleOf(s).left), W(s)]) : [], rows: [] });
    } else if (hasCls(x, "rd-cs-item")) {
      const r = q(x, ".rd-cs-row");
      if (!r || !groups.length) continue;
      const nm = q(r, ".rd-cs-name"), now = q(r, ".rd-cs-now"), st = q(r, ".rd-cs-strip"), avg = q(r, ".rd-cs-avg"), rank = q(r, ".rd-cs-rank");
      const iv = (c) => qa(st, c).map((i) => ({ l: pctOf(styleOf(i).left), w: pctOf(styleOf(i).width), t: i.props.title || i.props["aria-label"] || i.props["data-yr"] || null, c: clsOf(i) }));
      groups[groups.length - 1].rows.push({
        name: W(find(nm, (y) => y.tag === "b")), sub: W(find(nm, (y) => y.tag === "span")), now: W(now), color: styleOf(now).color || null,
        strip: st ? { gl: iv(".rd-cs-gl").map((g) => g.l), b80: iv(".rd-cs-b80")[0] || null, b50: iv(".rd-cs-b50")[0] || null, dots: iv(".rd-cs-dot").map((d) => [d.l, d.t]), mean: (iv(".rd-cs-mean")[0] || {}).l, cur: (iv(".rd-cs-cur")[0] || {}).l } : null,
        avg: avg ? { b: W(find(avg, (y) => y.tag === "b")), s: W(find(avg, (y) => y.tag === "span")) } : null,
        rank: rank ? { b: W(find(rank, (y) => y.tag === "b")), s: W(find(rank, (y) => y.tag === "span")) } : null,
      });
    }
  }
  return { k: "cs", head: head ? els(head).map(W) : [], groups };
}
function accSum(t) { return { k: "tiles", tiles: qa(t, ".rd-acc-firm").map((f) => ({ b: W(find(f, (x) => x.tag === "b")), v: W(q(f, ".rd-acc-fv")), s: W(els(f).filter((x) => x.tag === "span" && !hasCls(x, "rd-acc-fv")).pop()) })) }; }
function table(t) {
  const cap = find(t, (x) => x.tag === "caption");
  const th = q(t, "thead");
  return { k: "table", caption: W(cap), cls: clsOf(t), head: th ? findAll(th, (x) => x.tag === "th").map((x) => ({ t: W(x), num: hasCls(x, "num") })) : [],
    rows: findAll(q(t, "tbody") || t, (x) => x.tag === "tr").map((tr) => els(tr).filter((c) => c.tag === "th" || c.tag === "td").map((c) => ({ t: W(c), th: c.tag === "th", color: styleOf(c).color || (find(c, (y) => styleOf(y).color) ? styleOf(find(c, (y) => styleOf(y).color)).color : null) }))) };
}
function accRows(t) {
  const head = q(t, ".rd-acc-head");
  const out = { k: "accrows", scale: head ? qa(q(head, ".rd-acc-scale") || head, "i").map((i) => [pctOf(styleOf(i).left), W(i), clsOf(i)]) : [],
    ends: head ? qa(head, "em").map(W) : [], groups: [] };
  const rowsEl = q(t, ".rd-acc-rows") || t;
  for (const x of els(rowsEl)) {
    if (hasCls(x, "rd-acc-group")) out.groups.push({ name: W(x), rows: [] });
    else if (hasCls(x, "rd-acc-row")) {
      if (!out.groups.length) out.groups.push({ name: "", rows: [] });
      const lab = q(x, ".rd-acc-lab"), tr = q(x, ".rd-acc-track");
      const tail = els(x).filter((y) => !hasCls(y, "rd-acc-lab") && !hasCls(y, "rd-acc-track"));
      out.groups[out.groups.length - 1].rows.push({
        year: W(find(lab, (y) => y.tag === "b")), pair: W(find(lab, (y) => y.tag === "span")),
        // each pollster's final poll, and their average (acc-mean, drawn big)
        dots: tr ? findAll(tr, (y) => /\bacc-(dot|mean)\b|\brd-acc-dot\b/.test(clsOf(y))).map((d) => ({ l: pctOf(styleOf(d).left), c: /acc-mean/.test(clsOf(d)) ? "acc-dot big" : clsOf(d), t: d.props.title || d.props["aria-label"] || null, col: styleOf(d).background || styleOf(d).backgroundColor || null })) : [],
        cells: tail.map((y) => { const flag = find(y, (z) => /flag|badge|oneway/.test(clsOf(z))); return { t: flag ? W(y).replace(W(flag), "").trim() : W(y), flag: flag ? W(flag) : null, c: clsOf(y), color: styleOf(y).color || null }; }),
      });
    }
  }
  return out;
}
function rankTiles(t) {
  return { k: "tiles", tiles: els(t).map((f) => ({ b: W(find(f, (x) => x.tag === "b")), v: W(find(f, (x) => /fv|-v\b|val/.test(clsOf(x)))), s: W(els(f).filter((x) => x.tag === "span").pop()) })).filter((x) => x.b) };
}
// the events a chart numbers: each one's name and date
function eventList(t) {
  return { k: "events", items: findAll(t, (x) => x.tag === "li").map((li) => {
    const l = q(li, ".rd-evlist-l"), d = q(li, ".rd-evlist-d");
    return l ? { t: W(l), d: d ? W(d) : "" } : { t: W(li), d: "" };
  }) };
}

/* ---------------------------------------------------------------- the walk */
// a key's entries: its items, or the one line some keys print instead
const keyItems = (key) => { const it = qa(key, ".rd-key-item").map(W).filter(Boolean); if (it.length) return it; const t = find(key, (x) => /keytxt/.test(clsOf(x))); return t ? [W(t)] : []; };
/* a chart card: its head, the chart, its key; readings above it (the
   decidedness and confidence panels' figures) ride with it */
function chartCard(card, out, ctx) {
  const chart = find(card, (x) => x.tag === "$chart");
  const head = q(card, ".rd-chead-t") || q(card, ".rd-un-ptitle") || q(card, ".rd-sm-top");
  const ptitle = q(card, ".rd-un-ptitle");
  const sm = q(card, ".rd-sm-top");
  const key = q(card, ".rd-key");
  const spec0 = chart ? chartSpec(chart.props) : null;
  // a chart head of a bold title and a lighter tail ("By age" "since July 2025"): the two apart
  const hb = head && !sm && !ptitle ? find(head, (x) => x.tag === "b") : null;
  const cmeta = q(card, ".rd-chead-meta");
  const isHead = q(card, ".rd-is-chead"), isTop = q(card, ".rd-is-ctop"), isSub = q(card, ".rd-is-csub");
  const headWords = head ? (cmeta ? W(head).replace(W(cmeta), "").trim() : W(head)) : "";
  const block = { k: "chart", title: (sm ? W(find(sm, (x) => x.tag === "span")) : ptitle ? W(find(ptitle, (x) => x.tag === "b")) : hb ? W(hb) : isTop ? W(isTop) : headWords) || (spec0 && spec0.title) || "",
    meta: ptitle ? W(find(ptitle, (x) => x.tag === "span")) : cmeta ? W(cmeta) : hb ? W(head).replace(W(hb), "").trim() : "", fig: sm ? W(find(sm, (x) => x.tag === "b")) : null,
    hed: isHead ? W(isHead) : null, csub: isSub ? W(isSub) : null,
    reads: reads(card), spec: spec0,
    key: key ? keyItems(key) : [], small: !!sm };
  if (!block.spec && !block.reads.length) return false;
  out.push(block);
  return true;
}
const SKIP = (t) => t.tag === "button" && !hasCls(t, "rd-pv-stat") || t.tag === "select" || t.tag === "nav" || t.tag === "svg" && !hasCls(t, "rd-mo")
  || hasCls(t, "rd-tabs") || hasCls(t, "rd-eyebrow-tools") || hasCls(t, "rd-qpop") || hasCls(t, "rd-how") || hasCls(t, "sr-only")
  || hasCls(t, "rd-cc") || hasCls(t, "rd-chips") || hasCls(t, "rd-acc-basis") || hasCls(t, "rd-cyc-draw") || hasCls(t, "rd-cyc-chipmove") || hasCls(t, "rd-cc-board");
export function sectionBlocks(sec, ctx = {}) {
  ctx = { ...ctx, sec };
  const out = [];
  let title = "", meta = "";
  const walk = (t) => {
    if (!t || typeof t !== "object") return;
    if (Array.isArray(t)) { t.forEach(walk); return; }
    if (t.tag === "$chart") { const spec = chartSpec(t.props); out.push({ k: "chart", title: spec.title, meta: "", reads: [], spec, key: [] }); return; }
    if (hidden(t) || SKIP(t)) return;
    const c = clsOf(t);
    if (hasCls(t, "rd-eyebrow")) { title = title || W(q(t, ".rd-title")); meta = meta || W(q(t, ".rd-meta")); return; }
    if (hasCls(t, "rd-hed")) { out.push({ k: "hed", t: W(t), top: t.tag === "h2" }); return; }
    if (hasCls(t, "rd-dek")) { out.push({ k: "dek", t: W(t) }); return; }
    if (hasCls(t, "rd-sub")) { out.push({ k: "sub", t: W(t) }); return; }
    if (hasCls(t, "rd-subdek")) { out.push({ k: "subdek", t: W(t) }); return; }
    if (hasCls(t, "rd-tpp-top")) { out.push(tppTop(t)); return; }
    if (hasCls(t, "rd-pv-stats")) { out.push(pvStats(t)); return; }
    if (hasCls(t, "rd-pl")) { out.push(pollsTable(t)); return; }
    if (hasCls(t, "rd-hbs")) { out.push(headBars(t)); return; }
    if (hasCls(t, "rd-dp")) { out.push(dotPlot(t)); return; }
    if (hasCls(t, "rd-dir-figs")) { out.push(dirFigs(t, ctx.sec || t)); return; }
    if (hasCls(t, "rd-dir-bar") || hasCls(t, "rd-dir-net")) return;   // read with the figures
    if (hasCls(t, "rd-wv-plot") || hasCls(t, "rd-wv-dots") && q(t, ".rd-wv-set")) { out.push(wvSets(t)); return; }
    if (t.tag === "svg" && hasCls(t, "rd-mo")) { out.push(mosaic(t)); return; }
    if (hasCls(t, "rd-is-left")) { out.push(issuesTable(t)); return; }
    if (hasCls(t, "rd-un-100")) { out.push(un100(t)); return; }
    if (hasCls(t, "rd-cs")) { out.push(scorecard(t)); return; }
    if (hasCls(t, "rd-acc-sum")) { out.push(accSum(t)); return; }
    if (t.tag === "table" && !hasCls(t, "rd-tsig-table")) { out.push(table(t)); return; }
    if (hasCls(t, "rd-acc-card") || hasCls(t, "acc-rows") && !q(t, ".rd-chead")) { const cap = q(t, ".rd-chead-t"); out.push({ ...accRows(t), title: W(cap) }); return; }
    if (hasCls(t, "rd-acc-tiles") || hasCls(t, "rd-acc-firms")) { out.push(rankTiles(t)); return; }
    if (hasCls(t, "rd-tsig") && t.tag === "details") {
      const tb = q(t, "table");
      out.push({ k: "tsig", summary: W(find(t, (x) => x.tag === "summary")), table: tb ? table(tb) : null, note: W(q(t, ".rd-tsig-note")) });
      return;
    }
    if (t.tag === "details") {
      out.push({ k: "how", summary: W(find(t, (x) => x.tag === "summary")), paras: findAll(t, (x) => x.tag === "p").map(W).filter(Boolean) });
      return;
    }
    if (hasCls(t, "rd-card") || hasCls(t, "rd-un-panel")) { if (chartCard(t, out, ctx)) { walkRest(t); return; } }
    if (hasCls(t, "rd-evlist") || hasCls(t, "rd-event-list") || hasCls(t, "rd-cyc-events")) { out.push(eventList(t)); return; }
    if (hasCls(t, "rd-foot")) { out.push({ k: "foot", t: W(q(t, ".rd-foot-text") || t) }); return; }
    if (hasCls(t, "rd-key")) { const items = keyItems(t); if (items.length) out.push({ k: "key", items }); return; }
    if (t.tag === "p" && (hasCls(t, "rd-note") || /rd-[a-z-]*note|rd-dir-extremes|rd-acc-stats-note|rd-ld-note/.test(c))) { const s = W(t); if (s) out.push({ k: "note", t: s }); return; }
    if (hasCls(t, "rd-sm-grid")) { const before = out.length; els(t).forEach((x) => chartCard(x, out, ctx)); const items = out.splice(before); out.push({ k: "smgrid", items }); return; }
    if (t.tag === "p" && W(t) && !hasCls(t, "table-hint")) { out.push({ k: "p", t: W(t) }); return; }
    walk(t.kids);
  };
  /* a card keeps its own notes and keys walking after its chart: the parts
     chartCard didn't take */
  const walkRest = (card) => {
    for (const x of els(card)) {
      if (x.tag === "$chart" || hasCls(x, "rd-chead") || hasCls(x, "rd-un-ptitle") || hasCls(x, "rd-un-read") || hasCls(x, "rd-sm-top") || hasCls(x, "rd-key") || hasCls(x, "chart")
        || hasCls(x, "rd-is-ctop") || hasCls(x, "rd-is-chead") || hasCls(x, "rd-is-csub")) continue;
      walk(x);
    }
  };
  walk(sec);
  return { title, meta, blocks: out };
}

/* the section element a panel renders (the rd-sec at its root) */
export const sectionOf = (tree) => findSelf(tree, (t) => t.tag === "section" || hasCls(t, "rd-sec")) || tree;
/* every section a view renders (Past cycles is four), outermost first */
export function sectionsOf(tree) {
  const out = [];
  const walk = (t) => {
    if (!t || typeof t !== "object") return;
    if (Array.isArray(t)) { t.forEach(walk); return; }
    if (t.tag === "section" || hasCls(t, "rd-sec")) { out.push(t); return; }
    if (t.tag !== "$chart") walk(t.kids);
  };
  walk(tree);
  return out;
}
