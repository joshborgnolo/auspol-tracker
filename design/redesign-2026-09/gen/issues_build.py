import json
import os
S = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
OUT = S + 'canvas/project/'
I = json.load(open(S + 'data/issues_main.json'))
LIST = I['list']
BY = {x['id']: x for x in LIST}

ALP, LNP, ONP = '#B9463F', '#356697', '#CC7C37'
PCOL = {'alp': ALP, 'lnp': LNP, 'onp': ONP}
PINK = {'alp': ALP, 'lnp': LNP, 'onp': '#9E5200'}
PNAME = {'alp': 'Labor', 'lnp': 'Coalition', 'onp': 'One Nation'}
PARTIES = ['alp', 'lnp', 'onp']
INK, G2, G3 = '#171717', '#4A4843', '#6B6862'
SEL_BG = '#F1EFEA'

COPY_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round"><rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4"></path></svg>'
EXPAND_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round"><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"></path></svg>'
copy_btn = lambda label: f'<button class="copy" aria-label="Copy chart: {label}" title="Copy chart">{COPY_SVG}</button>'
expand_btn = lambda label: f'<button class="copy" aria-label="Expand {label}" title="Expand">{EXPAND_SVG}</button>'

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
.even{stroke:#9A968E;stroke-width:1;stroke-dasharray:2 3;fill:none}
.ax{font-size:__AX__px;fill:#6B6862}
.ln{fill:none;stroke-width:__LW__;stroke-linejoin:round;stroke-linecap:round}
.end{font-size:__AX__px;font-weight:600}
.halo{paint-order:stroke;stroke:#FAF9F6;stroke-width:4px;stroke-linejoin:round}
.tab{min-height:44px;padding:0 12px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:transparent;font-size:15px;color:#6B6862;white-space:nowrap}
.tab[aria-pressed="true"]{border-bottom-color:#171717;font-weight:600;color:#171717}
.tab:hover{color:#171717}
.chipb{min-height:44px;padding:0 14px;border:1px solid #DDDCD8;border-radius:22px;background:transparent;font-size:14px;color:#4A4843;white-space:nowrap;flex-shrink:0}
.chipb[aria-pressed="true"]{background:#171717;border-color:#171717;color:#FAF9F6;font-weight:600}
.row{cursor:pointer;border-top:1px solid #E6E4DF}
.row:hover{background:#F5F3EE}
.row[aria-pressed="true"]{background:#F1EFEA;box-shadow:inset 3px 0 0 #171717;border-top-color:transparent;border-radius:0 8px 8px 0}
.row:focus-visible,.tab:focus-visible,.chipb:focus-visible,.how:focus-visible{outline:2px solid #171717;outline-offset:2px}
.copy{width:44px;height:44px;flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:8px;background:transparent;color:#6B6862;cursor:pointer}
.copy:hover{background:#EFEDE8;color:#171717}
.copy:focus-visible{outline:2px solid #171717;outline-offset:2px}
.how{min-height:44px;padding:0;border:0;background:none;display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500;color:#171717}
.key{display:flex;align-items:center;gap:8px}
</style>
</helmet>'''

def page(title, w, h, body, ax=12, lw=2.25):
    pad = '56px 64px' if w > 400 else '28px 20px'
    helmet = HELMET.replace('__AX__', str(ax)).replace('__LW__', str(lw))
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

f1 = lambda v: f'{v:.1f}'.rstrip('0').rstrip('.')

# ---------------------------------------------------------------- shared copy
def verdict(x):
    o = x['own']
    if o['leadSig']:
        return f"{PNAME[o['lead']]} ahead", PINK[o['lead']], 600
    if o.get('pairSig'):
        return f"{PNAME[o['third']]} behind", G2, 600
    return 'No clear lead', G3, 500

def eyebrow(phone=False):
    if phone:
        return ('<div style="display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: #6B6862">\n'
                '<span style="font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #171717">The issues</span>\n'
                '<span>What matters most, and who is trusted on it · last six weeks</span>\n</div>')
    return ('<div style="display: flex; align-items: baseline; gap: 16px; font-size: 13px; color: #6B6862">\n'
            '<span style="font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #171717">The issues</span>\n'
            '<span>What voters say matters most, and who they think is best on it · Resolve, Ipsos, RedBridge and YouGov, last six weeks</span>\n</div>')

def view_tabs(which, phone=False):
    a = 'true' if which == 'trust' else 'false'
    b = 'false' if which == 'trust' else 'true'
    st = ' style="flex: 1"' if phone else ''
    return (f'<div role="group" aria-label="View" style="margin-top: {18 if phone else 24}px; display: flex; gap: {0 if phone else 4}px; border-bottom: 1px solid #DDDCD8">\n'
            f'<button class="tab" aria-pressed="{a}"{st}>Who’s trusted</button>\n<button class="tab" aria-pressed="{b}"{st}>What matters to whom</button>\n</div>')

def h1(text, phone=False):
    if phone:
        return f'<h1 style="margin: 20px 0 0; font-family: \'Crimson Text\', Georgia, serif; font-weight: 700; font-size: 30px; line-height: 1.1; letter-spacing: -0.01em">{text}</h1>'
    return f'<h1 style="margin: 28px 0 0; max-width: 1000px; font-family: \'Crimson Text\', Georgia, serif; font-weight: 700; font-size: 42px; line-height: 1.1; letter-spacing: -0.01em">{text}</h1>'

def dek(text, phone=False):
    if phone:
        return f'<p style="margin: 10px 0 0; font-size: 16px; line-height: 1.5; color: #3D3B37">{text}</p>'
    return f'<p style="margin: 12px 0 0; max-width: 880px; font-size: 18px; line-height: 1.5; color: #3D3B37">{text}</p>'

TRUST_H1 = 'One Nation has drawn level with the major parties on the cost of living'
TRUST_DEK = ('Seven in ten voters put the cost of living among their three most important issues. A third of those naming Labor, the Coalition or One Nation as best on it now pick One Nation, '
             'up from a fifth in December, and none of the three is clearly ahead. One Nation leads on immigration and crime, Labor on health and climate change, and the Coalition only on economic management.')
TRUST_DEK_PHONE = ('Seven in ten voters rank it in their top three. A third of those naming Labor, the Coalition or One Nation as best on it now pick One Nation, up from a fifth in December. '
                   'One Nation leads on immigration and crime, Labor on health and climate change, the Coalition only on the economy.')

# ---------------------------------------------------------------- dot plot per issue
def dotplot(x, W, H, bg, lo=20, hi=50, pad=8, r=5.5):
    k = (W - 2 * pad) / (hi - lo)
    X = lambda v: pad + (v - lo) * k
    v = x['own']['v']
    g = [f'<path class="grid" d="' + ''.join(f'M{X(t):g} 3V{H - 3}' for t in (20, 30, 40, 50)) + '"></path>',
         f'<path class="even" d="M{X(100 / 3):.1f} 3V{H - 3}"></path>']
    lead = x['own']['lead']
    for q in sorted(PARTIES, key=lambda q: (q == lead, v[q])):
        g.append(f'<circle cx="{X(v[q]):.1f}" cy="{H / 2:g}" r="{r}" style="fill: {PCOL[q]}; stroke: {bg}; stroke-width: 1.5"></circle>')
    aria = ', '.join(f'{PNAME[q]} {round(v[q])}' for q in PARTIES)
    return (f'<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="Best on {x["label"].lower()}: {aria}" style="display: block; overflow: visible">'
            + ''.join(g) + '</svg>')

def triplet(x, fs=14):
    v = x['own']['v']
    return (f'<span class="num" style="display: flex; gap: 9px; font-size: {fs}px; font-weight: 600">'
            + ''.join(f'<span style="color: {PINK[q]}">{round(v[q])}</span>' for q in PARTIES) + '</span>')

def salience(x, bar=60, fs=14):
    v = x['imp']['v']
    return (f'<span style="display: flex; align-items: center; gap: 8px"><span style="position: relative; width: {bar}px; height: 8px; border-radius: 4px; background: #E6E4DF">'
            f'<span style="position: absolute; left: 0; top: 0; bottom: 0; width: {v * bar / 80:.1f}px; border-radius: 4px; background: #6B6862"></span></span>'
            f'<span class="num" style="font-size: {fs}px; font-weight: 500">{round(v)}%</span></span>')

COLS = '176px 112px 212px 84px 132px'

def trust_table():
    out = []
    # header
    out.append(f'''<div style="display: grid; grid-template-columns: {COLS}; align-items: end; padding-bottom: 8px; font-size: 12px; line-height: 1.35; color: #6B6862">
<span></span>
<span>In voters’ top three</span>
<span style="grid-column: 3 / span 3; display: flex; flex-direction: column; gap: 4px"><span>Best on it · % of voters naming one of these three</span>
<span style="display: flex; gap: 14px; color: #4A4843"><span class="key"><span style="width: 9px; height: 9px; border-radius: 5px; background: {ALP}"></span>Labor</span><span class="key"><span style="width: 9px; height: 9px; border-radius: 5px; background: {LNP}"></span>Coalition</span><span class="key"><span style="width: 9px; height: 9px; border-radius: 5px; background: {ONP}"></span>One Nation</span></span></span>
</div>''')
    for x in LIST:
        sel = x['id'] == 'col'
        bg = SEL_BG if sel else '#FAF9F6'
        vt, vc, vw = verdict(x)
        extra = ''
        if x.get('grnTop'):
            extra = f'<span style="display: block; margin-top: 2px; font-size: 12px; font-weight: 400; line-height: 1.3; color: #6B6862">Greens first where offered</span>'
        aria = (f"{x['label']}: {round(x['imp']['v'])}% put it in their top three; " + ', '.join(f"{PNAME[q]} {round(x['own']['v'][q])}" for q in PARTIES) + f'; {vt}')
        out.append(f'''<div class="row" role="button" tabindex="0" aria-pressed="{'true' if sel else 'false'}" aria-label="{aria}" style="display: grid; grid-template-columns: {COLS}; align-items: center; min-height: 52px">
<span style="padding-left: 14px; font-size: 15px; font-weight: 600">{x['label']}</span>
{salience(x)}
{dotplot(x, 212, 28, bg)}
<span style="padding-left: 12px">{triplet(x)}</span>
<span style="padding-left: 14px; font-size: 14px; font-weight: {vw}; line-height: 1.3; color: {vc}">{vt}{extra}</span>
</div>''')
    # axis under the dot plot column
    k = (212 - 16) / 30
    ticks = ''.join(f'<text class="ax num" x="{8 + (t - 20) * k:g}" y="14" style="text-anchor: middle">{t}{"%" if t == 50 else ""}</text>' for t in (20, 30, 40, 50))
    out.append(f'''<div style="display: grid; grid-template-columns: {COLS}; border-top: 1px solid #E6E4DF">
<span></span><span></span>
<svg viewBox="0 0 212 34" width="212" height="34" aria-hidden="true" style="display: block; overflow: visible">{ticks}<text class="ax" x="{8 + (100 / 3 - 20) * k:.1f}" y="30" style="text-anchor: middle">⅓ each</text></svg>
</div>''')
    return '\n'.join(out)

# ---------------------------------------------------------------- the issue chart (cost of living)
def dec(ym_or_date):
    import datetime as dt
    d = dt.date.fromisoformat(ym_or_date if len(ym_or_date) == 10 else ym_or_date + '-01')
    return d.year + (d - dt.date(d.year, 1, 1)).days / 365

T0, T1 = dec('2025-12-01'), dec('2026-10-01')
TICKS = [('Jan ’26', dec('2026-01-01')), ('Mar', dec('2026-03-01')), ('May', dec('2026-05-01')), ('Jul', dec('2026-07-01')), ('Sep', dec('2026-09-01'))]

def spread(items, gap):
    items = sorted(items, key=lambda t: t[0])
    for _ in range(60):
        moved = False
        for i in range(1, len(items)):
            d = items[i][0] - items[i - 1][0]
            if d < gap:
                p = (gap - d) / 2
                items[i - 1][0] -= p; items[i][0] += p; moved = True
        if not moved:
            break
    return items

def issue_chart(x, SW, x0, W, top, ppt, lo=15, hi=55, phone=False, aria=''):
    X = lambda t: x0 + (t - T0) / (T1 - T0) * W
    Y = lambda v: top + (hi - v) * ppt
    H = (hi - lo) * ppt
    SH = top + H + (20 if phone else 24)
    g = []
    g.append('<path class="grid" d="' + ''.join(f'M{x0} {Y(t):g}H{x0 + W}' for t in (20, 30, 40, 50)) + '"></path>')
    for t in (20, 30, 40, 50):
        g.append(f'<text class="ax num" x="{x0 - 6}" y="{Y(t) + 4:g}" style="text-anchor: end">{t}{"%" if t == 50 else ""}</text>')
    g.append(f'<path class="base" d="M{x0} {Y(lo):g}H{x0 + W}' + ''.join(f'M{X(t):.1f} {Y(lo):g}v4' for _, t in TICKS) + '"></path>')
    for lab, t in TICKS:
        g.append(f'<text class="ax" x="{X(t):.1f}" y="{Y(lo) + (16 if phone else 18):g}" style="text-anchor: middle">{lab}</text>')
    M = x['monthly']
    mx = lambda ym: int(ym[:4]) + (int(ym[5:]) - 0.5) / 12
    for i, q in enumerate(PARTIES):
        up = 'L'.join(f'{X(mx(m[0])):.1f} {Y(m[1 + i] + m[4 + i]):.1f}' for m in M)
        dn = 'L'.join(f'{X(mx(m[0])):.1f} {Y(m[1 + i] - m[4 + i]):.1f}' for m in reversed(M))
        g.append(f'<path d="M{up}L{dn}Z" style="fill: {PCOL[q]}; opacity: 0.1"></path>')
    for i, q in enumerate(PARTIES):
        g.append('<g style="fill: ' + PCOL[q] + '; opacity: 0.55">' + ''.join(f'<circle cx="{X(dd[0]):.1f}" cy="{Y(dd[3 + i]):.1f}" r="{2.25 if phone else 2.5}"></circle>' for dd in x['dots']) + '</g>')
    for i, q in enumerate(PARTIES):
        g.append(f'<path class="ln" d="M' + 'L'.join(f'{X(mx(m[0])):.1f} {Y(m[1 + i]):.1f}' for m in M) + f'" style="stroke: {PCOL[q]}"></path>')
    last = M[-1]
    labs = [[Y(last[1 + i]), PNAME[q], PINK[q]] for i, q in enumerate(PARTIES)]
    for yy, t, c in spread(labs, 13 if phone else 14):
        g.append(f'<text class="end" x="{x0 + W + 6}" y="{yy + 4:.1f}" style="fill: {c}">{t}</text>')
    return (f'<svg viewBox="0 0 {SW} {SH:g}" width="{SW}" height="{SH:g}" role="img" aria-label="{aria}" style="display: block; overflow: visible">\n'
            + '\n'.join(g) + '\n</svg>')

COL_ARIA = ('Cost of living, who voters think is best, month by month, of those naming Labor, the Coalition or One Nation: '
            'Labor from 47.5 in December 2025 to 32.4 in September 2026, the Coalition from 31.1 to 33.0, One Nation from 21.3 to 34.6.')
CHART_TITLE = 'One Nation has gained significant ground since December'
CHART_SUB = 'Who voters think is best, month by month · % of those naming Labor, the Coalition or One Nation'

KEY_DOT = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="2.5" style="fill: #6B6862; opacity: 0.6"></circle></svg>'
KEY_LINE = '<svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true"><rect x="0" y="1" width="22" height="10" rx="2" style="fill: #6B6862; opacity: 0.15"></rect><path d="M1 6H21" style="stroke: #6B6862; stroke-width: 2.25; stroke-linecap: round"></path></svg>'

def chart_panel(phone=False):
    if phone:
        svg = issue_chart(BY['col'], 350, 26, 256, 8, 5, phone=True, aria=COL_ARIA)
    else:
        svg = issue_chart(BY['col'], 396, 30, 296, 10, 6, aria=COL_ARIA)
    head = (f'<div style="display: flex; align-items: center; gap: 4px">\n'
            f'<span style="flex-grow: 1; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #4A4843">Cost of living</span>\n'
            f'{expand_btn("cost of living chart")}\n{copy_btn("who is best on the cost of living")}\n</div>')
    return (head + '\n'
            + f'<h2 style="margin: 2px 0 0; font-family: \'Crimson Text\', Georgia, serif; font-weight: 700; font-size: {21 if phone else 24}px; line-height: 1.15">{CHART_TITLE}</h2>\n'
            + f'<p style="margin: 4px 0 0; font-size: {12 if phone else 13}px; line-height: 1.45; color: #6B6862">{CHART_SUB}</p>\n'
            + svg.replace('style="display: block', f'style="margin-top: {12 if phone else 16}px; display: block', 1) + '\n'
            + f'<div style="margin-top: 10px; display: flex; flex-wrap: wrap; column-gap: 16px; row-gap: 4px; font-size: 12px; color: #4A4843">'
            + f'<span class="key">{KEY_DOT}One poll</span><span class="key">{KEY_LINE}Monthly average and 95% interval</span></div>')

NOTES = ('<p style="margin: 0; font-size: 13px; line-height: 1.55; color: #4A4843">About a third of voters name none of the three on most issues, and half on climate change. '
         'Where the Greens are offered, they come first on climate change: 26% at RedBridge, 28% at YouGov.</p>\n'
         '<p style="margin: 8px 0 0; font-size: 13px; line-height: 1.55; color: #4A4843">RedBridge and Ipsos word the importance question differently and disagree most on health: 37% in RedBridge’s latest poll, 20% in Ipsos’s. '
         'The grey bars sit midway between the two pollsters’ usual figures.</p>')
HOW = '<button class="how" aria-expanded="false"><span aria-hidden="true" style="font-size: 11px">▶</span>How to read these figures</button>'

# ================================================================ desktop: who's trusted
desk = '\n\n'.join([
    eyebrow(),
    view_tabs('trust'),
    h1(TRUST_H1) + '\n' + dek(TRUST_DEK),
    f'''<div style="margin-top: 36px; display: grid; grid-template-columns: 716px 396px; column-gap: 40px; align-items: start">
<div style="display: flex; flex-direction: column">
{trust_table()}
<div style="margin-top: 14px; padding-left: 14px; max-width: 640px">
{NOTES}
</div>
</div>
<div style="display: flex; flex-direction: column">
{chart_panel()}
<div style="margin-top: 8px">{HOW}</div>
</div>
</div>''',
    '<div style="margin-top: 36px; padding-top: 12px; border-top: 1px solid #DDDCD8; display: flex; align-items: center; gap: 24px; font-size: 13px; color: #6B6862">\n'
    '<span>Figures pool the last six weeks of polls, newer and larger polls counting for more. “Ahead” means a lead larger than its own 95% margin; “behind” names a party clearly third. Pick an issue to follow it in the chart.</span>\n'
    '<span style="flex-grow: 1"></span>\n'
    '<a href="#issues-method" style="min-height: 44px; display: flex; align-items: center; font-weight: 500; color: #171717; white-space: nowrap">How it’s built</a>\n</div>',
])
DESK_H = 1280
open(OUT + 'Issues.dc.html', 'w').write(page('The issues', 1280, DESK_H, desk))

# ================================================================ phone: who's trusted
def phone_rows():
    out = []
    k = (350 - 16) / 30
    ticks = ''.join(f'<text class="ax num" x="{8 + (t - 20) * k:g}" y="12" style="text-anchor: middle">{t}{"%" if t == 50 else ""}</text>' for t in (20, 30, 40, 50))
    out.append(f'''<div style="margin-top: 20px; display: flex; flex-direction: column; gap: 6px; font-size: 12px; line-height: 1.35; color: #6B6862">
<span>Best on it · % of voters naming one of these three</span>
<span style="display: flex; gap: 14px; color: #4A4843"><span class="key"><span style="width: 9px; height: 9px; border-radius: 5px; background: {ALP}"></span>Labor</span><span class="key"><span style="width: 9px; height: 9px; border-radius: 5px; background: {LNP}"></span>Coalition</span><span class="key"><span style="width: 9px; height: 9px; border-radius: 5px; background: {ONP}"></span>One Nation</span></span>
<svg viewBox="0 0 350 16" width="350" height="16" aria-hidden="true" style="display: block; overflow: visible">{ticks}</svg>
</div>''')
    for x in LIST:
        sel = x['id'] == 'col'
        bg = SEL_BG if sel else '#FAF9F6'
        vt, vc, vw = verdict(x)
        extra = ' · <span style="font-weight: 400; color: #6B6862">Greens first where offered</span>' if x.get('grnTop') else ''
        aria = (f"{x['label']}: {round(x['imp']['v'])}% put it in their top three; " + ', '.join(f"{PNAME[q]} {round(x['own']['v'][q])}" for q in PARTIES) + f'; {vt}')
        out.append(f'''<div class="row" role="button" tabindex="0" aria-pressed="{'true' if sel else 'false'}" aria-label="{aria}" style="padding: 10px 0 10px {10 if sel else 0}px; display: flex; flex-direction: column; gap: 6px{'; margin-left: -10px' if sel else ''}">
<div style="display: flex; align-items: baseline; gap: 8px"><span style="flex-grow: 1; font-size: 15px; font-weight: 600">{x['label']}</span><span class="num" style="font-size: 12px; color: #6B6862">{round(x['imp']['v'])}% rank it top three</span></div>
{dotplot(x, 350 - (10 if sel else 0), 22, bg, r=5)}
<div style="display: flex; align-items: center; gap: 10px">{triplet(x, 13)}<span style="flex-grow: 1"></span><span style="font-size: 13px; font-weight: {vw}; color: {vc}; text-align: right">{vt}{extra}</span></div>
</div>''')
    return '\n'.join(out)

phone = '\n\n'.join([
    eyebrow(phone=True),
    view_tabs('trust', phone=True),
    h1(TRUST_H1, phone=True) + '\n' + dek(TRUST_DEK_PHONE, phone=True),
    phone_rows(),
    '<div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #DDDCD8; display: flex; flex-direction: column">\n' + chart_panel(phone=True) + '\n</div>',
    '<div style="margin-top: 20px">\n' + NOTES.replace('font-size: 13px', 'font-size: 12px') + '\n</div>',
    f'<div style="margin-top: 8px; display: flex; align-items: center">{HOW}<span style="flex-grow: 1"></span><a href="#issues-method" style="min-height: 44px; display: flex; align-items: center; font-size: 14px; font-weight: 500">How it’s built</a></div>',
])
PHONE_H = 2080
open(OUT + 'IssuesMobile.dc.html', 'w').write(page('The issues – phone', 390, PHONE_H, phone, ax=11, lw=2))

# ================================================================ what matters to whom
G = I['groups']
TAB = G['tabs'][0]            # by vote
ALLV = G['all']
ISS = TAB['issues']
ISS_LAB = {'col': 'Cost of living', 'housing': 'Housing', 'health': 'Health', 'immigration': 'Immigration', 'crime': 'Crime', 'economy': 'Economic management'}
GROUP_LAB = {'Nationals, LNP and CLP': 'Nationals, LNP, CLP'}

def flag(c, a):
    d = c['v'] - a['v']
    if abs(d) > c['ci']:
        return '▲' if d > 0 else '▼'
    return ''

WHOM_H1 = 'The cost of living comes first for everyone. What comes second divides them.'
WHOM_DEK = ('For One Nation voters it is immigration: 63% put it in their top three, against 29% of all voters. '
            'For Greens voters it is housing (55%), and for Labor voters, health (51%).')
WHOM_DEK_PHONE = WHOM_DEK

def cell(c, a, bar=96):
    f = flag(c, a)
    strong = bool(f)
    return (f'<span style="display: flex; align-items: center; gap: 8px"><span style="position: relative; width: {bar}px; height: 10px; background: #EFEDE8; border-radius: 2px">'
            f'<span style="position: absolute; left: 0; top: 0; bottom: 0; width: {c["v"] * bar / 100:.1f}px; border-radius: 2px; background: {"#4A4843" if strong else "#B5B1AA"}"></span>'
            f'<span style="position: absolute; left: {a["v"] * bar / 100 - 1:.1f}px; top: -3px; width: 2px; height: 16px; background: #171717"></span></span>'
            f'<span class="num" style="font-size: 14px; font-weight: {600 if strong else 400}; color: {"#171717" if strong else "#4A4843"}">{c["v"]}{("&nbsp;" + f) if f else ""}</span></span>')

def whom_table():
    cols = '200px ' + ' '.join(['158px'] * 6)
    out = [f'<div style="display: grid; grid-template-columns: {cols}; align-items: end; padding-bottom: 8px; font-size: 13px; font-weight: 600; line-height: 1.3; color: #4A4843">'
           f'<span></span>' + ''.join(f'<span>{ISS_LAB[k]}</span>' for k in ISS) + '</div>']
    out.append(f'<div style="display: grid; grid-template-columns: {cols}; align-items: center; min-height: 46px; border-top: 1px solid #9A968E; border-bottom: 1px solid #9A968E">'
               f'<span style="font-size: 15px; font-weight: 600">All voters</span>'
               + ''.join(f'<span class="num" style="display: flex; align-items: center; gap: 8px"><span style="position: relative; width: 96px; height: 10px; background: #EFEDE8; border-radius: 2px"><span style="position: absolute; left: 0; top: 0; bottom: 0; width: {ALLV[k]["v"] * 0.96:.1f}px; border-radius: 2px; background: #171717"></span></span><span style="font-size: 14px; font-weight: 600">{ALLV[k]["v"]}</span></span>' for k in ISS)
               + '</div>')
    for grp in TAB['groups']:
        cells = TAB['cells'][grp]
        out.append(f'<div style="display: grid; grid-template-columns: {cols}; align-items: center; min-height: 44px; border-bottom: 1px solid #E6E4DF">'
                   f'<span style="font-size: 15px">{GROUP_LAB.get(grp, grp)} voters</span>'
                   + ''.join(cell(cells[k], ALLV[k]) for k in ISS) + '</div>')
    return '\n'.join(out)

def group_tabs(phone=False):
    labs = [t['label'] for t in G['tabs']]
    if phone:
        return ('<div role="group" aria-label="Group voters by" style="margin-top: 20px; display: flex; gap: 8px; overflow-x: auto; margin-right: -20px; padding-right: 20px">'
                + ''.join(f'<button class="chipb" aria-pressed="{"true" if l == "Vote" else "false"}">{l}</button>' for l in labs) + '</div>')
    return ('<div style="margin-top: 28px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #DDDCD8">'
            '<span style="margin-right: 4px; font-size: 13px; font-weight: 600; color: #4A4843">Group voters by</span>'
            '<div role="group" aria-label="Group voters by" style="display: flex; gap: 4px">'
            + ''.join(f'<button class="tab" aria-pressed="{"true" if l == "Vote" else "false"}">{l}</button>' for l in labs)
            + f'</div><span style="flex-grow: 1"></span>{copy_btn("what matters to whom, by vote")}</div>')

SENTS = ['One Nation voters are far more likely than other voters to put immigration in their top three: 63%, against 29% of all voters.',
         'Greens voters are more likely than others to put housing there (55%), and almost none put immigration (4%).',
         'Labor voters are more likely than others to put health in their top three (51%).']
WHOM_KEY = ('<div style="display: flex; flex-wrap: wrap; column-gap: 24px; row-gap: 6px; font-size: 13px; color: #4A4843">'
            '<span class="key"><svg width="24" height="14" viewBox="0 0 24 14" aria-hidden="true"><rect x="0" y="2" width="24" height="10" rx="2" style="fill: #EFEDE8"></rect><rect x="0" y="2" width="14" height="10" rx="2" style="fill: #B5B1AA"></rect><rect x="17" y="0" width="2" height="14" style="fill: #171717"></rect></svg>Group’s share, with all voters marked</span>'
            '<span class="key"><span style="font-weight: 600; color: #171717">▲ ▼</span>Differs from all voters by more than the group’s own 95% margin</span></div>')

whom = '\n\n'.join([
    eyebrow(),
    view_tabs('whom'),
    h1(WHOM_H1) + '\n' + dek(WHOM_DEK),
    group_tabs(),
    '<span style="margin-top: 16px; font-size: 13px; color: #6B6862"><b style="font-weight: 600; color: #171717">Share of each group putting each issue in its top three, %</b> · RedBridge, 24–28 August 2026</span>',
    '<div style="margin-top: 14px; display: flex; flex-direction: column" role="table" aria-label="Share of each group of voters putting each issue in its top three">\n' + whom_table() + '\n</div>',
    '<div style="margin-top: 14px">' + WHOM_KEY + '</div>',
    '<div style="margin-top: 24px; display: flex; flex-direction: column; gap: 6px; max-width: 900px">' + ''.join(f'<p style="margin: 0; font-size: 15px; line-height: 1.5; color: #3D3B37">{s}</p>' for s in SENTS) + '</div>',
    '<p style="margin: 16px 0 0; max-width: 900px; font-size: 13px; line-height: 1.55; color: #6B6862">Only RedBridge publishes what matters by group. A group’s margin depends on its share of the sample: about 6 points for One Nation and Labor voters, 9 to 13 for the smaller groups.</p>',
    '<div style="margin-top: 32px; padding-top: 12px; border-top: 1px solid #DDDCD8; display: flex; align-items: center; gap: 24px; font-size: 13px; color: #6B6862">\n'
    '<span>Each group’s share putting an issue among their three most important, from RedBridge’s latest poll in the last six weeks.</span>\n<span style="flex-grow: 1"></span>\n'
    '<a href="#issues-method" style="min-height: 44px; display: flex; align-items: center; font-weight: 500; color: #171717; white-space: nowrap">How it’s built</a>\n</div>',
])
WHOM_H = 1220
open(OUT + 'IssuesWhom.dc.html', 'w').write(page('The issues – what matters to whom', 1280, WHOM_H, whom))

# ================================================================ phone: what matters to whom (one issue at a time)
def whom_phone_bars(k='immigration'):
    a = ALLV[k]
    rows = [('All voters', a, True)] + [(GROUP_LAB.get(g, g), TAB['cells'][g][k], False) for g in TAB['groups']]
    LW, BW = 128, 176
    out = []
    for lab, c, is_all in rows:
        f = '' if is_all else flag(c, a)
        strong = is_all or bool(f)
        fill = '#171717' if is_all else ('#4A4843' if f else '#B5B1AA')
        out.append(f'<div style="display: grid; grid-template-columns: {LW}px {BW}px 46px; align-items: center; min-height: 36px{"; border-bottom: 1px solid #9A968E; margin-bottom: 4px" if is_all else ""}">'
                   f'<span style="font-size: 14px; font-weight: {600 if is_all else 400}">{lab}</span>'
                   f'<span style="position: relative; height: 12px; background: #EFEDE8; border-radius: 2px"><span style="position: absolute; left: 0; top: 0; bottom: 0; width: {c["v"] * BW / 100:.1f}px; border-radius: 2px; background: {fill}"></span>'
                   + ('' if is_all else f'<span style="position: absolute; left: {a["v"] * BW / 100 - 1:.1f}px; top: -4px; width: 2px; height: 20px; background: #171717"></span>')
                   + f'</span><span class="num" style="text-align: right; font-size: 14px; font-weight: {600 if strong else 400}">{c["v"]}{("&nbsp;" + f) if f else ""}</span></div>')
    return '\n'.join(out)

def issue_chips():
    return ('<div role="group" aria-label="Issue" style="margin-top: 10px; display: flex; gap: 8px; overflow-x: auto; margin-right: -20px; padding-right: 20px">'
            + ''.join(f'<button class="chipb" aria-pressed="{"true" if k == "immigration" else "false"}">{ISS_LAB[k] if k != "economy" else "Economy"}</button>' for k in ISS) + '</div>')

whom_phone = '\n\n'.join([
    eyebrow(phone=True),
    view_tabs('whom', phone=True),
    h1(WHOM_H1, phone=True) + '\n' + dek(WHOM_DEK_PHONE, phone=True),
    '<span style="margin-top: 22px; font-size: 12px; font-weight: 600; color: #4A4843">Group voters by</span>' + group_tabs(phone=True).replace('margin-top: 20px', 'margin-top: 8px', 1),
    '<span style="margin-top: 14px; font-size: 12px; font-weight: 600; color: #4A4843">Issue</span>' + issue_chips(),
    '<div style="margin-top: 18px; display: flex; align-items: flex-start; gap: 8px"><span style="flex-grow: 1; font-size: 13px; line-height: 1.45; color: #6B6862"><b style="font-weight: 600; color: #171717">Immigration in their top three, %</b><br>RedBridge, 24–28 Aug 2026</span>'
    + copy_btn('immigration by vote') + '</div>',
    '<div style="margin-top: 8px; display: flex; flex-direction: column" role="table" aria-label="Share of each group of voters putting immigration in its top three">\n' + whom_phone_bars() + '\n</div>',
    '<div style="margin-top: 12px">' + WHOM_KEY.replace('font-size: 13px', 'font-size: 12px').replace('column-gap: 24px', 'column-gap: 16px') + '</div>',
    '<div style="margin-top: 20px; display: flex; flex-direction: column; gap: 6px">' + ''.join(f'<p style="margin: 0; font-size: 14px; line-height: 1.5; color: #3D3B37">{s}</p>' for s in SENTS[:2]) + '</div>',
    '<p style="margin: 14px 0 0; font-size: 12px; line-height: 1.55; color: #6B6862">Only RedBridge publishes what matters by group. A group’s margin depends on its share of the sample: about 6 points for One Nation and Labor voters, 9 to 13 for the smaller groups.</p>',
    '<a href="#issues-method" style="margin-top: 8px; min-height: 44px; display: flex; align-items: center; font-size: 14px; font-weight: 500">How it’s built</a>',
])
WHOM_PH_H = 1320
open(OUT + 'IssuesWhomMobile.dc.html', 'w').write(page('The issues – what matters to whom, phone', 390, WHOM_PH_H, whom_phone, ax=11, lw=2))

# flags summary for checking
for g in TAB['groups']:
    print(g, {k: (TAB['cells'][g][k]['v'], flag(TAB['cells'][g][k], ALLV[k])) for k in ISS})
print('ok')
