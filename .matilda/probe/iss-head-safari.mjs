// WebKit reproduction probe: drive real Safari via safaridriver's
// WebDriver REST and measure the Issues facet column-head geometry.
// Same assertions as iss-head-overlap.mjs (caption vs ticks vs Best-on-it).
import { fileURLToPath } from "node:url";

const WD = "http://127.0.0.1:4444";
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PAGE = process.env.LIVE ? "https://auspoltracker.com/" : `file://${ROOT}/index.html`;

const j = (r) => r.json();
const post = (path, body) => fetch(WD + path, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body || {}),
}).then(j);

const MEASURE = `
const r = (n) => { if (!n) return null; const b = n.getBoundingClientRect();
  return { x:+b.x.toFixed(1), y:+b.y.toFixed(1), w:+b.width.toFixed(1), h:+b.height.toFixed(1) }; };
const pheadEl = document.querySelector(".rd-ap-phead");
const hrowEl = document.querySelector(".rd-ap-hrow");
const head = (pheadEl && getComputedStyle(pheadEl).display !== "none") ? pheadEl : hrowEl;
const hpic = head && head.querySelector(".rd-ap-hpic");
const cap = hpic && hpic.querySelector(".rd-ap-cap");
const tks = hpic ? [...hpic.querySelectorAll(".rd-ap-tk")] : [];
const ths = head ? [...head.querySelectorAll(".rd-ap-th")] : [];
const best = ths.find((n) => /Party in first/i.test(n.textContent));
const st = hpic ? getComputedStyle(hpic) : {};
return {
  which: head && head.classList.contains("rd-ap-phead") ? "phead" : "hrow",
  hpic: r(hpic), cap: r(cap),
  tk0: r(tks[0]), tkLast: r(tks[tks.length-1]), nTks: tks.length,
  best: r(best),
  csHpic: { pos: st.position, disp: st.display, alignSelf: st.alignSelf, minH: st.minHeight },
  hrowH: hrowEl ? r(hrowEl).h : null,
  ua: navigator.userAgent,
};`;

const CLICK_ISSUES = `
const t = [...document.querySelectorAll(".rd-ap-tabs button")].find((n) => /^Issues$/.test(n.textContent.trim()));
if (!t) throw new Error("facet tab Issues not found");
t.click();
true;`;

const inter = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { value } = await post("/session", { capabilities: { alwaysMatch: { browserName: "safari" } } });
const sid = value.sessionId;
const exec = (script) => post(`/session/${sid}/execute/sync`, { script, args: [] }).then((x) => x.value);

try {
  for (const [w, h] of [[1440, 900], [1000, 800], [820, 800], [390, 844]]) {
    await post(`/session/${sid}/window/rect`, { width: w, height: h });
    await post(`/session/${sid}/url`, { url: `${PAGE}#allpolls` });
    await sleep(2500);
    const ok = await exec(`return !!document.querySelector(".rd-ap-tabs button");`);
    if (!ok) { console.log(`== ${w}x${h}: table tabs never mounted`); continue; }
    await exec(`(() => { ${CLICK_ISSUES.replace(/^/m, "")} })()`);
    await sleep(900);
    const m = await exec(`(() => { return (function(){ ${MEASURE} })(); })()`);
    console.log(`\n== ${w}x${h} (${m.which}, hrow ${m.hrowH}px) ==`);
    console.log(" hpic:", JSON.stringify(m.hpic), JSON.stringify(m.csHpic));
    console.log(" cap :", JSON.stringify(m.cap));
    console.log(" tk0 :", JSON.stringify(m.tk0), "tkLast:", JSON.stringify(m.tkLast), "nTks:", m.nTks);
    console.log(" best:", JSON.stringify(m.best));
    console.log(" cap∩tk0:", inter(m.cap, m.tk0), " cap∩tkLast:", inter(m.cap, m.tkLast), " cap∩best:", inter(m.cap, m.best));
  }
} finally {
  await fetch(`${WD}/session/${sid}`, { method: "DELETE" }).catch(() => {});
}
