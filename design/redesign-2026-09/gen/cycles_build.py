"""Past cycles boards, in the Snapshot redesign's grammar.

Reads data/cycles.json (the tab's own figures, pulled from the running page by
gen/extract_cycles.js) and writes canvas/project/PastCycles*.dc.html:

  PastCyclesDesktop1  masthead, where this term stands, two-party preferred
  PastCyclesDesktop2  primary vote, leadership, how the final polls did
  PastCyclesPhone1-3  the same page at 390
  PastCyclesStates    the shared controls, the picker, a drawn term, the polls
                      under three lines, change since election, the pinned bar,
                      readouts, and the dark twins of the new colours

Run from anywhere: python3 design/redesign-2026-09/gen/cycles_build.py
"""
import json, math, os

S = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
OUT = S + 'canvas/project/'
D = json.load(open(S + 'data/cycles.json'))
MAST_DESK = open(S + 'gen/cycles_masthead_desk.html').read()
MAST_PHONE = open(S + 'gen/cycles_masthead_phone.html').read()
HEIGHTS_FILE = S + 'gen/cycles_heights.json'
HEIGHTS = json.load(open(HEIGHTS_FILE)) if os.path.exists(HEIGHTS_FILE) else {}

# ---------------------------------------------------------------- tokens
BG, INK, T2, G2, G3, G4 = '#FAF9F6', '#171717', '#3D3B37', '#4A4843', '#6B6862', '#9A968E'
RULE, GRIDC = '#DDDCD8', '#E6E4DF'
ALP, LNP, ONP, ONPT, GRN = '#B9463F', '#356697', '#CC7C37', '#9E5200', '#439458'
PARTY = {'alp': ALP, 'lnp': LNP}
PNAME = {'alp': 'Labor', 'lnp': 'the Coalition'}
BAND = '#6B6862'          # past terms: warm grey, the neutral every Snapshot interval uses
OP_OUT, OP_IN = 0.10, 0.17
OP_OUT_THIN, OP_IN_THIN = 0.045, 0.075
SERIF = "'Crimson Text', Georgia, serif"

TERMS = {t['year']: t for t in D['terms']}
CUR = D['current']
CT = TERMS[CUR]
NOW = CT['span']                       # months since the election: 16
MET = {m['key']: m for m in D['metrics']}
PAST = [t['year'] for t in D['terms'] if not t['current']]
RETURNED = [y for y in PAST if TERMS[y]['outcome'] == 'returned']
OUSTED = [y for y in PAST if TERMS[y]['outcome'] == 'ousted']

MINUS = '−'
def f1(v):
    return f'{v:.1f}'.replace('-', MINUS)
def s1(v):
    r = round(v, 1)
    if r == 0:
        return '0.0'
    return ('+' if r > 0 else MINUS) + f'{abs(r):.1f}'
def ordinal(n):
    return f'{n}{"th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")}'

# ---------------------------------------------------------------- pooling (the tab's own rule)
def pct_of(nums, p):
    i = (len(nums) - 1) * p
    lo, hi = math.floor(i), math.ceil(i)
    return nums[lo] + (nums[hi] - nums[lo]) * (i - lo)

def has_data(key, y):
    return y in MET[key]['hasData']

def band_rows(key, mode='abs', years=None):
    """Month by month over the past terms on the board: the same pooling as PastCyclesView."""
    P = MET[key][mode]['pool']
    years = [y for y in (years or PAST) if has_data(key, y)]
    rows = []
    for m in range(37):
        vs, polled = [], 0
        for y in years:
            s = P.get(str(y))
            if not s or m >= len(s) or s[m] is None:
                continue
            vs.append((s[m][0], s[m][2], y))
            polled += s[m][1]
        if not vs:
            continue
        vs.sort()
        nums = [v for v, _, _ in vs]
        rows.append(dict(m=m, n=len(nums), polled=polled, mean=sum(nums) / len(nums),
                         p10=pct_of(nums, .1), p90=pct_of(nums, .9), q1=pct_of(nums, .25), q3=pct_of(nums, .75),
                         vals=vs))
    return rows, len(years)

def cur_value(key, mode='abs'):
    v = CT['end'][key]
    return v - MET[key][mode]['base'][str(CUR)] if mode == 'chg' else v

def standing(key, mode='abs', years=None):
    rows, n = band_rows(key, mode, years)
    row = next(r for r in rows if r['m'] == NOW)
    c = cur_value(key, mode)
    below = sum(1 for v, _, _ in row['vals'] if v < c)
    above = sum(1 for v, _, _ in row['vals'] if v > c)
    total = len(row['vals']) + 1
    if below == 0:
        rank = f'Lowest of {total}'
    elif above == 0:
        rank = f'Highest of {total}'
    elif below < above:
        rank = f'{ordinal(below + 1)} lowest of {total}'
    elif above < below:
        rank = f'{ordinal(above + 1)} highest of {total}'
    else:
        rank = f'Middle of {total}'
    return dict(cur=c, mean=row['mean'], q1=row['q1'], q3=row['q3'], p10=row['p10'], p90=row['p90'],
                vals=row['vals'], below=below, above=above, total=total, rank=rank, extreme=below == 0 or above == 0)

# ---------------------------------------------------------------- page shell
COPY_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round"><rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4"></path></svg>'
EXPAND_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round"><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"></path></svg>'
DOWN_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round"><path d="M12 5v13M6.5 12.5 12 18l5.5-5.5"></path></svg>'
PLUS_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round"><path d="M12 5v14M5 12h14"></path></svg>'
DL_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"></path></svg>'
CHEV_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 2.25; stroke-linecap: round; stroke-linejoin: round"><path d="M6 9l6 6 6-6"></path></svg>'

def copy_btn(label):
    return f'<button class="copy" aria-label="Copy chart: {label}" title="Copy chart">{COPY_SVG}</button>'
def expand_btn(label):
    return f'<button class="copy" aria-label="Expand {label}" title="Expand">{EXPAND_SVG}</button>'

CSS = '''body{margin:0;background:#FAF9F6;color:#171717;font-family:"IBM Plex Sans",system-ui,sans-serif}
a{color:#171717}a:hover{color:#B9463F}
button{font:inherit;cursor:pointer}
.num{font-variant-numeric:tabular-nums}
svg text{font-family:"IBM Plex Sans",system-ui,sans-serif}
.wm{display:flex;align-items:center;gap:14px;padding:0;border:0;background:none;color:#171717;text-align:left}
.ntab{min-height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0 2px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:transparent;font-size:16px;font-weight:500;color:#6B6862;white-space:nowrap;text-decoration:none}
.ntab[aria-current="page"]{border-bottom-color:#171717;font-weight:600;color:#171717}
.ntab:hover{color:#171717}
.segs{display:flex;padding:3px;border-radius:10px;background:#F2F0EC;box-shadow:inset 0 1px 0 rgba(255,255,255,0.85),0 1px 1.5px rgba(91,79,69,0.16),0 3px 6px -3px rgba(91,79,69,0.16)}
.seg{width:40px;height:32px;display:flex;align-items:center;justify-content:center;padding:0;border:0;background:#FEFCF9;color:#6B6862;box-shadow:inset 0 1px 0 rgba(255,255,255,0.85),0 1px 1.5px rgba(91,79,69,0.16)}
.seg:first-child{border-radius:7px 0 0 7px;border-right:1px solid rgba(43,37,33,0.18)}.seg:last-child{border-radius:0 7px 7px 0}
.seg[aria-pressed="true"]{background:#E0DDD8;color:#171717;box-shadow:inset 0 2px 3px rgba(43,37,33,0.15),inset 0 -1px 0 rgba(255,255,255,0.85)}
.dt{font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#6B6862}
.dd{font-size:15px;font-weight:600;color:#171717;white-space:nowrap}
.dd2{font-size:13px;color:#6B6862;white-space:nowrap}
.dot{display:inline-block;width:8px;height:8px;border-radius:4px;background:#10777C;margin-right:7px;vertical-align:1px}
.tn{display:inline-flex;align-items:baseline;gap:5px;white-space:nowrap}
.tn a{font-weight:600;color:#3D3B37;text-decoration:none}
.ext{font-size:10px;color:#9A968E}
.grid{stroke:#E6E4DF;stroke-width:1;fill:none}
.base{stroke:#9A968E;stroke-width:1;fill:none}
.even{stroke:#9A968E;stroke-width:1;stroke-dasharray:3 3;fill:none}
.ax{font-size:12px;fill:#6B6862}
.axb{font-size:12px;font-weight:600;fill:#171717}
.ev{stroke:#C9C6BF;stroke-width:1;stroke-dasharray:1 3;fill:none}
.evt{font-size:12px;font-weight:500;fill:#4A4843}
.evn{fill:#FAF9F6;stroke:#6B6862;stroke-width:1}
.evnt{font-size:9px;font-weight:600;fill:#4A4843;text-anchor:middle}
.ln{fill:none;stroke-linejoin:round;stroke-linecap:round}
.mean{fill:none;stroke:#4A4843;stroke-width:1.75;stroke-dasharray:4 3}
.nowl{stroke:#171717;stroke-width:1;opacity:0.55}
.halo{paint-order:stroke;stroke:#FAF9F6;stroke-width:4px;stroke-linejoin:round}
.end{font-size:13px;font-weight:600}
.lbl{font-size:13px}
.tab{min-height:44px;padding:0 12px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:transparent;font-size:15px;color:#6B6862;white-space:nowrap}
.tab[aria-pressed="true"]{border-bottom-color:#171717;font-weight:600;color:#171717}
.tab:hover{color:#171717}
.tab .n{margin-left:6px;font-weight:400;color:#6B6862}
.ctl{font-size:13px;font-weight:600;color:#4A4843;white-space:nowrap}
.chip{position:relative;min-height:36px;padding:0 14px;border:1px solid #DFDCD7;border-radius:18px;background:#FEFCF9;box-shadow:inset 0 1px 0 rgba(255,255,255,0.85),0 1px 1.5px rgba(91,79,69,0.16),0 3px 6px -3px rgba(91,79,69,0.16);font-size:14px;color:#3D3B37;display:inline-flex;align-items:center;gap:8px;white-space:nowrap}
.chip::after{content:"";position:absolute;left:0;right:0;top:50%;height:44px;transform:translateY(-50%)}
.chip:hover{border-color:#C9C6BF}
.copy{width:44px;height:44px;flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:8px;background:transparent;color:#6B6862;cursor:pointer}
.copy:hover{background:#EFEDE8;color:#171717}
.how{min-height:44px;padding:0;border:0;background:none;display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500;color:#171717}
.key{display:flex;align-items:center;gap:8px}
.th{font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#6B6862;white-space:nowrap}
.srow{border-top:1px solid #E6E4DF}
.srow:hover{background:#F5F3EE}
.jump{width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:8px;color:#4A4843;text-decoration:none}
.jump:hover{background:#EFEDE8;color:#171717}
.check{min-height:44px;display:flex;align-items:center;gap:10px;font-size:14px;color:#171717;cursor:pointer;white-space:nowrap}
.check input{width:18px;height:18px;margin:0;accent-color:#171717;cursor:pointer}
.score{display:inline-flex;flex-wrap:wrap;align-content:center;align-items:baseline;gap:9px;min-height:44px;padding:0 4px;border:0;background:none;white-space:nowrap}
.plabel{font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9A968E}
.tipbox{fill:#FEFCF9;stroke:#DFDCD7;stroke-width:1}
.tipsh{fill:#402C1A;opacity:0.06}
.tt{font-size:12px;font-weight:700;fill:#2B2521}
.tl{font-size:13px;fill:#6E6863}
.tv{font-size:13px;font-weight:700;fill:#2B2521}
.ts{font-size:11px;fill:#6E6863}
.term{min-height:44px;flex-grow:1;padding:0 10px;border:0;border-radius:8px;background:transparent;display:flex;align-items:center;gap:10px;text-align:left;color:#171717}
.term:hover{background:#F1EFEA}
.term[aria-pressed="true"]{background:#F1EFEA}
.tx{width:32px;height:32px;flex-shrink:0;padding:0;border:0;border-radius:16px;background:transparent;color:#6B6862;font-size:17px;line-height:1}
.tx:hover{background:#EFEDE8;color:#171717}
.term:focus-visible,.tab:focus-visible,.ntab:focus-visible,.chip:focus-visible,.copy:focus-visible,.how:focus-visible,.jump:focus-visible,.seg:focus-visible,.wm:focus-visible,.check:focus-within{outline:2px solid #171717;outline-offset:2px;border-radius:4px}'''

def page(title, w, h, body, css_extra=''):
    return f'''<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Crimson+Text:wght@400;600;700&amp;family=IBM+Plex+Sans:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet">
<style>
{CSS}{css_extra}
</style>
</helmet>
<div style="width: {w}px; height: {h}px; display: flex; flex-direction: column; background: {BG}">
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

def section(inner, w=1280, pad='56px 64px', sid=None):
    ida = f' id="{sid}"' if sid else ''
    return (f'<section{ida} style="width: {w}px; box-sizing: border-box; padding: {pad}; display: flex; flex-direction: column; flex-shrink: 0; background: {BG}">\n'
            + inner + '\n</section>')

def kicker(name, meta, phone=False, rule=True):
    if phone:
        return (f'<div style="{"border-top: 2px solid #171717; padding-top: 10px; " if rule else ""}display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: {G3}">'
                f'<span style="font-size: 19px; font-weight: 600; line-height: 1.2; letter-spacing: -0.005em; color: {INK}">{name}</span><span>{meta}</span></div>')
    return (f'<div style="{"border-top: 2px solid #171717; padding-top: 12px; " if rule else ""}display: flex; align-items: baseline; gap: 16px; font-size: 13px; color: {G3}">\n'
            f'<span style="font-size: 22px; font-weight: 600; line-height: 1.2; letter-spacing: -0.005em; color: {INK}">{name}</span>\n<span>{meta}</span>\n</div>')

def keep(text):
    return text.replace('re-elected', '<span style="white-space: nowrap">re-elected</span>')

def headline(text, deck, phone=False, size=46, top=16):
    text = keep(text)
    if phone:
        return (f'<h1 style="margin: 14px 0 0; font-family: {SERIF}; font-weight: 700; font-size: 30px; line-height: 1.1; letter-spacing: -0.01em">{text}</h1>\n'
                f'<p style="margin: 10px 0 0; font-size: 16px; line-height: 1.5; color: {T2}">{deck}</p>')
    return (f'<h1 style="margin: {top}px 0 0; max-width: 1000px; font-family: {SERIF}; font-weight: 700; font-size: {size}px; line-height: 1.08; letter-spacing: -0.01em">{text}</h1>\n'
            f'<p style="margin: 12px 0 0; max-width: 880px; font-size: 18px; line-height: 1.5; color: {T2}">{deck}</p>')

def h3(text, sub, phone=False):
    return (f'<h3 style="margin: 0; font-family: {SERIF}; font-weight: 700; font-size: {22 if phone else 24}px; line-height: 1.15">{text}</h3>\n'
            f'<p style="margin: 4px 0 0; font-size: {14 if phone else 15}px; line-height: 1.45; color: {G2}">{sub}</p>')

def footer(text, href='#method', phone=False, extra=''):
    if phone:
        return (f'<p style="margin: 16px 0 0; padding-top: 12px; border-top: 1px solid {RULE}; font-size: 12px; line-height: 1.55; color: {G3}">{text}</p>\n'
                f'<div style="display: flex; align-items: center; gap: 20px">{extra}<a href="{href}" style="min-height: 44px; display: flex; align-items: center; font-size: 14px; font-weight: 500; white-space: nowrap">How it’s built</a></div>')
    return (f'<div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid {RULE}; display: flex; align-items: center; gap: 24px; font-size: 13px; line-height: 1.5; color: {G3}">\n'
            f'<span style="max-width: 720px">{text}</span>\n<span style="flex-grow: 1"></span>\n{extra}'
            f'<a href="{href}" style="min-height: 44px; display: flex; align-items: center; font-weight: 500; color: {INK}; white-space: nowrap">How it’s built</a>\n</div>')

HOW = '<button class="how" aria-expanded="false"><span aria-hidden="true" style="font-size: 11px">▶</span>How to read these charts</button>'

def cap_row(text, label, top=28, phone=False, expand=True):
    btns = (expand_btn(label + ' chart') if expand else '') + copy_btn(label)
    return (f'<div style="margin-top: {top}px; display: flex; align-items: center; gap: 4px"><span style="flex-grow: 1; font-size: 13px; font-weight: 600; line-height: 1.35">{text}</span>{btns}</div>')

# ---------------------------------------------------------------- keys
def k_band(w=26):
    return (f'<svg width="{w}" height="16" viewBox="0 0 {w} 16" aria-hidden="true"><rect x="0" y="0" width="{w}" height="16" rx="2" style="fill: {BAND}; opacity: {OP_OUT}"></rect>'
            f'<rect x="0" y="4" width="{w}" height="8" style="fill: {BAND}; opacity: {OP_IN}"></rect></svg>')
def k_thin(w=26):
    return (f'<svg width="{w}" height="16" viewBox="0 0 {w} 16" aria-hidden="true"><rect x="0" y="0" width="{w}" height="16" rx="2" style="fill: {BAND}; opacity: {OP_OUT_THIN}"></rect>'
            f'<rect x="0" y="4" width="{w}" height="8" style="fill: {BAND}; opacity: {OP_IN_THIN}"></rect></svg>')
def k_mean(w=24):
    return f'<svg width="{w}" height="14" viewBox="0 0 {w} 14" aria-hidden="true"><path d="M1 7H{w - 1}" class="mean"></path></svg>'
def k_line(c, w=24, sw=3):
    return f'<svg width="{w}" height="14" viewBox="0 0 {w} 14" aria-hidden="true"><path d="M1 7H{w - 1}" style="stroke: {c}; stroke-width: {sw}; stroke-linecap: round"></path></svg>'
def k_ring():
    return f'<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" style="fill: {BG}; stroke: {INK}; stroke-width: 1.75"></circle></svg>'
def k_dot(c, op=0.55, r=3):
    return f'<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="{r}" style="fill: {c}; opacity: {op}"></circle></svg>'
def key_item(svg, text):
    return f'<span class="key">{svg}{text}</span>'

def chart_key(items, copy_label=None, phone=False, top=14):
    if phone:
        return (f'<div style="margin-top: {top}px; padding-top: 12px; border-top: 1px solid {RULE}; display: flex; flex-direction: column; gap: 8px; font-size: 12px; color: {G2}">\n'
                + '\n'.join(items) + '\n</div>')
    tail = f'\n<span style="flex-grow: 1"></span>\n{copy_btn(copy_label)}' if copy_label else ''
    return (f'<div style="margin-top: {top}px; padding-top: 10px; border-top: 1px solid {RULE}; display: flex; align-items: center; flex-wrap: wrap; column-gap: 24px; row-gap: 6px; font-size: 13px; color: {G2}">\n'
            + '\n'.join(items) + tail + '\n</div>')

# ---------------------------------------------------------------- the fan chart
def text_w(s, px=12, wt=500):
    """IBM Plex Sans, roughly: enough to keep labels off each other."""
    per = {400: 0.45, 500: 0.47, 600: 0.49}.get(wt, 0.47)
    return len(s) * px * per

SHORT = {'Now v One Nation': 'v One Nation from June'}
# the handover splits the preferred-PM line too, so it is marked there as well
EXTRA_EVENTS = {'ppmm': [e for e in MET['oppnet']['events'] if e['short'] == 'Ley → Taylor']}

def event_groups(evs, X, gap=15):
    groups = []
    for e in sorted(evs, key=lambda e: e['x']):
        if groups and X(e['x']) - X(groups[-1][0]['x']) < gap:
            groups[-1].append(e)
        else:
            groups.append([e])
    return groups

def nice_path(pts):
    return 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in pts)

def fan(key, *, mode='abs', SW, OX, OY, W, H, dom, ticks, tick_fmt, top_unit='', years=None,
        cur=True, lifted=(), dots=None, events='labels', event_list=None, bracket=True,
        subject=None, ref=None, ref_labels=None, xl='long', ax=12, ring=True, mean_label=True,
        on_overlay=False, eras_labels=None, phone=False, cur_label=None, aria='', lab_dy=None, readout=None, lifted_w=2, lifted_op=0.9, cur_end=None):
    lo, hi = dom
    X0, X1 = -0.8, 36.8
    X = lambda m: (m - X0) / (X1 - X0) * W
    Y = lambda v: (hi - v) / (hi - lo) * H
    rows, bandN = band_rows(key, mode, years)
    if bandN < 3:
        rows = []
    g = [f'<g transform="translate({OX} {OY})">']
    # grid and axis
    g.append('<path class="grid" d="' + ''.join(f'M0 {Y(t):.1f}H{W}' for t in ticks if t != ref) + '"></path>')
    if ref is not None and lo <= ref <= hi:
        g.append(f'<path class="even" d="M0 {Y(ref):.1f}H{W}"></path>')
    for i, t in enumerate(ticks):
        lab = tick_fmt(t) + (top_unit if t == max(ticks) else '')
        g.append(f'<text class="ax num" x="-6" y="{Y(t) + 4:.1f}" style="text-anchor: end">{lab}</text>')
    g.append(f'<path class="base" d="M0 {H}H{W}' + ''.join(f'M{X(m):.1f} {H}v4' for m in (0, 12, 24, 36)) + '"></path>')
    xlab = {0: 'Election', 12: '1 year', 24: '2 years', 36: '3 years'} if xl == 'long' else {0: 'Election', 12: '1 yr', 24: '2 yrs', 36: '3 yrs'}
    for m, lab in xlab.items():
        cls = 'axb' if m == 0 else 'ax'
        anc = 'start' if m == 0 and phone else ('end' if m == 36 and phone else 'middle')
        xx = X(m) - (4 if m == 0 and phone else 0)
        g.append(f'<text class="{cls}" x="{xx:.1f}" y="{H + (16 if phone else 20)}" style="text-anchor: {anc}">{lab}</text>')
    # the band: middle 80% and middle half, fainter where the board thins out
    if rows:
        floor = max(3, math.ceil(bandN * 0.75))
        segs = []
        for i, r in enumerate(rows):
            thin = r['n'] < floor
            if not segs or segs[-1][0] != thin:
                segs.append([thin, [rows[i - 1], r] if i else [r]])
            else:
                segs[-1][1].append(r)
        for thin, pts in segs:
            if len(pts) < 2:
                continue
            for lo_k, hi_k, op in (('p10', 'p90', OP_OUT_THIN if thin else OP_OUT), ('q1', 'q3', OP_IN_THIN if thin else OP_IN)):
                up = [(X(r['m']), Y(r[hi_k])) for r in pts]
                dn = [(X(r['m']), Y(r[lo_k])) for r in reversed(pts)]
                g.append(f'<path d="{nice_path(up + dn)}Z" style="fill: {BAND}; opacity: {op}"></path>')
        g.append(f'<path class="mean" d="{nice_path([(X(r["m"]), Y(r["mean"])) for r in rows])}"></path>')
    ev_g = []
    # events: labelled along the top, or numbered where the chart is narrow
    evs = [e for e in MET[key]['events'] + EXTRA_EVENTS.get(key, [])] if events else []
    if event_list is not None:
        evs = [e for e in evs if e['short'] in event_list]
    if events == 'labels' and evs:
        placed = []   # (row, x0, x1)
        for e in sorted(evs, key=lambda e: e['x']):
            x = X(e['x'])
            lab = SHORT.get(e['short'], e['short'])
            w = text_w(lab)
            for row in (1, 2, 3):
                x0, x1 = x + 5, x + 5 + w
                if all(not (pr == row and not (x1 + 8 < a or x0 > b + 8)) for pr, a, b in placed):
                    break
            placed.append((row, x0, x1))
            ytop = -36 + (row - 1) * 16
            g.append(f'<path class="ev" d="M{x:.1f} {ytop + 4}V{H}"></path>')
            ev_g.append(f'<text class="evt halo" x="{x + 5:.1f}" y="{ytop}">{lab}</text>')
    elif events == 'numbers' and evs:
        for n, grp in enumerate(event_groups(evs, X), 1):
            xs = [X(e['x']) for e in grp]
            xc = sum(xs) / len(xs)
            g.append('<path class="ev" d="' + ''.join(f'M{x:.1f} -7V{H}' for x in xs) + '"></path>'
                     f'<circle class="evn" cx="{xc:.1f}" cy="-14" r="7"></circle><text class="evnt" x="{xc:.1f}" y="-11">{n}</text>')
    # the reference line's own words
    if ref_labels and ref is not None:
        up, down = ref_labels
        g.append(f'<text class="ax halo" x="6" y="{Y(ref) - 7:.1f}">{up}</text>')
        g.append(f'<text class="ax halo" x="6" y="{Y(ref) + (15 if phone else 17):.1f}">{down}</text>')
    # past terms drawn as their own line
    for yr, col, lab in lifted:
        for s in MET[key][mode]['lines'][str(yr)]:
            pts = [(X(p[0]), Y(p[1])) for p in s['pts']]
            g.append(f'<path class="ln" d="{nice_path(pts)}" style="stroke: {col}; stroke-width: {lifted_w}; opacity: {lifted_op}"></path>')
        last = MET[key][mode]['lines'][str(yr)][-1]['pts'][-1]
        dy = 4 + (lab_dy.get(yr, 0) if lab_dy else 0)
        g.append(f'<text class="end halo" x="{X(last[0]) + 7:.1f}" y="{Y(last[1]) + dy:.1f}" style="fill: {col}; font-size: {12 if phone else 13}px">{lab}</text>')
    # the polls under a line
    if dots:
        for yr, col, shape in dots:
            for x, y, iso, firm in MET[key]['readings'][str(yr)]:
                if y is None:
                    continue
                cx, cy = X(x), Y(y if mode == 'abs' else y - MET[key]['chg']['base'][str(yr)])
                if shape == 'tri':
                    g.append(f'<path d="M{cx:.1f} {cy - 3.6:.1f}l3.2 5.6h-6.4z" style="fill: {col}; opacity: 0.4"></path>')
                elif shape == 'dia':
                    g.append(f'<path d="M{cx:.1f} {cy - 3.6:.1f}l3.4 3.6-3.4 3.6-3.4-3.6z" style="fill: {col}; opacity: 0.4"></path>')
                else:
                    g.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="2.6" style="fill: {col}; opacity: 0.4"></circle>')
    # One Nation, this term only: a thin dotted line on the opposition chart
    if on_overlay and mode == 'abs':
        pts = [(X(m), Y(v)) for m, v in D['onp'] if v is not None]
        g.append(f'<path class="ln" d="{nice_path(pts)}" style="stroke: {ONP}; stroke-width: 2.25; stroke-dasharray: 1 4"></path>')
        m, v = D['onp'][-1]
        g.append(f'<text class="lbl halo" x="{X(m) + 8:.1f}" y="{Y(v) + 4:.1f}" style="fill: {ONPT}; font-weight: 600">One Nation {f1(v)}</text>')
    # the sitting term
    colr = PARTY[CT['gov'] if not MET[key]['leader'] else CT['opp']] if cur is True else cur
    segs = MET[key][mode]['lines'][str(CUR)]
    if cur:
        # the months before the line starts, and between two contests, are simply not drawn
        for si, s in enumerate(segs):
            pts = [(X(p[0]), Y(p[1])) for p in s['pts']]
            g.append(f'<path class="ln" d="{nice_path(pts)}" style="stroke: {colr}; stroke-width: {2.5 if phone else 3}"></path>')
        if eras_labels:
            for s, (lab, at, dx, dy, anc) in zip(segs, eras_labels):
                if lab is None:
                    continue
                p = {'end': s['pts'][-1], 'start': s['pts'][0], 'max': max(s['pts'], key=lambda q: q[1]), 'min': min(s['pts'], key=lambda q: q[1])}[at]
                g.append(f'<text class="lbl halo" x="{X(p[0]) + dx:.1f}" y="{Y(p[1]) + dy:.1f}" style="fill: {colr}; font-weight: 600; text-anchor: {anc}">{lab}</text>')
        first = segs[0]['pts'][0]
        if ring and first[0] == 0:
            g.append(f'<circle cx="{X(0):.1f}" cy="{Y(first[1]):.1f}" r="{4 if phone else 5}" style="fill: {BG}; stroke: {INK}; stroke-width: 1.75"></circle>')
        end = segs[-1]['pts'][-1]
    # now: the month every comparison on the page is made at
    xn = X(NOW)
    g.append(f'<path class="nowl" d="M{xn:.1f} 0V{H}"></path>')
    g.append(f'<text class="axb" x="{xn:.1f}" y="{H + (16 if phone else 20)}" style="text-anchor: middle">Now</text>')
    if cur:
        g.append(f'<circle cx="{xn:.1f}" cy="{Y(end[1]):.1f}" r="{4.5 if phone else 5.5}" style="fill: {colr}; stroke: {BG}; stroke-width: 2"></circle>')
    # how far the sitting term is from the average of the terms on the board, at this very month
    if cur and cur_end:
        g.append(f'<text class="end halo" x="{xn + 9:.1f}" y="{Y(end[1]) + 4:.1f}" style="fill: {colr}">{cur_end}</text>')
    if cur and bracket and rows:
        mrow = next(r for r in rows if r['m'] == NOW)
        yc, ym = Y(end[1]), Y(mrow['mean'])
        g.append(f'<circle cx="{xn:.1f}" cy="{ym:.1f}" r="3.5" style="fill: {BG}; stroke: {G2}; stroke-width: 1.5"></circle>')
        bx = xn + (7 if phone else 9)
        g.append(f'<path d="M{bx - 3:.1f} {yc:.1f}H{bx:.1f}V{ym:.1f}H{bx - 3:.1f}" style="fill: none; stroke: {INK}; stroke-width: 1"></path>')
        d = end[1] - mrow['mean']
        word = 'above' if d >= 0 else 'below'
        mid = (yc + ym) / 2
        name, val = cur_label or (subject or '', '')
        tx = bx + 7
        fs = 12 if phone else 13
        g.append(f'<text class="halo num" x="{tx:.1f}" y="{mid - 3:.1f}" style="font-size: {fs}px"><tspan x="{tx:.1f}" style="font-weight: 600; fill: {colr}">{name} {val}</tspan>'
                 f'<tspan x="{tx:.1f}" dy="{fs + 4}" style="fill: {T2}">{f1(abs(d))} {word} average</tspan></text>')
    g.extend(ev_g)
    if readout:
        g.extend(readout(X, Y, rows))
    if rows and mean_label:
        r = rows[-1]
        g.append(f'<text class="lbl halo" x="{X(r["m"]) + 6:.1f}" y="{Y(r["mean"]) + 4:.1f}" style="fill: {G2}; font-weight: 600">Average</text>')
    g.append('</g>')
    SH = OY + H + (24 if phone else 30)
    return (f'<svg viewBox="0 0 {SW} {SH:.0f}" width="{SW}" height="{SH:.0f}" role="img" aria-label="{aria}" style="display: block; overflow: visible">\n'
            + '\n'.join(g) + '\n</svg>')

# ---------------------------------------------------------------- where this term stands
STRIP_W = 400
ROWS = [
    # group, key, name, subject, colour, target, unit
    ('votes', 'tpp', 'Two-party preferred', 'Labor, against One Nation', ALP, '#two-party-preferred', '%'),
    ('votes', 'primary', 'Government’s primary vote', 'Labor', ALP, '#primary-vote', '%'),
    ('votes', 'oppr', 'Opposition’s primary vote', 'The Coalition', LNP, '#primary-vote', '%'),
    ('leaders', 'ppmm', 'Preferred PM, lead', 'Albanese over Taylor', ALP, '#leadership', ''),
    ('leaders', 'net', 'Prime minister’s net approval', 'Albanese', ALP, '#leadership', ''),
    ('leaders', 'oppnet', 'Opposition leader’s net approval', 'Taylor', LNP, '#leadership', ''),
]
GROUPS = {
    'votes': dict(name='Votes', unit='% of voters', dom=(20, 60), ticks=(20, 30, 40, 50, 60), fmt=lambda t: f'{t}%' if t == 60 else f'{t}'),
    'leaders': dict(name='Leaders', unit='net points', dom=(-40, 60), ticks=(-40, -20, 0, 20, 40, 60), fmt=lambda t: 'Even' if t == 0 else s1(t).replace('.0', '')),
}

def val_txt(v, unit, big=22, small=13):
    if unit == '%':
        return f'{f1(v)}<span style="font-size: {small}px">%</span>'
    return s1(v)

def strip_svg(st, group, colr, SW=STRIP_W, H=44, phone=False):
    G_ = GROUPS[group]
    lo, hi = G_['dom']
    pad = 8
    X = lambda v: pad + (v - lo) / (hi - lo) * (SW - 2 * pad)
    c = H / 2
    g = []
    g.append('<path class="grid" d="' + ''.join(f'M{X(t):.1f} 0V{H}' for t in G_['ticks']) + '"></path>')
    g.append(f'<rect x="{X(st["p10"]):.1f}" y="{c - 11:.1f}" width="{X(st["p90"]) - X(st["p10"]):.1f}" height="22" rx="3" style="fill: {BAND}; opacity: {OP_OUT}"></rect>')
    g.append(f'<rect x="{X(st["q1"]):.1f}" y="{c - 11:.1f}" width="{X(st["q3"]) - X(st["q1"]):.1f}" height="22" style="fill: {BAND}; opacity: {OP_IN}"></rect>')
    # past terms, stepped into lanes where they would sit on each other
    lanes, offs = [], [0, -8, 8, -16, 16]
    dots = []
    for v, who, yr in sorted(st['vals']):
        x = X(v)
        for li in range(len(offs)):
            if li >= len(lanes):
                lanes.append(-99)
            if x - lanes[li] >= 8.5:
                lanes[li] = x
                break
        dots.append(f'<circle cx="{x:.1f}" cy="{c + offs[li]:.1f}" r="3.5" style="fill: {G3}; opacity: 0.6"></circle>')
    g.extend(dots)
    xm = X(st['mean'])
    g.append(f'<path d="M{xm:.1f} {c - 14:.1f}V{c + 14:.1f}" style="stroke: {INK}; stroke-width: 2"></path>')
    g.append(f'<circle cx="{X(st["cur"]):.1f}" cy="{c:.1f}" r="{6.5 if phone else 7}" style="fill: {colr}; stroke: {BG}; stroke-width: 2"></circle>')
    return f'<svg viewBox="0 0 {SW} {H}" width="{SW}" height="{H}" aria-hidden="true" style="display: block; overflow: visible">' + ''.join(g) + '</svg>'

def strip_axis(group, SW=STRIP_W, H=20):
    G_ = GROUPS[group]
    lo, hi = G_['dom']
    pad = 8
    X = lambda v: pad + (v - lo) / (hi - lo) * (SW - 2 * pad)
    t = ''.join(f'<text class="ax num" x="{X(v):.1f}" y="14" style="text-anchor: middle">{G_["fmt"](v)}</text>' for v in G_['ticks'])
    return f'<svg viewBox="0 0 {SW} {H}" width="{SW}" height="{H}" aria-hidden="true" style="display: block; overflow: visible">{t}</svg>'

def peer_line(st, key):
    names = [w for _, w, _ in st['vals']]
    who_of = lambda w, yr: f'{w} ({yr})' if names.count(w) > 1 else w
    fmt = (lambda v: f1(v)) if key in ('tpp', 'primary', 'oppr') else s1
    if st['below'] == 0:
        v, w, yr = st['vals'][0]
        return f'Previous low: {who_of(w, yr)}, {fmt(v)}'
    if st['above'] == 0:
        v, w, yr = st['vals'][-1]
        return f'Previous high: {who_of(w, yr)}, {fmt(v)}'
    if st['below'] == 1:
        v, w, yr = st['vals'][0]
        return f'Only {w} ({yr}) was lower'
    if st['above'] == 1:
        v, w, yr = st['vals'][-1]
        return f'Only {w} ({yr}) was higher'
    return ''

COLS = '232px 100px 24px 400px 28px 144px minmax(0, 1fr) 44px'

def standing_table(years=None, mode='abs', highlight=None):
    out = [f'<div role="table" aria-label="The 2025 term against the same month of every past term" style="margin-top: 24px">']
    out.append(f'<div role="row" style="display: grid; grid-template-columns: {COLS}; align-items: end; padding-bottom: 8px; border-bottom: 1px solid {G4}">'
               f'<span class="th" role="columnheader" style="padding-left: 12px">Measure</span><span class="th" role="columnheader" style="text-align: right">Now</span><span></span>'
               f'<span class="th" role="columnheader">Past terms, {NOW} months in</span><span></span><span class="th" role="columnheader">Against average</span><span class="th" role="columnheader">Rank</span><span></span></div>')
    for gk in ('votes', 'leaders'):
        G_ = GROUPS[gk]
        out.append(f'<div style="display: grid; grid-template-columns: {COLS}; align-items: end; padding: {14 if gk == "votes" else 22}px 0 4px">'
                   f'<span style="padding-left: 12px; font-size: 13px; color: {G3}"><b style="font-weight: 600; color: {INK}">{G_["name"]}</b>&#160; {G_["unit"]}</span><span></span><span></span>{strip_axis(gk)}<span></span><span></span><span></span><span></span></div>')
        for grp, key, name, subj, colr, href, unit in ROWS:
            if grp != gk:
                continue
            st = standing(key, mode, years)
            d = st['cur'] - st['mean']
            arrow = '▲' if d >= 0 else '▼'
            word = 'above' if d >= 0 else 'below'
            peer = peer_line(st, key)
            mean_txt = f'{f1(st["mean"])}' if unit == '%' else s1(st['mean'])
            hl = ' background: #F1EFEA;' if highlight == key else ''
            out.append(f'<div role="row" class="srow" style="display: grid; grid-template-columns: {COLS}; align-items: center; min-height: 66px;{hl}">'
                       f'<span role="rowheader" style="padding: 10px 0 10px 12px; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600; line-height: 1.3">{name}</span><span style="font-size: 13px; color: {G3}">{subj}</span></span>'
                       f'<span role="cell" class="num" style="text-align: right; font-size: 22px; font-weight: 500; letter-spacing: -0.01em; color: {colr}">{val_txt(st["cur"], unit)}</span><span></span>'
                       f'<span role="cell">{strip_svg(st, gk, colr)}</span><span></span>'
                       f'<span role="cell" class="num" style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">{arrow} {f1(abs(d))} {word}</span><span style="font-size: 13px; color: {G3}">average {mean_txt}</span></span>'
                       f'<span role="cell" class="num" style="display: flex; flex-direction: column; gap: 2px; padding-right: 8px"><span style="font-size: 15px; {"font-weight: 600; color: " + INK if st["extreme"] else "color: " + G2}">{st["rank"]}</span>'
                       + (f'<span style="font-size: 13px; line-height: 1.35; color: {G3}">{peer}</span>' if peer else '') + '</span>'
                       f'<a class="jump" href="{href}" aria-label="Go to the {name[0].lower() + name[1:]} chart" title="Go to the chart">{DOWN_SVG}</a></div>')
    out.append('</div>')
    return '\n'.join(out)

def strip_key(phone=False):
    items = [key_item(k_dot(G3, 0.6, 3.5), 'A past term at the same point'),
             key_item('<svg width="30" height="16" viewBox="0 0 30 16" aria-hidden="true">'
                      f'<rect x="0" y="0" width="30" height="16" rx="2" style="fill: {BAND}; opacity: {OP_OUT}"></rect><rect x="7" y="0" width="16" height="16" style="fill: {BAND}; opacity: {OP_IN}"></rect></svg>',
                      'Middle half, and middle 80%, of past terms'),
             key_item(f'<svg width="8" height="16" viewBox="0 0 8 16" aria-hidden="true"><path d="M4 1V15" style="stroke: {INK}; stroke-width: 2"></path></svg>', 'Their average'),
             key_item(f'<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.5" style="fill: {ALP}"></circle></svg>', 'The 2025 term')]
    if phone:
        return (f'<div style="margin-top: 16px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 16px; row-gap: 8px; font-size: 12px; color: {G2}">' + ''.join(items) + '</div>')
    return (f'<div style="margin-top: 14px; display: flex; flex-wrap: wrap; column-gap: 24px; row-gap: 6px; font-size: 13px; color: {G2}">' + ''.join(items) + '</div>')

def controls(board='all', mode='abs', drawn=(), phone=False, open_picker=False):
    tabs = [('all', 'All past terms', len(PAST)), ('returned', 'Re-elected', len(RETURNED)), ('ousted', 'Turned out', len(OUSTED))]
    if phone:
        t1 = ''.join(f'<button class="tab" aria-pressed="{"true" if k == board else "false"}" style="flex: 1; padding: 0 4px; font-size: 14px">{lab}<span class="n">{n}</span></button>' for k, lab, n in tabs).replace('All past terms', 'All')
        t2 = ''.join(f'<button class="tab" aria-pressed="{"true" if k == mode else "false"}" style="padding: 0 10px; font-size: 14px">{lab}</button>' for k, lab in (('abs', 'Level'), ('chg', 'Change')))
        return (f'<div style="margin-top: 20px; display: flex; flex-direction: column">'
                f'<span class="ctl" style="font-size: 12px">Compare with</span>'
                f'<div role="group" aria-label="Past terms on the board" style="display: flex; border-bottom: 1px solid {RULE}">{t1}</div>'
                f'<div style="display: flex; align-items: center; gap: 8px; border-bottom: 1px solid {RULE}"><div role="group" aria-label="Measure" style="display: flex">{t2}</div><span style="flex-grow: 1"></span>'
                f'<button class="chip" aria-haspopup="dialog" aria-expanded="{"true" if open_picker else "false"}" style="min-height: 34px; padding: 0 12px; font-size: 13px">{PLUS_SVG}Draw a term</button></div></div>')
    t1 = ''.join(f'<button class="tab" aria-pressed="{"true" if k == board else "false"}">{lab}<span class="n">{n}</span></button>' for k, lab, n in tabs)
    t2 = ''.join(f'<button class="tab" aria-pressed="{"true" if k == mode else "false"}">{lab}</button>' for k, lab in (('abs', 'Level'), ('chg', 'Change since election')))
    chips = ''.join(f'<span class="chip" style="gap: 6px; padding: 0 4px 0 12px; border-color: {c}; box-shadow: none; background: {BG}"><span style="width: 14px; height: 3px; border-radius: 2px; background: {c}"></span>{lab}'
                    f'<button class="tx" aria-label="Return {lab} to the band" title="Return to the band" style="width: 28px; height: 28px; font-size: 16px">×</button></span>' for _, c, lab in drawn)
    chip_row = (f'\n<div style="margin-top: 10px; display: flex; align-items: center; gap: 10px"><span class="ctl" style="font-weight: 500; color: {G3}">Drawn over the band</span>{chips}</div>' if drawn else '')
    return (f'<div style="margin-top: 28px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid {RULE}">\n'
            f'<span class="ctl" style="margin-right: 4px">Compare with</span>\n'
            f'<div role="group" aria-label="Past terms on the board" style="display: flex; gap: 2px">{t1}</div>\n'
            f'<span style="width: 1px; height: 20px; margin: 0 12px; background: {RULE}"></span>\n'
            f'<div role="group" aria-label="Measure" style="display: flex; gap: 2px">{t2}</div>\n'
            f'<span style="flex-grow: 1"></span>\n'
            f'<button class="chip" aria-haspopup="dialog" aria-expanded="{"true" if open_picker else "false"}">{PLUS_SVG}Draw a past term</button>\n</div>' + chip_row)

# ---------------------------------------------------------------- copy
H_TOP = 'Both major parties are at record lows for this point in a term'
D_TOP = ('Sixteen months after the 2025 election, Labor’s primary vote is the lowest of any government at the same point since 1972, '
         'and the Coalition’s the lowest of any opposition. After preferences, though, Labor’s 51.2% sits in the middle half of past governments.')
H_TPP = 'After preferences, Labor is on a par with governments that went on to be re-elected'
PRE_TPP = standing('tpp', years=RETURNED)
OUS_TPP = standing('tpp', years=OUSTED)
ALL_TPP = standing('tpp')
D_TPP = (f'Its {f1(ALL_TPP["cur"])}% against One Nation is {f1(ALL_TPP["cur"] - ALL_TPP["mean"])} points above the average government {NOW} months in. '
         f'Governments later re-elected averaged {f1(PRE_TPP["mean"])}% at this point; the six turned out averaged {f1(OUS_TPP["mean"])}%.')
F_TPP = ('Every line is the implied two-party figure: each poll’s primary votes read through the preferences counted at the election that opened its term, '
         'the only table anyone could have used at the time. The 2025 term follows the rival Labor is doing worst against, as the headline does: '
         'the Coalition until May 2026, One Nation since.')
F_TOP = ('Each term is lined up on its own election day, so month 16 is the same distance into every one of them. '
         'Past terms are averaged month by month the way this term is; where a term changed leader, its line follows whoever held the office.')

def dl_link():
    return (f'<a href="#source-polls" style="min-height: 44px; display: flex; align-items: center; gap: 8px; font-weight: 500; color: {INK}; white-space: nowrap">'
            f'{DL_SVG}Source polls, CSV</a>')

def section_index():
    links = [('two-party-preferred', 'Two-party preferred'), ('primary-vote', 'Primary vote'), ('leadership', 'Leadership'), ('final-polls', 'How the final polls did')]
    return ('<nav aria-label="On this page" style="display: flex; align-items: baseline; gap: 18px; font-size: 13px">'
            + ''.join(f'<a href="#{k}" style="font-weight: 500; color: {G2}; text-decoration: none; white-space: nowrap">{lab}</a>' for k, lab in links) + '</nav>')

# ---------------------------------------------------------------- desktop sections
def d_overview():
    body = '\n\n'.join([
        kicker('Past cycles', 'Every term since 1972, lined up on its own election day', rule=False).replace('\n</div>', '\n<span style="flex-grow: 1"></span>\n' + section_index() + '\n</div>', 1),
        headline(H_TOP, D_TOP),
        controls(),
        standing_table(),
        strip_key(),
        footer(F_TOP, '#cycles-method', extra=dl_link() + '\n'),
    ])
    return section(body, pad='44px 64px 56px', sid='summary')

def d_tpp():
    st = ALL_TPP
    chart = fan('tpp', SW=1152, OX=36, OY=52, W=1010, H=330, dom=(40, 60), ticks=(40, 45, 50, 55, 60),
                tick_fmt=lambda t: f'{t}', top_unit='%', ref=50, ref_labels=('▲ Government ahead', '▼ Opposition ahead'),
                cur_label=('Labor', f1(st['cur'])),
                aria=(f'The government’s implied two-party share by month since its election, for 20 past terms since 1972 as a band, and the 2025 term as a line. '
                      f'Sixteen months in, Labor is on {f1(st["cur"])} against One Nation; the average past government was on {f1(st["mean"])}, '
                      f'and the middle half of them between {f1(st["q1"])} and {f1(st["q3"])}.'))
    key = chart_key([key_item(k_band(), 'Middle half and middle 80% of past terms'),
                     key_item(k_mean(), 'Their average'),
                     key_item(k_thin(), 'Paler: fewer terms ran this long'),
                     key_item(k_line(ALP), 'The 2025 term, monthly'),
                     key_item(k_ring(), '2025 election result')])
    body = '\n\n'.join([
        kicker('Two-party preferred', 'Implied from each poll’s primary votes, on the flows counted at the election that opened its term'),
        headline(H_TPP, D_TPP),
        cap_row('The government’s two-party share, %, by months since its election', 'two-party preferred', top=32),
        chart.replace('style="display: block', 'style="margin-top: 8px; display: block', 1),
        key,
        f'<div style="margin-top: 6px">{HOW}</div>',
        footer(F_TPP, '#tpp-method'),
    ])
    return section(body, sid='two-party-preferred')

def net_fmt(t):
    return 'Even' if t == 0 else s1(t).replace('.0', '')
def lead_fmt(t):
    return 'Tied' if t == 0 else s1(t).replace('.0', '')

def events_list(key, phone=False, only=None, W=None):
    evs = sorted([e for e in MET[key]['events'] if not only or e['short'] in only], key=lambda e: e['x'])
    W = W or (314 if phone else 452)
    X = lambda m: (m + 0.8) / 37.6 * W
    evs = [dict(g[0], short=' · '.join(SHORT.get(e['short'], e['short']) for e in g)) for g in event_groups(evs, X)]
    mon = lambda iso: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][int(iso[5:7]) - 1] + ' ' + iso[:4]
    if phone:
        return (f'<ol style="margin: 14px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: {T2}">'
                + ''.join(f'<li style="display: flex; gap: 10px"><span class="num" style="width: 16px; font-weight: 600; color: {G3}">{n}</span><span style="flex-grow: 1">{SHORT.get(e["short"], e["short"])}</span><span style="color: {G3}">{mon(e["date"])}</span></li>'
                          for n, e in enumerate(evs, 1)) + '</ol>')
    return (f'<ol style="margin: 16px 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; column-gap: 28px; row-gap: 6px; font-size: 13px; color: {T2}">'
            + ''.join(f'<li style="display: flex; align-items: center; gap: 8px"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle class="evn" cx="8" cy="8" r="7"></circle><text class="evnt" x="8" y="11">{n}</text></svg>'
                      f'<span>{SHORT.get(e["short"], e["short"])}</span><span style="color: {G3}">{mon(e["date"])}</span></li>' for n, e in enumerate(evs, 1)) + '</ol>')

def k_two(c1, c2):
    return (f'<svg width="30" height="14" viewBox="0 0 30 14" aria-hidden="true"><path d="M1 7H13" style="stroke: {c1}; stroke-width: 3; stroke-linecap: round"></path>'
            f'<path d="M17 7H29" style="stroke: {c2}; stroke-width: 3; stroke-linecap: round"></path></svg>')

def two_col(a, b, gap=48):
    return f'<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: {gap}px; align-items: start">\n<div style="display: flex; flex-direction: column">{a}</div>\n<div style="display: flex; flex-direction: column">{b}</div>\n</div>'

def d_primary():
    stg, sto = standing('primary'), standing('oppr')
    cg, co = standing('primary', 'chg'), standing('oppr', 'chg')
    H = 'No opposition has lost as much of its vote this early as the Coalition has'
    Dk = (f'The Coalition is down {f1(-co["cur"])} points since the election, to {f1(sto["cur"])}%; by this stage the average opposition had gained {f1(co["mean"])}. '
          f'Labor is down {f1(-cg["cur"])}, to {f1(stg["cur"])}%. Only Whitlam’s government, in 1974, had lost more by now.')
    kw = dict(SW=552, OX=30, OY=30, W=452, H=300, dom=(15, 55), ticks=(20, 30, 40, 50), tick_fmt=lambda t: f'{t}', top_unit='%', events='numbers', xl='short')
    ag = (f'The governing party’s primary vote by month since its election: 20 past terms as a band, and Labor this term as a line, '
          f'now {f1(stg["cur"])}%, the lowest of any government at this point; the average was {f1(stg["mean"])}%.')
    ao = (f'The main opposition party’s primary vote by month since the election: 20 past terms as a band, and the Coalition this term as a line, '
          f'now {f1(sto["cur"])}%, the lowest of any opposition at this point; the average was {f1(sto["mean"])}%.')
    left = (cap_row('Government’s primary vote, %', 'government primary vote', top=0)
            + fan('primary', **kw, cur_label=('Labor', f1(stg['cur'])), aria=ag).replace('style="display: block', 'style="margin-top: 8px; display: block', 1))
    onchk = '<label class="check" style="margin-right: 8px; font-size: 13px"><input type="checkbox">One Nation this term</label>'
    right = (cap_row('Opposition’s primary vote, %', 'opposition primary vote', top=0).replace('<button class="copy" aria-label="Expand', onchk + '<button class="copy" aria-label="Expand', 1)
             + fan('oppr', **kw, cur_label=('Coalition', f1(sto['cur'])), aria=ao).replace('style="display: block', 'style="margin-top: 8px; display: block', 1))
    key = chart_key([key_item(k_band(), 'Middle half and middle 80% of past terms'),
                     key_item(k_mean(), 'Their average'),
                     key_item(k_thin(), 'Paler: fewer terms ran this long'),
                     key_item(k_two(ALP, LNP), 'The 2025 term: Labor, the Coalition'),
                     key_item(k_ring(), '2025 election result')], top=18)
    body = '\n\n'.join([
        kicker('Primary vote', 'First preferences for the governing party and the main opposition party'),
        headline(H, Dk),
        '<div style="margin-top: 32px"></div>' + two_col(left, right),
        events_list('primary'),
        key,
        footer('Past terms are the governing party and the main opposition party of the day, Labor or the Coalition. '
               'A month with no poll is filled in from the months either side, and a drawn term shows that stretch dashed.', '#primary-method'),
    ])
    return section(body, sid='primary-vote')

def d_leaders():
    stn, stp, sto = standing('net'), standing('ppmm'), standing('oppnet')
    H = 'Albanese’s net approval is the second lowest of any prime minister at this point, after Whitlam’s'
    Dk = (f'At {s1(stn["cur"])} he is {f1(stn["mean"] - stn["cur"])} points below the average prime minister {NOW} months in. '
          f'He still leads as preferred PM by {f1(stp["cur"])} points, close to the average, and Taylor, at {s1(sto["cur"])}, rates about as opposition leaders usually do.')
    big = fan('net', SW=1152, OX=36, OY=52, W=1010, H=330, dom=(-40, 60), ticks=(-40, -20, 0, 20, 40, 60), tick_fmt=net_fmt, ref=0, ring=False,
              cur_label=('Albanese', s1(stn['cur'])),
              aria=(f'Prime ministers’ net approval by month since their election: 20 past terms as a band, and Albanese as a line, '
                    f'falling from {s1(17.5)} to {s1(stn["cur"])}, the second lowest at this point after Whitlam in 1974.'))
    kws = dict(SW=552, OX=30, OY=34, W=452, H=250, events='labels', xl='short', event_list=['Ley → Taylor'])
    ppm = fan('ppmm', **kws, dom=(-20, 50), ticks=(-20, 0, 20, 40), tick_fmt=lead_fmt, ref=0, ring=False,
              cur_label=('over Taylor', s1(stp['cur'])), eras_labels=[('over Ley', 'max', 0, -10, 'middle'), (None, 'end', 0, 0, 'end')],
              aria=f'The prime minister’s lead as preferred PM by month since the election, 15 terms since 1984 as a band, and Albanese this term, now {s1(stp["cur"])}.')
    opn = fan('oppnet', **kws, dom=(-40, 60), ticks=(-40, -20, 0, 20, 40, 60), tick_fmt=net_fmt, ref=0, ring=False,
              cur_label=('Taylor', s1(sto['cur'])), eras_labels=[('Ley', 'end', 7, 4, 'start'), (None, 'end', 0, 0, 'end')],
              aria=f'Opposition leaders’ net approval by month since the election: 20 past terms as a band, and Ley then Taylor this term, now {s1(sto["cur"])}.')
    left = (h3('Preferred prime minister', 'The prime minister’s lead over the opposition leader on the question of who would make the better PM. Asked since 1984.')
            + cap_row('PM’s lead, points', 'preferred prime minister', top=16) + ppm.replace('style="display: block', 'style="margin-top: 8px; display: block', 1))
    right = (h3('Opposition leader’s net approval', 'Approve minus disapprove, for whoever led the opposition at the time. Rated since 1972.')
             + cap_row('Net approval, points', 'opposition leader net approval', top=16) + opn.replace('style="display: block', 'style="margin-top: 8px; display: block', 1))
    key = chart_key([key_item(k_band(), 'Middle half and middle 80% of past terms'),
                     key_item(k_mean(), 'Their average'),
                     key_item(k_thin(), 'Paler: fewer terms ran this long'),
                     key_item(k_two(ALP, LNP), 'The 2025 term: Albanese, the opposition leader')])
    body = '\n\n'.join([
        kicker('Leadership', 'Net approval since 1972 and preferred PM since 1984, for whoever held the office'),
        headline(H, Dk),
        cap_row('Prime minister’s net approval: approve minus disapprove, points', 'prime minister net approval', top=32),
        big.replace('style="display: block', 'style="margin-top: 8px; display: block', 1),
        '<div style="margin-top: 48px"></div>' + two_col(left, right),
        key,
        footer('Where a term changed leader its line follows whoever held the office. The earliest terms’ ratings are the Morgan Gallup Poll’s, '
               'as printed in The Bulletin; later terms pool every pollster that asked, each corrected for its lean. Favourability ratings are left out.', '#leaders-method'),
    ])
    return section(body, sid='leadership')

ACC = D['accuracy']
ACOLS = '150px 24px 648px 24px 84px minmax(0, 1fr)'
ASPAN, AW = 5, 648

def acc_x(err, W=AW, pad=14):
    e = max(-ASPAN, min(ASPAN, err))
    return W / 2 + e / ASPAN * (W / 2 - pad)

def acc_strip(c, W=AW, H=40, big=7, small=4.5):
    g = [f'<path class="grid" d="M{acc_x(-2.5, W):.1f} 0V{H}M{acc_x(2.5, W):.1f} 0V{H}"></path>',
         f'<path d="M{acc_x(0, W):.1f} 0V{H}" style="stroke: {G4}; stroke-width: 1.5"></path>']
    col = lambda e: ALP if e > 0 else (LNP if e < 0 else G3)
    if c['n'] > 1:
        for h in c['houses']:
            g.append(f'<circle cx="{acc_x(h["err"], W):.1f}" cy="{H / 2}" r="{small}" style="fill: {col(h["err"])}; opacity: 0.5"></circle>')
    e = c['err'] if c['n'] > 1 else c['houses'][0]['err']
    g.append(f'<circle cx="{acc_x(e, W):.1f}" cy="{H / 2}" r="{big}" style="fill: {col(e)}; stroke: {BG}; stroke-width: 2"></circle>')
    return f'<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" aria-hidden="true" style="display: block; overflow: visible">' + ''.join(g) + '</svg>'

def acc_rows(phone=False):
    by = sorted(ACC['cycles'], key=lambda c: -c['year'])
    out = []
    for gi, (lab, lst) in enumerate((('Last five elections', by[:5]), ('Earlier elections', by[5:]))):
        if phone:
            out.append(f'<div style="padding: {8 if gi == 0 else 20}px 0 6px; font-size: 13px; font-weight: 600">{lab}</div>')
        else:
            out.append(f'<div style="padding: {12 if gi == 0 else 22}px 0 6px 12px; font-size: 13px; font-weight: 600">{lab}</div>')
        for c in lst:
            col = ALP if c['err'] > 0 else LNP
            tag = (f'<span style="margin-left: 8px; padding: 1px 6px; border: 1px solid {RULE}; border-radius: 4px; font-size: 12px; font-weight: 600; color: {G2}; white-space: nowrap">All one way</span>'
                   if c['sameSide'] else '')
            houses = f'{c["n"]} pollster{"s" if c["n"] != 1 else ""}'
            if phone:
                one = f'<span style="font-size: 11px; font-weight: 600; color: {G2}; white-space: nowrap">all one way</span>' if c['sameSide'] else ''
                out.append(f'<div role="row" class="srow" style="display: grid; grid-template-columns: 80px 206px minmax(0, 1fr); align-items: center; min-height: 48px">'
                           f'<span role="rowheader" style="display: flex; flex-direction: column"><span class="num" style="font-size: 15px; font-weight: 600">{c["year"]}</span><span class="num" style="font-size: 11px; color: {G3}; white-space: nowrap">{c["mean"]:.1f} v {c["result"]:.1f}</span></span>'
                           f'<span role="cell">{acc_strip(c, 206, 32, 6, 4)}</span>'
                           f'<span role="cell" class="num" style="display: flex; flex-direction: column; align-items: flex-end"><span style="font-size: 15px; font-weight: 600; color: {col}">{s1(c["err"])}</span>{one}</span></div>')
            else:
                out.append(f'<div role="row" class="srow" style="display: grid; grid-template-columns: {ACOLS}; align-items: center; min-height: 46px">'
                           f'<span role="rowheader" style="padding-left: 12px; display: flex; align-items: baseline; gap: 10px"><span class="num" style="font-size: 16px; font-weight: 600">{c["year"]}</span><span class="num" style="font-size: 13px; color: {G3}">{c["mean"]:.1f} v {c["result"]:.1f}</span></span><span></span>'
                           f'<span role="cell">{acc_strip(c)}</span><span></span>'
                           f'<span role="cell" class="num" style="text-align: right; padding-right: 8px; font-size: 16px; font-weight: 600; color: {col}">{s1(c["err"])}</span>'
                           f'<span role="cell" style="padding-left: 16px; display: flex; align-items: center; font-size: 13px; color: {G2}">{houses}{tag}</span></div>')
    return '\n'.join(out)

def acc_head(phone=False):
    if phone:
        W = 206
        t = (f'<svg viewBox="0 0 {W} 34" width="{W}" height="34" aria-hidden="true" style="display: block; overflow: visible">'
             f'<text class="ax" x="0" y="11" style="font-weight: 600; fill: {LNP}">◀ Understated</text><text class="ax" x="{W}" y="11" style="text-anchor: end; font-weight: 600; fill: {ALP}">Overstated ▶</text>'
             + ''.join(f'<text class="ax num" x="{acc_x(v, W):.1f}" y="29" style="text-anchor: middle{"; font-weight: 600; fill: " + G2 if v == 0 else ""}">{"Result" if v == 0 else s1(v).replace(".0", "")}</text>' for v in (-5, 0, 5))
             + '</svg>')
        return (f'<div style="margin-top: 20px; display: grid; grid-template-columns: 80px 206px minmax(0, 1fr); align-items: end; padding-bottom: 6px; border-bottom: 1px solid {G4}">'
                f'<span class="th" style="font-size: 11px">Year</span>{t}<span class="th" style="font-size: 11px; text-align: right">Miss</span></div>')
    t = (f'<svg viewBox="0 0 {AW} 40" width="{AW}" height="40" aria-hidden="true" style="display: block; overflow: visible">'
         f'<text class="ax" x="{acc_x(-5):.1f}" y="12" style="font-weight: 600; fill: {LNP}">◀ Labor understated</text>'
         f'<text class="ax" x="{acc_x(5):.1f}" y="12" style="text-anchor: end; font-weight: 600; fill: {ALP}">Labor overstated ▶</text>'
         + ''.join(f'<text class="ax num" x="{acc_x(v):.1f}" y="34" style="text-anchor: middle{"; font-weight: 600; fill: " + G2 if v == 0 else ""}">{"Result" if v == 0 else s1(v).replace(".0", "") + (" pts" if abs(v) == 5 else "")}</text>' for v in (-5, -2.5, 0, 2.5, 5))
         + '</svg>')
    return (f'<div style="margin-top: 24px; display: grid; grid-template-columns: {ACOLS}; align-items: end; padding-bottom: 8px; border-bottom: 1px solid {G4}">'
            f'<span class="th" style="padding-left: 12px">Election</span><span></span>{t}<span></span><span class="th" style="text-align: right; padding-right: 8px">Miss</span><span class="th" style="padding-left: 16px">Final polls</span></div>')

def firms_grid(phone=False):
    fs = sorted([f for f in ACC['firms'] if f['n'] > 1], key=lambda f: (f['meanAbs'], -f['n']))
    cols = 2 if phone else 8
    cells = ''.join(f'<div style="padding-top: 8px; border-top: 2px solid {G4}; display: flex; flex-direction: column; gap: 2px">'
                    f'<span style="font-size: {13 if phone else 14}px; font-weight: 600">{f["firm"]}</span>'
                    f'<span class="num" style="font-size: {22 if phone else 24}px; font-weight: 500; letter-spacing: -0.01em">{f["meanAbs"]:.1f}<span style="font-size: 13px; color: {G3}"> pts</span></span>'
                    f'<span style="font-size: 12px; color: {G3}">{f["n"]} elections</span></div>' for f in fs)
    return (f'<div style="display: grid; grid-template-columns: repeat({cols}, minmax(0, 1fr)); column-gap: {16 if phone else 20}px; row-gap: 18px">{cells}</div>')

def acc_key(phone=False):
    items = [key_item(f'<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" style="fill: {G3}; opacity: 0.5"></circle></svg>', 'One pollster’s final poll'),
             key_item(f'<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" style="fill: {G2}"></circle></svg>', 'Their average'),
             key_item(k_dot(ALP, 1, 4.5), 'Overstated Labor'),
             key_item(k_dot(LNP, 1, 4.5), 'Understated Labor'),
             key_item(f'<span style="padding: 1px 6px; border: 1px solid {RULE}; border-radius: 4px; font-size: 12px; font-weight: 600; color: {G2}">All one way</span>', 'Every pollster missed in the same direction')]
    return chart_key(items, phone=phone, top=0 if phone else 0).replace('margin-top: 0px; padding-top: 10px; border-top: 1px solid #DDDCD8; ', 'margin-top: 16px; ' if not phone else 'margin-top: 14px; ')

def d_final():
    H = f'The final polls have missed the result by {ACC["meanAbs"]:.1f} points on average, and not always the same way'
    c25 = next(c for c in ACC['cycles'] if c['year'] == 2025)
    c19 = next(c for c in ACC['cycles'] if c['year'] == 2019)
    Dk = (f'In 2025 all eleven pollsters understated Labor, by {f1(abs(c25["err"]))} points on average; in 2019 all five overstated it. '
          'Because misses run both ways, what carries over to today’s figures is their size, not their direction.')
    spread = ('<button class="chip" aria-pressed="false" style="min-height: 34px; font-size: 13px">'
              '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round"><circle cx="7" cy="12" r="2.4"></circle><circle cx="17" cy="6.5" r="2.4"></circle><circle cx="17" cy="17.5" r="2.4"></circle><path d="M9.6 10.9 14.6 8M9.6 13.1l5 2.9"></path></svg>'
              'Separate overlapping dots</button>')
    cap = cap_row('Labor’s final two-party figure in the polls, minus the result, points', 'how the final polls did', top=32, expand=False).replace('<button class="copy"', spread + '<span style="width: 8px"></span><button class="copy"', 1)
    body = '\n\n'.join([
        kicker('How the final polls did', f'Each pollster’s last two-party figure in the {ACC["windowDays"]} days before polling day, against the result'),
        headline(H, Dk),
        cap,
        acc_head(),
        f'<div role="table" aria-label="Final polls against the result, by election">{acc_rows()}</div>',
        acc_key(),
        f'<h2 style="margin: 48px 0 0; font-family: {SERIF}; font-weight: 700; font-size: 28px; line-height: 1.15">ReachTEL and Galaxy have come closest; Roy Morgan has missed by most</h2>',
        f'<p style="margin: 6px 0 20px; max-width: 880px; font-size: 16px; line-height: 1.5; color: {G2}">Average miss ignoring direction, closest first, for pollsters with more than one election to judge on. A pollster only counts against the elections it published a final poll for, and Roy Morgan’s seventeen are the longest record by far.</p>',
        firms_grid(),
        footer('Exit polls are left out, and a pollster that publishes an undecided-inclusive pair is normalised first, so its arithmetic is not scored as a miss. '
               'Before 1993 Morgan was the only pollster in the field, and its figure is read through the last election’s flows, so the miss folds in drift in the flows too.', '#final-polls-method'),
    ])
    return section(body, sid='final-polls')

# ---------------------------------------------------------------- phone
PH = dict(SW=350, OX=28, OY=30, W=314, H=230, events='numbers', xl='short', phone=True, mean_label=False)
PHONE_CSS = '\n.ax,.axb{font-size:11px}\n.lbl{font-size:12px}'

def p_section(inner, sid=None, first=False):
    return section(inner, w=390, pad=('24px 20px 40px' if first else '32px 20px 40px'), sid=sid)

def p_cap(text, label, top=24, expand=True, extra=''):
    btns = extra + (expand_btn(label + ' chart') if expand else '') + copy_btn(label)
    return (f'<div style="margin-top: {top}px; display: flex; align-items: center; gap: 2px"><span style="flex-grow: 1; font-size: 13px; font-weight: 600; line-height: 1.35">{text}</span>{btns}</div>')

def p_standing():
    out = [f'<div role="table" aria-label="The 2025 term against the same month of every past term" style="margin-top: 8px">']
    for gk in ('votes', 'leaders'):
        G_ = GROUPS[gk]
        out.append(f'<div style="padding: {16 if gk == "votes" else 28}px 0 4px; display: flex; flex-direction: column; gap: 6px">'
                   f'<span style="font-size: 13px; color: {G3}"><b style="font-weight: 600; color: {INK}">{G_["name"]}</b>&#160; {G_["unit"]}, {NOW} months in</span>{strip_axis(gk, 350)}</div>')
        for grp, key, name, subj, colr, href, unit in ROWS:
            if grp != gk:
                continue
            st = standing(key)
            d = st['cur'] - st['mean']
            arrow = '▲' if d >= 0 else '▼'
            word = 'above' if d >= 0 else 'below'
            peer = peer_line(st, key)
            out.append(f'<div role="row" class="srow" style="padding: 10px 0 4px; display: flex; flex-direction: column; gap: 6px">'
                       f'<div style="display: flex; align-items: baseline; gap: 10px"><span role="rowheader" style="flex-grow: 1; font-size: 15px; font-weight: 600; line-height: 1.3">{name}</span>'
                       f'<span role="cell" class="num" style="font-size: 20px; font-weight: 500; color: {colr}">{val_txt(st["cur"], unit)}</span></div>'
                       f'<div style="margin-top: -6px; display: flex; align-items: baseline; gap: 10px; font-size: 13px; color: {G3}"><span style="flex-grow: 1">{subj}</span>'
                       f'<span class="num" style="color: {INK}"><b style="font-weight: 600">{arrow} {f1(abs(d))} {word}</b> average</span></div>'
                       f'{strip_svg(st, gk, colr, SW=350, H=40, phone=True)}'
                       f'<div style="display: flex; align-items: center; gap: 8px"><span class="num" style="flex-grow: 1; font-size: 13px; line-height: 1.4; color: {G2}">'
                       f'<span style="{"font-weight: 600; color: " + INK if st["extreme"] else ""}">{st["rank"]}</span>{" · " + peer if peer else ""}</span>'
                       f'<a class="jump" href="{href}" aria-label="Go to the {name[0].lower() + name[1:]} chart" title="Go to the chart" style="margin: -6px -12px -6px 0">{DOWN_SVG}</a></div></div>')
    out.append('</div>')
    return '\n'.join(out)

def p_overview():
    body = '\n\n'.join([
        kicker('Past cycles', 'The 2025 term against every term since 1972, each lined up on its own election day', phone=True, rule=False),
        headline(H_TOP, D_TOP, phone=True),
        controls(phone=True),
        p_standing(),
        strip_key(phone=True),
        footer(F_TOP, '#cycles-method', phone=True, extra=dl_link().replace('min-height: 44px; display: flex; align-items: center; gap: 8px; font-weight: 500;', 'min-height: 44px; display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500;')),
    ])
    return p_section(body, 'summary', first=True)

def p_key(items):
    return chart_key(items, phone=True).replace('display: flex; flex-direction: column; gap: 8px;', 'display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 14px; row-gap: 8px;')

KEY_BASE = lambda: [key_item(k_band(20), 'Middle half, middle 80%'), key_item(k_mean(20), 'Past-term average'), key_item(k_thin(20), 'Fewer terms this far in')]

def p_tpp():
    st = ALL_TPP
    chart = fan('tpp', **PH, dom=(40, 60), ticks=(40, 45, 50, 55, 60), tick_fmt=lambda t: f'{t}', top_unit='%', ref=50,
                cur_label=('Labor', f1(st['cur'])), aria='The government’s implied two-party share by month since its election: 20 past terms as a band, and Labor this term as a line, now 51.2, 1.9 above the average.')
    body = '\n\n'.join([
        kicker('Two-party preferred', 'Implied, on the flows counted at each term’s opening election', phone=True),
        headline(H_TPP, D_TPP, phone=True),
        p_cap('The government’s two-party share, %', 'two-party preferred'),
        chart.replace('style="display: block', 'style="margin-top: 10px; display: block', 1),
        events_list('tpp', phone=True),
        p_key(KEY_BASE() + [key_item(k_line(ALP, 20), 'Labor this term'), key_item(k_ring(), '2025 election')]),
        f'<div style="margin-top: 6px">{HOW}</div>',
        footer(F_TPP, '#tpp-method', phone=True),
    ])
    return p_section(body, 'two-party-preferred')

def p_primary():
    stg, sto = standing('primary'), standing('oppr')
    cg, co = standing('primary', 'chg'), standing('oppr', 'chg')
    H = 'No opposition has lost as much of its vote this early as the Coalition has'
    Dk = (f'The Coalition is down {f1(-co["cur"])} points since the election, to {f1(sto["cur"])}%; by this stage the average opposition had gained {f1(co["mean"])}. '
          f'Labor is down {f1(-cg["cur"])}, to {f1(stg["cur"])}%. Only Whitlam’s government, in 1974, had lost more by now.')
    kw = dict(PH, dom=(15, 55), ticks=(20, 30, 40, 50), tick_fmt=lambda t: f'{t}', top_unit='%')
    onchk = '<label class="check" style="font-size: 13px; gap: 8px"><input type="checkbox">One Nation this term</label>'
    body = '\n\n'.join([
        kicker('Primary vote', 'First preferences for the governing party and the main opposition', phone=True),
        headline(H, Dk, phone=True),
        p_cap('Government’s primary vote, %', 'government primary vote'),
        fan('primary', **kw, cur_label=('Labor', f1(stg['cur'])), aria='The governing party’s primary vote by month since its election; Labor now 26.8, the lowest of any government at this point.').replace('style="display: block', 'style="margin-top: 10px; display: block', 1),
        p_cap('Opposition’s primary vote, %', 'opposition primary vote', top=28),
        f'<div style="display: flex">{onchk}</div>',
        fan('oppr', **kw, cur_label=('Coalition', f1(sto['cur'])), aria='The main opposition party’s primary vote by month since the election; the Coalition now 21.2, the lowest of any opposition at this point.').replace('style="display: block', 'style="margin-top: 10px; display: block', 1),
        events_list('primary', phone=True),
        p_key(KEY_BASE() + [key_item(k_two(ALP, LNP), 'Labor, the Coalition'), key_item(k_ring(), '2025 election')]),
        footer('Past terms are the governing party and the main opposition party of the day, Labor or the Coalition.', '#primary-method', phone=True),
    ])
    return p_section(body, 'primary-vote')

def p_leaders():
    stn, stp, sto = standing('net'), standing('ppmm'), standing('oppnet')
    H = 'Albanese’s net approval is the second lowest of any prime minister at this point, after Whitlam’s'
    Dk = (f'At {s1(stn["cur"])} he is {f1(stn["mean"] - stn["cur"])} points below the average prime minister {NOW} months in. '
          f'He still leads as preferred PM by {f1(stp["cur"])} points, close to the average, and Taylor, at {s1(sto["cur"])}, rates about as opposition leaders usually do.')
    big = fan('net', **PH, dom=(-40, 60), ticks=(-40, -20, 0, 20, 40, 60), tick_fmt=net_fmt, ref=0, ring=False, cur_label=('Albanese', s1(stn['cur'])),
              aria='Prime ministers’ net approval by month since their election; Albanese now −24.6, second lowest at this point after Whitlam in 1974.')
    kws = dict(PH, events='labels', event_list=['Ley → Taylor'], OY=34)
    ppm = fan('ppmm', **kws, dom=(-20, 50), ticks=(-20, 0, 20, 40), tick_fmt=lead_fmt, ref=0, ring=False,
              cur_label=('over Taylor', s1(stp['cur'])), eras_labels=[('over Ley', 'max', 0, -9, 'middle'), (None, 'end', 0, 0, 'end')],
              aria='The prime minister’s lead as preferred PM by month since the election; Albanese now +12.0, close to the average.')
    opn = fan('oppnet', **kws, dom=(-40, 60), ticks=(-40, -20, 0, 20, 40, 60), tick_fmt=net_fmt, ref=0, ring=False,
              cur_label=('Taylor', s1(sto['cur'])), eras_labels=[('Ley', 'end', 6, 4, 'start'), (None, 'end', 0, 0, 'end')],
              aria='Opposition leaders’ net approval by month since the election; Taylor now −6.9, close to the average.')
    body = '\n\n'.join([
        kicker('Leadership', 'Net approval since 1972, preferred PM since 1984', phone=True),
        headline(H, Dk, phone=True),
        p_cap('Prime minister’s net approval, points', 'prime minister net approval'),
        big.replace('style="display: block', 'style="margin-top: 10px; display: block', 1),
        events_list('net', phone=True),
        '<div style="margin-top: 36px"></div>' + h3('Preferred prime minister', 'The PM’s lead over the opposition leader as better PM. Asked since 1984.', phone=True),
        p_cap('PM’s lead, points', 'preferred prime minister', top=14),
        ppm.replace('style="display: block', 'style="margin-top: 10px; display: block', 1),
        '<div style="margin-top: 36px"></div>' + h3('Opposition leader’s net approval', 'Approve minus disapprove, for whoever led the opposition.', phone=True),
        p_cap('Net approval, points', 'opposition leader net approval', top=14),
        opn.replace('style="display: block', 'style="margin-top: 10px; display: block', 1),
        p_key(KEY_BASE() + [key_item(k_two(ALP, LNP), 'PM, opposition leader')]),
        footer('Where a term changed leader its line follows whoever held the office. Favourability ratings are left out.', '#leaders-method', phone=True),
    ])
    return p_section(body, 'leadership')

def p_final():
    H = f'The final polls have missed the result by {ACC["meanAbs"]:.1f} points on average, and not always the same way'
    c25 = next(c for c in ACC['cycles'] if c['year'] == 2025)
    Dk = (f'In 2025 all eleven pollsters understated Labor, by {f1(abs(c25["err"]))} points on average; in 2019 all five overstated it. '
          'Because misses run both ways, what carries over to today’s figures is their size, not their direction.')
    spread = ('<button class="chip" aria-pressed="false" style="min-height: 34px; padding: 0 12px; font-size: 13px">'
              '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round"><circle cx="7" cy="12" r="2.4"></circle><circle cx="17" cy="6.5" r="2.4"></circle><circle cx="17" cy="17.5" r="2.4"></circle><path d="M9.6 10.9 14.6 8M9.6 13.1l5 2.9"></path></svg>'
              'Separate dots</button>')
    body = '\n\n'.join([
        kicker('How the final polls did', f'Each pollster’s last two-party figure in the {ACC["windowDays"]} days before polling day', phone=True),
        headline(H, Dk, phone=True),
        p_cap('Final polls minus the result, Labor’s two-party share', 'how the final polls did', expand=False),
        f'<div style="margin-top: 6px; display: flex">{spread}</div>',
        acc_head(phone=True),
        f'<div role="table" aria-label="Final polls against the result, by election">{acc_rows(phone=True)}</div>',
        acc_key(phone=True),
        f'<h2 style="margin: 36px 0 0; font-family: {SERIF}; font-weight: 700; font-size: 24px; line-height: 1.15">ReachTEL and Galaxy have come closest; Roy Morgan has missed by most</h2>',
        f'<p style="margin: 6px 0 16px; font-size: 14px; line-height: 1.5; color: {G2}">Average miss ignoring direction, closest first, for pollsters with more than one election to judge on.</p>',
        firms_grid(phone=True),
        footer('Exit polls are left out, and an undecided-inclusive pair is normalised first. Before 1993 Morgan was alone in the field, read through the last election’s flows.', '#final-polls-method', phone=True),
    ])
    return p_section(body, 'final-polls')

# ---------------------------------------------------------------- states
def tip(x, y, title, rows, sub=None, w=210, above=True):
    """The site's readout card, drawn as the Interaction board draws it."""
    h = 34 + 16 * len(rows) + (18 if sub else 0)
    top = y - h - 14 if above else y + 14
    left = x - w / 2
    out = [f'<rect class="tipsh" x="{left + 2:.1f}" y="{top + 2.5:.1f}" width="{w}" height="{h}" rx="10"></rect>',
           f'<rect class="tipbox" x="{left:.1f}" y="{top:.1f}" width="{w}" height="{h}" rx="10" style="fill-opacity: 0.96"></rect>',
           f'<text class="tt" x="{left + 11:.1f}" y="{top + 20:.1f}">{title}</text>']
    for i, (sw, lab, val) in enumerate(rows):
        yy = top + 41 + 16 * i
        if sw:
            out.append(sw.format(x=left + 11, y=yy - 8.5))
        out.append(f'<text class="tl" x="{left + (27 if sw else 11):.1f}" y="{yy:.1f}">{lab}</text><text class="tv num" x="{left + w - 11:.1f}" y="{yy:.1f}" style="text-anchor: end">{val}</text>')
    if sub:
        out.append(f'<text class="ts num" x="{left + 11:.1f}" y="{top + h - 10:.1f}">{sub}</text>')
    return out

SW_SQ = lambda c: '<rect x="{x}" y="{y}" width="9" height="9" rx="2" style="fill: ' + c + '"></rect>'
SW_BAND = '<rect x="{x}" y="{y}" width="9" height="9" rx="2" style="fill: #6B6862; opacity: 0.35"></rect>'

def state_head(n, title, sub):
    return (f'<div style="margin-top: 56px; display: flex; flex-direction: column; gap: 4px"><span style="font-size: 15px; font-weight: 600">{n} · {title}</span>'
            f'<span style="max-width: 760px; font-size: 13px; line-height: 1.5; color: {G3}">{sub}</span></div>')

def mini_tabs(active):
    tabs = [('all', 'All past terms', len(PAST)), ('returned', 'Re-elected', len(RETURNED)), ('ousted', 'Turned out', len(OUSTED))]
    return (f'<div role="group" aria-label="Past terms on the board" style="margin-top: 14px; display: flex; gap: 2px; border-bottom: 1px solid {RULE}">'
            + ''.join(f'<button class="tab" aria-pressed="{"true" if k == active else "false"}" style="font-size: 14px; padding: 0 10px">{lab}<span class="n">{n}</span></button>' for k, lab, n in tabs) + '</div>')

def term_names(y):
    t = TERMS[y]
    return '–'.join(t['netEras']) if len(t['netEras']) > 1 else t['lead']

def picker(drawn=(), off=()):
    order = PAST + [CUR]
    cols = [order[0:7], order[7:14], order[14:21]]
    def item(y):
        t = TERMS[y]
        c = PARTY[t['gov']]
        if t['current']:
            return (f'<span style="display: flex; align-items: center"><span class="term" style="cursor: default"><span style="width: 18px; height: 3px; border-radius: 2px; background: {c}"></span>'
                    f'<span class="num" style="font-weight: 600">{y}</span><span>{term_names(y)}</span><span style="margin-left: auto; padding: 1px 6px; border-radius: 4px; background: {INK}; color: {BG}; font-size: 11px; font-weight: 600">This term</span></span></span>')
        is_off = y in off
        pressed = y in drawn and not is_off
        sw = (f'<span style="width: 18px; height: 3px; border-radius: 2px; background: {c}"></span>' if pressed else
              f'<span style="width: 18px; height: 3px; border-radius: 2px; background: {c}; opacity: {0.18 if is_off else 0.35}"></span>')
        outc = 'Re-elected' if t['outcome'] == 'returned' else 'Turned out'
        col = G4 if is_off else INK
        lab = f'{y} {term_names(y)}'
        state = ('off the board, put it back' if is_off else ('drawn as its own line, return it to the band' if pressed else 'in the band, draw its own line'))
        return (f'<span style="display: flex; align-items: center; gap: 2px"><button class="term" aria-pressed="{"true" if pressed else "false"}" aria-label="{lab} – {state}" style="color: {col}{"; text-decoration: line-through" if is_off else ""}">{sw}'
                f'<span class="num" style="font-weight: 600">{y}</span><span style="flex-grow: 1">{term_names(y)}</span><span style="font-size: 12px; color: {G4 if is_off else G3}; text-decoration: none">{outc}</span></button>'
                f'<button class="tx" title="{"Put " + str(y) + " back on the board" if is_off else "Take " + str(y) + " off the board"}" aria-label="{"Put " + lab + " back on the board" if is_off else "Take " + lab + " off the board"}">{"+" if is_off else "×"}</button></span>')
    grid = ''.join(f'<div style="display: flex; flex-direction: column; gap: 2px">{"".join(item(y) for y in col)}</div>' for col in cols)
    return (f'<div role="dialog" aria-label="Past terms" style="margin-top: 8px; padding: 18px 20px 16px; border: 1px solid #DFDCD7; border-radius: 12px; background: #FEFCF9; '
            f'box-shadow: 0 1px 1.5px rgba(91,79,69,0.12), 0 12px 28px -12px rgba(64,44,26,0.22)">'
            f'<div style="display: flex; align-items: baseline; gap: 16px"><span style="font-size: 15px; font-weight: 600">Past terms</span>'
            f'<span style="font-size: 13px; color: {G3}">{len(PAST) - len(off)} on the board · {len([y for y in drawn if y not in off])} drawn as their own line</span><span style="flex-grow: 1"></span>'
            f'<button class="how" style="font-size: 13px; min-height: 36px">Only the drawn terms</button><button class="how" style="font-size: 13px; min-height: 36px">Clear lines</button>'
            f'<button class="tx" aria-label="Close" style="width: 36px; height: 36px">×</button></div>'
            f'<div style="margin-top: 10px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 20px">{grid}</div>'
            f'<p style="margin: 12px 0 0; padding-top: 10px; border-top: 1px solid {GRIDC}; font-size: 13px; line-height: 1.5; color: {G3}">'
            'Click a term to draw its own line over the band, and again to put it back. The × takes it off the board altogether: out of the band, the average and the download. '
            'With three terms or fewer on the board, the band gives way to the polls under each line.</p></div>')

def controls_board():
    sr, so = standing('tpp', years=RETURNED), standing('tpp', years=OUSTED)
    kw = dict(SW=552, OX=30, OY=16, W=452, H=250, dom=(35, 60), ticks=(35, 40, 45, 50, 55, 60), tick_fmt=lambda t: f'{t}', top_unit='%', ref=50, events=None, xl='short')
    left = (mini_tabs('returned') + cap_row(f'Against the {len(RETURNED)} governments re-elected at their next election', 'two-party preferred', top=14, expand=False)
            + fan('tpp', **kw, years=RETURNED, cur_label=('Labor', f1(sr['cur'])), aria=f'Labor’s two-party share against the governments later re-elected: {f1(sr["cur"])} against their average of {f1(sr["mean"])}.').replace('style="display: block', 'style="margin-top: 6px; display: block', 1))
    right = (mini_tabs('ousted') + cap_row(f'Against the {len(OUSTED)} turned out at their next election', 'two-party preferred', top=14, expand=False)
             + fan('tpp', **kw, years=OUSTED, cur_label=('Labor', f1(so['cur'])), aria=f'Labor’s two-party share against the governments later turned out: {f1(so["cur"])} against their average of {f1(so["mean"])}.').replace('style="display: block', 'style="margin-top: 6px; display: block', 1))
    s1_ = state_head(1, 'Re-elected or turned out', f'Choosing a set re-pools the band, the average and the summary’s ranks around it. Labor’s {f1(sr["cur"])}% sits in the middle of the governments that were re-elected, '
                     f'and above five of the six that went on to lose. The summary’s rank reads “{sr["rank"].lower()}” against the first set and “{so["rank"].lower()}” against the second.')
    # 2: the picker, open
    drawn = (2022, 1996)
    s2_ = state_head(2, 'Choosing terms', 'One button opens every term, in order. A term’s own line is a click; taking it out of the band, the average and the download is the × beside it. The same board governs every chart on the page.')
    ctl2 = controls(open_picker=True, drawn=((2022, ALP, '2022 Albanese'), (1996, LNP, '1996 Howard')))
    # 3: two terms drawn over the band
    st = ALL_TPP
    ch3 = fan('tpp', SW=1152, OX=36, OY=20, W=1010, H=280, dom=(40, 60), ticks=(40, 45, 50, 55, 60), tick_fmt=lambda t: f'{t}', top_unit='%', ref=50, events=None,
              lifted=((2022, ALP, '2022 Albanese'), (1996, LNP, '1996 Howard')), lifted_w=2.25, cur_label=('Labor', f1(st['cur'])),
              aria='The two-party chart with the 2022 and 1996 terms drawn over the band.')
    s3_ = state_head(3, 'Two terms drawn over the band', 'Drawn terms keep their party’s colour and carry their name at the line’s end; a chip for each sits in the controls, with a × to put it back in the band. The band does not move: a drawn term is still one of the terms it is made of.')
    # 4: three terms on the board, so the polls show
    ch4 = fan('net', SW=1152, OX=36, OY=20, W=1010, H=300, dom=(-60, 60), ticks=(-60, -40, -20, 0, 20, 40, 60), tick_fmt=net_fmt, ref=0, events=None, ring=False,
              years=[1974, 1993], lifted=((1974, ALP, '1974 Whitlam–Fraser'), (1993, ALP, '1993 Keating')), lifted_w=1.75, lifted_op=0.75,
              dots=((1974, ALP, 'tri'), (1993, ALP, 'dia'), (2025, ALP, 'circle')), bracket=False, mean_label=False,
              cur_end='2025 Albanese', lab_dy={1974: -6},
              aria='Net approval for three prime ministers only: Whitlam from 1974, Keating from 1993 and Albanese, with every poll under each line.')
    s4_ = state_head(4, 'Three terms or fewer: the polls under the lines', 'Cut the board to three terms and the band gives way to the polls each line is made of. Terms of one party are told apart by shape: circles for this term, triangles and diamonds for the others.')
    key4 = chart_key([key_item(k_line(ALP), 'Monthly average'),
                      key_item('<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="3" style="fill: #B9463F; opacity: 0.5"></circle></svg>', 'A poll this term'),
                      key_item('<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 3.2l3.4 6H3.6z" style="fill: #B9463F; opacity: 0.5"></path></svg>', 'A poll, 1974 term'),
                      key_item('<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 3l3.6 4-3.6 4-3.6-4z" style="fill: #B9463F; opacity: 0.5"></path></svg>', 'A poll, 1993 term')])
    # 5: change since the election
    cg, co = standing('primary', 'chg'), standing('oppr', 'chg')
    kwc = dict(SW=552, OX=30, OY=30, W=452, H=250, dom=(-20, 15), ticks=(-20, -15, -10, -5, 0, 5, 10, 15), tick_fmt=lambda t: 'Result' if t == 0 else s1(t).replace('.0', ''), ref=0, mode='chg', events='numbers', xl='short', ring=False)
    l5 = cap_row('Government’s primary vote, change since the election', 'government primary vote', top=0, expand=False) + fan('primary', **kwc, cur_label=('Labor', s1(cg['cur'])), aria='Change in the government’s primary vote since its election.').replace('style="display: block', 'style="margin-top: 8px; display: block', 1)
    r5 = cap_row('Opposition’s primary vote, change since the election', 'opposition primary vote', top=0, expand=False) + fan('oppr', **kwc, cur_label=('Coalition', s1(co['cur'])), aria='Change in the opposition’s primary vote since the election.').replace('style="display: block', 'style="margin-top: 8px; display: block', 1)
    s5_ = state_head(5, 'Change since the election', f'Every line starts from its own election result. The Coalition’s {s1(co["cur"])} is the largest fall of any opposition by this stage; the average opposition had gained {f1(co["mean"])}. '
                     'The summary’s figures, ranks and averages switch with it.')
    body = '\n\n'.join([
        kicker('Past cycles: the comparison', 'Hover on desktop, tap on touch screens', rule=True),
        headline('One set of controls moves every chart on the page',
                 'The comparison is chosen once, above the summary, and the summary, all six charts and the download follow it. '
                 'Scrolled down, the same controls pin under the site’s bar beside a link to each section.'),
        s1_, '<div style="margin-top: 8px"></div>' + two_col(left, right),
        s2_, ctl2, picker(drawn=drawn, off=(1974,)),
        s3_, controls(drawn=((2022, ALP, '2022 Albanese'), (1996, LNP, '1996 Howard'))).replace('margin-top: 28px', 'margin-top: 14px', 1),
        ch3.replace('style="display: block', 'style="margin-top: 16px; display: block', 1),
        s4_, ch4.replace('style="display: block', 'style="margin-top: 16px; display: block', 1), key4,
        s5_, '<div style="margin-top: 20px"></div>' + two_col(l5, r5), events_list('primary'),
    ])
    return section(body, pad='56px 64px 64px')

PIN_DESK = open(S + 'gen/cycles_pinned_desk.html').read()
PIN_PHONE = open(S + 'gen/cycles_pinned_phone.html').read()
SECTIONS = [('summary', 'Summary'), ('two-party-preferred', 'Two-party preferred'), ('primary-vote', 'Primary vote'), ('leadership', 'Leadership'), ('final-polls', 'Final polls')]

def section_bar(current='primary-vote'):
    CUR_A = ' aria-current="location"'
    CUR_S = '; border-bottom-color: #171717; font-weight: 600; color: #171717'
    links = ''.join(f'<a class="ntab" href="#{k}"{CUR_A if k == current else ""} style="font-size: 14px{CUR_S if k == current else ""}">{lab}</a>' for k, lab in SECTIONS)
    tabs = [('all', 'All 20'), ('returned', 'Re-elected'), ('ousted', 'Turned out')]
    t1 = ''.join(f'<button class="tab" aria-pressed="{"true" if k == "all" else "false"}" style="font-size: 13px; padding: 0 8px">{lab}</button>' for k, lab in tabs)
    t2 = ''.join(f'<button class="tab" aria-pressed="{"true" if k == "abs" else "false"}" style="font-size: 13px; padding: 0 8px">{lab}</button>' for k, lab in (('abs', 'Level'), ('chg', 'Change')))
    return (f'<div style="margin: 0 -64px; padding: 0 64px; display: flex; align-items: center; gap: 20px; background: {BG}; border-bottom: 1px solid {RULE}; box-shadow: 0 6px 18px rgba(23, 23, 23, 0.06)">'
            f'<nav aria-label="Past cycles sections" style="display: flex; gap: 22px">{links}</nav><span style="flex-grow: 1"></span>'
            f'<span class="ctl" style="font-weight: 500; color: {G3}">Compare with</span><div role="group" aria-label="Past terms on the board" style="display: flex">{t1}</div>'
            f'<span style="width: 1px; height: 18px; background: {RULE}"></span><div role="group" aria-label="Measure" style="display: flex">{t2}</div>'
            f'<button class="copy" aria-label="Draw a past term" title="Draw a past term" style="width: 40px; height: 40px">{PLUS_SVG}</button></div>')

def section_bar_phone(current='primary-vote'):
    short = {'summary': 'Summary', 'two-party-preferred': 'Two-party', 'primary-vote': 'Primary', 'leadership': 'Leaders', 'final-polls': 'Final polls'}
    CUR_A = ' aria-current="location"'
    CUR_S = '; border-bottom-color: #171717; font-weight: 600; color: #171717'
    links = ''.join(f'<a class="ntab" href="#{k}"{CUR_A if k == current else ""} style="font-size: 13px{CUR_S if k == current else ""}">{short[k]}</a>' for k, _ in SECTIONS)
    return (f'<div style="margin: 0 -20px; padding: 0 8px 0 20px; display: flex; align-items: center; gap: 8px; background: {BG}; border-bottom: 1px solid {RULE}; box-shadow: 0 6px 16px rgba(23, 23, 23, 0.06)">'
            f'<nav aria-label="Past cycles sections" style="display: flex; gap: 16px; overflow: hidden; flex-grow: 1; -webkit-mask-image: linear-gradient(to right, #000 78%, transparent); mask-image: linear-gradient(to right, #000 78%, transparent)">{links}</nav>'
            f'<button class="chip" aria-haspopup="dialog" style="min-height: 32px; padding: 0 10px; font-size: 12px; flex-shrink: 0">All 20 · Level{CHEV_SVG}</button></div>')

DARK_CSS = """
.dk{background:#1D1915;color:#EEEBE5}
.dk .grid{stroke:#34302C}.dk .base,.dk .even{stroke:#746F6B}.dk .ax{fill:#99948F}.dk .axb{fill:#EEEBE5}
.dk .ev{stroke:#57524C}.dk .evt{fill:#C1BDB7}.dk .evn{fill:#1D1915;stroke:#99948F}.dk .evnt{fill:#C1BDB7}
.dk .mean{stroke:#D8D4CE}.dk .nowl{stroke:#EEEBE5;opacity:0.5}.dk .halo{stroke:#1D1915}.dk .lbl{fill:#C1BDB7}
.dk .srow{border-top-color:#34302C}.dk .th{color:#99948F}.dk .copy{color:#99948F}.dk .jump{color:#C1BDB7}"""

def darken(html):
    for a, b in (('fill: #6B6862; opacity: 0.1"', 'fill: #D8D4CE; opacity: 0.1"'), ('fill: #6B6862; opacity: 0.17"', 'fill: #D8D4CE; opacity: 0.18"'),
                 ('fill: #6B6862; opacity: 0.045"', 'fill: #D8D4CE; opacity: 0.05"'), ('fill: #6B6862; opacity: 0.075"', 'fill: #D8D4CE; opacity: 0.085"'),
                 ('fill: #6B6862; opacity: 0.6"', 'fill: #99948F; opacity: 0.7"'),
                 (ALP, '#E56356'), (LNP, '#589CE6'), (BG, '#1D1915'), (INK, '#EEEBE5'), (T2, '#C1BDB7'), (G2, '#C1BDB7'), (G3, '#99948F'), (GRIDC, '#34302C'), (G4, '#746F6B')):
        html = html.replace(a, b)
    return html

def tok_row(name, light, dark, use):
    sw = lambda c, op: f'<span style="width: 44px; height: 22px; border-radius: 4px; border: 1px solid #DDDCD8; background: linear-gradient({c}, {c}); position: relative; display: inline-block"><span style="position: absolute; inset: 0; border-radius: 3px; background: {c}; opacity: {op}"></span></span>'
    return (f'<span style="padding: 12px 0; border-bottom: 1px solid {GRIDC}; font-family: ui-monospace, monospace; font-size: 13px">{name}</span>'
            f'<span style="padding: 12px 0; border-bottom: 1px solid {GRIDC}; display: flex; align-items: center; gap: 10px">{light}</span>'
            f'<span style="padding: 12px 0; border-bottom: 1px solid {GRIDC}; display: flex; align-items: center; gap: 10px">{dark}</span>'
            f'<span style="padding: 12px 0; border-bottom: 1px solid {GRIDC}; line-height: 1.5">{use}</span>')

def swatch(bg, c, op, border='#DDDCD8'):
    return (f'<span style="width: 44px; height: 24px; border-radius: 4px; border: 1px solid {border}; background: {bg}; display: inline-flex; overflow: hidden">'
            f'<span style="flex-grow: 1; background: {c}; opacity: {op}"></span></span>')

def details_board():
    st = ALL_TPP
    HM = 9
    rowsH, _ = band_rows('tpp')
    rH = next(r for r in rowsH if r['m'] == HM)
    labH = next(p[1] for sg in MET['tpp']['abs']['lines'][str(CUR)] for p in sg['pts'] if p[0] == HM)
    def readout(X, Y, rows):
        x = X(HM)
        out = [f'<path d="M{x:.1f} 0V300" style="stroke: #2B2521; stroke-width: 1; opacity: 0.6"></path>',
               f'<circle cx="{x:.1f}" cy="{Y(labH):.1f}" r="5" style="fill: {ALP}; stroke: {BG}; stroke-width: 2"></circle>',
               f'<circle cx="{x:.1f}" cy="{Y(rH["mean"]):.1f}" r="4" style="fill: {BG}; stroke: {G2}; stroke-width: 1.75"></circle>']
        out += tip(x - 132, Y(labH) + 16, f'{HM} months in',
                   [(SW_SQ(ALP), 'Labor, v Coalition', f1(labH)),
                    (None, 'Past-term average', f1(rH['mean'])),
                    (None, 'Middle half', f'{f1(rH["q1"])}–{f1(rH["q3"])}'),
                    (None, 'Middle 80%', f'{f1(rH["p10"])}–{f1(rH["p90"])}')],
                   sub=f'{rH["n"]} of {len(PAST)} past terms, all polled that month', w=236, above=False)
        return out
    ch = fan('tpp', SW=1152, OX=36, OY=52, W=1010, H=300, dom=(40, 60), ticks=(40, 45, 50, 55, 60), tick_fmt=lambda t: f'{t}', top_unit='%', ref=50,
             readout=readout, cur_label=('Labor', f1(st['cur'])), aria='The two-party chart with the ninth month hovered: Labor 53.2 against the Coalition, and the past terms’ average and ranges that month.')
    # a hovered dot in the summary
    stp = standing('primary')
    gil = next(v for v in stp['vals'] if v[2] == 2010)
    strip = strip_svg(stp, 'votes', ALP)
    pad, SWs = 8, STRIP_W
    gx = pad + (gil[0] - 20) / 40 * (SWs - 2 * pad)
    tipsvg = ''.join(tip(gx, 22, 'Gillard, 2010 term', [(None, f'At {NOW} months', f1(gil[0])), (None, 'Next election', 'Turned out')], w=196))
    strip = strip.replace('</svg>', f'<circle cx="{gx:.1f}" cy="22" r="6" style="fill: none; stroke: {INK}; stroke-width: 1.5"></circle>{tipsvg}</svg>')
    row = standing_table()
    # the final polls: one dot opened
    c25 = next(c for c in ACC['cycles'] if c['year'] == 2025)
    ips = next(h for h in c25['houses'] if h['firm'] == 'Ipsos')
    fx = acc_x(ips['err'])
    fstrip = acc_strip(c25).replace('</svg>', f'<circle cx="{fx:.1f}" cy="20" r="7" style="fill: none; stroke: {INK}; stroke-width: 1.5"></circle>'
                                        + ''.join(tip(fx, 20, 'Ipsos', [(SW_SQ(LNP), 'Poll', f1(ips['alp2pp'])), (None, 'Result', f1(c25['result'])), (None, 'Miss', s1(ips['err']))], sub='1 May 2025 · Labor understated', w=200)) + '</svg>')
    s1_ = state_head(1, 'Scrolled down: the section bar pins under the site’s bar', 'Past the summary, a second row joins the pinned bar: a link to each section, the current one underlined, and the comparison controls, so the band can be changed from any chart. On a phone the links scroll sideways and the controls fold into one button that opens them as a sheet.')
    desk_pin = f'<div style="margin: 16px 0 0; display: flex; flex-direction: column">{PIN_DESK.replace("margin: 0 -64px; padding: 0 64px;", "margin: 0 -64px; padding: 0 64px; box-shadow: none;")}{section_bar()}</div>'
    phone_pin = (f'<div style="margin-top: 28px; width: 390px; box-sizing: border-box; padding: 0 20px 24px; border: 1px solid {RULE}; border-radius: 16px; overflow: hidden; background: {BG}; display: flex; flex-direction: column">'
                 f'{PIN_PHONE.replace("box-shadow: 0 6px 16px rgba(23, 23, 23, 0.06)", "box-shadow: none")}{section_bar_phone()}'
                 f'<div style="margin-top: 18px; display: flex; flex-direction: column; opacity: 0.45" aria-hidden="true">'
                 f'<span style="font-size: 13px; font-weight: 600">Opposition’s primary vote, %</span><span style="margin-top: 60px; height: 1px; background: {GRIDC}"></span><span style="margin-top: 60px; height: 1px; background: {GRIDC}"></span></div></div>')
    phone_note = (f'<div style="margin-top: 28px; display: flex; flex-direction: column; gap: 10px; max-width: 520px; font-size: 14px; line-height: 1.55; color: {G2}">'
                  f'<span style="font-size: 13px; font-weight: 600; color: {INK}">On a phone</span>'
                  f'<span>The site’s bar keeps its three tabs and the score. Beneath it, the section links scroll sideways and the current one is underlined as the reader passes it.</span>'
                  f'<span>“All 20 · Level” is the comparison in words; tapping it opens the same controls as a sheet from the bottom of the screen, with the term list under them.</span></div>')
    s2_ = state_head(2, 'Readouts', 'The site’s readout card, unchanged. On a chart it snaps to the nearest month and lists what the band is made of there; on the summary it names the term behind a dot; on the final polls it gives the poll, the result and the miss.')
    s3_ = state_head(3, 'Dark mode', 'The band replaces the tab’s old purple fill with the warm grey every other interval on the page uses, so it needs one new pair of variables. Everything else is an existing variable.')
    toks = (f'<div style="margin-top: 20px; display: grid; grid-template-columns: 200px 200px 200px minmax(0, 1fr); column-gap: 24px; font-size: 13px; color: {G2}">'
            f'<span class="th" style="padding-bottom: 8px; border-bottom: 1px solid {G4}">Variable</span><span class="th" style="padding-bottom: 8px; border-bottom: 1px solid {G4}">Light</span><span class="th" style="padding-bottom: 8px; border-bottom: 1px solid {G4}">Dark</span><span class="th" style="padding-bottom: 8px; border-bottom: 1px solid {G4}">Used for</span>'
            + tok_row('--band', swatch(BG, BAND, OP_OUT) + swatch(BG, BAND, OP_IN) + '<span>#6B6862 · 10%, 17%</span>',
                      swatch('#1D1915', '#D8D4CE', 0.10, '#403B36') + swatch('#1D1915', '#D8D4CE', 0.18, '#403B36') + '<span>#D8D4CE · 10%, 18%</span>',
                      'The past terms’ middle 80% and middle half, on the charts and in the summary. Replaces --cyc-fill.')
            + tok_row('--band-thin', swatch(BG, BAND, OP_OUT_THIN) + swatch(BG, BAND, OP_IN_THIN) + '<span>4.5%, 7.5%</span>',
                      swatch('#1D1915', '#D8D4CE', 0.05, '#403B36') + swatch('#1D1915', '#D8D4CE', 0.085, '#403B36') + '<span>5%, 8.5%</span>',
                      'The same band where fewer than three-quarters of the terms on the board had run that long.')
            + tok_row('--ink-2', f'<svg width="44" height="10" aria-hidden="true"><path d="M0 5H44" style="stroke: {G2}; stroke-width: 1.75; stroke-dasharray: 4 3"></path></svg><span>existing</span>',
                      '<svg width="44" height="10" aria-hidden="true"><path d="M0 5H44" style="stroke: #D8D4CE; stroke-width: 1.75; stroke-dasharray: 4 3"></path></svg><span>existing</span>',
                      'The past-term average, dashed; the same variable the tab’s mean line uses now.')
            + tok_row('--ink at 55%', f'<svg width="44" height="22" aria-hidden="true"><path d="M22 0V22" style="stroke: {INK}; stroke-width: 1; opacity: 0.55"></path></svg><span>existing</span>',
                      '<svg width="44" height="22" aria-hidden="true"><path d="M22 0V22" style="stroke: #EEEBE5; stroke-width: 1; opacity: 0.5"></path></svg><span>existing</span>',
                      'The “Now” line every chart shares.')
            + '</div>')
    dch = fan('tpp', SW=1152, OX=36, OY=52, W=1010, H=260, dom=(40, 60), ticks=(40, 45, 50, 55, 60), tick_fmt=lambda t: f'{t}', top_unit='%', ref=50,
              cur_label=('Labor', f1(st['cur'])), aria='The two-party chart in dark mode.')
    dark = (f'<div class="dk" style="margin: 28px -64px 0; padding: 40px 64px 48px; display: flex; flex-direction: column">'
            f'<span style="font-size: 13px; font-weight: 600">The government’s two-party share, %, by months since its election</span>'
            + darken(dch).replace('style="display: block', 'style="margin-top: 8px; display: block', 1)
            + f'<div style="margin-top: 36px">{darken(standing_table().replace(chr(10), ""))}</div></div>')
    body = '\n\n'.join([
        kicker('Past cycles: getting around', 'The pinned section bar, the readouts, and the new colours’ dark twins', rule=True),
        headline('Every section is one tap away, wherever the reader is on the page',
                 'The summary links down to each chart, the pinned bar links across between them, and the comparison travels with the reader, so nobody has to scroll back to the top to change it.'),
        s1_, desk_pin,
        f'<div style="display: flex; gap: 48px; align-items: flex-start">{phone_pin}{phone_note}</div>',
        s2_, cap_row('On a chart: the month under the pointer', 'two-party preferred', top=20, expand=False),
        ch.replace('style="display: block', 'style="margin-top: 8px; display: block', 1),
        f'<div style="margin-top: 24px; display: grid; grid-template-columns: {STRIP_W}px minmax(0, 1fr); column-gap: 64px; align-items: start">'
        f'<div style="display: flex; flex-direction: column; gap: 10px"><span style="font-size: 13px; font-weight: 600">On the summary: a past term’s dot</span><div style="margin-top: 96px">{strip}</div></div>'
        f'<div style="display: flex; flex-direction: column; gap: 10px"><span style="font-size: 13px; font-weight: 600">On the final polls: one pollster’s dot</span><div style="margin-top: 110px">{fstrip}</div></div></div>',
        s3_, toks, dark,
    ])
    return section(body, pad='56px 64px 0')

BOARDS = {}

def board(name, title, w, parts, css=''):
    h = HEIGHTS.get(name, 3000)
    open(OUT + name + '.dc.html', 'w').write(page(title, w, h, '\n'.join(parts), css))
    BOARDS[name] = dict(w=w, h=h, title=title)
    print(name, w, h)

def build():
    board('PastCyclesDesktop1', 'Past cycles page – desktop, 1 of 2', 1280, [MAST_DESK, d_overview(), d_tpp()])
    board('PastCyclesDesktop2', 'Past cycles page – desktop, 2 of 2', 1280, [d_primary(), d_leaders(), d_final()])
    board('PastCyclesPhone1', 'Past cycles page – phone, 1 of 3', 390, [MAST_PHONE, p_overview(), p_tpp()], PHONE_CSS)
    board('PastCyclesPhone2', 'Past cycles page – phone, 2 of 3', 390, [p_primary(), p_leaders()], PHONE_CSS)
    board('PastCyclesPhone3', 'Past cycles page – phone, 3 of 3', 390, [p_final()], PHONE_CSS)
    board('PastCyclesControls', 'Past cycles – the comparison controls', 1280, [controls_board()])
    board('PastCyclesDetails', 'Past cycles – section bar, readouts, dark mode', 1280, [details_board()], DARK_CSS)



# ---------------------------------------------------------------- the canvas index
def merge_canvas(path):
    """Adds the Past cycles page to a canvas.json read back from the canvas: its own page,
    the page desktop and phone boards stacked as the Snapshot page's are, the two state
    boards beside them, and a title over each column. Everything else is kept as read."""
    c = json.load(open(path))
    if not any(p['id'] == 'cycles' for p in c.get('pages', [])):
        c.setdefault('pages', []).append({'id': 'cycles', 'name': 'Past cycles'})
    H = lambda n: HEIGHTS[n]
    layout = []
    y = 0
    for n in ('PastCyclesDesktop1', 'PastCyclesDesktop2'):
        layout.append((n, 0, y)); y += H(n) + 120
    y = 0
    for n in ('PastCyclesPhone1', 'PastCyclesPhone2', 'PastCyclesPhone3'):
        layout.append((n, 1360, y)); y += H(n) + 120
    y = 0
    for n in ('PastCyclesControls', 'PastCyclesDetails'):
        layout.append((n, 1830, y)); y += H(n) + 120
    titles = {
        'PastCyclesDesktop1': 'Past cycles page – desktop, 1 of 2', 'PastCyclesDesktop2': 'Past cycles page – desktop, 2 of 2',
        'PastCyclesPhone1': 'Past cycles page – phone, 1 of 3', 'PastCyclesPhone2': 'Past cycles page – phone, 2 of 3',
        'PastCyclesPhone3': 'Past cycles page – phone, 3 of 3',
        'PastCyclesControls': 'Past cycles – the comparison: re-elected or turned out, the term picker, drawn terms, polls, change',
        'PastCyclesDetails': 'Past cycles – the pinned section bar, readouts, dark mode',
    }
    for n, x, y in layout:
        w = 390 if 'Phone' in n else 1280
        c['boards'][n + '.dc.html'] = {'h': H(n), 'page': 'cycles', 'title': titles[n], 'w': w, 'x': x, 'y': y}
        if n + '.dc.html' not in c['order']:
            c['order'].append(n + '.dc.html')
    c['notes']['c1'] = {'kind': 'title1', 'maxW': 1750, 'page': 'cycles', 'text': 'The Past cycles page, top to bottom', 'w': 240, 'x': 0, 'y': -260}
    c['notes']['c2'] = {'kind': 'title1', 'maxW': 1280, 'page': 'cycles', 'text': 'How it moves', 'w': 240, 'x': 1830, 'y': -260}
    json.dump(c, open(path, 'w'), indent=2, ensure_ascii=False)
    open(path, 'a').write('\n')
    print('canvas index:', len(c['boards']), 'boards,', len(c['pages']), 'pages')

if __name__ == '__main__':
    import sys
    build()
    if '--canvas' in sys.argv:
        merge_canvas(sys.argv[sys.argv.index('--canvas') + 1])
