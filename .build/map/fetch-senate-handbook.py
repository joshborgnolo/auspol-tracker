#!/usr/bin/env python3
"""Re-derive the senate-handbook caches from the live Parliamentary Handbook
API (handbookapi.aph.gov.au), deterministically:

- senate-service.json.gz  recordsofservice?ROSTypeID eq 9, MpOrSenator=="Senator"
  (every dated Senate term on record; this feed happily holds the 1996-class
   terms the committed cache of 2026-10-29 missed - 1,116 records by-count)
- party-service.json.gz   recordsofservice?ROSTypeID eq 11 (Parties Represented)
- individuals.json.gz     /api/individuals + the type-11 rows grouped per PHID

changed-party-senators.json.gz and presidents.json.gz are NOT this lane's:
presidents is hand-complete to 1901 and changed-party-senators' committed
derivation is not reproducible from these two entity sets alone - both stay
in place; their consumers degrade to individuals+party-service.

Discipline: the rebuild never replaces when a committed row's PHID is
absent from the fresh feed (a shrink — inspect, never silently). Runs
deterministically in that order; senate_past.py rederives its checks over
what was written.

usage: python3 .build/map/fetch-senate-handbook.py
"""
import gzip, json, os, urllib.request, collections

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC = os.path.join(ROOT, ".build", "map", "src", "senate-handbook")
API = "https://handbookapi.aph.gov.au/api"


def get(path):
    with urllib.request.urlopen(API + path, timeout=60) as f:
        return json.loads(f.read().decode())


def long_read(name):
    with gzip.open(os.path.join(SRC, name + ".json.gz"), "rt", encoding="utf-8") as f:
        return json.load(f)


def rows(doc):
    return doc["value"] if isinstance(doc, dict) else doc


def nonshrink(name, fresh_rows, key=lambda r: r["PHID"]):
    old = long_read(name)
    old = old["Rows"] if isinstance(old, dict) and "Rows" in old else old
    old_phids = {r.get("PHID") or r.get("Phid") for r in old}
    new_phids = {r.get("PHID") for r in fresh_rows}
    gone = sorted(old_phids - new_phids)
    if gone:
        raise SystemExit(f"{name}: fresh API drops {len(gone)} committed PHIDs {gone[:6]} - "
                         "investigate before replacing")
    return len(old)


def main():
    # ---- senate-service.json.gz
    rec = rows(get("/recordsofservice?%24filter=ROSTypeID%20eq%209"))
    fresh = [r for r in rec if r.get("MpOrSenator") == "Senator"]
    old_n = nonshrink("senate-service", fresh)
    out = sorted(fresh, key=lambda r: (r["PHID"], r.get("DateStart1") or "", r.get("DateEnd1") or ""))
    with gzip.open(os.path.join(SRC, "senate-service.json.gz"), "wt", compresslevel=9, encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"senate-service.json.gz: committed {old_n} -> {len(out)} rows")

    # ---- party-service.json.gz (recordsofservice ROSTypeID 11)
    ros11 = rows(get("/recordsofservice?%24filter=ROSTypeID%20eq%2011"))
    old_n = nonshrink("party-service", ros11)
    out11 = sorted(ros11, key=lambda r: (r["PHID"], r.get("DateStart1") or ""))
    with gzip.open(os.path.join(SRC, "party-service.json.gz"), "wt", compresslevel=9, encoding="utf-8") as f:
        json.dump(out11, f, separators=(",", ":"))
    print(f"party-service.json.gz: committed {old_n} -> {len(out11)} rows")

    # ---- individuals.json.gz (shape held from the committed file)
    ind = rows(get("/individuals"))
    by_phid = {r["PHID"]: r for r in ind}
    parties_of = collections.defaultdict(list)
    for r in ros11:
        if r.get("Value1"):
            parties_of[r["PHID"]].append((r.get("DateStart1") or "", r["Value1"]))
    out_ind = []
    for phid, base in sorted(by_phid.items(), key=lambda kv: kv[0]):
        party = (base.get("Party") or "").strip()
        rep = list(base.get("RepresentedParties") or [])
        if not rep:
            rep = sorted({p for _, p in parties_of.get(phid, [])})
        if not party and rep:
            party = rep[-1]
        out_ind.append({
            "PHID": phid,
            "DisplayName": base.get("DisplayName"),
            "Party": party,
            "RepresentedParties": rep,
        })
    old_n = nonshrink("individuals", out_ind)
    with gzip.open(os.path.join(SRC, "individuals.json.gz"), "wt", compresslevel=9, encoding="utf-8") as f:
        json.dump(out_ind, f, separators=(",", ":"))
    print(f"individuals.json.gz: committed {old_n} -> {len(out_ind)} rows")

    print('changed-party-senators + presidents: left as committed (see header)')


if __name__ == "__main__":
    main()
