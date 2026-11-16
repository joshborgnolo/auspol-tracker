import json, sys, os, collections
SP = sys.argv[1]
C = json.load(open(os.path.join(SP, "candidates-2026.json")))["districts"]
R = json.load(open(os.path.join(SP, "htv-read.json")))
FAM = {"Australian Labor Party - Victorian Branch": "ALP", "Liberal Party of Australia - Victorian Division": "LIB", "National Party of Australia - Victoria": "NAT", "Australian Greens Victoria": "GRN", "One Nation Victoria": "ON", "Victorian Socialists": "VS", "Family First Victoria": "FF"}
def fam(c): return FAM.get(c["party"], "IND" if not c["party"] else "OTH")
pat = collections.Counter(); rows = {}
for d, cards in sorted(R.items()):
    for key, r in cards.items():
        if not r["complete"]:
            pat[(key, "OPEN" if r["open"] else "UNREAD")] += 1; rows[(d, key)] = "OPEN" if r["open"] else "UNREAD"; continue
        pos = {}
        for i, name in enumerate(r["order"]):
            f = fam(next(c for c in C[d] if c["name"] == name))
            if f in ("LIB", "NAT"): f = "COAL" if key not in ("lib", "nat") else f
            pos.setdefault(f, i + 1)
        own = "ALP" if key == "alp" else None
        if key in ("lib", "nat"):
            s = ("ON>ALP" if pos["ON"] < pos["ALP"] else "ALP>ON") + (" ALP>GRN" if pos["ALP"] < pos["GRN"] else " GRN>ALP") + (" ON>GRN" if pos["ON"] < pos["GRN"] else " GRN>ON")
        else:
            co = min(pos.get("COAL", 99), 99)
            s = ("COAL>ON" if co < pos["ON"] else "ON>COAL") + (" GRN>COAL" if pos["GRN"] < co else " COAL>GRN") + f" ON@{pos['ON']}/{r['n']}"
        pat[(key, s)] += 1; rows[(d, key)] = s
for k, n in sorted(pat.items()): print(f"{n:4d}  {k[0]:4s} {k[1]}")
print()
for (d, key), s in sorted(rows.items()):
    if key in ("lib", "nat") and not s.startswith("ON>ALP ALP>GRN"): print(f"  {key} {d}: {s}")
    if key == "alp" and not s.startswith("COAL>ON GRN>COAL"): print(f"  {key} {d}: {s}")
