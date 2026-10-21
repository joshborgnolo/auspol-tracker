// news24-oneoffs-audit.mjs — page when a News24 Pulse one-off question has
// not reached data/news24-one-offs.json (Beyond the vote).
//
// The rotating questions are filed by hand, and nothing used to notice one
// going unfiled: the wave extractor reads only the wave's main article,
// while News24 runs some of each wave's questions in companion stories (the
// 20 Oct 2026 extremism and antisemitism tables sat unfiled until the owner
// spotted the story; the 21 Sep rate-blame entry still holds one prose
// figure for the same reason). Every Pulse story lands on the topic page,
// newest first, so the audit reads the stories published since the latest
// wave's fieldwork closed, takes every Infogram embed that is not part of
// the standing battery (crosstab, approvals, ppm, tpp, horserace), and
// reports any whose id is neither filed (an entry's `embed.id`) nor
// declared in the store's `not_filed` list with a reason.
//
// Pure apart from the injected fetchers, so the test drives it offline.

export const STANDING_KINDS = new Set(["crosstab", "approvals", "ppm", "tpp", "horserace"]);
export const MAX_STORIES = 10; // read cap per run; a wave has had 1-4 stories
const OLDER_RUN = 2; // stop after this many consecutive pre-wave stories

const storyId = (u) => (String(u ?? "").match(/news-story\/([0-9a-f]{32})/) || [])[1] ?? null;

export function topicStoryUrls(html) {
  return [...new Set([...String(html ?? "").matchAll(/href="((?:https:\/\/www\.news24\.com\.au)?\/[a-z0-9\/-]+\/news-story\/[0-9a-f]{32})"/g)]
    .map((m) => new URL(m[1], "https://www.news24.com.au").href))];
}

export function publishedOf(html) {
  const m = String(html ?? "").match(/"datePublished"\s*:\s*"([^"]+)"/);
  const t = m ? Date.parse(m[1]) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export function filedSets(store) {
  const filed = new Set((store?.one_offs ?? []).map((e) => e?.embed?.id).filter(Boolean));
  const skipped = new Set((store?.not_filed ?? []).map((s) => s?.embed).filter(Boolean));
  return { filed, skipped };
}

/**
 * @param {object} o
 * @param {string} o.waveEnd       latest YouGov wave's fieldwork end (YYYY-MM-DD)
 * @param {object} o.store         parsed data/news24-one-offs.json
 * @param {() => Promise<string>} o.fetchTopic
 * @param {(url: string) => Promise<string|null>} o.fetchArticle  article HTML or null
 * @param {(html: string) => string[]} o.idsOf                   Infogram ids in an article
 * @param {(ids: string[]) => Promise<object[]>} o.classify     n24InfogramFetch over the ids
 */
export async function auditN24OneOffs({ waveEnd, store, fetchTopic, fetchArticle, idsOf, classify }) {
  const out = { waveEnd, stories: [], unfiled: [], notes: [] };
  if (!waveEnd) { out.notes.push("no YouGov wave to audit against"); return out; }
  const since = Date.parse(`${waveEnd}T00:00:00Z`);
  const { filed, skipped } = filedSets(store);
  let urls;
  try { urls = topicStoryUrls(await fetchTopic()); }
  catch (e) { out.notes.push(`topic page unavailable (${e?.message ?? e})`); return out; }
  if (!urls.length) { out.notes.push("topic page listed no stories"); return out; }
  let older = 0;
  for (const url of urls.slice(0, MAX_STORIES)) {
    const html = await fetchArticle(url);
    if (!html) { out.notes.push(`story ${storyId(url)?.slice(0, 8)} unreadable`); continue; }
    const published = publishedOf(html);
    if (!published) { out.notes.push(`story ${storyId(url)?.slice(0, 8)} has no datePublished`); continue; }
    if (Date.parse(published) < since) { if (++older >= OLDER_RUN) break; continue; }
    older = 0;
    const ids = idsOf(html);
    const projects = ids.length ? await classify(ids) : [];
    const oneOffs = projects.filter((p) => !STANDING_KINDS.has(p.kind) && p.state !== "note");
    out.stories.push({ url, published, embeds: ids.length, oneOffs: oneOffs.map((p) => p.id) });
    for (const p of oneOffs) {
      if (filed.has(p.id) || skipped.has(p.id) || out.unfiled.some((u) => u.id === p.id)) continue;
      out.unfiled.push({ id: p.id, title: p.title ?? null, kind: p.kind, story: url });
    }
  }
  return out;
}

export const unfiledWarning = (u) =>
  `one-off not filed: "${u.title ?? "?"}" (${u.id}) in ${u.story} — append it to data/news24-one-offs.json (with a THEME_OF topic in .build/newtracker/adhoc-themes.mjs), or list it under not_filed with a reason`;
