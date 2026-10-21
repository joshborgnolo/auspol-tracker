// test-news24-oneoffs-audit.mjs — offline pins for the News24 one-off audit
// (news24-oneoffs-audit.mjs): which stories it reads, which embeds count as
// one-offs, and what counts as filed.
import assert from "node:assert/strict";
import { auditN24OneOffs, topicStoryUrls, publishedOf, unfiledWarning, MAX_STORIES } from "./news24-oneoffs-audit.mjs";

const story = (slug, hex) => `https://www.news24.com.au/politics/australian-politics/${slug}/news-story/${hex.repeat(32 / hex.length)}`;
const S = {
  companion: story("extremism", "a"), main: story("main-wave", "b"),
  old1: story("last-wave", "c"), old2: story("older-still", "d"), never: story("never-read", "e"),
};
const topic = Object.values(S).map((u) => `<a href="${u.replace("https://www.news24.com.au", "")}">x</a>`).join("") + `<a href="${S.main}">dupe</a>`;
const article = (iso, ids) => `<script>{"datePublished":"${iso}"}</script>` + ids.map((i) => `<div data-id="${i}"></div>`).join("");
const pages = {
  [S.companion]: article("2026-10-20T18:00:00.000Z", ["_/ext", "_/anti"]),
  [S.main]: article("2026-10-20T10:00:00.000Z", ["_/vi", "_/ppm", "_/unemp", "_/note"]),
  [S.old1]: article("2026-10-07T05:00:00.000Z", ["_/oldq"]),
  [S.old2]: article("2026-10-06T05:00:00.000Z", ["_/older"]),
  [S.never]: article("2026-10-21T05:00:00.000Z", ["_/never"]),
};
const KIND = { "_/ext": "unmodelled", "_/anti": "unmodelled", "_/vi": "crosstab", "_/ppm": "ppm",
  "_/unemp": "topical", "_/note": "unmodelled", "_/oldq": "issues", "_/older": "unmodelled", "_/never": "unmodelled" };
const read = [];
const deps = (store, extra = {}) => ({
  waveEnd: "2026-10-20", store,
  fetchTopic: async () => topic,
  fetchArticle: async (u) => { read.push(u); return pages[u] ?? null; },
  idsOf: (h) => [...h.matchAll(/data-id="([^"]+)"/g)].map((m) => m[1]),
  classify: async (ids) => ids.map((id) => ({ id, title: `T ${id}`, kind: KIND[id], ...(id === "_/note" ? { state: "note" } : {}) })),
  ...extra,
});

// 1. parsers
assert.equal(topicStoryUrls(topic).length, 5, "topic links deduped, made absolute");
assert.equal(publishedOf(pages[S.main]), "2026-10-20T10:00:00.000Z");
assert.equal(publishedOf("<p>none</p>"), null);
console.log("1. parsers: OK");

// 2. an empty store: every one-off from the wave's stories pages, standing
//    kinds and unread (note) embeds never do; pre-wave stories stop the scan
read.length = 0;
let a = await auditN24OneOffs(deps({ one_offs: [] }));
assert.deepEqual(a.unfiled.map((u) => u.id), ["_/ext", "_/anti", "_/unemp"]);
assert.equal(a.stories.length, 2);
assert.ok(!read.includes(S.never), "two consecutive pre-wave stories end the scan");
assert.match(unfiledWarning(a.unfiled[0]), /^one-off not filed: "T _\/ext" \(_\/ext\) in https:\/\/www\.news24\.com\.au\/.*extremism/);
console.log("2. unfiled one-offs page, standing battery never: OK");

// 3. filed (embed.id) and declared (not_filed) embeds are quiet
a = await auditN24OneOffs(deps({
  one_offs: [{ id: "x", embed: { id: "_/ext" } }, { id: "y", embed: { id: "_/unemp" } }],
  not_filed: [{ embed: "_/anti", why: "duplicate of a main-site figure" }],
}));
assert.deepEqual(a.unfiled, []);
console.log("3. filed + not_filed are quiet: OK");

// 4. degraded legs note, never throw or page
a = await auditN24OneOffs(deps({ one_offs: [] }, { fetchTopic: async () => { throw new Error("503"); } }));
assert.deepEqual([a.unfiled, a.notes], [[], ["topic page unavailable (503)"]]);
a = await auditN24OneOffs(deps({ one_offs: [] }, { waveEnd: null }));
assert.deepEqual(a.notes, ["no YouGov wave to audit against"]);
a = await auditN24OneOffs(deps({ one_offs: [] }, { fetchArticle: async (u) => (u === S.companion ? null : pages[u]) }));
assert.deepEqual(a.unfiled.map((u) => u.id), ["_/unemp"]);
assert.match(a.notes[0], /unreadable/);
console.log("4. degraded legs note only: OK");

// 5. the read cap holds on a page of fresh stories
const many = Array.from({ length: MAX_STORIES + 5 }, (_, i) => story(`s${i}`, i.toString(16).padStart(2, "0")));
read.length = 0;
await auditN24OneOffs(deps({ one_offs: [] }, {
  fetchTopic: async () => many.map((u) => `<a href="${u}">`).join(""),
  fetchArticle: async (u) => { read.push(u); return article("2026-10-21T00:00:00.000Z", []); },
}));
assert.equal(read.length, MAX_STORIES);
console.log("5. read cap: OK");

console.log("test-news24-oneoffs-audit: all pass");
