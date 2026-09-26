# Adds each poll's head-to-head lead as a dot to the "Albanese's lead" charts on the
# hand-written Leadership boards, and extends their scale to −5 so polls with the
# opponent ahead show. Idempotent: skips a chart that already has dots.
# Run: python3 design/redesign-2026-09/gen/lead_dots.py
import json, re, os
HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.join(HERE, '..', 'canvas', 'project')
P = json.load(open(os.path.join(HERE, '..', 'data', 'individualPolls.json')))
LNP, ONP = '#356697', '#CC7C37'

dots, seen = [], set()
for p in P:
    sets = ([p['ppm']] if 'ppm' in p else []) + (p.get('ppmSets') or [])
    for s in sets:
        opp = [k for k in s if k not in ('alb', 'unc')]
        if len(opp) != 1:
            continue                      # three-way sets aren't head to head
        key = (p['pollster'], round(p['x'], 4), opp[0])
        if key in seen:
            continue
        seen.add(key)
        dots.append((p['x'], opp[0], s['alb'] - s[opp[0]]))

f = lambda v: f'{v:.1f}'
for name, note_old, note_new in [
    ('Leadership.dc.html', 'Lead is Albanese’s share minus his opponent’s. Pollsters leave different shares undecided, so the gap is more comparable than the levels. Lines are monthly averages.',
     'Each dot is one poll; lines are monthly averages. Lead is Albanese’s share minus his opponent’s, which lets one chart carry both head-to-head contests.'),
    ('LeadershipTablet.dc.html', 'Lead is Albanese’s share minus his opponent’s. Pollsters leave different shares undecided, so the gap is more comparable than the levels. Lines are monthly averages.',
     'Each dot is one poll; lines are monthly averages. Lead is Albanese’s share minus his opponent’s, which lets one chart carry both head-to-head contests.'),
    ('LeadershipMobile.dc.html', 'Lead is Albanese’s share minus his opponent’s; the gap compares better across pollsters than the levels. Monthly averages.',
     'Each dot is one poll; lines are monthly averages. Lead is Albanese’s share minus his opponent’s.'),
    ('LeadershipBoth.dc.html', 'Lead is Albanese’s share minus his opponent’s; three-way figures are shares of all respondents. Lines are monthly averages.',
     'Each dot is one poll; lines are monthly averages. Lead is Albanese’s share minus his opponent’s; three-way figures are shares of all respondents.'),
]:
    path = os.path.join(PROJ, name)
    t = open(path).read()
    m = re.search(r'lead(?:, | head to head, )month by month</span>\s*(<svg viewBox="0 0 (\d+) (\d+)" width="\d+" height="(\d+)".*?</svg>)', t, re.S)
    svg = m.group(1)
    if 'class="pdots"' in svg:
        continue
    W, H = int(m.group(2)), int(m.group(3))
    y30 = float(re.search(r'y="([\d.]+)" style="text-anchor: end">\+30<', svg).group(1)) - 4
    ytie = float(re.search(r'y="([\d.]+)" style="text-anchor: end">Tied<', svg).group(1)) - 4
    ppt = (ytie - y30) / 30
    Y = lambda v: ytie - v * ppt
    lines = re.findall(r'<path class="ln" style="stroke: #[0-9A-F]{6}" d="([^"]+)"', svg)
    x_first = float(re.match(r'M([\d.]+)', lines[0]).group(1))          # Jul 2025, the first Ley month
    x_last = float(re.findall(r'L([\d.]+) [\d.]+', lines[1])[-1])       # Sep 2026, the last Taylor month
    X = lambda x: x_first + (x - 2025.5417) * (x_last - x_first) / (2026.7083 - 2025.5417)
    ext = round(5 * ppt, 1)                                              # room down to −5
    base = ytie + ext
    phone = W < 400
    sw = 3.5 if phone else 5
    dpath = lambda col, sel: ''.join(f'M{f(X(x))} {f(Y(v))}h0' for x, o, v in dots if sel(o))
    dot_svg = (f'<g class="pdots" style="opacity: 0.35">'
               f'<path style="fill: none; stroke: {LNP}; stroke-width: {sw}; stroke-linecap: round" d="{dpath(LNP, lambda o: o != "hanson")}"></path>'
               f'<path style="fill: none; stroke: {ONP}; stroke-width: {sw}; stroke-linecap: round" d="{dpath(ONP, lambda o: o == "hanson")}"></path></g>\n')
    new = svg
    # the tied line stays as a hairline; the baseline moves to −5, and the x axis with it
    new = re.sub(r'<path class="base" d="M0 ([\d.]+)H(\d+)"></path>',
                 lambda mm: f'<path class="grid" d="M0 {mm.group(1)}H{mm.group(2)}" style="stroke: #9A968E"></path>'
                            f'<path class="base" d="M0 {f(base)}H{mm.group(2)}"></path>', new, count=1)
    new = re.sub(r'(<path class="base" d=")((?:M[\d.]+ [\d.]+V[\d.]+)+)(")',
                 lambda mm: mm.group(1) + re.sub(r'M([\d.]+) ([\d.]+)V([\d.]+)', lambda q: f'M{q.group(1)} {f(float(q.group(2)) + ext)}V{f(float(q.group(3)) + ext)}', mm.group(2)) + mm.group(3), new)
    new = re.sub(r'(<text class="ax" x="[\d.]+" y=")([\d.]+)(" style="text-anchor: middle">)', lambda mm: mm.group(1) + f(float(mm.group(2)) + ext) + mm.group(3), new)
    new = re.sub(r'(<path class="even" d="M[\d.]+ [\d.]+V)([\d.]+)', lambda mm: mm.group(1) + f(base), new)
    new = new.replace(f'viewBox="0 0 {W} {H}" width="{W}" height="{H}"', f'viewBox="0 0 {W} {round(H + ext)}" width="{W}" height="{round(H + ext)}"')
    i = new.index('<path class="ln"')
    new = new[:i] + dot_svg + new[i:]
    t = t.replace(svg, new)
    assert t.count(note_old) == 1, name
    t = t.replace(note_old, note_new)
    open(path, 'w').write(t)
    print(name, 'dots', len(dots), 'ppt', round(ppt, 3), 'ext', ext)
