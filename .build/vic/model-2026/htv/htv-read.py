"""Read registered how-to-vote cards: the number each card prints against each of the district's candidates.
Word boxes come from the PDF's text layer (pdftotext -bbox-layout); where a card draws its numbers as artwork
(no text layer for them), the page is rendered and read by tesseract. Each candidate's surname is located and
the nearest 1-2 digit number to its left (same row, or the row just above for a party-name line) is taken.
A card is 'complete' when the numbers found are exactly 1..n; 'open' when it numbers only its own candidate
and tells voters to choose the rest."""
import re, sys, json, os, subprocess, glob, unicodedata, html, tempfile
SP = sys.argv[1]
C = json.load(open(os.path.join(SP, "candidates-2026.json")))["districts"]
def norm(s): return re.sub(r"[^a-z]", "", unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower())
def words_pdf(fn):
    x = subprocess.run(["pdftotext", "-bbox-layout", fn, "-"], capture_output=True, text=True).stdout
    pages = []
    for pg in re.findall(r"<page[^>]*>(.*?)</page>", x, re.S):
        ws = [(float(a), float(b), float(c), float(d), html.unescape(t)) for a, b, c, d, t in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', pg)]
        pages.append(ws)
    return pages
def words_ocr(fn, page=1):
    with tempfile.TemporaryDirectory() as td:
        subprocess.run(["pdftoppm", "-r", "200", "-f", str(page), "-l", str(page), "-png", fn, os.path.join(td, "p")], check=True)
        png = sorted(glob.glob(os.path.join(td, "p*.png")))[0]
        tsv = subprocess.run(["tesseract", png, "-", "--psm", "11", "tsv"], capture_output=True, text=True).stdout
    ws = []
    for line in tsv.split("\n")[1:]:
        p = line.split("\t")
        if len(p) >= 12 and p[11].strip():
            l, t, w, h = map(float, p[6:10]); ws.append((l, t, l + w, t + h, p[11].strip()))
    return [ws]
def words_ocr_all(fn):
    out = []
    for pg in (1, 2):
        try: out += words_ocr(fn, pg)
        except Exception: pass
    return out
def read_words(ws, cands):
    surn = [norm(c["name"].split(",")[0]) for c in cands]
    # candidate surname tokens: the word(s) ending in a comma; a multi-word surname is matched on its last word
    last = [norm(c["name"].split(",")[0].split()[-1]) for c in cands]
    nums = [(x0, y0, x1, y1, int(t)) for x0, y0, x1, y1, t in ws if re.fullmatch(r"\d{1,2}", t)]
    got = {}; where = {}
    for wi, (x0, y0, x1, y1, t) in enumerate(ws):
        if not t.endswith(",") and "," not in t: continue
        s = norm(t.split(",")[0])
        hit = [i for i, x in enumerate(last) if x == s]
        if len(hit) > 1:
            nxt = norm(t.split(",")[1]) if t.split(",")[1:] and norm(t.split(",")[1]) else (norm(ws[wi + 1][4]) if wi + 1 < len(ws) else "")
            hit = [i for i in hit if nxt and norm(cands[i]["name"].split(",")[1]).startswith(nxt[:1]) and (len(nxt) < 2 or norm(cands[i]["name"].split(",")[1]).startswith(nxt[:len(nxt)]) or nxt.startswith(norm(cands[i]["name"].split(",")[1].split()[0])))]
        if len(hit) != 1 or hit[0] in got: continue
        i = hit[0]; h = y1 - y0; yc = (y0 + y1) / 2
        best = None
        for nx0, ny0, nx1, ny1, v in nums:
            if not (1 <= v <= len(cands)): continue
            if nx1 > x0 + 2: continue                    # number sits to the left of the surname
            dx = x0 - nx1; dy = yc - (ny0 + ny1) / 2     # dy > 0: number above the name
            if dx > 14 * h or dy < -0.9 * h or dy > 2.2 * h: continue
            cost = dx + 6 * abs(dy)
            if best is None or cost < best[0]: best = (cost, v)
        where[i] = (x0, y0)
        if best: got[i] = best[1]
    return got, where
def ok(got, n): return len(got) == n and sorted(got.values()) == list(range(1, n + 1))
def read_card(fn, cands):
    n = len(cands); best = ({}, {}, "text")
    for src in ("text", "ocr"):
        try: pages = words_pdf(fn) if src == "text" else words_ocr_all(fn)
        except Exception as e: continue
        for ws in pages:
            got, where = read_words(ws, cands)
            if ok(got, n): return got, where, src
            if len(got) > len(best[0]) or (len(where) > len(best[1]) and len(got) >= len(best[0])): best = (got, where, src)
    return best
if __name__ == "__main__":
    only = sys.argv[2:] ; out = {}; bad = []
    for fn in sorted(glob.glob(os.path.join(SP, "htv-pdf", "*.pdf"))):
        key, d = os.path.basename(fn)[:-4].split("__"); dist = None
        for name in C:
            if re.sub(r"[^A-Za-z]+", "-", name) == d: dist = name
        if key == "on" or dist is None or (only and key not in only): continue
        cands = C[dist]; got, where, src = read_card(fn, cands)
        txt = subprocess.run(["pdftotext", "-layout", fn, "-"], capture_output=True, text=True).stdout
        openc = bool(re.search(r"order of\s+your\s+(own\s+)?choice|in\s+the\s+order\s+you\s+choose|your\s+own\s+preferences", re.sub(r"\s+", " ", txt), re.I))
        nn = len(cands)
        if len(got) == nn - 1 and len(set(got.values())) == nn - 1 and all(1 <= v <= nn for v in got.values()):  # one surname unread: it holds the number left over
            got[[i for i in range(nn) if i not in got][0]] = [v for v in range(1, nn + 1) if v not in got.values()][0]
        complete = ok(got, len(cands))
        rec = {"src": src, "open": openc and not complete, "complete": complete, "found": len(where), "n": len(cands),
               "order": [cands[i]["name"] for i, _ in sorted(got.items(), key=lambda kv: kv[1])] if complete else None,
               "nums": {cands[i]["name"]: v for i, v in sorted(got.items())}}
        out.setdefault(dist, {})[key] = rec
        if not complete and not rec["open"]: bad.append((dist, key, src, len(got), len(where), len(cands)))
    prev = {}
    pth = os.path.join(SP, "htv-read.json")
    if only and os.path.exists(pth): prev = json.load(open(pth))
    for d, v in out.items(): prev.setdefault(d, {}).update(v)
    json.dump(prev, open(pth, "w"), indent=0)
    n = sum(len(v) for v in out.values()); nopen = sum(1 for v in out.values() for r in v.values() if r["open"])
    print(n, "cards read;", sum(1 for v in out.values() for r in v.values() if r["complete"]), "complete;", nopen, "open;", len(bad), "unread:", bad)
    print("open:", [(d, k) for d, v in out.items() for k, r in v.items() if r["open"]])
