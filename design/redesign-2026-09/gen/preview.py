# Render the boards locally, without the canvas: a static copy of each board
# (support.js dropped, template holes filled with their defaults) goes to
# .matilda/redesign-preview/, a screenshot of each to .matilda/redesign-preview/png/,
# and each board's content height is measured, so a board can be sized to end with
# the same padding it starts with.
# Usage (from the repo root): python3 design/redesign-2026-09/gen/preview.py [--scale 2] [Board ...]
# Needs a Chromium: set CHROME, or it uses Playwright's headless shell or Google Chrome.
import glob, json, os, re, subprocess, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.join(HERE, '..', 'canvas', 'project')
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUTD = os.path.join(REPO, '.matilda', 'redesign-preview')
HOLES = {'{{bandOpacity}}': '0.18', '{{dotOpacity}}': '0.32', '{{eventOpacity}}': '1'}


def chrome():
    if os.environ.get('CHROME'):
        return os.environ['CHROME']
    shells = sorted(glob.glob(os.path.expanduser('~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-mac/headless_shell')))
    return shells[-1] if shells else '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'


def static_copy(name):
    t = open(os.path.join(PROJ, name)).read()
    t = t.replace('<script src="./support.js"></script>', '<style>x-dc{display:block}helmet{display:none}</style>')
    for k, v in HOLES.items():
        t = t.replace(k, v)
    t = re.sub(r'<script type="text/x-dc".*?</script>', '', t, flags=re.S)
    out = os.path.join(OUTD, name.replace('.dc.html', '.html'))
    open(out, 'w').write(t)
    return out


def main(args):
    scale = 1
    if args[:1] == ['--scale']:
        scale, args = float(args[1]), args[2:]
    canvas = json.load(open(os.path.join(PROJ, 'canvas.json')))
    names = [a if a.endswith('.dc.html') else a + '.dc.html' for a in args] or list(canvas['boards'])
    os.makedirs(os.path.join(OUTD, 'png'), exist_ok=True)
    for name in names:
        b = canvas['boards'][name]
        src = open(os.path.join(PROJ, name)).read()
        pad = re.search(r'height: \d+px; box-sizing: border-box; padding: ([^;]+);', src)
        p = pad.group(1).split() if pad else ['0px']
        pb = int(p[2 if len(p) >= 3 else 0].rstrip('px'))
        html = static_copy(name)
        png = os.path.join(OUTD, 'png', name.replace('.dc.html', '.png'))
        subprocess.run([chrome(), '--headless', '--disable-gpu', '--hide-scrollbars', f'--force-device-scale-factor={scale}',
                        f'--window-size={b["w"]},{b["h"] + 400}', '--virtual-time-budget=3000', f'--screenshot={png}',
                        'file://' + html], capture_output=True, timeout=120)
        im = Image.open(png).convert('RGB')
        w, h = im.size
        bg = im.getpixel((w - 2, 2))
        px = im.load()
        bottom = next((y + 1 for y in range(h - 1, -1, -1)
                       if any(max(abs(a - c) for a, c in zip(px[x, y], bg)) > 8 for x in range(0, w, max(1, int(scale))))), 0)
        bottom = round(bottom / scale)
        fit = -(-(bottom + pb) // 10) * 10
        flag = '' if fit == b['h'] else f'  -> {fit} for equal padding'
        print(f'{name:30s} {b["w"]:>5} x {b["h"]:<5} content ends {bottom:>5}{flag}')
        im.crop((0, 0, w, round(b['h'] * scale))).save(png)


if __name__ == '__main__':
    main(sys.argv[1:])
