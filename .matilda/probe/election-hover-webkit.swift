import Cocoa
import WebKit

let PROBE_JS = #"""
(async()=>{
 const sleep=ms=>new Promise(r=>setTimeout(r,ms)), results=[];
 for(let i=0;i<40;i++){ if(document.querySelector('#two-party svg.chart-svg .rd-ring')) break; await sleep(250); }
 for(const b of document.querySelectorAll('button')) if(b.textContent.trim()==='All') b.click();
 await sleep(1000);
 for(const section of ['#primary-vote','#two-party']){
  const sec=document.querySelector(section), svg=sec.querySelector('svg.chart-svg');
  const tickAt=[...svg.querySelectorAll('text')].find(t=>t.textContent==='2010').getBoundingClientRect();
  const tickBt=[...svg.querySelectorAll('text')].find(t=>t.textContent==='2020').getBoundingClientRect();
  const root=svg.getBoundingClientRect(), year=2001.8575342465754;
  const nx=(tickAt.x+tickAt.width/2+(tickBt.x+tickBt.width/2-tickAt.x-tickAt.width/2)*((year-2010)/10)-root.x)/root.width;
  let rings=[...svg.querySelectorAll('.rd-ring')].filter(c=>Math.abs(c.cx.baseVal.value/svg.viewBox.baseVal.width-nx)<.002);
  if(section==='#primary-vote') rings=rings.filter(c=>c.outerHTML.includes('--oth'));
  const ring=rings[0]; if(!ring) throw new Error(section+': no 2001 ring');
  ring.scrollIntoView({block:'center',behavior:'instant'}); await sleep(650);
  const r=ring.getBoundingClientRect(), x=r.x+r.width/2, y=r.y+r.height/2;
  const move=(x)=>svg.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'mouse',clientX:x,clientY:y}));
  const out=(related)=>svg.dispatchEvent(new MouseEvent('mouseout',{bubbles:true,relatedTarget:related,clientX:x,clientY:y}));
  const tip=()=>sec.querySelector('.tip.tip-guide'), opacity=()=>tip()?Number(getComputedStyle(tip()).opacity):0;
  move(x); await sleep(250);
  const title=tip()&&tip().textContent||'', opacities=[];
  const timer=setInterval(()=>opacities.push(opacity()),5);
  out(null); await sleep(20); move(x+.25); await sleep(180); clearInterval(timer);
  const after=tip()&&tip().textContent||'', min=Math.min(...opacities);
  out(document.body); await sleep(400); const exitHidden=opacity()===0;
  move(x); await sleep(250); svg.focus(); svg.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await sleep(400);
  const escapeHidden=opacity()===0;
  results.push({section,title,after,min,exitHidden,escapeHidden,pass:title.includes('The 2001 election')&&after.includes('The 2001 election')&&min>.99&&exitHidden&&escapeHidden});
 }
 window.webkit.messageHandlers.probe.postMessage(JSON.stringify(results));
})().catch(e=>window.webkit.messageHandlers.probe.postMessage(JSON.stringify({error:String(e),stack:e.stack}))),0
"""#

final class App: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler {
  var window: NSWindow!
  var webView: WKWebView!

  func applicationDidFinishLaunching(_ note: Notification) {
    window = NSWindow(contentRect: NSRect(x: 60, y: 60, width: 1280, height: 1000), styleMask: [.titled], backing: .buffered, defer: false)
    let cfg = WKWebViewConfiguration()
    cfg.userContentController.add(self, name: "probe")
    webView = WKWebView(frame: window.contentView!.bounds, configuration: cfg)
    webView.autoresizingMask = [.width, .height]
    window.contentView!.addSubview(webView)
    webView.navigationDelegate = self
    window.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
    let target = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "https://auspoltracker.com/"
    webView.load(URLRequest(url: URL(string: target)!))
    DispatchQueue.main.asyncAfter(deadline: .now() + 60) { print("WK_PROBE_TIMEOUT"); exit(2) }
  }

  func webView(_ wv: WKWebView, didFinish nav: WKNavigation!) {
    DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
      wv.evaluateJavaScript(PROBE_JS) { _, err in
        if let err = err { print("WK_JS_ERR \(err.localizedDescription)"); exit(4) }
      }
    }
  }

  func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
    let body = String(describing: message.body)
    print(body)
    exit(body.contains("\"pass\":false") || body.contains("\"error\"") ? 1 : 0)
  }

  func webView(_ wv: WKWebView, didFailProvisionalNavigation nav: WKNavigation!, withError e: Error) {
    print("WK_NAV_FAIL \(e.localizedDescription)"); exit(3)
  }
}

let app = NSApplication.shared
let delegate = App()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
