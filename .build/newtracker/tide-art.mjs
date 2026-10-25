/* tide-art.mjs – the tide band's weekly vote-weighted recolour.

   The page-bottom band's thirty wave traces are re-coloured by chance at
   BUILD time, each trace's party drawn against the CURRENT primary-vote
   shares (gen-data's latest.primary): at ALP 26.7 every trace has a 26.7%
   chance of the washed-Labor stroke. The draw is seeded by the
   Australia/Sydney ISO week, so the shuffle re-rolls on the first build
   after Monday 12am and is stable across rebuilds within a week, while the
   proportions track the live primary vote – a mid-week wave can (rarely)
   recolour a boundary trace. That is the intended semantics (user call
   2026-10-25: shuffle weekly, weights live).

   Geometry and the washed palette are NOT re-derived here: they are read
   from the template's committed --tile-art/--tile-art-dark data-URIs (the
   single home of both), recoloured, and spliced back into the page the
   build is assembling. The satellites' /assets/tile-art*.svg carry the
   same art as FILES – the decoded blobs plus a trailing newline – which
   the federal build rewrites from the same draw.

   Drift contract: the extraction asserts the committed art's shape – 30
   traces, identical light/dark geometry, five distinct strokes laid out
   as base grey + a four-tint cycle on every fifth trace. A hand-edit of
   the art trips the build loudly rather than recolouring something
   unrecognised. */

const PARTIES = ["alp", "lnp", "grn", "onp", "oth"];
const TRACES = 30;

/* Pull the two committed art blobs out of the template html and assert the
   shape everything downstream assumes. Returns the shared shell (head/tail/
   the 30 path `d`s) and the per-theme palette as { alp, lnp, grn, onp, oth },
   read positionally from the base+tint layout. */
export function extractTide(html) {
  const blob = (v) => {
    const re = new RegExp(
      v.replace(/-/g, "\\$&") + ": url\\(\"data:image/svg\\+xml,(.*?)\"\\);",
      "g",
    );
    const all = html.match(re);
    if (!all || all.length !== 1)
      throw new Error(`tide-art: ${v} found ${all ? all.length : 0} time(s), expected exactly 1`);
    const enc = all[0].match(re.source)[1];
    return { enc, svg: decodeURIComponent(enc) };
  };
  const parse = (svg) => {
    const m = svg.match(/^(?<head><svg[^>]*><g[^>]*>)(?<mid>.*?)(?<tail><\/g><\/svg>)$/);
    if (!m) throw new Error("tide-art: svg shell drifted (expected <svg…><g…>…</g></svg>)");
    const els = [...m.groups.mid.matchAll(/<path d='([^']+)' stroke='(#[0-9a-f]{6})'\/>/g)];
    if (els.length !== TRACES)
      throw new Error(`tide-art: expected ${TRACES} traces, got ${els.length}`);
    if (els.map((e) => e[0]).join("") !== m.groups.mid)
      throw new Error("tide-art: unexpected svg content between the traces");
    return {
      head: m.groups.head, tail: m.groups.tail,
      ds: els.map((e) => e[1]), strokes: els.map((e) => e[2]),
    };
  };
  const light = blob("--tile-art"), dark = blob("--tile-art-dark");
  const L = parse(light.svg), D = parse(dark.svg);
  if (L.head !== D.head || L.tail !== D.tail || L.ds.join("") !== D.ds.join(""))
    throw new Error("tide-art: light and dark geometry drifted apart");
  /* the encoder is plain encodeURIComponent: the committed blobs keep '
   * raw, and this round-trip assert proves it stays so */
  if (encodeURIComponent(light.svg) !== light.enc || encodeURIComponent(dark.svg) !== dark.enc)
    throw new Error("tide-art: encodeURIComponent no longer reproduces the committed blobs");
  const paletteOf = (strokes) => {
    const TINTED = [4, 9, 14, 19, 24, 29];   // every 5th trace, cycle red/blue/green/orange
    const base = strokes.filter((_, i) => !TINTED.includes(i));
    if (new Set(base).size !== 1)
      throw new Error("tide-art: the base-grey traces are no longer one colour");
    const pal = { oth: base[0], alp: strokes[4], lnp: strokes[9], grn: strokes[14], onp: strokes[19] };
    if (strokes[24] !== strokes[4] || strokes[29] !== strokes[9])
      throw new Error("tide-art: the tint cycle no longer repeats on traces 24/29");
    if (new Set(Object.values(pal)).size !== 5)
      throw new Error("tide-art: the five party strokes are no longer distinct");
    return pal;
  };
  return {
    head: L.head, tail: L.tail, ds: L.ds,
    light: paletteOf(L.strokes), dark: paletteOf(D.strokes),
  };
}

/* The re-shuffle clock: ISO-8601 week of `now` as seen in Australia/Sydney
   (Mon-start; the band re-rolls on the first build after Monday 12am),
   expressed as isoYear*100 + isoWeek so every week gets one unique seed.
   Computed on the Sydney civil date in UTC, so GitHub's UTC runners and the
   laptop agree. */
export function isoWeekSeed(now = new Date(), timeZone = "Australia/Sydney") {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(now).map(({ type, value }) => [type, value]),
  );
  const d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day, 12));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);   // this week's Thursday
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4, 12));
  firstThu.setUTCDate(firstThu.getUTCDate() - ((firstThu.getUTCDay() + 6) % 7) + 3);
  const week = 1 + Math.round((d - firstThu) / (7 * 864e5));
  return d.getUTCFullYear() * 100 + week;
}

function mulberry32(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Draw TRACES party ids against `weights` (latest.primary-shaped).
   Absent/null/non-finite/non-positive shares count as 0 (a house folded
   into "others", an empty estimator window) and the rest renormalise.
   Returns null when nothing at all is votable – the build then keeps the
   template's committed art. Deterministic in (weights, seed). */
export function assignLines(weights, seed) {
  const w = PARTIES.map((k) => {
    const v = weights ? weights[k] : null;
    return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
  });
  const total = w.reduce((s, x) => s + x, 0);
  if (!(total > 0)) return null;
  const cum = [];
  let acc = 0;
  for (const x of w) cum.push((acc += x / total));
  cum[PARTIES.length - 1] = 1;       // the last interval closes exactly at 1
  const rnd = mulberry32(seed);
  const out = [];
  for (let i = 0; i < TRACES; i++) {
    const u = rnd();
    let p = 0;
    while (p < PARTIES.length - 1 && u >= cum[p]) p++;
    out.push(PARTIES[p]);
  }
  return out;
}

/* Recolour the two art blobs in `html` to this week's draw. Returns
   { html, svgLight, svgDark } — the svgs decoded (the /assets files'
   contents). On a null draw the input html is returned untouched and the
   svgs are null. */
export function rewriteTideArt(html, weights, now = new Date()) {
  const lines = assignLines(weights, isoWeekSeed(now));
  if (!lines) return { html, svgLight: null, svgDark: null };
  const t = extractTide(html);
  const recolour = (palette) =>
    t.head + t.ds.map((d, i) => `<path d='${d}' stroke='${palette[lines[i]]}'/>`).join("") + t.tail;
  const svgLight = recolour(t.light), svgDark = recolour(t.dark);
  const out = { html, svgLight, svgDark };
  for (const [v, svg] of [["--tile-art", svgLight], ["--tile-art-dark", svgDark]]) {
    const re = new RegExp(
      `(${v.replace(/-/g, "\\$&")}: url\\(")data:image/svg\\+xml,.*?("\\);)`,
    );
    out.html = out.html.replace(re, `$1data:image/svg+xml,${encodeURIComponent(svg)}$2`);
  }
  return out;
}
