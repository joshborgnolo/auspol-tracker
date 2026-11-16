import sys, json, re, collections
raw = json.load(open(sys.argv[1]))
rows = list(raw.values())[0]
asat = [r[0] for r in rows[:6] if str(r[0]).startswith("As at")][0]
out = collections.OrderedDict(); cur = None
for r in rows:
    a = str(r[0]).strip()
    m = re.match(r"^(.*) District$", a)
    if m and not any(str(x).strip() for x in r[1:]):
        cur = m.group(1); out[cur] = []; continue
    if re.match(r"^(.*) Region$", a) and not any(str(x).strip() for x in r[1:]):
        cur = None; continue
    if cur is None or not a or a.startswith("(") or a == "Candidates": continue
    out[cur].append({"name": a, "party": str(r[4]).strip() or None})
json.dump({"asAt": asat, "districts": out}, open(sys.argv[2], "w"), ensure_ascii=False, indent=0)
print(asat, len(out), "districts", sum(len(v) for v in out.values()), "candidates")
tally = collections.Counter(c["party"] or "(independent)" for v in out.values() for c in v)
for k, n in tally.most_common(): print(f"  {n:4d}  {k}")
sizes = collections.Counter(len(v) for v in out.values()); print(sorted(sizes.items()))
