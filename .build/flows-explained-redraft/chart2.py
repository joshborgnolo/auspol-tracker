# small-multiple "what Newspoll had to work with" chart
def chart2(cid, fed_prev, states, fed_next, x0, x1, ticks, elec_lab, newspoll=None, title='', sub='', note=''):
    # fed_prev: list of fed points (visible); fed_next: fed points revealed; states: state points
    PART=[('grn','Greens'),('oth','Others'),('onp','One Nation')]
    W,H,L,Rm,T,B=232,206,30,58,12,24
    panels=[]
    ex=fed_next[0]['x']
    for p,pn in PART:
        fp=sorted([q for q in fed_prev if q['p']==p],key=lambda q:q['x'])
        st=[q for q in states if q['p']==p and q['sh']>=2]
        nx=[q for q in fed_next if q['p']==p][0]
        vals=[q['v'] for q in fp+st+[nx]]+([newspoll['v']] if (newspoll and p=='onp') else [])
        mid=(min(vals)+max(vals))/2
        y0=round((mid-15)/5)*5; y0=min(y0, min(vals)-2); y0=5*int(y0//5); y1=y0+30
        if max(vals)>y1-1: y1=5*int((max(vals)+6)//5); y0=y1-30
        X=lambda x: L+(x-x0)/(x1-x0)*(W-L-Rm)
        Y=lambda v: T+(y1-v)/(y1-y0)*(H-T-B)
        g=[]
        for v in range(y0, y1+1, 10 if (y0%10==0) else 10):
            pass
        v=y0+(10-y0%10)%10
        while v<=y1:
            g.append(f'<line x1="{L}" x2="{W-Rm+30}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" class="cg"/><text x="{L-6}" y="{Y(v)+3.5:.1f}" class="ct" text-anchor="end">{v}</text>')
            v+=10
        # election marker
        g.append(f'<line x1="{X(ex):.1f}" x2="{X(ex):.1f}" y1="{T-4}" y2="{H-B}" class="cel"/>')
        for t in ticks:
            bold=' cbold' if abs(t-int(ex))<0.01 else ''
            g.append(f'<text x="{X(t+0.5 if False else t):.1f}" y="{H-8}" class="ct{bold}" text-anchor="middle">{t}</text>')
        # federal line
        if len(fp)>1:
            d=' '.join(f"{'M' if i==0 else 'L'}{X(q['x']):.1f},{Y(q['v']):.1f}" for i,q in enumerate(fp))
            g.append(f'<path d="{d}" class="cl" style="stroke:var(--{p})"/>')
        last=fp[-1]
        # LEF carry-forward
        g.append(f'<path d="M{X(last["x"]):.1f},{Y(last["v"]):.1f} H{X(ex):.1f}" class="clef" style="stroke:var(--{p})"/>')
        g.append(f'<text x="{X(ex)+6:.1f}" y="{Y(last["v"])+3.5:.1f}" class="ct clefl hide-on" style="fill:var(--{p}-text,var(--{p}))">{last["v"]:.1f}</text>')
        # state points
        for q in st:
            cx,cy=X(q['x']),Y(q['v'])
            tip=f'<title>{q["lab"]}: {pn} {q["v"]:.1f}% to Labor (state election, site estimate)</title>'
            if q['j']=='wa':
                g.append(f'<rect x="{cx-3.6:.1f}" y="{cy-3.6:.1f}" width="7.2" height="7.2" class="cs" style="fill:var(--{p})">{tip}</rect>')
            else:
                g.append(f'<path d="M{cx:.1f},{cy-4.6:.1f} L{cx+4.4:.1f},{cy+3.2:.1f} L{cx-4.4:.1f},{cy+3.2:.1f} Z" class="cs" style="fill:var(--{p})">{tip}</path>')
        for q in fp:
            g.append(f'<circle cx="{X(q["x"]):.1f}" cy="{Y(q["v"]):.1f}" r="4.6" class="cf" style="fill:var(--{p})"><title>{q["lab"]}: {pn} {q["v"]:.1f}% to Labor</title></circle>')
        # reveal
        dlt=round(nx['v'],1)-round(last['v'],1)
        ya,yb=Y(last['v']),Y(nx['v'])
        if abs(yb-ya)>9:
            dirn=1 if yb>ya else -1
            g.append(f'<path d="M{X(ex):.1f},{ya+dirn*2:.1f} V{yb-dirn*7:.1f}" class="carr rv" style="stroke:var(--{p})"/>')
            g.append(f'<path d="M{X(ex)-3.5:.1f},{yb-dirn*9:.1f} L{X(ex):.1f},{yb-dirn*5:.1f} L{X(ex)+3.5:.1f},{yb-dirn*9:.1f}" class="carr rv" style="stroke:var(--{p})"/>')
        g.append(f'<circle cx="{X(ex):.1f}" cy="{yb:.1f}" r="5" class="cf rv" style="fill:var(--{p})"><title>{nx["lab"]}: {pn} {nx["v"]:.1f}% to Labor</title></circle>')
        sgn='+' if dlt>0 else '&minus;'
        ylab=yb+3.5
        if newspoll and p=='onp' and abs(yb-Y(newspoll['v']))<26: ylab=max(yb+3.5, Y(newspoll['v'])+24)
        g.append(f'<text x="{X(ex)+8:.1f}" y="{ylab:.1f}" class="ct cdl rv" style="fill:var(--{p}-text,var(--{p}))">{nx["v"]:.1f}</text>')
        # newspoll
        if newspoll and p=='onp':
            nxp,nyp=X(ex),Y(newspoll['v'])
            if 'lo' in newspoll:
                g.append(f'<line x1="{nxp:.1f}" x2="{nxp:.1f}" y1="{Y(newspoll["lo"]):.1f}" y2="{Y(newspoll["hi"]):.1f}" class="cxr"/>')
            g.append(f'<path d="M{nxp-4.5:.1f},{nyp-4.5:.1f}L{nxp+4.5:.1f},{nyp+4.5:.1f}M{nxp+4.5:.1f},{nyp-4.5:.1f}L{nxp-4.5:.1f},{nyp+4.5:.1f}" class="cx cxh"/><path d="M{nxp-4.5:.1f},{nyp-4.5:.1f}L{nxp+4.5:.1f},{nyp+4.5:.1f}M{nxp+4.5:.1f},{nyp-4.5:.1f}L{nxp-4.5:.1f},{nyp+4.5:.1f}" class="cx"><title>{newspoll["tip"]}</title></path>')
            g.append(f'<text x="{nxp+9:.1f}" y="{nyp-2:.1f}" class="ct cxl"><tspan>Newspoll</tspan><tspan x="{nxp+9:.1f}" dy="12">{newspoll["lab"]}</tspan></text>')
        head=f'''<div class="sm-h"><span class="sm-n" style="color:var(--{p}-text,var(--{p}))">{pn}</span><span class="sm-v"><span class="hide-on">Last election {last["v"]:.1f}</span><span class="rv">{last["v"]:.1f} &rarr; <b>{nx["v"]:.1f}</b> <span class="sm-d" style="color:var(--{p}-text,var(--{p}))">{sgn}{abs(dlt):.1f}</span></span></span></div>'''
        panels.append(f'<div class="sm-p">{head}<svg viewBox="0 0 {W} {H}" role="img" aria-label="{pn}: {title}">{"".join(g)}</svg></div>')
    key=('<span class="kk"><svg width="12" height="12"><circle cx="6" cy="6" r="4.6" fill="currentColor"/></svg>Federal</span>'
         '<span class="kk"><svg width="12" height="12"><rect x="2.4" y="2.4" width="7.2" height="7.2" fill="currentColor"/></svg>WA</span>'
         '<span class="kk"><svg width="12" height="12"><path d="M6,1.4 L10.4,9.2 L1.6,9.2 Z" fill="currentColor"/></svg>Queensland</span>'
         '<span class="kk"><svg width="24" height="8"><line x1="0" x2="24" y1="4" y2="4" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3"/></svg>Last-election flow, carried forward</span>'
         +('<span class="kk"><svg width="12" height="12"><path d="M2,2L10,10M10,2L2,10" stroke="#e2590b" stroke-width="2.2" stroke-linecap="round"/></svg>Newspoll&rsquo;s setting</span>' if newspoll else ''))
    btn=f'<button class="rvb" type="button" aria-pressed="false" onclick="var f=this.closest(\'figure\'),on=f.classList.toggle(\'on\');this.setAttribute(\'aria-pressed\',on);this.textContent=on?\'Hide the {elec_lab} result\':\'Show what happened in {elec_lab}\'">Show what happened in {elec_lab}</button>'
    return f'''<figure class="dr-fig sm" id="{cid}">
<div class="dr-ft">{title}</div><div class="dr-fs">{sub}</div>
<div class="dr-key">{key}</div>
<div class="sm-g">{''.join(panels)}</div>
<div class="dr-fb">{btn}<span class="dr-fn">{note}</span></div>
</figure>'''
