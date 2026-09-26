# The whole Snapshot page, top to bottom, stacked from the section boards in the
# live site's order. A canvas board can be at most 8000px tall, so the desktop page
# is written as two boards and the phone page as three; a full-length copy of each
# (not a board) goes to the preview folder for a single image.
# Run after the section boards: python3 design/redesign-2026-09/gen/page_build.py
import json, re, os, sys
from common import S, OUT

PREVIEW = os.path.join(os.path.dirname(os.path.dirname(S.rstrip('/'))), '.matilda', 'redesign-preview-b407')

DESKTOP = [['Masthead', 'TPP', 'Main', 'Polls', 'Leadership'],
           ['Direction', 'Demographics', 'Switching', 'Issues', 'Undecided']]
PHONE = [['MastheadMobile', 'TPPMobile', 'Mobile', 'PollsMobile'],
         ['LeadershipMobile', 'DirectionMobile', 'DemographicsMobile'],
         ['SwitchingMobile', 'IssuesMobile', 'UndecidedMobile']]
# the masthead boards also show the pinned bar; the page takes only the top of page
MAST_H = {'Masthead': 251, 'MastheadMobile': 249}          # measured: header and nav, with the top padding
HOLES = {'{{bandOpacity}}': '0.18', '{{dotOpacity}}': '0.32', '{{eventOpacity}}': '1'}

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link href="https://fonts.googleapis.com/css2?family=Crimson+Text:wght@400;600;700&amp;'
         'family=IBM+Plex+Sans:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet">')


def scope(css, cls):
    out = []
    for sel, decl in re.findall(r'([^{}]+)\{([^{}]*)\}', css):
        sel = sel.strip()
        if sel == 'body':
            out.append(f'.{cls}{{{decl}}}')
        else:
            out.append(','.join(f'.{cls} {s.strip()}' for s in sel.split(',')) + '{' + decl + '}')
    return '\n'.join(out)


def section(board, cls):
    t = open(OUT + board + '.dc.html').read()
    for k, v in HOLES.items():
        t = t.replace(k, v)
    css = re.search(r'<style>(.*?)</style>', t, re.S).group(1)
    root = re.search(r'<div style="(width: (\d+)px; height: (\d+)px; box-sizing: border-box; padding: [^"]*)">', t)
    start = root.end()
    end = t.rindex('</div>', 0, t.index('</x-dc>'))
    inner = t[start:end]
    style, w, h = root.group(1), int(root.group(2)), int(root.group(3))
    if board in MAST_H:
        header = re.search(r'<header.*?</header>', inner, re.S).group(0)
        nav = re.search(r'<nav.*?</nav>', inner, re.S).group(0)
        header = re.sub(r'margin-top: \d+px', 'margin-top: 0px', header, count=1)
        h = MAST_H[board]
        style = re.sub(r'height: \d+px', f'height: {h}px', style)
        style = re.sub(r'padding: [^;]+', 'padding: 40px 64px 0' if w > 400 else 'padding: 24px 20px 0', style)
        inner = header + '\n' + nav
    return scope(css, cls), f'<section class="{cls}" style="{style}">\n{inner}\n</section>', w, h


def build(parts, prefix, title):
    written, full_css, full_body, total = [], [], [], 0
    n = 0
    for i, boards in enumerate(parts, 1):
        css, body, H = [], [], 0
        for b in boards:
            n += 1
            c, s, w, h = section(b, f's{n}')
            css.append(c); body.append(s); H += h
        name = f'{prefix}{i}.dc.html'
        label = f'{title}, {i} of {len(parts)}'
        page = f'''<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<title>{label}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
{FONTS}
<style>
body{{margin:0;background:#FAF9F6;color:#171717;font-family:"IBM Plex Sans",system-ui,sans-serif}}
{chr(10).join(css)}
</style>
</helmet>
<div style="width: {w}px; height: {H}px; display: flex; flex-direction: column; background: #FAF9F6">
{chr(10).join(body)}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{H}}}}}'>
class Component extends DCLogic {{
renderVals() {{
return {{}};
}}
}}
</script>
</body>
</html>
'''
        assert H <= 8000, (name, H)
        open(OUT + name, 'w').write(page)
        written.append((name, w, H, label))
        full_css += css; full_body += body; total += H
    full = (f'<!doctype html>\n<html lang="en-AU">\n<head>\n<meta charset="utf-8">\n<title>{title}</title>\n{FONTS}\n'
            f'<style>\nbody{{margin:0;background:#FAF9F6;color:#171717;font-family:"IBM Plex Sans",system-ui,sans-serif}}\n'
            + '\n'.join(full_css) + '\n</style>\n</head>\n<body>\n'
            f'<div style="width: {w}px; display: flex; flex-direction: column; background: #FAF9F6">\n' + '\n'.join(full_body) + '\n</div>\n</body>\n</html>\n')
    os.makedirs(PREVIEW, exist_ok=True)
    open(os.path.join(PREVIEW, prefix + 'Full.html'), 'w').write(full)
    return written, w, total


if __name__ == '__main__':
    out = {}
    out['desktop'] = build(DESKTOP, 'PageDesktop', 'Snapshot page – desktop')
    out['phone'] = build(PHONE, 'PagePhone', 'Snapshot page – phone')
    for k, (boards, w, total) in out.items():
        print(k, 'total', total, [(n, h) for n, _, h, _ in boards])
    json.dump({k: [dict(name=n, w=w, h=h, title=t) for n, w, h, t in v[0]] for k, v in out.items()},
              open(os.path.join(PREVIEW, 'page_boards.json'), 'w'), indent=1)
