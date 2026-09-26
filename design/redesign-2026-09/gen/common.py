import json, os
import os
S = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
G = json.load(open(S + 'gen/geom.json'))
OUT = S + 'canvas/project/'

ALP, LNP, ONP, ONPT, INK, G2, G3 = '#B9463F', '#356697', '#CC7C37', '#9E5200', '#171717', '#4A4843', '#6B6862'

COPY_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round"><rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4"></path></svg>'
EXPAND_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round"><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"></path></svg>'

def copy_btn(label):
    return f'<button class="copy" aria-label="Copy chart: {label}" title="Copy chart">{COPY_SVG}</button>'

def expand_btn(label):
    return f'<button class="copy" aria-label="Expand {label}" title="Expand">{EXPAND_SVG}</button>'

HELMET = '''<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Crimson+Text:wght@600;700&amp;family=IBM+Plex+Sans:wght@400;500;600&amp;display=swap" rel="stylesheet">
<style>
body{margin:0;background:#FAF9F6;color:#171717;font-family:"IBM Plex Sans",system-ui,sans-serif}
a{color:#171717}a:hover{color:#B9463F}
button{font:inherit;cursor:pointer}
.num{font-variant-numeric:tabular-nums}
svg text{font-family:"IBM Plex Sans",system-ui,sans-serif}
.grid{stroke:#E6E4DF;stroke-width:1;fill:none}
.base{stroke:#9A968E;stroke-width:1;fill:none}
.even{stroke:#9A968E;stroke-width:1;stroke-dasharray:3 3;fill:none}
.zero{stroke:#9A968E;stroke-width:1;fill:none}
.ax{font-size:__AX__px;fill:#6B6862}
.ev{stroke:#C9C6BF;stroke-width:1;stroke-dasharray:1 3;fill:none}
.evt{font-size:12px;font-weight:500;fill:#4A4843}
.evn{fill:#FAF9F6;stroke:#6B6862;stroke-width:1}
.evnt{font-size:9px;font-weight:600;fill:#4A4843;text-anchor:middle}
.dots{fill:none;stroke-width:__DOT__;stroke-linecap:round}
.ln{fill:none;stroke-linejoin:round;stroke-linecap:round}
.halo{paint-order:stroke;stroke:#FAF9F6;stroke-width:4px;stroke-linejoin:round}
.end{font-size:13px;font-weight:600}
.sub{font-size:13px}
.val{font-size:12px;font-weight:600;fill:#171717;text-anchor:middle}
.tab{min-height:44px;padding:0 12px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:transparent;font-size:15px;color:#6B6862;white-space:nowrap}
.tab[aria-pressed="true"]{border-bottom-color:#171717;font-weight:600;color:#171717}
.tab:hover{color:#171717}
.tab:focus-visible,.check:focus-within,.help:focus-visible{outline:2px solid #171717;outline-offset:2px;border-radius:4px}
.copy{width:44px;height:44px;flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:8px;background:transparent;color:#6B6862;cursor:pointer}
.copy:hover{background:#EFEDE8;color:#171717}
.copy:focus-visible{outline:2px solid #171717;outline-offset:2px}
.help{width:44px;height:44px;flex-shrink:0;display:flex;align-items:center;justify-content:center;text-decoration:none;border-radius:8px}
.help:hover{background:#EFEDE8}
.help span{width:20px;height:20px;box-sizing:border-box;border-radius:10px;border:1.5px solid #6B6862;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:#4A4843}
.check{min-height:44px;display:flex;align-items:center;gap:10px;font-size:14px;color:#171717;cursor:pointer;white-space:nowrap}
.check input{width:18px;height:18px;margin:0;accent-color:#171717;cursor:pointer}
.key{display:flex;align-items:center;gap:8px}
</style>
</helmet>'''

def page(title, w, h, body, ax=12, dot=5):
    helmet = HELMET.replace('__AX__', str(ax)).replace('__DOT__', str(dot))
    pad = '56px 64px' if w > 400 else '28px 20px'
    return f'''<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
{helmet}
<div style="width: {w}px; height: {h}px; box-sizing: border-box; padding: {pad}; display: flex; flex-direction: column; background: #FAF9F6">
{body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
renderVals() {{
return {{}};
}}
}}
</script>
</body>
</html>
'''

def fmt(v):
    return f'{v:.1f}'.replace('-', '−')

# ---------------------------------------------------------------- hero (lead axis)
ROWS = {
    'imp': [
        dict(key='on', name='Labor v One Nation', rival='One Nation', a='51.2', b='48.8', bcol=ONPT,
             verdict='Too close to call', lead='2.4', half='2.6',
             change='Labor ▼ 0.8 on a month ago, within the margin',
             p=(2.4, 2.6, 'Implied flows', 'flow range'), s=(8.6, 3.4, 'As published', '95% interval')),
        dict(key='co', name='Labor v Coalition', rival='Coalition', a='51.6', b='48.4', bcol=LNP,
             verdict='Labor ahead', lead='3.2', half='2.4',
             change='Labor ▼ 0.1 on a month ago, within the margin · ▼ 3.6 since the 2025 election',
             p=(3.2, 2.4, 'Implied flows', '95% interval'), s=(4.0, 3.4, 'As published', '95% interval')),
    ],
    'pub': [
        dict(key='on', name='Labor v One Nation', rival='One Nation', a='54.3', b='45.7', bcol=ONPT,
             verdict='Labor ahead', lead='8.6', half='3.4',
             change='Labor ▼ 0.1 on a month ago, within the margin',
             p=(8.6, 3.4, 'As published', '95% interval'), s=(2.4, 2.6, 'Implied flows', 'flow range')),
        dict(key='co', name='Labor v Coalition', rival='Coalition', a='52.0', b='48.0', bcol=LNP,
             verdict='Labor ahead', lead='4.0', half='3.4',
             change='Labor ▲ 0.2 on a month ago, within the margin · ▼ 3.2 since the 2025 election',
             p=(4.0, 3.4, 'As published', '95% interval'), s=(3.2, 2.4, 'Implied flows', '95% interval')),
    ],
}

def lead_svg_desktop(r):
    W, Z, K = 782, 452, 27.5
    x = lambda v: Z + K * v
    (pl, ph, pn, pt), (sl, sh, sn, st) = r['p'], r['s']
    g = []
    g.append(f'<path class="grid" d="M{x(-10):g} 0V80M{x(-5):g} 0V80M{x(5):g} 0V80M{x(10):g} 0V80"></path>')
    g.append(f'<path class="zero" d="M{Z} 0V80"></path>')
    # primary basis
    g.append(f'<text class="sub" x="110" y="33" style="text-anchor: end; font-weight: 600; fill: {INK}">{pn}</text>')
    lo, hi = x(pl - ph), x(pl + ph)
    g.append(f'<rect x="{lo:g}" y="22" width="{hi - lo:g}" height="14" rx="2" style="fill: {ALP}; opacity: 0.2"></rect>')
    g.append(f'<path d="M{lo:g} 22V36M{hi:g} 22V36" style="stroke: {ALP}; stroke-width: 2"></path>')
    g.append(f'<circle cx="{x(pl):g}" cy="29" r="7" style="fill: {ALP}; stroke: #FAF9F6; stroke-width: 2"></circle>')
    g.append(f'<text class="val num halo" x="{x(pl):g}" y="15">{fmt(pl)}</text>')
    # other basis
    g.append(f'<text class="sub" x="110" y="69" style="text-anchor: end; fill: {G3}">{sn}</text>')
    lo, hi = x(sl - sh), x(sl + sh)
    g.append(f'<path d="M{lo:g} 65H{hi:g}" style="stroke: {G3}; stroke-width: 2; stroke-linecap: round"></path>')
    g.append(f'<circle cx="{x(sl):g}" cy="65" r="5.5" style="fill: #FAF9F6; stroke: {G3}; stroke-width: 2"></circle>')
    g.append(f'<text class="val num halo" x="{x(sl):g}" y="52" style="font-weight: 500; fill: {G2}">{fmt(sl)}</text>')
    aria = (f"Labor’s lead over {'One Nation' if r['key'] == 'on' else 'the Coalition'}: {fmt(pl)} points {pn.lower()}, "
            f"{pt} {fmt(pl - ph)} to {fmt(pl + ph)}; {fmt(sl)} points {sn.lower()}, {st} {fmt(sl - sh)} to {fmt(sl + sh)}.").replace(' points implied', ' points on implied')
    return (f'<svg viewBox="0 0 {W} 80" width="{W}" height="80" role="img" aria-label="{aria}" style="display: block; overflow: visible">\n'
            + '\n'.join(g) + '\n</svg>')

def hero_desktop(basis):
    out = []
    out.append('<div style="margin-top: 20px; display: grid; grid-template-columns: 330px 782px; column-gap: 40px">\n<div></div>\n'
               '<svg viewBox="0 0 782 22" width="782" height="22" aria-hidden="true" style="display: block">\n'
               '<text class="ax" x="122" y="15">◀ Rival ahead</text>\n'
               '<text class="ax" x="452" y="15" style="text-anchor: middle; font-weight: 600; fill: #4A4843">Tied</text>\n'
               '<text class="ax" x="782" y="15" style="text-anchor: end">Labor ahead ▶</text>\n</svg>\n</div>')
    for r in ROWS[basis]:
        out.append(f'''<div style="display: grid; grid-template-columns: 330px 782px; column-gap: 40px; align-items: center; padding: 18px 0; border-top: 1px solid #DDDCD8">
<div style="display: flex; flex-direction: column; gap: 6px">
<span style="font-size: 15px; font-weight: 600">{r['name']}</span>
<span class="num" style="font-size: 40px; font-weight: 500; line-height: 1.05; letter-spacing: -0.02em"><span style="color: {ALP}">{r['a']}</span><span style="padding: 0 8px; font-weight: 400; color: #9A968E">–</span><span style="color: {r['bcol']}">{r['b']}</span></span>
<span class="num" style="font-size: 15px; line-height: 1.4; color: {G2}"><b style="font-weight: 600; color: {INK}">{r['verdict']}</b> · lead {r['lead']} ± {r['half']}</span>
<span class="num" style="font-size: 13px; line-height: 1.45; color: {G3}">{r['change']}</span>
</div>
{lead_svg_desktop(r)}
</div>''')
    out.append('<div style="display: grid; grid-template-columns: 330px 782px; column-gap: 40px; border-top: 1px solid #DDDCD8">\n<div></div>\n'
               '<svg viewBox="0 0 782 24" width="782" height="24" aria-hidden="true" style="display: block">\n'
               '<text class="ax" x="110" y="17" style="text-anchor: end">Lead, points</text>\n'
               + ''.join(f'<text class="ax num" x="{452 + 27.5 * v:g}" y="17" style="text-anchor: middle">{abs(v)}</text>\n' for v in (-10, -5, 5, 10))
               + '</svg>\n</div>')
    out.append('<p style="margin: 10px 0 0; max-width: 900px; font-size: 13px; line-height: 1.5; color: #6B6862">Bars and whiskers are 95% intervals, except for Labor v One Nation on implied flows, where they show the flow range: doubt about the flows themselves, since no federal election has counted this pairing.</p>')
    return '\n'.join(out)

def basis_row(basis, phone=False):
    n = '8' if basis == 'imp' else '5'
    b1 = 'true' if basis == 'imp' else 'false'
    b2 = 'false' if basis == 'imp' else 'true'
    meta = f'Weighted aggregate · {n} polls in the 21 days to 21 Sep'
    if phone:
        return f'''<div style="margin-top: 22px; display: flex; align-items: center; border-bottom: 1px solid #DDDCD8">
<div role="group" aria-label="Preferences" style="display: flex; flex-grow: 1">
<button class="tab" aria-pressed="{b1}" style="flex: 1; padding: 0 6px">Implied flows</button>
<button class="tab" aria-pressed="{b2}" style="flex: 1; padding: 0 6px">As published</button>
</div>
<a class="help" href="/preference-flows/" aria-label="How the two bases work" title="How the two bases work"><span>?</span></a>
</div>
<span class="num" style="margin-top: 8px; font-size: 12px; color: #6B6862">{meta}</span>'''
    return f'''<div style="margin-top: 28px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #DDDCD8">
<span style="margin-right: 4px; font-size: 13px; font-weight: 600; color: #4A4843">Preferences</span>
<div role="group" aria-label="Preferences" style="display: flex; gap: 4px">
<button class="tab" aria-pressed="{b1}">Implied flows</button>
<button class="tab" aria-pressed="{b2}">As published</button>
</div>
<a class="help" href="/preference-flows/" aria-label="How the two bases work" title="How the two bases work"><span>?</span></a>
<span style="flex-grow: 1"></span>
<span class="num" style="font-size: 13px; color: #6B6862">{meta}</span>
</div>'''

# ---------------------------------------------------------------- trend chart
EVENTS = {  # key: (label, row, anchor) for desktop
    'split1': ('1st Coalition split', 1, 'start'),
    'bondi': ('Bondi shooting', 1, 'start'),
    'hormuz': ('Hormuz crisis', 1, 'start'),
    'budget': ('2026 Budget', 1, 'start'),
}

def spread(items, gap):
    """items: list of [y, ...]; push apart to at least gap, keeping order by y."""
    items = sorted(items, key=lambda t: t[0])
    for _ in range(50):
        moved = False
        for i in range(1, len(items)):
            d = items[i][0] - items[i - 1][0]
            if d < gap:
                push = (gap - d) / 2
                items[i - 1][0] -= push
                items[i][0] += push
                moved = True
        if not moved:
            break
    return items

def chart(kind, emph, compare, aria):
    d = G[kind]
    ph = kind == 'p'
    W, H = d['W'], d['H']
    OX, OY = (26, 34) if ph else (36, 50)
    SW = 350 if ph else 1152
    SH = OY + H + (26 if ph else 28)
    y = {int(k): v for k, v in d['y'].items()}
    g = []
    g.append(f'<g transform="translate({OX} {OY})">')
    g.append(f'<path class="grid" d="M0 {y[65]}H{W}M0 {y[60]}H{W}M0 {y[55]}H{W}"></path>')
    g.append(f'<path class="even" d="M0 {y[50]}H{W}"></path>')
    g.append(f'<path class="base" d="M0 {y[45]}H{W}"></path>')
    for v, lab in ((65, '65%'), (60, '60'), (55, '55'), (50, '50'), (45, '45')):
        g.append(f'<text class="ax num" x="-6" y="{y[v] + 4}" style="text-anchor: end">{lab}</text>')
    # x ticks
    ticks = d['ticks']
    tl = {'Jul 2025': 'Jul 25', 'Oct': 'Oct', 'Jan 2026': 'Jan 26', 'Apr': 'Apr', 'Jul': 'Jul'} if ph else {k: k for k in ticks}
    g.append('<path class="base" d="' + ''.join(f'M{x} {H}v4' for x in ticks.values()) + '"></path>')
    for k, xv in ticks.items():
        g.append(f'<text class="ax" x="{xv}" y="{H + (18 if ph else 20)}" style="text-anchor: middle">{tl[k]}</text>')
    # events
    ev = d['ev']
    if ph:
        marks = [(ev['split1'], '1'), ((ev['joyce'] + ev['bondi']) / 2 if emph == 'on' else ev['bondi'], '2'), (ev['split2'], '3')]
        if emph == 'co':
            marks.append((ev['taylor'], '4')); marks += [(ev['hormuz'], '5'), (ev['budget'], '6')]
        else:
            marks += [(ev['hormuz'], '4'), (ev['budget'], '5')]
        g.append('<path class="ev" d="' + ''.join(f'M{x:g} -14V{H}' for x, _ in marks) + '"></path>')
        for x, n in marks:
            g.append(f'<circle class="evn" cx="{x:g}" cy="-21" r="7"></circle><text class="evnt" x="{x:g}" y="-18">{n}</text>')
    else:
        rows = [('split1', '1st Coalition split', 1, 'start'), ('bondi', 'Bondi shooting', 1, 'start'),
                ('hormuz', 'Hormuz crisis', 1, 'start'), ('budget', '2026 Budget', 1, 'start')]
        if emph == 'on':
            rows += [('joyce', 'Joyce → ONP', 2, 'end'), ('split2', '2nd Coalition split', 2, 'start')]
        else:
            rows += [('split2', '2nd Coalition split', 2, 'end'), ('taylor', 'Taylor leads Libs', 2, 'start')]
        g.append('<path class="ev" d="' + ''.join(f'M{ev[k]} {-30 if r == 1 else -14}V{H}' for k, _, r, _ in rows) + '"></path>')
        for k, lab, r, anc in rows:
            xv = ev[k] + (5 if anc == 'start' else -5)
            sty = ' style="text-anchor: end"' if anc == 'end' else ''
            g.append(f'<text class="evt halo" x="{xv:g}" y="{-36 if r == 1 else -20}"{sty}>{lab}</text>')
    # direction labels near the tie line
    g.append(f'<text class="ax" x="{4 if ph else 6}" y="{y[50] - 7}">▲ Labor ahead</text>')
    g.append(f'<text class="ax" x="{4 if ph else 6}" y="{y[50] + (15 if ph else 17)}">▼ Rival ahead</text>')
    # layers
    op_band = 0.12 if compare else 0.16
    op_dots = 0.25 if compare else 0.35
    if emph == 'on':
        g.append(f'<path d="{d["onb"]}" style="fill: {ONP}; opacity: {op_band}"></path>')
        g.append(f'<path class="dots" d="{d["don"]}" style="stroke: {ONP}; opacity: {op_dots}"></path>')
        g.append(f'<path class="ln" d="{d["co"]}" style="stroke: {LNP}; stroke-width: {1.75 if ph else 2}"></path>')
        if compare:
            g.append(f'<path class="ln" d="{d["pubon"]}" style="stroke: {ONPT}; stroke-width: {2 if ph else 2.25}; stroke-dasharray: 6 4"></path>')
        g.append(f'<path class="ln" d="{d["on"]}" style="stroke: {ONP}; stroke-width: {2.5 if ph else 3}"></path>')
    else:
        if compare:
            g.append(f'<path d="{d["fsb"]}" style="fill: url(#hatch-{kind})"></path>')
        g.append(f'<path d="{d["cob"]}" style="fill: {LNP}; opacity: {0.12 if compare else 0.14}"></path>')
        g.append(f'<path class="dots" d="{d["dco"]}" style="stroke: {LNP}; opacity: {0.22 if compare else 0.3}"></path>')
        g.append(f'<path class="ln" d="{d["on"]}" style="stroke: {ONP}; stroke-width: {1.75 if ph else 2}"></path>')
        if compare:
            g.append(f'<path class="ln" d="{d["pubco"]}" style="stroke: {LNP}; stroke-width: {2 if ph else 2.25}; stroke-dasharray: 6 4"></path>')
        g.append(f'<path class="ln" d="{d["co"]}" style="stroke: {LNP}; stroke-width: {2.5 if ph else 3}"></path>')
    ex, ey = d['elec']
    g.append(f'<circle cx="{ex}" cy="{ey}" r="{4 if ph else 5}" style="fill: #FAF9F6; stroke: {INK}; stroke-width: 1.75"></circle>')
    if not ph:
        g.append(f'<text class="ax halo" x="{ex + 10:g}" y="{ey + 22:g}" style="fill: {G2}">2025 election: 55.2</text>')
    g.append('</g>')
    # end labels (desktop only)
    if not ph:
        labs = []
        if emph == 'on':
            labs.append([OY + d['on_end'][1], 'v One Nation', ONPT, 600])
            labs.append([OY + d['co_end'][1], 'v Coalition', LNP, 500])
            if compare:
                labs.append([OY + d['pubon_end'][1], 'As published', ONPT, 500])
        else:
            labs.append([OY + d['co_end'][1], 'v Coalition', LNP, 600])
            labs.append([OY + d['on_end'][1], 'v One Nation', ONPT, 500])
            if compare:
                labs.append([OY + d['pubco_end'][1], 'As published', LNP, 500])
                labs.append([OY + d['fs_end'][1], 'On 2022 flows', LNP, 500])
        for yy, t, c, wgt in spread(labs, 16):
            g.append(f'<text class="end" x="{OX + W + 8:g}" y="{yy + 4:.1f}" style="fill: {c}; font-weight: {wgt}">{t}</text>')
    defs = ''
    if emph == 'co' and compare:
        defs = (f'<defs><pattern id="hatch-{kind}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
                f'<path d="M0 0V6" style="stroke: {LNP}; stroke-width: 1.5; opacity: 0.45"></path></pattern></defs>\n')
    return (f'<svg viewBox="0 0 {SW} {SH}" width="{SW}" height="{SH}" role="img" aria-label="{aria}" style="display: block; overflow: visible">\n'
            + defs + '\n'.join(g) + '\n</svg>')

def chart_controls(emph, compare, cmp_label, phone=False):
    e1 = 'true' if emph == 'on' else 'false'
    e2 = 'false' if emph == 'on' else 'true'
    chk = ' checked' if compare else ''
    ranges = ''.join(f'<button class="tab" aria-pressed="{"true" if r == "All" else "false"}" style="font-size: 14px; padding: 0 {8 if phone else 10}px">{r}</button>' for r in ('3 mo', '6 mo', '12 mo', 'All'))
    if phone:
        return f'''<div role="group" aria-label="Emphasise" style="margin-top: 14px; display: flex; border-bottom: 1px solid #DDDCD8">
<button class="tab" aria-pressed="{e1}" style="flex: 1">v One Nation</button>
<button class="tab" aria-pressed="{e2}" style="flex: 1">v Coalition</button>
</div>
<div style="display: flex; align-items: center; border-bottom: 1px solid #DDDCD8">
<div role="group" aria-label="Time range" style="display: flex">{ranges}</div>
<span style="flex-grow: 1"></span>
{expand_btn('two-party preferred chart')}
</div>
<label class="check" style="margin-top: 4px"><input type="checkbox"{chk}>{cmp_label}</label>'''
    return f'''<div style="margin-top: 16px; display: flex; align-items: center; border-bottom: 1px solid #DDDCD8">
<div role="group" aria-label="Emphasise" style="display: flex; gap: 4px">
<button class="tab" aria-pressed="{e1}">v One Nation</button>
<button class="tab" aria-pressed="{e2}">v Coalition</button>
</div>
<span style="width: 1px; height: 20px; margin: 0 14px; background: #DDDCD8"></span>
<div role="group" aria-label="Time range" style="display: flex; gap: 2px">{ranges}</div>
<span style="flex-grow: 1"></span>
<label class="check"><input type="checkbox"{chk}>{cmp_label}</label>
<span style="width: 12px"></span>
{expand_btn('two-party preferred chart')}
</div>'''

def key_item(svg, text):
    return f'<span class="key">{svg}{text}</span>'

K_DOT = lambda c: f'<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="2.5" style="fill: {c}; opacity: 0.55"></circle></svg>'
K_LINEBAND = lambda c: f'<svg width="24" height="14" viewBox="0 0 24 14" aria-hidden="true"><rect x="0" y="2" width="24" height="10" rx="2" style="fill: {c}; opacity: 0.2"></rect><path d="M1 7H23" style="stroke: {c}; stroke-width: 3; stroke-linecap: round"></path></svg>'
K_LINE = lambda c, w=2: f'<svg width="24" height="14" viewBox="0 0 24 14" aria-hidden="true"><path d="M1 7H23" style="stroke: {c}; stroke-width: {w}; stroke-linecap: round"></path></svg>'
K_DASH = lambda c: f'<svg width="24" height="14" viewBox="0 0 24 14" aria-hidden="true"><path d="M1 7H23" style="stroke: {c}; stroke-width: 2.25; stroke-dasharray: 6 4"></path></svg>'
K_HATCH = lambda c: f'<svg width="24" height="14" viewBox="0 0 24 14" aria-hidden="true"><defs><pattern id="kh" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V5" style="stroke: {c}; stroke-width: 1.5; opacity: 0.6"></path></pattern></defs><rect x="0" y="2" width="24" height="10" rx="2" style="fill: url(#kh)"></rect></svg>'
K_RING = f'<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" style="fill: #FAF9F6; stroke: {INK}; stroke-width: 1.75"></circle></svg>'

def chart_key(emph, compare, copy_label, phone=False):
    if emph == 'on':
        items = [key_item(K_DOT(ONP), 'One poll, implied flows'),
                 key_item(K_LINEBAND(ONP), 'Monthly average and flow range'),
                 key_item(K_LINE(LNP), 'v Coalition, monthly average')]
        if compare:
            items.append(key_item(K_DASH(ONPT), 'As published, monthly average'))
    else:
        items = [key_item(K_DOT(LNP), 'One poll, implied flows'),
                 key_item(K_LINEBAND(LNP), 'Monthly average and 95% interval'),
                 key_item(K_LINE(ONP), 'v One Nation, monthly average')]
        if compare:
            items.append(key_item(K_HATCH(LNP), 'Range if One Nation preferences flowed as in 2022'))
            items.append(key_item(K_DASH(LNP), 'As published, monthly average'))
    items.append(key_item(K_RING, '2025 election result'))
    if phone:
        return ('<div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid #DDDCD8; display: flex; flex-direction: column; gap: 8px; font-size: 12px; color: #4A4843">\n'
                + '\n'.join(items) + '\n</div>')
    return ('<div style="margin-top: 16px; padding-top: 10px; border-top: 1px solid #DDDCD8; display: flex; align-items: center; flex-wrap: wrap; column-gap: 24px; row-gap: 4px; font-size: 13px; color: #4A4843">\n'
            + '\n'.join(items) + f'\n<span style="flex-grow: 1"></span>\n{copy_btn(copy_label)}\n</div>')

