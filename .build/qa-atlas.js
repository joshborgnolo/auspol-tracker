// qa-atlas.js — verifies the atlas page renders without errors and its
// chart/table actually populate. Dev-only; not part of the shipped build.
// Requires Chrome plus `ws` (npm install --no-save ws, run from .build/).
// Run from the repo root (serve first so /assets/... resolves):
//   python3 -m http.server 8931 &
//   node .build/qa-atlas.js "http://127.0.0.1:8931/atlas/index.html"
// Exits non-zero on any console/page error, or if key elements are empty.
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const url = process.argv[2];
if (!url) { console.error("usage: node qa-atlas.js <url>"); process.exit(2); }

const CDP_PORT = 9223;
const { spawn } = require("child_process");
const http = require("http");

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${CDP_PORT}`,
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--user-data-dir=/tmp/atlas-cdp-profile", "about:blank",
], { stdio: "ignore" });

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const getJson = (path) => new Promise((res, rej) => {
  http.get({ host: "127.0.0.1", port: CDP_PORT, path }, (r) => {
    let b = ""; r.on("data", c => b += c); r.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
  }).on("error", rej);
});

(async () => {
  let targets = null;
  for (let i = 0; i < 40; i++) { try { targets = await getJson("/json"); break; } catch { await wait(250); } }
  if (!targets) throw new Error("CDP never came up");
  const page = targets.find(t => t.type === "page");
  if (!page) throw new Error("no page target");

  const ws = await connect(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const errors = [];
  const send = (method, params = {}) => new Promise((resolve) => {
    const msgId = ++id; pending.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
  ws.on("message", (data) => {
    const m = JSON.parse(data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); return; }
    if (m.method === "Runtime.exceptionThrown") errors.push("PAGE_EXCEPTION " + JSON.stringify(m.params.exceptionDetails).slice(0, 300));
    if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error"))
      errors.push("CONSOLE " + m.params.args.map(a => a.value || a.description || "").join(" ").slice(0, 300));
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error")
      errors.push("LOG " + m.params.entry.text.slice(0, 300));
  });
  function connect(webSocketDebuggerUrl) {
    return new Promise((resolve, reject) => {
      const s = new (require("ws"))(webSocketDebuggerUrl, { perMessageDeflate: false });
      s.on("open", () => resolve(s)); s.on("error", reject);
    });
  }
  await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
  await send("Page.navigate", { url });
  await wait(2600);

  const evalJs = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    return r && r.result ? r.result.value : undefined;
  };

  const checks = await evalJs(`(() => {
    const q = (s) => document.querySelector(s);
    const qa = (s) => [...document.querySelectorAll(s)];
    const svg = q('#chart');
    return {
      seatOptions: qa('#seat option').length,
      optgroups: qa('#seat optgroup').length,
      stateOptions: qa('#state-filter option').length,
      tableRows: qa('#seats tbody tr').length,
      chips: qa('#seats .chip').length,
      svgCircles: svg ? qa('#chart circle').length : 0,
      svgPaths: svg ? qa('#chart path').length : 0,
      svgTexts: svg ? qa('#chart text').length : 0,
      svgViewBox: svg ? svg.getAttribute('viewBox') : null,
      legendKeys: qa('#legend .key').length,
      title: q('#chart-title') ? q('#chart-title').textContent : null,
      warringahDefault: q('#seat').value,
    };
  })()`);

  const interact = await evalJs(`(() => {
    const out = {};
    const q = (s) => document.querySelector(s);
    const sel = q('#seat');
    const setSel = (v) => { sel.value = v; sel.dispatchEvent(new Event('change', {bubbles:true})); };
    q('#m-swing').click();
    out.swingTitle = q('#chart-title').textContent;
    out.swingCircles = document.querySelectorAll('#chart circle').length;
    out.swingDashed = [...document.querySelectorAll('#chart path')].filter(p => p.getAttribute('stroke-dasharray')).length;
    setSel('div:wills');
    out.willsDashed = [...document.querySelectorAll('#chart path')].filter(p => p.getAttribute('stroke-dasharray')).length;
    setSel('div:warringah');
    q('#m-margin').click();
    setSel('div:clark');  out.clarkTitle = q('#chart-title').textContent; out.clarkLegend = document.querySelectorAll('#legend .key').length;
    setSel('div:fenner'); out.fennerTitle = q('#chart-title').textContent;
    setSel('state:vic');  out.stateTitle = q('#chart-title').textContent;
    setSel('div:brisbane'); out.brisbaneNcNoteVisible = !document.getElementById('nc-note').hidden;
    const sq = document.getElementById('seat-search'); sq.value = 'war'; sq.dispatchEvent(new Event('input', {bubbles:true}));
    out.searchWarRows = document.querySelectorAll('#seats tbody tr').length;
    sq.value = ''; sq.dispatchEvent(new Event('input', {bubbles:true}));
    const sf = document.getElementById('state-filter'); sf.value = 'QLD'; sf.dispatchEvent(new Event('change', {bubbles:true}));
    out.qldRows = document.querySelectorAll('#seats tbody tr').length;
    const ths = [...document.querySelectorAll('#seats thead th')];
    ths.find(t => t.dataset.k === 'margin').click();
    const firstMarginCell = document.querySelector('#seats tbody tr td:nth-child(4)');
    out.sortedFirstMargin = firstMarginCell ? firstMarginCell.textContent : null;
    return out;
  })()`);

  console.log(JSON.stringify({ checks, interact, errors: errors.slice(0, 12) }, null, 1));
  try { ws.close(); } catch {}
  chrome.kill();
  const fail = errors.length > 0
    || !checks || checks.svgCircles < 5 || checks.tableRows < 100 || checks.seatOptions < 150 || checks.svgPaths < 3
    || !interact || interact.willsDashed < 1;
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("checker error:", e.message); chrome.kill(); process.exit(2); });
