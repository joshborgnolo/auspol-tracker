"""parse-fed-history.py - federal House distributions of preferences before
2010, in the shape .build/estimate-state-flows.py reads (one dict per
division: cands {id: (party code, first preferences)}, steps [(excluded
ids, {recipient: votes}, exhausted)]), so the federal flows of 1984-2007 can
be ESTIMATED by the same two-class pile model as the state lines - the AEC
published no flow by party before 1996 (and 1996-2001 for classic seats
only), but every seat's full distribution exists from 1984.

Sources (.build/aec-flow-src/, README-haul-1983-2007.md):
  1984, 1987, 1990  psephos/<year>/<year>reps<state>.txt - Adam Carr's
                    transcriptions of the AEC's printed Election Statistics:
                    each division's candidates, then "Nth count: X's N votes
                    distributed" blocks (transfer per candidate, the
                    exhausted row, the running totals).
  1993-2001         dop-<year>.csv.gz - the AEC statistics packs' HPPDOP
                    per-count tables (each division's DIVISION SUMMARY row;
                    its polling places sum to it), candidates by ballot
                    position; their parties
                    from hcands-<year>.txt (the packs' HCANDS table).
  2004, 2007        dop-<year>.csv.gz - the AEC VTR download, the format
                    estimate-state-flows.py's fed_election already reads.
1983 is left out: before the 1984 Act a count stopped once a candidate
passed half the vote, so most seats never reached a final two (14
distributions in all of NSW).

Every division is checked: each count's transfers must add to the excluded
pile (less what exhausted), and the running totals printed (psephos) or
summed (HPPDOP) must match the replayed ones to the vote; a division that
fails is dropped and named. Usage: python3 .build/parse-fed-history.py
[year...] prints each year's divisions, classic seats, party codes and any
failures.
"""
import collections
import csv
import difflib
import gzip
import io
import os
import re
import sys

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "aec-flow-src")
PSEPHOS_YEARS = (1984, 1987, 1990)
HPPDOP_YEARS = (1993, 1996, 1998, 2001)
YEARS = PSEPHOS_YEARS + HPPDOP_YEARS


def norm(s):
    return re.sub(r"[^a-z]", "", s.lower())


# ------------------------------------------------------------------ psephos
def _num(s):
    return float(s.replace(",", "").replace(" ", ""))


# votes may carry a space for the thousands comma ("27 422")
ROW = re.compile(r"^(?P<name>.*?\S)\s{2,}(?:(?P<party>[A-Za-z][\w/&.'-]*)\s+)?(?P<votes>\d{1,3}(?:[, ]\d{3})*)\s+\d+\.\d")
COUNT_HEAD = re.compile(r"^\d+(?:st|nd|rd|th) count: (?P<who>.+?) ([\d,]+) votes? distributed")
# the percent columns go unread (and carry typos: "43/9")
COUNT_ROW = re.compile(r"^(?P<name>.*?[A-Za-z*+])\s+(?P<tr>\d{1,3}(?:[, ]\d{3})*)\s+\S+\s+(?P<tot>\d{1,3}(?:[, ]\d{3})*)(?:\s|$)")
EXH_ROW = re.compile(r"^\(exhausted\s+(?P<tr>[\d,]+)(?:\s+(?P<cum>[\d,]+))?")


def _surname(name):
    # "*" marks the sitting member, "+" a member moving seat
    toks = [t for t in name.replace("*", " ").replace("+", " ").split() if t]
    return toks[-1] if toks else name


def psephos_divisions(year):
    """[(division, parsed or None, problem)] for one election."""
    out = []
    d = os.path.join(SRC, "psephos", str(year))
    for fn in sorted(os.listdir(d)):
        # "\xb9" is the transcription's apostrophe in places ("Pike\xb9s")
        text = open(os.path.join(d, fn), encoding="latin-1").read().replace("\r", "").replace("\xb9", "'")
        lines = text.split("\n")
        # one block per candidate table, titled by the nearest heading above
        # it (a line over a "====" rule: "ASTON, Vic"; the Territory's one
        # division is just "NORTHERN TERRITORY"; a rule can start indented)
        tabs = [i for i, ln in enumerate(lines) if ln.startswith("Candidate") and "Party" in ln]
        titles = []
        for t in tabs:
            h = next(i for i in range(t - 1, 0, -1) if lines[i].strip() and lines[i + 1].strip().startswith("===="))
            titles.append(h)
        for k, h in enumerate(titles):
            blk = lines[h:titles[k + 1] if k + 1 < len(titles) else len(lines)]
            out.append(_psephos_block(lines[h].strip(), blk))
    return out


def _psephos_block(title, blk):
    div = title.rsplit(",", 1)[0].strip().title()
    try:
        ci = next(i for i, ln in enumerate(blk) if ln.startswith("Candidate") and "Party" in ln)
    except StopIteration:
        return (div, None, "no candidate table")
    # the rows run to the "Total" line; a note can sit above them ("1987
    # majority: ALP over Independent") between its own rules
    cands, i = [], ci + 1
    while i < len(blk) and not blk[i].startswith("Total"):
        m = ROW.match(blk[i])
        if m and not re.match(r"^\d{4} ", blk[i]):
            cands.append((m.group("name"), m.group("party") or "", _num(m.group("votes"))))
        i += 1
    if len(cands) < 2:
        return (div, None, "fewer than two candidates")
    ids = [f"c{j}" for j in range(len(cands))]
    party = {c: p for c, (_, p, _) in zip(ids, cands)}
    fp = {c: v for c, (_, _, v) in zip(ids, cands)}
    keys = collections.defaultdict(list)
    for c, (nm, _, _) in zip(ids, cands):
        keys[norm(_surname(nm))].append(c)
        keys[norm(nm)].append(c)

    def who(label):
        hit = keys.get(norm(_surname(label)), [])
        if len(hit) == 1:
            return hit[0]
        if hit:
            hit = [c for c in hit if norm(label).replace(norm(_surname(label)), "") in norm(cands[ids.index(c)][0])] or hit
            if len(hit) > 1:
                # namesakes (1987 Blaxland's two Paul Keatings): the count
                # marks the sitting member "*", so a label without it is
                # the other one
                star = "*" in label
                hit = [c for c in hit if ("*" in cands[ids.index(c)][0]) == star] or hit
            return hit[0] if len(hit) == 1 else None
        # a misspelt surname ("Sainbury" for Sainsbury): the one close match
        near = difflib.get_close_matches(norm(_surname(label)), [norm(_surname(n)) for n, _, _ in cands], n=2, cutoff=0.75)
        return keys[near[0]][0] if len(near) == 1 and len(keys[near[0]]) == 1 else None

    steps, tot, alive = [], dict(fp), set(ids)
    exh_prev, typos = 0.0, 0
    i = 0
    while i < len(blk):
        m = COUNT_HEAD.match(blk[i])
        if not m:
            i += 1
            continue
        names = re.split(r"'s?,? and |'s?, ", m.group("who"))
        names = [re.sub(r"'s?$", "", n.strip()) for n in names]
        exc = [who(n) for n in names]
        if None in exc:
            return (div, None, f"unmatched excluded {names}")
        rec, exh, exh_cum, j = {}, 0.0, None, i + 2
        printed = {}
        while j < len(blk) and not blk[j].startswith("----"):
            em = EXH_ROW.match(blk[j].strip())
            rm = COUNT_ROW.match(blk[j])
            if em:
                exh = _num(em.group("tr"))
                exh_cum = _num(em.group("cum")) if em.group("cum") else None
            elif rm:
                c = who(rm.group("name"))
                if c is None:
                    return (div, None, f"unmatched recipient {rm.group('name')!r}")
                rec[c] = _num(rm.group("tr"))
                printed[c] = _num(rm.group("tot"))
            j += 1
        pile = sum(tot[c] for c in exc)
        for c in exc:
            alive.discard(c)
            tot.pop(c)
        if set(printed) != alive:
            return (div, None, f"count names {sorted(printed)} but {sorted(alive)} remain")
        # the transcription's typos sit in one column at a time ("165" for
        # 5,165): each transfer is the change in the printed running total,
        # the exhausted one the change in its cumulative column, and the
        # count must still add to the excluded pile
        delta = {c: printed[c] - tot[c] for c in printed}
        if exh_cum is not None:
            exh = exh_cum - exh_prev
        gap = sum(delta.values()) + exh - pile
        if any(v < -1 for v in delta.values()) or abs(gap) > max(2, 0.005 * pile):
            return (div, None, f"count does not add: {sum(delta.values())} + {exh} v {pile}")
        if abs(gap) > 2:
            # a typo of a few votes in a running total: spread the gap over
            # the count's transfers so it adds to the pile (rescaled counts
            # are tallied, as typos are)
            k = (pile - exh) / sum(delta.values())
            delta = {c: v * k for c, v in delta.items()}
            typos += 1
        fixed = sum(1 for c in delta if abs(delta[c] - rec[c]) > 1)
        typos += fixed
        exh_prev = exh_cum if exh_cum is not None else exh_prev + exh
        tot = dict(printed)
        steps.append((exc, {c: v for c, v in delta.items() if v > 0}, exh))
        i = j
    return (div, {"cands": {c: (party[c], fp[c]) for c in ids}, "steps": steps, "typos": typos}, None)


# ------------------------------------------------------------------ HPPDOP
def hppdop_divisions(year):
    cand = {}
    for r in csv.DictReader(open(os.path.join(SRC, f"hcands-{year}.txt"), encoding="latin-1"), delimiter=";"):
        cand[(r["Division"], int(r["Ballot Position"]))] = (r["Party"].strip(), float(r["Vote"] or 0))
    agg = collections.defaultdict(lambda: collections.defaultdict(lambda: collections.defaultdict(float)))
    status = collections.defaultdict(lambda: collections.defaultdict(dict))
    raw = gzip.open(os.path.join(SRC, f"dop-{year}.csv.gz")).read().decode("latin-1")
    for r in csv.DictReader(io.StringIO(raw), delimiter=";"):
        # each division's own total row (the polling places sum to it)
        if r["Polling Place"].strip().upper() != "DIVISION SUMMARY":
            continue
        d, k, bp = r["Division"], int(r["Count"]), int(r["Ballot Position"])
        a = agg[d][k]
        a[("v", bp)] += float(r["Vote"] or 0)
        a[("t", bp)] += float(r["Vote Distributed"] or 0)
        if r["Exhausted Transfer"]:
            a["exh"] += float(r["Exhausted Transfer"])
        status[d][k][bp] = r["Candidate Status"].strip()
    out = []
    for d in sorted(agg):
        counts = agg[d]
        bps = sorted({bp for (kind, bp) in (x for x in counts[1] if isinstance(x, tuple))})
        ids = {bp: f"b{bp}" for bp in bps}
        cands = {}
        for bp in bps:
            p, v = cand.get((d, bp), (None, None))
            if p is None:
                out.append((d, None, f"ballot position {bp} not in HCANDS"))
                break
            # HCANDS carries the final (post-recount) first preferences, the
            # distribution its own: a few votes apart in 1993's recounted
            # seats, so the distribution's count 1 stands, within 0.5%
            if abs(v - counts[1][("v", bp)]) > max(3, 0.005 * v):
                out.append((d, None, f"first preferences {bp}: {counts[1][('v', bp)]} v HCANDS {v}"))
                break
            cands[ids[bp]] = (p, counts[1][("v", bp)])
        else:
            steps, tot, ok = [], {ids[bp]: counts[1][("v", bp)] for bp in bps}, None
            gone = set()
            for k in sorted(counts)[1:]:
                exc = [bp for bp in bps if status[d][k].get(bp) == "X" and bp not in gone]
                if not exc:
                    continue
                gone |= set(exc)
                rec = {ids[bp]: counts[k][("t", bp)] for bp in bps if bp not in gone and counts[k][("t", bp)] > 0}
                pile = sum(tot[ids[bp]] for bp in exc)
                exh = counts[k]["exh"]
                if abs(sum(rec.values()) + exh - pile) > 3:
                    ok = f"count {k} does not add: {sum(rec.values())} + {exh} v {pile}"
                    break
                for bp in exc:
                    tot.pop(ids[bp])
                for c, v in rec.items():
                    tot[c] += v
                for bp in bps:
                    if bp not in gone and abs(tot[ids[bp]] - counts[k][("v", bp)]) > 3:
                        ok = f"count {k} running total {bp}: {tot[ids[bp]]} v {counts[k][('v', bp)]}"
                        break
                if ok:
                    break
                steps.append(([ids[bp] for bp in exc], rec, exh))
            out.append((d, None if ok else {"cands": cands, "steps": steps}, ok))
    return out


def divisions_of(year):
    return psephos_divisions(year) if year in PSEPHOS_YEARS else hppdop_divisions(year)


if __name__ == "__main__":
    for y in [int(a) for a in sys.argv[1:]] or YEARS:
        ds = divisions_of(y)
        bad = [(d, why) for d, p, why in ds if p is None]
        codes = collections.Counter(c for _, p, _ in ds if p for (c, _) in p["cands"].values())
        print(f"{y}: {len(ds)} divisions, {len(bad)} failed; codes {codes.most_common(40)}")
        for d, why in bad[:12]:
            print("   !!", d, why)
