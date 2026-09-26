# Build the boards on the canvas's "All polls" page:
#   AllPollsDesktop1-2, AllPollsPhone1-3   the page, top to bottom
#   AllPollsTable                          exploring the table: a poll opened, filtering, sorting, the other figures
#   AllPollsDetails                        getting around: the pinned bar, the phone's filters, readouts, dark mode
# Usage (from the repo root): python3 design/redesign-2026-09/gen/allpolls_build.py
# Reads data/allpolls.json (refresh it with gen/extract_allpolls_data.mjs). The masthead and the
# stylesheet are lifted from the Past cycles boards, so the two pages share them exactly.
import datetime as dt
import json
import math
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
S = os.path.dirname(HERE) + '/'
OUT = S + 'canvas/project/'
D = json.load(open(S + 'data/allpolls.json'))

ALP, LNP, ONP, ONPT, GRN, GRNT, OTH, OTHT = '#B9463F', '#356697', '#CC7C37', '#9E5200', '#439458', '#287C42', '#9A938B', '#70675E'
INK, G1, G2, G3, G4, G5 = '#171717', '#3D3B37', '#4A4843', '#6B6862', '#9A968E', '#C9C6BF'
BG, CARD, RULE, LINE, FAINT, OPEN = '#FAF9F6', '#FEFCF9', '#DDDCD8', '#E6E4DF', '#EFEDE8', '#F1EFEA'
WHISK = '#ADA89F'
TEAL, BROWN = '#10777C', '#674B3C'
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
MON = [m[:3] for m in MONTHS]

# ---------------------------------------------------------------- borrowed from Past cycles
PC1 = open(OUT + 'PastCyclesDesktop1.dc.html').read()
PCP1 = open(OUT + 'PastCyclesPhone1.dc.html').read()
EXTRA_CSS = '''
.sortb{padding:0;border:0;background:none;display:inline-flex;align-items:flex-end;gap:4px;min-height:32px}
.row{border-top:1px solid #E6E4DF;cursor:pointer}
.row:hover{background:#F5F3EE}
.row[aria-expanded="true"]{background:#F1EFEA}
.firm{font-size:15px;font-weight:600;color:#171717;text-decoration:none}
.firm:hover{text-decoration:underline;text-underline-offset:3px;color:#171717}
.sub{font-size:12px;line-height:1.4;color:#6B6862}
.chev{width:40px;height:44px;padding:0;border:0;background:none;color:#6B6862;display:flex;align-items:center;justify-content:center}
.swap{min-height:44px;padding:0 4px;border:0;background:none;display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:600;color:#171717}
.qbtn{width:44px;height:44px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:8px;background:transparent}
.qbtn:hover{background:#EFEDE8}
.qbtn span{width:20px;height:20px;box-sizing:border-box;border-radius:10px;border:1.5px solid #6B6862;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:#4A4843}
.search{display:flex;align-items:center;gap:8px;min-height:36px;box-sizing:border-box;padding:0 14px;border:1px solid #DFDCD7;border-radius:18px;background:#FEFCF9;box-shadow:inset 0 1px 2px rgba(43,37,33,0.07);color:#6B6862}
.search input{flex-grow:1;min-width:0;padding:0;border:0;background:transparent;font:inherit;font-size:14px;color:#171717;outline:none}
.search input::placeholder{color:#76716A}
.chip[aria-expanded="true"]{border-color:#171717;box-shadow:0 0 0 1px #171717}
.menu{display:flex;flex-direction:column;padding:8px;border:1px solid #DFDCD7;border-radius:12px;background:#FEFCF9;box-shadow:0 1px 2px rgba(64,44,26,0.06),0 12px 28px -10px rgba(64,44,26,0.22)}
.opt{min-height:40px;display:flex;align-items:center;gap:10px;padding:0 10px;border-radius:8px;font-size:14px;color:#171717;cursor:pointer}
.opt:hover{background:#F1EFEA}
.opt input{width:16px;height:16px;margin:0;accent-color:#171717;cursor:pointer}
.link{min-height:44px;padding:0;border:0;background:none;display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:500;color:#171717;text-decoration:none}
.link:hover{text-decoration:underline;text-underline-offset:3px;color:#171717}
.pill{min-height:32px;padding:0 6px 0 12px;border:1px solid #DDDCD8;border-radius:16px;background:#F1EFEA;display:inline-flex;align-items:center;gap:4px;font-size:13px;font-weight:500;color:#171717}
.pill button{width:24px;height:24px;padding:0;border:0;border-radius:12px;background:transparent;color:#4A4843;font-size:14px;line-height:1}
.pill button:hover{background:#E0DDD8}
.dk .firm,.dk .firm:hover{color:#EEEBE5}.dk .sub{color:#99948F}.dk .th,.dk .sortb{color:#99948F}.dk .row{border-top-color:#34302C}.dk .row:hover{background:#26221E}.dk .chev{color:#99948F}.dk .ext{color:#6E6964}
.row:focus-visible,.sortb:focus-visible,.chev:focus-visible,.swap:focus-visible,.qbtn:focus-visible,.link:focus-visible,.opt:focus-within,.pill button:focus-visible,.firm:focus-visible,.search:focus-within{outline:2px solid #171717;outline-offset:2px;border-radius:4px}'''
HELMET = PC1[PC1.index('<helmet>'):PC1.index('</helmet>') + len('</helmet>')].replace('</style>', EXTRA_CSS + '\n</style>')


def masthead(phone=False):
    if phone:
        m = re.search(r'<section style="width: 390px; height: 249px;.*?</section>', PCP1, re.S).group(0)
        m = m.replace('href="#cycles" aria-current="page" style=', 'href="#cycles" style=')
        m = m.replace('href="#all-polls" style=', 'href="#all-polls" aria-current="page" style=')
    else:
        m = re.search(r'<section style="width: 1280px; height: 251px;.*?</section>', PC1, re.S).group(0)
        m = m.replace('href="#past-cycles" aria-current="page">', 'href="#past-cycles">')
        m = m.replace('href="#all-polls">', 'href="#all-polls" aria-current="page">')
    assert m.count('aria-current="page"') == 1 and 'aria-current="page"' in m.split('All polls')[0][-120:], 'masthead tab swap failed'
    return m


DIAL = re.search(r'<svg viewBox="0 0 60 42".*?</svg>', PC1, re.S).group(0)


def board(title, w, h, body):
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
<div style="width: {w}px; height: {h}px; display: flex; flex-direction: column; background: #FAF9F6">
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

# ---------------------------------------------------------------- icons
COPY_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round"><rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4"></path></svg>'
DOWN_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"></path></svg>'
SEARCH_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style="flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="M15.5 15.5 20 20"></path></svg>'
CARET = '<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 2.25; stroke-linecap: round; stroke-linejoin: round"><path d="M6 9l6 6 6-6"></path></svg>'
FILTER_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round"><path d="M4 6h16M7 12h10M10 18h4"></path></svg>'
EXT = '<span class="ext" aria-hidden="true">↗</span>'


def copy_btn(label):
    return f'<button class="copy" aria-label="Copy chart: {label}" title="Copy chart">{COPY_SVG}</button>'

# ---------------------------------------------------------------- formatting


def f1(v):
    return f'{v:.1f}'.replace('-', '−')


def sgn(v, d=1):
    r = round(v, d)
    s = f'{abs(r):.{d}f}'
    return s if r == 0 else ('+' if r > 0 else '−') + s


def num(v):
    return f'{v:g}'.replace('-', '−')


def iso(s):
    return dt.date.fromisoformat(s[:10])


def dm(s):
    d = iso(s)
    return f'{d.day} {MON[d.month - 1]}'


def wdm(s):
    d = iso(s)
    return f'{d.strftime("%a")} {d.day} {MON[d.month - 1]}'


def mlabel(ym):
    y, m = map(int, ym.split('-'))
    return f'{MONTHS[m - 1]} {y}'


def field(p, year=False):
    return p['field'] + ('' if (p['ym'].startswith('2026') and not year) else ' ’' + p['ym'][2:4])


def arrow(d, dec=1):
    if d is None:
        return ''
    if round(d, dec) == 0:
        return 'no change'
    return ('▲ ' if d > 0 else '▼ ') + (f'{abs(d):.{dec}f}' if dec else f'{abs(d):g}')

# ---------------------------------------------------------------- the data
POLLS = sorted(D['polls'], key=lambda p: (p['released'], p.get('published') or ''), reverse=True)
TOTAL = len(POLLS)
SYN_ON = {m['ym']: m['a'] for m in D['synthOn']}
SYN_LNP = {m['ym']: m['alp'] for m in D['synth2pp']}
AGG_P = {m['ym']: m for m in D['aggPrimary']}
LATEST = D['latest']
AGG_ON = LATEST['onImp']['a']
UPDATED = LATEST['updatedISO']
WIN_FROM = (iso(UPDATED) - dt.timedelta(days=21)).isoformat()
IN_WIN = lambda p: p['released'] > WIN_FROM and p.get('alpOnImp') is not None
DEFF = D['deff']
# the two frozen flow tables the implied figures read through (gen-data FP_ON; flows.mjs FLOW)
FLOWS = {'on': dict(alp=1, lnp=0.315, grn=0.89, onp=0, oth=0.53), 'lnp': dict(alp=1, lnp=0, grn=0.8819, onp=0.255, oth=0.5455)}
BASE = lambda h: re.sub(r' \((MRP|SMS)\)$', '', h)
HOUSES = {}
for p in POLLS:
    HOUSES[BASE(p['pollster'])] = HOUSES.get(BASE(p['pollster']), 0) + 1


def margin(p, contest):
    """95% margin of the implied two-party share from sampling alone: each respondent's
    first preference carries its party's flow to Labor, so the share's variance is that
    of those flows across the sample, not p(1-p) - about a fifth narrower."""
    q = p.get('p') or {}
    if any(q.get(k) is None for k in ('alp', 'lnp', 'grn', 'onp')):
        return None
    fl = FLOWS[contest]
    tot = sum((q.get(k) or 0) for k in fl)
    e1 = sum((q.get(k) or 0) / tot * fl[k] for k in fl)
    e2 = sum((q.get(k) or 0) / tot * fl[k] ** 2 for k in fl)
    n = p.get('sampleEff') or p['sample'] / DEFF
    return 196 * math.sqrt((e2 - e1 * e1) / n)


def tpp(p, contest='on'):
    if contest == 'on':
        v, avg, pub = p.get('alpOnImp'), SYN_ON.get(p['ym']), p.get('tppAlt')
        pub = (pub['alp'], pub['onp']) if pub else None
    else:
        v, avg = p.get('alpImp'), SYN_LNP.get(p['ym'])
        pub = (p['alp'], p['lnp']) if p.get('alp') is not None and p.get('lnp') is not None else None
    lean = None if v is None or avg is None else round(v - avg, 1)
    return dict(v=v, avg=avg, lean=lean, moe=margin(p, contest) if v is not None else None, pub=pub)


def months_until(n_min):
    """Whole months, newest first, until at least n_min polls are shown."""
    out, n = [], 0
    for p in POLLS:
        if not out or out[-1][0] != p['ym']:
            if n >= n_min:
                break
            out.append((p['ym'], []))
        out[-1][1].append(p)
        n += 1
    return out


SHOWN = months_until(30)
N_SHOWN = sum(len(g) for _, g in SHOWN)
WIN = [p for p in POLLS if IN_WIN(p)]
WIN_V = [p['alpOnImp'] for p in WIN]
N_AHEAD = sum(1 for v in WIN_V if v > 50)
WORDS = {1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve'}
assert len(WIN) == LATEST['onImp']['n'], 'window count differs from the headline’s'


def group_note(ym, polls):
    k = sum(1 for p in polls if IN_WIN(p))
    n = len(polls)
    base = f'{n} poll{"" if n == 1 else "s"}'
    if k == n:
        return f'{base}, all in today’s {f1(AGG_ON)}'
    if k:
        return f'{base} · {k} in today’s {f1(AGG_ON)}'
    return base

# ---------------------------------------------------------------- shared pieces


def section_head(title, meta, phone=False):
    if phone:
        return (f'<div style="border-top: 2px solid #171717; padding-top: 10px; display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #6B6862">'
                f'<span style="font-size: 19px; font-weight: 600; line-height: 1.2; letter-spacing: -0.005em; color: #171717">{title}</span><span>{meta}</span></div>')
    return (f'<div style="border-top: 2px solid #171717; padding-top: 12px; display: flex; align-items: baseline; gap: 16px; font-size: 13px; color: #6B6862">\n'
            f'<span style="font-size: 22px; font-weight: 600; line-height: 1.2; letter-spacing: -0.005em; color: #171717">{title}</span>\n<span>{meta}</span>\n</div>')


def headline(text, deck, tag='h2', phone=False):
    if phone:
        return (f'<{tag} style="margin: 14px 0 0; font-family: \'Crimson Text\', Georgia, serif; font-weight: 700; font-size: 30px; line-height: 1.1; letter-spacing: -0.01em">{text}</{tag}>\n'
                f'<p style="margin: 10px 0 0; font-size: 16px; line-height: 1.5; color: #3D3B37">{deck}</p>')
    return (f'<{tag} style="margin: 16px 0 0; max-width: 1000px; font-family: \'Crimson Text\', Georgia, serif; font-weight: 700; font-size: 46px; line-height: 1.08; letter-spacing: -0.01em">{text}</{tag}>\n'
            f'<p style="margin: 12px 0 0; max-width: 880px; font-size: 18px; line-height: 1.5; color: #3D3B37">{deck}</p>')


def chart_title(text, buttons='', mt=32):
    return (f'<div style="margin-top: {mt}px; display: flex; align-items: center; gap: 4px"><span style="flex-grow: 1; font-size: 13px; font-weight: 600; line-height: 1.35">{text}</span>{buttons}</div>')


def key_row(items, mt=14, fs=13, gap=24):
    return (f'<div style="margin-top: {mt}px; display: flex; flex-wrap: wrap; align-items: center; column-gap: {gap}px; row-gap: 6px; font-size: {fs}px; color: #4A4843">'
            + ''.join(f'<span class="key">{sw}{lab}</span>' for sw, lab in items) + '</div>')


def foot(note, links, phone=False):
    lk = ''.join(links)
    if phone:
        return (f'<div style="margin-top: 20px; padding-top: 12px; border-top: 1px solid #DDDCD8; display: flex; flex-direction: column; gap: 4px; font-size: 12px; line-height: 1.5; color: #6B6862">'
                f'<span>{note}</span><div style="display: flex; gap: 20px">{lk}</div></div>')
    return (f'<div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #DDDCD8; display: flex; align-items: center; gap: 24px; font-size: 13px; line-height: 1.5; color: #6B6862">\n'
            f'<span style="max-width: 760px">{note}</span>\n<span style="flex-grow: 1"></span>\n{lk}\n</div>')


def flink(label, href, icon=''):
    return f'<a href="{href}" style="min-height: 44px; display: flex; align-items: center; gap: 8px; font-weight: 500; color: #171717; white-space: nowrap">{icon}{label}</a>'


HOW = flink('How it’s built', '#method')
HOWTO = '<div style="margin-top: 6px"><button class="how" aria-expanded="false"><span aria-hidden="true" style="font-size: 11px">▶</span>How to read these charts</button></div>'
HOWTO_T = HOWTO.replace('these charts', 'this table')


def dot_sw(c, r=5, op=1):
    return f'<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="{r}" style="fill: {c}; opacity: {op}"></circle></svg>'


def line_sw(c, w=2.25, dash=''):
    d = f'; stroke-dasharray: {dash}' if dash else ''
    return f'<svg width="24" height="12" viewBox="0 0 24 12" aria-hidden="true"><path d="M1 6H23" style="stroke: {c}; stroke-width: {w}; stroke-linecap: round{d}"></path></svg>'


def band_sw(op=0.12, edge=True):
    e = '<path d="M0 3H26" style="stroke: #9A968E; stroke-width: 1; stroke-dasharray: 3 2"></path>' if edge else ''
    return f'<svg width="26" height="14" viewBox="0 0 26 14" aria-hidden="true"><rect x="0" y="3" width="26" height="11" style="fill: #6B6862; opacity: {op}"></rect>{e}</svg>'


def state_head(n, title, note, mt=56):
    return (f'<div style="margin-top: {mt}px; display: flex; flex-direction: column; gap: 4px"><span style="font-size: 15px; font-weight: 600">{n} · {title}</span>'
            f'<span style="max-width: 760px; font-size: 13px; line-height: 1.5; color: #6B6862">{note}</span></div>')

# ================================================================ the poll table, desktop
COLS = '200px 120px 76px 28px 150px 400px 64px minmax(0, 1fr) 40px'
SW, SPAD, SMAX, SH = 400, 14, 6.0, 58


def sx(v, W=SW, pad=SPAD, m=SMAX, right=0):
    return pad + (v + m) / (2 * m) * (W - 2 * pad - right)


def lean_col(lean, contest='on'):
    if lean is None:
        return G3
    if round(lean, 1) == 0:
        return G3
    return ALP if lean > 0 else (ONP if contest == 'on' else LNP)


def lean_text_col(lean, contest='on'):
    if lean is None or round(lean, 1) == 0:
        return G3
    return ALP if lean > 0 else (ONPT if contest == 'on' else LNP)


def strip(r, contest='on', W=SW, H=SH, pad=SPAD, m=SMAX, right=0, label=None, grid=True, dark=False):
    """One poll against the average of its month: the centre line is that average, the dot the
    poll's lean, the whisker its 95% margin from sampling alone."""
    X = lambda v: sx(v, W, pad, m, right)
    cy = H / 2
    fa, ce, wh, bg = (('#2E2A26', '#6E6964', '#5C5751', '#1D1915') if dark else (FAINT, G4, WHISK, BG))
    g = []
    if grid:
        g.append('<path d="' + ''.join(f'M{X(v):.1f} 0V{H}' for v in (-4, -2, 2, 4)) + f'" style="stroke: {fa}; stroke-width: 1"></path>')
    g.append(f'<path d="M{X(0):.1f} 0V{H}" style="stroke: {ce}; stroke-width: 1.5"></path>')
    lean, moe = r['lean'], r['moe']
    if lean is not None:
        lo, hi = lean - (moe or 0), lean + (moe or 0)
        x0, x1 = X(max(-m, lo)), X(min(m, hi))
        g.append(f'<path d="M{x0:.1f} {cy}H{x1:.1f}" style="stroke: {wh}; stroke-width: 2; stroke-linecap: round"></path>')
        if lo < -m:
            g.append(f'<path d="M{X(-m) - 1:.1f} {cy}l6 -4v8z" style="fill: {wh}"></path>')
        if hi > m:
            g.append(f'<path d="M{X(m) + 1:.1f} {cy}l-6 -4v8z" style="fill: {wh}"></path>')
        c = lean_col(lean, contest)
        if dark:
            c = {ALP: '#E56356', ONP: '#EC9D4B', LNP: '#589CE6'}.get(c, '#99948F')
        g.append(f'<circle cx="{X(max(-m, min(m, lean))):.1f}" cy="{cy}" r="5" style="fill: {c}; stroke: {bg}; stroke-width: 1.5"></circle>')
    if label:
        g.append(label)
    who = 'One Nation' if contest == 'on' else 'the Coalition'
    if lean is None:
        aria = 'No implied figure: this poll published no full set of primary votes.'
    else:
        side = 'Labor' if lean > 0 else who
        aria = (f'{sgn(lean)} points against the average of its month, towards {side}; 95% margin ±{moe:.1f}.' if round(lean, 1) != 0
                else f'Level with the average of its month; 95% margin ±{moe:.1f}.')
    return (f'<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{aria}" style="display: block; overflow: visible">' + ''.join(g) + '</svg>')


def strip_head(contest='on', W=SW, pad=SPAD, m=SMAX, right=0, phone=False, dark=False):
    X = lambda v: sx(v, W, pad, m, right)
    rival = 'One Nation' if contest == 'on' else 'the Coalition'
    rc = ONPT if contest == 'on' else LNP
    lc = ALP
    tick_c, mid_c = (G3, G2)
    if dark:
        rc, lc = ('#EC9D4B' if contest == 'on' else '#589CE6'), '#E56356'
        tick_c, mid_c = '#99948F', '#C1BDB7'
    if phone:
        left, rt = f'◀ Leans to {"One Nation" if contest == "on" else "Coalition"}', 'Leans to Labor ▶'
    else:
        left, rt = f'◀ Leans to {rival}', 'Leans to Labor ▶'
    t = [f'<text class="ax" x="{X(-m):.1f}" y="12" style="font-weight: 600; fill: {rc}">{left}</text>',
         f'<text class="ax" x="{X(m):.1f}" y="12" style="text-anchor: end; font-weight: 600; fill: {lc}">{rt}</text>']
    ticks = [(-6, '6 pts'), (-4, '4'), (-2, '2'), (0, 'Average'), (2, '2'), (4, '4'), (6, '6 pts')] if not phone else [(-6, '6'), (-3, '3'), (0, 'Average'), (3, '3'), (6, '6 pts')]
    for v, lab in ticks:
        anchor = 'middle'
        if phone and v == -6:
            anchor = 'start'
        if phone and v == 6:
            anchor = 'end'
        st = f'text-anchor: {anchor}; ' + (f'font-weight: 600; fill: {mid_c}' if v == 0 else f'fill: {tick_c}')
        t.append(f'<text class="ax num" x="{X(v):.1f}" y="32" style="{st}">{lab}</text>')
    return f'<svg viewBox="0 0 {W} 38" width="{W}" height="38" aria-hidden="true" style="display: block; overflow: visible">' + ''.join(t) + '</svg>'


def sort_th(label, active=False, right=False, aria=None, color=None):
    arrow_ = '▾' if active else '<span style="color: #C9C6BF">▾</span>'
    st = (' style="justify-self: end"' if right else '')
    lab = f'<span style="color: {color}">{label}</span>' if color else label
    aria = aria or (f'Sorted by {label.lower()}' if active else f'Sort by {label.lower()}')
    return f'<button class="sortb th" role="columnheader" aria-pressed="{"true" if active else "false"}" aria-label="{aria}"{st}>{lab} <span aria-hidden="true">{arrow_}</span></button>'


def head_row(contest='on', sort='field', cols=COLS):
    fig = 'Labor v One Nation' if contest == 'on' else 'Labor v Coalition'
    return (f'<div role="row" style="display: grid; grid-template-columns: {cols}; align-items: end; padding-bottom: 6px; border-bottom: 1px solid #9A968E">'
            f'<span style="padding-left: 12px">{sort_th("Pollster", sort == "pollster")}</span>'
            + sort_th('Fieldwork', sort == 'field', aria='Sorted by fieldwork, newest first' if sort == 'field' else 'Sort by fieldwork')
            + sort_th('Sample', sort == 'sample', right=True)
            + '<span></span>'
            + sort_th(fig, sort == 'fig', aria=f'Sort by Labor’s share, {fig}')
            + f'<span role="columnheader" aria-label="Poll lean against the average of its month">{strip_head(contest)}</span>'
            + sort_th('Lean', sort == 'lean', right=True, aria='Sorted by poll lean, towards Labor first' if sort == 'lean' else 'Sort by poll lean')
            + '<span></span><span></span></div>')


def fig_cell(r, contest='on', big=15):
    rc = ONPT if contest == 'on' else LNP
    if r['v'] is None:
        return ('<span role="cell" style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 15px; color: #6B6862">—</span>'
                '<span class="sub">no primaries published</span></span>')
    pub = f'<span class="sub num">published {num(r["pub"][0])}–{num(r["pub"][1])}</span>' if r['pub'] else ''
    return (f'<span role="cell" style="display: flex; flex-direction: column; gap: 1px"><span class="num" style="font-size: {big}px; font-weight: 600; white-space: nowrap">'
            f'<span style="color: {ALP}">{f1(r["v"])}</span><span style="color: #9A968E; font-weight: 400"> – </span><span style="color: {rc}">{f1(100 - r["v"])}</span></span>{pub}</span>')


def pollster_cell(p, pad=12):
    url = p.get('url') or '#'
    return (f'<span role="rowheader" style="padding-left: {pad}px; display: flex; flex-direction: column; gap: 1px">'
            f'<a class="firm" href="{url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">{p["pollster"]}{EXT}</a>'
            f'<span class="sub">{p.get("client") or ""}</span></span>')


def field_cell(p, year=False):
    pub = f'<span class="sub num">released {dm(p["published"])}</span>' if p.get('published') else ''
    return (f'<span role="cell" style="display: flex; flex-direction: column; gap: 1px"><span class="num" style="font-size: 15px; font-weight: 600; white-space: nowrap">{field(p, year)}</span>{pub}</span>')


def sample_cell(p):
    eff = f'<span class="sub num">eff. {p["sampleEff"]:,}</span>' if p.get('sampleEff') else ''
    return (f'<span role="cell" class="num" style="display: flex; flex-direction: column; align-items: flex-end; gap: 1px"><span style="font-size: 15px">{p["sample"]:,}</span>{eff}</span>')


def chev(p, open_=False):
    return (f'<button class="chev" aria-expanded="{"true" if open_ else "false"}" aria-label="{"Hide" if open_ else "Show"} the full poll: {p["pollster"]}, {p["field"]}">'
            f'<span aria-hidden="true" style="display: inline-block; transform: rotate({90 if open_ else 0}deg)">▸</span></button>')


def poll_row(p, contest='on', open_=False, cols=COLS, year=False):
    r = tpp(p, contest)
    lean = '' if r['lean'] is None else sgn(r['lean'])
    lc = lean_text_col(r['lean'], contest)
    return (f'<div role="row" class="row" aria-expanded="{"true" if open_ else "false"}" style="display: grid; grid-template-columns: {cols}; align-items: center; min-height: {SH}px">'
            + pollster_cell(p) + field_cell(p, year) + sample_cell(p) + '<span></span>' + fig_cell(r, contest)
            + f'<span role="cell">{strip(r, contest)}</span>'
            + f'<span role="cell" class="num" style="text-align: right; font-size: 14px; font-weight: 600; color: {lc}">{lean or "—"}</span>'
            + '<span></span>' + chev(p, open_) + '</div>')


def group_row(ym, polls, contest='on', cols=COLS):
    avg = SYN_ON.get(ym) if contest == 'on' else SYN_LNP.get(ym)
    rival = 'One Nation' if contest == 'on' else 'Coalition'
    avg_html = (f'<span class="num" style="font-size: 13px; color: #6B6862; white-space: nowrap">Average <b style="font-weight: 600; color: #171717">{f1(avg)} – {f1(100 - avg)}</b></span>'
                if avg is not None else '<span></span>')
    note = group_note(ym, polls) if contest == 'on' else f'{len(polls)} poll{"" if len(polls) == 1 else "s"}'
    return (f'<div role="row" style="display: grid; grid-template-columns: {cols}; align-items: end; padding: 24px 0 8px">'
            f'<span role="rowheader" style="grid-column: 1 / span 4; padding-left: 12px; display: flex; align-items: baseline; gap: 10px">'
            f'<span style="font-size: 15px; font-weight: 600">{mlabel(ym)}</span><span style="font-size: 13px; color: #6B6862">{note}</span></span>'
            f'{avg_html}<span></span><span></span><span></span><span></span></div>')


def table(groups, contest='on', open_idx=None, detail=None, sort='field', flat=None):
    rows = [head_row(contest, sort)]
    if flat is not None:
        for p in flat:
            rows.append(poll_row(p, contest, year=True))
    else:
        for ym, polls in groups:
            rows.append(group_row(ym, polls, contest))
            for p in polls:
                is_open = open_idx is not None and p is open_idx
                rows.append(poll_row(p, contest, open_=is_open))
                if is_open and detail:
                    rows.append(detail)
    return f'<div role="table" aria-label="Every national poll since the 2025 election, newest first" style="display: flex; flex-direction: column">' + '\n'.join(rows) + '</div>'


def controls(view='2pp', contest='on', phone=False):
    rival = 'One Nation' if contest == 'on' else 'Coalition'
    if phone:
        tabs = ''.join(f'<button class="tab" aria-pressed="{"true" if k == view else "false"}" style="flex: 1; padding: 0 4px; font-size: 14px">{lab}</button>'
                       for k, lab in (('2pp', '2PP'), ('prim', 'Primary'), ('lead', 'Leaders'), ('dir', 'Direction')))
        return (f'<div role="group" aria-label="Figures" style="margin-top: 20px; display: flex; border-bottom: 1px solid #DDDCD8">{tabs}</div>'
                f'<div style="display: flex; align-items: center; gap: 4px; font-size: 13px; color: #6B6862"><button class="swap" style="font-size: 13px" title="Switch the page to Labor v {"Coalition" if contest == "on" else "One Nation"}">Labor v {rival} <span aria-hidden="true" style="color: #6B6862">⇄</span></button>'
                f'<span>· implied flows</span><span style="flex-grow: 1"></span><button class="qbtn" aria-label="How the two-party figures are counted, and the pollsters’ published figures"><span>?</span></button></div>')
    tabs = ''.join(f'<button class="tab" aria-pressed="{"true" if k == view else "false"}">{lab}</button>'
                   for k, lab in (('2pp', '2PP'), ('prim', 'Primary'), ('lead', 'Leadership'), ('dir', 'Direction')))
    right = (f'<span style="font-size: 14px; color: #6B6862">Two-party:</span><button class="swap" title="Switch the page to Labor v {"Coalition" if contest == "on" else "One Nation"}">Labor v {rival} <span aria-hidden="true" style="color: #6B6862">⇄</span></button>'
             '<span style="font-size: 14px; color: #6B6862">· implied flows</span><button class="qbtn" aria-label="How the two-party figures are counted, and the pollsters’ published figures"><span>?</span></button>') if view == '2pp' else ''
    return (f'<div style="margin-top: 28px; display: flex; align-items: center; gap: 6px; border-bottom: 1px solid #DDDCD8">'
            f'<div role="group" aria-label="Figures" style="display: flex; gap: 4px">{tabs}</div><span style="flex-grow: 1"></span>{right}</div>')


def filters(count=None, pollster=None, expanded=None, phone=False, mt=16):
    count = TOTAL if count is None else count
    cnt = (f'<span class="num" style="font-size: 14px; color: #4A4843; white-space: nowrap"><b style="font-weight: 600; color: #171717">{count}</b> of {TOTAL} polls</span>'
           if count != TOTAL else f'<span class="num" style="font-size: 14px; color: #4A4843; white-space: nowrap"><b style="font-weight: 600; color: #171717">{TOTAL}</b> polls</span>')
    pl = f'Pollster · {pollster}' if pollster else 'Pollster'

    def fchip(lab, key, extra=''):
        exp = 'true' if expanded == key else 'false'
        return f'<button class="chip" aria-haspopup="listbox" aria-expanded="{exp}"{extra}>{lab}{CARET}</button>'
    if phone:
        return (f'<label class="search" style="margin-top: 14px">{SEARCH_SVG}<input type="search" placeholder="Search a pollster, a date or a figure" aria-label="Search the polls"></label>'
                f'<div style="margin-top: 10px; display: flex; gap: 8px">{fchip("Pollster", "pollster", " style=\"min-height: 34px; padding: 0 12px; font-size: 13px\"")}'
                f'{fchip("Time", "time", " style=\"min-height: 34px; padding: 0 12px; font-size: 13px\"")}{fchip("Includes", "incl", " style=\"min-height: 34px; padding: 0 12px; font-size: 13px\"")}</div>'
                f'<div style="margin-top: 10px; display: flex; align-items: center; font-size: 13px; color: #4A4843"><span class="num"><b style="font-weight: 600; color: #171717">{count}</b> polls</span>'
                f'<span style="flex-grow: 1"></span><a class="link" href="#csv" style="font-size: 13px">{DOWN_SVG}Download CSV</a></div>')
    return (f'<div style="margin-top: {mt}px; display: flex; align-items: center; gap: 10px">'
            f'<label class="search" style="width: 330px">{SEARCH_SVG}<input type="search" placeholder="Search a pollster, a date or a figure" aria-label="Search the polls"></label>'
            f'{fchip(pl, "pollster")}{fchip("Time", "time")}{fchip("Includes", "incl")}'
            f'<span style="flex-grow: 1"></span>{cnt}<button class="chip">{DOWN_SVG}Download CSV</button></div>')


def more_row(phone=False):
    if phone:
        return (f'<div style="padding: 14px 0 0; border-top: 1px solid #E6E4DF; display: flex; align-items: center; gap: 16px">'
                f'<button class="chip" style="min-height: 34px; font-size: 13px">Show earlier months</button><a class="link" href="#all" style="font-size: 13px">Show all {TOTAL}</a>'
                f'<span style="flex-grow: 1"></span><span class="num" style="font-size: 12px; color: #6B6862">{N_SHOWN} of {TOTAL}</span></div>')
    return (f'<div style="padding: 14px 0 0; border-top: 1px solid #E6E4DF; display: flex; align-items: center; gap: 20px">'
            f'<button class="chip">Show earlier months</button><a class="link" href="#all">Show all {TOTAL}</a>'
            f'<span style="flex-grow: 1"></span><span class="num" style="font-size: 13px; color: #6B6862">{N_SHOWN} of {TOTAL} polls shown</span></div>')


WH_SW = f'<svg width="34" height="12" viewBox="0 0 34 12" aria-hidden="true"><path d="M2 6H32" style="stroke: {WHISK}; stroke-width: 2; stroke-linecap: round"></path><circle cx="17" cy="6" r="4.5" style="fill: #6B6862"></circle></svg>'
AVG_SW = '<svg width="8" height="16" viewBox="0 0 8 16" aria-hidden="true"><path d="M4 1V15" style="stroke: #9A968E; stroke-width: 1.5"></path></svg>'
TABLE_KEY = [(dot_sw(ALP), 'Leans to Labor'), (dot_sw(ONP), 'Leans to One Nation'), (WH_SW, '95% interval, from the poll’s own sample'), (AVG_SW, 'Average of the poll’s month')]
TABLE_NOTE = ('Every poll’s primary votes are read through the same preference flows, the 2025 election’s, so the polls compare like for like; the pollster’s own figure sits beneath where it published one. '
              'Those flows carry doubt of their own, but the same doubt for every poll, so each interval is sampling error alone. A dash marks a figure the pollster didn’t publish.')

# ================================================================ the poll table, phone
PW, PPAD, PRIGHT = 350, 8, 46


def card(p, contest='on'):
    r = tpp(p, contest)
    rc = ONPT if contest == 'on' else LNP
    if r['v'] is None:
        figs = '<span style="font-size: 15px; color: #6B6862">—</span>'
        pub = '<span class="sub">no primaries published</span>'
    else:
        figs = (f'<span class="num" style="font-size: 15px; font-weight: 600; white-space: nowrap"><span style="color: {ALP}">{f1(r["v"])}</span>'
                f'<span style="color: #9A968E; font-weight: 400"> – </span><span style="color: {rc}">{f1(100 - r["v"])}</span></span>')
        pub = f'<span class="sub num">published {num(r["pub"][0])}–{num(r["pub"][1])}</span>' if r['pub'] else '<span></span>'
    lean_lab = ''
    if r['lean'] is not None:
        lean_lab = f'<text x="{PW}" y="19" class="num" style="font-size: 13px; font-weight: 600; text-anchor: end; fill: {lean_text_col(r["lean"], contest)}">{sgn(r["lean"])}</text>'
    else:
        lean_lab = f'<text x="{PW}" y="19" style="font-size: 13px; text-anchor: end; fill: #6B6862">—</text>'
    url = p.get('url') or '#'
    return (f'<div role="row" class="row" aria-expanded="false" style="padding: 11px 0 8px; display: flex; flex-direction: column; gap: 2px">'
            f'<div style="display: flex; align-items: baseline; gap: 8px"><a class="firm" href="{url}" target="_blank" rel="noopener">{p["pollster"]}{EXT}</a><span style="flex-grow: 1"></span>{figs}</div>'
            f'<div style="display: flex; align-items: baseline; gap: 8px"><span class="sub num">{p.get("client") or ""} · {field(p)} · {p["sample"]:,}</span><span style="flex-grow: 1"></span>{pub}</div>'
            f'<div style="margin-top: 4px">{strip(r, contest, W=PW, H=28, pad=PPAD, right=PRIGHT, label=lean_lab)}</div></div>')


def card_group(ym, polls):
    avg = SYN_ON.get(ym)
    return (f'<div role="row" style="padding: 22px 0 6px; display: flex; align-items: baseline; gap: 8px">'
            f'<span style="font-size: 15px; font-weight: 600">{mlabel(ym)}</span><span style="font-size: 12px; color: #6B6862">{group_note(ym, polls)}</span>'
            f'<span style="flex-grow: 1"></span><span class="num" style="font-size: 12px; color: #6B6862; white-space: nowrap">Avg <b style="font-weight: 600; color: #171717">{f1(avg)}</b></span></div>')

# ================================================================ disagreement
DIS = D['discord']
DMONTHS = [f'{y}-{m:02d}' for y, m in [(2025, k) for k in range(5, 13)] + [(2026, k) for k in range(1, 10)]]
PANELS = [('p_onp', 'One Nation', ONP, ONPT), ('p_lnp', 'Coalition', LNP, LNP), ('p_right', 'One Nation + Coalition', G2, INK),
          ('p_alp', 'Labor', ALP, ALP), ('p_grn', 'Greens', GRN, GRNT)]


def verdict(R):
    if R < 0.8:
        return 'Tighter than chance'
    if R < 1.2:
        return 'Within chance'
    if R < 1.6:
        return 'A little beyond chance'
    return 'Well beyond chance'


def last(id_):
    return DIS[id_]['pts'][-1]


def dis_chart(id_, col, W=211, H=150, gut=24, labels=True, top=10, bot=124, xl=True, dark=False, guide=None):
    pts = {d['ym']: d for d in DIS[id_]['pts']}
    x0, x1 = gut, W - 6
    X = lambda ym: x0 + DMONTHS.index(ym) / (len(DMONTHS) - 1) * (x1 - x0)
    Y = lambda v: bot - v / 3 * (bot - top)
    gc, bc, tc, fl = ('#2E2A26', '#6E6964', '#99948F', '#8A857E') if dark else (LINE, G4, G3, G3)
    g = [f'<path d="' + ''.join(f'M{x0} {Y(v):.1f}H{x1}' for v in (1, 2, 3)) + f'" style="stroke: {gc}; stroke-width: 1"></path>',
         f'<path d="M{x0} {bot}H{x1}" style="stroke: {bc}; stroke-width: 1"></path>']
    if labels:
        for v in (1, 2, 3):
            g.append(f'<text class="ax num" x="{x0 - 5}" y="{Y(v) + 4:.1f}" style="text-anchor: end; fill: {tc}">{v if v < 3 else "3 pts"}</text>')
            if v == 3:
                g[-1] = f'<text class="ax num" x="{x0 - 5}" y="{Y(v) + 4:.1f}" style="text-anchor: end; fill: {tc}">3</text>'
        g.append(f'<text class="ax num" x="{x0 - 5}" y="{bot + 4}" style="text-anchor: end; fill: {tc}">0</text>')
    yms = [ym for ym in DMONTHS if ym in pts]
    area = f'M{X(yms[0]):.1f} {bot}' + ''.join(f'L{X(ym):.1f} {Y(pts[ym]["floor"]):.1f}' for ym in yms) + f'L{X(yms[-1]):.1f} {bot}Z'
    g.append(f'<path d="{area}" style="fill: {fl}; opacity: {0.2 if dark else 0.12}"></path>')
    g.append('<path d="M' + 'L'.join(f'{X(ym):.1f} {Y(pts[ym]["floor"]):.1f}' for ym in yms) + f'" style="fill: none; stroke: {bc}; stroke-width: 1; stroke-dasharray: 3 2"></path>')
    g.append('<path d="M' + 'L'.join(f'{X(ym):.1f} {Y(pts[ym]["sigma"]):.1f}' for ym in yms) + f'" class="ln" style="stroke: {col}; stroke-width: 2.25"></path>')
    e = pts[yms[-1]]
    g.append(f'<circle cx="{X(yms[-1]):.1f}" cy="{Y(e["sigma"]):.1f}" r="3.5" style="fill: {col}; stroke: {"#1D1915" if dark else BG}; stroke-width: 1.5"></circle>')
    if guide:
        gx = X(guide)
        g.append(f'<path d="M{gx:.1f} {top - 6}V{bot}" style="stroke: #171717; stroke-width: 1; opacity: 0.55"></path>')
        gp = pts[guide]
        g.append(f'<circle cx="{gx:.1f}" cy="{Y(gp["sigma"]):.1f}" r="4" style="fill: {col}; stroke: {BG}; stroke-width: 1.5"></circle>')
        g.append(f'<circle cx="{gx:.1f}" cy="{Y(gp["floor"]):.1f}" r="3" style="fill: {BG}; stroke: {G3}; stroke-width: 1.5"></circle>')
    if xl:
        g.append(f'<text class="ax" x="{x0}" y="{bot + 18}" style="fill: {tc}">May ’25</text>')
        g.append(f'<text class="ax" x="{X("2026-01"):.1f}" y="{bot + 18}" style="text-anchor: middle; fill: {tc}">Jan ’26</text>')
        g.append(f'<text class="ax" x="{x1}" y="{bot + 18}" style="text-anchor: end; fill: {tc}">Sep</text>')
    name = DIS[id_]['label']
    aria = f'{name}: polls sit a typical {e["sigma"]:.1f} points from their trend, against {e["floor"]:.1f} from sampling error alone.'
    return f'<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{aria}" style="display: block; overflow: visible">' + ''.join(g) + '</svg>'


def dis_panel(id_, name, col, tcol, W=211, first=False, phone=False, dark=False, guide=None):
    e = last(id_)
    big, lab = (22, 13) if phone else (26, 13)
    ink, g3, g2 = (('#EEEBE5', '#99948F', '#C1BDB7') if dark else (INK, G3, G2))
    if dark:
        tcol = {ONPT: '#EC9D4B', LNP: '#589CE6', ALP: '#E56356', GRNT: '#4A9A5E', INK: '#EEEBE5'}.get(tcol, tcol)
        col = {ONP: '#EC9D4B', LNP: '#589CE6', ALP: '#E56356', GRN: '#4A9A5E', G2: '#C1BDB7'}.get(col, col)
    H, bot = ((122, 98) if phone else (150, 124))
    return (f'<div style="display: flex; flex-direction: column; min-width: 0">'
            f'<span style="font-size: {13 if phone else 14}px; font-weight: 600; line-height: 1.3; color: {tcol}">{name}</span>'
            f'<span style="margin-top: 2px; display: flex; align-items: baseline; gap: 5px"><span class="num" style="font-size: {big}px; font-weight: 500; letter-spacing: -0.01em; color: {ink}">{e["sigma"]:.1f}</span><span style="font-size: {lab}px; color: {g3}">pts</span></span>'
            f'<span class="num" style="font-size: {12 if phone else 13}px; line-height: 1.4; color: {g2}">Chance alone {e["floor"]:.1f} · {e["R"]:.1f}×</span>'
            f'<span style="font-size: {12 if phone else 13}px; line-height: 1.4; font-weight: 600; color: {ink}">{verdict(e["R"])}</span>'
            f'<div style="margin-top: 10px">{dis_chart(id_, col, W=W, H=H, gut=24 if not phone else 20, labels=first, bot=bot, dark=dark, guide=guide)}</div></div>')


R_ON, R_LNP, R_RIGHT, R_ALP, R_GRN = (last(k) for k in ('p_onp', 'p_lnp', 'p_right', 'p_alp', 'p_grn'))
DIS_HEAD = 'The polls disagree on how the right’s vote splits, not on its size'
DIS_DECK = (f'Polls of One Nation’s vote typically sit {R_ON["sigma"]:.1f} points from the trend through them, and polls of the Coalition’s {R_LNP["sigma"]:.1f}: '
            f'about half as much again as sampling error alone would put them. Add the two parties together, though, and their combined vote varies only as much as chance allows, as Labor’s does.')
DIS_KEY = [(line_sw(G2), 'Typical distance of a poll from the trend through the polls'), (band_sw(), 'What sampling error alone would produce')]
DIS_SCALE = ('Within chance: under 1.2 times sampling error · A little beyond: 1.2 to 1.6 · Well beyond: 1.6 or more · '
             'Under 0.8, tighter than chance, would suggest pollsters were steering towards each other.')
DIS_NOTE = (f'Spread is how far each poll typically sits from the trend through the polls around it, with recent polls counting more; weighting by sample size would mute the small polls whose divergence is being measured. '
            f'Sampling error is what each poll’s own sample predicts, with a design effect of {DEFF:g}. Measured across all {TOTAL} polls; the table’s filters don’t narrow it.')

# ================================================================ pollster lean
HL = D['houseLean']['onimp']
HE = D['houseEffects']['synthOn']
LEAN_ROWS = sorted(((h, s[-1]['v'], s, HE.get(h, {}).get('n', 0)) for h, s in HL.items()), key=lambda t: (-t[1], -t[3]))
LMONTHS = [f'{y}-{m:02d}' for y, m in [(2025, k) for k in range(6, 13)] + [(2026, k) for k in range(1, 10)]]
TOP = LEAN_ROWS[0]
REST_MAX = max(abs(t[1]) for t in LEAN_ROWS[1:])
LEAN_HEAD = f'{TOP[0]} leans furthest from the pack, and only by {TOP[1]:.1f} points'
LEAN_DECK = (f'Its polls run {TOP[1]:.1f} points more Labor’s way than the pollsters polling alongside it, and no other pollster is more than {REST_MAX:.1f} points off. '
             'The averages take each lean out before the polls are combined.')
LEAN_NOTE = ('A pollster’s lean is its average gap to the other pollsters polling within four weeks of it, all read through the same preference flows, with recent polls counting most. '
             'One with few polls is pulled towards zero until its record builds. Because every poll uses the same flows, a lean comes from a pollster’s primary votes, not from how it allocates preferences.')
LCOLS = '230px 312px 60px 40px minmax(0, 1fr)'
SPW = 1152 - 230 - 312 - 60 - 40
LBW, LBM = 312, 1.2


def lbx(v, W=LBW, pad=16, m=LBM):
    return pad + (v + m) / (2 * m) * (W - 2 * pad)


def lean_bar(v, W=LBW, H=44, pad=16, dark=False):
    X = lambda u: lbx(u, W, pad)
    fa, ce = (('#2E2A26', '#6E6964') if dark else (FAINT, G4))
    g = ['<path d="' + ''.join(f'M{X(u):.1f} 4V{H - 4}' for u in (-1, -0.5, 0.5, 1)) + f'" style="stroke: {fa}; stroke-width: 1"></path>']
    c = ALP if v > 0 else ONP
    if round(v, 1) != 0:
        a, b = sorted((X(0), X(v)))
        g.append(f'<rect x="{a:.1f}" y="{H / 2 - 7}" width="{b - a:.1f}" height="14" rx="2" style="fill: {c}"></rect>')
    g.append(f'<path d="M{X(0):.1f} 2V{H - 2}" style="stroke: {ce}; stroke-width: 1.5"></path>')
    side = 'Labor' if v > 0 else 'One Nation'
    aria = f'{abs(v):.1f} points towards {side}' if round(v, 1) != 0 else 'Level with the other pollsters'
    return f'<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{aria}" style="display: block">' + ''.join(g) + '</svg>'


def lean_spark(series, W=None, H=44, m=1.0, dark=False, guide=None):
    W = W or SPW
    pts = {d['ym']: d['v'] for d in series}
    x0, x1 = 6, W - 8
    X = lambda ym: x0 + LMONTHS.index(ym) / (len(LMONTHS) - 1) * (x1 - x0)
    Y = lambda v: H / 2 - max(-m, min(m, v)) / m * (H / 2 - 3)
    zc, lc = (('#6E6964', '#C1BDB7') if dark else (G5, G2))
    g = [f'<path d="M{x0} {H / 2}H{x1}" style="stroke: {zc}; stroke-width: 1; stroke-dasharray: 3 3"></path>']
    yms = [ym for ym in LMONTHS if ym in pts]
    line = 'L'.join(f'{X(ym):.1f} {Y(pts[ym]):.1f}' for ym in yms)
    g.append(f'<path d="M{X(yms[0]):.1f} {H / 2}L{line}L{X(yms[-1]):.1f} {H / 2}Z" style="fill: {lc}; opacity: 0.12"></path>')
    g.append(f'<path d="M{line}" class="ln" style="stroke: {lc}; stroke-width: 1.75"></path>')
    v = pts[yms[-1]]
    c = G3 if round(v, 1) == 0 else (ALP if v > 0 else ONP)
    g.append(f'<circle cx="{X(yms[-1]):.1f}" cy="{Y(v):.1f}" r="3.5" style="fill: {c}; stroke: {"#1D1915" if dark else BG}; stroke-width: 1.5"></circle>')
    if guide and guide in pts:
        gx = X(guide)
        g.append(f'<path d="M{gx:.1f} 0V{H}" style="stroke: #171717; stroke-width: 1; opacity: 0.55"></path><circle cx="{gx:.1f}" cy="{Y(pts[guide]):.1f}" r="4" style="fill: {INK}; stroke: {BG}; stroke-width: 1.5"></circle>')
    first = yms[0]
    aria = f'Lean month by month since {mlabel(first)}, from {sgn(pts[first])} to {sgn(v)}'
    return f'<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{aria}" style="display: block; overflow: visible">' + ''.join(g) + '</svg>'


def lean_head(W=LBW, pad=16):
    X = lambda u: lbx(u, W, pad)
    t = [f'<text class="ax" x="{X(-LBM):.1f}" y="12" style="font-weight: 600; fill: {ONPT}">◀ To One Nation</text>',
         f'<text class="ax" x="{X(LBM):.1f}" y="12" style="text-anchor: end; font-weight: 600; fill: {ALP}">To Labor ▶</text>']
    for u, lab in ((-1, '1 pt'), (-0.5, '0.5'), (0, 'The others'), (0.5, '0.5'), (1, '1 pt')):
        st = 'text-anchor: middle; ' + ('font-weight: 600; fill: #4A4843' if u == 0 else 'fill: #6B6862')
        t.append(f'<text class="ax num" x="{X(u):.1f}" y="32" style="{st}">{lab}</text>')
    return f'<svg viewBox="0 0 {W} 38" width="{W}" height="38" aria-hidden="true" style="display: block; overflow: visible">' + ''.join(t) + '</svg>'


def spark_head(W=None):
    W = W or SPW
    x0, x1 = 6, W - 8
    X = lambda ym: x0 + LMONTHS.index(ym) / (len(LMONTHS) - 1) * (x1 - x0)
    t = ['<text class="th" x="0" y="12" style="font-size: 12px; font-weight: 600; letter-spacing: 0.04em; fill: #6B6862">SINCE THE ELECTION <tspan style="font-weight: 400; letter-spacing: 0">· each row’s height is a point either way</tspan></text>']
    for ym, lab, a in (('2025-06', 'Jun ’25', 'start'), ('2025-10', 'Oct', 'middle'), ('2026-02', 'Feb ’26', 'middle'), ('2026-06', 'Jun', 'middle'), ('2026-09', 'Sep', 'end')):
        t.append(f'<text class="ax" x="{X(ym):.1f}" y="32" style="text-anchor: {a}">{lab}</text>')
    return f'<svg viewBox="0 0 {W} 38" width="{W}" height="38" aria-hidden="true" style="display: block; overflow: visible">' + ''.join(t) + '</svg>'


def lean_table(W=1152, guide=None):
    rows = [f'<div role="row" style="display: grid; grid-template-columns: {LCOLS}; align-items: end; padding-bottom: 6px; border-bottom: 1px solid #9A968E">'
            f'<span class="th" role="columnheader" style="padding-left: 12px; padding-bottom: 2px">Pollster</span><span role="columnheader">{lean_head()}</span>'
            f'<span class="th" role="columnheader" style="text-align: right; padding-bottom: 2px">Now</span><span></span><span role="columnheader">{spark_head()}</span></div>']
    for h, v, s, n in LEAN_ROWS:
        c = G3 if round(v, 1) == 0 else (ALP if v > 0 else ONPT)
        gd = guide if (guide and h == TOP[0]) else None
        rows.append(f'<div role="row" class="srow" style="display: grid; grid-template-columns: {LCOLS}; align-items: center; min-height: 48px">'
                    f'<span role="rowheader" style="padding-left: 12px; display: flex; align-items: baseline; gap: 8px"><span style="font-size: 15px; font-weight: 600">{h}</span>'
                    f'<span class="sub num">{n} polls</span></span><span role="cell">{lean_bar(v)}</span>'
                    f'<span role="cell" class="num" style="text-align: right; font-size: 15px; font-weight: 600; color: {c}">{sgn(v) if round(v, 1) else "0.0"}</span><span></span>'
                    f'<span role="cell">{lean_spark(s, guide=gd)}</span></div>')
    return '<div role="table" aria-label="Each pollster’s lean against the others, now and month by month since the election" style="margin-top: 16px">' + '\n'.join(rows) + '</div>'

# ================================================================ preference flows
FD, FDO = D['flowDrift'], D['flowDriftOn']
FMONTHS = LMONTHS
FLOW_HEAD = 'Preferences are still flowing much as they did at the election'
FLOW_DECK = (f'The pollsters’ own two-party figures sit where their primary votes and the 2025 flows put them: '
             f'{"level" if round(FD["now"]["v"], 1) == 0 else sgn(FD["now"]["v"]) + " points off"} against the Coalition, and {FDO["now"]["v"]:.1f} points kinder to Labor against One Nation, '
             f'well inside the margin of ±{max(FD["now"]["ci95"], FDO["now"]["ci95"]):.1f}. A shift in where voters send their preferences would show here first.')
FLOW_NOTE = ('Each pollster is measured against its own habits: its polls in the six months after the election, or its first polls if it started later, so its usual way of allocating preferences counts as zero. '
             'No count of Labor v One Nation preferences exists, so that chart shows drift since each pollster’s first head-to-heads. This check corrects no other figure on the page.')


def flow_chart(fd, rival, W=552, H=250, x0=40, rpad=76, top=14, bot=214, phone=False, empty_note=None):
    x1 = W - rpad
    X = lambda ym: x0 + FMONTHS.index(ym) / (len(FMONTHS) - 1) * (x1 - x0)
    zero = (top + bot) / 2
    Y = lambda v: zero - v / 3.5 * (zero - top)
    g = ['<path d="' + ''.join(f'M{x0} {Y(v):.1f}H{x1}' for v in (-3, -2, -1, 1, 2, 3)) + '" class="grid"></path>',
         f'<path d="M{x0} {zero}H{x1}" style="stroke: #9A968E; stroke-width: 1"></path>']
    for v in (-3, -2, -1, 0, 1, 2, 3):
        lab = '0' if v == 0 else sgn(v, 0)
        g.append(f'<text class="ax num" x="{x0 - 8}" y="{Y(v) + 4:.1f}" style="text-anchor: end">{lab}</text>')
    ms = [d for d in fd['months'] if d['ym'] in FMONTHS]
    band = ('M' + 'L'.join(f'{X(d["ym"]):.1f} {Y(d["v"] + d["ci95"]):.1f}' for d in ms)
            + 'L' + 'L'.join(f'{X(d["ym"]):.1f} {Y(d["v"] - d["ci95"]):.1f}' for d in reversed(ms)) + 'Z')
    g.append(f'<path d="{band}" style="fill: #6B6862; opacity: 0.14"></path>')
    for h, s in fd['houses'].items():
        for d in s:
            if d['ym'] in FMONTHS:
                g.append(f'<circle cx="{X(d["ym"]):.1f}" cy="{Y(max(-3.4, min(3.4, d["v"]))):.1f}" r="2.5" style="fill: #6B6862; opacity: 0.4"></circle>')
    g.append('<path d="M' + 'L'.join(f'{X(d["ym"]):.1f} {Y(d["v"]):.1f}' for d in ms) + '" class="ln" style="stroke: #171717; stroke-width: 2.25"></path>')
    e = ms[-1]
    g.append(f'<circle cx="{X(e["ym"]):.1f}" cy="{Y(e["v"]):.1f}" r="3" style="fill: #171717"></circle>')
    # the current reading, pooled over the latest window: the figure the text quotes
    nw = fd['now']
    nx = x1 + 22
    g.append(f'<path d="M{nx} {Y(nw["v"] + nw["ci95"]):.1f}V{Y(nw["v"] - nw["ci95"]):.1f}" style="stroke: #171717; stroke-width: 2; stroke-linecap: round; opacity: 0.35"></path>')
    g.append(f'<circle cx="{nx}" cy="{Y(nw["v"]):.1f}" r="5" style="fill: #171717; stroke: {BG}; stroke-width: 1.5"></circle>')
    g.append(f'<text class="axb" x="{nx}" y="{top - 2}" style="text-anchor: middle">Now</text>')
    g.append(f'<text class="num halo" x="{nx + 10}" y="{Y(nw["v"]) + 5:.1f}" style="font-size: 14px; font-weight: 600; fill: #171717">{sgn(nw["v"]) if round(nw["v"], 1) else "0.0"}</text>')
    g.append(f'<text class="num halo" x="{nx + 10}" y="{Y(nw["v"]) + 20:.1f}" style="font-size: 12px; fill: #6B6862">±{nw["ci95"]:.1f}</text>')
    g.append(f'<text class="ax halo" x="{x0 + 6}" y="{Y(3.5) + 13:.1f}" style="fill: #4A4843">▲ Published kinder to Labor</text>')
    g.append(f'<text class="ax halo" x="{x0 + 6}" y="{Y(-3.5) - 6:.1f}" style="fill: #4A4843">▼ Kinder to {rival}</text>')
    if empty_note:
        xe = (x0 + X(ms[0]['ym'])) / 2
        g.append(f'<text class="ax halo" x="{xe:.1f}" y="{Y(1.4):.1f}" style="text-anchor: middle; font-style: italic; fill: #6B6862">{empty_note}</text>')
    ticks = (('2025-06', 'Jun ’25'), ('2025-09', 'Sep'), ('2025-12', 'Dec'), ('2026-03', 'Mar ’26'), ('2026-06', 'Jun'), ('2026-09', 'Sep')) if not phone else (('2025-06', 'Jun ’25'), ('2026-01', 'Jan ’26'), ('2026-09', 'Sep'))
    g.append(f'<path class="base" d="M{x0} {bot}H{x1}' + ''.join(f'M{X(ym):.1f} {bot}v4' for ym, _ in ticks) + '"></path>')
    for ym, lab in ticks:
        g.append(f'<text class="ax" x="{X(ym):.1f}" y="{bot + 20}" style="text-anchor: middle">{lab}</text>')
    aria = (f'Published minus implied two-party figure against {rival}, pooled across pollsters by month: now {sgn(e["v"]) if round(e["v"], 1) else "0.0"} points, 95% interval ±{fd["now"]["ci95"]:.1f}.')
    return f'<svg viewBox="0 0 {W} {H + 12}" width="{W}" height="{H + 12}" role="img" aria-label="{aria}" style="margin-top: 8px; display: block; overflow: visible">' + ''.join(g) + '</svg>'


NOW_SW = '<svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true"><path d="M7 2V16" style="stroke: #171717; stroke-width: 2; stroke-linecap: round; opacity: 0.35"></path><circle cx="7" cy="9" r="4.5" style="fill: #171717"></circle></svg>'
FLOW_KEY = [(line_sw(INK), 'All pollsters, combined month by month'), (band_sw(0.14, edge=False), '95% interval'), (dot_sw(G3, r=3, op=0.55), 'One pollster’s gap that month'),
            (NOW_SW, 'Now: the latest weeks pooled, with its 95% interval')]
PICK = f'<button class="chip" aria-haspopup="listbox" style="min-height: 34px; font-size: 13px">Highlight a pollster{CARET}</button>'

# ================================================================ desktop page
H1 = f'The {WORDS[len(WIN)]} polls that make up Labor’s {f1(AGG_ON)} run from {f1(min(WIN_V))} to {f1(max(WIN_V))}'
N_OUT = sum(1 for p in WIN if abs(tpp(p)['lean']) > tpp(p)['moe'])
H1_DECK = (f'{WORDS[N_AHEAD].capitalize()} have Labor ahead of One Nation, and '
           + ('none sits further from the average than its own margin of error. ' if N_OUT == 0 else f'{WORDS[N_OUT]} sit further from the average than their margin of error. ')
           + 'Below is every national poll since the 2025 election, newest first, each linked to its source.')
NAV = [('#disagreement', 'How much the polls disagree'), ('#pollster-lean', 'How each pollster leans'), ('#preference-flows', 'Preference flows')]


def page_header():
    nav = ''.join(f'<a href="{h}" style="font-weight: 500; color: #4A4843; text-decoration: none; white-space: nowrap">{t}</a>' for h, t in NAV)
    return (f'<div style="display: flex; align-items: baseline; gap: 16px; font-size: 13px; color: #6B6862">\n'
            f'<span style="font-size: 22px; font-weight: 600; line-height: 1.2; letter-spacing: -0.005em; color: #171717">All polls</span>\n'
            f'<span>Every national poll since the 2025 election, {TOTAL} from {len(HOUSES)} pollsters</span>\n<span style="flex-grow: 1"></span>\n'
            f'<nav aria-label="On this page" style="display: flex; align-items: baseline; gap: 18px; font-size: 13px">{nav}</nav>\n</div>\n\n'
            + headline(H1, H1_DECK, tag='h1'))


def polls_section():
    return ('<section id="polls" style="width: 1280px; box-sizing: border-box; padding: 44px 64px 56px; display: flex; flex-direction: column; flex-shrink: 0; background: #FAF9F6">\n'
            + page_header() + '\n\n' + controls() + '\n' + filters() + '\n\n'
            + '<div style="margin-top: 18px">' + table(SHOWN) + '</div>\n' + more_row() + '\n'
            + key_row(TABLE_KEY, mt=18) + '\n' + HOWTO_T + foot(TABLE_NOTE, [flink('Report an error', '/feedback/'), HOW]) + '\n</section>')


def dis_section(phone=False):
    if phone:
        grid = ''.join(dis_panel(k, n, c, t, W=165, first=(i % 2 == 0), phone=True) for i, (k, n, c, t) in enumerate(PANELS))
        grid += ('<div style="padding-top: 38px; display: flex; flex-direction: column; gap: 10px; font-size: 12px; line-height: 1.4; color: #4A4843">'
                 + ''.join(f'<span class="key" style="align-items: flex-start">{sw}<span>{lab}</span></span>' for sw, lab in DIS_KEY) + '</div>')
        return ('<section id="disagreement" style="width: 390px; box-sizing: border-box; padding: 40px 20px; display: flex; flex-direction: column; flex-shrink: 0; background: #FAF9F6">\n'
                + section_head('How much the polls disagree', 'The spread between polls, against what sampling error alone would produce', phone=True)
                + headline(DIS_HEAD, DIS_DECK, phone=True)
                + '<div role="group" aria-label="Measure" style="margin-top: 20px; display: flex; border-bottom: 1px solid #DDDCD8"><button class="tab" aria-pressed="true" style="flex: 1; font-size: 14px">Primary vote</button><button class="tab" aria-pressed="false" style="flex: 1; font-size: 14px">Two-party</button></div>'
                + chart_title('How far polls typically sit from their trend, points', copy_btn('how much the polls disagree'), mt=16)
                + f'<div style="margin-top: 10px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 20px; row-gap: 26px">{grid}</div>'
                + f'<p style="margin: 18px 0 0; font-size: 12px; line-height: 1.5; color: #6B6862">{DIS_SCALE}</p>'
                + HOWTO
                + foot(DIS_NOTE, [HOW], phone=True) + '\n</section>')
    grid = ''.join(dis_panel(k, n, c, t, first=(i == 0)) for i, (k, n, c, t) in enumerate(PANELS))
    return ('<section id="disagreement" style="width: 1280px; box-sizing: border-box; padding: 56px 64px; display: flex; flex-direction: column; flex-shrink: 0; background: #FAF9F6">\n'
            + section_head('How much the polls disagree', 'The spread between polls, against what sampling error alone would produce') + '\n\n'
            + headline(DIS_HEAD, DIS_DECK) + '\n\n'
            + '<div role="group" aria-label="Measure" style="margin-top: 28px; display: flex; gap: 4px; border-bottom: 1px solid #DDDCD8"><button class="tab" aria-pressed="true">Primary vote</button><button class="tab" aria-pressed="false">Two-party</button></div>\n'
            + chart_title('How far polls typically sit from the trend through them, points', copy_btn('how much the polls disagree'), mt=18) + '\n'
            + f'<div style="margin-top: 12px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); column-gap: 24px">{grid}</div>\n'
            + key_row(DIS_KEY, mt=18) + '\n'
            + f'<p style="margin: 8px 0 0; font-size: 13px; line-height: 1.5; color: #6B6862">{DIS_SCALE}</p>\n'
            + HOWTO + foot(DIS_NOTE, [HOW]) + '\n</section>')


def lean_section(phone=False):
    tabs = ''.join(f'<button class="tab" aria-pressed="{"true" if i == 0 else "false"}"{" style=\"flex: 1; padding: 0 4px; font-size: 14px\"" if phone else ""}>{t}</button>'
                   for i, t in enumerate(('Two-party', 'Labor', 'Coalition', 'One Nation')))
    if phone:
        rows = []
        for h, v, s, n in LEAN_ROWS:
            c = G3 if round(v, 1) == 0 else (ALP if v > 0 else ONPT)
            rows.append(f'<div role="row" class="srow" style="padding: 10px 0 6px; display: flex; flex-direction: column; gap: 2px">'
                        f'<div style="display: flex; align-items: center; gap: 8px"><span style="width: 118px; display: flex; flex-direction: column"><span style="font-size: 14px; font-weight: 600; line-height: 1.25">{h}</span><span class="sub num">{n} polls</span></span>'
                        f'{lean_bar(v, W=176, H=34, pad=10)}<span class="num" style="flex-grow: 1; text-align: right; font-size: 14px; font-weight: 600; color: {c}">{sgn(v) if round(v, 1) else "0.0"}</span></div>'
                        f'{lean_spark(s, W=350, H=26)}</div>')
        X = lambda u: lbx(u, 176, 10)
        head = (f'<div style="display: flex; align-items: end; gap: 8px; padding-bottom: 4px; border-bottom: 1px solid #9A968E"><span class="th" style="width: 118px">Pollster</span>'
                f'<svg viewBox="0 0 176 34" width="176" height="34" aria-hidden="true" style="display: block; overflow: visible"><text class="ax" x="{X(-1.2):.1f}" y="10" style="font-weight: 600; fill: {ONPT}">◀ One Nation</text>'
                f'<text class="ax" x="{X(1.2):.1f}" y="10" style="text-anchor: end; font-weight: 600; fill: {ALP}">Labor ▶</text>'
                f'<text class="ax num" x="{X(-1):.1f}" y="28" style="text-anchor: middle">1 pt</text><text class="ax num" x="{X(0):.1f}" y="28" style="text-anchor: middle; font-weight: 600; fill: #4A4843">Others</text><text class="ax num" x="{X(1):.1f}" y="28" style="text-anchor: middle">1 pt</text></svg>'
                f'<span class="th" style="flex-grow: 1; text-align: right">Now</span></div>')
        return ('<section id="pollster-lean" style="width: 390px; box-sizing: border-box; padding: 40px 20px; display: flex; flex-direction: column; flex-shrink: 0; background: #FAF9F6">\n'
                + section_head('How each pollster leans', 'Each pollster’s usual gap to the others polling at the same time', phone=True)
                + headline(LEAN_HEAD, LEAN_DECK, phone=True)
                + f'<div role="group" aria-label="Measure" style="margin-top: 20px; display: flex; border-bottom: 1px solid #DDDCD8">{tabs}</div>'
                + chart_title('Lean on Labor v One Nation, points; the line beneath each is its lean month by month since the election', copy_btn('how each pollster leans'), mt=16)
                + f'<div role="table" aria-label="Each pollster’s lean against the others" style="margin-top: 10px">{head}{"".join(rows)}</div>'
                + foot(LEAN_NOTE, [HOW], phone=True) + '\n</section>')
    return ('<section id="pollster-lean" style="width: 1280px; box-sizing: border-box; padding: 56px 64px; display: flex; flex-direction: column; flex-shrink: 0; background: #FAF9F6">\n'
            + section_head('How each pollster leans', 'Each pollster’s usual gap to the others polling at the same time, which the averages take out') + '\n\n'
            + headline(LEAN_HEAD, LEAN_DECK) + '\n\n'
            + f'<div style="margin-top: 28px; display: flex; align-items: center; gap: 6px; border-bottom: 1px solid #DDDCD8"><div role="group" aria-label="Measure" style="display: flex; gap: 4px">{tabs}</div>'
            + '</div>\n'
            + chart_title('Each pollster’s lean on Labor v One Nation, points', copy_btn('how each pollster leans'), mt=18) + '\n'
            + lean_table() + '\n' + foot(LEAN_NOTE, [HOW]) + '\n</section>')


def flow_section(phone=False):
    if phone:
        return ('<section id="preference-flows" style="width: 390px; box-sizing: border-box; padding: 40px 20px 48px; display: flex; flex-direction: column; flex-shrink: 0; background: #FAF9F6">\n'
                + section_head('Preference flows', 'Whether preferences still flow the way they did at the 2025 election', phone=True)
                + headline(FLOW_HEAD, FLOW_DECK, phone=True)
                + chart_title('Against the Coalition: published minus implied, points', copy_btn('preference flows against the Coalition'), mt=22)
                + flow_chart(FD, 'the Coalition', W=350, H=210, x0=26, rpad=66, top=14, bot=178, phone=True)
                + chart_title('Against One Nation', copy_btn('preference flows against One Nation'), mt=20)
                + flow_chart(FDO, 'One Nation', W=350, H=210, x0=26, rpad=66, top=14, bot=178, phone=True, empty_note='Nothing before Jan')
                + key_row(FLOW_KEY, mt=16, fs=12, gap=14)
                + foot(FLOW_NOTE, [HOW], phone=True) + '\n</section>')
    two = (f'<div style="margin-top: 32px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 48px">'
           f'<div style="display: flex; flex-direction: column">{chart_title("Against the Coalition: published minus implied, points", PICK + "<span style=\"width: 8px\"></span>" + copy_btn("preference flows against the Coalition"), mt=0)}{flow_chart(FD, "the Coalition")}</div>'
           f'<div style="display: flex; flex-direction: column">{chart_title("Against One Nation: published minus implied, points", copy_btn("preference flows against One Nation"), mt=0)}'
           f'<div style="min-height: 0">{flow_chart(FDO, "One Nation", empty_note="No readings before January")}</div></div></div>')
    return ('<section id="preference-flows" style="width: 1280px; box-sizing: border-box; padding: 56px 64px 64px; display: flex; flex-direction: column; flex-shrink: 0; background: #FAF9F6">\n'
            + section_head('Preference flows', 'Whether preferences still flow the way they did at the 2025 election') + '\n\n'
            + headline(FLOW_HEAD, FLOW_DECK) + '\n\n' + two + '\n'
            + key_row(FLOW_KEY, mt=14) + '\n' + foot(FLOW_NOTE, [HOW]) + '\n</section>')

# ================================================================ phone page


def phone_header():
    return ('<section id="polls" style="width: 390px; box-sizing: border-box; padding: 24px 20px 40px; display: flex; flex-direction: column; flex-shrink: 0; background: #FAF9F6">\n'
            f'<div style="display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #6B6862"><span style="font-size: 19px; font-weight: 600; line-height: 1.2; letter-spacing: -0.005em; color: #171717">All polls</span>'
            f'<span>Every national poll since the 2025 election, {TOTAL} from {len(HOUSES)} pollsters</span></div>\n'
            + headline(H1, H1_DECK, tag='h1', phone=True) + '\n' + controls(phone=True) + '\n' + filters(phone=True) + '\n'
            + f'<div style="margin-top: 14px; padding-bottom: 6px; border-bottom: 1px solid #9A968E">{strip_head(W=PW, pad=PPAD, right=PRIGHT, phone=True)}</div>')


def phone_cards(groups):
    out = []
    for ym, polls in groups:
        out.append(card_group(ym, polls))
        out.extend(card(p) for p in polls)
    return '\n'.join(out)


PH_KEY = [(dot_sw(ALP), 'Leans to Labor'), (dot_sw(ONP), 'Leans to One Nation'), (WH_SW, '95% interval, from its sample'), (AVG_SW, 'Average of its month')]


def phone_table_end():
    return (more_row(phone=True) + key_row(PH_KEY, mt=16, fs=12, gap=14)
            + foot('Every poll is read through the 2025 election’s preference flows, so polls compare like for like; the pollster’s own figure sits beneath. Each interval is sampling error alone. A dash marks a figure the pollster didn’t publish.',
                   [flink('Report an error', '/feedback/'), HOW], phone=True))


# ================================================================ other views (table board)
PRIM = [('alp', 'ALP', ALP), ('lnp', 'L/NP', LNP), ('grn', 'GRN', GRNT), ('onp', 'ON', ONPT), ('oth', 'OTH', OTHT)]
PCOLS = '200px 120px 76px 36px 230px 410px minmax(0, 1fr) 40px'
PSW = 410


def prim_strip(q, ring=False, H=SH, W=PSW):
    X = lambda v: 14 + v / 40 * (W - 28)
    g = []
    if not ring:
        g.append('<path d="' + ''.join(f'M{X(v):.1f} 0V{H}' for v in (0, 10, 20, 30, 40)) + f'" style="stroke: {FAINT}; stroke-width: 1"></path>')
    for k, _, c in sorted(PRIM, key=lambda t: -(q.get(t[0]) or 0)):
        v = q.get(k)
        if v is None:
            continue
        fill = {'alp': ALP, 'lnp': LNP, 'grn': GRN, 'onp': ONP, 'oth': OTH}[k]
        if ring:
            g.append(f'<circle cx="{X(v):.1f}" cy="{H / 2}" r="4.5" style="fill: {BG}; stroke: {fill}; stroke-width: 1.75"></circle>')
        else:
            g.append(f'<circle cx="{X(v):.1f}" cy="{H / 2}" r="5" style="fill: {fill}; stroke: {BG}; stroke-width: 1.5"></circle>')
    aria = 'Primary vote: ' + ', '.join(f'{lab} {num(q[k])}' for k, lab, _ in PRIM if q.get(k) is not None)
    return f'<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{aria}" style="display: block; overflow: visible">' + ''.join(g) + '</svg>'


def prim_table(polls, ym):
    X = lambda v: 14 + v / 40 * (PSW - 28)
    axis = (f'<svg viewBox="0 0 {PSW} 38" width="{PSW}" height="38" aria-hidden="true" style="display: block; overflow: visible"><text class="th" x="14" y="12" style="font-size: 12px; font-weight: 600; letter-spacing: 0.04em; fill: #6B6862">PRIMARY VOTE, %</text>'
            + ''.join(f'<text class="ax num" x="{X(v):.1f}" y="32" style="text-anchor: middle">{v}{"%" if v == 40 else ""}</text>' for v in (0, 10, 20, 30, 40)) + '</svg>')
    heads = ''.join(f'<span class="th" style="width: 46px; color: {c}">{lab}</span>' for _, lab, c in PRIM)
    rows = [f'<div role="row" style="display: grid; grid-template-columns: {PCOLS}; align-items: end; padding-bottom: 6px; border-bottom: 1px solid #9A968E">'
            f'<span style="padding-left: 12px">{sort_th("Pollster")}</span>{sort_th("Fieldwork", True, aria="Sorted by fieldwork, newest first")}{sort_th("Sample", right=True)}<span></span>'
            f'<span role="columnheader" style="display: flex; padding-bottom: 7px">{heads}</span><span role="columnheader">{axis}</span><span></span><span></span></div>']
    a = AGG_P[ym]
    rows.append(f'<div role="row" style="display: grid; grid-template-columns: {PCOLS}; align-items: center; padding: 18px 0 2px">'
                f'<span style="grid-column: 1 / span 4; padding-left: 12px; display: flex; align-items: baseline; gap: 10px"><span style="font-size: 15px; font-weight: 600">{mlabel(ym)}</span>'
                f'<span style="font-size: 13px; color: #6B6862">average, drawn as rings</span></span>'
                f'<span class="num" style="display: flex; font-size: 13px; color: #6B6862">' + ''.join(f'<span style="width: 46px">{a[k]:.1f}</span>' for k, _, _ in PRIM) + '</span>'
                f'<span>{prim_strip(a, ring=True, H=24)}</span><span></span><span></span></div>')
    for p in polls:
        q = p['p']
        cells = ''.join(f'<span style="width: 46px; font-size: 15px; font-weight: 600; color: {c}">{num(q[k]) if q.get(k) is not None else "—"}</span>' for k, _, c in PRIM)
        rows.append(f'<div role="row" class="row" aria-expanded="false" style="display: grid; grid-template-columns: {PCOLS}; align-items: center; min-height: {SH}px">'
                    + pollster_cell(p) + field_cell(p) + sample_cell(p) + '<span></span>'
                    + f'<span role="cell" class="num" style="display: flex">{cells}</span><span role="cell">{prim_strip(q)}</span><span></span>{chev(p)}</div>')
    return '<div role="table" aria-label="Primary vote in each poll" style="margin-top: 16px">' + ''.join(rows) + '</div>'


LCOLS2 = '200px 120px 76px 36px 176px 380px minmax(0, 1fr) 40px'
LDW = 380


def lead_strip(p, H=SH, W=LDW):
    X = lambda v: 14 + (v + 40) / 60 * (W - 28)
    a = p['appr']
    g = ['<path d="' + ''.join(f'M{X(v):.1f} 0V{H}' for v in (-40, -20, 20)) + f'" style="stroke: {FAINT}; stroke-width: 1"></path>',
         f'<path d="M{X(0):.1f} 0V{H}" style="stroke: {G4}; stroke-width: 1.5"></path>']
    for key, c in (('hansonNet', ONP), ('taylorNet', LNP), ('albNet', ALP)):
        v = a.get(key)
        if v is not None:
            g.append(f'<circle cx="{X(v):.1f}" cy="{H / 2}" r="5" style="fill: {c}; stroke: {BG}; stroke-width: 1.5"></circle>')
    return f'<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" aria-hidden="true" style="display: block; overflow: visible">' + ''.join(g) + '</svg>'


def lead_table(polls):
    X = lambda v: 14 + (v + 40) / 60 * (LDW - 28)
    axis = (f'<svg viewBox="0 0 {LDW} 38" width="{LDW}" height="38" aria-hidden="true" style="display: block; overflow: visible"><text class="th" x="14" y="12" style="font-size: 12px; font-weight: 600; letter-spacing: 0.04em; fill: #6B6862">NET RATING: APPROVE MINUS DISAPPROVE</text>'
            + ''.join(f'<text class="ax num" x="{X(v):.1f}" y="32" style="text-anchor: middle{"; font-weight: 600; fill: #4A4843" if v == 0 else ""}">{"Even" if v == 0 else sgn(v, 0)}</text>' for v in (-40, -20, 0, 20)) + '</svg>')
    nh = ''.join(f'<span class="th" style="width: 44px; text-align: right; color: {c}">{lab}</span>' for lab, c in (('ALB', ALP), ('TAY', LNP), ('HAN', ONPT)))
    rows = [f'<div role="row" style="display: grid; grid-template-columns: {LCOLS2}; align-items: end; padding-bottom: 6px; border-bottom: 1px solid #9A968E">'
            f'<span style="padding-left: 12px">{sort_th("Pollster")}</span>{sort_th("Fieldwork", True, aria="Sorted by fieldwork, newest first")}{sort_th("Sample", right=True)}<span></span>'
            f'<span class="th" role="columnheader" style="padding-bottom: 7px">Better PM</span><span role="columnheader">{axis}</span><span role="columnheader" style="display: flex; justify-content: flex-end; padding-bottom: 7px">{nh}</span><span></span></div>']
    for p in polls:
        a = p['appr']
        sets = p.get('ppmSets') or []
        tay = next((s for s in sets if 'taylor' in s and 'hanson' not in s), None)
        han = next((s for s in sets if 'hanson' in s and 'taylor' not in s), None)
        three = next((s for s in sets if 'hanson' in s and 'taylor' in s), None)
        if tay:
            ppm = (f'<span class="num" style="font-size: 15px; font-weight: 600"><span style="color: {ALP}">{tay["alb"]}</span><span style="color: #9A968E; font-weight: 400"> – </span><span style="color: {LNP}">{tay["taylor"]}</span></span>'
                   + (f'<span class="sub num">v Taylor · {han["alb"]}–{han["hanson"]} v Hanson</span>' if han else '<span class="sub">Albanese v Taylor</span>'))
        elif three:
            ppm = (f'<span class="num" style="font-size: 15px; font-weight: 600"><span style="color: {ALP}">{three["alb"]}</span><span style="color: #9A968E; font-weight: 400"> · </span><span style="color: {LNP}">{three["taylor"]}</span><span style="color: #9A968E; font-weight: 400"> · </span><span style="color: {ONPT}">{three["hanson"]}</span></span>'
                   '<span class="sub">three-way</span>')
        else:
            ppm = '<span style="font-size: 15px; color: #6B6862">—</span><span class="sub">not asked</span>'
        fav = any(v == 'fav' for v in (a.get('metricBy') or {}).values())
        nums = ''.join(f'<span style="width: 44px; text-align: right; font-size: 15px; font-weight: 600; color: {c}">{num(a[k]) if a.get(k) is not None else "—"}</span>'
                       for k, c in (('albNet', ALP), ('taylorNet', LNP), ('hansonNet', ONPT)))
        nums_block = (f'<span role="cell" class="num" style="display: flex; flex-direction: column; align-items: flex-end; gap: 1px"><span style="display: flex">{nums}</span>'
                      + ('<span class="sub">favourability</span>' if fav else '') + '</span>')
        rows.append(f'<div role="row" class="row" aria-expanded="false" style="display: grid; grid-template-columns: {LCOLS2}; align-items: center; min-height: {SH}px">'
                    + pollster_cell(p) + field_cell(p) + sample_cell(p) + '<span></span>'
                    + f'<span role="cell" style="display: flex; flex-direction: column; gap: 1px">{ppm}</span><span role="cell">{lead_strip(p)}</span>{nums_block}{chev(p)}</div>')
    return '<div role="table" aria-label="Leader ratings in each poll" style="margin-top: 16px">' + ''.join(rows) + '</div>'


DCOLS = '200px 120px 76px 36px 84px 84px 76px 356px minmax(0, 1fr) 40px'


def dir_table(polls):
    rows = [f'<div role="row" style="display: grid; grid-template-columns: {DCOLS}; align-items: end; padding-bottom: 6px; border-bottom: 1px solid #9A968E">'
            f'<span style="padding-left: 12px">{sort_th("Pollster")}</span>{sort_th("Fieldwork", True, aria="Sorted by fieldwork, newest first")}{sort_th("Sample", right=True)}<span></span>'
            f'<span class="th" style="padding-bottom: 7px; color: {TEAL}">Right</span><span class="th" style="padding-bottom: 7px; color: {BROWN}">Wrong</span><span class="th" style="padding-bottom: 7px">Unsure</span>'
            f'<span class="th" style="padding-bottom: 7px">Right direction or wrong track, %</span>{sort_th("Net", right=True)}<span></span></div>']
    for p in polls:
        d = p['dir']
        c = d.get('chg') or {}
        W = 340
        xr, xu = W * d['right'] / 100, W * d['unsure'] / 100
        bar = (f'<svg viewBox="0 0 {W} 16" width="{W}" height="16" role="img" aria-label="Right direction {num(d["right"])}%, unsure {num(d["unsure"])}%, wrong track {num(d["wrong"])}%" style="display: block">'
               f'<rect x="0" y="0" width="{xr - 1:.1f}" height="16" rx="2" style="fill: {TEAL}"></rect><rect x="{xr + 1:.1f}" y="0" width="{xu - 2:.1f}" height="16" style="fill: {RULE}"></rect>'
               f'<rect x="{xr + xu + 1:.1f}" y="0" width="{W - xr - xu - 1:.1f}" height="16" rx="2" style="fill: {BROWN}"></rect></svg>')
        rows.append(f'<div role="row" class="row" aria-expanded="false" style="display: grid; grid-template-columns: {DCOLS}; align-items: center; min-height: {SH}px">'
                    + pollster_cell(p) + field_cell(p) + sample_cell(p) + '<span></span>'
                    + f'<span role="cell" class="num" style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 15px; font-weight: 600; color: {TEAL}">{num(d["right"])}</span><span class="sub">{arrow(c.get("right"), 0)}</span></span>'
                    + f'<span role="cell" class="num" style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 15px; font-weight: 600; color: {BROWN}">{num(d["wrong"])}</span><span class="sub">{arrow(c.get("wrong"), 0)}</span></span>'
                    + f'<span role="cell" class="num" style="font-size: 15px; color: #4A4843">{num(d["unsure"])}</span><span role="cell">{bar}</span>'
                    + f'<span role="cell" class="num" style="text-align: right; font-size: 15px; font-weight: 600">{num(d["net"])}</span>{chev(p)}</div>')
    return '<div role="table" aria-label="Right direction or wrong track in each poll" style="margin-top: 16px">' + ''.join(rows) + '</div>'

# ---------------------------------------------------------------- a poll opened


def mini_record(p, W=470, H=176):
    """The pollster's recent polls against the monthly average, this one ringed."""
    house = p['pollster']
    ms = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']
    d0 = dt.date(2026, 3, 1)
    d1 = dt.date(2026, 9, 30)
    x0, x1, top, bot = 30, W - 60, 8, H - 26
    X = lambda d: x0 + (d - d0).days / (d1 - d0).days * (x1 - x0)
    Y = lambda v: bot - (v - 48) / 8 * (bot - top)
    mid = lambda ym: dt.date(int(ym[:4]), int(ym[5:]), 15)
    g = ['<path d="' + ''.join(f'M{x0} {Y(v):.1f}H{x1}' for v in (52, 54, 56)) + '" class="grid"></path>',
         f'<path d="M{x0} {Y(50):.1f}H{x1}" class="even"></path>']
    for v in (50, 52, 54, 56):
        g.append(f'<text class="ax num" x="{x0 - 6}" y="{Y(v) + 4:.1f}" style="text-anchor: end">{v}</text>')
    g.append('<path d="M' + 'L'.join(f'{X(mid(ym)):.1f} {Y(SYN_ON[ym]):.1f}' for ym in ms) + f'" class="ln" style="stroke: {G4}; stroke-width: 2.5"></path>')
    g.append(f'<text class="ax halo" x="{X(mid(ms[0])):.1f}" y="{Y(SYN_ON[ms[0]]) - 9:.1f}" style="font-weight: 600; fill: #6B6862">Monthly average</text>')
    mine = [q for q in POLLS if q['pollster'] == house and q.get('alpOnImp') is not None and iso(q['released']) >= d0]
    for q in mine:
        if q is p:
            continue
        g.append(f'<circle cx="{X(iso(q["released"])):.1f}" cy="{Y(q["alpOnImp"]):.1f}" r="4" style="fill: #6B6862; opacity: 0.75"></circle>')
    cx, cy = X(iso(p['released'])), Y(p['alpOnImp'])
    g.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="8" style="fill: none; stroke: #171717; stroke-width: 1.5"></circle><circle cx="{cx:.1f}" cy="{cy:.1f}" r="4.5" style="fill: #171717"></circle>')
    g.append(f'<text class="halo" x="{cx - 12:.1f}" y="{cy - 12:.1f}" style="font-size: 12px; font-weight: 600; text-anchor: end; fill: #171717">This poll {f1(p["alpOnImp"])}</text>')
    g.append(f'<path class="base" d="M{x0} {bot}H{x1}"></path>')
    for ym in ('2026-03', '2026-05', '2026-07', '2026-09'):
        g.append(f'<text class="ax" x="{X(dt.date(int(ym[:4]), int(ym[5:]), 1)):.1f}" y="{bot + 18}" style="text-anchor: middle">{MON[int(ym[5:]) - 1]}</text>')
    aria = f'{house}’s polls since March, Labor v One Nation on implied flows, against the monthly average; this poll {f1(p["alpOnImp"])}.'
    return f'<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{aria}" style="display: block; overflow: visible">' + ''.join(g) + '</svg>'


def detail(p):
    q, c = p['p'], (p.get('chg') or {}).get('d', {})
    ref = (p.get('chg') or {}).get('r', {}).get('pOnp')
    prev = next((x for x in POLLS if x['pollster'] == p['pollster'] and x['released'] == ref), None)
    order = sorted([('onp', 'ON', ONPT, 'pOnp'), ('alp', 'ALP', ALP, 'pAlp'), ('lnp', 'L/NP', LNP, 'pLnp'), ('grn', 'GRN', GRNT, 'pGrn'), ('oth', 'OTH', OTHT, 'pOth')], key=lambda t: -q[t[0]])
    prim = ''.join(f'<span style="display: flex; flex-direction: column; gap: 1px; width: 64px"><span class="th" style="color: {col}">{lab}</span>'
                   f'<span class="num" style="font-size: 26px; font-weight: 500; letter-spacing: -0.01em; line-height: 1.15; color: {col}">{num(q[k])}</span><span class="sub num">{arrow(c.get(ck), 0)}</span></span>'
                   for k, lab, col, ck in order)
    on, co = tpp(p, 'on'), tpp(p, 'lnp')
    pair = lambda a, b, bc: (f'<span class="num" style="font-weight: 600"><span style="color: {ALP}">{a}</span><span style="color: #9A968E; font-weight: 400"> – </span><span style="color: {bc}">{b}</span></span>')
    ta = p.get('tppAlt')
    grid2 = (f'<div style="margin-top: 18px; display: grid; grid-template-columns: 176px 1fr 1fr; column-gap: 16px; row-gap: 8px; align-items: baseline; font-size: 14px; color: #3D3B37">'
             f'<span></span><span class="th">v One Nation</span><span class="th">v Coalition</span>'
             f'<span style="color: #6B6862">Implied, on 2025 flows</span><span>{pair(f1(on["v"]), f1(100 - on["v"]), ONPT)} <span class="sub num">{arrow(c.get("impOn"))}</span></span>'
             f'<span>{pair(f1(co["v"]), f1(100 - co["v"]), LNP)} <span class="sub num">{arrow(c.get("imp"))}</span></span>'
             f'<span style="color: #6B6862">As {p["pollster"]} published</span><span>{pair(num(ta["alp"]), num(ta["onp"]), ONPT) if ta else "—"} <span class="sub num">{arrow(c.get("altAlpOn"), 0)}</span></span>'
             f'<span>{pair(num(p["alp"]), num(p["lnp"]), LNP)} <span class="sub num">{arrow(c.get("alp2pp"), 0)}</span></span></div>')
    sets = p.get('ppmSets') or []
    tay = next((s for s in sets if 'taylor' in s and 'hanson' not in s), None)
    han = next((s for s in sets if 'hanson' in s and 'taylor' not in s), None)
    a = p['appr']
    lead = (f'<div style="margin-top: 14px; display: grid; grid-template-columns: 176px 1fr 1fr; column-gap: 16px; row-gap: 8px; align-items: baseline; font-size: 14px; color: #3D3B37">'
            f'<span style="color: #6B6862">Better prime minister</span>'
            f'<span class="num" style="display: flex; flex-direction: column"><span>Albanese <b style="font-weight: 600; color: {ALP}">{tay["alb"]}</b> · Taylor <b style="font-weight: 600; color: {LNP}">{tay["taylor"]}</b></span><span class="sub">{tay["unc"]} undecided</span></span>'
            f'<span class="num" style="display: flex; flex-direction: column"><span>Albanese <b style="font-weight: 600; color: {ALP}">{han["alb"]}</b> · Hanson <b style="font-weight: 600; color: {ONPT}">{han["hanson"]}</b></span><span class="sub">{han["unc"]} undecided</span></span>'
            f'<span style="color: #6B6862">Net approval</span>'
            f'<span class="num" style="display: flex; flex-direction: column"><span>Albanese <b style="font-weight: 600; color: {ALP}">{num(a["albNet"])}</b> <span class="sub">{arrow(c.get("albNet"), 0)}</span></span><span class="sub">{a["alb"]["app"]} approve, {a["alb"]["dis"]} disapprove</span></span>'
            f'<span class="num" style="display: flex; flex-direction: column"><span>Taylor <b style="font-weight: 600; color: {LNP}">{num(a["taylorNet"])}</b> <span class="sub">{arrow(c.get("taylorNet"), 0)}</span></span><span class="sub">{a["taylor"]["app"]} approve, {a["taylor"]["dis"]} disapprove</span></span></div>')
    pubd = iso(p['published'])
    hour = int(p['published'][11:13])
    when = f'{wdm(p["published"])}, {hour % 12 or 12} {"am" if hour < 12 else "pm"}'
    lean_v = on['lean']
    hl = next(s for h, v, s, n in LEAN_ROWS if h == p['pollster'])[-1]['v']
    eff = p['eff']['onimp']
    effd = round(eff['hi'] - eff['lo'], 1)
    facts = (f'<div style="margin-top: 14px; display: grid; grid-template-columns: 150px 1fr; row-gap: 8px; column-gap: 14px; font-size: 14px; line-height: 1.45; color: #3D3B37">'
             f'<span style="color: #6B6862">Against {MONTHS[int(p["ym"][5:]) - 1]}</span><span><b style="font-weight: 600; color: {lean_text_col(lean_v)}">{abs(lean_v):.1f}</b> more {"Labor’s" if lean_v > 0 else "One Nation’s"} way than the month’s average of {f1(on["avg"])}, {"well inside" if abs(lean_v) < on["moe"] / 2 else ("inside" if abs(lean_v) <= on["moe"] else "outside")} its ±{on["moe"]:.1f} margin</span>'
             f'<span style="color: #6B6862">{p["pollster"]}’s usual lean</span><span><b style="font-weight: 600">{abs(hl):.1f}</b> to {"Labor" if hl > 0 else "One Nation"}, taken out before the polls are averaged</span>'
             f'<span style="color: #6B6862">In today’s {f1(AGG_ON)}</span><span>One of the {WORDS[len(WIN)]} polls it’s built from; this one moves it <b style="font-weight: 600">{sgn(effd)}</b></span></div>')
    return (f'<div role="row" style="padding: 22px 24px 20px 52px; background: #F1EFEA; display: grid; grid-template-columns: minmax(0, 1.12fr) minmax(0, 1fr); column-gap: 48px">'
            f'<div style="display: flex; flex-direction: column">'
            f'<span class="th" style="white-space: normal; line-height: 1.5">This poll · {p["sample"]:,} voters for {p["client"]} · out {when}</span>'
            f'<div style="margin-top: 14px; display: flex; gap: 8px">{prim}</div>'
            f'<span class="sub" style="margin-top: 6px">Primary vote, %. Changes are on {p["pollster"]}’s {prev["field"] if prev else "previous"} poll.</span>'
            f'{grid2}{lead}'
            f'<div style="margin-top: 14px; display: flex; align-items: center; gap: 22px"><a class="link" href="{p["url"]}" target="_blank" rel="noopener">Read the release <span aria-hidden="true" style="font-size: 11px; color: #9A968E">↗</span></a>'
            f'<a class="link" href="/feedback/">Report an error</a><span style="flex-grow: 1"></span><button class="copy" aria-label="Copy this poll" title="Copy this poll">{COPY_SVG}</button></div></div>'
            f'<div style="display: flex; flex-direction: column">'
            f'<span class="th">How it counts</span>'
            f'<span style="margin-top: 12px; font-size: 13px; font-weight: 600">{p["pollster"]}’s polls since March against the average, Labor v One Nation</span>'
            f'<div style="margin-top: 10px">{mini_record(p)}</div>{facts}</div></div>')

# ================================================================ boards


def build_desktop():
    d1 = masthead() + '\n\n' + polls_section()
    d2 = dis_section() + '\n\n' + lean_section() + '\n\n' + flow_section()
    return d1, d2


def build_phone():
    g1 = SHOWN[:2]
    g2 = SHOWN[2:]
    p1 = masthead(phone=True) + '\n\n' + phone_header() + '\n' + f'<div role="table" aria-label="Every national poll since the 2025 election, newest first" style="display: flex; flex-direction: column">{phone_cards(g1)}</div>\n</section>'
    p2 = ('<section style="width: 390px; box-sizing: border-box; padding: 0 20px 40px; display: flex; flex-direction: column; flex-shrink: 0; background: #FAF9F6">\n'
          f'<div role="table" aria-label="Polls, continued" style="display: flex; flex-direction: column">{phone_cards(g2)}</div>\n' + phone_table_end() + '\n</section>\n\n' + dis_section(phone=True))
    p3 = lean_section(phone=True) + '\n\n' + flow_section(phone=True)
    return p1, p2, p3


def board_head(title, meta, h, deck):
    return ('<section style="width: 1280px; box-sizing: border-box; padding: 56px 64px 64px; display: flex; flex-direction: column; flex-shrink: 0; background: #FAF9F6">\n'
            + section_head(title, meta) + '\n\n' + headline(h, deck, tag='h1'))


def build_table_board():
    sep = SHOWN[0][1]
    yg = sep[0]
    out = [board_head('All polls: exploring the table', 'Hover on desktop, tap on touch screens',
                      'Open any poll to see what it said and how it counts',
                      'Every row opens to the full poll beside its place in the average. The filters narrow the list, the headings sort it, and the tabs swap its figures, while the rows stay where they are.')]
    # 1 · a poll opened
    out.append(state_head(1, 'A poll opened', 'The poll in full on the left, with changes on the same pollster’s last poll; on the right, its pollster’s recent record against the average and what this poll does to today’s figure. The release and the error report sit with the poll.'))
    rows = [head_row(), group_row(SHOWN[0][0], sep), poll_row(yg, open_=True), detail(yg), poll_row(sep[1]), poll_row(sep[2])]
    out.append('<div role="table" aria-label="A poll opened" style="margin-top: 14px; display: flex; flex-direction: column">' + ''.join(rows) + '</div>')
    # 2 · filtering
    rm = [p for p in POLLS if BASE(p['pollster']) == 'Roy Morgan']
    counts = sorted(HOUSES.items(), key=lambda t: -t[1])
    opts = ''.join(f'<label class="opt"><input type="checkbox"{" checked" if h == "Roy Morgan" else ""}><span style="flex-grow: 1">{h}</span><span class="num" style="font-size: 13px; color: #6B6862">{n}</span></label>' for h, n in counts)
    menu = (f'<div class="menu" role="listbox" aria-label="Pollsters" style="position: absolute; left: 340px; top: 46px; width: 272px; z-index: 2">'
            f'<span style="padding: 6px 10px 4px; font-size: 12px; color: #6B6862">{len(HOUSES)} pollsters · tick any number</span>{opts}'
            f'<div style="margin-top: 4px; padding: 8px 10px 2px; border-top: 1px solid #E6E4DF; display: flex; align-items: center"><button class="link" style="min-height: 32px; font-size: 13px">Clear</button><span style="flex-grow: 1"></span><span class="num" style="font-size: 13px; color: #4A4843"><b style="font-weight: 600; color: #171717">{len(rm)}</b> polls</span></div></div>')
    out.append(state_head(2, 'Filtering by pollster', 'Each filter lists its choices with their counts, and any number can be ticked. A chosen filter shows as a chip that says what it holds, beside a count of what’s left; clearing it is one tap. Filtering to one pollster turns the lean column into a picture of its house effect: nearly every Roy Morgan poll sits to Labor’s side of its month.'))
    rm_groups = []
    for p in rm:
        if not rm_groups or rm_groups[-1][0] != p['ym']:
            if sum(len(g) for _, g in rm_groups) >= 8:
                break
            rm_groups.append((p['ym'], []))
        rm_groups[-1][1].append(p)
    out.append('<div style="position: relative; margin-top: 4px; min-height: 640px">' + filters(expanded='pollster', mt=10) + menu
               + '<div style="margin-top: 18px; opacity: 0.35" aria-hidden="true">' + ''.join([head_row()] + [poll_row(p) for p in POLLS[:9]]) + '</div></div>')
    active = (f'<div style="margin-top: 12px; display: flex; align-items: center; gap: 10px; font-size: 13px; color: #4A4843"><span>Showing</span>'
              f'<span class="pill">Roy Morgan<button aria-label="Remove the filter: Roy Morgan">×</button></span><button class="link" style="min-height: 32px; font-size: 13px">Clear all</button></div>')
    out.append('<div style="margin-top: 36px"></div>' + filters(count=len(rm), pollster='Roy Morgan', mt=0) + active
               + '<div style="margin-top: 14px">' + table(rm_groups) + '</div>')
    # 3 · sorted by lean
    ranked = sorted([p for p in POLLS if tpp(p)['lean'] is not None], key=lambda p: -tpp(p)['lean'])
    top7 = ranked[:7]
    n_rm = sum(1 for p in top7 if BASE(p['pollster']) == 'Roy Morgan')
    outside = [p for p in POLLS if tpp(p)['lean'] is not None and abs(tpp(p)['lean']) > tpp(p)['moe']]
    n_all = sum(1 for p in POLLS if tpp(p)['lean'] is not None)
    n_rm_out = sum(1 for p in outside if BASE(p['pollster']) == 'Roy Morgan')
    n7_out = sum(1 for p in top7 if p in outside)
    out.append(state_head(3, 'Sorted by lean', f'Any heading sorts, and a second click reverses it. Sorted by anything but fieldwork, the month headings give way to one list, and each date carries its year. '
                          f'{WORDS[n_rm].capitalize()} of the seven biggest leans are Roy Morgan’s, and {"all seven fall" if n7_out == 7 else WORDS[n7_out] + " fall"} outside their margins. Across all {n_all} polls, {len(outside)} do, where chance alone would put about {round(n_all / 20)}; {n_rm_out} of them are Roy Morgan’s.'))
    out.append('<div style="margin-top: 14px">' + table(None, flat=ranked[:7], sort='lean') + '</div>')
    # 4 · the other figures
    lead_polls = [p for p in POLLS if (p.get('appr') or {}).get('albNet') is not None][:5]
    dir_polls = [p for p in POLLS if p.get('dir')][:4]
    out.append(state_head(4, 'The other figures', 'Primary, Leadership and Direction swap the figures and the picture beside them; the pollster, fieldwork and sample stay put, so a row never jumps. Each view shows only the polls that asked its question, and the count says how many that is.'))
    out.append(controls('prim') + filters(mt=12) + prim_table(sep[:4], SHOWN[0][0]))
    out.append('<div style="margin-top: 40px"></div>' + controls('lead') + filters(count=sum(1 for p in POLLS if (p.get('appr') or {}).get('albNet') is not None or p.get('ppmSets')), mt=12) + lead_table(lead_polls))
    out.append('<div style="margin-top: 40px"></div>' + controls('dir') + filters(count=sum(1 for p in POLLS if p.get('dir')), mt=12) + dir_table(dir_polls))
    # 5 · Labor v Coalition
    out.append(state_head(5, 'Labor v Coalition', 'The switch beside the tabs moves the whole page to the other contest, as it does on the Snapshot: the figures, the average, the leans and the margins are all re-read on the Coalition flows.'))
    out.append(controls(contest='lnp') + '<div style="margin-top: 16px">' + table([(SHOWN[0][0], sep[:6])], contest='lnp') + '</div>')
    out.append('</section>')
    return '\n'.join(out)


def tooltip(x, y, title, rows, note=None, w=236):
    body = ''.join(f'<div style="display: flex; gap: 12px; font-size: 13px; line-height: 1.5"><span style="flex-grow: 1; color: #6E6863">{a}</span><span class="num" style="font-weight: 700; color: #2B2521">{b}</span></div>' for a, b in rows)
    n = f'<div style="margin-top: 3px; font-size: 11px; line-height: 1.4; color: #6E6863">{note}</div>' if note else ''
    return (f'<div style="position: absolute; left: {x}px; top: {y}px; width: {w}px; box-sizing: border-box; padding: 10px 12px; border: 1px solid #DFDCD7; border-radius: 10px; background: #FEFCF9; '
            f'box-shadow: 0 4px 14px rgba(64, 44, 26, 0.12); z-index: 3"><div style="font-size: 12px; font-weight: 700; color: #2B2521">{title}</div>{body}{n}</div>')


def build_details_board():
    out = [board_head('All polls: getting around', 'The pinned bar, the phone’s filters, readouts and dark mode',
                      'The column headings stay in view all the way down',
                      'Scrolled into the table, its headings pin under the site’s bar beside a link to each section, so a reader deep in the list still knows what every column is. On a phone the filters open as a sheet.')]
    # 1 · pinned
    out.append(state_head(1, 'Scrolled into the table: the headings pin', 'The site’s bar, then the section bar: a link to each section with the current one underlined, and the table’s tabs and search, so the view can change from anywhere in the list. The column headings pin beneath it until the table ends.'))
    site = (f'<div style="margin: 16px -64px 0; padding: 0 64px; display: flex; align-items: center; gap: 20px; background: #FAF9F6; border-bottom: 1px solid #DDDCD8">'
            f'{DIAL.replace("width=\"60\" height=\"42\"", "width=\"36\" height=\"25.2\"")}<div style="display: flex; gap: 24px"><a class="ntab" href="#snapshot" style="font-size: 15px">Snapshot</a><a class="ntab" href="#past-cycles" style="font-size: 15px">Past cycles</a>'
            f'<a class="ntab" href="#all-polls" aria-current="page" style="font-size: 15px">All polls</a><a class="ntab" href="#info" style="font-size: 15px">Info</a></div><span style="flex-grow: 1"></span>'
            f'<button class="score" title="Latest Labor v One Nation two-party preferred – go to Snapshot"><span class="plabel" style="color: #6B6862">2PP</span><span style="font-size: 11px; font-weight: 700; letter-spacing: 0.04em; color: #6B6862">ALP</span>'
            f'<span class="num" style="font-size: 19px; font-weight: 600; color: #B9463F">51.2</span><span style="width: 1.5px; height: 14px; background: #DDDCD8; align-self: center"></span><span class="num" style="font-size: 19px; font-weight: 600; color: #9E5200">48.8</span>'
            f'<span style="font-size: 11px; font-weight: 700; letter-spacing: 0.04em; color: #6B6862">ON</span></button></div>')
    secs = [('#polls', 'The polls', True), ('#disagreement', 'How much they disagree', False), ('#pollster-lean', 'How each pollster leans', False), ('#preference-flows', 'Preference flows', False)]
    nav = ''.join(f'<a class="ntab" href="{h}"{" aria-current=\"location\"" if cur else ""} style="font-size: 14px{"; border-bottom-color: #171717; font-weight: 600; color: #171717" if cur else ""}">{t}</a>' for h, t, cur in secs)
    tabs = ''.join(f'<button class="tab" aria-pressed="{"true" if i == 0 else "false"}" style="font-size: 13px; padding: 0 8px">{t}</button>' for i, t in enumerate(('2PP', 'Primary', 'Leadership', 'Direction')))
    secbar = (f'<div style="margin: 0 -64px; padding: 0 64px; display: flex; align-items: center; gap: 20px; background: #FAF9F6; border-bottom: 1px solid #DDDCD8">'
              f'<nav aria-label="All polls sections" style="display: flex; gap: 22px">{nav}</nav><span style="flex-grow: 1"></span>'
              f'<div role="group" aria-label="Figures" style="display: flex">{tabs}</div><span style="width: 1px; height: 18px; background: #DDDCD8"></span>'
              f'<button class="copy" aria-label="Search the polls" title="Search" style="width: 40px; height: 40px">{SEARCH_SVG}</button><span class="num" style="font-size: 13px; color: #6B6862">{TOTAL} polls</span></div>')
    jul = SHOWN[2]
    pinned = ('<div style="margin: 0 -64px; padding: 10px 64px 0; background: #FAF9F6; box-shadow: 0 6px 18px rgba(23, 23, 23, 0.07)">' + head_row() + '</div>')
    rows = [group_row(jul[0], jul[1])] + [poll_row(p) for p in jul[1][:4]]
    out.append(site + secbar + pinned + '<div style="display: flex; flex-direction: column">' + ''.join(rows) + '</div>')
    # 2 · phone: pinned + sheet
    out.append(state_head(2, 'On a phone: the pinned bar and the filters sheet', 'The section links scroll sideways under the site’s bar, and the lean scale pins above the cards. “Filters” opens the pollster, time and includes lists as a sheet from the bottom of the screen, with the count of what’s left on its button.'))
    frame = lambda inner, h: (f'<div style="width: 390px; height: {h}px; box-sizing: border-box; border: 1px solid #DDDCD8; border-radius: 16px; overflow: hidden; background: #FAF9F6; position: relative; flex-shrink: 0">{inner}</div>')
    ptabs = (f'<div style="padding: 0 12px 0 20px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #DDDCD8"><div style="display: flex; gap: 12px"><a class="ntab" href="#snapshot" style="font-size: 14px">Snapshot</a><a class="ntab" href="#cycles" style="font-size: 14px">Cycles</a>'
             f'<a class="ntab" href="#all-polls" aria-current="page" style="font-size: 14px">All polls</a></div><span style="flex-grow: 1"></span><button class="score" style="gap: 6px" title="Latest Labor v One Nation two-party preferred – go to Snapshot">'
             f'<span style="font-size: 11px; font-weight: 700; letter-spacing: 0.04em; color: #6B6862">ALP</span><span class="num" style="font-size: 17px; font-weight: 600; color: #B9463F">51.2</span><span style="width: 1.5px; height: 14px; background: #DDDCD8; align-self: center"></span>'
             f'<span class="num" style="font-size: 17px; font-weight: 600; color: #9E5200">48.8</span><span style="font-size: 11px; font-weight: 700; letter-spacing: 0.04em; color: #6B6862">ON</span></button></div>')
    psec = (f'<div style="padding: 0 8px 0 20px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #DDDCD8"><nav aria-label="All polls sections" style="display: flex; gap: 16px; overflow: hidden; flex-grow: 1; -webkit-mask-image: linear-gradient(to right, #000 78%, transparent); mask-image: linear-gradient(to right, #000 78%, transparent)">'
            f'<a class="ntab" href="#polls" aria-current="location" style="font-size: 13px; border-bottom-color: #171717; font-weight: 600; color: #171717">The polls</a><a class="ntab" href="#disagreement" style="font-size: 13px">Disagreement</a><a class="ntab" href="#pollster-lean" style="font-size: 13px">Lean</a><a class="ntab" href="#preference-flows" style="font-size: 13px">Flows</a></nav>'
            f'<button class="chip" aria-haspopup="dialog" style="min-height: 32px; padding: 0 10px; font-size: 12px; flex-shrink: 0">{FILTER_SVG}Filters · 1</button></div>')
    paxis = f'<div style="padding: 8px 20px 4px; border-bottom: 1px solid #9A968E; background: #FAF9F6; box-shadow: 0 6px 16px rgba(23, 23, 23, 0.06)">{strip_head(W=PW, pad=PPAD, right=PRIGHT, phone=True)}</div>'
    pcards = '<div style="padding: 0 20px">' + card_group(rm_first_ym := [p for p in POLLS if p['pollster'] == 'Roy Morgan'][0]['ym'], [p for p in POLLS if p['pollster'] == 'Roy Morgan' and p['ym'] == rm_first_ym]) + ''.join(card(p) for p in [p for p in POLLS if p['pollster'] == 'Roy Morgan'][:4]) + '</div>'
    phone1 = frame(ptabs + psec + paxis + pcards, 560)
    sheet_opts = ''.join(f'<label class="opt" style="padding: 0 4px"><input type="checkbox"{" checked" if h == "Roy Morgan" else ""}><span style="flex-grow: 1">{h}</span><span class="num" style="font-size: 13px; color: #6B6862">{n}</span></label>' for h, n in sorted(HOUSES.items(), key=lambda t: -t[1])[:6])
    sheet = (f'<div style="position: absolute; left: 0; right: 0; top: 0; bottom: 0; background: rgba(23, 23, 23, 0.32)"></div>'
             f'<div role="dialog" aria-label="Filter the polls" style="position: absolute; left: 0; right: 0; bottom: 0; padding: 10px 20px 20px; border-radius: 16px 16px 0 0; background: #FEFCF9; display: flex; flex-direction: column">'
             f'<span style="align-self: center; width: 36px; height: 4px; border-radius: 2px; background: #DDDCD8"></span>'
             f'<div style="margin-top: 10px; display: flex; align-items: center"><span style="font-size: 17px; font-weight: 600">Filters</span><span style="flex-grow: 1"></span><button class="link" style="font-size: 14px">Clear all</button></div>'
             f'<span class="th" style="margin-top: 8px">Pollster</span>{sheet_opts}<button class="link" style="min-height: 36px; font-size: 13px; color: #4A4843">Show all {len(HOUSES)} pollsters</button>'
             f'<span class="th" style="margin-top: 10px">Time</span><div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 8px">'
             + ''.join(f'<button class="chip" aria-pressed="{"true" if i == 0 else "false"}" style="min-height: 34px; font-size: 13px{"; background: #171717; color: #FAF9F6; border-color: #171717" if i == 0 else ""}">{t}</button>' for i, t in enumerate(('Any time', 'Last 12 months', 'Last 6 months', 'Last 3 months')))
             + f'</div><button style="margin-top: 18px; min-height: 48px; border: 0; border-radius: 24px; background: #171717; color: #FAF9F6; font-size: 15px; font-weight: 600">Show {HOUSES["Roy Morgan"]} polls</button></div>')
    phone2 = frame(ptabs + psec + paxis + pcards + sheet, 760)
    out.append(f'<div style="margin-top: 20px; display: flex; gap: 48px; align-items: flex-start">{phone1}{phone2}'
               f'<div style="display: flex; flex-direction: column; gap: 10px; max-width: 360px; font-size: 14px; line-height: 1.55; color: #4A4843"><span style="font-size: 13px; font-weight: 600; color: #171717">On a phone</span>'
               f'<span>“Filters · 1” says how many filters are on. The sheet lists the six busiest pollsters first, with the rest one tap away, and its button counts the polls the filters leave.</span>'
               f'<span>The scale pins above the cards, so every card’s dot is read against the same labelled axis however far down the reader is.</span></div></div>')
    # 3 · readouts
    out.append(state_head(3, 'Readouts', 'The site’s readout card, unchanged. On a poll’s dot it gives the figure, the average it’s measured against, the lean and the margin; on a chart it snaps to the nearest month.'))
    big = max((p for _, g in SHOWN for p in g if tpp(p)['lean'] is not None), key=lambda p: tpp(p)['lean'])
    br = tpp(big)
    note = ('Inside its margin, just' if abs(br['lean']) <= br['moe'] else 'Outside its margin, as about one poll in 20 should be')
    grp = next(g for g in SHOWN if big in g[1])[1]
    i = grp.index(big)
    trio = grp[max(0, min(i - 1, len(grp) - 3)):][:3]
    k = trio.index(big)
    dot_x = 200 + 120 + 76 + 28 + 150 + sx(br['lean'])
    dot_y = k * (SH + 1) + SH / 2
    tip = tooltip(round(dot_x - 118), round(dot_y - 12 - 150), f'{big["pollster"]}, {big["field"]}',
                  [('Labor v One Nation, implied', f1(br['v'])), (f'{MONTHS[int(big["ym"][5:]) - 1]}’s average', f1(br['avg'])), ('Lean', sgn(br['lean']) + ' to Labor'), ('95% margin', f'±{br["moe"]:.1f}')], note)
    out.append(f'<span style="margin-top: 22px; font-size: 13px; font-weight: 600">On a poll’s dot</span><div style="position: relative; margin-top: {max(12, 162 - round(dot_y))}px">{tip}'
               + '<div role="table" aria-label="A poll’s readout" style="display: flex; flex-direction: column; border-bottom: 1px solid #E6E4DF">' + ''.join(poll_row(p) for p in trio) + '</div></div>')
    gp = next(d for d in DIS['p_onp']['pts'] if d['ym'] == '2026-02')
    onfeb = AGG_P['2026-02']['onp']
    tip2 = tooltip(128, 70, 'February 2026 · One Nation', [('Spread', f'{gp["sigma"]:.1f} pts'), ('Chance alone', f'{gp["floor"]:.1f} pts'), ('Ratio', f'{gp["R"]:.1f}×')],
                   f'Its widest, in the month One Nation’s vote reached {onfeb:.1f}%', w=214)
    grid = ''.join(dis_panel(kk, n, c, tt, first=(j == 0), guide=('2026-02' if kk == 'p_onp' else None)) for j, (kk, n, c, tt) in enumerate(PANELS))
    out.append('<span style="margin-top: 40px; font-size: 13px; font-weight: 600">On a disagreement chart</span>'
               f'<div style="position: relative; margin-top: 12px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); column-gap: 24px">{grid}{tip2}</div>')
    lean_tip_ym = '2026-07'
    rmv = next(d['v'] for d in HL[TOP[0]] if d['ym'] == lean_tip_ym)
    x0s, x1s = 6, SPW - 8
    gx = 642 + x0s + LMONTHS.index(lean_tip_ym) / (len(LMONTHS) - 1) * (x1s - x0s)
    n_m = sum(1 for p in POLLS if p['pollster'] == TOP[0] and p['ym'] == lean_tip_ym)
    tip3 = tooltip(round(gx - 100), -84, f'{TOP[0]} · {mlabel(lean_tip_ym)}', [('Lean', f'{sgn(rmv)} to Labor'), ('Its polls that month', str(n_m))], w=200)
    out.append('<span style="margin-top: 40px; font-size: 13px; font-weight: 600">On a pollster’s lean</span>'
               f'<div style="position: relative; margin-top: 100px">{tip3}'
               + f'<div role="row" class="srow" style="display: grid; grid-template-columns: {LCOLS}; align-items: center; min-height: 48px; border-bottom: 1px solid #E6E4DF"><span style="padding-left: 12px; display: flex; align-items: baseline; gap: 8px"><span style="font-size: 15px; font-weight: 600">{TOP[0]}</span><span class="sub num">{TOP[3]} polls</span></span>'
               + f'<span>{lean_bar(TOP[1])}</span><span class="num" style="text-align: right; font-size: 15px; font-weight: 600; color: {ALP}">{sgn(TOP[1])}</span><span></span><span>{lean_spark(TOP[2], guide=lean_tip_ym)}</span></div></div>')
    # 4 · dark mode
    out.append(state_head(4, 'Dark mode', 'The table and charts use the site’s existing variables. The one new colour is the interval’s whisker, which needs its own pair so it stays quieter than the dot in both themes.'))
    tok = (f'<div style="margin-top: 16px; display: grid; grid-template-columns: 200px 240px 240px minmax(0, 1fr); column-gap: 24px; font-size: 14px; color: #3D3B37">'
           f'<span class="th" style="padding-bottom: 8px; border-bottom: 1px solid #DDDCD8">Variable</span><span class="th" style="padding-bottom: 8px; border-bottom: 1px solid #DDDCD8">Light</span><span class="th" style="padding-bottom: 8px; border-bottom: 1px solid #DDDCD8">Dark</span><span class="th" style="padding-bottom: 8px; border-bottom: 1px solid #DDDCD8">Used for</span>'
           f'<span style="padding: 12px 0; border-bottom: 1px solid #E6E4DF; font-family: ui-monospace, Menlo, monospace; font-size: 13px">--whisker</span>'
           f'<span style="padding: 12px 0; border-bottom: 1px solid #E6E4DF; display: flex; align-items: center; gap: 10px"><span style="width: 44px; height: 24px; border-radius: 4px; border: 1px solid #DDDCD8; background: #FAF9F6; display: inline-flex; align-items: center; justify-content: center"><span style="width: 32px; height: 2px; border-radius: 1px; background: {WHISK}"></span></span>{WHISK}</span>'
           f'<span style="padding: 12px 0; border-bottom: 1px solid #E6E4DF; display: flex; align-items: center; gap: 10px"><span style="width: 44px; height: 24px; border-radius: 4px; background: #1D1915; display: inline-flex; align-items: center; justify-content: center"><span style="width: 32px; height: 2px; border-radius: 1px; background: #5C5751"></span></span>#5C5751</span>'
           f'<span style="padding: 12px 0; border-bottom: 1px solid #E6E4DF">Each poll’s 95% interval in the lean column; quieter than the dot and the average line in both themes.</span>'
           f'<span style="padding: 12px 0; border-bottom: 1px solid #E6E4DF; font-family: ui-monospace, Menlo, monospace; font-size: 13px">--ink-4, --line</span><span style="padding: 12px 0; border-bottom: 1px solid #E6E4DF">existing</span><span style="padding: 12px 0; border-bottom: 1px solid #E6E4DF">existing</span>'
           f'<span style="padding: 12px 0; border-bottom: 1px solid #E6E4DF">The average line, and the faint two-point gridlines behind it.</span></div>')
    out.append(tok)
    out.append('</section>')
    dark_rows = []
    sep = SHOWN[0][1]
    dk = lambda s: (s.replace('#171717', '#EEEBE5').replace('#6B6862', '#99948F').replace('#4A4843', '#C1BDB7').replace('#3D3B37', '#D8D4CE')
                    .replace('#9A968E', '#6E6964').replace('#E6E4DF', '#34302C').replace('#DDDCD8', '#403B36').replace('#B9463F', '#E56356').replace('#9E5200', '#EC9D4B')
                    .replace('#C9C6BF', '#5C5751').replace('#FAF9F6', '#1D1915'))
    dhead = dk(head_row()).replace(strip_head(), strip_head(dark=True))
    for p in sep[:5]:
        r = tpp(p)
        row = dk(poll_row(p))
        row = row.replace(dk(strip(r)), strip(r, dark=True))
        dark_rows.append(row)
    dgrid = ''.join(dis_panel(k, n, c, t, first=(i == 0), dark=True) for i, (k, n, c, t) in enumerate(PANELS))
    out.append('<section class="dk" style="width: 1280px; box-sizing: border-box; padding: 48px 64px 64px; display: flex; flex-direction: column; flex-shrink: 0; background: #1D1915; color: #EEEBE5">'
               + '<div role="table" aria-label="The table in dark mode" style="display: flex; flex-direction: column">' + dhead + dk(group_row(SHOWN[0][0], sep)) + ''.join(dark_rows) + '</div>'
               + f'<div style="margin-top: 48px; font-size: 13px; font-weight: 600; color: #EEEBE5">How far polls typically sit from the trend through them, points</div>'
               + f'<div style="margin-top: 12px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); column-gap: 24px">{dgrid}</div></section>')
    return '\n'.join(out)


# ================================================================ write
HEIGHTS = json.load(open(HERE + '/allpolls_heights.json')) if os.path.exists(HERE + '/allpolls_heights.json') else {}
BOARDS = {}
d1, d2 = build_desktop()
p1, p2, p3 = build_phone()
BOARDS['AllPollsDesktop1'] = ('All polls page – desktop, 1 of 2', 1280, d1)
BOARDS['AllPollsDesktop2'] = ('All polls page – desktop, 2 of 2', 1280, d2)
BOARDS['AllPollsPhone1'] = ('All polls page – phone, 1 of 3', 390, p1)
BOARDS['AllPollsPhone2'] = ('All polls page – phone, 2 of 3', 390, p2)
BOARDS['AllPollsPhone3'] = ('All polls page – phone, 3 of 3', 390, p3)
BOARDS['AllPollsTable'] = ('All polls – exploring the table: a poll opened, filtering, sorting, the other figures, Labor v Coalition', 1280, build_table_board())
BOARDS['AllPollsDetails'] = ('All polls – getting around: the pinned headings, the phone’s filters, readouts, dark mode', 1280, build_details_board())
for name, (title, w, body) in BOARDS.items():
    h = HEIGHTS.get(name, 8000 if w > 400 else 6000)
    open(OUT + name + '.dc.html', 'w').write(board(title.split(' – ')[0] if False else title, w, h, body))

# the canvas index: an "All polls" page, its boards laid out like the Past cycles page
cj = json.load(open(OUT + 'canvas.json'))
if not any(pg['id'] == 'allpolls' for pg in cj['pages']):
    cj['pages'].append({'id': 'allpolls', 'name': 'All polls'})
H = lambda n: HEIGHTS.get(n, 8000 if BOARDS[n][1] > 400 else 6000)
lay = {'AllPollsDesktop1': (0, 0), 'AllPollsPhone1': (1360, 0), 'AllPollsTable': (1830, 0)}
lay['AllPollsDesktop2'] = (0, H('AllPollsDesktop1') + 120)
lay['AllPollsPhone2'] = (1360, H('AllPollsPhone1') + 120)
lay['AllPollsPhone3'] = (1360, H('AllPollsPhone1') + H('AllPollsPhone2') + 240)
lay['AllPollsDetails'] = (1830, H('AllPollsTable') + 120)
for name, (title, w, _) in BOARDS.items():
    f = name + '.dc.html'
    x, y = lay[name]
    cj['boards'][f] = {'h': H(name), 'page': 'allpolls', 'title': title, 'w': w, 'x': x, 'y': y}
    if f not in cj['order']:
        cj['order'].append(f)
cj['notes']['a1'] = {'kind': 'title1', 'maxW': 1750, 'page': 'allpolls', 'text': 'The All polls page, top to bottom', 'w': 240, 'x': 0, 'y': -260}
cj['notes']['a2'] = {'kind': 'title1', 'maxW': 1280, 'page': 'allpolls', 'text': 'How it’s explored', 'w': 240, 'x': 1830, 'y': -260}
json.dump(cj, open(OUT + 'canvas.json', 'w'), ensure_ascii=False, indent=2)
print('wrote', ', '.join(BOARDS), '| window', len(WIN), 'polls', min(WIN_V), '–', max(WIN_V), '| shown', N_SHOWN)
