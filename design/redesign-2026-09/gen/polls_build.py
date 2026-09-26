import datetime as dt
import os
S = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
OUT = S + 'canvas/project/'
ALP, LNP, ONP, ONPT, GRN, GRNT, OTHT = '#B9463F', '#356697', '#CC7C37', '#9E5200', '#439458', '#287C42', '#70675E'
INK, G2, G3, G4 = '#171717', '#4A4843', '#6B6862', '#9A968E'

COPY_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round"><rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4"></path></svg>'

HELMET = '''<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Crimson+Text:wght@600;700&amp;family=IBM+Plex+Sans:wght@400;500;600&amp;display=swap" rel="stylesheet">
<style>
body{margin:0;background:#FAF9F6;color:#171717;font-family:"IBM Plex Sans",system-ui,sans-serif}
a{color:#171717;text-decoration:none}a:hover{text-decoration:underline;text-underline-offset:3px}
button{font:inherit;cursor:pointer}
.num{font-variant-numeric:tabular-nums}
svg text{font-family:"IBM Plex Sans",system-ui,sans-serif}
.tab{min-height:44px;padding:0 12px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:transparent;font-size:15px;color:#6B6862;white-space:nowrap}
.tab[aria-pressed="true"]{border-bottom-color:#171717;font-weight:600;color:#171717}
.tab:hover{color:#171717}
.th{font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#6B6862;white-space:nowrap}
.sortb{padding:0;border:0;background:none;display:inline-flex;align-items:center;gap:4px;min-height:32px}
.row{border-top:1px solid #E6E4DF;cursor:pointer}
.row:hover{background:#F5F3EE}
.row[aria-expanded="true"]{background:#F1EFEA;border-top-color:transparent}
.firm{font-size:15px;font-weight:600;color:#171717}
.ext{font-size:10px;color:#9A968E;margin-left:3px}
.sub{font-size:12px;line-height:1.45;color:#6B6862}
.chev{width:40px;height:44px;padding:0;border:0;background:none;color:#6B6862;display:flex;align-items:center;justify-content:center}
.link{min-height:36px;padding:0;border:0;background:none;display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:500;color:#171717}
.qbtn{width:44px;height:44px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:8px;background:transparent}
.qbtn span{width:20px;height:20px;box-sizing:border-box;border-radius:10px;border:1.5px solid #6B6862;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:#4A4843}
.swap{min-height:44px;padding:0 4px;border:0;background:none;display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:600;color:#171717}
.copy{width:44px;height:44px;flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:8px;background:transparent;color:#6B6862;cursor:pointer}
.copy:hover{background:#EFEDE8;color:#171717}
.row:focus-visible,.tab:focus-visible,.chev:focus-visible,.sortb:focus-visible,.swap:focus-visible,.qbtn:focus-visible,.copy:focus-visible,.link:focus-visible{outline:2px solid #171717;outline-offset:2px}
.ax{font-size:11px;fill:#6B6862}
.key{display:inline-flex;align-items:center;gap:6px}
</style>
</helmet>'''

def page(title, w, h, body):
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

D = lambda s: dt.date.fromisoformat(s)
T0, T1, TODAY = D('2026-08-15'), D('2026-10-25'), D('2026-09-26')

P = [  # pollster, outlet, cadence, waves, latest pub, fieldwork, sample, alpON, chg, chg_since, primaries, past pubs, next list, next label, next sub, alt, window, url
    dict(f='YouGov', out='News24', cad='Fortnightly', waves=23, pub='2026-09-23', field='15–21 Sep', n='1,500', a=51.4, chg=1.6, since='8 Sep',
         p=(26, 21, 14, 27, 12), past=['2026-08-26', '2026-09-09', '2026-09-23'], nxt=['2026-10-07', '2026-10-21'],
         nd='Wed 7 Oct', ns='in 11 days · 5 or 6 am'),
    dict(f='Roy Morgan', out='Self-published', cad='Weekly', waves=47, pub='2026-09-21', field='14–20 Sep', n='1,561', a=52.2, chg=-0.4, since='13 Sep',
         p=(25, 21.5, 15.5, 25.5, 12.5), past=['2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21'], nxt=['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19'],
         nd='Mon 28 Sep', ns='in 2 days · about 4 pm'),
    dict(f='Newspoll', out='The Australian', cad='Every 3 weeks', waves=18, pub='2026-09-20', field='14–17 Sep', n='1,244', a=50.4, chg=-0.9, since='28 Aug',
         p=(27, 19, 13, 30, 11), past=['2026-08-30', '2026-09-20'], nxt=['2026-10-11'], alt='2026-10-18',
         nd='Sun 11 Oct', ns='in 15 days · or 18 Oct'),
    dict(f='DemosAU', out='Capital Brief', cad='Monthly', waves=10, pub='2026-09-17', field='10–14 Sep', n='1,583', a=52.8, chg=1.4, since='20 Aug',
         p=(28, 20, 13, 26, 13), past=['2026-08-24', '2026-09-17'], nxt=[], window=('2026-10-09', '2026-10-27'),
         nd='9–27 Oct', ns='window opens in 13 days'),
    dict(f='Resolve', out='SMH / Age', cad='Monthly', waves=16, pub='2026-09-13', field='12 Sep', n='2,250', a=50.1, chg=-1.7, since='15 Aug',
         p=(28, 24, 11, 27, 9), past=['2026-08-16', '2026-09-13'], nxt=['2026-10-11'], alt='2026-10-18',
         nd='Sun 11 Oct', ns='in 15 days · or 18 Oct'),
    dict(f='Essential', out='The Guardian', cad='Monthly', waves=12, pub='2026-09-02', field='26–31 Aug', n='1,017', a=51.6, chg=0.2, since='29 Jun',
         p=(26, 26, 13, 23, 11), past=['2026-09-02'], nxt=['2026-09-30'], alt='2026-10-07',
         nd='Wed 30 Sep', ns='in 4 days · or 7 Oct'),
    dict(f='RedBridge/Accent', out='AFR', cad='Monthly', waves=15, pub='2026-08-30', field='24–28 Aug', n='1,006', a=51.4, chg=2.3, since='30 Jul',
         p=(29, 22, 12, 28, 9), past=['2026-08-30'], nxt=['2026-09-27'],
         nd='Sun 27 Sep', ns='tomorrow · 6 or 8 pm', soon=True),
    dict(f='Spectre Strategy', out='Self-published', cad='Irregular', waves=4, pub='2026-07-27', field='11–23 Jul', n='1,434', a=51.8, chg=0.3, since='19 Apr',
         p=(28, 23, 12, 26, 11), past=[], before='27 Jul', nxt=[], after='Dec',
         nd='About 10 Dec', ns='give or take 18 days', stale=True),
]

def pubday(s):
    d = D(s)
    return f'{d.day} {d.strftime("%b")}'

# ---------------------------------------------------------------- timeline
def timeline(r, W=392, H=64, pad=10, today_label=False, phone=False):
    k = (W - 2 * pad) / (T1 - T0).days
    X = lambda s: pad + (D(s) - T0).days * k
    cy = H / 2
    g = []
    ticks = ['2026-08-17', '2026-08-31', '2026-09-14', '2026-09-28', '2026-10-12']
    g.append('<path d="' + ''.join(f'M{X(t):.1f} 8V{H - 8}' for t in ticks) + '" style="stroke: #EFEDE8; stroke-width: 1"></path>')
    g.append(f'<path d="M{X("2026-09-26"):.1f} 4V{H - 4}" style="stroke: #171717; stroke-width: 1"></path>')
    g.append(f'<path d="M{pad} {cy}H{W - pad}" style="stroke: #E6E4DF; stroke-width: 1"></path>')
    if r.get('window'):
        a, b = r['window']
        xb = min(X(b), W - pad)
        g.append(f'<rect x="{X(a):.1f}" y="{cy - 5}" width="{xb - X(a):.1f}" height="10" rx="5" style="fill: none; stroke: #171717; stroke-width: 1.5; stroke-dasharray: 3 2"></rect>')
    if r.get('alt') and r['nxt']:
        g.append(f'<path d="M{X(r["nxt"][0]):.1f} {cy}H{X(r["alt"]):.1f}" style="stroke: #C9C6BF; stroke-width: 6; stroke-linecap: round"></path>')
        g.append(f'<circle cx="{X(r["alt"]):.1f}" cy="{cy}" r="3.5" style="fill: #FAF9F6; stroke: #9A968E; stroke-width: 1.5"></circle>')
    for i, s in enumerate(r['past']):
        last = s == r['pub']
        g.append(f'<circle cx="{X(s):.1f}" cy="{cy}" r="{5.5 if last else 3.5}" style="fill: {"#171717" if last else "#9A968E"}"></circle>')
    for i, s in enumerate(r['nxt']):
        first = i == 0
        g.append(f'<circle cx="{X(s):.1f}" cy="{cy}" r="{5.5 if first else 3.5}" style="fill: #FAF9F6; stroke: {"#171717" if first else "#9A968E"}; stroke-width: {2 if first else 1.5}"></circle>')
    if r.get('before'):
        g.append(f'<text class="ax" x="{pad}" y="{cy - 9}">◂ {r["before"]}</text><circle cx="{pad}" cy="{cy}" r="3.5" style="fill: #171717"></circle>')
    if r.get('after'):
        g.append(f'<text class="ax" x="{W - pad}" y="{cy - 9}" style="text-anchor: end">{r["after"]} ▸</text><circle cx="{W - pad}" cy="{cy}" r="4.5" style="fill: #FAF9F6; stroke: #171717; stroke-width: 2"></circle>')
    nxt = r['nd'] + (', ' + r['ns'].split(' · ')[0] if r['nxt'] or r.get('window') else '')
    aria = f"{r['f']}: last published {pubday(r['pub'])}; next expected {r['nd']}, {r['ns']}"
    return (f'<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{aria}" style="display: block; overflow: visible">' + ''.join(g) + '</svg>')

def axis(W=392, pad=10, phone=False):
    k = (W - 2 * pad) / (T1 - T0).days
    X = lambda s: pad + (D(s) - T0).days * k
    labs = [('2026-08-17', '17 Aug'), ('2026-08-31', '31 Aug'), ('2026-09-14', '14 Sep'), ('2026-10-12', '12 Oct')] if not phone else [('2026-08-17', '17 Aug'), ('2026-09-14', '14 Sep'), ('2026-10-12', '12 Oct')]
    g = ''.join(f'<text class="ax" x="{X(s):.1f}" y="30" style="text-anchor: middle">{t}</text>' for s, t in labs)
    g += f'<text x="{X("2026-09-26"):.1f}" y="30" style="font-size: 11px; font-weight: 600; fill: #171717; text-anchor: middle">Today</text>'
    return f'<svg viewBox="0 0 {W} 36" width="{W}" height="36" aria-hidden="true" style="display: block; overflow: visible">{g}</svg>'

# ---------------------------------------------------------------- cells
def fig_tpp(r, big=15):
    lead = 2 * r['a'] - 100
    arrow = '▲' if r['chg'] > 0 else '▼'
    return (f'<span style="display: flex; flex-direction: column; gap: 2px"><span class="num" style="font-size: {big}px; font-weight: 600">'
            f'<span style="color: {ALP}">{r["a"]:.1f}</span><span style="color: #9A968E; font-weight: 400"> – </span><span style="color: {ONPT}">{100 - r["a"]:.1f}</span>'
            f'<span style="margin-left: 8px; font-size: 13px; color: {ALP}">ALP +{lead:.1f}</span></span>'
            f'<span class="sub num">Labor {arrow} {abs(r["chg"]):.1f} since its {r["since"]} poll</span></span>')

PRIM = [('ALP', ALP), ('L/NP', LNP), ('GRN', GRNT), ('ON', ONPT), ('OTH', OTHT)]
def fig_prim(r):
    cells = ''.join(f'<span class="num" style="width: 38px; font-size: 15px; font-weight: 600; color: {c}">{v:g}</span>' for (lab, c), v in zip(PRIM, r['p']))
    return f'<span style="display: flex">{cells}</span>'

COLS = '190px 128px 214px 392px 188px 40px'

def header_row(facet='tpp'):
    fig_head = ('<span class="th">Labor v One Nation</span>' if facet == 'tpp' else
                '<span style="display: flex">' + ''.join(f'<span class="th" style="width: 38px; color: {c}">{lab}</span>' for lab, c in PRIM) + '</span>')
    return (f'<div style="display: grid; grid-template-columns: {COLS}; align-items: end; padding-bottom: 6px; border-bottom: 1px solid #9A968E">'
            f'<span class="th" style="padding-left: 12px">Pollster</span>'
            f'<button class="sortb th" aria-label="Sorted by latest, newest first">Latest <span aria-hidden="true">▾</span></button>'
            f'{fig_head}'
            f'<span style="display: flex; flex-direction: column"><span class="th">Releases · next</span>{axis()}</span>'
            f'<span class="th">Next, at the earliest</span><span></span></div>')

def data_row(r, facet='tpp', expanded=False):
    stale = r.get('stale')
    op = ' opacity: 0.6;' if stale else ''
    firm = f'<a class="firm" href="#{r["f"].lower()}" target="_blank" rel="noopener">{r["f"]}<span class="ext" aria-hidden="true">↗</span></a>'
    latest = (f'<span style="display: flex; flex-direction: column; gap: 2px"><span class="num" style="font-size: 15px; font-weight: 600">{pubday(r["pub"])}</span>'
              f'<span class="sub num">{r["field"]} · {r["n"]}</span></span>')
    fig = fig_tpp(r) if facet == 'tpp' else fig_prim(r)
    nxt = (f'<span style="display: flex; flex-direction: column; gap: 2px"><span class="num" style="font-size: 14px; font-weight: 600">{r["nd"]}</span>'
           f'<span class="sub">{r["ns"]}</span></span>')
    chev = f'<button class="chev" aria-label="{"Hide" if expanded else "Show"} this poll and {r["f"]}’s release history" aria-expanded="{"true" if expanded else "false"}"><span aria-hidden="true" style="display: inline-block; transform: rotate({90 if expanded else 0}deg)">▸</span></button>'
    return (f'<div class="row" role="row" aria-expanded="{"true" if expanded else "false"}" style="display: grid; grid-template-columns: {COLS}; align-items: center; min-height: 64px;{op}">'
            f'<span style="padding-left: 12px; display: flex; flex-direction: column; gap: 2px">{firm}<span class="sub">{r["out"]} · {r["cad"].lower()}{" · no poll in six weeks" if stale else ""}</span></span>'
            f'{latest}{fig}{timeline(r)}{nxt}{chev}</div>')

def controls(facet='tpp'):
    tabs = ''.join(f'<button class="tab" aria-pressed="{"true" if f == facet else "false"}">{lab}</button>' for f, lab in (('tpp', '2PP'), ('prim', 'Primary'), ('lead', 'Leadership')))
    right = ('<span style="font-size: 14px; color: #6B6862">Two-party:</span><button class="swap" title="Switch the page to Labor v Coalition">Labor v One Nation <span aria-hidden="true" style="color: #6B6862">⇄</span></button>'
             '<span style="font-size: 14px; color: #6B6862">· implied flows</span><button class="qbtn" aria-label="How the two-party figures are counted, and the pollsters’ published figures"><span>?</span></button>') if facet == 'tpp' else ''
    return (f'<div style="margin-top: 20px; display: flex; align-items: center; gap: 6px; border-bottom: 1px solid #DDDCD8">'
            f'<div role="group" aria-label="Figures" style="display: flex; gap: 4px">{tabs}</div><span style="flex-grow: 1"></span>{right}</div>')

KEY = (f'<div style="margin-top: 14px; display: flex; flex-wrap: wrap; align-items: center; column-gap: 22px; row-gap: 6px; font-size: 13px; color: #4A4843">'
       f'<span class="key"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5" style="fill: #171717"></circle></svg>Latest release</span>'
       f'<span class="key"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3.5" style="fill: #9A968E"></circle></svg>Earlier releases</span>'
       f'<span class="key"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5" style="fill: #FAF9F6; stroke: #171717; stroke-width: 2"></circle></svg>Next, at the earliest</span>'
       f'<span class="key"><svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true"><path d="M4 6H20" style="stroke: #C9C6BF; stroke-width: 6; stroke-linecap: round"></path><circle cx="21" cy="6" r="3.5" style="fill: #FAF9F6; stroke: #9A968E; stroke-width: 1.5"></circle></svg>Or a week later</span>'
       f'<span class="key"><svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true"><rect x="1" y="1" width="24" height="10" rx="5" style="fill: none; stroke: #171717; stroke-width: 1.5; stroke-dasharray: 3 2"></rect></svg>Window, for irregular pollsters</span></div>')

HEAD = ('<h2 style="margin: 0; font-family: \'Crimson Text\', Georgia, serif; font-weight: 700; font-size: 30px; line-height: 1.15">Latest polls, and when the next are due</h2>\n'
        '<p style="margin: 6px 0 0; max-width: 900px; font-size: 15px; line-height: 1.5; color: #4A4843">The newest poll from each pollster, and the earliest its next could land, projected from its recent rhythm. '
        'Open a row for the full poll and the releases behind the projection.</p>')

FOOT = ('<p style="margin: 16px 0 0; max-width: 960px; font-size: 13px; line-height: 1.55; color: #6B6862">Projections read each pollster’s last eight gaps between releases: they mark the earliest a poll could land, not the likeliest. '
        'A pollster that misses its slot shows as overdue until the release is added. Spectre Strategy has not published in six weeks, so its poll is outside the averages.</p>')

desk = '\n\n'.join([
    HEAD,
    controls('tpp'),
    '<div role="table" aria-label="Latest poll and next expected poll from each pollster" style="margin-top: 16px; display: flex; flex-direction: column">\n'
    + header_row('tpp') + '\n' + '\n'.join(data_row(r) for r in P) + '\n</div>',
    KEY,
    FOOT,
])
open(OUT + 'Polls.dc.html', 'w').write(page('Latest and next polls', 1280, 1000, desk))

# ================================================================ other states: expanded row, primary facet
def detail_yougov():
    r = P[0]
    hist = [('28 Jul', 'Wed 29 Jul', '14 days'), ('10 Aug', 'Wed 12 Aug', '14 days'), ('24 Aug', 'Wed 26 Aug', '14 days'), ('8 Sep', 'Wed 9 Sep', '14 days'), ('21 Sep', 'Wed 23 Sep', '14 days')]
    prim = ''.join(f'<span style="display: flex; flex-direction: column; gap: 2px; width: 56px"><span class="th" style="color: {c}">{lab}</span><span class="num" style="font-size: 18px; font-weight: 600; color: {c}">{v:g}</span></span>' for (lab, c), v in zip(PRIM, r['p']))
    return f'''<div style="padding: 20px 12px 20px 12px; background: #F1EFEA; border-radius: 0 0 8px 8px; display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); column-gap: 48px">
<div style="display: flex; flex-direction: column; gap: 14px">
<span class="th">This poll · fieldwork 15–21 Sep · 1,500 voters · News24, Wed 23 Sep</span>
<div style="display: flex">{prim}</div>
<div class="num" style="display: grid; grid-template-columns: 200px 1fr; row-gap: 6px; font-size: 14px; color: #3D3B37">
<span style="color: #6B6862">Two-party, implied</span><span>Labor 51.4 – 48.6 One Nation · Labor 51.8 – 48.2 Coalition</span>
<span style="color: #6B6862">As published</span><span>Labor 55 – 45 One Nation</span>
<span style="color: #6B6862">Preferred prime minister</span><span>Albanese 41 · Taylor 37</span>
<span style="color: #6B6862">Net approval</span><span>Albanese −29 · Taylor −12</span>
</div>
<div style="display: flex; align-items: center; gap: 16px"><button class="link">Open in All polls <span aria-hidden="true">→</span></button><button class="link">Read the release <span aria-hidden="true" style="font-size: 11px; color: #9A968E">↗</span></button><span style="flex-grow: 1"></span><button class="copy" aria-label="Copy this poll" title="Copy this poll">{COPY_SVG}</button></div>
</div>
<div style="display: flex; flex-direction: column; gap: 10px">
<span class="th">YouGov’s rhythm · last five releases</span>
<div class="num" style="display: grid; grid-template-columns: 90px 120px 1fr; row-gap: 6px; font-size: 14px; color: #3D3B37">
<span class="sub">Field to</span><span class="sub">Published</span><span class="sub">Gap</span>
{''.join(f'<span>{a}</span><span>{b}</span><span style="color: #6B6862">{c}</span>' for a, b, c in hist)}
</div>
<p style="margin: 2px 0 0; font-size: 13px; line-height: 1.5; color: #4A4843">Median 14 days between publications across the last 8 gaps. <b style="font-weight: 600; color: #171717">Next: Wed 7 Oct, 5 or 6 am AEDT</b>, at the earliest; then Wed 21 Oct.</p>
</div>
</div>'''

def panel_head(tag, title, note):
    return (f'<div style="display: flex; align-items: baseline; gap: 12px">'
            f'<span style="padding: 2px 8px; border-radius: 4px; background: #EFEDE8; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; color: #4A4843">{tag}</span>'
            f'<h2 style="margin: 0; font-family: \'Crimson Text\', Georgia, serif; font-weight: 700; font-size: 26px; line-height: 1.15">{title}</h2></div>'
            f'<p style="margin: 6px 0 0; max-width: 900px; font-size: 15px; line-height: 1.5; color: #4A4843">{note}</p>')

views = '\n\n'.join([
    panel_head('A', 'A row opened', 'The poll in full on the left; on the right, the releases the projection is built from. Copy, and the links to All polls and the release, sit with the poll.'),
    '<div style="margin-top: 16px; display: flex; flex-direction: column">' + header_row('tpp') + data_row(P[0], expanded=True) + detail_yougov() + data_row(P[1]) + '</div>',
    '<div style="margin-top: 56px"></div>' + panel_head('B', 'Primary', 'The figures column swaps to the five primaries; everything about timing stays put, so switching views never moves a pollster’s row.'),
    controls('prim'),
    '<div style="margin-top: 16px; display: flex; flex-direction: column">' + header_row('prim') + '\n'.join(data_row(r, 'prim') for r in P) + '</div>',
])
open(OUT + 'PollsViews.dc.html', 'w').write(page('Latest and next polls – other states', 1280, 1540, views))

# ================================================================ phone
def card(r):
    stale = r.get('stale')
    lead = 2 * r['a'] - 100
    arrow = '▲' if r['chg'] > 0 else '▼'
    return f'''<div class="row" role="row" aria-expanded="false" style="padding: 12px 0 10px; display: flex; flex-direction: column; gap: 4px{'; opacity: 0.6' if stale else ''}">
<div style="display: flex; align-items: baseline; gap: 8px"><a class="firm" href="#{r["f"].lower()}" target="_blank" rel="noopener">{r["f"]}<span class="ext" aria-hidden="true">↗</span></a><span style="flex-grow: 1"></span>
<span class="num" style="font-size: 15px; font-weight: 600"><span style="color: {ALP}">{r["a"]:.1f}</span><span style="color: #9A968E; font-weight: 400">–</span><span style="color: {ONPT}">{100 - r["a"]:.1f}</span></span></div>
<div style="display: flex; align-items: baseline; gap: 8px"><span class="sub">{r["out"]} · {r["cad"].lower()}</span><span style="flex-grow: 1"></span><span class="sub num" style="color: {ALP}; font-weight: 600">ALP +{lead:.1f}</span><span class="sub num">{arrow} {abs(r["chg"]):.1f}</span></div>
{timeline(r, 350, 40, 6)}
<div class="num" style="display: flex; gap: 8px; font-size: 12px; line-height: 1.4; color: #4A4843"><span><b style="font-weight: 600; color: #171717">{pubday(r["pub"])}</b> · {r["field"]}</span><span style="flex-grow: 1"></span><span style="text-align: right">Next <b style="font-weight: 600; color: #171717">{r["nd"]}</b> · {r["ns"].split(" · ")[0]}</span></div>
</div>'''

phone = '\n\n'.join([
    '<h2 style="margin: 0; font-family: \'Crimson Text\', Georgia, serif; font-weight: 700; font-size: 26px; line-height: 1.15">Latest polls, and when the next are due</h2>',
    '<p style="margin: 6px 0 0; font-size: 14px; line-height: 1.5; color: #4A4843">The newest poll from each pollster, and the earliest its next could land. Tap a pollster for the full poll.</p>',
    '<div role="group" aria-label="Figures" style="margin-top: 14px; display: flex; border-bottom: 1px solid #DDDCD8">'
    + ''.join(f'<button class="tab" aria-pressed="{"true" if i == 0 else "false"}" style="flex: 1">{l}</button>' for i, l in enumerate(['2PP', 'Primary', 'Leaders'])) + '</div>',
    '<div style="display: flex; align-items: center; gap: 4px; font-size: 13px; color: #6B6862"><button class="swap" style="font-size: 13px">Labor v One Nation <span aria-hidden="true" style="color: #6B6862">⇄</span></button><span>· implied</span><span style="flex-grow: 1"></span><button class="qbtn" aria-label="How the two-party figures are counted"><span>?</span></button></div>',
    '<div style="margin-top: 2px; border-bottom: 1px solid #9A968E">' + axis(350, 6, phone=True).replace('y="30"', 'y="26"') + '</div>',
    '<div role="table" aria-label="Latest poll and next expected poll from each pollster" style="display: flex; flex-direction: column">' + '\n'.join(card(r) for r in P) + '</div>',
    KEY.replace('font-size: 13px', 'font-size: 12px').replace('column-gap: 22px', 'column-gap: 14px'),
    FOOT.replace('font-size: 13px', 'font-size: 12px'),
])
open(OUT + 'PollsMobile.dc.html', 'w').write(page('Latest and next polls – phone', 390, 1640, phone))
print('ok')
