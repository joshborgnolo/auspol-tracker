# Poll dots for the monthly-line charts that had none, as the live site draws them:
#   - net approval and favourability (Leadership boards): each poll's net rating;
#   - who votes for whom: each poll's group figure as the site pools it (the month's
#     aggregate plus the poll's gap between the group and its own all-voters figure,
#     data/demoDots.json, made with the site's own demo-groups mapping);
#   - where One Nation's voters came from: each wave's share of a 2025 group now
#     backing One Nation.
# Idempotent: a chart that already carries dots (class "pdots") is skipped.
# Run: python3 design/redesign-2026-09/gen/poll_dots.py
import json, re, os
HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.join(HERE, '..', 'canvas', 'project')
DATA = os.path.join(HERE, '..', 'data')
P = json.load(open(os.path.join(DATA, 'individualPolls.json')))
DEMO = json.load(open(os.path.join(DATA, 'demoDots.json')))
ALP, LNP, ONP, GRN, OTH = '#B9463F', '#356697', '#CC7C37', '#439458', '#938A81'
f = lambda v: f'{v:.1f}'
MID = lambda ym: int(ym[:4]) + (int(ym[5:]) - 0.5) / 12          # a month's plotting x, as the lines use


def dots_group(series, sw):
    """series: [(colour, [(px, py)])] -> one faint group, drawn behind the lines."""
    paths = ''.join(f'<path style="fill: none; stroke: {c}; stroke-width: {sw}; stroke-linecap: round" d="'
                    + ''.join(f'M{f(x)} {f(y)}h0' for x, y in pts) + '"></path>' for c, pts in series if pts)
    return f'<g class="pdots" style="opacity: 0.35">{paths}</g>\n'


def insert_before(seg, marker, markup):
    i = seg.index(marker)
    return seg[:i] + markup + seg[i:]


# ---------------------------------------------------------------- leaders
def leader_dots(metric):
    """{'alb': [(x, v)], 'opp': [...], 'hanson': [...]} for 'approval' or 'fav'."""
    out = {'alb': [], 'opp': [], 'hanson': []}
    for p in P:
        a = p['appr']
        for who, key in (('alb', 'albNet'), ('opp', 'taylorNet'), ('hanson', 'hansonNet')):
            lk = 'taylor' if who == 'opp' else who
            if a.get(key) is not None and a['metricBy'].get(lk) == metric:
                out[who].append((p['x'], a[key]))
            alt = (a.get('alt') or {}).get(lk)
            if alt and alt.get('metric') == metric and alt.get('net') is not None:
                out[who].append((p['x'], alt['net']))
    return out


def patch_leader(t, title, metric, first_ym, sw):
    m = re.search(re.escape(title) + r'</span>\s*(<svg .*?</svg>)', t, re.S)
    if not m:
        return t, 0
    svg = m.group(1)
    if 'class="pdots"' in svg:
        return t, 0
    ticks = {lab: float(y) - 4 for y, lab in re.findall(r'<text class="ax" x="-?[\d.]+" y="([\d.]+)" style="text-anchor: end">([^<]+)</text>', svg)}
    ya, yb = ticks['+20'], ticks['−20']
    Y = lambda v: ya + (20 - v) * (yb - ya) / 40
    alb = re.search(r'<path class="ln" style="stroke: #B9463F" d="M([\d.]+) [\d.]+([^"]*)"', svg)
    x0 = float(alb.group(1)); x1 = float(re.findall(r'L([\d.]+) [\d.]+', alb.group(2))[-1])
    X = lambda x: x0 + (x - MID(first_ym)) * (x1 - x0) / (MID('2026-09') - MID(first_ym))
    lo, hi = x0 - 6, x1 + 6
    d = leader_dots(metric)
    ser = [(c, [(X(x), Y(v)) for x, v in d[k] if lo <= X(x) <= hi]) for k, c in (('alb', ALP), ('opp', LNP), ('hanson', ONP))]
    new = insert_before(svg, '<path class="ln"', dots_group(ser, sw))       # over the bands, under the lines
    return t.replace(svg, new), sum(len(s[1]) for s in ser)


# ---------------------------------------------------------------- who votes for whom
def demo_pts(key, X, Y, lo, hi):
    return [(X(x), Y(v)) for x, v, _ in DEMO.get(key, []) if lo <= X(x) <= hi]


def patch_demo_panel(t, anchor, sets, party, first_ym, px_per_month, Y, width, sw, colours_by_group):
    """anchor: the text that starts the panel's <g>; sets: the set id; groups coloured as their lines."""
    s = t.index(anchor)
    e = t.index('</g>', s)
    seg = t[s:e]
    if 'class="pdots"' in seg:
        return t, 0
    X = lambda x: (x - MID(first_ym)) * 12 * px_per_month
    ser = [(col, demo_pts(f'{sets}|{g}|{party}', X, Y, -4, width + 4)) for g, col in colours_by_group]
    marker = '<path class="all"' if '<path class="all"' in seg else '<path class="ln"'
    new = insert_before(seg, marker, dots_group(ser, sw))
    return t[:s] + new + t[e:], sum(len(p) for _, p in ser)


# ---------------------------------------------------------------- switching
SW = [p for p in P if 'sw' in p]


def patch_switch(t, width, x0, bottom, ppt, sw):
    n = 0
    for col, key in ((LNP, 'lnp'), (ALP, 'alp'), (OTH, 'oth'), (GRN, 'grn')):
        m = re.search(rf'<path class="ln" style="stroke: {col}" d="M{re.escape(f(x0))} ', t)
        if not m:
            continue
        seg = t[t.rindex('<svg', 0, m.start()):m.start()]      # this panel's own svg
        if 'class="pdots"' in seg:
            continue
        X = lambda x: x0 + (x - MID('2026-02')) * 12 * (width - x0) / 7
        pts = [(X(p['x']), bottom - p['sw'][key] * ppt) for p in SW if p['sw'].get(key) is not None and x0 - 4 <= X(p['x']) <= width + 4]
        t = t[:m.start()] + dots_group([(col, pts)], sw) + t[m.start():]
        n += len(pts)
    return t, n


def run():
    done = {}
    for name, sw in (('Leadership.dc.html', 5), ('LeadershipMobile.dc.html', 3.5), ('LeadershipTablet.dc.html', 5), ('LeadershipBoth.dc.html', 5), ('LeadershipThreeWay.dc.html', 5)):
        p = os.path.join(PROJ, name); t = open(p).read(); n = 0
        t, k = patch_leader(t, 'Net approval, month by month', 'approval', '2025-05', sw); n += k
        t, k = patch_leader(t, 'Favourability, month by month', 'fav', '2025-07', sw); n += k
        open(p, 'w').write(t); done[name] = n
    AGE = [('18–34', ONP), ('35–54', '#9E5200'), ('55+', '#5E3000')]
    GEN = [('Gen Z', ONP), ('Millennials', '#A8631C'), ('Gen X', '#7A4210'), ('Boomers', '#4E2800')]
    AGE_G = [('18–34', '#4A9A5E'), ('35–54', '#25793F'), ('55+', '#005B23')]
    GEN_G = [('Gen Z', '#4A9A5E'), ('Millennials', '#25793F'), ('Gen X', '#005B23'), ('Boomers', '#003F15')]
    for name, party, age, gen in (('Demographics.dc.html', 'onp', AGE, GEN), ('DemographicsGreens.dc.html', 'grn', AGE_G, GEN_G)):
        p = os.path.join(PROJ, name); t = open(p).read(); n = 0
        t, k = patch_demo_panel(t, '<g transform="translate(36 34)">', 'age', party, '2025-07', 44, lambda v: 220 - 5.5 * v, 616, 4, age); n += k
        t, k = patch_demo_panel(t, '<g transform="translate(776 34)">', 'generation', party, '2026-02', 44, lambda v: 220 - 5.5 * v, 308, 4, gen); n += k
        open(p, 'w').write(t); done[name] = n
    p = os.path.join(PROJ, 'DemographicsMobile.dc.html'); t = open(p).read(); n = 0
    t, k = patch_demo_panel(t, '<g transform="translate(28 26)">', 'age', 'onp', '2025-07', 18, lambda v: 160 - 4 * v, 252, 3, AGE); n += k
    t, k = patch_demo_panel(t, '<g transform="translate(28 266)">', 'generation', 'onp', '2025-07', 18, lambda v: 160 - 4 * v, 252, 3, GEN); n += k
    open(p, 'w').write(t); done['DemographicsMobile.dc.html'] = n
    # place: four state panels, then the location chart
    p = os.path.join(PROJ, 'DemographicsPlace.dc.html'); t = open(p).read(); n = 0
    pos = 0
    for st in ('NSW', 'Vic', 'Qld', 'Rest of Australia'):
        a = t.index('<g transform="translate(30 8)">', pos)
        seg_end = t.index('</g>', a)
        if 'class="pdots"' not in t[a:seg_end]:
            X = lambda x: (x - MID('2025-07')) * 12 * 16.43
            pts = demo_pts(f'state|{st}|onp', X, lambda v: 110 - 2.75 * v, -3, 233)
            t = t[:a] + insert_before(t[a:seg_end], '<path class="all"', dots_group([(ONP, pts)], 3.5)) + t[seg_end:]
            n += len(pts)
        pos = t.index('</g>', a) + 4
    LOC = [('Inner metro', '#C47431'), ('Outer metro', '#AB5E0C'), ('Provincial', '#883D00'), ('Rural', '#602800')]
    loc_anchor = t.index('<svg viewBox="0 0 560 ')
    g = t.index('<g transform="translate(36 20)">', loc_anchor)
    t2, k = patch_demo_panel(t[g:], '<g transform="translate(36 20)">', 'location', 'onp', '2026-02', 470 / 7, lambda v: 298 - 298 / 40 * v, 470, 4, LOC)
    t = t[:g] + t2; n += k
    open(p, 'w').write(t); done['DemographicsPlace.dc.html'] = n
    for name, width, x0, bottom, ppt, sw in (('Switching.dc.html', 270, 30.0, 120, 2.4, 4.5), ('SwitchingMobile.dc.html', 165, 26.0, 80, 1.6, 3.5)):
        p = os.path.join(PROJ, name); t = open(p).read()
        t, k = patch_switch(t, width, x0, bottom, ppt, sw)
        open(p, 'w').write(t); done[name] = k
    print(done)


if __name__ == '__main__':
    run()
