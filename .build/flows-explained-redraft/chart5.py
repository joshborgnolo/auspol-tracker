def lineft(cid, pts, x0, x1, ticks, y0, y1, title, sub, notes, source, effects=None):
    W,H,L,R,T,B=660,300,30,96,26,30
    X=lambda x: L+(x-x0)/(x1-x0)*(W-L-R)
    Y=lambda v: T+(y1-v)/(y1-y0)*(H-T-B)
    PN={'grn':'Greens','oth':'Others','onp':'One Nation'}
    g=[]
    for v in range(y0+10 if y0%10 else y0, y1+1, 10):
        if v==50: continue
        g.append(f'<line x1="{L}" x2="{W-R+8}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" class="lg"/>')
        g.append(f'<text x="{L-6}" y="{Y(v)+3.5:.1f}" class="dax" text-anchor="end">{v}</text>')
    g.append(f'<text x="{L-6}" y="{Y(50)+3.5:.1f}" class="dax" text-anchor="end">50</text>')
    g.append(f'<line x1="{L}" x2="{W-R+8}" y1="{Y(50):.1f}" y2="{Y(50):.1f}" class="d50"/>')
    g.append(f'<path d="M{L+4:.1f},{Y(y1)-8:.1f} v-11 m-3.5,4 l3.5,-4 l3.5,4" class="dfa" style="stroke:var(--alp)"/><text x="{L+12}" y="{Y(y1)-10:.1f}" class="dfr" style="fill:var(--alp-text,var(--alp))">Labor&#8209;friendly flows</text>')
    g.append(f'<path d="M{L+4:.1f},{Y(y0)-20:.1f} v11 m-3.5,-4 l3.5,4 l3.5,-4" class="dfa" style="stroke:var(--lnp)"/><text x="{L+12}" y="{Y(y0)-10:.1f}" class="dfr" style="fill:var(--lnp-text,var(--lnp))">Coalition&#8209;friendly flows</text>')
    base=H-B
    for t in ticks:
        g.append(f'<line x1="{X(t):.1f}" x2="{X(t):.1f}" y1="{base}" y2="{base+5}" class="dtk"/><text x="{X(t):.1f}" y="{base+17}" class="dax" text-anchor="middle">{t}</text>')
    g.append(f'<line x1="{L}" x2="{W-R+8}" y1="{base}" y2="{base}" class="dtk"/>')
    ends=[]
    for p in ('grn','oth','onp'):
        qs=sorted([q for q in pts if q['p']==p],key=lambda q:q['x'])
        # solid where share>=2 on both ends, dotted otherwise
        for a,b in zip(qs,qs[1:]):
            thin=a['sh']<2 or b['sh']<2
            g.append(f'<path d="M{X(a["x"]):.1f},{Y(a["v"]):.1f} L{X(b["x"]):.1f},{Y(b["v"]):.1f}" class="ll{" llt" if thin else ""}" style="stroke:var(--{p})"/>')
        for q in qs:
            small=q['sh']<2
            g.append(f'<circle cx="{X(q["x"]):.1f}" cy="{Y(q["v"]):.1f}" r="{2.8 if small else 3.4}" class="lp{" lps" if small else ""}" style="{"stroke" if small else "fill"}:var(--{p})"><title>{q["lab"]}: {PN[p]} {q["v"]:.1f}% to Labor ({q["sh"]:.1f}% of the vote)</title></circle>')
        last=qs[-1]; ends.append([Y(last['v']),p,last['v'],X(last['x'])])
    ends.sort()
    for i in range(1,len(ends)):
        if ends[i][0]-ends[i-1][0]<26: ends[i][0]=ends[i-1][0]+26
    for y,p,v,x in ends:
        g.append(f'<text x="{x+9:.1f}" y="{y-1:.1f}" class="lel" style="fill:var(--{p}-text,var(--{p}))"><tspan>{PN[p]}</tspan><tspan x="{x+9:.1f}" dy="13" class="lev">{v:.1f}</tspan></text>')
    eff=''
    if effects:
        EH,ET,EB=128,16,22; m=1.2
        EY=lambda v: ET+(m-v)/(2*m)*(EH-ET-EB)
        e=[]
        for v in (1,-1):
            e.append(f'<line x1="{L}" x2="{W-R+8}" y1="{EY(v):.1f}" y2="{EY(v):.1f}" class="lg"/><text x="{L-6}" y="{EY(v)+3.5:.1f}" class="dax" text-anchor="end">{"+1" if v>0 else "&minus;1"}</text>')
        e.append(f'<text x="{L-6}" y="{EY(0)+3.5:.1f}" class="dax" text-anchor="end">0</text>')
        for yr,v in effects:
            x=X(yr); col='var(--alp)' if v>0 else 'var(--lnp)'
            y0b,y1b=sorted([EY(0),EY(v)])
            e.append(f'<rect x="{x-6:.1f}" y="{y0b:.1f}" width="12" height="{max(y1b-y0b,0.8):.1f}" style="fill:{col}"><title>{int(yr)}: {v:+.2f} points for Labor against last-election flows</title></rect>')
            ly=EY(v)-5 if v>=0 else EY(v)+12
            e.append(f'<text x="{x:.1f}" y="{ly:.1f}" class="lbv" text-anchor="middle">{"&asymp;0" if abs(v)<0.05 else (("+" if v>0 else "&minus;")+f"{abs(v):.1f}")}</text>')
        e.append(f'<line x1="{L}" x2="{W-R+8}" y1="{EY(0):.1f}" y2="{EY(0):.1f}" class="dtk"/>')
        for t in ticks:
            e.append(f'<line x1="{X(t):.1f}" x2="{X(t):.1f}" y1="{EH-EB+2}" y2="{EH-EB+7}" class="dtk"/><text x="{X(t):.1f}" y="{EH-EB+19}" class="dax" text-anchor="middle">{t}</text>')
        eff=(f'<div class="ft-sub">Effect on Labor&rsquo;s 2PP of the change in flows since the previous election, points</div>'
             f'<svg class="ft-line" viewBox="0 0 {W} {EH}" role="img" aria-label="Effect on Labor 2PP by election">{"".join(e)}</svg>')
    foot=''.join(f'<div>{n}</div>' for n in notes)+f'<div>Source: {source}</div>'
    return f'''<figure class="ft" id="{cid}">
<div class="ft-rule"></div>
<div class="ft-t">{title}</div>
<div class="ft-s dp-key">{sub}</div>
<svg class="ft-line" viewBox="0 0 {W} {H}" role="img" aria-label="{title}">{''.join(g)}</svg>
{eff}
<figcaption class="ft-f">{foot}</figcaption>
</figure>'''

def effectfig(cid, effects, x0, x1, ticks, title, sub, notes, source):
    W,L,R=660,30,96
    X=lambda x: L+(x-x0)/(x1-x0)*(W-L-R)
    EH,ET,EB=150,18,24; m=1.2
    EY=lambda v: ET+(m-v)/(2*m)*(EH-ET-EB)
    e=[]
    for v in (1,-1):
        e.append(f'<line x1="{L}" x2="{W-R+8}" y1="{EY(v):.1f}" y2="{EY(v):.1f}" class="lg"/><text x="{L-6}" y="{EY(v)+3.5:.1f}" class="dax" text-anchor="end">{"+1" if v>0 else "&minus;1"}</text>')
    e.append(f'<text x="{L-6}" y="{EY(0)+3.5:.1f}" class="dax" text-anchor="end">0</text>')
    for yr,v in effects:
        x=X(yr); col='var(--alp)' if v>0 else 'var(--lnp)'
        a,b=sorted([EY(0),EY(v)])
        e.append(f'<rect x="{x-7:.1f}" y="{a:.1f}" width="14" height="{max(b-a,0.8):.1f}" style="fill:{col}"><title>{int(yr)}: {v:+.2f} points for Labor against last-election flows</title></rect>')
        ly=EY(v)-5 if v>=0 else EY(v)+12
        e.append(f'<text x="{x:.1f}" y="{ly:.1f}" class="lbv" text-anchor="middle">{"&asymp;0" if abs(v)<0.05 else (("+" if v>0 else "&minus;")+f"{abs(v):.1f}")}</text>')
    e.append(f'<line x1="{L}" x2="{W-R+8}" y1="{EY(0):.1f}" y2="{EY(0):.1f}" class="dtk"/>')
    e.append(f'<text x="{W-R+14}" y="{EY(0.6)+4:.1f}" class="dfr" style="fill:var(--alp-text,var(--alp))">Labor did</text><text x="{W-R+14}" y="{EY(0.6)+17:.1f}" class="dfr" style="fill:var(--alp-text,var(--alp))">better</text>')
    e.append(f'<text x="{W-R+14}" y="{EY(-0.6)-4:.1f}" class="dfr" style="fill:var(--lnp-text,var(--lnp))">Coalition</text><text x="{W-R+14}" y="{EY(-0.6)+9:.1f}" class="dfr" style="fill:var(--lnp-text,var(--lnp))">did better</text>')
    for t in ticks:
        e.append(f'<line x1="{X(t):.1f}" x2="{X(t):.1f}" y1="{EH-EB+2}" y2="{EH-EB+7}" class="dtk"/><text x="{X(t):.1f}" y="{EH-EB+19}" class="dax" text-anchor="middle">{t}</text>')
    foot=''.join(f'<div>{n}</div>' for n in notes)+f'<div>Source: {source}</div>'
    return f'''<figure class="ft" id="{cid}">
<div class="ft-rule"></div>
<div class="ft-t">{title}</div>
<div class="ft-s">{sub}</div>
<svg class="ft-line" viewBox="0 0 {W} {EH}" role="img" aria-label="{title}">{''.join(e)}</svg>
<figcaption class="ft-f">{foot}</figcaption>
</figure>'''
