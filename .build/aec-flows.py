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

rows = parse("/tmp/aec-flow/tcp-flow-2022.txt")
print(f"parsed {len(rows)} rows")

flow = collections.defaultdict(lambda: collections.defaultdict(float))
for frm, to, votes, pct in rows:
    dest = "ALP" if to == "ALP" else ("LNP" if to in COALITION else None)
    if dest:
        flow[frm][dest] += votes

print(f"{'from':<8} {'→ALP':>12} {'→L/NP':>12} {'ALP share':>10}")
tot_a = tot_l = 0
for frm in sorted(flow, key=lambda k: -sum(flow[k].values())):
    a, l = flow[frm]["ALP"], flow[frm]["LNP"]
    tot = a + l
    if tot < 1000: continue
    tot_a += a; tot_l += l
    print(f"{frm:<8} {a:>12,.0f} {l:>12,.0f} {100*a/tot:>9.2f}%")
print(f"\nAll minor parties combined: {tot_a:,.0f} ALP / {tot_l:,.0f} LNP → ALP share {100*tot_a/(tot_a+tot_l):.2f}%")
