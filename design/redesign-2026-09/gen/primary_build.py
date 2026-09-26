# Primary vote boards: Main (desktop), Mobile (phone), and the chart in
# Interaction's first state. Built from the site's own figures: the
# current primaries are latest.json's 21-day nowcast, and the chart draws
# aggPrimary's monthly aggregates with their 95% intervals, as the site does.
# Run: python3 design/redesign-2026-09/gen/primary_build.py
import json, datetime as dt, re
from common import S, OUT, COPY_SVG

A = json.load(open(S + 'data/aggPrimary.json'))
P = json.load(open(S + 'data/individualPolls.json'))
L = json.load(open(S + 'data/latest.json'))

PARTIES = ['oth', 'grn', 'lnp', 'alp', 'onp']          # drawn back to front: One Nation, the leader, on top
COL = {'alp': '#B9463F', 'onp': '#CC7C37', 'lnp': '#356697', 'grn': '#439458', 'oth': '#938A81'}
TXT = {'alp': '#B9463F', 'onp': '#9E5200', 'lnp': '#356697', 'grn': '#287C42', 'oth': '#70675E'}
NAME = {'alp': 'Labor', 'onp': 'One Nation', 'lnp': 'Coalition', 'grn': 'Greens', 'oth': 'Others'}
LONG = dict(NAME, oth='Others &amp; independents')
SHORT = {'alp': 'ALP', 'onp': 'ON', 'lnp': 'L/NP', 'grn': 'GRN', 'oth': 'OTH'}

now = L['primary']
elec = A[0]
assert elec.get('election')
ORDER = sorted(PARTIES, key=lambda k: -now[k])          # One Nation, Labor, Coalition, Greens, Others
delta = {k: round(now[k] - elec[k], 1) for k in PARTIES}


def dec(s):
    d = dt.date.fromisoformat(s)
    return d.year + (d - dt.date(d.year, 1, 1)).days / 365


X0, X1 = dec('2025-05-03'), dec('2026-09-26')          # election to today
EVENTS = [('1st Coalition split', '2025-05-28', 0), ('Bondi shooting', '2025-12-14', 0),
          ('2nd Coalition split', '2026-01-22', 1), ('Hormuz crisis', '2026-03-02', 0),
          ('2026 Budget', '2026-05-12', 0)]


def f(v):
    s = f'{v:.1f}'
    return s[:-2] if s.endswith('.0') else s


def geom(L0, R0, T, B, ymax=40):
    fx = lambda x: L0 + (x - X0) / (X1 - X0) * (R0 - L0)
    fy = lambda v: B - v / ymax * (B - T)
    g = {}
    for k in PARTIES:
        pts = [(r['x'], r[k]) for r in A]
        g[k] = dict(
            line='M' + 'L'.join(f'{f(fx(x))} {f(fy(v))}' for x, v in pts),
            band='M' + 'L'.join(f'{f(fx(r["x"]))} {f(fy(r[k] + r["ci"][k]))}' for r in A[1:])
                 + 'L' + 'L'.join(f'{f(fx(r["x"]))} {f(fy(r[k] - r["ci"][k]))}' for r in reversed(A[1:])) + 'Z',
            dots=''.join(f'M{f(fx(p["x"]))} {f(fy(p["p"][k]))}h0' for p in P
                         if p.get('p') and p['p'].get(k) is not None),
            start=(fx(A[0]['x']), fy(A[0][k])),
            end=(fx(A[-1]['x']), fy(A[-1][k])),
        )
    g['fx'], g['fy'] = fx, fy
    return g


def end_labels(g, base, gap_top, gap_low, x_from, x_to, x_text, short=False):
    """Party names at the line ends. The One Nation and Labor ends sit a few pixels
    apart, so that pair (and Greens and Others if needed) is spread around its
    midpoint and joined to its line by a short leader."""
    ex = g['alp']['end'][0]
    ys = {k: g[k]['end'][1] + base for k in PARTIES}
    ls = dict(ys)
    for a, b, gap in (('onp', 'alp', gap_top), ('grn', 'oth', gap_low)):
        up, lo = (a, b) if ys[a] <= ys[b] else (b, a)
        if ys[lo] - ys[up] < gap:
            m = (ys[a] + ys[b]) / 2
            ls[up], ls[lo] = m - gap / 2, m + gap / 2
    o = []
    lead = ''.join(f'M{f(ex + x_from)} {f(ys[k] - base)}L{f(ex + x_to)} {f(ls[k] - base)}'
                   for k in PARTIES if abs(ls[k] - ys[k]) > 2)
    if lead:
        o.append(f'<path style="fill: none; stroke: #9A968E; stroke-width: 1" d="{lead}"></path>')
    for k in PARTIES:
        o.append(f'<text class="lbl" x="{f(ex + x_text)}" y="{f(ls[k])}" style="fill: {TXT[k]}">{(SHORT if short else NAME)[k]}</text>')
    return o


# ------------------------------------------------------------------ desktop
def chart_desktop(hover=False):
    g = geom(40, 1016, 48, 428)
    fx, fy = g['fx'], g['fy']
    o = []
    o.append('<path class="grid" d="M0 333H1016M0 238H1016M0 143H1016M0 48H1016"></path>')
    o.append('<path class="base" d="M0 428H1016"></path>')
    for v in (40, 30, 20, 10):
        o.append(f'<text class="ax" x="0" y="{f(fy(v) - 4)}">{v}%</text>')
    o.append('')
    o.append('<g style="opacity: {{eventOpacity}}">' if not hover else '<g>')
    ev = ''.join(f'M{f(fx(dec(d)))} {24 + 16 * r}V428' for _, d, r in EVENTS)
    o.append(f'<path class="ev" d="{ev}"></path>')
    for n, d, r in EVENTS:
        o.append(f'<text class="evt" x="{f(fx(dec(d)) + 5)}" y="{18 + 16 * r}">{n}</text>')
    o.append('</g>')
    o.append('')
    o.append('<g style="opacity: {{bandOpacity}}">' if not hover else '<g style="opacity: 0.16">')
    for k in PARTIES:
        o.append(f'<path style="fill: {COL[k]}" d="{g[k]["band"]}"></path>')
    o.append('</g>')
    o.append('')
    o.append('<g style="opacity: {{dotOpacity}}">' if not hover else '<g style="opacity: 0.32">')
    for k in PARTIES:
        o.append(f'<path class="dots" style="stroke: {COL[k]}" d="{g[k]["dots"]}"></path>')
    o.append('</g>')
    o.append('')
    for k in PARTIES:
        dash = '; stroke-dasharray: 6 4' if k == 'oth' else ''
        o.append(f'<path class="trend" style="stroke: {COL[k]}{dash}" d="{g[k]["line"]}"></path>')
    o.append('')
    for k in PARTIES:
        x, y = g[k]['start']
        o.append(f'<circle class="ring" style="stroke: {COL[k]}" cx="{f(x)}" cy="{f(y)}" r="4.5"></circle>')
    for k in PARTIES:
        x, y = g[k]['end']
        o.append(f'<circle style="fill: {COL[k]}; stroke: #FAF9F6; stroke-width: 2" cx="{f(x)}" cy="{f(y)}" r="5"></circle>')
    # end labels, names only: the figures are the stat row's
    o += end_labels(g, 4.5, 17, 16, 7, 12, 14)
    o.append('')
    ticks = [('Election', '2025-05-03'), ('Jul', '2025-07-01'), ('Sep', '2025-09-01'), ('Nov', '2025-11-01'),
             ('Jan 2026', '2026-01-01'), ('Mar', '2026-03-01'), ('May', '2026-05-01'), ('Jul', '2026-07-01'),
             ('Sep', '2026-09-01')]
    o.append('<path class="base" d="' + ''.join(f'M{f(fx(dec(d)))} 428V434' for _, d in ticks) + '"></path>')
    for n, d in ticks:
        bold = '; font-weight: 600; fill: #171717' if n == 'Election' else ''
        o.append(f'<text class="ax" x="{f(fx(dec(d)))}" y="452" style="text-anchor: middle{bold}">{n}</text>')
    return o, g


def stat_cards_desktop():
    o = []
    o.append('<div style="margin-top: 32px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); column-gap: 32px; row-gap: 10px">')
    o.append('<div style="grid-column: 1 / span 2; display: flex; align-items: center; gap: 10px; font-size: 12px; font-weight: 500; color: #6B6862">')
    o.append('<span style="flex-grow: 1; height: 1px; background: #9A968E"></span>')
    o.append('<span>Within the margin of uncertainty</span>')
    o.append('<span style="flex-grow: 1; height: 1px; background: #9A968E"></span>')
    o.append('</div>')
    o.append('<div style="grid-column: 3 / span 3"></div>')
    o.append('')
    for k in ORDER:
        d = delta[k]
        arrow = '▲' if d > 0 else '▼'
        o.append(f'<div style="display: flex; flex-direction: column; gap: 4px; padding-top: 12px; border-top: 3px solid {COL[k]}">')
        o.append(f'<span style="font-size: 14px; font-weight: 600; color: {TXT[k]}">{LONG[k]}</span>')
        o.append(f'<span style="font-size: 36px; font-weight: 500; line-height: 1.1; letter-spacing: -0.02em">{now[k]:.1f}<span style="font-size: 20px; color: #6B6862">%</span></span>')
        o.append(f'<span class="num" style="font-size: 13px; color: #6B6862">{arrow} {abs(d):.1f} since the election</span>')
        o.append('</div>')
    o.append('</div>')
    return o


HEAD = '''<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<title>Primary vote</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Crimson+Text:wght@600;700&amp;family=IBM+Plex+Sans:wght@400;500;600&amp;display=swap" rel="stylesheet">
<style>
body{margin:0;background:#FAF9F6;color:#171717;font-family:"IBM Plex Sans",system-ui,sans-serif}
a{color:#171717}a:hover{color:#B9463F}
button{font:inherit;cursor:pointer}
.num{font-variant-numeric:tabular-nums}
svg text{font-family:"IBM Plex Sans",system-ui,sans-serif}
.grid{stroke:#DDDCD8;stroke-width:1;fill:none}
.base{stroke:#9A968E;stroke-width:1;fill:none}
.ax{font-size:__AX__px;fill:#6B6862}
.ev{stroke:#C9C6BF;stroke-width:1;stroke-dasharray:1 3;fill:none}
.evt{font-size:__EVT__px;font-weight:__EVW__;fill:#4A4843;paint-order:stroke;stroke:#FAF9F6;stroke-width:4px;stroke-linejoin:round__EVX__}
.evn{fill:#FAF9F6;stroke:#6B6862;stroke-width:1}
.dots{fill:none;stroke-width:__DOT__;stroke-linecap:round}
.trend{fill:none;stroke-width:__TW__;stroke-linejoin:round;stroke-linecap:round}
.ring{fill:#FAF9F6;stroke-width:2}
.lbl{font-size:__LBL__px;font-weight:600}
.copy{width:44px;height:44px;flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:8px;background:transparent;color:#6B6862;cursor:pointer}
.copy:hover{background:#EFEDE8;color:#171717}
.copy:focus-visible{outline:2px solid #171717;outline-offset:2px}__EXTRA__
</style>
</helmet>
'''

TAIL = '''</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"showDots":{"editor":"boolean","default":true,"section":"Layers"},"showBands":{"editor":"boolean","default":true,"section":"Layers"},"showEvents":{"editor":"boolean","default":true,"section":"Layers"},"$preview":{"width":__W__,"height":__H__}}'>
class Component extends DCLogic {
renderVals() {
const p = this.props;
return {
dotOpacity: (p.showDots ?? true) ? __DO__ : 0,
bandOpacity: (p.showBands ?? true) ? 0.18 : 0,
eventOpacity: (p.showEvents ?? true) ? 1 : 0
};
}
}
</script>
</body>
</html>
'''

DECK = (f'One Nation, on {now["onp"]:.1f}%, and Labor, on {now["alp"]:.1f}%, are too close to separate. '
        f'The Coalition, on {now["lnp"]:.1f}%, has lost a third of its election-night vote.')
ARIA = (f'Primary vote by month since the May 2025 election, with each poll as a dot. One Nation rose from '
        f'{elec["onp"]}% to {now["onp"]:.1f}%, level with Labor on {now["alp"]:.1f}%; the Coalition fell from '
        f'{elec["lnp"]}% to {now["lnp"]:.1f}%.')
KEY_LINE = ('<svg width="24" height="14" viewBox="0 0 24 14" aria-hidden="true"><rect x="0" y="2" width="24" height="10" rx="2" '
            'style="fill: #6B6862; opacity: 0.2"></rect><path d="M1 7H23" style="stroke: #171717; stroke-width: 2.5; stroke-linecap: round"></path></svg>')
KEY_LINE_M = ('<svg width="22" height="14" viewBox="0 0 22 14" aria-hidden="true"><rect x="0" y="2" width="22" height="10" rx="2" '
              'style="fill: #6B6862; opacity: 0.2"></rect><path d="M1 7H21" style="stroke: #171717; stroke-width: 2.25; stroke-linecap: round"></path></svg>')


def build_main(H):
    ch, g = chart_desktop()
    head = (HEAD.replace('__AX__', '12').replace('__EVT__', '12').replace('__EVW__', '500').replace('__EVX__', '')
            .replace('__DOT__', '5').replace('__TW__', '2.75').replace('__LBL__', '13').replace('__EXTRA__', ''))
    b = [head]
    b.append(f'<div style="width: 1280px; height: {H}px; box-sizing: border-box; padding: 56px 64px; display: flex; flex-direction: column; background: #FAF9F6">')
    b.append('')
    b.append('<div style="display: flex; align-items: baseline; gap: 16px; font-size: 13px; color: #6B6862">')
    b.append('<span style="font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #171717">Primary vote</span>')
    b.append(f'<span>{L["pollsTracked"]} national polls since the 3 May 2025 election · latest fieldwork 21 Sep 2026</span>')
    b.append('</div>')
    b.append('')
    b.append('<h1 style="margin: 16px 0 0; font-family: \'Crimson Text\', Georgia, serif; font-weight: 700; font-size: 46px; line-height: 1.08; letter-spacing: -0.01em; color: #171717">One Nation and Labor are level</h1>')
    b.append(f'<p style="margin: 12px 0 0; max-width: 820px; font-size: 18px; line-height: 1.5; color: #3D3B37">{DECK}</p>')
    b.append('')
    b += stat_cards_desktop()
    b.append('')
    b.append(f'<svg viewBox="0 0 1152 460" width="1152" height="460" role="img" aria-label="{ARIA}" style="margin-top: 28px; display: block; overflow: visible">')
    b += ch
    b.append('</svg>')
    b.append('')
    b.append('<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #DDDCD8; display: flex; align-items: center; gap: 28px; font-size: 13px; color: #4A4843">')
    b.append('<span style="display: flex; align-items: center; gap: 8px"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="2.5" style="fill: #6B6862; opacity: 0.5"></circle></svg>One poll</span>')
    b.append(f'<span style="display: flex; align-items: center; gap: 8px">{KEY_LINE}Monthly average and its 95% interval</span>')
    b.append('<span style="display: flex; align-items: center; gap: 8px"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" style="fill: #FAF9F6; stroke: #171717; stroke-width: 2"></circle></svg>2025 election result</span>')
    b.append('<span style="flex-grow: 1"></span>')
    b.append('<a href="#method" style="font-weight: 500; white-space: nowrap">How it’s built</a>')
    b.append(f'<button class="copy" aria-label="Copy chart: primary vote" title="Copy chart">{COPY_SVG}</button>')
    b.append('</div>')
    b.append('')
    b.append('</div>')
    out = '\n'.join(b) + '\n' + TAIL.replace('__W__', '1280').replace('__H__', str(H)).replace('__DO__', '0.32')
    open(OUT + 'Main.dc.html', 'w').write(out)
    return g


# ------------------------------------------------------------------ phone
def build_mobile(H):
    g = geom(32, 262, 34, 270)
    fx, fy = g['fx'], g['fy']
    head = (HEAD.replace('__AX__', '11').replace('__EVT__', '9').replace('__EVW__', '600')
            .replace('__EVX__', ';text-anchor:middle').replace('__DOT__', '3.5').replace('__TW__', '2.25')
            .replace('__LBL__', '11').replace('__EXTRA__', '\n.row{display:grid;grid-template-columns:1fr auto;align-items:baseline;row-gap:2px}'))
    b = [head]
    b.append(f'<div style="width: 390px; height: {H}px; box-sizing: border-box; padding: 28px 20px; display: flex; flex-direction: column; background: #FAF9F6">')
    b.append('')
    b.append('<div style="display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: #6B6862">')
    b.append('<span style="font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #171717">Primary vote</span>')
    b.append(f'<span>{L["pollsTracked"]} polls since the May 2025 election · to 21 Sep 2026</span>')
    b.append('</div>')
    b.append('')
    b.append('<h1 style="margin: 14px 0 0; font-family: \'Crimson Text\', Georgia, serif; font-weight: 700; font-size: 32px; line-height: 1.1; letter-spacing: -0.01em">One Nation and Labor are level</h1>')
    b.append(f'<p style="margin: 10px 0 0; font-size: 16px; line-height: 1.5; color: #3D3B37">{DECK}</p>')
    b.append('')

    def row(k, last):
        d = delta[k]
        arrow = '▲' if d > 0 else '▼'
        border = '' if last else '; border-bottom: 1px solid #DDDCD8'
        return [f'<div class="row" style="padding: 10px 0{border}">',
                f'<span style="display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: {TXT[k]}"><span style="width: 10px; height: 10px; border-radius: 5px; background: {COL[k]}"></span>{LONG[k]}</span>',
                f'<span style="font-size: 24px; font-weight: 500">{now[k]:.1f}<span style="font-size: 14px; color: #6B6862">%</span></span>',
                f'<span class="num" style="grid-column: 1 / span 2; padding-left: 18px; font-size: 12px; color: #6B6862">{arrow} {abs(d):.1f} since the election</span>',
                '</div>']
    b.append('<div style="margin-top: 24px; display: flex; flex-direction: column">')
    b.append('<div style="padding: 10px 12px 4px; background: #F1EFEA; border-radius: 8px 8px 0 0; font-size: 12px; font-weight: 500; color: #6B6862">Within the margin of uncertainty</div>')
    b.append('<div style="padding: 0 12px 4px; background: #F1EFEA; border-radius: 0 0 8px 8px; display: flex; flex-direction: column">')
    b += row(ORDER[0], False) + row(ORDER[1], True)
    b.append('</div>')
    b.append('<div style="padding: 0 12px; display: flex; flex-direction: column">')
    for i, k in enumerate(ORDER[2:]):
        b += row(k, i == 2)
    b.append('</div>')
    b.append('</div>')
    b.append('')
    b.append(f'<svg viewBox="0 0 350 300" width="350" height="300" role="img" aria-label="{ARIA}" style="margin-top: 24px; display: block; overflow: visible">')
    b.append('<path class="grid" d="M0 211H262M0 152H262M0 93H262M0 34H262"></path>')
    b.append('<path class="base" d="M0 270H262"></path>')
    for v in (40, 30, 20, 10):
        b.append(f'<text class="ax" x="0" y="{f(fy(v) - 4)}">{v}%</text>')
    b.append('')
    b.append('<g style="opacity: {{eventOpacity}}">')
    b.append('<path class="ev" d="' + ''.join(f'M{f(fx(dec(d)))} 21V270' for _, d, _ in EVENTS) + '"></path>')
    xs = [fx(dec(d)) for _, d, _ in EVENTS]
    # keep the numbered markers from touching (they are 14px wide)
    cx = list(xs)
    for i in range(1, len(cx)):
        if cx[i] - cx[i - 1] < 16:
            cx[i] = cx[i - 1] + 16
    for i, (x0, x1) in enumerate(zip(xs, cx), 1):
        b.append(f'<circle class="evn" cx="{f(x1)}" cy="13" r="7"></circle><text class="evt" x="{f(x1)}" y="16">{i}</text>')
    b.append('</g>')
    b.append('')
    b.append('<g style="opacity: {{bandOpacity}}">')
    for k in PARTIES:
        b.append(f'<path style="fill: {COL[k]}" d="{g[k]["band"]}"></path>')
    b.append('</g>')
    b.append('')
    b.append('<g style="opacity: {{dotOpacity}}">')
    for k in PARTIES:
        b.append(f'<path class="dots" style="stroke: {COL[k]}" d="{g[k]["dots"]}"></path>')
    b.append('</g>')
    b.append('')
    for k in PARTIES:
        dash = '; stroke-dasharray: 5 3' if k == 'oth' else ''
        b.append(f'<path class="trend" style="stroke: {COL[k]}{dash}" d="{g[k]["line"]}"></path>')
    b.append('')
    for k in PARTIES:
        x, y = g[k]['start']
        b.append(f'<circle class="ring" style="stroke: {COL[k]}" cx="{f(x)}" cy="{f(y)}" r="3.5"></circle>')
    for k in PARTIES:
        x, y = g[k]['end']
        b.append(f'<circle style="fill: {COL[k]}; stroke: #FAF9F6; stroke-width: 1.5" cx="{f(x)}" cy="{f(y)}" r="4"></circle>')
    b += end_labels(g, 4, 14, 13, 6, 10, 12, short=True)
    b.append('')
    ticks = [('Election', '2025-05-03'), ('Sep', '2025-09-01'), ('Jan 2026', '2026-01-01'), ('May', '2026-05-01'), ('Sep', '2026-09-01')]
    b.append('<path class="base" d="' + ''.join(f'M{f(fx(dec(d)))} 270V275' for _, d in ticks) + '"></path>')
    for n, d in ticks:
        bold = '; font-weight: 600; fill: #171717' if n == 'Election' else ''
        b.append(f'<text class="ax" x="{f(fx(dec(d)))}" y="290" style="text-anchor: middle{bold}">{n}</text>')
    b.append('</svg>')
    b.append('')
    b.append('<ol style="margin: 16px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #3D3B37">')
    for i, (n, d, _) in enumerate(EVENTS, 1):
        when = dt.date.fromisoformat(d).strftime('%b %Y')
        b.append(f'<li style="display: flex; gap: 10px"><span class="num" style="width: 16px; font-weight: 600; color: #6B6862">{i}</span><span style="flex-grow: 1">{n}</span><span style="color: #6B6862">{when}</span></li>')
    b.append('</ol>')
    b.append('')
    b.append('<div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid #DDDCD8; display: flex; flex-direction: column; gap: 10px; font-size: 12px; color: #4A4843">')
    b.append('<div style="display: flex; gap: 20px">')
    b.append('<span style="display: flex; align-items: center; gap: 8px"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="2.5" style="fill: #6B6862; opacity: 0.5"></circle></svg>One poll</span>')
    b.append('<span style="display: flex; align-items: center; gap: 8px"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="4" style="fill: #FAF9F6; stroke: #171717; stroke-width: 1.75"></circle></svg>2025 election result</span>')
    b.append('</div>')
    b.append(f'<span style="display: flex; align-items: center; gap: 8px">{KEY_LINE_M}Monthly average and its 95% interval</span>')
    b.append('</div>')
    b.append('<div style="margin-top: 12px; display: flex; align-items: center">')
    b.append('<a href="#method" style="min-height: 44px; display: flex; align-items: center; font-size: 14px; font-weight: 500; white-space: nowrap; flex-shrink: 0">How it’s built</a>')
    b.append('<span style="flex-grow: 1"></span>')
    b.append(f'<button class="copy" aria-label="Copy chart: primary vote" title="Copy chart">{COPY_SVG}</button>')
    b.append('</div>')
    b.append('')
    b.append('</div>')
    out = '\n'.join(b) + '\n' + TAIL.replace('__W__', '390').replace('__H__', str(H)).replace('__DO__', '0.3')
    open(OUT + 'Mobile.dc.html', 'w').write(out)


# ------------------------------------------------------------------ Interaction, state 1
def patch_interaction():
    ch, g = chart_desktop(hover=True)
    fx, fy = g['fx'], g['fy']
    # a poll mid-chart, so the tooltip clears the end labels: YouGov's late-June high for One Nation
    yg = next(p for p in P if p['pollster'] == 'YouGov' and p['field'] == '23–30 Jun')
    hx, hy = fx(yg['x']), fy(yg['p']['onp'])
    tw, th = 222, 100
    tx, ty = hx - tw / 2, hy - th - 18           # centred above the dot
    tip = [
        f'<circle cx="{f(hx)}" cy="{f(hy)}" r="11" style="fill: none; stroke: #CC7C37; stroke-width: 1.5; opacity: 0.55"></circle>',
        f'<circle cx="{f(hx)}" cy="{f(hy)}" r="6" style="fill: #CC7C37; stroke: #FAF9F6; stroke-width: 2"></circle>',
        f'<rect class="tipsh" x="{f(tx + 2)}" y="{f(ty + 2.5)}" width="{tw}" height="{th}" rx="10"></rect>',
        f'<rect class="tipbox" x="{f(tx)}" y="{f(ty)}" width="{tw}" height="{th}" rx="10"></rect>',
        f'<text class="tt" x="{f(tx + 11)}" y="{f(ty + 20)}">YouGov</text>',
        f'<rect x="{f(tx + 11)}" y="{f(ty + 32.5)}" width="9" height="9" rx="2" style="fill: #CC7C37"></rect>',
        f'<text class="tl" x="{f(tx + 27)}" y="{f(ty + 41)}">One Nation</text>',
        f'<text class="tv num" x="{f(tx + tw - 11)}" y="{f(ty + 41)}" style="text-anchor: end">{yg["p"]["onp"]}%</text>',
        f'<text class="tl" x="{f(tx + 11)}" y="{f(ty + 57.5)}">Field</text>',
        f'<text class="tv" x="{f(tx + tw - 11)}" y="{f(ty + 57.5)}" style="text-anchor: end">{yg["field"]}</text>',
        f'<text class="ts num" x="{f(tx + 11)}" y="{f(ty + 73.5)}">n = {yg["sample"]:,}</text>',
        f'<text class="th" x="{f(tx + 11)}" y="{f(ty + 90.5)}">Click to open this poll in All polls</text>',
    ]
    # the tooltip sits above the x axis block
    at = ch.index(next(l for l in ch if l.startswith('<path class="base" d="M40 428')))
    ch = ch[:at] + tip + ch[at:]
    t = open(OUT + 'Interaction.dc.html').read()
    s = t.index('<svg viewBox="0 0 1152 460"')
    open_end = t.index('>', s) + 1
    e = t.index('</svg>', s)
    t = t[:open_end] + '\n' + '\n'.join(ch) + '\n' + t[e:]
    open(OUT + 'Interaction.dc.html', 'w').write(t)


if __name__ == '__main__':
    import sys
    hm = int(sys.argv[1]) if len(sys.argv) > 1 else 980
    hp = int(sys.argv[2]) if len(sys.argv) > 2 else 1230
    build_main(hm)
    build_mobile(hp)
    patch_interaction()
    print('now', {k: now[k] for k in ORDER}, 'delta', delta)
