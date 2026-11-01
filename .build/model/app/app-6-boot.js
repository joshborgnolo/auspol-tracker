/* app-6-boot.js: load the official runs and the page's data, draw everything, wire the mode switch,
   restore a shared scenario from the address, and redraw the charts when the page changes width. */
(async function boot() {
  try {
    const [nowcast, forecast, inputs, evidence] = await Promise.all([getJSON(URLS.nowcast), getJSON(URLS.forecast), getJSON(URLS.inputs), getJSON(URLS.evidence)]);
    Object.assign(STATE, { res: { nowcast, forecast }, inputs, evidence });
  } catch (e) {
    const n = $("#md-note"); if (n) n.insertAdjacentHTML("beforeend", ` · <span style="color:var(--m-alp)">the page's data could not load (${esc(e.message)}); the head above is the official run</span>`);
    return;
  }
  const q = readHash();
  STATE.mode = q.mode === "forecast" ? "forecast" : "nowcast";
  for (const b of $$(".md-modes .rd-tab")) b.setAttribute("aria-selected", String(b.dataset.mode === STATE.mode));
  if (STATE.mode !== "nowcast") renderHead();
  renderDist(); renderSeats(); renderEvidence();
  $(".md-modes").addEventListener("click", (e) => { const b = e.target.closest("[data-mode]"); if (b && b.dataset.mode !== STATE.mode) setMode(b.dataset.mode); });
  $(".md-modes").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const next = STATE.mode === "nowcast" ? "forecast" : "nowcast"; setMode(next); $(`#mode-${next}`).focus();
  });
  $(".md-jur").addEventListener("click", (e) => { const b = e.target.closest("[data-jur]"); if (b) setJur(b.dataset.jur); });
  document.addEventListener("click", (e) => { const a = e.target.closest("[data-jur-go]"); if (!a) return; e.preventDefault(); setJur(a.dataset.jurGo).then(() => $(a.getAttribute("href")).scrollIntoView({ block: "start" })); });
  if (q.j === "vic") await setJur("vic");
  if (EX.applyHash(q)) $("#explore").scrollIntoView({ block: "start" }); else if (STATE.jur !== "vic") EX.init();
  let lastW = innerWidth;
  addEventListener("resize", debounce(() => { if (Math.abs(innerWidth - lastW) < 8) return; lastW = innerWidth; renderDist(); const n = $("#fig-noise"), c = $("#fig-cal"); if (n && c) { renderEvidence(); } }, 150));
  window.__model = { STATE, EX };
})();
