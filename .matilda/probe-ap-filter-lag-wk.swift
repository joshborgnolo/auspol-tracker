import Cocoa
import WebKit

/* probe-ap-filter-lag-wk — WebKit harness for the All-polls filter-toggle
   lag report (2026-10-09: press Fox & Hedgehog, ~2s before the same control
   can be pressed again; Chromium probes show only ~100ms even at 4x CPU
   throttle). WKWebView shares Safari.app's WebKit2 engine. Loads the local
   static server (must be running: node .matilda/diag-server.mjs serves
   :8735) at the allpolls hash, then measures the main-thread block around
   each filter pick with a rAF heartbeat and a 0ms-timeout yield check.
   LONGTASK API does not exist in WebKit, so the heartbeat is the channel. */

let PROBE_JS = #"""
(async()=>{
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const post=o=>window.webkit.messageHandlers.probe.postMessage(JSON.stringify(o));
 post({boot:1,ready:document.readyState,sel:!!document.querySelector('.rd-ap-sel-house'),
        ap:!!(window.AP&&window.AP.rd),auspol:!!window.AUSPOL});
 await sleep(800);
 const pick=async(selCss,value)=>{
   const sel=document.querySelector(selCss);
   if(!sel)return{err:'no '+selCss};
   const opt=[...sel.options].find(o=>o.value===value);
   if(!opt)return{err:'no opt '+value};
   // heartbeat: rAF chain recording frame gaps
   let beats=[],last=performance.now(),run=true;
   const raf=t=>{const d=t-last; last=t; if(d>40)beats.push(Math.round(d)); if(run)requestAnimationFrame(raf);};
   requestAnimationFrame(raf);
   const t0=performance.now();
   const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;
   setter.call(sel,value);
   sel.dispatchEvent(new Event('change',{bubbles:true}));
   const free=await new Promise(r=>setTimeout(()=>r(performance.now()),0));
   await new Promise(r=>setTimeout(r,1500));
   run=false;
   const t1=performance.now();
   return{syncYieldMs:Math.round(free-t0),gaps:beats.slice(),total:Math.round(t1-t0)};
 };
 const out=[];
 out.push(await pick('.rd-ap-sel-house','Fox & Hedgehog'));
 await sleep(400);
 out.push(await pick('.rd-ap-sel-house','Fox & Hedgehog'));
 await sleep(400);
 out.push(await pick('.rd-ap-sel-time','6'));
 await sleep(400);
 out.push(await pick('.rd-ap-sel-inc','aprv'));
 await sleep(400);
 out.push(await pick('.rd-ap-sel-inc','__clear'));
 post({final:1,picks:out,ua:navigator.userAgent.slice(0,80)});
})(),0
"""#

final class App: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler {
  var window: NSWindow!
  var webView: WKWebView!

  func applicationDidFinishLaunching(_ note: Notification) {
    window = NSWindow(contentRect: NSRect(x: 60, y: 60, width: 1400, height: 900),
                      styleMask: [.titled], backing: .buffered, defer: false)
    window.title = "ap-filter-lag-wk"
    let cfg = WKWebViewConfiguration()
    cfg.userContentController.add(self, name: "probe")
    webView = WKWebView(frame: window.contentView!.bounds, configuration: cfg)
    webView.autoresizingMask = [.width, .height]
    window.contentView!.addSubview(webView)
    webView.navigationDelegate = self
    window.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
    webView.load(URLRequest(url: URL(string: "http://localhost:8735/index.html#allpolls")!))
    DispatchQueue.main.asyncAfter(deadline: .now() + 60) {
      print("WKPROBE_TIMEOUT")
      exit(2)
    }
  }

  func webView(_ wv: WKWebView, didFinish nav: WKNavigation!) {
    DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
      wv.evaluateJavaScript(PROBE_JS) { _, err in
        if let err = err { print("WKPROBE_JSERR \(err)") }
      }
    }
  }

  func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
    let body = String(describing: message.body)
    print("WKPROBE_MSG \(body)")
    if body.contains("\"final\":1") { exit(0) }
  }
}

let app = NSApplication.shared
let delegate = App()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
