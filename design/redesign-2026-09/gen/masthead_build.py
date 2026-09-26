import math
import os
S = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
OUT = S + 'canvas/project/'
ALP, LNP, ONP, GRN = '#B9463F', '#356697', '#CC7C37', '#439458'

HELMET = '''<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Crimson+Text:wght@400;600;700&amp;family=IBM+Plex+Sans:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet">
<style>
body{margin:0;background:#FAF9F6;color:#171717;font-family:"IBM Plex Sans",system-ui,sans-serif}
a{color:#171717;text-decoration:none}a:hover{text-decoration:underline;text-underline-offset:3px}
button{font:inherit;cursor:pointer}
.num{font-variant-numeric:tabular-nums}
.wm{display:flex;align-items:center;gap:14px;padding:0;border:0;background:none;color:#171717;text-align:left}
.wm:focus-visible,.tab:focus-visible,.seg:focus-visible,.score:focus-visible,.tn a:focus-visible{outline:2px solid #171717;outline-offset:3px;border-radius:4px}
.tab{min-height:44px;padding:0 2px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:transparent;font-size:16px;font-weight:500;color:#6B6862;white-space:nowrap}
.tab[aria-current="page"]{border-bottom-color:#171717;font-weight:600;color:#171717}
.tab:hover{color:#171717}
.segs{display:flex;padding:3px;border:1px solid #DDDCD8;border-radius:22px;background:#FAF9F6}
.seg{width:38px;height:38px;display:flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:19px;background:transparent;color:#6B6862}
.seg[aria-pressed="true"]{background:#EFEDE8;color:#171717}
.dt{font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#6B6862}
.dd{font-size:15px;font-weight:600;color:#171717;white-space:nowrap}
.dd2{font-size:13px;color:#6B6862;white-space:nowrap}
.dot{display:inline-block;width:8px;height:8px;border-radius:4px;background:#10777C;margin-right:7px;vertical-align:1px}
.tn{display:inline-flex;align-items:baseline;gap:5px;white-space:nowrap}
.tn a{font-weight:600;color:#3D3B37}
.ext{font-size:10px;color:#9A968E}
.score{display:inline-flex;align-items:baseline;gap:9px;min-height:44px;padding:0 4px;border:0;background:none;white-space:nowrap}
.plabel{font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9A968E}
</style>
</helmet>'''

def page(title, w, h, body):
    pad = '40px 64px 56px' if w > 400 else '24px 20px 32px'
    return f'''<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
{HELMET}
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

def dial(scale=1.0):
    W, H = 60, 42
    cx, cy = 30, 38
    ticks = [(ONP, -58, 10.5), (ALP, -20, 10.3), (LNP, 18, 7.5), (GRN, 56, 5.0)]
    g = [f'<path d="M13 38A17 17 0 0 1 47 38" style="fill: none; stroke: #D8C3B3; stroke-width: 2.5; stroke-linecap: round"></path>']
    for col, a, ln in ticks:
        r0, r1 = 21, 21 + ln
        s, c = math.sin(math.radians(a)), math.cos(math.radians(a))
        g.append(f'<path d="M{cx + r0 * s:.1f} {cy - r0 * c:.1f}L{cx + r1 * s:.1f} {cy - r1 * c:.1f}" style="stroke: {col}; stroke-width: 4"></path>')
    s, c = math.sin(math.radians(-7)), math.cos(math.radians(-7))
    g.append(f'<path d="M{cx} {cy}L{cx + 15 * s:.1f} {cy - 15 * c:.1f}" style="stroke: {ALP}; stroke-width: 2.5; stroke-linecap: round"></path>')
    g.append(f'<circle cx="{cx}" cy="{cy}" r="2.6" style="fill: #4A4843"></circle>')
    return (f'<svg viewBox="0 0 {W} {H}" width="{W * scale:g}" height="{H * scale:g}" role="img" '
            f'aria-label="Primary vote: One Nation 27.3, Labor 26.8, Coalition 21.2, Greens 13.2. Implied two-party preferred, Labor v One Nation: Labor ahead by 2.4." style="display: block; flex-shrink: 0">'
            + ''.join(g) + '</svg>')

SUN = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"></path></svg>'
MOON = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linejoin: round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"></path></svg>'
THEME = (f'<div class="segs" role="group" aria-label="Colour theme"><button class="seg" aria-pressed="true" aria-label="Light theme" title="Light">{SUN}</button>'
         f'<button class="seg" aria-pressed="false" aria-label="Dark theme" title="Dark">{MOON}</button></div>')

def wordmark(size=40, dial_scale=1.0):
    return (f'<button class="wm" title="Wind the dial back through the term" aria-label="auspol tracker, Australian federal polling. Replay the term on the dial">'
            f'<span style="display: flex; flex-direction: column; font-size: {size}px; line-height: 0.92; letter-spacing: -0.02em">'
            f'<span style="font-weight: 700">auspol</span><span style="font-weight: 300; color: #5C5853">tracker</span></span>'
            f'{dial(dial_scale)}</button>')

TAGLINE = 'Aggregated opinion polling for the next federal election, set against every term since 1972.'

CUR = ' aria-current="page"'
DOT = '<span class="dot" aria-hidden="true"></span>'

def tabs(size=16, gap=28, short=False, phone=False):
    labs = ['Snapshot', 'Cycles' if short else 'Past cycles', 'All polls', 'Info']
    st = ' style="flex: 1; font-size: 15px"' if phone else (f' style="font-size: {size}px"' if size != 16 else '')
    flex = '; flex: 1' if phone else ''
    out = []
    for i, l in enumerate(labs):
        href = '#' + l.lower().replace(' ', '-')
        out.append(f'<a class="tab" href="{href}"{CUR if i == 0 else ""}{st}>{l}</a>')
    return f'<div style="display: flex; gap: {0 if phone else gap}px{flex}">' + ''.join(out) + '</div>'

NEXT = [('RedBridge/Accent', 'tomorrow'), ('Roy Morgan', 'in 2 days'), ('Essential', 'in 4 days'), ('YouGov', 'in 11 days'), ('Newspoll', 'in 15 days')]
def next_strip():
    items = ''.join(f'<span class="tn"><a href="#where-{f.split("/")[0].lower().replace(" ", "")}" target="_blank" rel="noopener">{f}</a><span class="ext" aria-hidden="true">↗</span><span>{w}</span></span>' for f, w in NEXT[:3])
    return (f'<div style="display: flex; align-items: baseline; gap: 16px; font-size: 13px; color: #6B6862" title="Projected from each house’s recent publication intervals: the earliest each could land, not the likeliest">'
            f'<a href="#next-polls" style="font-weight: 600; color: #4A4843">Next polls, at the earliest</a>{items}</div>')

def status(phone=False):
    if phone:
        return ('<div style="margin-top: 12px; display: flex; flex-direction: column; gap: 2px; font-size: 13px; line-height: 1.45; color: #4A4843">'
                '<span><span class="dot" aria-hidden="true"></span><b style="font-weight: 600; color: #171717">Latest poll</b> YouGov, 15–21 Sep · 3 days ago</span>'
                '<span style="padding-left: 15px">163 polls this term · election by 20 May 2028</span></div>')
    cell = lambda dt, dd, dd2, dot=False: (f'<div style="display: flex; flex-direction: column; gap: 3px"><span class="dt">{dt}</span>'
                                          f'<span class="dd">{DOT if dot else ""}{dd}</span><span class="dd2">{dd2}</span></div>')
    divider = '<span style="width: 1px; align-self: stretch; background: #E6E4DF"></span>'
    return (f'<div style="display: flex; gap: 24px">'
            + cell('Latest poll', 'YouGov, 15–21 Sep', 'published 3 days ago', True) + divider
            + cell('This term', '163 polls', '12 pollsters') + divider
            + cell('Next election', 'By 20 May 2028', '20 months at most') + '</div>')

def hero_preview(phone=False):
    big = 44 if phone else 72
    return (f'<div style="margin-top: {20 if phone else 32}px; display: flex; flex-direction: column; align-items: {"stretch" if phone else "flex-start"}; opacity: 0.45" aria-hidden="true">'
            f'<span style="font-size: {12 if phone else 13}px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase">Two-party preferred</span>'
            f'<span class="num" style="margin-top: 14px; {"text-align: center; " if phone else "align-self: center; "}font-size: {big}px; font-weight: 500; line-height: 1; letter-spacing: -0.03em">'
            f'<span style="color: {ALP}">51.2</span><span style="color: #9A968E; font-weight: 300"> | </span><span style="color: #9E5200">48.8</span></span></div>')

def pinned(phone=False):
    score = (f'<button class="score" title="Latest Labor v One Nation two-party preferred – go to Snapshot">'
             + ('' if phone else '<span class="plabel" style="color: #6B6862">2PP</span>')
             + f'<span style="font-size: 11px; font-weight: 700; letter-spacing: 0.04em; color: #6B6862">ALP</span>'
             f'<span class="num" style="font-family: \'Crimson Text\', Georgia, serif; font-size: {17 if phone else 19}px; font-weight: 700; color: {ALP}">51.2</span>'
             f'<span style="width: 1.5px; height: 14px; background: #DDDCD8; align-self: center"></span>'
             f'<span class="num" style="font-family: \'Crimson Text\', Georgia, serif; font-size: {17 if phone else 19}px; font-weight: 700; color: #9E5200">48.8</span>'
             f'<span style="font-size: 11px; font-weight: 700; letter-spacing: 0.04em; color: #6B6862">ON</span></button>')
    if phone:
        score = score.replace('<button class="score"', '<button class="score" style="gap: 6px"', 1)
        bar = (f'<div style="margin: 0 -20px; padding: 0 12px 0 20px; display: flex; align-items: center; gap: 8px; background: #FAF9F6; border-bottom: 1px solid #DDDCD8; box-shadow: 0 6px 16px rgba(23, 23, 23, 0.06)">'
               f'<div style="display: flex; gap: 12px">' + ''.join(f'<a class="tab" href="#{l.lower().replace(" ", "-")}"{CUR if i == 0 else ""} style="font-size: 14px">{l}</a>' for i, l in enumerate(['Snapshot', 'Cycles', 'All polls'])) + '</div>'
               f'<span style="flex-grow: 1"></span>{score}</div>')
    else:
        bar = (f'<div style="margin: 0 -64px; padding: 0 64px; display: flex; align-items: center; gap: 20px; background: #FAF9F6; border-bottom: 1px solid #DDDCD8; box-shadow: 0 6px 18px rgba(23, 23, 23, 0.06)">'
               f'{dial(0.6)}' + tabs(15, 24)
               + f'<span style="flex-grow: 1"></span>{score}</div>')
    return bar

def content_under_pinned(phone=False):
    return (f'<div style="margin-top: {20 if phone else 28}px; opacity: 0.45" aria-hidden="true">'
            f'<span style="font-size: {12 if phone else 13}px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase">Leadership</span>'
            f'<p style="margin: {8 if phone else 10}px 0 0; font-family: \'Crimson Text\', Georgia, serif; font-size: {26 if phone else 36}px; font-weight: 700; line-height: 1.1">Albanese still leads as preferred PM, but his net approval has fallen 40 points</p></div>')

label = lambda t, top=0: f'<span class="plabel" style="margin-top: {top}px">{t}</span>'

# ================================================================ desktop
desk = '\n\n'.join([
    label('Top of page'),
    f'''<header style="margin-top: 20px; display: flex; align-items: flex-start; gap: 40px">
<div style="display: flex; flex-direction: column; gap: 12px">
{wordmark()}
<p style="margin: 0; max-width: 420px; font-family: 'Crimson Text', Georgia, serif; font-size: 19px; line-height: 1.35; color: #4A4843">{TAGLINE}</p>
</div>
<span style="flex-grow: 1"></span>
<div style="padding-top: 6px; display: flex; align-items: flex-start; gap: 28px">
{status()}
{THEME}
</div>
</header>''',
    f'''<nav aria-label="Pages" style="margin-top: 28px; display: flex; align-items: center; gap: 24px; border-bottom: 1px solid #DDDCD8">
{tabs()}
<span style="flex-grow: 1"></span>
{next_strip()}
</nav>''',
    hero_preview(),
    label('Scrolled past the headline figure: the bar pins to the top', 64),
    '<div style="margin-top: 16px"></div>' + pinned(),
    content_under_pinned(),
])
open(OUT + 'Masthead.dc.html', 'w').write(page('Masthead', 1280, 820, desk))

# ================================================================ phone
phone = '\n\n'.join([
    label('Top of page'),
    f'''<header style="margin-top: 14px; display: flex; flex-direction: column">
<div style="display: flex; align-items: flex-start; gap: 12px">{wordmark(30, 0.8)}<span style="flex-grow: 1"></span>{THEME}</div>
<p style="margin: 10px 0 0; font-family: 'Crimson Text', Georgia, serif; font-size: 17px; line-height: 1.35; color: #4A4843">{TAGLINE}</p>
{status(phone=True)}
</header>''',
    f'<nav aria-label="Pages" style="margin-top: 16px; display: flex; border-bottom: 1px solid #DDDCD8">{tabs(short=True, phone=True)}</nav>',
    hero_preview(phone=True),
    label('Scrolled: the bar pins to the top', 48),
    '<div style="margin-top: 12px"></div>' + pinned(phone=True),
    content_under_pinned(phone=True),
])
open(OUT + 'MastheadMobile.dc.html', 'w').write(page('Masthead – phone', 390, 760, phone))
print('ok')
