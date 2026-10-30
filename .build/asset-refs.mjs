/* asset-refs.mjs — which asset paths do the site's documents reference?

   Shared extraction for the torn-tree guards. The 2026-10-31 incident (the
   Now page's late styles 404ing live) showed refs hide where an attribute
   scan never looks: window.AP_LATE=["assets/js/late-css.<hash>.js", …] is a
   JS config string, not a <script src>. Three lanes, unioned:

   1. markup attrs — <script src>, <link href>, media srcs, resolved the way
      the browser does (site-absolute and doc-relative)
   2. inline-<style> url() — fonts/art ride the document's own CSS
   3. bare "assets/…" strings — loader config (AP_LATE / AP_CYCLE_SRC /
      AP_ONEOFF_SRC and any future sibling), taken root-relative

   referencedAssets(ref, root) computes the set over a COMMITTED tree: the
   guards must judge what a commit lands, not the worktree the build
   happened to run in. Consumers: check-asset-refs.mjs (--tree audits the
   candidate push's tree), build.mjs (a sweep never deletes a file HEAD's
   deployed pages still point at), test-asset-refs.mjs. */

import path from "node:path";
import { execFileSync } from "node:child_process";

/* site documents only — .build mirrors of third-party pages name their own
   assets (their jquery, their fonts) and are not ours to satisfy */
export const NOT_SITE = /^(?:\.build|\.matilda|\.claude|\.github|\.impeccable|\.pnpm|\.worktrees|node_modules)\//;

const ATTR_RE = /<(script|link|img|video|audio|source|use)\b[^>]*?(?:src|href)\s*=\s*(["'])([^"']+)\2/gi;
const STYLE_RE = /<style[^>]*>([\s\S]*?)<\/style>/gi;
const URL_RE = /url\(\s*(["']?)([^"')]+)\1\s*\)/g;
/* the trailing lookahead keeps `.js` from matching the head of `.json`
   (alternation order alone doesn't: regex takes the first alternative that
   completes, js inside json, dropping the tail on the floor) */
const BARE_RE = /\bassets\/[A-Za-z0-9._~/-]*\.(?:json|webmanifest|woff2|css|js|png|svg|ico|xml|txt)(?![A-Za-z0-9])(?:\?[A-Za-z0-9=&_%+.-]*)?/g;
const SKIP = /^(?:https?:)?\/\/|^(?:data|mailto|tel|sms|javascript):/i;
/* #f and its url-encoded twin %23f are internal svg fragments, never paths */
const FRAG = /^#|^%23/i;

/* One document's refs, normalised repo-root-relative. docRel is the doc's
   own root-relative path — its dirname is the resolution base the browser
   would use. Anything landing outside the repo is dropped (unverifiable). */
export function refsOfDocument(text, docRel = "") {
  const out = new Set();
  const dir = path.posix.dirname(docRel);
  const put = (raw) => {
    let ref = (raw || "").trim();
    if (!ref || SKIP.test(ref) || FRAG.test(ref)) return;
    ref = ref.split(/[?#]/)[0];
    if (!ref) return;
    if (ref.startsWith("/")) ref = ref.slice(1);
    else if (docRel && !ref.startsWith("assets/")) ref = path.posix.normalize(path.posix.join(dir, ref));
    if (!ref || ref === ".." || ref.startsWith("../")) return;
    out.add(ref);
  };
  let m;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(text))) put(m[3]);
  STYLE_RE.lastIndex = 0;
  let s;
  while ((s = STYLE_RE.exec(text))) {
    URL_RE.lastIndex = 0;
    while ((m = URL_RE.exec(s[1]))) put(m[2]);
  }
  /* lane 3 substrings can't tell "assets/x.js" from "https://host/assets/
     x.js", so blank absolute (and protocol-relative) URLs first — a local
     page's own refs never carry a scheme or a host */
  const local = text.replace(/(?:https?:)?\/\/[^\s"'<>)\]]+/g, "//");
  BARE_RE.lastIndex = 0;
  while ((m = BARE_RE.exec(local))) put(m[0]);
  return out;
}

/* Every asset path the site's committed documents reference at a git ref.
   Reads the tree only — the worktree is irrelevant, which is exactly the
   property the guards need. Throws if git can't read the ref. */
export function referencedAssets(ref, root) {
  const names = execFileSync("git", ["ls-tree", "-r", "--name-only", ref], {
    cwd: root, encoding: "utf8", maxBuffer: 1 << 27,
  }).split("\n").filter(Boolean);
  const refs = new Set();
  for (const doc of names) {
    if (!doc.endsWith(".html") || NOT_SITE.test(doc)) continue;
    const html = execFileSync("git", ["show", `${ref}:${doc}`], {
      cwd: root, encoding: "utf8", maxBuffer: 1 << 27,
    });
    for (const r of refsOfDocument(html, doc)) refs.add(r);
  }
  return refs;
}
