/* A time window of its own for each chart, on a page whose charts reach back different distances.
   The shared window code (template.html's "window" block) reads one WIN and one HIST: they are set
   here to a chart's own before it draws, is read, or has its bar pressed. The page declares HIST as
   {terms:[{a:0}]}; lo is the first year the chart has anything for. */
const WINDOWS=[];
let ACTIVE=null;
const useWindow=c=>{WIN=c.win;HIST.terms[0].a=c.lo};
const paintWindow=c=>{useWindow(c);paintWinBars([c.bar])};
/* section: the chart's panel; src(): rewrites the note under it; make(use): builds the chart */
function windowedChart({section,lo,src,make}){
  const c={bar:section.querySelector('[data-win]'),lo,win:{kind:'term',year:CUR.year},src};
  c.use=()=>useWindow(c);
  /* capture, so the window is this chart's before the shared bar handler reads it */
  c.bar.parentElement.addEventListener('click',()=>{ACTIVE=c;c.use()},true);
  c.chart=make(c.use);
  WINDOWS.push(c);paintWindow(c);src();
  return c;
}
function setWin(w){const c=ACTIVE;if(!c)return;c.win=w;paintWindow(c);c.src();c.chart.clear();c.chart.draw()}
