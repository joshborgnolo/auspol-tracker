"""Mirror the NTEC Legislative Assembly per-division Distribution of
Preferences pages into .build/state-flow-src/nt/<YEAR>/<division>.html,
one file per division per election, via the Chrome-piggyback fetcher
(`.build/chrome-article.mjs`) - ntec.nt.gov.au sits behind a Cloudflare
challenge that 403s plain curl.

Source
------
https://www.ntec.nt.gov.au results tree:
  2024  /elections/current-elections/2024-territory-election/results/<div>
  2020  /elections/past-elections/legislative-assembly/2020-territory-election/results/<div>
  2016  /elections/past-elections/legislative-assembly/2016-territory-election/results/<div>
(Mulka exists only from the 2023 redistribution - 2024 onwards.)
Each page carries a Distribution-of-preferences `<table>` identified by
its header signature (first cell "Count", second "Comments") - 2024's copy
wears the id `table__distribution-of-preferences`, 2016/2020's strips the
ids. Numbered exclusion rows are the DOP chain the parser consumes.
Divisions with a two-candidate count have the table reduced to a single
first-preferences row (parse-side: "no chain"); divisions whose final pair
is not ALP v CLP (Blain held IND 2016/2020; Mulka 2024 IND v CLP with
only two candidates) contribute primaries but no classic-cut flows.
2016 carries an "Exhausted" column (optional preferential pre-2021);
2020/2024 do not.

2024 Mulka caveat (2026-10-20): the `current-elections` base serves a
404 shell for `/results/mulka` even though the nav lists it; the
`past-elections` base serves the real page. Mulka is therefore fetched
from the past-elections URL (a one-off 2024 URL override, see
`URL_OVERRIDES`).

Idempotent: a saved page is never re-fetched. Re-run with --force to
redo. Rate-limited by the fetcher's own page-load latency.
"""
import os
import re
import subprocess
import sys

ROOT = ".build/state-flow-src/nt"
FETCHER = ".build/chrome-article.mjs"

# Division slugs per year (from each year's results index page nav). 25
# per election. Redistributions shuffle names: 2016 had Stuart+Nhulunbuy
# (both fold into Gwoja from 2020); Gwoja runs 2020/2024; Mulka runs
# 2020/2024, carved mostly out of Nhulunbuy territory (the 2019 remapping).
DIVISIONS_BY_YEAR = {
    2016: ["arafura", "araluen", "arnhem", "barkly", "blain", "braitling",
           "brennan", "casuarina", "daly", "drysdale", "fannie-bay",
           "fong-lim", "goyder", "johnston", "karama", "katherine",
           "namatjira", "nelson", "nhulunbuy", "nightcliff", "port-darwin",
           "sanderson", "spillett", "stuart", "wanguri"],
    2020: ["arafura", "araluen", "arnhem", "barkly", "blain", "braitling",
           "brennan", "casuarina", "daly", "drysdale", "fannie-bay",
           "fong-lim", "goyder", "gwoja", "johnston", "karama", "katherine",
           "mulka", "namatjira", "nelson", "nightcliff", "port-darwin",
           "sanderson", "spillett", "wanguri"],
    2024: ["arafura", "araluen", "arnhem", "barkly", "blain", "braitling",
           "brennan", "casuarina", "daly", "drysdale", "fannie-bay",
           "fong-lim", "goyder", "gwoja", "johnston", "karama", "katherine",
           "mulka", "namatjira", "nelson", "nightcliff", "port-darwin",
           "sanderson", "spillett", "wanguri"],
}

URL_BASE = {
    2024: ("https://ntec.nt.gov.au/elections/current-elections/"
           "2024-territory-election/results"),
    2020: ("https://ntec.nt.gov.au/elections/past-elections/"
           "legislative-assembly/2020-territory-election/results"),
    2016: ("https://ntec.nt.gov.au/elections/past-elections/"
           "legislative-assembly/2016-territory-election/results"),
}

# (year, division) -> absolute URL override. Mulka 2024 sits only under
# the past-elections tree (see module docstring).
URL_OVERRIDES = {
    (2024, "mulka"): ("https://ntec.nt.gov.au/elections/past-elections/"
                      "legislative-assembly/2024-territory-election/"
                      "results/mulka"),
}

MIN_BYTES = 4000

DOP_SIG = re.compile(r"<table[^>]*>(?:(?!</table>).)*?First preferences",
                     re.S)

def has_dop_table(html):
    """A division page exposes its DOP chain on a table whose first body
    row opens 'First preferences' (labelled count 1) - match that shape
    rather than any id attribute, which changed between 2024 (has id
    `table__distribution-of-preferences`) and 2016/2020 (no ids)."""
    return DOP_SIG.search(html) is not None


def fetch(url, dest, force=False):
    if os.path.exists(dest) and not force and os.path.getsize(dest) >= MIN_BYTES:
        return "cached"
    r = subprocess.run(["node", FETCHER, url], capture_output=True, text=True)
    if r.returncode != 0:
        return f"FAIL exit={r.returncode}"
    html = r.stdout or ""
    if not has_dop_table(html):
        return "FAIL no-DOP-table"
    if len(html) < MIN_BYTES:
        return f"FAIL small ({len(html)}b)"
    tmp = dest + ".tmp"
    with open(tmp, "w") as f:
        f.write(html)
    os.replace(tmp, dest)
    return f"ok ({len(html)//1024}KB)"


def main():
    force = "--force" in sys.argv[1:]
    only_year = None
    for a in sys.argv[1:]:
        if a.startswith("--year="):
            only_year = int(a.split("=", 1)[1])
    years = [only_year] if only_year else sorted(DIVISIONS_BY_YEAR)
    rc = 0
    for year in years:
        base = URL_BASE[year]
        divs = DIVISIONS_BY_YEAR[year]
        out_dir = os.path.join(ROOT, str(year))
        os.makedirs(out_dir, exist_ok=True)
        n_ok = n_cached = n_fail = 0
        for d in divs:
            dest = os.path.join(out_dir, f"{d}.html")
            url = URL_OVERRIDES.get((year, d), f"{base}/{d}")
            st = fetch(url, dest, force=force)
            if st == "cached":
                n_cached += 1
            elif st.startswith("ok"):
                n_ok += 1
                print(f"  {year}/{d}: {st}")
            else:
                n_fail += 1
                print(f"  {year}/{d}: {st}", file=sys.stderr)
                rc = 1
        print(f"{year}: {n_ok} fetched, {n_cached} cached, {n_fail} failed")
    return rc


if __name__ == "__main__":
    sys.exit(main())
