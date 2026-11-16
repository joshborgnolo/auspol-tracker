import re, sys, json, os, time, urllib.request, urllib.parse
SP = sys.argv[1]; want = sys.argv[2].split(",")
reg = json.load(open(os.path.join(SP, "htv-register.json")))
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
PARTY = {"alp": "Australian Labor Party", "lib": "Liberal", "nat": "The Nationals", "grn": "The Greens", "on": "One Nation Victoria", "ff": "Family First", "vs": "Victorian Socialists"}
picked = {}; n = 0
for dist, rows in sorted(reg.items()):
    for key in want:
        cards = [r for r in rows if r["Registered By"] == PARTY[key]]
        if not cards: continue
        # prefer the card whose file name names the fewest other districts (a single-district card), earliest registration number
        def score(r):
            blob = urllib.parse.unquote(r["href"].split("blobPath=")[1].split("&")[0]).lower()
            return (blob.count("_") + blob.count(" - "), int(r["Registration number"]))
        r = sorted(cards, key=score)[0]
        blob = urllib.parse.unquote(r["href"].split("blobPath=")[1].split("&")[0])
        fn = os.path.join(SP, "htv-pdf", key + "__" + re.sub(r"[^A-Za-z]+", "-", dist) + ".pdf")
        picked.setdefault(dist, {})[key] = {"file": os.path.basename(fn), "blob": blob, "no": r["Registration number"], "date": r["Registration date"], "type": r["HTVC Type"]}
        if os.path.exists(fn) and os.path.getsize(fn) > 1000: continue
        url = "https://www.vec.vic.gov.au" + r["href"].replace(" ", "%20")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=120) as resp: data = resp.read()
            open(fn, "wb").write(data); n += 1; time.sleep(0.35)
        except Exception as e:
            print("FAIL", dist, key, e)
json.dump(picked, open(os.path.join(SP, "htv-picked-" + "-".join(want) + ".json"), "w"), indent=0)
print("downloaded", n, "cards; picked for", len(picked), "districts")
