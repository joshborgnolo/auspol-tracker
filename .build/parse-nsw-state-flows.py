"""parse-nsw-state-flows.py - COUNTED NSW Legislative Assembly preference
flows, 2015, 2019 and 2023, from the NSW Electoral Commission's ballot-level
preference data (see harvest-nsw-state-flows.py).

Unlike every other state on file, NSW publishes each ballot paper's
preferences, so its flows are counts, not estimates. Per district:
  * the official distribution of preferences (<district>-dop.html.gz) gives
    each candidate's name, party code and first preferences, and the counts
    the commission published (it stops once a candidate passes an absolute
    majority);
  * the ballots (zip/*.zip: one row per marking, PrefCounted the counted
    order) are re-counted here: the official exclusions are replayed and
    every published count's progressive totals and exhausted votes must
    match to the vote, or the parse stops; then the count runs on,
    lowest-first, to the final two;
  * every formal ballot ends with whichever of the final two it ranks
    first, or exhausts if it ranks neither (NSW is optional preferential).

Same classic-seat estimand as the other states: a bucket's flow is its
ballots' split between Labor and the Coalition in districts whose final two
were Labor v Liberal or National, its exhausted ballots set aside (they are
counted in counts.csv, and the share is of the ballots that reached either).

Outputs:
  * data/state-flows.csv rows for "nsw" (the flow_* columns are counts);
  * .build/state-flow-src/nsw/<year>/counts.csv – per district and
    first-preference candidate: party, first preferences, ballots ending
    with each finalist, exhausted; plus each zip's sha256;
  * .build/state-flow-src/nsw/<year>/chains.csv – the full exclusion chain
    to the final two, the shape .build/estimate-state-flows.py reads (it
    runs its model on NSW too, scored against these counts).
  * data/state-flows-nsw-allseats.json – the NOTIONAL scan: the same
    ballots re-read as a Labor v Coalition contest in EVERY district (not
    just the ones whose final two were Labor v Coalition), the basis
    Antony Green's statewide figures (and the /flows-explained/ chart's
    NSW line) are on. A ballot goes "to Labor" if it ranks the Labor
    candidate ahead of every Liberal/National candidate, "to Coalition" on
    the converse, and "exhausted" if it ranks neither. District-years with
    no Labor or no Coalition candidate are skipped and recorded.
Both the CSVs and counts.csv/chains.csv are committed, so nothing
downstream needs the zips. Usage:
parse-nsw-state-flows.py [year...]
"""
import collections
import csv
import gzip
import hashlib
import html
import io
import json
import os
import re
import sys
import zipfile

ROOT = os.path.join(".build", "state-flow-src", "nsw")
OUT = "data/state-flows.csv"
ALL = "data/state-flows-nsw-allseats.json"
COLS = ["jurisdiction", "year", "party", "prim_votes", "prim_share",
        "flow_alp_votes", "flow_coal_votes", "flow_to_alp",
        "n_seats", "n_dop", "n_classic", "formal_votes"]
YEARS = (2015, 2019, 2023)
BUCKETS = ("alp", "lib", "nat", "grn", "onp", "oth")
EMIT = ("grn", "onp", "oth", "lib", "nat", "alp")
# the ABC's published statewide ALP two-party-preferred estimates – the
# audit the notional scan is run against (abc.net.au party-totals pages):
# 2015 ALP 45.7, 2019 ALP 48.0, 2023 ALP 54.3. The 2023 scan lands 0.2
# below the ABC figure, the residual of the ABC's own notional estimate vs
# a strict ballot-level recount.
ANTONY_2PP = {2015: 45.7, 2019: 48.0, 2023: 54.3}


def bucket_for(code):
    """NSW codes. Labor ran as LAB, and in the bush as Country Labor (CLP –
    in NSW, not the Territory's Country Liberals), in 2019; as ALP in 2023."""
    c = (code or "").upper()
    if c in ("ALP", "LAB", "CLP"):
        return "alp"
    if c == "LIB":
        return "lib"
    if c in ("NAT", "NP"):
        return "nat"
    if c == "GRN":
        return "grn"
    if c in ("ON", "ONP", "PHON"):
        return "onp"
    return "oth"


def _num(x):
    x = re.sub(r"[^\d.-]", "", x or "")
    return float(x) if re.fullmatch(r"-?\d+(\.\d+)?", x) else None


def read_dop(doc):
    """the official distribution: candidates (name -> code, first prefs),
    and per published count the excluded candidate, progressive totals and
    exhausted total."""
    rows = []
    for t in re.findall(r"<table.*?</table>", doc, re.S):
        for r in re.findall(r"<tr.*?</tr>", t, re.S):
            rows.append([re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", x))).strip()
                         for x in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", r, re.S)])
    hi = next((i for i, r in enumerate(rows) if r and r[0] == "Candidates"), None)
    if hi is None:
        return None
    excl_hdr = next((r for r in rows[:hi] if any("Excluded Candidate" in c for c in r)), [])
    # "SURNAME Given (CODE) Excluded Candidate"; an independent has no "(CODE)"
    order = [re.sub(r"\s*(\([A-Z0-9]+\))?\s*Excluded Candidate$", "", c) for c in excl_hdr if "Excluded Candidate" in c]
    cands, code, fpv, prog = [], {}, {}, collections.defaultdict(dict)
    exhausted = []
    for r in rows[hi + 1:]:
        if not r or r[0] in ("Informal", "Total Votes / Ballot Papers", "Absolute Majority", "Total Votes in Count"):
            continue
        if r[0] == "Exhausted Votes":
            exhausted = [_num(x) for x in r[3::2]]     # running totals after each count
            continue
        toks = r[0].split()
        if len(toks) >= 3 and toks[-1].isupper() and toks[-1] != toks[0]:
            name, c = " ".join(toks[:-1]), toks[-1]
        else:
            name, c = r[0], ""
        cands.append(name)
        code[name] = c
        fpv[name] = _num(r[1]) or 0.0
        for k, x in enumerate(r[3::2]):          # progressive totals after count k+2
            if x and "EXCLUDED" not in x:
                v = _num(x.replace("ELECTED", ""))
                if v is not None:
                    prog[k][name] = v
    return {"cands": cands, "code": code, "fpv": fpv, "order": order,
            "prog": [prog[k] for k in sorted(prog)], "exhausted": exhausted[:len(order)]}


def read_ballots(path):
    """formal ballots as tuples of candidate names in counted order."""
    z = zipfile.ZipFile(path)
    txt = z.read(z.namelist()[0]).decode("utf-8-sig", "replace")
    marks = collections.defaultdict(list)
    for r in csv.DictReader(io.StringIO(txt), delimiter="\t"):
        if r.get("Formality") != "Formal":
            continue
        pc = (r.get("PrefCounted") or "").strip()
        if not pc.isdigit():
            continue
        marks[(r["PollingPlaceName"], r["BPNumber"])].append((int(pc), r["CandidateName"].strip()))
    return [tuple(n for _, n in sorted(m)) for m in marks.values()]


def recount(ballots, cands, order):
    """replay the official exclusions, then lowest-first to two. Returns the
    per-count (excluded, transfers incl. exhausted, progressive totals) chain."""
    alive = set(cands)
    pos = [0] * len(ballots)
    holder = [None] * len(ballots)

    def place(i):
        b = ballots[i]
        while pos[i] < len(b) and b[pos[i]] not in alive:
            pos[i] += 1
        holder[i] = b[pos[i]] if pos[i] < len(b) else None

    for i in range(len(ballots)):
        place(i)
    tot = collections.Counter(h for h in holder if h)
    chain = []
    queue = list(order)
    while len(alive) > 2:
        x = queue.pop(0) if queue else min(alive, key=lambda c: (tot[c], c))
        alive.discard(x)
        moved = collections.Counter()
        for i, h in enumerate(holder):
            if h == x:
                place(i)
                moved[holder[i] or "__exh"] += 1
        tot.pop(x, None)
        for c, v in moved.items():
            if c != "__exh":
                tot[c] += v
        chain.append((x, dict(moved), dict(tot)))
    return chain, sorted(alive)


def districts_of(year):
    """[(district, chain parse)] from the committed chains.csv – the shape
    the estimator reads: cands {name: (bucket, fp)}, steps, final."""
    path = os.path.join(ROOT, str(year), "chains.csv")
    cnt = os.path.join(ROOT, str(year), "counts.csv")
    if not os.path.exists(path):
        return []
    cands = collections.defaultdict(dict)
    for r in csv.DictReader(open(cnt)):
        cands[r["district"]][r["candidate"]] = (bucket_for(r["party"]), float(r["first_prefs"]))
    steps = collections.defaultdict(lambda: collections.defaultdict(dict))
    for r in csv.DictReader(open(path)):
        steps[r["district"]][(int(r["step"]), r["excluded"])][r["recipient"]] = float(r["votes"])
    out = []
    for d in sorted(cands):
        st = []
        for (k, x), rec in sorted(steps[d].items()):
            exh = rec.pop("__exh", 0.0)
            st.append(([x], rec, exh))
        gone = {s[0][0] for s in st}
        out.append((d, {"cands": cands[d], "steps": st, "final": sorted(c for c in cands[d] if c not in gone)}))
    return out


def main():
    years = [int(a) for a in sys.argv[1:]] or list(YEARS)
    keep = []
    if os.path.exists(OUT):
        with open(OUT) as f:
            keep = [r for r in csv.DictReader(f)
                    if not (r.get("jurisdiction") == "nsw" and int(r["year"]) in years)]
    all_rows, failures = list(keep), []
    # the notional all-seats store persists across single-year invocations
    aseats = {}
    if os.path.exists(ALL):
        old = json.load(open(ALL))
        skipped = old.get("skipped") or [[] for _ in old["years"]]
        for i, y in enumerate(old["years"]):
            aseats[y] = dict(grn=old["grn"][i], grnExh=old["grnExh"][i],
                             onp=old["onp"][i], onpExh=old["onpExh"][i],
                             oth=old["oth"][i], othExh=old["othExh"][i],
                             votes={g: old["votes"][g][i] for g in ("grn", "onp", "oth")},
                             implied2pp=old["implied2pp"][i], skipped=skipped[i])
    for year in years:
        ydir = os.path.join(ROOT, str(year))
        # "SG2301 LA Pref Data Albury.zip"; 2015: "SGE2015 LA Pref Data_NA_Albury.zip"
        zips = {re.sub(r"^SGE?\d+ LA Pref Data( |_NA_)", "", n)[:-4].lower().replace(" ", "-").replace("'", ""): os.path.join(ydir, "zip", n)
                for n in os.listdir(os.path.join(ydir, "zip")) if n.endswith(".zip")}
        dops = sorted(n[:-len("-dop.html.gz")] for n in os.listdir(ydir) if n.endswith("-dop.html.gz"))
        prim = collections.Counter()
        flows = {b: [0.0, 0.0, 0.0] for b in BUCKETS}
        notion = collections.defaultdict(lambda: [0, 0, 0])
        n_classic = 0
        crow, chrow, nonclassic, notion_skipped = [], [], [], []
        for d in dops:
            dop = read_dop(gzip.open(os.path.join(ydir, f"{d}-dop.html.gz")).read().decode("utf-8", "replace"))
            zp = zips.get(d)
            if not dop or not zp:
                failures.append((year, d, "no dop or no ballots"))
                continue
            ballots = read_ballots(zp)
            chain, final = recount(ballots, dop["cands"], dop["order"])
            # every published count must match the recount to the vote
            fp_check = collections.Counter(b[0] for b in ballots if b)
            miss = [(c, fp_check[c], dop["fpv"][c]) for c in dop["cands"] if abs(fp_check[c] - dop["fpv"][c]) > 0]
            exh_run = 0
            for k, prog in enumerate(dop["prog"]):
                if k >= len(chain):
                    break
                exh_run += chain[k][1].get("__exh", 0)
                miss += [(f"count {k + 2} {c}", chain[k][2].get(c), v) for c, v in prog.items() if abs(chain[k][2].get(c, -1) - v) > 0]
                if k < len(dop["exhausted"]) and dop["exhausted"][k] is not None and dop["exhausted"][k] != exh_run:
                    miss.append((f"count {k + 2} exhausted", exh_run, dop["exhausted"][k]))
            if miss:
                failures.append((year, d, miss[:4]))
                continue
            sha = hashlib.sha256(open(zp, "rb").read()).hexdigest()
            for c in dop["cands"]:
                prim[bucket_for(dop["code"][c])] += dop["fpv"][c]
            per = collections.defaultdict(lambda: [0, 0, 0])
            for b in ballots:
                dest = next((c for c in b if c in final), None)
                per[b[0]][final.index(dest) if dest else 2] += 1
            for c in dop["cands"]:
                crow.append({"district": d, "candidate": c, "party": dop["code"][c], "first_prefs": int(dop["fpv"][c]),
                             "final1": final[0], "final2": final[1], "to_final1": per[c][0], "to_final2": per[c][1],
                             "exhausted": per[c][2], "zip_sha256": sha})
            for k, (x, moved, _) in enumerate(chain):
                for rcp, v in sorted(moved.items()):
                    chrow.append({"district": d, "step": k + 1, "excluded": x, "recipient": rcp, "votes": v})
            fb = {bucket_for(dop["code"][c]) for c in final}
            if fb in ({"alp", "lib"}, {"alp", "nat"}):
                n_classic += 1
                a = 0 if bucket_for(dop["code"][final[0]]) == "alp" else 1
                for c in dop["cands"]:
                    b = bucket_for(dop["code"][c])
                    flows[b][0] += per[c][a]
                    flows[b][1] += per[c][1 - a]
                    flows[b][2] += per[c][2]
            else:
                nonclassic.append((d, "/".join(sorted(fb))))
            # the notional Labor v Coalition scan – every district, classic
            # or not: where does each formal ballot rank Labor vs any
            # Liberal/National candidate?
            alp_cs = [c for c in dop["cands"] if bucket_for(dop["code"][c]) == "alp"]
            coal_cs = frozenset(c for c in dop["cands"] if bucket_for(dop["code"][c]) in ("lib", "nat"))
            if len(alp_cs) != 1 or not coal_cs:
                notion_skipped.append(d)
            else:
                a0 = alp_cs[0]
                for b in ballots:
                    g = bucket_for(dop["code"][b[0]])
                    ra = rc = None
                    for k, c in enumerate(b):
                        if c == a0:
                            if ra is None:
                                ra = k
                        elif c in coal_cs and rc is None:
                            rc = k
                        if ra is not None and rc is not None:
                            break
                    if ra is None and rc is None:
                        notion[g][2] += 1
                    elif ra is not None and (rc is None or ra < rc):
                        notion[g][0] += 1
                    else:
                        notion[g][1] += 1
        for name, rows_, cols in (("counts.csv", crow, ["district", "candidate", "party", "first_prefs", "final1", "final2",
                                                        "to_final1", "to_final2", "exhausted", "zip_sha256"]),
                                  ("chains.csv", chrow, ["district", "step", "excluded", "recipient", "votes"])):
            with open(os.path.join(ydir, name), "w", newline="") as f:
                w = csv.DictWriter(f, fieldnames=cols)
                w.writeheader()
                w.writerows(rows_)
        formal = sum(prim.values())
        n_seat = len(dops)
        for b in EMIT:
            fa, fc, fx = flows[b]
            all_rows.append({"jurisdiction": "nsw", "year": year, "party": b,
                             "prim_votes": round(prim[b]), "prim_share": round(100 * prim[b] / formal, 4) if formal else "",
                             "flow_alp_votes": round(fa), "flow_coal_votes": round(fc),
                             "flow_to_alp": round(fa / (fa + fc), 6) if fa + fc else "",
                             "n_seats": n_seat, "n_dop": n_seat, "n_classic": n_classic, "formal_votes": round(formal)})
        print(f"{year}: {n_seat} districts, {n_classic} classic, non-classic {len(nonclassic)}: {nonclassic}")
        for b in ("grn", "onp", "oth"):
            fa, fc, fx = flows[b]
            if fa + fc:
                print(f"    {b}: {100 * fa / (fa + fc):5.1f}% to Labor of those reaching either; {100 * fx / (fa + fc + fx):4.1f}% exhausted")
        # the notional all-seats year entry: shares of every formal ballot
        def nshare(g):
            a, c, x = notion[g]
            tot = a + c + x
            if not tot:
                return (None, None)
            return (round(100 * a / (a + c), 1) if a + c else None, round(100 * x / tot, 1))
        tot_a = sum(notion[g][0] for g in BUCKETS)
        tot_c = sum(notion[g][1] for g in BUCKETS)
        ent = {"votes": {g: [notion[g][0], notion[g][1]] for g in ("grn", "onp", "oth")},
               "implied2pp": round(100 * tot_a / (tot_a + tot_c), 1) if tot_a + tot_c else None,
               "skipped": list(notion_skipped)}
        for g in ("grn", "onp", "oth"):
            ent[g], ent[g + "Exh"] = nshare(g)
        aseats[year] = ent
        print(f"    notional all-seats: implied ALP 2PP {ent['implied2pp']} "
              f"(Antony's published estimate {ANTONY_2PP.get(year, '?')}), skipped {notion_skipped}")
        for g in ("grn", "onp", "oth"):
            if ent[g] is not None:
                print(f"    {g}: {ent[g]:5.1f}% to Labor of those ranking either, {ent[g + 'Exh']:4.1f}% ranking neither")
    if failures:
        for f in failures:
            print("  !!", f)
        sys.exit(f"{len(failures)} district(s) failed the recount check – {OUT} left as it was")
    all_rows.sort(key=lambda r: (r["jurisdiction"], int(r["year"]), EMIT.index(r["party"])))
    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS)
        w.writeheader()
        w.writerows(all_rows)
    print(f"wrote {OUT} ({len(all_rows)} rows total)")
    ys = sorted(aseats)
    doc = {"source": "NSW Electoral Commission ballot papers, scanned notionally Labor v Coalition in every district",
           "years": ys,
           "grn": [aseats[y]["grn"] for y in ys], "grnExh": [aseats[y]["grnExh"] for y in ys],
           "onp": [aseats[y]["onp"] for y in ys], "onpExh": [aseats[y]["onpExh"] for y in ys],
           "oth": [aseats[y]["oth"] for y in ys], "othExh": [aseats[y]["othExh"] for y in ys],
           "votes": {g: [aseats[y]["votes"][g] for y in ys] for g in ("grn", "onp", "oth")},
           "implied2pp": [aseats[y]["implied2pp"] for y in ys],
           "skipped": [aseats[y]["skipped"] for y in ys]}
    with open(ALL, "w") as f:
        json.dump(doc, f, indent=1)
        f.write("\n")
    print(f"wrote {ALL} (years {ys})")


if __name__ == "__main__":
    main()
