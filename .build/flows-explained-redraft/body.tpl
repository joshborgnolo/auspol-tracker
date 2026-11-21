<style>
  .static-summary { max-width: 720px; padding-top: 48px; }
  .static-summary h1 { font-size: 38px; line-height: 1.1; margin-bottom: 8px; }
  .static-summary .ss-sub { font-size: 16px; color: var(--ink-3); }
  .ex-body { max-width: none; }
  .ex-body > p, .ex-body blockquote, .ex-body .fns { max-width: 66ch; }
  .dr-head { font-family: var(--serif); font-size: 26px; line-height: 1.25; font-weight: 600; color: var(--ink); margin: 28px 0 22px; padding: 16px 0; border-top: 2px solid var(--ink); border-bottom: 1px solid var(--line); text-wrap: balance; }
  .ex-body h2 { margin-top: 44px; }
  .ex-body h3 { font-family: var(--serif); font-size: 18px; line-height: 1.3; font-weight: 600; margin: 34px 0 10px; color: var(--ink); text-wrap: balance; }
  .ex-body h3 .n { color: var(--ink-3); font-variant-numeric: tabular-nums; margin-right: 6px; }
  .ex-body h4 { font-family: var(--sans); font-size: 14.5px; font-weight: 600; margin: 24px 0 8px; color: var(--ink); }
  .ex-body blockquote { margin: 4px 0 18px; padding: 2px 0 2px 16px; border-left: 3px solid var(--line); }
  .ex-body blockquote p { font-family: var(--serif); font-size: 16px; line-height: 1.55; color: var(--ink-2); }
  .ex-body blockquote .ed { font-family: var(--sans); font-size: 13px; color: var(--ink-3); }
  .ex-table caption { color: var(--ink-3); }
  .ex-table tr.b td { font-weight: 600; color: var(--ink); border-top: 1px solid var(--line); }
  .ex-table tr.dr-spread td { color: var(--ink-3); font-style: italic; font-size: 12.5px; }
  .ex-table .dt { color: var(--ink-3); font-size: 12px; margin-left: 4px; }
  .ex-table.dr-why td { white-space: normal; vertical-align: top; }
  .ex-table.dr-why td:last-child { font-size: 13px; line-height: 1.5; color: var(--ink-2); min-width: 280px; }
  .ex-table.dr-why td[rowspan] { font-weight: 600; color: var(--ink); }
  .dr-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .dr-pair .ex-table { min-width: 0; } .dr-pair .ex-table th, .dr-pair .ex-table td { padding: 6px 5px; } .dr-pair .ex-twrap { margin: 0; }
  .dr-pair caption { font-weight: 600; color: var(--ink) !important; font-size: 13px !important; }
  @media (max-width: 640px) { .dr-pair { grid-template-columns: 1fr; } }
  sup.fn a { font-size: 10.5px; border: 0 !important; color: var(--ink-3) !important; text-decoration: none; padding-left: 1px; font-variant-numeric: tabular-nums; }
  .fns { margin-top: 40px; padding: 14px 0 0 18px; border-top: 1px solid var(--line); font-size: 12.5px; line-height: 1.55; color: var(--ink-3); }
  .fns li { margin-bottom: 8px; } .fns a.bk { border: 0; text-decoration: none; color: var(--ink-3); }
  .dr-fig { margin: 18px 0 24px; padding: 16px 16px 12px; border: 1px solid var(--line); border-radius: 8px; }
  .dr-ft { font-weight: 600; font-size: 14.5px; color: var(--ink); }
  .dr-fs { font-size: 12.5px; color: var(--ink-3); line-height: 1.45; margin: 2px 0 10px; }
  .dr-key { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12px; color: var(--ink-2); margin-bottom: 4px; }
  .kk { display: inline-flex; align-items: center; gap: 6px; } .kk i { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
  .dr-fig > svg { width: 100%; height: auto; display: block; overflow: visible; }
  .cg { stroke: var(--line-2); stroke-width: 1; } .c50 { stroke: var(--line); stroke-width: 1; stroke-dasharray: 3 3; }
  .ct { font: 11px var(--sans); fill: var(--ink-3); font-variant-numeric: tabular-nums; }
  .cl { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
  .cp { stroke-width: 1.6; }
  .cx { stroke: #e2590b; stroke-width: 2.4; fill: none; stroke-linecap: round; } .cxl { fill: #c24e0a; font-weight: 600; }
  .rv { opacity: 0; transition: opacity .35s; } .dr-fig.on .rv { opacity: 1; } .cl.rv { stroke-dasharray: 3 3; }
  .dr-fb { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin-top: 8px; }
  .rvb { font: 600 12.5px var(--sans); color: var(--ink); background: var(--surface, transparent); border: 1px solid var(--line); border-radius: 999px; padding: 5px 12px; cursor: pointer; }
  .rvb:hover { border-color: var(--ink-3); } .dr-fig.on .rvb { background: var(--ink); color: var(--paper, #fff); border-color: var(--ink); }
  .dr-fn { font-size: 11.5px; color: var(--ink-3); line-height: 1.45; flex: 1 1 240px; }
  .sm-g { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px 14px; margin-top: 8px; }
  @media (max-width: 600px) { .sm-g { grid-template-columns: 1fr; max-width: 330px; gap: 14px; } }
  .sm-p svg { width: 100%; height: auto; display: block; overflow: visible; }
  .sm-h { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 0 2px 2px 30px; border-bottom: 1px solid var(--line); margin-bottom: 4px; }
  .sm-n { font-weight: 600; font-size: 13.5px; white-space: nowrap; }
  .sm-v { font-size: 11.5px; color: var(--ink-3); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .sm-v b { color: var(--ink); font-weight: 600; } .sm-d { font-weight: 600; margin-left: 2px; }
  .sm .sm-v .rv { display: none; } .sm.on .sm-v .rv { display: inline; } .sm.on .hide-on { display: none; }
  .cel { stroke: var(--ink-3); stroke-width: 1; stroke-dasharray: 1 3; opacity: .6; }
  .cbold { font-weight: 600; fill: var(--ink-2); }
  .clef { fill: none; stroke-width: 1.8; stroke-dasharray: 3 3; opacity: .85; }
  .clefl { font-weight: 600; }
  .cf { stroke: var(--bg); stroke-width: 1.5; }
  .cs { stroke: var(--bg); stroke-width: 1; opacity: .55; }
  .carr { fill: none; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .cdl { font-weight: 700; }
  .cxh { stroke: var(--bg); stroke-width: 6; }
  .cxl tspan + tspan { font-weight: 700; }
  .cxr { stroke: #e2590b; stroke-width: 1.4; stroke-dasharray: 1.5 2; opacity: .8; }
  .ft { margin: 26px 0 30px; padding: 0; }
  .ft-rule { width: 60px; height: 4px; background: var(--ink); margin-bottom: 12px; }
  .ft-t { font-family: var(--sans); font-size: 17px; line-height: 1.3; font-weight: 400; color: var(--ink); letter-spacing: -0.005em; text-wrap: balance; }
  .ft-s { font-size: 12px; line-height: 1.4; color: var(--ink-3); margin-top: 4px; }
  .ft-keys { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 12px 0 4px; font-size: 13px; color: var(--ink-2); }
  .ft-k { display: inline-flex; align-items: center; gap: 6px; } .ft-k-s svg { opacity: .5; }
  .ft-g { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px 18px; margin-top: 10px; }
  @media (max-width: 600px) { .ft-g { grid-template-columns: 1fr; max-width: 270px; } }
  .ft-pt { font-size: 15px; font-weight: 600; color: var(--ink); margin: 0 0 2px; }
  .ft-p svg { width: 100%; height: auto; display: block; overflow: visible; }
  .fg { stroke: var(--line); stroke-width: 1; }
  .fb { stroke: var(--ink-3); stroke-width: 1; }
  .fy, .fx { font: 13px var(--sans); fill: var(--ink-3); font-variant-numeric: tabular-nums; }
  .fxb { fill: var(--ink); font-weight: 600; }
  .fl { fill: none; stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; }
  .fl-lef { fill: none; stroke-width: 2; stroke-dasharray: 4 3.5; }
  .fs { opacity: .42; }
  .fv { font: 600 13px var(--sans); font-variant-numeric: tabular-nums; } .fd { font-weight: 500; font-size: 12px; }
  .fn-l { font: italic 11.5px var(--sans); fill: var(--ink-3); }
  .fa { fill: none; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .fxx { stroke: var(--ink); stroke-width: 2.2; stroke-linecap: round; fill: none; } .fxh { stroke: var(--bg); stroke-width: 6; fill: none; }
  .fxr { stroke: var(--ink); stroke-width: 1.2; stroke-dasharray: 1.5 2.2; opacity: .7; }
  .fnp { font: 12px var(--sans); fill: var(--ink); } .fnp tspan + tspan { font-weight: 600; }
  .ft .rv { opacity: 0; transition: opacity .35s; } .ft.on .rv { opacity: 1; } .ft.on .pre { opacity: 0; }
  .ft-act { margin: 10px 0 0; }
  .ft-btn { font: 600 11.5px var(--sans); color: var(--ink); background: none; border: 0; border-bottom: 1.5px solid var(--ink); padding: 2px 0; cursor: pointer; }
  .ft-btn:hover { color: var(--ink-2); }
  .ft-f { margin-top: 12px; font-size: 12.5px; line-height: 1.5; color: var(--ink-3); max-width: 66ch; }
  .ft-f div + div { margin-top: 2px; }
  .dp { display: grid; grid-template-columns: 112px minmax(0, 1fr) 110px; column-gap: 0; margin-top: 16px; }
  .dp-ax svg, .dp-t svg { width: 100%; height: auto; display: block; overflow: visible; }
  .dax { font: 10.5px var(--sans); fill: var(--ink-3); font-variant-numeric: tabular-nums; }
  .dp-eh { font-size: 11.5px; color: var(--ink-3); text-align: center; align-self: end; padding-bottom: 4px; line-height: 1.25; }
  .dp-l { position: relative; }
  .dp-l > .dp-n, .dp-l > .dp-sh { z-index: 1; }
  .dp-e { margin-left: 6px; }
  .dp-l > .dp-n { position: absolute; left: 10px; top: var(--ty, 50%); transform: translateY(-50%); white-space: nowrap; }
  .dp-l > .dp-sh { position: absolute; left: 10px; top: calc(var(--ty, 50%) + 7px); white-space: nowrap; }
  .dp-l.dp-net > .dp-n, .dp-l.dp-net > .dp-sh { position: static; transform: none; display: inline; }
  .dp-l.dp-net { white-space: nowrap; align-self: center; grid-row: 1; grid-column: 1 / 3; text-align: right; padding-right: 4px; }
  .dp-nrow > .dp-t { display: none !important; }
  .dp-l.dp-net > .dp-n { font-size: 12px; } .dp-l.dp-net > .dp-sh { margin-left: 5px; font-size: 11.5px; }
  .dp-n { font-size: 13px; font-weight: 600; color: var(--ink); line-height: 1.2; }
  .dp-sh { font-size: 10.5px; color: var(--ink-3); line-height: 1.3; margin-top: 2px; }
  .dg { stroke: var(--line-2); stroke-width: 1; }
  .dt { stroke: var(--line); stroke-width: 1; }
  .dn { stroke: var(--ink); stroke-width: 1.4; stroke-dasharray: 2 2.5; }
  .dnb { fill: var(--ink); opacity: .1; }
  .dnl { font: 12px var(--sans); fill: var(--ink); }
  .ds { stroke: var(--bg); stroke-width: 0.7; }
  .dz { stroke: none; }
  .ft-line { width: 100%; height: auto; display: block; overflow: visible; margin-top: 6px; }
  .ft-sub { font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 18px 0 2px; }
  .lbv { font: 600 10.5px var(--sans); fill: var(--ink-2); font-variant-numeric: tabular-nums; }
  .lg { stroke: var(--line-2); stroke-width: 1; }
  .ll { fill: none; stroke-width: 2.2; stroke-linecap: round; } .llt { stroke-width: 1.4; stroke-dasharray: 1.5 3; }
  .lp { stroke: var(--bg); stroke-width: 1.3; } .lps { fill: var(--bg); stroke-width: 1.4; }
  .lel { font: 600 11.5px var(--sans); } .lev { font-weight: 500; font-variant-numeric: tabular-nums; }
  .dtk { stroke: var(--ink-3); stroke-width: 1; }
  .d50 { stroke: var(--ink-3); stroke-width: 1; stroke-dasharray: 3 3; opacity: .55; }
  .dfr { font: 500 11.5px var(--sans); opacity: .62; } .dfa { fill: none; opacity: .5; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }
  .dnx { stroke: var(--onp); stroke-width: 2.2; stroke-linecap: round; fill: none; }
  .dnr { stroke-width: 2; stroke-linecap: round; opacity: .5; }
  .dp-key { display: block; }
  .ft-s.dp-key > span { margin-right: 0; } .ft-s.dp-key svg { color: var(--ink-3); }
  .dp-kf { font-weight: 600; color: var(--ink); }
  .dp-key svg { vertical-align: -1px; margin-right: 1px; }
  .dp-key2 { margin-top: 4px; }
  .dp-key .rv, .dp-key .pre { display: inline; } .ft .dp-key .rv { display: none; } .ft.on .dp-key .rv { display: inline; } .ft.on .dp-key .pre { display: none; }
  .dp-key > span { white-space: nowrap; margin-right: 5px; display: inline; align-items: center; gap: 5px; } .dp-key svg { color: var(--ink-3); } .dp-key .dp-kl { color: var(--ink-3); margin-right: -4px; } .dp-ksep { width: 6px; }
  .dsu { stroke: var(--bg); stroke-width: 5; stroke-linecap: round; }
  .dsl { font: 12px var(--sans); fill: var(--ink-3); }
  .dl { stroke: var(--bg); stroke-width: 1.3; transition: opacity .35s; } .ft.on .dl { opacity: .28; }
  .dr { stroke: var(--bg); stroke-width: 1.3; }
  .da { fill: none; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; opacity: .85; }
  .dv { font: 12.5px var(--sans); } .dvc { fill: var(--ink-3); } .dvv { font-weight: 600; font-variant-numeric: tabular-nums; }
  .ft .pre { transition: opacity .35s; } .ft.on .pre { opacity: 0; }
  .dp-e { position: relative; min-height: 30px; }
  .dp-e::before { content: ""; position: absolute; left: 50%; top: 0; bottom: 0; border-left: 1px solid var(--ink-3); opacity: 0; transition: opacity .35s; }
  .ft.on .dp-e::before { opacity: .5; }
  .dp-bar { position: absolute; top: var(--ty, 50%); height: 9px; margin-top: -4.5px; width: 0; transition: width .5s cubic-bezier(.2,.7,.2,1); }
  .ft.on .dp-bar { width: var(--w); }
  .dp-ev { position: absolute; top: var(--ty, 50%); transform: translateY(-50%); font: 600 11.5px var(--sans); color: var(--ink); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .dp-nrow { border-top: 1px solid var(--line); margin-top: 8px; padding-top: 8px; }
  .ft:not(.on) .dp-nrow { border-top-color: transparent; }
  .dp-btn { grid-row: 1; grid-column: 1 / 3; align-self: center; justify-self: start; z-index: 3; }


  .dp-e-net { min-height: 34px; }
  .dp-e-net::before { top: -17px; }
  .dp-row { display: grid; grid-column: 1 / -1; grid-template-columns: subgrid; position: relative; }
  .dp-band { position: absolute; left: 0; right: 110px; border-radius: 6px; z-index: 0; }
  .dp-row > .dp-t { position: relative; z-index: 1; } .dp-l > .dp-n, .dp-l > .dp-sh { z-index: 2; }
  .dp-l.dp-net .dp-sh { white-space: nowrap; }
  @media (max-width: 600px) {
    .dp { display: block; }
    .dp-row { display: grid; grid-template-columns: minmax(0, 1fr) 132px; grid-template-areas: "l e" "t t"; column-gap: 10px; }
    .dp-row > .dp-l, .dp-row > .dp-h { grid-area: l; } .dp-row > .dp-e, .dp-row > .dp-eh { grid-area: e; } .dp-row > .dp-t, .dp-row > .dp-ax { grid-area: t; }
    .dp-l > .dp-n, .dp-l > .dp-sh { position: static; transform: none; display: block; }
    .dp-l { padding-top: 10px; } .dp-band { display: none; } .dp-e { --ty: 60% !important; }
    .dp-hrow .dp-eh { align-self: end; } .ft:not(.on) .dp-hrow .dp-eh { visibility: hidden; }
    .dp-nrow { grid-template-areas: "b b" "l e"; } .dp-btn { grid-area: b; padding-bottom: 6px; } .dp-l.dp-net { grid-area: l; } .dp-nrow > .dp-t { display: none !important; }
  }
  .ftt { margin: 22px 0 26px; }
  .ft-twrap { overflow-x: auto; margin-top: 12px; }
  .ft-tpair { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; } .ft-tpair .ft-twrap { margin-top: 10px; }
  @media (max-width: 640px) { .ft-tpair { grid-template-columns: 1fr; gap: 6px; } }
  .ft-pt { font-size: 12px; font-weight: 600; color: var(--ink); margin-bottom: 4px; }
  .ft-tab { width: 100%; border-collapse: collapse; font: 12.5px var(--sans); font-variant-numeric: tabular-nums; }
  .ft-tab th { font-size: 11px; font-weight: 500; color: var(--ink-3); text-align: right; padding: 0 8px 6px; border-bottom: 1px solid var(--ink-3); white-space: nowrap; vertical-align: bottom; }
  .ft-tab td { padding: 6px 8px; text-align: right; border-bottom: 1px solid var(--line-2); color: var(--ink-2); white-space: nowrap; }
  .ft-tab th:first-child, .ft-tab td:first-child { padding-left: 0; } .ft-tab th:last-child, .ft-tab td:last-child { padding-right: 0; }
  .ft-tab .l { text-align: left; } .ft-tab td.l:first-child { color: var(--ink); font-weight: 500; }
  .ft-tab .dt { font-size: 11px; color: var(--ink-3); font-weight: 400; margin-left: 3px; }
  .ft-tab tr.res td { color: var(--ink); font-weight: 600; border-top: 1px solid var(--ink-3); }
  .ft-tab tr.tot td { color: var(--ink); font-weight: 600; border-top: 1px solid var(--ink); border-bottom: 0; }
  .ft-tab tr.sub td { font-size: 11.5px; color: var(--ink-3); }
  .ft-tab tr.sub td:first-child { font-weight: 400; color: var(--ink-3); }
  .ft-bars td .tb { display: inline-block; position: relative; width: 70px; height: 9px; vertical-align: -1px; margin-right: 6px; }
  .ft-bars td .tb::before { content: ""; position: absolute; left: 50%; top: -3px; bottom: -3px; border-left: 1px solid var(--ink-3); opacity: .5; }
  .ft-bars td .tb i { position: absolute; top: 0; bottom: 0; }
  .ft-bars td .tv { display: inline-block; min-width: 2.6em; text-align: left; color: var(--ink); font-weight: 600; }
  .ft-why td { vertical-align: top; } .ft-why td.why { white-space: normal; font-size: 12px; line-height: 1.5; color: var(--ink-2); min-width: 240px; }
  .ft-why td.yr { font-weight: 600; color: var(--ink); } .ft-why tr.grp td { border-top: 1px solid var(--ink-3); }
  .ft-why td .tb { width: 56px; }
  @media (max-width: 640px) { .ft-tab tr.spacer { display: none; } }
  @media (max-width: 600px) {
    .ft-why thead th:last-child { display: none; }
    .ft-why tr { display: grid; grid-template-columns: 44px 1fr auto; column-gap: 8px; border-bottom: 1px solid var(--line-2); padding: 6px 0; }
    .ft-why tr.grp { border-top: 1px solid var(--ink-3); } .ft-why tr.grp td { border-top: 0; }
    .ft-why thead tr { padding: 0 0 6px; border-bottom: 1px solid var(--ink-3); } .ft-why thead th { border: 0; padding: 0; }
    .ft-why td { border: 0; padding: 0; } .ft-why td.why { grid-column: 1 / -1; min-width: 0; padding-top: 4px; }
  }
  .flag, .chk { cursor: help; }
  .flag { font: 600 10.5px var(--sans); color: #b42318; border: 1px solid #f0b4ad; background: #fdf0ee; border-radius: 4px; padding: 1px 5px; margin-left: 4px; }
  .chk { text-decoration: underline wavy #d92d20; text-decoration-thickness: 1px; text-underline-offset: 3px; }
  .edt { background: rgba(46,144,250,.13); border-radius: 3px; padding: 0 2px; cursor: help; }
  .draft-banner { position: sticky; top: 0; z-index: 9; background: var(--ink); color: var(--paper, #fff); font: 500 12px/1.4 var(--sans); padding: 7px 12px; text-align: center; }
  .draft-banner .edt, .draft-banner .chk { color: inherit; }
</style>
<div class="draft-banner">Draft preview of the /flows-explained/ redraft. <span class="edt">Blue</span> = figure I changed to match the data · <span class="chk">wavy red</span> = doesn&rsquo;t match the site&rsquo;s data, needs your call · hover either for the detail.</div>
<article class="static-summary">
<h1>Preference flows explained</h1>
<p class="ss-sub">Where the site&rsquo;s preference-flow estimates come from</p>
<div class="ex-body">
<p class="dr-head">Last election&rsquo;s preference flows &asymp; next election&rsquo;s preference flows</p>

<p>It&rsquo;s difficult to predict how voters will direct their preferences at the next election. So difficult, in fact, that the default position of pollsters and analysts is simply not to try. They prefer to solve the problem <em>ex post</em> rather than <em>ex ante</em>: using the preference flows at the last election rather than attempting to forecast them for the next election.</p>

<p>As it turns out, this method has consistently proved more accurate and reliable than any other. This is for the simple reason that preference flows tend not to change much from election to election, or at least their changes tend largely to cancel each other out. But it&rsquo;s also because the alternative method, respondent-allocated flows (who voters <em>say</em> they will preference when polled), is strangely unreliable.</p>

{{main}}


<p>As One Nation&rsquo;s primary vote has ballooned this term, Labor versus the Coalition is no longer the only central two-party-preferred contest, for the first time since 1910. The classic two-party contest now shares its podium with Labor versus One Nation. This complicates things: we have last-election flows for Labor versus the Coalition, but not for Labor versus One Nation. We can, however, use the preference flows at recent state elections and by-elections to make an educated guess.</p>

<p>This site uses these estimates:</p>
{{test}}
<p>Applied to the site&rsquo;s current primary votes, they give these two-party figures:</p>
{{wk}}

<p>The Labor v Coalition flows are simply the last-election flows (LEFs). We&rsquo;re assuming they won&rsquo;t change much by 2028. In this distinctly abnormal political environment, that is counterintuitive: the Labor and Coalition primary votes have collapsed {{dl}} and {{dc}} points respectively from already historic lows, and One Nation&rsquo;s has soared by {{don}} points. It seems silly to assume the old rules still apply. But the historical success of last-election flows, and the historical unreliability of attempts to deviate from them, mean that no last-election flow should be displaced without strong evidence. And we have no such evidence yet.</p>



<p>Preference flows are important, but I should preface that they matter much less than first preferences. Since 2013, 90% of seats at federal elections have been won by the candidate who led on primary votes. And since <span class="edt" title="Was 1987. Changed to match the chart above, which starts in 1996.">1996</span>, LEFs (assuming perfectly divined primaries) have produced a 2PP error of <span class="edt" title="Was 0.4 (1987&ndash;2025, Bonham&rsquo;s method). Over 1996&ndash;2025 it is 0.47 on the site&rsquo;s table (the chart above) and 0.46 on Bonham&rsquo;s method.">0.5</span> points, while pollster primaries (assuming perfectly divined preference flows) have produced a 2PP error of <span class="edt" title="1.24 over the eleven elections 1996&ndash;2025 (final poll per house within a fortnight, house means equally weighted), after the Roy Morgan correction. Was 1.22 over 1993&ndash;2025.">1.2</span> points, <span class="edt" title="Was &lsquo;almost three times greater&rsquo;. Unrounded the ratio is 2.7 (1.24 / 0.47); on the rounded figures shown it is 2.4.">around two and a half times greater</span>.<sup class="fn"><a href="#fn1" id="r1">1</a></sup> Alas, we can&rsquo;t control the accuracy of the primary votes pollsters publish. But we can control how we interpret them and use them to gauge public opinion, and preference flows are an important part of that.</p>

{{effc}}

<p>The track record of last-election flows is impressive. So when, and why, would you deviate from them? Let&rsquo;s look at some examples from history.</p>

<h2>When deviation went wrong</h2>

<h3><span class="n">1.</span>2004: huge industry-wide variance in respondent-allocated flows</h3>
<p>In 2004, the pollsters&rsquo; final polls had these primaries:</p>
{{t04a}}
<p>And these published two-party figures:</p>
{{t04b}}
<p>Here are the errors of their published 2PPs, beside those of the 2PPs that last-election flows would have produced (implied 2PPs):</p>
{{t04c}}
<p>Last-election flows and respondent-allocated flows were, in 2004, the difference between <span class="edt" title="Was &lsquo;an exceptional year (+0.4)&rsquo;. With Morgan&rsquo;s poll corrected (Coalition 45.5, not 50.5), the implied errors average +0.9 (Newspoll +1.9, ACNielsen &minus;1.2, Roy Morgan +1.9, Galaxy +1.2).">a better-than-average year for pollsters (+0.9 error)</span> and an average one (+1.5). Roy Morgan had it particularly bad: <span class="edt" title="Was: it would have been the most accurate pollster (&minus;0.5). That rested on the Nationals being counted twice in Morgan&rsquo;s figures, now fixed (d4408671).">had it used LEFs, it would have missed by +1.9; instead, it was the least accurate pollster (+3.7)</span>.<sup class="fn"><a href="#fn2" id="r2">2</a></sup></p>
<p><span class="edt" title="Was &lsquo;Pollsters expected&rsquo;. Bonham&rsquo;s 69&ndash;74% covers the three houses using respondent preferences; Galaxy used last-election flows and, per Bonham, had the best final poll. Backing the share out of each rounded published 2PP gives Newspoll 69, ACNielsen 64, Roy Morgan 78; rounding moves these a few points.">The three pollsters using respondent-allocated preferences (Newspoll, ACNielsen and Roy Morgan) expected <a href="https://kevinbonham.blogspot.com/2015/09/wonk-central-track-record-of-last.html">69&ndash;74%</a> of minor-party preferences to reach Labor</span>, but only 61% did. Galaxy, which used last-election flows, published the best final 2PP of the four. <span class="edt" title="Added: independent support from a peer-reviewed study of the same election. Jackman (2005), Table 1 and p. 514: the phone polls&rsquo; average house effect was &minus;0.1 (&plusmn;1.8) on Coalition primaries and &minus;1.3 (&minus;2.9 to 0.2) on Coalition 2PP, one-sided probability 0.93; he links the gap to 2PP methods and notes Galaxy used 2001 flows. His figures are campaign-long leans, not final-poll errors."><a href="https://doi.org/10.1080/10361140500302472">Simon Jackman&rsquo;s study</a> of every poll in the 2004 campaign reached the same verdict. On average, the three phone pollsters (ACNielsen, Galaxy and Newspoll) got the Coalition&rsquo;s primary vote almost exactly right, within 0.1 points. On 2PP they ran about 1.3 points too high for Labor, just short of statistical significance. He put the gap down to how each house turned primaries into a 2PP.</span> After 2004, <a href="https://www.theaustralian.com.au/nation%2Fpreference-deal-with-uap-looks-likely-to-pay-off-for-coalition%2Fnews-story%2F9f2245eb39831f97d4a85cf6b8cb9ab8">Newspoll started using LEFs</a>.</p>

<h3><span class="n">2.</span>YouGov in 2025</h3>
<p>YouGov handed down these primaries in its final poll before the 2025 election:</p>
{{tyg}}
<p>From these primaries it published a 2PP of 52.2, missing the result by &minus;3.0. LEFs would have produced 53.9 from the same primaries, a miss of &minus;1.3. <span class="edt" title="Was: &lsquo;which would have made YouGov&rsquo;s the single most accurate poll of 2025, by a margin of 0.7 points on the other implied 2PPs and 0.9 on the other published 2PPs&rsquo;. A 0.7-point lead over the next poll is well inside one poll&rsquo;s sampling error (about 1.5 points on a 2PP), so the ranking is mostly chance. The paired gap is not: both figures share one sample, so the 1.7 points come from the flows alone.">Both figures come from one sample, so the 1.7-point gap between them is down to the choice of flows, not sampling luck. The &minus;1.3 would have been as close as any final poll of 2025 came.</span></p>
<p>Unwise in retrospect, YouGov&rsquo;s <a href="https://yougov.com/articles/51585-au-election-mrp-methodology">stated rationale</a> for departing from LEFs was that Labor&rsquo;s 2022 preferences reflected an unpopular incumbent, Scott Morrison, and with Labor now the incumbent, those flows could not be assumed to repeat.</p>

<h3><span class="n">3.</span>Newspoll in 2019 and 2025: foreseeing One Nation&rsquo;s drift towards the Coalition</h3>
<p>In 2019, One Nation preferences hardened towards the Coalition, against Labor, by <span class="edt" title="Draft said 14.4 here and 14.7 in section 4. The site's flows give 49.5 → 34.8 = 14.7.">14.7</span> points compared with the previous election. In 2025, they hardened a further 10.2 points.</p>
{{ton}}
<p>In 2019, Newspoll saw this coming. <a href="https://www.theaustralian.com.au/nation%2Fpreference-deal-with-uap-looks-likely-to-pay-off-for-coalition%2Fnews-story%2F9f2245eb39831f97d4a85cf6b8cb9ab8">It said</a>:</p>
<blockquote>
<p>The preference flow from Pauline Hanson&rsquo;s One Nation at recent state elections has shifted substantially since the 2016 federal election when just 50.5 per cent of their preferences went to the Coalition. At the West Australian and Queensland elections the party did not preference against the sitting member and this resulted in the following preference flow from One Nation to the Liberal Party/LNP: WA (60.6 per cent <span class="ed">[60.7% on this site]</span>); Queensland (65.2 per cent <span class="ed">[66.3% on this site]</span>).</p>
<p>When we noted this shift in preferences we recalibrated the Newspoll preference flow allocation from One Nation to the Coalition from 50 to 60 per cent.</p>
</blockquote>
<p>Here are the preference flows it had to work with:</p>
{{c19}}
<p>Newspoll&rsquo;s published 2PP missed by +3.0 points in 2019, while its implied 2PP missed by +3.9. It still missed by a wide margin, about as much as the average pollster, but its departure from LEFs cut its error noticeably.</p>
<p>In 2025, Newspoll did the same thing. <a href="https://www.theaustralian.com.au/nation%2Fpolitics%2Fnewspoll-majority-in-mood-for-change-after-just-one-term-of-labor-hung-parliament-looms%2Fnews-story%2Febaca54b06d02478771f2cd04ebe580d">To quote</a>:</p>
<blockquote>
<p>Campbell White, head of Pyxis Polling &amp; Insights which independently administers Newspoll for The Australian said: &ldquo;Newspoll uses previous election flows to calculate two-party-preferred because it has consistently proved to be more reliable than other methods. However, based on what happened at the Queensland state election and through questions where we ask respondents about their intentions, it is clear that One Nation preferences are likely to flow more strongly to the Coalition than they did at the 2022 federal election.</p>
<p>&ldquo;For this reason, we are adjusting the calculation of preferences accordingly.&rdquo;</p>
</blockquote>
<p>Again, here are the preference flows it had to work with:</p>
{{c25}}
<p>Interestingly, although it correctly anticipated a further hardening of One Nation preferences towards the Coalition, Newspoll&rsquo;s published 2PP (&minus;2.7) did not outperform its implied 2PP (&minus;2.2) in 2025. In other words, it would have done better simply using LEFs. This seems to be because, while the share of One Nation preferences reaching the Coalition rose (moving the election 2PP {{x}} points for Labor), the share of Greens and others&rsquo; preferences reaching the Coalition fell (moving it +{{y}} points for Labor). <span class="edt" title="Draft said the two effects 'happened to cancel each other out'. They didn't quite: −0.7 and +1.0 net to +0.3 for Labor. Reworded so the sentence matches the numbers.">The second shift more than offset the first</span>, and Newspoll foresaw, and accounted for, only one of them.</p>
<p>The lesson is that strong evidence of one preference-flow shift does not necessarily justify displacing the LEF presumption, because other shifts may well offset it.</p>

<h3><span class="n">4.</span>LEF misses: 2013, 2019, 2022</h3>
<p>In 2013 and 2022, LEFs on the correct primaries produced errors of &minus;1.04 and &minus;0.87 respectively. Together with the famous industry failure of 2019 (+0.82), these are the big, clear misses of the last 40 years.<sup class="fn"><a href="#fn3" id="r3">3</a></sup></p>
<p>Why did they miss? In 2013, preferences from the Greens and from all other minor parties hardened towards Labor, by 4.2 and 5.1 points respectively. The same happened in 2022: Greens preferences hardened by 3.5 points and others by 3.9.</p>
<p>In 2019, as Newspoll broadly anticipated, One Nation preferences hardened towards the Coalition by 14.7 points. At the same time, preferences from all other minor parties hardened in the same direction by 3.1 points.</p>

<h4>Explaining the shifts</h4>
{{tsh}}

<ol class="fns">
  <li id="fn1"><span class="edt" title="Was 1.9 since 1987. Over 1996&ndash;2025 the mean distance of Labor&rsquo;s 2PP from 50 is 2.17; 0.47 / 2.17 = 22%.">For reference, the mean 2PP tilt since 1996 is 2.2 points: the typical result is 52.2&ndash;47.8. So the LEF error is about a fifth of the average winning tilt.</span> <a class="bk" href="#r1">&#8617;</a></li>
  <li id="fn2"><span class="edt" title="Was +4.2, then &lsquo;the second time in a row &hellip; in 2001 the gap was +2.6&rsquo;. Both rested on the Nationals double-count; corrected, 2004 is +1.8 and 2001 about +0.4 (published +5.5, implied +5.0), so the &lsquo;second time&rsquo; sentence is dropped.">The size of this error may be put at +1.8: the published-2PP error was 1.8 points greater than the implied-2PP error.</span> In 2007, too, all four pollsters individually did worse with their own flows than with LEFs, although the industry-wide gap was smaller, just +0.4. <a class="bk" href="#r2">&#8617;</a></li>
  <li id="fn3">See <a href="https://auspoltracker.com/lef-success/">here</a> for more of the LEF track record. <a class="bk" href="#r3">&#8617;</a></li>
  <li id="fn5">Expressed as the change in the share of preferences reaching Labor. Explanations draw on <a href="https://kevinbonham.blogspot.com/2015/09/wonk-central-track-record-of-last.html">Kevin Bonham&rsquo;s LEF track record</a> for 2013; he gives none for 2019 or 2022, so those are the site&rsquo;s reading. <a class="bk" href="#r5">&#8617;</a></li>
</ol>
</div>
</article>
</body></html>
