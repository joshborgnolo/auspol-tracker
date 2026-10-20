import Cocoa
import WebKit

/* flow-chart-wk — WKWebView (Safari engine) phone-width probe of the
   flows-explained chart slot. argv: [url] [width] [height] */

let URL_ARG = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "https://auspoltracker.com/flows-explained/"
let W: CGFloat = CommandLine.arguments.count > 2 ? CGFloat(Double(CommandLine.arguments[2]) ?? 390) : 390
let H: CGFloat = CommandLine.arguments.count > 3 ? CGFloat(Double(CommandLine.arguments[3]) ?? 844) : 844

let PROBE_JS = #"""
(async()=>{
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const t0=Date.now();
 let slot=null, rslot=null;
 for(let i=0;i<60;i++){ slot=document.getElementById('ex-fig-flow');
  const rs=document.querySelector('section.rd-explained');
  rslot=rs?rs.querySelector('.ex-slot'):null;
  if(rslot&&rslot.childElementCount>0) break; await sleep(250); }
 const chips=document.querySelector('.ex-flow-chips');
 const rsec=document.querySelector('section.rd-explained');
 rslot=rsec?rsec.querySelector('.ex-slot'):null;
 const svg=rslot?rslot.querySelector('svg'):null;
 const chain=[]; let el=rslot;
 while(el&&el!==document.body){const cs=getComputedStyle(el);
  chain.push({tag:el.tagName,id:el.id||null,cls:String(el.className&&el.className.baseVal!==undefined?el.className.baseVal:el.className).slice(0,60),display:cs.display,vis:cs.visibility,op:cs.opacity,h:Math.round(el.getBoundingClientRect().height)});
  el=el.parentElement;}
 const out={
  ua:navigator.userAgent,
  waitedMs:Date.now()-t0,
  vw:window.innerWidth, dpr:window.devicePixelRatio,
  docScrollW:document.documentElement.scrollWidth,
  slotExists:!!slot,
  staticSlotChildren:slot?slot.childElementCount:-1,
  staticSlotDisplay:slot?getComputedStyle(slot).display:null,
  rslotChildren:rslot?rslot.childElementCount:-1,
  rslotInStaticArticle:!!(rslot&&rslot.closest('article.static-summary')),
  rslotRect:rslot?rslot.getBoundingClientRect().toJSON():null,
  chipsRect:chips?chips.getBoundingClientRect().toJSON():null,
  chipLabels:chips?[...chips.querySelectorAll('button')].map(b=>b.textContent.trim()):null,
  svgRect:svg?svg.getBoundingClientRect().toJSON():null,
  svgPaths:svg?svg.querySelectorAll('path').length:-1,
  ancestorChain:chain,
  flowHistoryKeys:(window.AUSPOL&&window.AUSPOL.flowHistory)?Object.keys(window.AUSPOL.flowHistory):null,
  apPresent:typeof window.AP!=='undefined',
  fullyVisible:chain.length>0&&chain.every(a=>a.display!=='none'&&a.op!=='0'&&a.vis!=='hidden')
 };
 window.webkit.messageHandlers.probe.postMessage(JSON.stringify(out));
})(),0
"""#

final class App: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler {
  var window: NSWindow!
  var webView: WKWebView!

  func applicationDidFinishLaunching(_ note: Notification) {
    window = NSWindow(contentRect: NSRect(x: 60, y: 60, width: W, height: H),
                      styleMask: [.titled], backing: .buffered, defer: false)
    window.title = "flow-chart-wk"
    let cfg = WKWebViewConfiguration()
    cfg.userContentController.add(self, name: "probe")
    webView = WKWebView(frame: window.contentView!.bounds, configuration: cfg)
    webView.autoresizingMask = [.width, .height]
    window.contentView!.addSubview(webView)
    webView.navigationDelegate = self
    window.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
    webView.load(URLRequest(url: URL(string: URL_ARG)!))
    DispatchQueue.main.asyncAfter(deadline: .now() + 75) {
      print("WKPROBE_TIMEOUT")
      exit(2)
    }
  }

  func webView(_ wv: WKWebView, didFinish nav: WKNavigation!) {
    DispatchQueue.main.asyncAfter(deadline: .now() + 4.0) {
      wv.evaluateJavaScript(PROBE_JS) { _, err in
        if let err = err { print("WKPROBE_JSERR \(err)") }
      }
    }
  }

  func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
    print("WKPROBE_RESULT_BEGIN")
    print(message.body)
    print("WKPROBE_RESULT_END")
    exit(0)
  }
}

let app = NSApplication.shared
let delegate = App()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
