import collections, sys

MAJORS = {"ALP", "LP", "LNP", "NP", "CLP"}

# TPP flow download (HouseTppFlowByStateByPartyDownload-<EVENT>.txt), banner +
# column header, then TAB-separated rows:
#   <state> <party-ab> <party name> <ALP votes> <ALP %> <Coal votes> <Coal %>
# "First Preferences" rows have an EMPTY party-ab cell. Destinations are
# already the two ALP/Coalition columns — no from/to collapse needed as in
# the TCP file (aec-flows.py). No NAT block: sum the eight state rows.
def parse(path):
    rows = []
    with open(path) as f:
        next(f); next(f)
        for line in f:
            c = line.rstrip("\n").split("\t")
            if len(c) < 7:
                continue
            rows.append((c[1] or "First", float(c[3]), float(c[5])))
    return rows

rows = parse(sys.argv[1] if len(sys.argv) > 1 else "/tmp/aec-tpp-flow-2025.txt")
print(f"parsed {len(rows)} rows")

flow = collections.defaultdict(lambda: collections.defaultdict(float))
for frm, a, l in rows:
    flow[frm]["ALP"] += a
    flow[frm]["LNP"] += l

print(f"{'from':<8} {'→ALP':>12} {'→L/NP':>12} {'ALP share':>10}")
for frm in sorted(flow, key=lambda k: -sum(flow[k].values())):
    a, l = flow[frm]["ALP"], flow[frm]["LNP"]
    if a + l < 1000: continue
    print(f"{frm:<8} {a:>12,.0f} {l:>12,.0f} {100*a/(a+l):>9.2f}%")

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
