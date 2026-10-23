#!/usr/bin/env python3
# Harvest the 1998-era AEC division-profile pages from web.archive.org.
# The 1998-era content window: profiles displayed "Demographic Rating" plus
# "3 October 1998 Election" / "6 November 1999 Referendum" stats until the
# site was updated with 2001-ether content some time after the 10 Nov 2001
# election. Wayback captures the whole set across Nov-Dec 2001.
#   step 1: the eight maps/<st>/index.htm pages enumerate that state's
#           divisions (profile slugs + names)
#   step 2: per profile page, parse Demographic Rating and the 1998-election
#           Seat Status / TPP block; gate each page on being 1998-era
# Emits: aec-profiles-1998-candidates.tsv (raw harvest, validated downstream)
import re, sys, time, urllib.request, urllib.error

UA = {"User-Agent": "auspol-research/1.0 (archival harvest; contact: none)"}
STATES = {"NSW": ["nsw"], "VIC": ["vic"], "QLD": ["qld"], "SA": ["sa"],
          "WA": ["wa"], "TAS": ["tas"], "NT": ["nt"], "ACT": ["act"]}


def fetch(url, ok_codes=(200,)):
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                if r.status in ok_codes:
                    return r.read().decode("utf-8", "replace"), r.status, r.url
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError):
            pass
        time.sleep(3 * (attempt + 1))                                   # polite backoff: wayback throttles bursts
    return None, None, None


def wb(path, stamp="20011215"):
    url = f"http://web.archive.org/web/{stamp}id_/{path}"
    body, code, final = fetch(url)
    cap = None
    if final:
        m = re.match(r".*?/web/(\d{14})", final)
        if m: cap = m.group(1)
    return body, cap


def textlines(html):
    t = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html, flags=re.S | re.I)
    t = re.sub(r"<[^>]+>", "\n", t)
    import html as H
    t = H.unescape(t)
    return [l.strip() for l in t.splitlines() if l.strip()]


rows = []
for st, (abbr,) in STATES.items():
    body, cap = wb(f"http://www.aec.gov.au/electorates/maps/{abbr}/index.htm")
    if not body:
        print(f"MAP MISS {st}", file=sys.stderr); continue
    links = re.findall(r'href="\.\./\.\./profiles/[a-z]/([a-z0-9_-]+)\.htm"[^>]*>([^<]*)<', body, flags=re.I)
    print(st, "mapidx cap", cap, "links", len(links))
    seen = set()
    for slug, label in links:
        if slug in seen: continue
        seen.add(slug)
        rows.append([st, slug, label.strip()])
    time.sleep(1.2)

print("total divisions from map pages:", len(rows))

out = []
for i, (st, slug, name) in enumerate(rows):
    body, cap = wb(f"http://www.aec.gov.au/electorates/profiles/{name.lower()[0] if name else 'z'}/{slug}.htm")
    # slug dir is by first letter of division name, but derive from slug for safety
    if not body:
        body, cap = wb(f"http://www.aec.gov.au/electorates/profiles/{slug[0]}/{slug}.htm")
    if not body:
        print(f"PROFILE MISS {st} {slug} {name}", file=sys.stderr); continue
    lines = textlines(body)
    full = "\n".join(lines)
    era = "1998" if "3 October 1998" in full else ("2001-era" if re.search(r"10 November 2001|2001 Election", full) else "?")
    rating = ""
    for j, l in enumerate(lines):
        if l.strip().lower() == "demographic rating":
            rating = lines[j + 1] if j + 1 < len(lines) else ""
            break
    status = ""
    m = re.search(r"Seat Status:\s*\n?\s*([A-Za-z' -]+?)(?:\n|  +)", full)
    if m: status = m.group(1).strip()
    print(f"{i+1:3d} {st} {slug:22s} cap={cap} era={era} rating={rating!r} status={status!r}")
    out.append((st, slug, name, rating, status, cap or "", era))
    time.sleep(1.2)

with open(".build/analysis/seat-model/divclass-src/2001/aec-profiles-1998-candidates.tsv", "w") as f:
    f.write("# state\tslug\tname\tdemographicRating\tseatStatus1998\tcapture\tera\n")
    for r in out:
        f.write("\t".join(r) + "\n")
print("wrote", len(out), "rows")
