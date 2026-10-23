#!/usr/bin/env python3
# Harvest v2: the 2001-division-set AEC profile pages from web.archive.org,
# enumerated from the CDX list (cdx-profiles-window.txt) — the v1 map-index
# enumeration only surfaced the rural subset (43/150); CDX collapse=urlkey
# gives the exact 150-slug 2001 set.
#
# Each slug is fetched at its OWN capture timestamp (Nov 2001–Oct 2002 span).
# v1 verified that captures well into 2002 still carry the "3 October 1998
# Election" Seat Status block (pages weren't updated until later in 2002),
# and v1's QLD dawson capture at 20020222135519 era-checked 1998.
#
# Parse = v1's proven logic: Demographic Rating (line after label),
# Seat Status regex, era gate on "3 October 1998".
# Emits: aec-profiles-2001epoch-v2.tsv
import os, re, sys, time, urllib.request, urllib.error

UA = {"User-Agent": "auspol-research/1.0 (archival harvest; contact: none)"}
ROOT = os.path.dirname(os.path.abspath(__file__))
CDX = os.path.join(ROOT, "cdx-profiles-window.txt")
OUT = os.path.join(ROOT, "aec-profiles-2001epoch-v2.tsv")
# dedup v1 run: harvest-1998.py crashed?? no — v1 succeeded; its TSV holds
# per-slug captures known to fetch+parse cleanly. prefer those captures so a
# re-run of a known-good slug isn't needed.
V1_TSV = os.path.join(ROOT, "aec-profiles-1998-candidates.tsv")

ALIASES = {"kingsford": "kingsfordsmith", "melports": "melbourneports"}


def norm_slug(s):
    s = ALIASES.get(s, s)
    return re.sub(r"[^a-z0-9]", "", s)      # new_england -> newengland, oconnor etc.


def fetch(url, ok_codes=(200,)):
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                if r.status in ok_codes:
                    return r.read().decode("utf-8", "replace"), r.status, r.url
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError):
            pass
        time.sleep(min(45, 3 * (attempt + 1)))              # polite backoff: wayback throttles bursts
    return None, None, None


def load_pairs():
    pairs = {}          # slug -> (timestamp, original_url)
    for line in open(CDX):
        line = line.strip()
        if not line:
            continue
        parts = line.rsplit(None, 1)
        if len(parts) != 2:
            continue
        orig, ts = parts
        m = re.search(r"/profiles/(?:[a-zA-Z]/)?([^/]+)\.htm", orig)
        if not m:
            continue
        slug = norm_slug(m.group(1).lower())
        # keep the EARLIEST capture per slug (closest to the 10 Nov 2001
        # election; least chance of a 2002 content refresh slipping in)
        if slug not in pairs or ts < pairs[slug][0]:
            pairs[slug] = (ts, orig)
    return pairs


def textlines(html):
    t = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html, flags=re.S | re.I)
    t = re.sub(r"<[^>]+>", "\n", t)
    import html as H
    t = H.unescape(t)
    return [l.strip() for l in t.splitlines() if l.strip()]


def parse_profile(body):
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
    if m:
        status = m.group(1).strip()
    return era, rating, status


def main():
    pairs = load_pairs()
    print("slugs from CDX:", len(pairs))

    # per-slug preferred capture: v1's known-good capture if v1 got the slug,
    # else the CDX-earliest. v1 rows also give us the state label.
    v1 = {}
    for line in open(V1_TSV):
        if line.startswith("#") or not line.strip():
            continue
        st, slug, name, rating, status, cap, era = line.rstrip("\n").split("\t")
        v1[norm_slug(slug)] = (st, cap)

    out, misses = [], []
    for i, slug in enumerate(sorted(pairs)):
        ts, orig = pairs[slug]
        st = v1[slug][0] if slug in v1 else ""
        if slug in v1 and v1[slug][1]:
            ts = v1[slug][1]          # known-good v1 capture stamp
        url = f"https://web.archive.org/web/{ts}id_/{orig}"
        body, code, final = fetch(url)
        if not body:
            misses.append(slug)
            print(f"{i+1:3d} {slug:22s} FETCH MISS", file=sys.stderr, flush=True)
        else:
            era, rating, status = parse_profile(body)
            cap = ""
            if final:
                m = re.search(r"/web/(\d{14})", final)
                if m:
                    cap = m.group(1)
            print(f"{i+1:3d} {slug:22s} cap={cap} era={era} rating={rating!r} status={status!r}", flush=True)
            out.append((st, slug, rating, status, cap, era))
        time.sleep(1.2)

    with open(OUT, "w") as f:
        f.write("# state\tslug\tdemographicRating\tseatStatus1998\tcapture\tera\n")
        for r in out:
            f.write("\t".join(r) + "\n")
    print("wrote", len(out), "rows;", len(misses), "misses:", ",".join(misses) or "none")


if __name__ == "__main__":
    main()
