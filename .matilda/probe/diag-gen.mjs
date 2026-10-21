/* diag-gen.mjs — fetch the live index.html and write an instrumented copy
   for the crash diag page. The injected script is PLAIN (no deps), logs a
   timeline (select changes, resizes, visibility), captures window errors,
   unhandled rejections and console.error (ViewBoundary logs "view render
   failed:" there), beacons everything to the diag server, and shows a red
   on-screen overlay with the captures once a boundary appears.
   Run: node .matilda/probe/diag-gen.mjs  →  writes .matilda/probe/diag-index.html */
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = process.env.DIAG_SRC || "https://auspoltracker.com/";
const BEACON = "/diag-beacon"; /* proxied server-side; relative keeps phone+laptop working */

const INJECT = `
<script id="diag-inject">
/* auspol crash diag — appended instrument, not site code */
(function () {
  "use strict";
  var sid = Math.random().toString(36).slice(2, 10);
  var t0 = Date.now();
  var buf = [];
  var shown = false;
  function ts() { return ((Date.now() - t0) / 1000).toFixed(1) + "s"; }
  function entry(kind, data) {
    return { sid: sid, ua: navigator.userAgent, at: new Date().toISOString(), rel: ts(), kind: kind, data: data };
  }
  function render() {
    var lines = ["DIAG OVERLAY — session " + sid, "UA: " + navigator.userAgent, ""];
    for (var i = 0; i < buf.length; i++) {
      var r = buf[i];
      var d = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
      if (d && d.length > 1500) d = d.slice(0, 1500) + " …[truncated]";
      lines.push("[" + r.rel + "] " + r.kind + ": " + d);
    }
    return lines.join("\\n");
  }
  var overlay = null;
  function showOverlay() {
    shown = true;
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "diag-overlay";
      overlay.setAttribute("style",
        "position:fixed;left:0;right:0;bottom:0;max-height:60vh;overflow:auto;" +
        "background:#fff;color:#8a0018;border-top:3px solid #8a0018;z-index:2147483647;" +
        "font:12px/1.45 Menlo,monospace;padding:10px 12px;white-space:pre-wrap;word-break:break-all;");
      (document.body || document.documentElement).appendChild(overlay);
    }
    overlay.textContent = render();
  }
  function push(kind, data, loud) {
    var rec = entry(kind, data);
    buf.push(rec);
    try {
      var b = new Blob([JSON.stringify(rec) + "\\n"], { type: "text/plain" });
      navigator.sendBeacon("${BEACON}", b);
    } catch (e) {}
    if (loud) showOverlay();
  }
  /* ViewBoundary logs console.error("view render failed:", err) — that's the prize */
  var ce = console.error;
  console.error = function () {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) {
      var a = arguments[i];
      try {
        parts.push(typeof a === "string" ? a : ((a && a.stack) || (a && a.message) || JSON.stringify(a)));
      } catch (e) { parts.push(String(a)); }
    }
    var joined = parts.join(" | ").slice(0, 4000);
    push("console.error", joined, /view render failed/i.test(joined));
    return ce.apply(console, arguments);
  };
  window.addEventListener("error", function (e) {
    var st = (e.error && e.error.stack) || "";
    push("window.error",
      { msg: String(e.message || ""), src: String(e.filename || "").split("/").pop(), line: e.lineno || 0, col: e.colno || 0, stack: String(st).slice(0, 3500) },
      true);
  }, true);
  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    push("unhandledrejection", String((r && r.stack) || (r && r.message) || r).slice(0, 3500), true);
  });
  /* interaction timeline */
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t && t.tagName === "SELECT") {
      push("select", { label: t.getAttribute("aria-label") || t.name || "", value: t.value });
    }
  }, true);
  document.addEventListener("click", function (e) {
    var t = e.target;
    var tx = t && (t.textContent || "");
    if (tx && /try again/i.test(tx)) push("try-again-click", tx.trim().slice(0, 60));
  }, true);
  var rzT = 0;
  window.addEventListener("resize", function () {
    var n = Date.now();
    if (n - rzT < 500) return;
    rzT = n;
    push("resize", window.innerWidth + "x" + window.innerHeight);
  });
  document.addEventListener("visibilitychange", function () {
    push("visibility", document.visibilityState);
  });
  /* boundary watcher: the exact fallback copy */
  var boundarySeen = false;
  var mo = new MutationObserver(function () {
    if (boundarySeen) return;
    var t = (document.body && document.body.innerText) || "";
    if (t.indexOf("hit an error") !== -1) {
      boundarySeen = true;
      /* find which view fell: nearest heading above the boundary text */
      var where = "";
      var els = document.querySelectorAll("h1,h2,h3,[class*=eyebrow],[class*=Eyebrow]");
      for (var i = 0; i < els.length; i++) { where = els[i].textContent.trim().slice(0, 90); }
      push("BOUNDARY", "view error boundary displayed at " + ts() + (where ? " (last heading above: " + where + ")" : ""), true);
    }
  });
  (document.documentElement || document).addEventListener
    ? mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true })
    : null;
  push("diag-ready", "instrument active");
})();
</script>
`;

console.log("fetching", SRC);
const res = await fetch(SRC, { headers: { "user-agent": "diag-gen" } });
if (!res.ok) throw new Error("fetch " + SRC + " -> " + res.status);
let html = await res.text();

/* syntax-check the injection before shipping it to the user's browser */
try { new Function(INJECT.replace(/<\/?script[^>]*>/g, "")); }
catch (e) { console.error("INJECTION SYNTAX FAIL:", e.message); process.exit(2); }

const marker = "</body>";
const at = html.lastIndexOf(marker);
if (at === -1) { console.error("no </body> in live html"); process.exit(2); }
html = html.slice(0, at) + INJECT + "\n" + html.slice(at);

const out = join(here, "diag-index.html");
writeFileSync(out, html);
console.log("wrote", out, html.length, "bytes; beacon =", BEACON);
