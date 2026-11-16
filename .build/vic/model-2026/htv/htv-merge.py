"""Consolidate the card readings: per district, the Labor, Coalition (Liberal and/or National) and One Nation
cards as preference orders (or 'open'), with each reading's registration number and how it was read."""
import json, sys, os, re, collections
SP = sys.argv[1]
C = json.load(open(SP + "/candidates-2026.json"))["districts"]
R = json.load(open(SP + "/htv-read.json")); ON = json.load(open(SP + "/htv-on.json"))
picked = {}
for f in ("htv-picked-lib-nat.json", "htv-picked-alp.json"):
    for d, v in json.load(open(os.path.join(SP, f))).items(): picked.setdefault(d, {}).update(v)
reg = {re.sub(r"[^A-Za-z]+", " ", k): v for k, v in json.load(open(SP + "/htv-register.json")).items()}
picked = {re.sub(r"[^A-Za-z]+", " ", k): v for k, v in picked.items()}
# the Nationals draw their numbers as artwork: read by eye from the rendered cards (numbers in ballot order)
EYE = {
 ("Bendigo East", "nat"): [3, 8, 9, 4, 1, 2, 5, 6, 7], ("Bendigo West", "nat"): [6, 1, 7, 4, 5, 3, 2],
 ("Gippsland East", "nat"): [7, 5, 6, 1, 4, 3, 2], ("Gippsland South", "nat"): [3, 4, 1, 7, 5, 6, 2],
 ("Lowan", "nat"): [5, 3, 1, 6, 2, 4, 8, 7], ("Mildura", "nat"): [2, 3, 6, 1, 7, 4, 5],
 ("Morwell", "nat"): [2, 5, 6, 4, 1, 7, 3], ("Murray Plains", "nat"): [7, 1, 2, 3, 4, 5, 6],
 ("Ovens Valley", "nat"): [1, 5, 9, 2, 3, 4, 6, 7, 8], ("Shepparton", "nat"): [1, 2, 7, 8, 5, 6, 3, 9, 4],
 ("Euroa", "nat"): [1, 2, 5, 6, 4, 3, 7], ("Ripon", "nat"): [7, 8, 5, 4, 12, 3, 11, 9, 10, 6, 2, 1],
}
EYE_FIRST = {("Bendigo East", "nat"): "JOHN", ("Bendigo West", "nat"): "SHALEVSKI", ("Gippsland East", "nat"): "ESPESETH", ("Gippsland South", "nat"): "BARRY-MACAULAY", ("Lowan", "nat"): "BUTLER", ("Mildura", "nat"): "NTAHOMVUKIYE", ("Morwell", "nat"): "CLARKE", ("Murray Plains", "nat"): "COLLARD", ("Ovens Valley", "nat"): "McCURDY", ("Shepparton", "nat"): "SALI", ("Euroa", "nat"): "CLEELAND", ("Ripon", "nat"): "WOJTKOWSKI"}
OPEN_EYE = {("Footscray", "lib")}
out = {}
for d, cands in C.items():
    rec = {}
    for key in ("alp", "lib", "nat"):
        r = R.get(d, {}).get(key)
        if r is None: continue
        meta = picked.get(re.sub(r"[^A-Za-z]+", " ", d), {}).get(key, {})
        e = {"reg": int(meta["no"]) if meta.get("no") else None, "registered": meta.get("date")}
        if (d, key) in EYE:
            nums = EYE[(d, key)]
            assert len(nums) == len(cands) and sorted(nums) == list(range(1, len(cands) + 1)), (d, key)
            assert cands[0]["name"].upper().startswith(EYE_FIRST[(d, key)].upper()), (d, cands[0]["name"])
            e["order"] = [c["name"] for _, c in sorted(zip(nums, cands), key=lambda t: t[0])]; e["read"] = "by eye (numbers drawn as artwork)"
        elif r["complete"]: e["order"] = r["order"]; e["read"] = "text layer" if r["src"] == "text" else "OCR"
        elif r["open"] or (d, key) in OPEN_EYE: e["open"] = True; e["read"] = "text layer"
        else: raise SystemExit(f"unread card {d} {key}")
        rec[key] = e
    onreg = [r for r in reg[re.sub(r"[^A-Za-z]+", " ", d)] if r["Registered By"] == "One Nation Victoria" and r["HTVC Type"] == "MEHTVC"]
    rec["on"] = {"reg": int(onreg[0]["Registration number"]) if onreg else None, "registered": onreg[0]["Registration date"] if onreg else None, "order": ON[d], "read": "text layer"}
    out[d] = rec
json.dump(out, open(SP + "/htv-2026.json", "w"), indent=0, ensure_ascii=False)
FAM = {"Australian Labor Party - Victorian Branch": "ALP", "Liberal Party of Australia - Victorian Division": "COAL", "National Party of Australia - Victoria": "COAL", "Australian Greens Victoria": "GRN", "One Nation Victoria": "ON"}
def pos(d, order):
    p = {}
    for i, n in enumerate(order): p.setdefault(FAM.get(next(c for c in C[d] if c["name"] == n)["party"], "x"), i + 1)
    return p
tab = collections.Counter(); notes = []
for d, rec in out.items():
    for key in ("alp", "lib", "nat"):
        e = rec.get(key)
        if not e: 
            if key == "alp" or (key == "lib" and any(c["party"] and c["party"].startswith("Liberal") for c in C[d])) or (key == "nat" and any(c["party"] and c["party"].startswith("National") for c in C[d])): notes.append(f"NO CARD: {d} {key}")
            continue
        if e.get("open"): tab[(key, "open")] += 1; notes.append(f"open: {d} {key}"); continue
        p = pos(d, e["order"])
        if key == "alp":
            s = ("COAL>ON" if p["COAL"] < p["ON"] else "ON>COAL") + (" GRN>COAL" if p["GRN"] < p["COAL"] else " COAL>GRN")
            if s != "COAL>ON GRN>COAL": notes.append(f"{d} alp {s}")
        else:
            s = ("ON>ALP" if p["ON"] < p["ALP"] else "ALP>ON") + (" ALP>GRN" if p["ALP"] < p["GRN"] else " GRN>ALP")
            if s != "ON>ALP ALP>GRN": notes.append(f"{d} {key} {s} {p}")
        tab[(key, s)] += 1
for k, n in sorted(tab.items()): print(n, k)
print("\n".join(notes))
