def chart3(cid, fed_prev, states, fed_next, x0, x1, ticks, elec_lab, newspoll=None, title='', sub='', notes=(), source=''):
    PART=[('grn','Greens'),('oth','Others'),('onp','One Nation')]
    W,H,L,R,T,B=224,212,26,40,8,26
    ex=fed_next[0]['x']
    X=lambda x: L+(x-x0)/(x1-x0)*(W-L-R)
    panels=[]
    for pi,(p,pn) in enumerate(PART):
        fp=sorted([q for q in fed_prev if q['p']==p],key=lambda q:q['x'])
        st=[q for q in states if q['p']==p and q['sh']>=2]
        nx=[q for q in fed_next if q['p']==p][0]
        vals=[q['v'] for q in fp+st+[nx]]+([newspoll['v']] if (newspoll and p=='onp') else [])
        y0=10*int((min(vals)-3)//10); y1=y0+30
        if max(vals)>y1-2: y0+=10; y1+=10
        Y=lambda v: T+(y1-v)/(y1-y0)*(H-T-B)
        g=[]
        for v in range(y0, y1+1, 10):
            g.append(f'<line x1="{L}" x2="{W-R+18}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" class="fg"/>')
            g.append(f'<text x="{L-5}" y="{Y(v)+4.5:.1f}" class="fy" text-anchor="end">{v}</text>')
        base=H-B
        g.append(f'<line x1="{L}" x2="{W-R+18}" y1="{base}" y2="{base}" class="fb"/>')
        for yr in range(int(x0)+1, int(x1)+1):
            g.append(f'<line x1="{X(yr):.1f}" x2="{X(yr):.1f}" y1="{base}" y2="{base+5}" class="fb"/>')
        for t in ticks:
            g.append(f'<text x="{X(t):.1f}" y="{base+19}" class="fx{" fxb" if t==int(ex) else ""}" text-anchor="middle">{t}</text>')
        # state markers
        for q in st:
            cx,cy=X(q['x']),Y(q['v'])
            tip=f'<title>{q["lab"]} state election: {q["v"]:.1f}% to Labor (site estimate)</title>'
            if q['j']=='wa': g.append(f'<rect x="{cx-3.3:.1f}" y="{cy-3.3:.1f}" width="6.6" height="6.6" class="fs" style="fill:var(--{p})">{tip}</rect>')
            else: g.append(f'<path d="M{cx:.1f},{cy-4.3:.1f} L{cx+4.1:.1f},{cy+3:.1f} L{cx-4.1:.1f},{cy+3:.1f} Z" class="fs" style="fill:var(--{p})">{tip}</path>')
        last=fp[-1]
        # carried-forward line
        g.append(f'<path d="M{X(last["x"]):.1f},{Y(last["v"]):.1f} H{X(ex):.1f}" class="fl-lef" style="stroke:var(--{p})"/>')
        # federal line + dots
        if len(fp)>1:
            d=' '.join(f"{'M' if i==0 else 'L'}{X(q['x']):.1f},{Y(q['v']):.1f}" for i,q in enumerate(fp))
            g.append(f'<path d="{d}" class="fl" style="stroke:var(--{p})"/>')
        for q in fp:
            g.append(f'<circle cx="{X(q["x"]):.1f}" cy="{Y(q["v"]):.1f}" r="3.8" style="fill:var(--{p})"><title>{q["lab"]}: {q["v"]:.1f}% to Labor</title></circle>')
        g.append(f'<text x="{X(ex)+6:.1f}" y="{Y(last["v"])+4.5:.1f}" class="fv pre" style="fill:var(--{p}-text,var(--{p}))">{last["v"]:.1f}</text>')
        if pi==0:
            g.append(f'<text x="{(X(last["x"])+X(ex))/2:.1f}" y="{Y(last["v"])-8:.1f}" class="fn-l" text-anchor="middle">assumed</text>')
        # reveal
        dlt=round(nx['v'],1)-round(last['v'],1)
        ya,yb=Y(last['v']),Y(nx['v'])
        if abs(yb-ya)>10:
            s=1 if yb>ya else -1
            g.append(f'<path d="M{X(ex):.1f},{ya+s*3:.1f} V{yb-s*6:.1f} M{X(ex)-3.2:.1f},{yb-s*9.5:.1f} L{X(ex):.1f},{yb-s*6:.1f} L{X(ex)+3.2:.1f},{yb-s*9.5:.1f}" class="fa rv" style="stroke:var(--{p})"/>')
        g.append(f'<circle cx="{X(ex):.1f}" cy="{yb:.1f}" r="4.6" class="rv" style="fill:var(--{p})"><title>{nx["lab"]}: {nx["v"]:.1f}% to Labor</title></circle>')
        ylab=yb+4.5
        if newspoll and p=='onp' and abs(yb-Y(newspoll['v']))<30: ylab=max(yb+4.5, Y(newspoll['v'])+30)
        sg='+' if dlt>0 else '&minus;'
        g.append(f'<text x="{X(ex)+7:.1f}" y="{ylab:.1f}" class="fv rv" style="fill:var(--{p}-text,var(--{p}))"><tspan>{nx["v"]:.1f}</tspan><tspan x="{X(ex)+7:.1f}" dy="13" class="fd">{sg}{abs(dlt):.1f}</tspan></text>')
        if newspoll and p=='onp':
            nxp,nyp=X(ex),Y(newspoll['v'])
            if 'lo' in newspoll: g.append(f'<line x1="{nxp:.1f}" x2="{nxp:.1f}" y1="{Y(newspoll["lo"]):.1f}" y2="{Y(newspoll["hi"]):.1f}" class="fxr"/>')
            xx=f'M{nxp-4.3:.1f},{nyp-4.3:.1f}L{nxp+4.3:.1f},{nyp+4.3:.1f}M{nxp+4.3:.1f},{nyp-4.3:.1f}L{nxp-4.3:.1f},{nyp+4.3:.1f}'
            g.append(f'<path d="{xx}" class="fxh"/><path d="{xx}" class="fxx"><title>{newspoll["tip"]}</title></path>')
            g.append(f'<text x="{nxp+7:.1f}" y="{nyp-3:.1f}" class="fnp"><tspan>Newspoll</tspan><tspan x="{nxp+7:.1f}" dy="13">{newspoll["lab"]}</tspan></text>')
        panels.append(f'<div class="ft-p"><div class="ft-pt">{pn}</div><svg viewBox="0 0 {W} {H}" role="img" aria-label="{pn}">{"".join(g)}</svg></div>')
    key=('<span class="ft-k"><svg width="22" height="10"><line x1="1" x2="21" y1="5" y2="5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="11" cy="5" r="3.4" fill="currentColor"/></svg>Federal election</span>'
         '<span class="ft-k"><svg width="22" height="10"><line x1="1" x2="21" y1="5" y2="5" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3"/></svg>Last-election flow, assumed</span>'
         '<span class="ft-k ft-k-s"><svg width="10" height="10"><rect x="1.7" y="1.7" width="6.6" height="6.6" fill="currentColor"/></svg>WA</span>'
         '<span class="ft-k ft-k-s"><svg width="10" height="10"><path d="M5,0.7 L9.1,8 L0.9,8 Z" fill="currentColor"/></svg>Queensland</span>')
    btn=(f'<button class="ft-btn" type="button" aria-pressed="false" onclick="var f=this.closest(\'figure\'),on=f.classList.toggle(\'on\');this.setAttribute(\'aria-pressed\',on);this.firstChild.textContent=on?\'Hide the {elec_lab} result \':\'Show the {elec_lab} result \'">Show the {elec_lab} result <span aria-hidden="true">&#9656;</span></button>')
    foot=''.join(f'<div>{n}</div>' for n in notes)+f'<div>Source: {source}</div>'
    return f'''<figure class="ft" id="{cid}">
<div class="ft-rule"></div>
<div class="ft-t">{title}</div>
<div class="ft-s">{sub}</div>
<div class="ft-keys">{key}</div>
<div class="ft-g">{''.join(panels)}</div>
<div class="ft-act">{btn}</div>
<figcaption class="ft-f">{foot}</figcaption>
</figure>'''
