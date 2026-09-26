import os
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, 'common.py')).read())

# ---------------------------------------------------------------- extra styles
HELMET = HELMET.replace('</style>', '''.chip{min-height:44px;padding:0 18px;border:1px solid #DDDCD8;border-radius:22px;background:#FEFCF9;font-size:14px;color:#171717;display:inline-flex;align-items:center;gap:10px;white-space:nowrap}
.chip:hover{background:#EFEDE8}
.term{padding:0;border:0;background:none;font:inherit;color:inherit;text-decoration:underline dotted #9A968E;text-decoration-thickness:1.5px;text-underline-offset:3px;cursor:help}
.qbtn{width:44px;height:44px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:8px;background:transparent;vertical-align:middle}
.qbtn:hover{background:#EFEDE8}
.qbtn span{width:20px;height:20px;box-sizing:border-box;border-radius:10px;border:1.5px solid #6B6862;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:#4A4843}
.qbtn[aria-expanded="true"] span{background:#171717;border-color:#171717;color:#FAF9F6}
.link{min-height:44px;padding:0 4px;border:0;background:none;font:inherit;font-weight:500;color:#171717;text-decoration:underline;text-underline-offset:3px;vertical-align:middle}
.switch{width:52px;height:44px;flex-shrink:0;padding:0;border:0;background:transparent;display:flex;align-items:center;justify-content:center}
.switch span{position:relative;display:block;width:40px;height:24px;border-radius:12px;background:#8C8881}
.switch span::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:9px;background:#FAF9F6}
.switch[aria-checked="true"] span{background:#171717}
.switch[aria-checked="true"] span::after{left:19px}
.chip:focus-visible,.term:focus-visible,.qbtn:focus-visible,.switch:focus-visible,.link:focus-visible{outline:2px solid #171717;outline-offset:2px}
</style>''')

# ---------------------------------------------------------------- hero states
Q = '<button class="qbtn" aria-label="How this is counted, and the pollsters’ published figures" aria-expanded="{exp}"><span>?</span></button>'
T = lambda t: f'<button class="term">{t}</button>'

STATES = {
    'imp-on': dict(rival='One Nation', rink=ONPT, rdot=ONP, a='51.2', b='48.8', lead=2.4, half=2.6,
                   verdict='Too close to call.', why=f'Labor’s 2.4-point lead is inside the ±2.6 {T("flow range")}.',
                   change=f'Labor ▼ 0.8 on a month ago, within the {T("margin")}',
                   meta='Implied preference flows', n=8, alt=('Labor v Coalition', '51.6', '48.4', LNP)),
    'imp-co': dict(rival='Coalition', rink=LNP, rdot=LNP, a='51.6', b='48.4', lead=3.2, half=2.4,
                   verdict='Labor ahead.', why=f'Its 3.2-point lead is outside the ±2.4 {T("margin")}.',
                   change='Labor ▼ 0.1 on a month ago, within the margin · ▼ 3.6 since the 2025 election',
                   meta='Implied preference flows', n=8, alt=('Labor v One Nation', '51.2', '48.8', ONPT)),
    'pub-on': dict(rival='One Nation', rink=ONPT, rdot=ONP, a='54.3', b='45.7', lead=8.6, half=3.4,
                   verdict='Labor ahead.', why=f'Its 8.6-point lead is outside the ±3.4 {T("margin")}.',
                   change='Labor ▼ 0.1 on a month ago, within the margin',
                   meta='Pollsters’ published figures', n=5, alt=('Labor v Coalition', '52.0', '48.0', LNP)),
}

def gauge(st, phone=False):
    if phone:
        W, C, K, fs = 350, 175, 13, 11
        cap_y, g0, g1, bar_y, bar_h, cy, r, tick_y, H = 11, 18, 50, 24, 14, 31, 7, 68, 72
    else:
        W, C, K, fs = 760, 380, 28, 12
        cap_y, g0, g1, bar_y, bar_h, cy, r, tick_y, H = 12, 20, 58, 28, 16, 36, 8, 78, 82
    x = lambda v: C - K * v          # Labor's lead runs left, under Labor's figure
    lo, hi = x(st['lead'] + st['half']), x(st['lead'] - st['half'])
    g = [
        f'<text class="ax" x="{x(12):g}" y="{cap_y}" style="font-weight: 600; fill: {ALP}">◀ Labor ahead</text>',
        f'<text class="ax" x="{x(-12):g}" y="{cap_y}" style="text-anchor: end; font-weight: 600; fill: {st["rink"]}">{st["rival"]} ahead ▶</text>',
        f'<path class="grid" d="' + ''.join(f'M{x(v):g} {g0}V{g1}' for v in (10, 5, -5, -10)) + '"></path>',
        f'<path class="zero" d="M{C} {g0 - 4}V{g1 + 2}" style="stroke-width: 1.5"></path>',
        f'<rect x="{lo:g}" y="{bar_y}" width="{hi - lo:g}" height="{bar_h}" rx="2" style="fill: {ALP}; opacity: 0.2"></rect>',
        f'<path d="M{lo:g} {bar_y}v{bar_h}M{hi:g} {bar_y}v{bar_h}" style="stroke: {ALP}; stroke-width: 2"></path>',
        f'<circle cx="{x(st["lead"]):g}" cy="{cy}" r="{r}" style="fill: {ALP}; stroke: #FAF9F6; stroke-width: 2"></circle>',
    ]
    for v in (10, 5, -5, -10):
        lab = f'{abs(v)}' + ('' if phone or abs(v) == 5 else ' pts')
        g.append(f'<text class="ax num" x="{x(v):g}" y="{tick_y}" style="text-anchor: middle">{lab}</text>')
    g.append(f'<text class="ax" x="{C}" y="{tick_y}" style="text-anchor: middle; font-weight: 600; fill: {G2}">Tied</text>')
    kind = 'flow range' if st is STATES['imp-on'] else '95% interval'
    aria = (f'Labor leads {"the " if st["rival"] == "Coalition" else ""}{st["rival"]} by {st["lead"]:.1f} points, {kind} '
            f'{fmt(st["lead"] - st["half"])} to {fmt(st["lead"] + st["half"])}.')
    return (f'<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{aria}" style="margin-top: {12 if phone else 18}px; display: block; overflow: visible">\n'
            + '\n'.join(g) + '\n</svg>')

def readout(st, phone=False):
    if phone:
        side = lambda name, col, dot, num, end: (
            f'<div style="display: flex; flex-direction: column; align-items: {"flex-end" if end else "flex-start"}; gap: 2px">'
            f'<span style="display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; color: {col}">'
            + (f'<span style="width: 9px; height: 9px; border-radius: 5px; background: {dot}"></span>{name}' if end else f'{name}<span style="width: 9px; height: 9px; border-radius: 5px; background: {dot}"></span>')
            + f'</span><span style="font-size: 52px; font-weight: 500; line-height: 1; letter-spacing: -0.03em; color: {col}">{num}</span></div>')
        return (f'<div class="num" style="margin-top: 22px; width: 350px; display: grid; grid-template-columns: minmax(0, 1fr) 2px minmax(0, 1fr); column-gap: 16px; align-items: end">\n'
                + side('Labor', ALP, ALP, st['a'], True) + '\n<span style="height: 60px; background: #9A968E"></span>\n'
                + side(st['rival'], st['rink'], st['rdot'], st['b'], False) + '\n</div>')
    return (f'<div class="num" style="margin-top: 36px; width: 760px; display: grid; grid-template-columns: minmax(0, 1fr) 2px minmax(0, 1fr); column-gap: 28px; align-items: center">\n'
            f'<div style="display: flex; align-items: center; justify-content: flex-end; gap: 14px"><span style="width: 14px; height: 14px; border-radius: 7px; background: {ALP}"></span>'
            f'<span style="font-size: 20px; font-weight: 600; color: {ALP}">Labor</span>'
            f'<span style="font-size: 88px; font-weight: 500; line-height: 1; letter-spacing: -0.03em; color: {ALP}">{st["a"]}</span></div>\n'
            f'<span style="height: 72px; background: #9A968E"></span>\n'
            f'<div style="display: flex; align-items: center; gap: 14px"><span style="font-size: 88px; font-weight: 500; line-height: 1; letter-spacing: -0.03em; color: {st["rink"]}">{st["b"]}</span>'
            f'<span style="font-size: 20px; font-weight: 600; color: {st["rink"]}">{st["rival"]}</span>'
            f'<span style="width: 14px; height: 14px; border-radius: 7px; background: {st["rdot"]}"></span></div>\n</div>')

def meta_line(st, phone=False, expanded=False):
    back = ' · <button class="link">Back to implied flows</button>' if st['meta'].startswith('Pollsters') else ''
    return (f'<p class="num" style="margin: {4 if phone else 6}px 0 0; font-size: {12 if phone else 13}px; line-height: 1.5; color: #6B6862">'
            f'{st["meta"]} · {T("weighted aggregate")} of {st["n"]} polls in the 21 days to 21 Sep{Q.format(exp="true" if expanded else "false")}{back}</p>')

def chip(st, phone=False):
    name, a, b, col = st['alt']
    return (f'<div style="margin-top: {10 if phone else 8}px; display: flex; align-items: center; gap: 12px">'
            f'<span style="font-size: 13px; color: #6B6862">Switch 2PP</span>'
            f'<button class="chip">{name}<span class="num" style="font-weight: 600"><span style="color: {ALP}">{a}</span><span style="color: #9A968E">–</span><span style="color: {col}">{b}</span></span></button></div>')

def hero(key, phone=False, expanded=False):
    st = STATES[key]
    return (f'<div style="display: flex; flex-direction: column; align-items: center; text-align: center">\n'
            + readout(st, phone) + '\n' + gauge(st, phone) + '\n'
            + f'<p class="num" style="margin: {12 if phone else 14}px 0 0; font-size: {15 if phone else 17}px; line-height: 1.5; color: #3D3B37"><b style="font-weight: 600; color: #171717">{st["verdict"]}</b> {st["why"]}</p>\n'
            + f'<p class="num" style="margin: 2px 0 0; font-size: {13 if phone else 14}px; line-height: 1.5; color: #6B6862">{st["change"]}</p>\n'
            + meta_line(st, phone, expanded) + '\n' + chip(st, phone) + '\n</div>')

POPOVER = f'''<div role="dialog" aria-label="How this is counted" style="position: relative; margin-top: 10px; width: 420px; box-sizing: border-box; padding: 18px 20px 6px; background: #FEFCF9; border: 1px solid #DDDCD8; border-radius: 12px; box-shadow: 0 10px 28px rgba(23, 23, 23, 0.14); text-align: left">
<span aria-hidden="true" style="position: absolute; top: -7px; right: 15px; width: 12px; height: 12px; background: #FEFCF9; border-left: 1px solid #DDDCD8; border-top: 1px solid #DDDCD8; transform: rotate(45deg)"></span>
<p style="margin: 0; font-size: 15px; font-weight: 600">How this is counted</p>
<p style="margin: 6px 0 0; font-size: 14px; line-height: 1.5; color: #3D3B37">Each poll’s primary votes, run through preference flows taken from counted ballots. No federal election has counted Labor against One Nation, so for that pairing the site builds the flows itself, and the ± is the doubt about them.</p>
<div style="margin-top: 12px; padding-top: 2px; border-top: 1px solid #E6E4DF; display: flex; align-items: center; gap: 12px">
<span style="flex-grow: 1; font-size: 14px; font-weight: 500">Show the pollsters’ published figures</span>
<button class="switch" role="switch" aria-checked="false" aria-label="Show the pollsters’ published figures"><span></span></button>
</div>
<p class="num" style="margin: 0; font-size: 12px; line-height: 1.5; color: #6B6862">Their own head-to-heads, from where respondents say their preferences would go. Against One Nation they have Labor ahead 54.3–45.7.</p>
<a href="/preference-flows/" style="min-height: 44px; display: flex; align-items: center; font-size: 14px; font-weight: 500">Read the full explainer →</a>
</div>'''

def chart_controls2(compare, cmp_label, phone=False):
    chk = ' checked' if compare else ''
    ranges = ''.join(f'<button class="tab" aria-pressed="{"true" if r == "All" else "false"}" style="font-size: 14px; padding: 0 {8 if phone else 10}px">{r}</button>' for r in ('3 mo', '6 mo', '12 mo', 'All'))
    if phone:
        return (f'<div style="margin-top: 14px; display: flex; align-items: center; border-bottom: 1px solid #DDDCD8">\n'
                f'<div role="group" aria-label="Time range" style="display: flex">{ranges}</div>\n<span style="flex-grow: 1"></span>\n'
                f'{expand_btn("two-party preferred chart")}\n</div>\n'
                f'<label class="check" style="margin-top: 4px"><input type="checkbox"{chk}>{cmp_label}</label>')
    return (f'<div style="margin-top: 16px; display: flex; align-items: center; border-bottom: 1px solid #DDDCD8">\n'
            f'<div role="group" aria-label="Time range" style="display: flex; gap: 2px">{ranges}</div>\n<span style="flex-grow: 1"></span>\n'
            f'<label class="check"><input type="checkbox"{chk}>{cmp_label}</label>\n<span style="width: 12px"></span>\n'
            f'{expand_btn("two-party preferred chart")}\n</div>')

H2 = 'One Nation now runs Labor as close as the Coalition does'
H2P = ('Labor’s share against One Nation has fallen from 64% in June 2025 to 51%; against the Coalition, from 56% to 52%. '
       'Since February the two contests have run within a point and a half of each other.')
ARIA_ON = ('Labor’s two-party share by matchup, May 2025 to September 2026, on implied flows. Against One Nation it fell from 63.8 in June 2025 to 51.1 in September 2026; '
           'against the Coalition from 55.2 at the election to 51.6. The two lines have been within 1.5 points of each other since February 2026.')
FOOT = ('<div style="margin-top: 32px; padding-top: 12px; border-top: 1px solid #DDDCD8; display: flex; align-items: center; gap: 24px; font-size: 13px; color: #6B6862">\n'
        '<span>Figures pool the last 21 days of polls, weighted towards the most recent and adjusted for each pollster’s lean. Changes are on a month ago. The chart follows the matchup chosen above.</span>\n'
        '<span style="flex-grow: 1"></span>\n'
        '<a href="/preference-flows/" style="min-height: 44px; display: flex; align-items: center; font-weight: 500; color: #171717">How it’s built</a>\n</div>')

def eyebrow(sub):
    return ('<div style="display: flex; align-items: baseline; gap: 16px; font-size: 13px; color: #6B6862">\n'
            '<span style="font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #171717">Two-party preferred</span>\n'
            f'<span>{sub}</span>\n</div>')

def chart_section(emph, compare, cmp_label, aria):
    return '\n\n'.join([
        chart_controls2(compare, cmp_label),
        '<span style="margin-top: 16px; font-size: 13px; font-weight: 600">Labor’s two-party share, %</span>',
        chart('d', emph, compare, aria).replace('style="display: block', 'style="margin-top: 8px; display: block', 1),
        chart_key(emph, compare, 'two-party preferred'),
    ])

# ================================================================ desktop board
desk = '\n\n'.join([
    eyebrow('After preferences · 163 polls from 12 pollsters · updated 21 Sep 2026'),
    hero('imp-on'),
    f'<h2 style="margin: 56px 0 0; font-family: \'Crimson Text\', Georgia, serif; font-weight: 700; font-size: 28px; line-height: 1.15">{H2}</h2>\n'
    f'<p style="margin: 6px 0 0; max-width: 880px; font-size: 15px; line-height: 1.5; color: #4A4843">{H2P}</p>',
    chart_section('on', False, 'Compare published head-to-heads', ARIA_ON),
    FOOT,
])
DESK_H = 1340
open(OUT + 'TPP.dc.html', 'w').write(page('Two-party preferred', 1280, DESK_H, desk))

# ================================================================ phone board
ph_events = [('1', '1st Coalition split', 'May 2025'), ('2', 'Joyce joins One Nation · Bondi shooting', 'Dec 2025'),
             ('3', '2nd Coalition split', 'Jan 2026'), ('4', 'Hormuz crisis', 'Mar 2026'), ('5', '2026 Budget', 'May 2026')]
ph_ev_html = ('<ol style="margin: 14px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #3D3B37">\n'
              + '\n'.join(f'<li style="display: flex; gap: 10px"><span class="num" style="width: 16px; font-weight: 600; color: #6B6862">{n}</span><span style="flex-grow: 1">{t}</span><span style="color: #6B6862">{m}</span></li>' for n, t, m in ph_events)
              + '\n</ol>')

phone = '\n\n'.join([
    '<div style="display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: #6B6862">\n'
    '<span style="font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #171717">Two-party preferred</span>\n'
    '<span>After preferences · updated 21 Sep 2026</span>\n</div>',
    hero('imp-on', phone=True),
    f'<h2 style="margin: 40px 0 0; font-family: \'Crimson Text\', Georgia, serif; font-weight: 700; font-size: 22px; line-height: 1.15">{H2}</h2>\n'
    f'<p style="margin: 6px 0 0; font-size: 15px; line-height: 1.5; color: #4A4843">{H2P}</p>',
    chart_controls2(False, 'Compare published head-to-heads', phone=True),
    '<div style="margin-top: 14px; display: flex; flex-wrap: wrap; column-gap: 16px; row-gap: 4px; font-size: 12px; color: #4A4843">\n'
    '<span style="width: 100%; font-size: 13px; font-weight: 600; color: #171717">Labor’s two-party share, %</span>\n'
    + key_item(K_LINEBAND(ONP), 'v One Nation') + '\n' + key_item(K_LINE(LNP), 'v Coalition') + '\n</div>',
    chart('p', 'on', False, ARIA_ON).replace('style="display: block', 'style="margin-top: 12px; display: block', 1),
    ph_ev_html,
    '<div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid #DDDCD8; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 16px; row-gap: 10px; font-size: 12px; color: #4A4843">\n'
    + key_item(K_DOT(ONP), 'One poll, implied flows') + '\n' + key_item(K_LINEBAND(ONP), 'Monthly, flow range') + '\n'
    + key_item(K_RING, '2025 election') + '\n</div>',
    '<div style="margin-top: 16px; display: flex; align-items: center">\n'
    '<a href="/preference-flows/" style="min-height: 44px; display: flex; align-items: center; font-size: 14px; font-weight: 500">How it’s built</a>\n'
    f'<span style="flex-grow: 1"></span>\n{copy_btn("two-party preferred")}\n</div>',
])
PHONE_H = 1460
open(OUT + 'TPPMobile.dc.html', 'w').write(page('Two-party preferred – phone', 390, PHONE_H, phone, ax=11, dot=3.5))

# ================================================================ other states board
def panel_head(tag, title, note):
    return (f'<div style="display: flex; align-items: baseline; gap: 12px">\n'
            f'<span style="padding: 2px 8px; border-radius: 4px; background: #EFEDE8; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; color: #4A4843">{tag}</span>\n'
            f'<h2 style="margin: 0; font-family: \'Crimson Text\', Georgia, serif; font-weight: 700; font-size: 28px; line-height: 1.15">{title}</h2>\n</div>\n'
            f'<p style="margin: 6px 0 0; max-width: 900px; font-size: 15px; line-height: 1.5; color: #4A4843">{note}</p>')

ARIA_A = ('Labor’s share against One Nation on implied flows and as published. The published head-to-heads, from January 2026, agreed with the implied figures to within about a point until June; '
          'since July they have run 2 to 3 points higher: 54.4 against 51.3 in July, 53.9 against 51.1 in September.')
ARIA_C = ('Labor’s share against the Coalition on implied flows, with its 95% interval: from 55.2 at the election to 51.6 in September 2026. '
          'Published figures run close to it, at 52.0 in September. Had One Nation preferences flowed as in 2022, the implied figure would be about 2.8 points higher, 54.4.')

callout = ('<g>\n<path d="M{x1} {y1}V{y2}" style="stroke: #171717; stroke-width: 1; fill: none"></path>\n'
           '<path d="M{x0} {y1}H{x1}M{x0} {y2}H{x1}" style="stroke: #171717; stroke-width: 1; fill: none"></path>\n'
           '<text class="halo" x="{tx}" y="{ty}" style="font-size: 13px; fill: #3D3B37; text-anchor: end"><tspan x="{tx}" dy="0">Since July the pollsters’ own figures</tspan><tspan x="{tx}" dy="17">have run 2 to 3 points friendlier to</tspan><tspan x="{tx}" dy="17">Labor than the flows imply</tspan></text>\n</g>')
dA = G['d']
bx = 36 + dA['on_end'][0]
yp, yi = 50 + dA['pubon_end'][1], 50 + dA['on_end'][1]
chartA = chart('d', 'on', True, ARIA_A)
chartA = chartA.replace('\n</svg>', '\n' + callout.format(x0=bx + 3, x1=bx + 7, y1=f'{yp:.1f}', y2=f'{yi:.1f}', tx=f'{bx - 8:.1f}', ty=f'{yp - 62:.1f}') + '\n</svg>')

popover_block = ('<div style="display: flex; flex-direction: column; align-items: flex-end; width: 640px; margin: 20px auto 0; text-align: center">\n'
                 + meta_line(STATES['imp-on'], expanded=True) + '\n' + POPOVER + '\n</div>')

views = '\n\n'.join([
    eyebrow('Other states of the section · same data as the desktop board'),
    '<h1 style="margin: 16px 0 0; font-family: \'Crimson Text\', Georgia, serif; font-weight: 700; font-size: 40px; line-height: 1.1; letter-spacing: -0.01em">What the controls change</h1>',
    '<div style="margin-top: 40px"></div>' + panel_head('A', 'Compare published head-to-heads: on',
        'Adds the pollsters’ own Labor v One Nation figures to the chart as a dashed monthly line: the cross-check. They agreed with the flows to within about a point until June; since July they have run 2 to 3 points friendlier to Labor.'),
    '\n\n'.join([
        chart_controls2(True, 'Compare published head-to-heads'),
        '<span style="margin-top: 16px; font-size: 13px; font-weight: 600">Labor’s two-party share, %</span>',
        chartA.replace('style="display: block', 'style="margin-top: 8px; display: block', 1),
        chart_key('on', True, 'two-party preferred'),
    ]),
    '<div style="margin-top: 56px"></div>' + panel_head('B', 'The ‘?’ opened',
        'The basis switch lives here, off the main surface. Implied flows stay the strong default; anyone who wants the pollsters’ own figures is one tap away, and sees the number before switching.'),
    popover_block,
    '<div style="margin-top: 56px"></div>' + panel_head('C', 'Showing the pollsters’ published figures',
        'The central figure, gauge and chip switch to the published basis; the aggregate line says so and offers the way back. The chart’s main series switches too, and its compare box then reads “Compare implied 2PP”.'),
    hero('pub-on'),
    '<div style="margin-top: 56px"></div>' + panel_head('D', 'Switched to Labor v Coalition, compare on',
        'The chip swaps the matchup, and the chart follows. The band becomes a 95% interval, because this pairing has election flows to work from. The hatched range shows how far Labor’s share would rise if One Nation preferences flowed as they did in 2022 rather than 2025: about 3 points now, with One Nation on about a quarter of the vote.'),
    hero('imp-co'),
    '<div style="margin-top: 36px"></div>' + chart_section('co', True, 'Compare published 2PP', ARIA_C),
])
VIEWS_H = 3160
open(OUT + 'TPPViews.dc.html', 'w').write(page('Two-party preferred – other states', 1280, VIEWS_H, views))
print('ok', DESK_H, PHONE_H, VIEWS_H)
