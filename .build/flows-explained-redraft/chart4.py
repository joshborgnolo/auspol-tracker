def dotplot(cid, prev, nxt, state_keys, newspoll, title, sub, notes, source):
    A,B=lef[prev],lef[nxt]
    PN={'onp':'One Nation','grn':'Greens','oth':'Others'}
    VW=460; X=lambda v: 14+(v-20)/70*432
    cw=lambda s: len(s)*6.6   # rough label width at 12.5px
    def clampc(cx,w): return min(max(cx, w/2+2), VW-w/2-2)
    rows=[]; net=0
    for i,p in enumerate(('onp','grn','oth')):
        first=(i==0)
        lv,av=A['f'][p]*100, B['f'][p]*100
        eff=B['share'][p]*(B['f'][p]-A['f'][p]); net+=eff
        sts=[]
        for (j,y) in state_keys:
            if (j,y,p) in est: sts.append(({'wa':'WA','qld':'Qld'}[j]+' &rsquo;'+y[2:], est[(j,y,p)], f"{ {'wa':'WA','qld':'Queensland'}[j]} {y} state election: {est[(j,y,p)]:.1f}% to Labor (site estimate)"))
        top=24 if (first and newspoll) else 0
        ty=28; H=ty+32
        g=[]
        g.append(f'<line x1="{X(50):.1f}" x2="{X(50):.1f}" y1="0" y2="{H}" class="d50"/>')
        zv=[lv,av]+[v for _,v,_ in sts]+([newspoll.get('lo',newspoll['v']),newspoll.get('hi',newspoll['v'])] if (first and newspoll) else [])
        zl,zh=X(min(zv))-11,X(max(zv))+11
        if first and newspoll:
            nx_=X(newspoll['v'])
            npx=[]

        # state readings
        labs=[]; ticks=[]
        for s,v,tip in sts:
            cx,cy=X(v),ty+19
            shape=(f'<path d="M{cx:.1f},{cy-5:.1f} L{cx+5:.1f},{cy:.1f} L{cx:.1f},{cy+5:.1f} L{cx-5:.1f},{cy:.1f} Z"' if s.startswith('WA') else f'<path d="M{cx:.1f},{cy-5:.1f} L{cx+5:.1f},{cy+4:.1f} L{cx-5:.1f},{cy+4:.1f} Z"')
            ticks.append(f'{shape} class="ds" style="fill:var(--{p})"><title>{tip}</title></path>')
            labs.append([X(v),s])
        if False:
            labs.sort()
            merged=[labs[0]]
            for x,s in labs[1:]:
                px,ps=merged[-1]
                if (x-cw(s)/2) - (px+cw(ps)/2) < 6: merged[-1]=[(px+x)/2, ps+' &middot; '+s]
                else: merged.append([x,s])
            xs=sorted(X(v) for _,v,_ in sts)
            for x,s in merged:
                w=cw(s)
                if x-w/2 < 2: g.append(f'<text x="{xs[0]-3:.1f}" y="{ty+32}" class="dsl">{s}</text>')
                elif x+w/2 > VW-2: g.append(f'<text x="{xs[-1]+3:.1f}" y="{ty+32}" class="dsl" text-anchor="end">{s}</text>')
                else: g.append(f'<text x="{x:.1f}" y="{ty+32}" class="dsl" text-anchor="middle">{s}</text>')
        # last election (pre) and result (reveal)
        lx,ax=X(lv),X(av)
        if abs(ax-lx)>10:
            sgn=1 if ax>lx else -1
            e=ax-sgn*8.5
            g.append(f'<path d="M{lx+sgn*6:.1f},{ty} H{e:.1f} M{e-sgn*4.5:.1f},{ty-3.6} L{e:.1f},{ty} L{e-sgn*4.5:.1f},{ty+3.6}" class="da rv" style="stroke:var(--{p})"/>')
        g.append(f'<circle cx="{lx:.1f}" cy="{ty}" r="6" class="dl" style="fill:var(--{p})"><title>{prev} federal election: {lv:.1f}% to Labor</title></circle>')
        g.append(f'<circle cx="{ax:.1f}" cy="{ty}" r="6.2" class="dr rv" style="fill:var(--{p})"><title>{nxt} federal election: {av:.1f}% to Labor</title></circle>')
        g.extend(ticks)
        if first and newspoll:
            nx_,ny_=X(newspoll['v']),ty
            xx=f'M{nx_-3.4:.1f},{ny_-3.4:.1f}L{nx_+3.4:.1f},{ny_+3.4:.1f}M{nx_+3.4:.1f},{ny_-3.4:.1f}L{nx_-3.4:.1f},{ny_+3.4:.1f}'
            g.append(f'<path d="{xx}" class="dnx"><title>{newspoll.get("tip","Newspoll")}</title></path>')
        def vlab(x,cap,v,cls):
            s=(f'<tspan class="dvc">{cap} </tspan>' if cap else '')+f'<tspan class="dvv" style="fill:var(--{p}-text,var(--{p}))">{v:.1f}</tspan>'
            w=cw((cap+' ' if cap else '')+f'{v:.1f}')
            return f'<text x="{clampc(x,w):.1f}" y="{ty-12}" class="dv {cls}" text-anchor="middle">{s}</text>'
        g.append(vlab(lx,'',lv,'pre'))
        g.append(vlab(ax,'',av,'rv'))
        svg=f'<svg viewBox="0 0 {VW} {H}" role="img" aria-label="{PN[p]}: {prev} election {lv:.1f}, {nxt} result {av:.1f}">{"".join(g)}</svg>'
        rows.append((p,eff,B['share'][p],svg,ty/H*100,1.5/H*100,(H-3)/H*100))
    ev=lambda v: '&asymp;0' if abs(v)<0.05 else (('+' if v>0 else '&minus;')+f'{abs(v):.1f}')
    def ecell(v,colour,big=False,typ=50):
        w=min(abs(v)*24,50)
        side='left' if v>=0 else 'right'
        colour='var(--alp)' if v>0 else 'var(--lnp)'
        return (f'<div class="dp-e{" dp-e-net" if big else ""}" style="--ty:{typ:.2f}%"><span class="dp-bar" style="{side}:50%;--w:{w:.1f}%;background:{colour}"></span>'
                f'<span class="dp-ev rv" style="{side}:calc(50% + {w:.1f}% + 4px)">{ev(v)}</span></div>')
    x50=X(50)
    head=('<div class="dp-row dp-hrow"><div class="dp-h"></div><div class="dp-ax"><svg viewBox="0 0 460 44" aria-hidden="true">'
          + f'<text x="{x50+10:.1f}" y="12" class="dfr" style="fill:var(--alp-text,var(--alp))">Labor&#8209;friendly flows</text><path d="M{x50+122:.1f},8 h18 m-5,-4 l5,4 l-5,4" class="dfa" style="stroke:var(--alp)"/>'
          + f'<text x="{x50-10:.1f}" y="12" class="dfr" text-anchor="end" style="fill:var(--lnp-text,var(--lnp))">Coalition&#8209;friendly flows</text><path d="M{x50-150:.1f},8 h-18 m5,-4 l-5,4 l5,4" class="dfa" style="stroke:var(--lnp)"/>'
          + f'<line x1="{x50:.1f}" x2="{x50:.1f}" y1="0" y2="21" class="d50"/>'
          + ''.join(f'<text x="{X(v):.1f}" y="35" text-anchor="middle" class="dax">{v}</text><line x1="{X(v):.1f}" x2="{X(v):.1f}" y1="39" y2="45" class="dtk"/>' for v in range(20,91,10))
          + '</svg></div><div class="dp-eh rv">Effect on Labor&rsquo;s 2PP</div></div>')
    body=''
    for p,eff,sh,svg,typ,bt,bh in rows:
        body+=(f'<div class="dp-row"><div class="dp-band" style="top:{bt:.2f}%;height:{bh:.2f}%;background:color-mix(in oklab, var(--{p}) 16%, var(--bg))"></div><div class="dp-l" style="--ty:{typ:.2f}%"><span class="dp-n" style="color:var(--{p}-text,var(--{p}))">{PN[p]}</span>'
               f'<span class="dp-sh rv">{sh:.1f}% of the vote</span></div><div class="dp-t">{svg}</div>{ecell(eff,f"var(--{p})",typ=typ)}</div>')
    body+=(f'<div class="dp-row dp-nrow"><div class="dp-btn">@@BTN@@</div><div class="dp-l dp-net rv"><span class="dp-n">Net</span><span class="dp-sh">Result v last&#8209;election flows</span></div>'
           f'<div class="dp-t dp-net rv"></div>{ecell(net,"var(--ink)",True).replace("dp-e dp-e-net","dp-e dp-e-net dp-net rv")}</div>')
    sy=dict(state_keys)
    btn=(f'<button class="ft-btn" type="button" aria-pressed="false" onclick="var f=this.closest(\'figure\'),on=f.classList.toggle(\'on\');this.setAttribute(\'aria-pressed\',on);this.firstChild.textContent=on?\'Hide the {nxt} result \':\'Reveal the {nxt} result \'">Reveal the {nxt} result <span aria-hidden="true">&#9656;</span></button>')
    foot=''.join(f'<div>{n}</div>' for n in notes)+f'<div>Source: {source}</div>'
    return f'''<figure class="ft" id="{cid}">
<div class="ft-rule"></div>
<div class="ft-t">{title}</div>
<div class="ft-s dp-key">{sub}. <span><svg width="10" height="10" viewBox="-6 -6 12 12"><circle r="5" fill="currentColor"/></svg>&nbsp;= <span class="pre">{prev} federal election</span><span class="rv">{nxt} federal election (faded: {prev})</span>;</span> <span><svg width="10" height="10" viewBox="-6 -6 12 12"><path d="M0,-5 L5,4 L-5,4 Z" fill="currentColor"/></svg>&nbsp;= {sy["qld"]} Qld,</span> <span><svg width="10" height="10" viewBox="-6 -6 12 12"><path d="M0,-5 L5,0 L0,5 L-5,0 Z" fill="currentColor"/></svg>&nbsp;= {sy["wa"]} WA state elections;</span> <span><svg width="10" height="10" viewBox="-6 -6 12 12"><path d="M-3.4,-3.4L3.4,3.4M3.4,-3.4L-3.4,3.4" stroke="var(--onp)" stroke-width="1.9" stroke-linecap="round"/></svg>&nbsp;= Newspoll&rsquo;s {nxt} estimate for One Nation.</span></div>
<div class="dp">{head}{body.replace('@@BTN@@', btn)}</div>
<figcaption class="ft-f">{foot}</figcaption>
</figure>'''
