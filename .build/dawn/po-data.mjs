/* /dawn/public-opinion/: the site's Public opinion page in Dawn's dress.

   The catalogue under the sunrise is the site's own code, not a copy of it:
   rd-public-opinion.jsx is compiled here with the vendored Babel, its styles
   are lifted from newtracker/template.html by selector, and it reads the
   sidecar gen-data writes (oneoffs-source.json, public-opinion.mjs's
   figures and margin rules). A new question, chart kind or rule on the
   site's page reaches this one on the next build. The one piece swapped out
   is TrendChart: the template draws the trackers with Dawn's own chart.

   Here too: heroSlides, the sunrise's findings – each topic's sentence over
   the figures of the block that sentence reads (finding.of). */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const month = (iso) => MON[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/* as many rows as the sunrise holds on a phone */
export const HERO_ROWS = 6;

export function heroSlides(src) {
  const house = (h) => (src.houses[h] ? src.houses[h].short : h);
  return src.topics.filter((t) => t.finding).map((t) => {
    const b = t.blocks.find((x) => x.id === t.finding.of) || t.blocks[0];
    const base = { id: t.id, topic: t.short, text: t.finding.text, meta: t.finding.meta };
    if (b.kind === "split") return { ...base, kind: "two", of: b.title, names: b.names, a: b.a, b: b.b };
    if (b.kind === "rank") return { ...base, kind: "list", of: b.title, rows: b.rows.slice(0, 4).map((r) => ({ label: r.label, v: r.v })) };
    if (b.kind === "tracker" && b.form === "longrun") {
      const year = Math.max(...b.panels.map((p) => p.points.at(-1).year));
      return { ...base, kind: "list", of: b.title + ", " + year, rows: b.panels.filter((p) => p.points.at(-1).year === year)
        .map((p) => ({ label: p.label, v: p.points.at(-1).v })).sort((x, y) => y.v - x.v).slice(0, HERO_ROWS) };
    }
    /* a tracker's latest from each pollster, newest first, or a comparison's polls as the site orders them */
    const rows = b.kind === "tracker"
      ? b.panels.map((p) => ({ h: p.house, q: p.points.at(-1) })).sort((x, y) => y.q.x - x.q.x)
        .map(({ h, q }) => ({ label: house(h), when: month(q.field.end), a: q.a, b: q.b }))
      : b.rows.map((r) => ({ label: r.label || house(r.src.house), when: month(r.src.field.end), a: r.a, b: r.b }));
    const names = b.names || [b.legend[0].label, b.legend.at(-1).label];
    return { ...base, kind: "pairs", of: b.title, names: names.slice(0, 2).map(cap), rows: rows.slice(0, HERO_ROWS), more: Math.max(0, rows.length - HERO_ROWS) };
  });
}

/* the newest publication behind any question on the page */
export function newestPublished(src) {
  let best = "";
  const see = (s) => { if (s && s.pub && s.pub.slice(0, 10) > best) best = s.pub.slice(0, 10); };
  for (const t of src.topics) {
    for (const b of t.blocks) { see(b.src); (b.rows || []).forEach((r) => see(r.src)); (b.panels || []).forEach((p) => p.points.forEach(see)); }
    for (const q of t.more) q.srcs.forEach(see);
  }
  return best || null;
}

/* the style rules the site's page wears: every rule of template.html's sheets
   whose selector names .pubop (the static article's .pubop-ss aside), with
   its @media or @supports wrapper kept round it */
export function pubopCss(templateHtml) {
  const sheets = [...templateHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
  const wanted = (sel) => /\.pubop(?!-ss)/.test(sel);
  const walk = (css) => {
    let out = "", at = 0;
    while (at < css.length) {
      const open = css.indexOf("{", at);
      if (open < 0) break;
      let depth = 1, i = open + 1;
      for (; i < css.length && depth; i++) depth += css[i] === "{" ? 1 : css[i] === "}" ? -1 : 0;
      const head = css.slice(at, open).replace(/^[\s\S]*;/, "").trim(), body = css.slice(open + 1, i - 1);
      if (/^@(media|supports)\b/.test(head)) { const inner = walk(body); if (inner) out += head + "{\n" + inner + "}\n"; }
      else if (!head.startsWith("@") && wanted(head)) out += head + "{" + body.trim() + "}\n";
      at = i;
    }
    return out;
  };
  return walk(sheets);
}

/* React, the two row helpers the component borrows from rd.jsx, and the
   component itself, as one script */
export function pubopApp(newtracker) {
  const Babel = require(path.join(newtracker, "vendor", "babel-standalone.js"));
  const read = (...f) => fs.readFileSync(path.join(newtracker, ...f), "utf8");
  const jsx = Babel.transform(read("assets", "rd-public-opinion.jsx"), { presets: [["react", { runtime: "classic" }]], babelrc: false, configFile: false, comments: false, compact: false }).code;
  const rd = read("assets", "rd.jsx");
  const helper = (name) => {
    const m = rd.match(new RegExp("\\nfunction " + name + "\\([\\s\\S]*?\\n}\\n"));
    if (!m) throw new Error("dawn: rd.jsx no longer defines " + name);
    return m[0].trim();
  };
  /* the component is wrapped so its names stay its own: the page's script
     and Dawn's chart share the page's globals */
  return [read("vendor", "react.production.min.js"), read("vendor", "react-dom.production.min.js"),
    "(function(){\n" + helper("rdTabFocus") + "\n" + helper("rdTabsKey") + "\n" + jsx + "\n})();"].join("\n;\n") + "\n";
}
