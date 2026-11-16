"""One Nation's statewide card: every district's numbering on one sheet. Each district name heads a block;
its candidates are the surname words below the header, in its column, matched to the official ballot."""
import re, sys, json, os, subprocess, html, unicodedata
SP = sys.argv[1]
C = json.load(open(os.path.join(SP, "candidates-2026.json")))["districts"]
def norm(s): return re.sub(r"[^a-z]", "", unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower())
x = subprocess.run(["pdftotext", "-bbox-layout", os.path.join(SP, "htv-pdf", "on__statewide.pdf"), "-"], capture_output=True, text=True).stdout
out = {}; bad = []
pages = re.findall(r"<page[^>]*>(.*?)</page>", x, re.S)
allw = []
for pi, pg in enumerate(pages):
    for a, b, c, d, t in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', pg):
        allw.append((pi, float(a), float(b), float(c), float(d), html.unescape(t)))
# headers: a district name's words in a row
heads = {}
for name in C:
    toks = name.replace("-", " ").split() if False else name.split()
    for i, w in enumerate(allw):
        if w[5] != toks[0]: continue
        seq = [w]; okk = True
        for k in range(1, len(toks)):
            nxt = [v for v in allw if v[0] == w[0] and abs(v[2] - w[2]) < 3 and v[1] > seq[-1][3] - 1 and v[1] - seq[-1][3] < 12 and v[5] == toks[k]]
            if not nxt: okk = False; break
            seq.append(nxt[0])
        if not okk: continue
        # a header is not followed on its row by a comma'd name and has no number just left of it
        after = [v for v in allw if v[0] == w[0] and abs(v[2] - w[2]) < 3 and 0 < v[1] - seq[-1][3] < 12]
        if len(toks) == 1 and after and re.match(r"^[A-Z][a-z]", after[0][5]) and name + " " + after[0][5] in C: continue  # "Bendigo" of "Bendigo East"
        heads.setdefault(name, []).append((w[0], w[1], w[2], seq[-1][3], w[4]))
missing = [n for n in C if n not in heads]
for name, hs in heads.items():
    cands = C[name]; last = [norm(c["name"].split(",")[0].split()[-1]) for c in cands]
    best = None
    for (pi, hx0, hy0, hx1, hy1) in hs:
        got = {}
        col = [v for v in allw if v[0] == pi and v[2] > hy1 - 1 and hx0 - 30 <= v[1] <= hx0 + 150]
        for v in sorted(col, key=lambda v: v[2]):
            if "," not in v[5]: continue
            s = norm(v[5].split(",")[0]); hit = [i for i, z in enumerate(last) if z == s and i not in got]
            if not hit: continue
            if v[2] - hy1 > 14 * (len(cands) + 2): continue
            nums = [u for u in allw if u[0] == pi and re.fullmatch(r"\d{1,2}", u[5]) and abs((u[2] + u[4]) / 2 - (v[2] + v[4]) / 2) < 4 and 0 < v[1] - u[3] < 40]
            if nums: got[hit[0]] = int(sorted(nums, key=lambda u: v[1] - u[3])[0][5])
        if best is None or len(got) > len(best): best = got
    n = len(cands)
    if len(best) == n - 1 and len(set(best.values())) == n - 1 and all(1 <= v <= n for v in best.values()):  # one multi-word surname unread: it holds the number left over
        best[[i for i in range(n) if i not in best][0]] = [v for v in range(1, n + 1) if v not in best.values()][0]
    if len(best) == n and sorted(best.values()) == list(range(1, n + 1)):
        out[name] = [cands[i]["name"] for i, _ in sorted(best.items(), key=lambda kv: kv[1])]
    else: bad.append((name, len(best), n))
json.dump(out, open(os.path.join(SP, "htv-on.json"), "w"), indent=0)
print(len(pages), "pages;", len(out), "districts complete; headers missing:", missing, "; incomplete:", bad)
