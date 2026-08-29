import re, collections, sys

COALITION = {"LP", "LNP", "NP", "CLP"}

def parse(path):
    rows = []
    with open(path) as f:
        next(f); next(f)
        for line in f:
            m = re.match(r"^\d+\s+(\S+)\s+.*?\s(\d+)\s+([A-Z][A-Za-z0-9]*)\s+.*?\s(\d+)\s+([\d.]+)\s+([\d.]+)\s*$", line.strip())
            if m: rows.append((m.group(1), m.group(3), float(m.group(5)), float(m.group(6))))
    return rows

rows = parse(sys.argv[1] if len(sys.argv) > 1 else "/tmp/aec-flow/tcp-flow-2022.txt")
print(f"parsed {len(rows)} rows")

flow = collections.defaultdict(lambda: collections.defaultdict(float))
for frm, to, votes, pct in rows:
    dest = "ALP" if to == "ALP" else ("LNP" if to in COALITION else None)
    if dest:
        flow[frm][dest] += votes

print(f"{'from':<8} {'→ALP':>12} {'→L/NP':>12} {'ALP share':>10}")
for frm in sorted(flow, key=lambda k: -sum(flow[k].values())):
    a, l = flow[frm]["ALP"], flow[frm]["LNP"]
    tot = a + l
    if tot < 1000: continue
    print(f"{frm:<8} {a:>12,.0f} {l:>12,.0f} {100*a/tot:>9.2f}%")

MAJORS = {"ALP", "LP", "LNP", "NP", "CLP"}
def alp_share(pred):
    a = sum(flow[f]["ALP"] for f in flow if pred(f))
    l = sum(flow[f]["LNP"] for f in flow if pred(f))
    return a / (a + l) if a + l else float("nan")

minors = lambda f: f != "First" and f not in MAJORS
oth = lambda f: minors(f) and f not in {"GRN", "ON", "IND"}
print("\nBucket ALP shares (validate.mjs constants):")
print(f"  grn {alp_share(lambda f: f == 'GRN'):.4f}")
print(f"  onp {alp_share(lambda f: f == 'ON'):.4f}")
print(f"  ind {alp_share(lambda f: f == 'IND'):.4f}")
print(f"  oth (no IND)   {alp_share(oth):.4f}")
print(f"  ind+oth lumped {alp_share(lambda f: f == 'IND' or oth(f)):.4f}")
