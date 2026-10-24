#!/bin/bash
# Haul the per-BOOTH AEC products into .build/aec-flow-src/booth/ (committed).
#
# Products (all official AEC Virtual Tally Room, one origin per lane):
#   booth/fpv/<year>-<ST>.csv.gz  HouseStateFirstPrefsByPollingPlaceDownload-EV-ST.csv   (2004-2025)
#   booth/tpp-pp/<year>.csv.gz    HouseTppByPollingPlaceDownload-EV.csv                  (2004-2025)
#   booth/tcf/<year>-<ST>.csv.gz  members of External/HouseTcpFlowByPPDownload-EV-ST.zip (2004-2025),
#                                  merged into one CSV per state (banner+header once, then rows)
#   booth/fpv/<year>.csv.gz       1993/1996/1998/2001: count-1 rows repacked from the
#                                  already-committed dop-<year>.csv.gz (HPPDOP lane; the
#                                  stats packs carry no separate per-PP FPV product)
#
# Stats-era TPP-by-PP (1996/1998/2001) is the already-committed htpp-<year>.txt lane —
# not duplicated here. There is NO stats-era per-PP TCP-flow product; flows are 2004-on.
#
# Idempotent: an existing non-empty target is skipped unless --force. Run from repo root.

set -euo pipefail
cd "$(dirname "$0")/.."

BOOTH=.build/aec-flow-src/booth
STATES="NSW VIC QLD WA SA TAS ACT NT"
FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

want() { [ "$FORCE" = 1 ] || [ ! -s "$1" ]; }

fetch() { # fetch <url> <dest.csv.gz>
  local url="$1" dest="$2"
  curl -fsSL --retry 2 --retry-delay 5 "$url" | gzip -9 > "$dest.tmp"
  mv "$dest.tmp" "$dest"
}

MOD="2004:12246:results 2007:13745:Website 2010:15508:Website 2013:17496:Website 2016:20499:Website 2019:24310:Website 2022:27966:Website 2025:31496:Website"

mkdir -p "$BOOTH/fpv" "$BOOTH/tpp-pp" "$BOOTH/tcf"
FAILS=""

for spec in $MOD; do
  yr="${spec%%:*}"; rest="${spec#*:}"; ev="${rest%%:*}"; kind="${rest##*:}"
  base="https://results.aec.gov.au/$ev/$kind"

  t="$BOOTH/tpp-pp/$yr.csv.gz"
  if want "$t"; then
    echo "TPP-PP $yr"
    fetch "$base/Downloads/HouseTppByPollingPlaceDownload-$ev.csv" "$t" || FAILS="$FAILS tpp-pp/$yr"
  fi

  for st in $STATES; do
    t="$BOOTH/fpv/$yr-$st.csv.gz"
    if want "$t"; then
      echo "FPV $yr $st"
      fetch "$base/Downloads/HouseStateFirstPrefsByPollingPlaceDownload-$ev-$st.csv" "$t" || FAILS="$FAILS fpv/$yr-$st"
    fi

    t="$BOOTH/tcf/$yr-$st.csv.gz"
    if want "$t"; then
      echo "TCF $yr $st"
      z="/tmp/aec-booth-tcf-$ev-$st.zip"
      if curl -fsSL --retry 2 --retry-delay 5 -o "$z" "$base/External/HouseTcpFlowByPPDownload-$ev-$st.zip"; then
        # Merge members: banner+header from the first division member, rows only from the rest.
        if python3 - "$z" <<'PYEOF' | gzip -9 > "$t.tmp"
import sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
names = [n for n in z.namelist() if n.lower().endswith(".csv")]
if not names:
    sys.exit("no csv members")
names.sort()
header = None
out = []
for name in names:
    raw = z.read(name).replace(b"\r\n", b"\n").replace(b"\r", b"\n")
    lines = [l for l in raw.split(b"\n") if l.strip()]
    if len(lines) < 2:
        sys.exit("short member " + name)
    h = lines[1]
    if header is None:
        header = h
        out.extend(lines)
    else:
        if h != header:
            sys.exit("header mismatch in " + name)
        out.extend(lines[2:])
sys.stdout.buffer.write(b"\n".join(out) + b"\n")
PYEOF
        then
          mv "$t.tmp" "$t"
        else
          rm -f "$t.tmp"
          FAILS="$FAILS tcf/$yr-$st(merge)"
        fi
        rm -f "$z"
      else
        FAILS="$FAILS tcf/$yr-$st"
      fi
    fi
  done
done

# --- stats era: FPV-by-PP = count-1 rows of the committed HPPDOP cascades ---
FORCE="$FORCE" python3 - <<'PYEOF' || FAILS="$FAILS stats-fpv"
import csv, gzip, os
for yr in (1993, 1996, 1998, 2001):
    out = f".build/aec-flow-src/booth/fpv/{yr}.csv.gz"
    src = f".build/aec-flow-src/dop-{yr}.csv.gz"
    if os.environ.get("FORCE") != "1" and os.path.exists(out) and os.path.getsize(out) > 0:
        continue
    n = 0
    with gzip.open(src, "rt", newline="") as f, gzip.open(out, "wt", newline="") as g:
        r = csv.reader(f, delimiter=";")
        w = csv.writer(g, delimiter=";")
        head = next(r)
        ix = {k: head.index(k) for k in ("State", "Division", "Polling Place", "Count", "Ballot Position", "Candidate Status", "Vote", "Vote Pc")}
        w.writerow(["State", "Division", "Polling Place", "Ballot Position", "Candidate Status", "Vote", "Vote Pc"])
        for row in r:
            if len(row) < len(head) or row[ix["Count"]].strip() != "1":
                continue
            pp = row[ix["Polling Place"]]
            if "SUMMARY" in pp.upper():
                continue
            w.writerow([row[ix[k]] for k in ("State", "Division", "Polling Place", "Ballot Position", "Candidate Status", "Vote", "Vote Pc")])
            n += 1
    print(f"stats-fpv {yr}: {n} booth rows")
PYEOF

if [ -n "$FAILS" ]; then
  echo "HAUL FAILURES:$FAILS" >&2
  exit 1
fi
echo "haul complete"
