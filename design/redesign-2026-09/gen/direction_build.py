import json, datetime as dt
import os
S = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
OUT = S + 'canvas/project/'
D = json.load(open(S + 'data/direction.json'))
MONTHS, POLLS, NOW = D['dir'], D['polls'], D['now']

POS, NEG, UNS = '#10777C', '#674B3C', '#D9D6D0'
INK, G2, G3 = '#171717', '#4A4843', '#6B6862'

COPY_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round"><rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4"></path></svg>'
EXPAND_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round"><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"></path></svg>'
copy_btn = lambda label: f'<button class="copy" aria-label="Copy chart: {label}" title="Copy chart">{COPY_SVG}</button>'
expand_btn = lambda label: f'<button class="copy" aria-label="Expand {label}" title="Expand">{EXPAND_SVG}</button>'

HELMET = '''<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Crimson+Text:wght@600;700&amp;family=IBM+Plex+Sans:wght@400;500;600&amp;display=swap" rel="stylesheet">
<style>
body{margin:0;background:#FAF9F6;color:#171717;font-family:"IBM Plex Sans",system-ui,sans-serif}
a{color:#171717}a:hover{color:#10777C}
button{font:inherit;cursor:pointer}
.num{font-variant-numeric:tabular-nums}
svg text{font-family:"IBM Plex Sans",system-ui,sans-serif}
.grid{stroke:#E6E4DF;stroke-width:1;fill:none}
.base{stroke:#9A968E;stroke-width:1;fill:none}
.ax{font-size:__AX__px;fill:#6B6862}
.ev{stroke:#C9C6BF;stroke-width:1;stroke-dasharray:1 3;fill:none}
.evt{font-size:12px;font-weight:500;fill:#4A4843}
.ln{fill:none;stroke-width:__LW__;stroke-linejoin:round;stroke-linecap:round}
.end{font-size:__AX__px;font-weight:600}
.halo{paint-order:stroke;stroke:#FAF9F6;stroke-width:4px;stroke-linejoin:round}
.copy{width:44px;height:44px;flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:8px;background:transparent;color:#6B6862;cursor:pointer}
.copy:hover{background:#EFEDE8;color:#171717}
.copy:focus-visible,.how:focus-visible{outline:2px solid #171717;outline-offset:2px}
.how{min-height:44px;padding:0;border:0;background:none;display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500;color:#171717}
.key{display:flex;align-items:center;gap:8px}
</style>
</helmet>'''

def page(title, w, h, body, ax=12, lw=2.5):
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

def dec(s):
    d = dt.date.fromisoformat(s)
    return d.year + (d - dt.date(d.year, 1, 1)).days / 365

X0, X1 = dec('2025-05-01'), dec('2026-10-01')
TICKS = [('Jul 2025', dec('2025-07-01')), ('Oct', dec('2025-10-01')), ('Jan 2026', dec('2026-01-01')), ('Apr', dec('2026-04-01')), ('Jul', dec('2026-07-01'))]
TICKS_PH = [('Jul 25', dec('2025-07-01')), ('Oct', dec('2025-10-01')), ('Jan 26', dec('2026-01-01')), ('Apr', dec('2026-04-01')), ('Jul', dec('2026-07-01'))]
BONDI = dec('2025-12-14')

def smooth(p):
    d = f'M{p[0][0]:.1f} {p[0][1]:.1f}'
    for i in range(len(p) - 1):
        a = p[i - 1] if i > 0 else p[i]
        b, c = p[i], p[i + 1]
        e = p[i + 2] if i + 2 < len(p) else c
        c1 = (b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6)
        c2 = (c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6)
        d += f'C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {c[0]:.1f} {c[1]:.1f}'
    return d

def chart(phone=False):
    if phone:
        SW, OX, OY, W, ppt, dot_r, fs_gap = 350, 26, 34, 320, 4, 2.75, 11
    else:
        SW, OX, OY, W, ppt, dot_r, fs_gap = 1152, 36, 44, 1010, 5.6, 3.5, 13
    lo, hi = 15, 70
    H = (hi - lo) * ppt
    X = lambda t: (t - X0) / (X1 - X0) * W
    Y = lambda v: (hi - v) * ppt
    SH = OY + H + (26 if phone else 30)
    g = [f'<g transform="translate({OX} {OY})">']
    g.append('<path class="grid" d="' + ''.join(f'M0 {Y(v):g}H{W}' for v in (20, 30, 40, 50, 60, 70)) + '"></path>')
    for v in (20, 30, 40, 50, 60, 70):
        g.append(f'<text class="ax num" x="-6" y="{Y(v) + 4:g}" style="text-anchor: end">{v}{"%" if v == 70 else ""}</text>')
    g.append(f'<path class="base" d="M0 {H:g}H{W}' + ''.join(f'M{X(t):.1f} {H:g}v4' for _, t in (TICKS_PH if phone else TICKS)) + '"></path>')
    for lab, t in (TICKS_PH if phone else TICKS):
        g.append(f'<text class="ax" x="{X(t):.1f}" y="{H + (16 if phone else 20):g}" style="text-anchor: middle">{lab}</text>')
    # event
    if phone:
        g.append(f'<path class="ev" d="M{X(BONDI):.1f} -14V{H:g}"></path><circle cx="{X(BONDI):.1f}" cy="-21" r="7" style="fill: #FAF9F6; stroke: #6B6862; stroke-width: 1"></circle>'
                 f'<text x="{X(BONDI):.1f}" y="-18" style="font-size: 9px; font-weight: 600; fill: #4A4843; text-anchor: middle">1</text>')
    else:
        g.append(f'<path class="ev" d="M{X(BONDI):.1f} -22V{H:g}"></path><text class="evt halo" x="{X(BONDI) + 5:.1f}" y="-28">Bondi shooting</text>')
    # bands
    for k, ck, col in (('right', 'rightCi', POS), ('wrong', 'wrongCi', NEG)):
        up = [(X(m['x']), Y(m[k] + m[ck])) for m in MONTHS]
        dn = [(X(m['x']), Y(m[k] - m[ck])) for m in MONTHS][::-1]
        g.append(f'<path d="{smooth(up)}L{dn[0][0]:.1f} {dn[0][1]:.1f}{smooth(dn)[len("M%.1f %.1f" % dn[0]):]}Z" style="fill: {col}; opacity: 0.12"></path>')
    # dots
    for k, col in (('right', POS), ('wrong', NEG)):
        g.append(f'<g style="fill: {col}; opacity: 0.45">' + ''.join(f'<circle cx="{X(p["x"]):.1f}" cy="{Y(p[k]):.1f}" r="{dot_r}"></circle>' for p in POLLS) + '</g>')
    # lines
    for k, col in (('right', POS), ('wrong', NEG)):
        g.append(f'<path class="ln" d="{smooth([(X(m["x"]), Y(m[k])) for m in MONTHS])}" style="stroke: {col}"></path>')
    first, last = MONTHS[0], MONTHS[-1]
    xl = X(last['x'])
    # gap bracket at the end
    bx = xl + (6 if phone else 8)
    g.append(f'<path d="M{bx - 4:.1f} {Y(last["wrong"]):.1f}H{bx:.1f}V{Y(last["right"]):.1f}H{bx - 4:.1f}" style="fill: none; stroke: #171717; stroke-width: 1"></path>')
    mid = (Y(last['wrong']) + Y(last['right'])) / 2
    gap = last['wrong'] - last['right']
    if phone:
        g.append(f'<text class="halo" x="{bx - 8:.1f}" y="{mid - 2:.1f}" style="font-size: 11px; fill: #3D3B37; text-anchor: end"><tspan x="{bx - 8:.1f}">{gap:.1f} points apart</tspan><tspan x="{bx - 8:.1f}" dy="14">in September;</tspan><tspan x="{bx - 8:.1f}" dy="14">5 in May 2025</tspan></text>')
    else:
        g.append(f'<text class="halo" x="{bx - 10:.1f}" y="{mid - 6:.1f}" style="font-size: 13px; fill: #3D3B37; text-anchor: end"><tspan x="{bx - 10:.1f}" style="font-weight: 600">{gap:.1f} points apart in September</tspan><tspan x="{bx - 10:.1f}" dy="18">up from 5 in May 2025</tspan></text>')
    g.append('</g>')
    if not phone:
        g.append(f'<text class="end" x="{OX + bx + 10:.1f}" y="{OY + Y(last["wrong"]) + 4:.1f}" style="fill: {NEG}">Wrong track</text>')
        g.append(f'<text class="end" x="{OX + bx + 10:.1f}" y="{OY + Y(last["right"]) + 4:.1f}" style="fill: {POS}">Right direction</text>')
    aria = (f'Share saying the country is heading in the right direction and on the wrong track, May 2025 to September 2026. '
            f'Right direction fell from {first["right"]} to {last["right"]} per cent; wrong track rose from {first["wrong"]} to {last["wrong"]}. '
            f'The gap widened from {first["wrong"] - first["right"]:.0f} to {gap:.1f} points, with a sharp fall after the Bondi shooting in December 2025.')
    return (f'<svg viewBox="0 0 {SW} {SH:g}" width="{SW}" height="{SH:g}" role="img" aria-label="{aria}" style="display: block; overflow: visible">\n'
            + '\n'.join(g) + '\n</svg>')

H1 = 'More than three in five say the country is on the wrong track, the most this term'
DEK = ('Only 23% say it is heading in the right direction. The gap between the two has widened by 10 points in a month, '
       'a significant fall, and by more than 30 since just after the 2025 election.')
QUESTION = '‘Is the country heading in the right direction, or on the wrong track?’'

def hero(phone=False):
    r, u, w = NOW['right'], NOW['unsure'], NOW['wrong']
    tot = r + u + w
    BW = 350 if phone else 1152
    wr, wu = BW * r / tot, BW * u / tot
    big = 40 if phone else 56
    lab = 13 if phone else 15
    figs = (f'<div style="margin-top: {22 if phone else 36}px; display: flex; align-items: flex-end; justify-content: space-between">\n'
            f'<div style="display: flex; flex-direction: column; gap: 2px"><span class="num" style="font-size: {big}px; font-weight: 500; line-height: 1; letter-spacing: -0.02em; color: {POS}">{r}<span style="font-size: {big * 0.45:.0f}px">%</span></span>'
            f'<span style="font-size: {lab}px; font-weight: 600; color: {POS}">Right direction</span></div>\n'
            f'<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px"><span class="num" style="font-size: {big}px; font-weight: 500; line-height: 1; letter-spacing: -0.02em; color: {NEG}">{w}<span style="font-size: {big * 0.45:.0f}px">%</span></span>'
            f'<span style="font-size: {lab}px; font-weight: 600; color: {NEG}">Wrong track</span></div>\n</div>')
    bar = (f'<div role="img" aria-label="Right direction {r}%, unsure {u}%, wrong track {w}%" style="margin-top: 10px; display: flex; gap: 2px; height: {16 if phone else 20}px">'
           f'<span style="width: {wr:.1f}px; border-radius: 10px 0 0 10px; background: {POS}"></span>'
           f'<span style="width: {wu - 4:.1f}px; background: {UNS}"></span>'
           f'<span style="flex-grow: 1; border-radius: 0 10px 10px 0; background: {NEG}"></span></div>')
    unsure = (f'<div style="position: relative; height: 20px; margin-top: 4px"><span class="num" style="position: absolute; left: {wr + wu / 2:.1f}px; transform: translateX(-50%); '
              f'font-size: {12 if phone else 13}px; color: {G3}; white-space: nowrap">{u}% unsure</span></div>')
    net = (f'<p class="num" style="margin: {8 if phone else 10}px 0 0; font-size: {14 if phone else 16}px; line-height: 1.5; color: {G2}">'
           f'<b style="font-weight: 600; color: {INK}">Net −{abs(NOW["net"])} points</b> · ▼ {abs(NOW["chg"]):.1f} on a month ago, a significant fall · the lowest since the 2025 election</p>')
    return figs + '\n' + bar + '\n' + unsure + '\n' + net

KEY = (f'<div style="margin-top: 12px; display: flex; flex-wrap: wrap; column-gap: 24px; row-gap: 6px; font-size: 13px; color: #4A4843">'
       f'<span class="key"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3" style="fill: #6B6862; opacity: 0.55"></circle></svg>One poll</span>'
       f'<span class="key"><svg width="24" height="14" viewBox="0 0 24 14" aria-hidden="true"><rect x="0" y="2" width="24" height="10" rx="2" style="fill: #6B6862; opacity: 0.15"></rect><path d="M1 7H23" style="stroke: #6B6862; stroke-width: 2.5; stroke-linecap: round"></path></svg>Monthly average, adjusted for each pollster’s lean, and its 95% interval</span></div>')
HOW = '<button class="how" aria-expanded="false"><span aria-hidden="true" style="font-size: 11px">▶</span>How to read this chart</button>'
FOOT_TEXT = ('Most readings are Roy Morgan’s weekly poll: 47 of the 67 since the election. Essential and Spectre Strategy supply the rest; Freshwater has stopped asking. '
             'The headline figures pool the latest polls, so they can differ a little from September’s monthly average.')

desk = '\n\n'.join([
    '<div style="display: flex; align-items: baseline; gap: 16px; font-size: 13px; color: #6B6862">\n'
    '<span style="font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #171717">National direction</span>\n'
    f'<span>{QUESTION} · Roy Morgan, Essential and Spectre Strategy</span>\n</div>',
    f'<h1 style="margin: 16px 0 0; max-width: 1000px; font-family: \'Crimson Text\', Georgia, serif; font-weight: 700; font-size: 46px; line-height: 1.08; letter-spacing: -0.01em">{H1}</h1>\n'
    f'<p style="margin: 12px 0 0; max-width: 880px; font-size: 18px; line-height: 1.5; color: #3D3B37">{DEK}</p>',
    hero(),
    f'<div style="margin-top: 36px; display: flex; align-items: center; gap: 4px"><span style="flex-grow: 1; font-size: 13px; font-weight: 600">Right direction and wrong track, % of voters, month by month</span>'
    f'{expand_btn("national direction chart")}{copy_btn("national direction")}</div>',
    chart().replace('style="display: block', 'style="margin-top: 8px; display: block', 1),
    KEY,
    f'<div style="margin-top: 6px">{HOW}</div>',
    f'<div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #DDDCD8; display: flex; align-items: center; gap: 24px; font-size: 13px; line-height: 1.5; color: #6B6862">\n<span>{FOOT_TEXT}</span>\n<span style="flex-grow: 1"></span>\n'
    '<a href="#direction-method" style="min-height: 44px; display: flex; align-items: center; font-weight: 500; color: #171717; white-space: nowrap">How it’s built</a>\n</div>',
])
DESK_H = 1180
open(OUT + 'Direction.dc.html', 'w').write(page('National direction', 1280, DESK_H, desk))

phone = '\n\n'.join([
    '<div style="display: flex; flex-direction: column; gap: 2px; font-size: 12px; line-height: 1.4; color: #6B6862">\n'
    '<span style="font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #171717">National direction</span>\n'
    f'<span>{QUESTION}</span>\n</div>',
    f'<h1 style="margin: 14px 0 0; font-family: \'Crimson Text\', Georgia, serif; font-weight: 700; font-size: 30px; line-height: 1.1; letter-spacing: -0.01em">{H1}</h1>\n'
    f'<p style="margin: 10px 0 0; font-size: 16px; line-height: 1.5; color: #3D3B37">{DEK}</p>',
    hero(phone=True),
    f'<div style="margin-top: 28px; display: flex; align-items: center; gap: 4px"><span style="flex-grow: 1; font-size: 13px; font-weight: 600">Right direction and wrong track, %</span>'
    f'{expand_btn("national direction chart")}{copy_btn("national direction")}</div>',
    f'<div style="margin-top: 4px; display: flex; gap: 16px; font-size: 12px; color: #4A4843">'
    f'<span class="key"><svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true"><path d="M1 6H21" style="stroke: {NEG}; stroke-width: 2.5; stroke-linecap: round"></path></svg>Wrong track</span>'
    f'<span class="key"><svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true"><path d="M1 6H21" style="stroke: {POS}; stroke-width: 2.5; stroke-linecap: round"></path></svg>Right direction</span></div>',
    chart(phone=True).replace('style="display: block', 'style="margin-top: 10px; display: block', 1),
    '<p style="margin: 10px 0 0; font-size: 13px; color: #3D3B37"><span class="num" style="display: inline-block; width: 16px; font-weight: 600; color: #6B6862">1</span>Bondi shooting, Dec 2025</p>',
    KEY.replace('font-size: 13px', 'font-size: 12px').replace('column-gap: 24px', 'column-gap: 16px'),
    f'<div style="margin-top: 6px">{HOW}</div>',
    f'<p style="margin: 16px 0 0; padding-top: 12px; border-top: 1px solid #DDDCD8; font-size: 12px; line-height: 1.55; color: #6B6862">{FOOT_TEXT}</p>',
    '<a href="#direction-method" style="min-height: 44px; display: flex; align-items: center; font-size: 14px; font-weight: 500">How it’s built</a>',
])
PHONE_H = 1300
open(OUT + 'DirectionMobile.dc.html', 'w').write(page('National direction – phone', 390, PHONE_H, phone, ax=11, lw=2.25))
print('ok', MONTHS[0], MONTHS[-1], NOW)
